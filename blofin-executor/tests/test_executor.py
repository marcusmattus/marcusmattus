import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bfx.config import BASE_URLS, MODE_LIVE, Settings
from bfx.executor import Executor, SafetyError, eligibility
from bfx.journal import Journal
from bfx.strategy import UPTREND, Analysis, EXTREME_VOL
from tests.fakes import FakeExchange, flat_then_jump

INST = "ETH-USDT"


def analysis(fx, *, close=2700.0, atr=30.0, cross_up=True, cross_down=False, regime=UPTREND, trend=UPTREND,
             age_ms=60_000):
    bar_close = fx.now - age_ms
    return Analysis(INST, bar_close - 14_400_000, bar_close, close, atr, close, close - 1, close - 50,
                    cross_up, cross_down, trend, 0.5, regime)


class Base(unittest.TestCase):
    def setUp(self):
        self.fx = FakeExchange()
        self.s = Settings(trading_equity_usdt=1000, instruments=(INST,))
        self.j = Journal(":memory:", "PAPER", clock=self.fx.clock)
        self.ex = Executor(self.fx, self.s, self.j, clock=self.fx.clock, sleep=lambda _: None)
        self.fx.candle_rows[INST] = flat_then_jump()
        # signal-bar re-check in try_entry reads the latest confirmed bar
        self.a = analysis(self.fx)
        self.fx.candle_rows[INST][-1][0] = str(self.a.bar_ts)

    def entry(self, a=None):
        a = a or self.a
        snap = self.ex.snapshot()
        halts, mult = self.ex.breakers(snap)
        return self.ex.try_entry(a, snap, halts, mult)


class TestEntry(Base):
    def test_protected_entry(self):
        tid = self.entry()
        self.assertIsNotNone(tid)
        t = self.j.trade(tid)
        self.assertEqual(t["status"], "OPEN")
        stops = self.fx.tpsl_pending(INST)
        self.assertEqual(len(stops), 1)
        self.assertEqual(float(stops[0]["slTriggerPrice"]), t["stop_current"])
        self.assertLessEqual(t["risk_amount"], 1000 * 0.0025 + 1e-9)
        kinds = [e["kind"] for e in self.j.events(limit=50)]
        for k in ("ORDER_PLAN", "ORDER_ACK", "STOP_VERIFIED", "ENTRY_PROTECTED"):
            self.assertIn(k, kinds)
        order = next(c for c in self.fx.calls if c[0] == "place_order")
        self.assertEqual(order[3], "ioc")

    def test_stop_retry_then_success(self):
        self.fx.fail_stop_places = 1
        tid = self.entry()
        self.assertIsNotNone(tid)
        self.assertEqual(len(self.fx.tpsl_pending(INST)), 1)

    def test_protection_failure_flattens(self):
        self.fx.fail_stop_places = 2
        tid = self.entry()
        self.assertIsNone(tid)
        self.assertEqual(self.fx.positions(INST), [])
        self.assertTrue(self.j.events("ORDER_PROTECTION_FAILURE"))
        self.assertIn("ORDER_PROTECTION_FAILURE", [h["kind"] for h in self.j.active_halts()])
        closed = self.j.closed_trades()
        self.assertEqual(len(closed), 1)
        self.assertIn("ORDER_PROTECTION_FAILURE", closed[0]["exit_reason"])

    def test_no_fomo(self):
        self.fx.price[INST] = 2700 + 30 * 0.6  # ran 0.6 ATR past signal close
        self.assertIsNone(self.entry())
        self.assertFalse(any(c[0] == "place_order" for c in self.fx.calls))
        self.assertIn("NO FOMO", self.j.events("SIGNAL_REJECTED")[0]["detail"])

    def test_extreme_volatility_blocked(self):
        self.assertIsNone(self.entry(analysis(self.fx, regime=EXTREME_VOL)))
        self.assertFalse(any(c[0] == "place_order" for c in self.fx.calls))

    def test_stale_signal(self):
        self.assertIsNone(self.entry(analysis(self.fx, age_ms=3 * 3_600_000)))

    def test_no_pyramiding(self):
        self.assertIsNotNone(self.entry())
        self.j.set(f"attempt:{INST}:{self.a.bar_ts}", "")  # even if attempt key cleared
        self.assertIsNone(self.entry())
        self.assertEqual(sum(1 for c in self.fx.calls if c[0] == "place_order"), 1)

    def test_halt_blocks_entries(self):
        self.j.add_halt("LOSING_STREAK", "test", True)
        self.assertIsNone(self.entry())

    def test_ioc_unfilled_is_not_chased(self):
        orig = self.fx.place_order

        def moving(**kw):
            self.fx.price[INST] += 50  # market jumps before the order lands
            return orig(**kw)
        self.fx.place_order = moving
        self.assertIsNone(self.entry())
        self.assertTrue(self.j.events("ENTRY_NOT_FILLED"))
        self.assertEqual(self.fx.positions(INST), [])

    def test_liquidation_check_uses_actual_position(self):
        self.fx.liq_override = 2690.0  # exchange reports liq above the stop
        self.assertIsNone(self.entry())
        self.assertTrue(self.j.events("LIQUIDATION_SAFETY_FAIL"))
        self.assertEqual(self.fx.positions(INST), [])


class TestManage(Base):
    def test_trail_ratchets_up_only(self):
        tid = self.entry()
        t = self.j.trade(tid)
        up = analysis(self.fx, close=2800.0, cross_up=False)
        self.ex.manage_open(t, up)
        t2 = self.j.trade(tid)
        self.assertAlmostEqual(t2["stop_current"], 2800 - 30 * 3.5)
        self.ex.manage_open(t2, analysis(self.fx, close=2650.0, cross_up=False))
        self.assertAlmostEqual(self.j.trade(tid)["stop_current"], 2800 - 30 * 3.5)
        self.assertEqual(float(self.fx.tpsl_pending(INST)[0]["slTriggerPrice"]), 2800 - 30 * 3.5)

    def test_exit_signal_closes_and_journals(self):
        tid = self.entry()
        self.fx.price[INST] = 2750.0
        self.ex.manage_open(self.j.trade(tid), analysis(self.fx, close=2750.0, cross_up=False, cross_down=True))
        t = self.j.trade(tid)
        self.assertEqual(t["status"], "CLOSED")
        self.assertGreater(t["pnl"], 0)
        self.assertEqual(self.fx.tpsl_pending(INST), [])
        self.assertIsNotNone(t["r_multiple"])

    def test_reconcile_detects_stop_hit(self):
        tid = self.entry()
        self.fx.hit_stop(INST)
        self.ex.reconcile(self.ex.snapshot())
        t = self.j.trade(tid)
        self.assertEqual(t["status"], "CLOSED")
        self.assertLess(t["pnl"], 0)
        self.assertAlmostEqual(t["r_multiple"], -1.0, delta=0.25)

    def test_reconcile_restores_missing_stop(self):
        tid = self.entry()
        for o in self.fx.stops.values():
            o["state"] = "canceled"
        self.ex.reconcile(self.ex.snapshot())
        self.assertEqual(len(self.fx.tpsl_pending(INST)), 1)
        self.assertEqual(self.j.trade(tid)["status"], "OPEN")

    def test_unmanaged_position_blocks_instrument(self):
        self.fx.pos[INST] = {"size": __import__("decimal").Decimal("1"), "avg": 2700.0}
        snap = self.ex.snapshot()
        self.assertIn(INST, snap.blocked)
        self.assertIsNone(self.ex.try_entry(self.a, snap, [], 1.0))


class TestE2EFlow(Base):
    def test_e2e_demo_against_fake(self):
        logs = []
        self.assertTrue(self.ex.e2e_demo(INST, log=logs.append), "\n".join(logs))
        self.assertEqual(self.fx.positions(INST), [])
        self.assertEqual(self.fx.tpsl_pending(INST), [])
        self.assertEqual(self.j.active_halts(), [])          # test failures never halt the real strategy
        self.assertEqual(self.j.closed_trades(), [])          # test trades excluded from stats
        ok, reasons = eligibility(self.j, self.s)
        self.assertFalse(any("PROTECTION" in r for r in reasons))


class TestSafety(unittest.TestCase):
    def test_paper_refuses_production_host(self):
        fx = FakeExchange()
        fx.base_url = BASE_URLS[MODE_LIVE]
        s = Settings(trading_equity_usdt=100)
        ex = Executor(fx, s, Journal(":memory:", "PAPER"))
        with self.assertRaises(SafetyError):
            ex.assert_mode_safe()

    def test_live_requires_arming_and_eligibility(self):
        with TemporaryDirectory() as d:
            import bfx.config as cfg
            old = cfg.ROOT
            cfg.ROOT = Path(d)
            try:
                fx = FakeExchange()
                fx.base_url = BASE_URLS[MODE_LIVE]
                s = Settings(mode=MODE_LIVE, trading_equity_usdt=100)
                ex = Executor(fx, s, Journal(":memory:", MODE_LIVE), paper_journal=Journal(":memory:", "PAPER"))
                with self.assertRaisesRegex(SafetyError, "not armed"):
                    ex.assert_mode_safe()
                (Path(d) / "state").mkdir()
                (Path(d) / "state" / "LIVE_ARMED").write_text("ENABLE BLOFIN LIVE TRADING\n")
                with self.assertRaisesRegex(SafetyError, "not LIVE-eligible"):
                    ex.assert_mode_safe()
            finally:
                cfg.ROOT = old

    def test_eligibility_ignores_test_failures_only(self):
        s = Settings(trading_equity_usdt=100)
        j = Journal(":memory:", "PAPER")
        j.event("ORDER_PROTECTION_FAILURE", INST, test=True)
        _, reasons = eligibility(j, s)
        self.assertFalse(any("PROTECTION" in r for r in reasons))
        j.event("ORDER_PROTECTION_FAILURE", INST, test=False)
        _, reasons = eligibility(j, s)
        self.assertTrue(any("PROTECTION" in r for r in reasons))


if __name__ == "__main__":
    unittest.main()

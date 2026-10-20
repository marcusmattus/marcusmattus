import ast
import json
import unittest
from pathlib import Path

import bfx
from bfx.capital import (CapitalCorrupt, CapitalEngine, CapitalState, apply_realized, max_drawdown_pct,
                         next_milestone_gbp)
from bfx.config import ConfigError, Settings
from bfx.executor import Executor
from bfx.journal import Journal
from bfx.risk import CAUTION, HALTED, NO_NEW, NORMAL, REDUCED, drawdown_ladder, effective_risk_pct
from bfx.strategy import UPTREND
from tests.fakes import FakeExchange, aligned
from tests.test_executor import analysis

INST = "ETH-USDT"


class TestProfitLock(unittest.TestCase):
    def test_worked_example(self):
        st = CapitalState(1000, 1000, 0, 1000)
        st, locked = apply_realized(st, 100, 0.10)
        self.assertAlmostEqual(locked, 10)
        self.assertEqual((round(st.profit_reserve, 9), round(st.trading_capital, 9)), (10, 1090))
        self.assertEqual((round(st.total_equity, 9), round(st.high_water_mark, 9)), (1100, 1100))
        st, locked = apply_realized(st, -70, 0.10)
        self.assertEqual(locked, 0)
        self.assertEqual((round(st.trading_capital, 9), round(st.total_equity, 9)), (1020, 1030))
        self.assertAlmostEqual(st.high_water_mark, 1100)
        st, locked = apply_realized(st, 70, 0.10)    # recovery back to HWM: never locks
        self.assertEqual(locked, 0)
        self.assertEqual((round(st.trading_capital, 9), round(st.total_equity, 9)), (1090, 1100))
        tc_before, pr_before = st.trading_capital, st.profit_reserve
        st, locked = apply_realized(st, 50, 0.10)    # 50 above HWM -> 5 reserved, 45 compounded
        self.assertAlmostEqual(locked, 5)
        self.assertAlmostEqual(st.profit_reserve - pr_before, 5)
        self.assertAlmostEqual(st.trading_capital - tc_before, 45)
        self.assertAlmostEqual(st.high_water_mark, 1150)

    def test_partial_recovery_then_new_high_locks_only_the_excess(self):
        st = CapitalState(1000, 1000, 0, 1000)
        st, _ = apply_realized(st, -100, 0.10)
        st, locked = apply_realized(st, 130, 0.10)    # 100 recovers the loss, only 30 is new high
        self.assertAlmostEqual(locked, 3)
        self.assertAlmostEqual(st.total_equity, 1030)

    def test_losses_only_hit_trading_capital(self):
        st, _ = apply_realized(CapitalState(1000, 1000, 0, 1000), 100, 0.10)
        st, _ = apply_realized(st, -500, 0.10)
        self.assertAlmostEqual(st.profit_reserve, 10)
        self.assertAlmostEqual(st.trading_capital, 590)

    def test_engine_persists_mode_separated(self):
        s = Settings(trading_equity_usdt=1000)
        j = Journal(":memory:", "PAPER")
        eng = CapitalEngine(j, s)
        for pnl in (100, -70, 70, 50):
            eng.apply_close(1, "B", pnl)
        st = CapitalEngine(j, s).state()
        self.assertAlmostEqual(st.profit_reserve, 15)
        self.assertAlmostEqual(st.trading_capital, 1135)
        self.assertEqual(len(j.ledger()), 4)
        self.assertEqual(sum(r["locked"] > 0 for r in j.ledger()), 2)
        live = Journal(":memory:", "LIVE")
        live.db = j.db  # same database file, other mode
        self.assertAlmostEqual(CapitalEngine(live, Settings(trading_equity_usdt=50)).state().trading_capital, 50)

    def test_init_replays_existing_closed_trades_once(self):
        j = Journal(":memory:", "PAPER")
        for pnl, test in ((5.0, 0), (99.0, 1), (-2.0, 0)):
            tid = j.open_trade(strategy_id="B", inst_id=INST, direction=1, is_test=test)
            j.update_trade(tid, status="CLOSED", pnl=pnl, exit_ts=tid)
        st = CapitalEngine(j, Settings(trading_equity_usdt=100)).state()
        self.assertAlmostEqual(st.profit_reserve, 0.5)         # test trade (+99) ignored
        self.assertAlmostEqual(st.total_equity, 103)
        self.assertEqual(len(j.events("CAPITAL_INIT")), 1)
        CapitalEngine(j, Settings(trading_equity_usdt=100)).state()
        self.assertEqual(len(j.events("CAPITAL_INIT")), 1)

    def test_corrupt_state_detected(self):
        j = Journal(":memory:", "PAPER")
        eng = CapitalEngine(j, Settings(trading_equity_usdt=100))
        eng.state()
        j.capital_save(trading_capital=float("nan"))
        with self.assertRaises(CapitalCorrupt):
            eng.state()

    def test_milestones(self):
        self.assertEqual(next_milestone_gbp(100 / 0.745, 0.745), 250)
        self.assertIsNone(next_milestone_gbp(100, None))
        s = Settings(trading_equity_usdt=1300, gbp_per_usdt=0.745)   # ~£968
        j = Journal(":memory:", "PAPER")
        eng = CapitalEngine(j, s)
        up = eng.apply_close(1, "B", 50)                              # ~£1,006 -> £1k crossed
        self.assertEqual(up.milestones, (1_000,))
        eng.apply_close(2, "B", -40)
        self.assertEqual(eng.apply_close(3, "B", 45).milestones, ())  # re-cross never re-alerts
        self.assertAlmostEqual(max_drawdown_pct([100, 120, 90, 130]), 0.25)


class Base(unittest.TestCase):
    def setUp(self):
        self.fx = FakeExchange()
        self.s = Settings(trading_equity_usdt=1000, instruments=(INST,), gbp_per_usdt=0.745)
        self.j = Journal(":memory:", "PAPER", clock=self.fx.clock)
        self.ex = Executor(self.fx, self.s, self.j, clock=self.fx.clock, sleep=lambda _: None)
        self.a = analysis(self.fx)
        self.fx.candle_rows[INST] = aligned(self.fx)
        self.fx.candle_rows[INST][-1][0] = str(self.a.bar_ts)

    def set_capital(self, tc, pr=0.0, hwm=None):
        CapitalEngine(self.j, self.s).state()
        self.j.capital_save(trading_capital=tc, profit_reserve=pr, high_water_mark=hwm or tc + pr)

    def entry(self, a=None):
        snap = self.ex.snapshot()
        halts, mult = self.ex.breakers(snap)
        return self.ex.try_entry(a or self.a, snap, halts, mult)


class TestSizing(Base):
    def test_sizing_uses_trading_capital_not_reserve(self):
        self.set_capital(900, 100, 1000)
        snap = self.ex.snapshot()
        self.assertAlmostEqual(snap.trading_equity, 900)
        tid = self.entry()
        risk = self.j.trade(tid)["risk_amount"]
        self.assertLessEqual(risk, 900 * 0.0025 + 1e-9)
        self.assertGreater(risk, 900 * 0.0025 * 0.9)

    def test_reserve_never_funds_trades(self):
        self.set_capital(1.0, 999.0, 1000.0)           # big reserve, tiny TC, rich exchange account
        self.fx.equity = 5000
        self.assertIsNone(self.entry())
        self.assertIn("minimum", self.j.events("SIGNAL_REJECTED")[0]["detail"])
        self.assertFalse(any(c[0] == "place_order" for c in self.fx.calls))

    def test_trading_capital_capped_by_exchange(self):
        self.set_capital(1000)
        self.fx.equity = 400
        snap = self.ex.snapshot()
        self.assertAlmostEqual(snap.trading_equity, 400)
        self.assertTrue(snap.capped)
        self.ex._capital_cap(snap)
        self.assertTrue(self.j.events("CAPITAL_CAPPED"))
        self.assertAlmostEqual(CapitalEngine(self.j, self.s).state().trading_capital, 1000)  # stored TC untouched

    def test_unrealised_profit_never_locks(self):
        tid = self.entry()
        self.fx.upnl = 500.0
        self.ex.snapshot()
        self.ex.run_cycle()
        st = CapitalEngine(self.j, self.s).state()
        self.assertEqual(st.profit_reserve, 0)
        self.assertEqual(self.j.trade(tid)["status"], "OPEN")

    def test_no_transfer_or_withdraw_code(self):
        root = Path(bfx.__file__).parent
        paths = set()
        for f in root.glob("*.py"):
            for node in ast.walk(ast.parse(f.read_text())):
                if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith("/api/"):
                    paths.add(node.value)
                    self.assertFalse(any(w in node.value for w in ("transfer", "withdraw", "/asset/")), node.value)
                if isinstance(node, ast.FunctionDef):
                    self.assertFalse(any(w in node.name.lower() for w in ("transfer", "withdraw")), node.name)
        self.assertIn("/api/v1/trade/order", paths)  # the scan does see the client's endpoints


class TestFeedbackAndCapitalOnClose(Base):
    def test_profitable_exit_updates_capital_feedback_and_locks(self):
        tid = self.entry()
        t = self.j.trade(tid)
        self.fx.price[INST] = 2750.0
        self.fx.now += 4 * 3_600_000
        self.ex.manage_open(t, analysis(self.fx, close=2750.0, cross_up=False, cross_down=True))
        t = self.j.trade(tid)
        st = CapitalEngine(self.j, self.s).state()
        self.assertGreater(t["pnl"], 0)
        self.assertAlmostEqual(st.profit_reserve, t["pnl"] * 0.10)
        self.assertAlmostEqual(st.trading_capital, 1000 + t["pnl"] * 0.90)
        fb = self.j.feedback()[0]
        self.assertEqual((fb["strategy_id"], fb["symbol"], fb["timeframe"], fb["result"]),
                         (t["strategy_id"], INST, "4H", "WIN"))
        self.assertEqual(fb["regime"], UPTREND)
        self.assertAlmostEqual(fb["expected_entry"], t["entry_ref"])
        self.assertAlmostEqual(fb["actual_entry"], t["entry_fill"])
        self.assertAlmostEqual(fb["expected_exit"], 2750.0)
        self.assertAlmostEqual(fb["actual_exit"], 2749.99)
        self.assertGreater(fb["actual_fee"], 0)
        self.assertGreater(fb["expected_fee"], 0)
        self.assertGreater(fb["expected_r"], fb["actual_r"])           # friction makes reality worse
        self.assertEqual(fb["latency_ms"], t["opened_ts"] - t["signal_close_ts"])
        self.assertIn("EMA10 crossed under", fb["reason_for_exit"])
        closed = json.loads(self.j.events("TRADE_CLOSED")[0]["detail"])
        for k in ("feedback", "trading_capital", "profit_reserve", "total_equity", "health", "expected_r", "result"):
            self.assertIn(k, closed)
        lock = json.loads(self.j.events("PROFIT_LOCKED")[0]["detail"])
        self.assertAlmostEqual(lock["locked"], t["pnl"] * 0.10)

    def test_stop_hit_loss_reduces_trading_capital_only(self):
        tid = self.entry()
        self.fx.hit_stop(INST)
        self.ex.reconcile(self.ex.snapshot())
        t = self.j.trade(tid)
        st = CapitalEngine(self.j, self.s).state()
        self.assertLess(t["pnl"], 0)
        self.assertAlmostEqual(st.trading_capital, 1000 + t["pnl"])
        self.assertEqual(st.profit_reserve, 0)
        self.assertFalse(self.j.events("PROFIT_LOCKED"))
        fb = self.j.feedback()[0]
        self.assertEqual(fb["result"], "LOSS")
        self.assertAlmostEqual(fb["expected_exit"], t["stop_current"])

    def test_test_trades_never_touch_capital(self):
        self.assertTrue(self.ex.e2e_demo(INST, log=lambda *_: None))
        st = CapitalEngine(self.j, self.s).state()
        self.assertEqual((st.trading_capital, st.profit_reserve), (1000, 0))
        self.assertEqual(self.j.feedback(), [])
        self.assertTrue(all(r["is_test"] for r in self.j.feedback(include_test=True)))


class TestDrawdownLadder(Base):
    def test_thresholds(self):
        s = self.s
        cases = [(971, NORMAL, 1.0, False), (970, CAUTION, 1.0, False), (950, REDUCED, 0.5, False),
                 (920, NO_NEW, 0.5, True), (900, HALTED, 0.0, True)]
        for te, level, mult, block in cases:
            r = drawdown_ladder(s, te, 1000)
            self.assertEqual((r.level, r.risk_multiplier, r.block_new), (level, mult, block), te)
        self.assertTrue(drawdown_ladder(s, 900, 1000).halt)

    def test_config_can_only_tighten(self):
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=1, dd_halt_pct=0.12).validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=1, dd_no_new_pct=0.04).validate()   # out of order
        Settings(trading_equity_usdt=1, dd_caution_pct=0.02, dd_reduce_pct=0.04, dd_no_new_pct=0.06,
                 dd_halt_pct=0.08).validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=1, profit_lock_pct=0.05).validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=1, risk_pct=0.0075).validate()   # experimental needs explicit approval
        Settings(trading_equity_usdt=1, risk_pct=0.0075, explicit_risk_approval=True).validate()

    def test_multipliers_never_raise_risk(self):
        self.assertEqual(effective_risk_pct(self.s, 4.0), self.s.risk_pct)
        self.assertAlmostEqual(effective_risk_pct(self.s, 0.5, 0.5), self.s.risk_pct / 4)

    def test_reduced_level_halves_new_trade_risk(self):
        self.set_capital(950, 0, 1000)
        self.fx.equity = 950
        tid = self.entry()
        self.assertLessEqual(self.j.trade(tid)["risk_amount"], 950 * 0.0025 * 0.5 + 1e-9)
        self.assertEqual(json.loads(self.j.events("DRAWDOWN_LADDER")[0]["detail"])["level"], REDUCED)

    def test_no_new_positions_at_8pct(self):
        self.set_capital(920, 0, 1000)
        self.fx.equity = 920
        self.assertIsNone(self.entry())
        self.assertIn("drawdown ladder", self.j.events("SIGNAL_REJECTED")[0]["detail"])

    def test_halt_at_10pct_needs_manual_reset(self):
        self.set_capital(899, 0, 1000)
        self.fx.equity = 899
        self.assertIsNone(self.entry())
        halt = [h for h in self.j.active_halts() if h["kind"] == "DRAWDOWN_HALT"]
        self.assertEqual(len(halt), 1)
        self.assertTrue(halt[0]["manual_reset"])

    def test_unrealised_loss_counts_toward_ladder(self):
        self.set_capital(1000)
        self.entry()
        self.fx.upnl = -60.0
        _, mult = self.ex.breakers(self.ex.snapshot())
        self.assertEqual(self.ex._ladder.level, REDUCED)
        self.assertLessEqual(mult, 0.5)


if __name__ == "__main__":
    unittest.main()

import io
import json
import unittest
from unittest import mock

from bfx import STRATEGY_ID, cli
from bfx import health as hl
from bfx import strategies as reg
from bfx.config import Settings
from bfx.executor import Executor
from bfx.journal import Journal
from bfx.regime import RANGE, UPTREND
from tests.fakes import FakeExchange, aligned
from tests.test_executor import analysis

INST = "ETH-USDT"
B = reg.get(STRATEGY_ID)


def add_closed(j, rs, regime=UPTREND, inst=INST, risk=10.0, start=0):
    """Closed non-test trades with the given R multiples (pnl = R x risk)."""
    for i, r in enumerate(rs):
        tid = j.open_trade(strategy_id=STRATEGY_ID, inst_id=inst, direction=1, regime=regime, entry_fill=100.0,
                           size="1", contract_value=1.0, entry_fee=0.05, risk_amount=risk, slippage=0.01,
                           opened_ts=start + i * 1000)
        j.update_trade(tid, status="CLOSED", pnl=r * risk, r_multiple=r, exit_fee=0.05,
                       exit_ts=start + i * 1000 + 500)


class TestAssess(unittest.TestCase):
    s = Settings(trading_equity_usdt=1000)

    def rep(self, rs, **kw):
        j = Journal(":memory:", "PAPER")
        add_closed(j, rs, **kw)
        return hl.assess(B, j.closed_trades(), self.s, 1000)

    def test_insufficient_sample_is_not_evidence(self):
        r = self.rep([-1.0] * 5)
        self.assertEqual(r.status, hl.HEALTHY)
        self.assertFalse(r.sample_ok)

    def test_healthy(self):
        r = self.rep([2.0, -1.0] * 10)                 # PF 2.0 vs baseline 1.77 (ETH)
        self.assertEqual(r.status, hl.HEALTHY, r.reasons)
        self.assertAlmostEqual(r.pf_baseline, 1.77)

    def test_watch_band(self):
        r = self.rep([1.3, -1.0] * 10)                 # PF 1.3 / 1.77 = 0.73
        self.assertEqual(r.status, hl.WATCH, r.reasons)

    def test_degraded_below_06(self):
        r = self.rep([1.0, -1.0, 1.0, -1.0, -0.2] * 4)  # PF 8/8.8 = 0.91 -> ratio 0.51, mean R slightly < 0
        self.assertEqual(r.status, hl.DEGRADED, r.reasons)

    def test_disabled_when_significantly_negative(self):
        r = self.rep([-1.0] * 17 + [0.5] * 3)
        self.assertEqual(r.status, hl.DISABLED)
        self.assertLess(r.t_vs_zero, -hl.Z99)

    def test_window_is_last_20(self):
        r = self.rep([-1.0] * 30 + [2.0, -1.0] * 10)
        self.assertEqual(r.n, 20)
        self.assertEqual(r.status, hl.HEALTHY)


class Base(unittest.TestCase):
    def setUp(self):
        self.fx = FakeExchange()
        self.s = Settings(trading_equity_usdt=1000, instruments=(INST,))
        self.j = Journal(":memory:", "PAPER", clock=self.fx.clock)
        self.ex = Executor(self.fx, self.s, self.j, clock=self.fx.clock, sleep=lambda _: None)
        self.a = analysis(self.fx)
        self.fx.candle_rows[INST] = aligned(self.fx)
        self.fx.candle_rows[INST][-1][0] = str(self.a.bar_ts)

    def entry(self, a=None):
        snap = self.ex.snapshot()
        halts, mult = self.ex.breakers(snap)
        return self.ex.try_entry(a or self.a, snap, halts, mult)


class TestPauseAndResume(Base):
    def test_review_every_20_pauses_degraded_strategy(self):
        add_closed(self.j, [-1.0, 0.5] * 9 + [-1.0])
        self.assertIsNone(hl.review(self.j, self.s, B))              # 19 trades: not yet
        add_closed(self.j, [-1.0], start=10**6)
        rep = hl.review(self.j, self.s, B)
        self.assertIn(rep.status, hl.PAUSING)
        self.assertEqual(hl.status(self.j, STRATEGY_ID), (rep.status, True))
        self.assertTrue(self.j.events("STRATEGY_PAUSED"))
        self.assertTrue(self.j.events("STRATEGY_HEALTH"))
        self.assertIsNone(hl.review(self.j, self.s, B))              # next automatic review at 40

    def test_paused_strategy_blocks_entries_but_keeps_trailing(self):
        tid = self.entry()
        self.j.set_strategy_state(STRATEGY_ID, health=hl.DEGRADED, paused=1, reason="test")
        self.ex.manage_open(self.j.trade(tid), analysis(self.fx, close=2800.0, cross_up=False))
        self.assertAlmostEqual(self.j.trade(tid)["stop_current"], 2800 - 30 * 3.5)   # still trailed
        self.fx.hit_stop(INST)
        self.ex.reconcile(self.ex.snapshot())
        self.fx.now += 1000
        self.assertIsNone(self.entry(analysis(self.fx)))
        self.assertIn("strategy paused", self.j.events("SIGNAL_REJECTED")[0]["detail"])

    def test_resume_requires_typed_confirmation(self):
        self.j.set_strategy_state(STRATEGY_ID, health=hl.DEGRADED, paused=1, reason="test")
        with mock.patch("sys.stdin", io.StringIO("RESUME " + STRATEGY_ID + "\n")):
            self.assertFalse(cli._confirm("x", "RESUME " + STRATEGY_ID))     # not a TTY: refused
        tty = io.StringIO()
        tty.isatty = lambda: True
        with mock.patch("sys.stdin", tty), mock.patch("builtins.input", return_value="resume"):
            self.assertFalse(cli._confirm("x", "RESUME " + STRATEGY_ID))     # wrong phrase
        hl.resume(self.j, STRATEGY_ID)
        self.assertEqual(hl.status(self.j, STRATEGY_ID), (hl.WATCH, False))
        self.assertIsNotNone(self.entry())

    def test_on_demand_review_does_not_shift_schedule(self):
        add_closed(self.j, [2.0, -1.0] * 5)
        rep = hl.review(self.j, self.s, B, force=True)
        self.assertFalse(rep.sample_ok)
        self.assertEqual(self.j.strategy_state(STRATEGY_ID)["reviewed_count"], 0)


class TestRegimeMatrix(Base):
    def test_matrix_and_auto_disable_then_manual_enable(self):
        add_closed(self.j, [-1.0, 0.5] * 5, regime=RANGE)            # 10 trades, E < 0
        add_closed(self.j, [2.0, -1.0] * 5, regime="HIGH VOLATILITY", start=10**6)  # legacy label
        m = hl.regime_matrix(self.j.closed_trades())
        self.assertEqual(m[(STRATEGY_ID, RANGE)]["trades"], 10)
        self.assertIn((STRATEGY_ID, "HIGH_VOLATILITY"), m)
        self.assertEqual(hl.check_regimes(self.j, self.s, STRATEGY_ID), [RANGE])
        self.assertTrue(hl.regime_disabled(self.j, STRATEGY_ID, RANGE))
        self.assertEqual(json.loads(self.j.events("REGIME_DISABLED")[0]["detail"])["regime"], RANGE)
        self.assertIsNone(self.entry(analysis(self.fx, regime=RANGE)))
        self.assertIn("auto-disabled", self.j.events("SIGNAL_REJECTED")[0]["detail"])
        self.assertIsNotNone(self.entry(analysis(self.fx, regime=UPTREND)))     # other regimes unaffected
        hl.enable_regime(self.j, STRATEGY_ID, RANGE)
        self.assertFalse(hl.regime_disabled(self.j, STRATEGY_ID, RANGE))
        add_closed(self.j, [-1.0], regime=RANGE, start=self.fx.now + 10)
        self.assertEqual(hl.check_regimes(self.j, self.s, STRATEGY_ID), [])   # fresh sample after re-enable

    def test_needs_ten_trades(self):
        add_closed(self.j, [-1.0] * 9, regime=RANGE)
        self.assertEqual(hl.check_regimes(self.j, self.s, STRATEGY_ID), [])


if __name__ == "__main__":
    unittest.main()

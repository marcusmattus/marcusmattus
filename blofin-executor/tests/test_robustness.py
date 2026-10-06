import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bfx import STRATEGY_ID
from bfx import health as hl
from bfx import strategies as reg
from bfx.config import BASE_URLS, MODE_LIVE, ConfigError, Settings
from bfx.executor import Executor, strategy_eligibility
from bfx.journal import Journal
from bfx.robustness import WEIGHTS, load_research, score
from tests.fakes import FakeExchange
from tests.test_executor import analysis
from tests.test_health import add_closed

RESEARCH = Path(__file__).resolve().parent.parent / "research" / "strategies.json"
B = reg.get(STRATEGY_ID)
FULL = {
    "oos": {s: {"pf": 1.8, "net_pct": 40, "dd_pct": 12, "trades": 40, "sharpe": 1.6, "sortino": 2.4}
            for s in ("BTC-USDT", "ETH-USDT", "SOL-USDT")},
    "walk_forward": [{"pf": 1.4, "net_pct": 10}] * 5,
    "param_stability": 0.9, "cost_stress": {"pf_at_2x_costs": 1.35},
}
GOOD_DEMO = {"trades": 25, "profit_factor": 2.0, "expectancy": 1.0, "max_dd_pct": 0.05}


class TestScore(unittest.TestCase):
    def test_weights_sum_to_100(self):
        self.assertEqual(sum(WEIGHTS.values()), 100)

    def test_seeded_strategy_b_flags_unknowns(self):
        data, err = load_research(RESEARCH)
        self.assertIsNone(err)
        rec = data[STRATEGY_ID]
        self.assertEqual(rec["oos"]["ETH-USDT"]["pf"], 1.77)
        r = score(STRATEGY_ID, rec, {})
        for f in ("parameter stability unknown", "cost-stress unknown",
                  "Sharpe/Sortino unknown", "no demo trades yet"):
            self.assertIn(f, r.flags)
        for k in ("param_stability", "cost_resilience", "sharpe_sortino", "demo"):
            self.assertEqual(r.components[k][2], 0)
        # 2026-10-06 tournament: 10 of 15 per-year folds positive (net only, PF not recorded)
        self.assertNotIn("walk-forward unknown", r.flags)
        self.assertAlmostEqual(r.components["walk_forward"][0], 10 / 15, places=3)
        self.assertAlmostEqual(r.components["oos"][0], (0.74 + 1 + 1) / 3 * 18 / 30, places=3)
        self.assertLess(score(STRATEGY_ID, rec, GOOD_DEMO).score, 70)   # cannot pass until research is filled

    def test_full_record_scores_high_and_components_bounded(self):
        r = score("X", FULL, GOOD_DEMO)
        self.assertGreaterEqual(r.score, 70)
        self.assertEqual(r.flags, [])
        for raw, w, pts in r.components.values():
            self.assertTrue(0 <= raw <= 1 and 0 <= pts <= w)

    def test_bad_demo_and_missing_everything(self):
        self.assertEqual(score("X", {}, {}).score, 0)
        bad = score("X", FULL, {"trades": 25, "profit_factor": 0.8, "expectancy": -1, "max_dd_pct": 0.3})
        self.assertEqual(bad.components["demo"][2], 0)
        self.assertLess(bad.score, score("X", FULL, GOOD_DEMO).score)

    def test_threshold_can_only_be_raised(self):
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=1, robustness_threshold=60).validate()
        Settings(trading_equity_usdt=1, robustness_threshold=80).validate()

    def test_unreadable_research(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "r.json"
            p.write_text("{oops")
            data, err = load_research(p)
            self.assertEqual(data, {})
            self.assertIn("unreadable", err)


class TestLiveEligible(unittest.TestCase):
    s = Settings(trading_equity_usdt=1000)

    def paper(self, rs):
        j = Journal(":memory:", "PAPER")
        add_closed(j, rs)
        return j

    def test_requires_gate_score_and_healthy(self):
        j = self.paper([2.0, -1.0] * 12)
        ok, reasons, rob = strategy_eligibility(j, self.s, B, {STRATEGY_ID: FULL})
        self.assertTrue(ok, reasons)
        ok, reasons, _ = strategy_eligibility(j, self.s, B, json.loads(RESEARCH.read_text()))
        self.assertFalse(ok)
        self.assertTrue(any("robustness score" in r for r in reasons))
        j.set_strategy_state(STRATEGY_ID, health=hl.WATCH, paused=0)
        ok, reasons, _ = strategy_eligibility(j, self.s, B, {STRATEGY_ID: FULL})
        self.assertFalse(ok)
        self.assertTrue(any("must be HEALTHY" in r for r in reasons))

    def test_gate_counts_only_that_strategy(self):
        j = self.paper([2.0, -1.0] * 5)
        for i in range(20):
            tid = j.open_trade(strategy_id="OTHER", inst_id="ETH-USDT", direction=1)
            j.update_trade(tid, status="CLOSED", pnl=5.0, r_multiple=1.0, exit_ts=10**7 + i)
        ok, reasons, _ = strategy_eligibility(j, self.s, B, {STRATEGY_ID: FULL})
        self.assertFalse(ok)
        self.assertTrue(any("only 10 closed PAPER trades" in r for r in reasons))

    def test_live_entry_refused_without_strategy_eligibility(self):
        fx = FakeExchange()
        fx.base_url = BASE_URLS[MODE_LIVE]
        s = Settings(mode=MODE_LIVE, trading_equity_usdt=1000, instruments=("ETH-USDT",))
        ex = Executor(fx, s, Journal(":memory:", MODE_LIVE, clock=fx.clock), paper_journal=self.paper([1.0] * 3),
                      clock=fx.clock, sleep=lambda _: None)
        self.assertIsNone(ex.try_entry(analysis(fx), ex.snapshot(), [], 1.0))
        self.assertIn("not LIVE_ELIGIBLE", ex.j.events("SIGNAL_REJECTED")[0]["detail"])
        self.assertFalse(any(c[0] == "place_order" for c in fx.calls))


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from pathlib import Path

from bfx import STRATEGY_ID
from bfx.config import ConfigError, Settings
from bfx.executor import research_pairs
from bfx.journal import now_ms


def sym(pf=1.8, trades=20, exp=0.3, dd=1.0, pf2=1.5, pf5=1.4, stab=1.0):
    return {"splits": {"OOS": {"pf": pf, "trades": trades, "expectancy_r": exp, "dd_pct": dd}},
            "oos_stress": {"2x_costs": {"pf": pf2, "net_pct": 1.0}, "5x_slippage": {"pf": pf5, "net_pct": 1.0}},
            "param_neighbourhood": {"share_profitable": stab}}


class ResearchGate(unittest.TestCase):
    def run_gate(self, symbols, **rec_over):
        rec = {"strategy_id": STRATEGY_ID, "generated_at": now_ms(), "symbols": symbols}
        rec.update(rec_over)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "bt.json"
            p.write_text(json.dumps(rec))
            s = Settings(trading_equity_usdt=67, gate_source="RESEARCH", backtest_path=str(p),
                         instruments=("BTC-USDT", "ETH-USDT"))
            return research_pairs(s, STRATEGY_ID)

    def test_all_pass(self):
        ok, why = self.run_gate({"BTC-USDT": sym(), "ETH-USDT": sym()})
        self.assertEqual(ok, {"BTC-USDT", "ETH-USDT"})
        self.assertEqual(why, [])

    def test_weak_pair_excluded_others_trade(self):
        ok, why = self.run_gate({"BTC-USDT": sym(pf=1.1), "ETH-USDT": sym(trades=35)})
        self.assertEqual(ok, {"ETH-USDT"})
        self.assertIn("BTC-USDT", why[0])

    def test_unprofitable_under_5x_slippage_fails(self):
        ok, _ = self.run_gate({"BTC-USDT": sym(pf5=0.95), "ETH-USDT": sym(pf5=0.95)})
        self.assertEqual(ok, set())

    def test_unstable_parameters_fail(self):
        ok, _ = self.run_gate({"BTC-USDT": sym(stab=0.4), "ETH-USDT": sym(stab=0.4)})
        self.assertEqual(ok, set())

    def test_thin_pooled_sample_fails(self):
        ok, why = self.run_gate({"BTC-USDT": sym(trades=15), "ETH-USDT": sym(trades=10)})
        self.assertEqual(ok, set())

    def test_stale_record_fails(self):
        ok, why = self.run_gate({"BTC-USDT": sym(), "ETH-USDT": sym()}, generated_at=now_ms() - 40 * 86_400_000)
        self.assertEqual(ok, set())
        self.assertIn("revalidate", why[0])

    def test_wrong_strategy_or_missing_pair_fails(self):
        ok, _ = self.run_gate({"BTC-USDT": sym(), "ETH-USDT": sym()}, strategy_id="OTHER")
        self.assertEqual(ok, set())
        ok, why = self.run_gate({"BTC-USDT": sym(trades=40)})
        self.assertEqual(ok, {"BTC-USDT"})
        self.assertIn("ETH-USDT: no backtest", why)

    def test_thresholds_cannot_be_loosened(self):
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=67, gate_source="RESEARCH", gate_min_param_stability=0.5).validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=67, gate_source="BOGUS").validate()


if __name__ == "__main__":
    unittest.main()

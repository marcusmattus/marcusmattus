import contextlib
import io
import re
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import bfx.config as cfg
from bfx import STRATEGY_ID, cli
from bfx import dashboard as dash
from bfx.capital import CapitalEngine, CapitalState
from bfx.config import Settings
from bfx.growth import growth_report, monte_carlo, realised_rates
from bfx.journal import Journal
from tests.test_health import add_closed

DAY = 86_400_000


class TestGrowth(unittest.TestCase):
    st = CapitalState(1000, 1000, 0, 1000)

    def test_insufficient_data(self):
        rep = growth_report(self.st, 0.745, 0, 10 * DAY, {STRATEGY_ID: [1.0] * 19}, 0.0025, 0.1, 100, 50)
        self.assertIn("insufficient", rep["monte_carlo"][STRATEGY_ID]["note"])
        self.assertIsNone(rep["rates"]["cagr"])
        self.assertIn("insufficient", rep["rates"]["note"])
        m = rep["milestones"][10_000]
        self.assertAlmostEqual(m["required_multiple"], 10_000 / 0.745 / 1000)

    def test_realised_rates(self):
        r = realised_rates(1000, 1100, 365.25)
        self.assertAlmostEqual(r["cagr"], 0.10)
        self.assertGreater(r["monthly"], 0)

    def test_monte_carlo_bounded_and_deterministic(self):
        rs = [2.0, -1.0, -1.0, 3.0, -1.0] * 5
        targets = {1_000: 1000 / 0.745, 10_000: 10_000 / 0.745}
        a = monte_carlo(rs, self.st, 0.01, 0.1, targets, 300, 200)
        self.assertEqual(a, monte_carlo(rs, self.st, 0.01, 0.1, targets, 300, 200))
        for v in a["targets"].values():
            for p in v.values():
                self.assertTrue(0 <= p <= 1)
        self.assertGreaterEqual(a["targets"][1_000]["p_reach"], a["targets"][10_000]["p_reach"])
        losing = monte_carlo([-1.0] * 20, self.st, 0.01, 0.1, targets, 100, 20)
        self.assertEqual(losing["targets"][1_000]["p_reach"], 0)
        self.assertEqual(losing["p_dd10"], 1.0)

    def test_cli_growth_never_prints_a_date(self):
        with TemporaryDirectory() as d:
            old = cfg.ROOT
            cfg.ROOT = Path(d)
            try:
                s = Settings(trading_equity_usdt=1000, gbp_per_usdt=0.745)
                j = cli.journal(s)
                add_closed(j, [2.0, -1.0, 0.5, -1.0, 1.5] * 5, start=0)
                CapitalEngine(j, s).state()
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf):
                    cli.cmd_growth(s, SimpleNamespace(trades=50, sims=50))
                out = buf.getvalue()
                self.assertIn("Monte Carlo", out)
                self.assertIn("P(reach within 50 trades)", out)
                self.assertIsNone(re.search(r"\d{4}-\d{2}-\d{2}", out), out)
            finally:
                cfg.ROOT = old


class TestDashboard(unittest.TestCase):
    def test_text_and_html(self):
        s = Settings(trading_equity_usdt=1000, gbp_per_usdt=0.745)
        j = Journal(":memory:", "PAPER")
        add_closed(j, [2.0, -1.0, 1.0], start=0)
        j.event("BAR", "ETH-USDT", regime="UPTREND")
        j.add_halt("WEEKLY_DD", "test", True)
        d = dash.collect(j, s)
        self.assertEqual(d["trades"], 3)
        self.assertAlmostEqual(d["total_equity"], 1020)
        text = dash.render_text(d)
        for k in ("TRADING CAPITAL", "PROFIT RESERVE", "TOTAL EQUITY", "HIGH-WATER MARK", "SHARPE / SORTINO",
                  "NEXT MILESTONE", STRATEGY_ID, "LIVE_ELIGIBLE NO", "ETH-USDT: UPTREND", "WEEKLY_DD"):
            self.assertIn(k, text)
        html = dash.render_html(d)
        self.assertIn("prefers-color-scheme:dark", html)
        for banned in ("http://", "https://", "<script", "<link", "@import", "url("):
            self.assertNotIn(banned, html)
        self.assertIn("Strategy × regime", html)


if __name__ == "__main__":
    unittest.main()

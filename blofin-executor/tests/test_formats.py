import time
import unittest

from bfx.notify import NOTIFY_KINDS, TelegramNotifier, format_message

G = 0.745
CAP = {"trading_capital": 1090.0, "profit_reserve": 10.0, "total_equity": 1100.0, "next_milestone_gbp": 1000}


class TestFormats(unittest.TestCase):
    def test_trade_feedback(self):
        m = format_message("PAPER", "TRADE_CLOSED", "ETH-USDT", {
            "feedback": True, "strategy": "B-EMA10-100-LO-ATR3.5", "regime": "UPTREND", "result": "WIN",
            "pnl": 10.0, "r": 1.5, "expected_r": 1.62, "slippage": 0.2, "fees": 0.4, "health": "HEALTHY",
            "reason": "EMA10 crossed under EMA100", **CAP}, G)
        for s in ("📊 TRADE FEEDBACK [PAPER]", "Pair: ETH-USDT", "Strategy: B-EMA10-100-LO-ATR3.5",
                  "Regime: UPTREND", "Result: WIN +£7.45", "R: +1.50R", "Expected R: +1.62R", "Slippage: £0.15",
                  "Fees: £0.30", "Trading Capital: £812.05", "Profit Reserve: £7.45", "Total Equity: £819.50",
                  "Next Milestone: £1,000", "Strategy Health: HEALTHY"):
            self.assertIn(s, m)

    def test_loss_sign_and_usdt_fallback(self):
        m = format_message("PAPER", "TRADE_CLOSED", "SOL-USDT", {"feedback": True, "pnl": -2.5, "r": -1.0,
                                                                "result": "LOSS", **CAP})
        self.assertIn("Result: LOSS -2.50 USDT", m)
        self.assertIn("R: -1.00R", m)

    def test_profit_locked(self):
        m = format_message("LIVE", "PROFIT_LOCKED", None, {"net_pnl": 100.0, "locked": 10.0, "compounded": 90.0,
                                                           "lock_pct": 0.10, **CAP}, G)
        for s in ("🔐 PROFIT LOCKED [LIVE]", "Realized Net Profit: +£74.50", "10% Reserved: £7.45",
                  "90% Compounded: £67.05", "Trading Capital: £812.05", "Protected Reserve: £7.45",
                  "Total Equity: £819.50", "Next Milestone: £1,000"):
            self.assertIn(s, m)

    def test_capital_milestone(self):
        m = format_message("PAPER", "CAPITAL_MILESTONE", None, {"milestone_gbp": 1000, "net_realized": 50.0,
                                                                "max_dd_pct": 0.031, "profit_factor": 1.8, **CAP}, G)
        for s in ("🏆 CAPITAL MILESTONE [PAPER]", "Milestone: £1,000", "Trading Capital:", "Profit Reserve:",
                  "Total Equity:", "Net Realized Profit: +£37.25", "Max DD: 3.10%", "PF: 1.80"):
            self.assertIn(s, m)

    def test_ladder_health_failure_formats(self):
        d = {"drawdown": 0.101, "total_equity": 899.0, "hwm": 1000.0, "action": "HALT"}
        self.assertTrue(format_message("PAPER", "DRAWDOWN_LADDER", None, {**d, "level": "HALT"}).startswith("🚨"))
        self.assertTrue(format_message("PAPER", "DRAWDOWN_LADDER", None,
                                       {**d, "level": "NO_NEW_POSITIONS"}).startswith("🛑"))
        self.assertIn("10.10%", format_message("PAPER", "DRAWDOWN_LADDER", None, {**d, "level": "HALT"}))
        h = format_message("PAPER", "STRATEGY_HEALTH", None, {"strategy": "B", "old": "HEALTHY", "new": "WATCH",
                                                               "reasons": ["drift: ['profit_factor']"]})
        self.assertIn("HEALTHY → WATCH", h)
        self.assertTrue(format_message("PAPER", "FAILURE_MODE", None, {"failure": "TELEGRAM_DOWN"})
                        .startswith("🚨 FAILURE"))
        self.assertEqual(format_message("PAPER", "FAILURE_RESTORED", None,
                                        {"failure": "STALE_DATA:ETH-USDT:4H", "duration_min": 12.0}),
                         "✅ RESTORED [PAPER]: STALE_DATA:ETH-USDT:4H (after 12.0 min)")
        for k in ("PROFIT_LOCKED", "CAPITAL_MILESTONE", "DRAWDOWN_LADDER", "STRATEGY_HEALTH", "FAILURE_MODE",
                  "FAILURE_RESTORED", "STRATEGY_PAUSED", "REGIME_DISABLED"):
            self.assertIn(k, NOTIFY_KINDS)

    def test_no_secrets(self):
        token = "123456:SECRETTOKENVALUE"
        n = TelegramNotifier(token, "42", "LIVE", gbp_per_usdt=G)
        sent = []
        n.send = lambda text: sent.append(text) or True
        details = {"api_key": "AKEY", "api_secret": "SSECRET", "passphrase": "PPHRASE", "bot_token": token,
                   "error": "boom", **CAP}
        for kind in sorted(NOTIFY_KINDS):
            n(kind, "ETH-USDT", dict(details))
        deadline = time.time() + 2
        while len(sent) < len(NOTIFY_KINDS) and time.time() < deadline:
            time.sleep(0.01)
        self.assertEqual(len(sent), len(NOTIFY_KINDS))
        for m in sent:
            for secret in ("SECRETTOKENVALUE", "AKEY", "SSECRET", "PPHRASE"):
                self.assertNotIn(secret, m)
        self.assertNotIn("SECRET", repr(n))


if __name__ == "__main__":
    unittest.main()

import unittest

from bfx.journal import Journal
from bfx.notify import NOTIFY_KINDS, TelegramNotifier, format_message


class NotifyTests(unittest.TestCase):
    def test_journal_calls_notifier_and_survives_its_failure(self):
        seen = []
        j = Journal(":memory:", "PAPER", notifier=lambda k, i, d: seen.append((k, i, d)))
        j.event("TRADE_CLOSED", "ETH-USDT", pnl=1.0)
        self.assertEqual(seen, [("TRADE_CLOSED", "ETH-USDT", {"pnl": 1.0})])

        def boom(*a):
            raise RuntimeError("telegram down")
        j2 = Journal(":memory:", "PAPER", notifier=boom)
        j2.event("HALT", None, halt="DAILY", reason="x")  # must not raise
        self.assertEqual(len(j2.events()), 1)

    def test_filter_skips_routine_events(self):
        sent = []
        n = TelegramNotifier("123:SECRET", "42", "PAPER")
        n.send = lambda text: sent.append(text) or True
        n("BAR", "ETH-USDT", {})
        n("E2E_STEP", "ETH-USDT", {})
        self.assertNotIn("BAR", NOTIFY_KINDS)
        n("TRADE_CLOSED", "ETH-USDT", {"exit": 1, "pnl": 2, "r": 0.5, "reason": "trail"})
        import time; time.sleep(0.1)
        self.assertEqual(len(sent), 1)
        self.assertIn("[PAPER] TRADE_CLOSED ETH-USDT", sent[0])

    def test_token_never_in_repr_or_message(self):
        n = TelegramNotifier("123:SECRET", "42", "LIVE")
        self.assertNotIn("SECRET", repr(n))
        self.assertNotIn("SECRET", format_message("LIVE", "HALT", None, {"halt": "WEEKLY", "reason": "-5%"}))
        self.assertTrue(format_message("LIVE", "HALT", None, {"halt": "W", "reason": "r"}).startswith("🚨"))


if __name__ == "__main__":
    unittest.main()

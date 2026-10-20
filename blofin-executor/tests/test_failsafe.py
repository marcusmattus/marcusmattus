import json
import unittest
from decimal import Decimal

from bfx.config import Settings
from bfx.executor import Executor
from bfx.failsafe import (BALANCE_UNVERIFIABLE, EXCHANGE_UNREACHABLE, RECONCILE_MISMATCH, STATE_CORRUPT,
                          STOP_PLACEMENT_FAILURE, TELEGRAM_DOWN, FailureMonitor)
from bfx.journal import Journal
from bfx.notify import TelegramNotifier
from tests.fakes import FakeExchange, aligned, next_bar

INST = "ETH-USDT"


class StubNotifier:
    def __init__(self):
        self.healthy, self.failing_for_s = True, 0.0

    def __call__(self, *a):
        pass


class Base(unittest.TestCase):
    instruments = (INST,)

    def setUp(self):
        self.fx = FakeExchange()
        self.s = Settings(trading_equity_usdt=1000, instruments=self.instruments)
        self.n = StubNotifier()
        self.j = Journal(":memory:", "PAPER", clock=self.fx.clock, notifier=self.n)
        self.ex = Executor(self.fx, self.s, self.j, clock=self.fx.clock, sleep=lambda _: None)
        self.fx.candle_rows[INST] = aligned(self.fx)
        self.fx.price[INST] = 100.5

    def orders(self):
        return sum(1 for c in self.fx.calls if c[0] == "place_order")

    def failures(self, kind):
        return [json.loads(e["detail"])["failure"] for e in self.j.events(kind, 100)]

    def assert_blocked_then_restored(self, name, break_it, fix_it):
        break_it()
        self.ex.run_cycle()
        self.assertIn(name, [f.split(":")[0] for f in self.failures("FAILURE_MODE")])
        self.assertEqual(self.orders(), 0)
        self.assertEqual(self.j.open_trades(), [])
        fix_it()
        self.j.set(f"last_bar:{INST}", "")           # let the same signal bar be evaluated again
        self.ex.run_cycle()
        self.assertIn(name, [f.split(":")[0] for f in self.failures("FAILURE_RESTORED")])
        self.assertEqual(self.ex.fail.blocking(INST), [])
        self.assertEqual(self.orders(), 1)            # entries resume once the condition clears


class TestHappyPath(Base):
    def test_cycle_opens_protected_trade(self):
        self.ex.run_cycle()
        t = self.j.open_trades()[0]
        self.assertEqual((t["timeframe"], t["regime"]), ("4H", "RANGE"))
        self.assertGreater(t["est_fees"], 0)
        self.assertEqual(self.j.events("FAILURE_MODE"), [])


class TestFailureModes(Base):
    def test_exchange_unreachable(self):
        def down():
            self.fx.unreachable = True

        def up():
            self.fx.unreachable = False
        self.assert_blocked_then_restored(EXCHANGE_UNREACHABLE, down, up)

    def test_stale_market_data(self):
        def stale():
            self.fx.candle_rows[INST] = aligned(self.fx, age_ms=3 * 14_400_000)

        def fresh():
            self.fx.candle_rows[INST] = aligned(self.fx)
        self.assert_blocked_then_restored("STALE_DATA", stale, fresh)
        self.assertIn(f"STALE_DATA:{INST}:4H", self.failures("FAILURE_RESTORED"))

    def test_balance_unverifiable(self):
        def bad():
            self.fx.balance_override = {"details": []}

        def good():
            self.fx.balance_override = None
        self.assert_blocked_then_restored(BALANCE_UNVERIFIABLE, bad, good)

    def test_telegram_down(self):
        def down():
            self.n.healthy, self.n.failing_for_s = False, 31 * 60

        def up():
            self.n.healthy = True
        self.assert_blocked_then_restored(TELEGRAM_DOWN, down, up)

    def test_corrupted_capital_state(self):
        def corrupt():
            self.ex.capital.state()
            self.j.capital_save(trading_capital=float("nan"))

        def repair():
            self.j.capital_save(trading_capital=1000.0)
        self.assert_blocked_then_restored(STATE_CORRUPT, corrupt, repair)

    def test_unparseable_failure_index_fails_closed(self):
        self.j.set("failures:active", "{not json")
        self.assertIn(STATE_CORRUPT, FailureMonitor(self.j).blocking(INST))
        self.ex.run_cycle()
        self.assertIn(STATE_CORRUPT, self.failures("FAILURE_MODE"))
        self.assertEqual(self.orders(), 0)

    def test_stop_placement_failure(self):
        self.fx.fail_stop_places = 2
        self.ex.run_cycle()
        self.assertIn(STOP_PLACEMENT_FAILURE, self.failures("FAILURE_MODE"))
        self.assertEqual(self.fx.positions(INST), [])        # flattened, never naked
        self.ex.run_cycle()                                   # no unprotected trades left -> condition clears
        self.assertIn(STOP_PLACEMENT_FAILURE, self.failures("FAILURE_RESTORED"))
        self.assertIn("ORDER_PROTECTION_FAILURE", [h["kind"] for h in self.j.active_halts()])  # halt stays


class TestReconcileMismatch(Base):
    instruments = (INST, "SOL-USDT")

    def setUp(self):
        super().setUp()
        self.fx.candle_rows["SOL-USDT"] = aligned(self.fx, last_close=100.0)   # no signal on SOL

    def test_unmanaged_position_blocks_all_new_entries(self):
        def mismatch():
            self.fx.pos["SOL-USDT"] = {"size": Decimal("1"), "avg": 200.0}

        def resolved():
            self.fx.pos.pop("SOL-USDT")
        self.assert_blocked_then_restored(RECONCILE_MISMATCH, mismatch, resolved)


class TestOpenPositionsStayProtected(Base):
    def test_trailing_and_exits_continue_during_failures(self):
        self.ex.run_cycle()
        t = self.j.open_trades()[0]
        stop0 = t["stop_current"]
        self.n.healthy, self.n.failing_for_s = False, 40 * 60                     # Telegram down
        self.fx.balance_override = {"details": [{"currency": "USDT", "equity": "oops"}]}  # balance unverifiable
        self.fx.now += 14_400_000
        next_bar(self.fx.candle_rows[INST], 104.0)
        self.fx.price[INST] = 104.0
        self.ex.run_cycle()
        self.assertTrue({TELEGRAM_DOWN, BALANCE_UNVERIFIABLE} <= set(self.ex.fail.active()))
        t = self.j.trade(t["id"])
        self.assertGreater(t["stop_current"], stop0)                              # still trailing
        live = [o for o in self.fx.stops.values() if o["state"] == "live"]
        self.assertEqual(float(live[0]["slTriggerPrice"]), t["stop_current"])


class TestTelegramHealth(unittest.TestCase):
    def test_healthy_flag_after_30_min_of_consecutive_failures(self):
        now = [1000.0]
        n = TelegramNotifier("123:SECRET", "42", "PAPER", clock=lambda: now[0])
        n.send = lambda text: False
        n._deliver("x")
        self.assertTrue(n.healthy)
        now[0] += 29 * 60
        n._deliver("x")
        self.assertTrue(n.healthy)
        now[0] += 61
        self.assertFalse(n.healthy)
        n.send = lambda text: True
        n._deliver("x")
        self.assertTrue(n.healthy)

    def test_send_exception_counts_as_failure(self):
        now = [0.0]
        n = TelegramNotifier("123:SECRET", "42", "PAPER", clock=lambda: now[0], down_after_min=1)

        def boom(text):
            raise OSError("network")
        n.send = boom
        n._deliver("x")
        now[0] += 61
        self.assertFalse(n.healthy)


if __name__ == "__main__":
    unittest.main()

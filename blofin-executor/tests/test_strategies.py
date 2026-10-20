import json
import random
import unittest
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from bfx import STRATEGY_ID
from bfx import strategies as reg
from bfx.config import ConfigError, Settings, load_settings
from bfx.executor import Executor
from bfx.indicators import adx
from bfx.journal import Journal
from bfx.regime import DOWNTREND, EXTREME_VOL, RANGE, UPTREND
from bfx.risk import InstrumentSpec, plan_trade, ratchet
from bfx.strategies import Strategy, StrategyB
from bfx.strategy import Analysis, analyze
from tests import legacy_strategy_b as legacy
from tests.fakes import SPECS, FakeExchange, aligned

S = Settings(trading_equity_usdt=1000)


def walk(seed, n=900, start=100.0, phase_len=150):
    """Random walk with alternating drift/vol regimes so crossovers and vol spikes both occur."""
    rng = random.Random(seed)
    px, rows = start, []
    for i in range(n):
        phase = (i // phase_len) % 4
        mu, sd = [(0.004, 0.012), (-0.004, 0.015), (0.0, 0.006), (0.002, 0.04)][phase]
        o = px
        px = max(1.0, px * (1 + rng.gauss(mu, sd)))
        hi, lo = max(o, px) * (1 + abs(rng.gauss(0, sd / 2))), min(o, px) * (1 - abs(rng.gauss(0, sd / 2)))
        rows.append([str(1_700_000_000_000 + i * 14_400_000), str(o), str(hi), str(lo), str(px), "1", "1", "1", "1"])
    return rows


class TestRegistry(unittest.TestCase):
    def test_b_registered_and_enabled_by_default(self):
        self.assertIn(STRATEGY_ID, reg.REGISTRY)
        self.assertEqual([x.id for x in reg.enabled(S)], [STRATEGY_ID])
        b = reg.get(STRATEGY_ID)
        self.assertEqual((b.timeframe, b.directions), ("4H", (1,)))
        self.assertNotIn(EXTREME_VOL, b.validated_regimes)
        self.assertEqual(b.baseline.pf, {"BTC-USDT": 1.37, "ETH-USDT": 1.77, "SOL-USDT": 1.75})

    def test_unknown_strategy_rejected(self):
        with self.assertRaises(ConfigError):
            reg.enabled(Settings(trading_equity_usdt=1, strategies=("NOPE",)))

    def test_old_config_without_strategies_key_loads(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "config.json"
            p.write_text(json.dumps({"mode": "PAPER", "trading_equity_usdt": 67, "gbp_per_usdt": 0.745,
                                     "risk_pct": 0.0025, "instruments": ["ETH-USDT"], "telegram_chat_id": None}))
            self.assertEqual(load_settings(p).strategies, (STRATEGY_ID,))
            p.write_text(json.dumps({"trading_equity_usdt": 67, "strategies": [STRATEGY_ID]}))
            self.assertEqual(load_settings(p).strategies, (STRATEGY_ID,))

    def test_register_guards(self):
        class Dup(Strategy):
            id = STRATEGY_ID
        with self.assertRaises(ValueError):
            reg.register(Dup())

        class SamePrefix(Strategy):
            id, cid_prefix = "X-PREFIX", "b"
        with self.assertRaises(ValueError):
            reg.register(SamePrefix())

        class Extreme(Strategy):
            id, cid_prefix, validated_regimes = "X-EXT", "q", frozenset({EXTREME_VOL})
        with self.assertRaises(ValueError):
            reg.register(Extreme())
        self.assertNotIn("X-EXT", reg.REGISTRY)


class TestStrategyBUnchanged(unittest.TestCase):
    """Signals, stops and the entry gate must match the pre-registry implementation bar for bar."""

    def test_identical_to_legacy_on_random_series(self):
        b, entries, exits, blocked = StrategyB(), 0, 0, 0
        for seed in range(6):
            rows = walk(seed, n=520, phase_len=45)
            for end in range(300, len(rows) + 1):
                w = rows[:end]
                old, new = legacy.analyze("ETH-USDT", w, S), b.analyze("ETH-USDT", w, S)
                self.assertEqual((old.bar_ts, old.bar_close_ts), (new.bar_ts, new.bar_close_ts))
                self.assertEqual((old.entry_signal, old.exit_signal), (new.entry_signal, new.exit_signal))
                self.assertEqual((old.cross_up, old.cross_down, old.trend), (new.cross_up, new.cross_down, new.trend))
                self.assertAlmostEqual(old.vol_rank, new.vol_rank)
                self.assertAlmostEqual(old.trail_candidate(S.trail_mult), b.initial_stop(new, S))
                self.assertAlmostEqual(old.trail_candidate(S.trail_mult), b.trail_stop(new, S))
                old_enter = old.entry_signal and old.regime_allows_entry
                new_enter = new.entry_signal and b.allows_regime(new.regime)
                self.assertEqual(old_enter, new_enter, f"seed {seed} end {end}: {old.regime} vs {new.regime}")
                entries += new.entry_signal
                exits += new.exit_signal
                blocked += new.entry_signal and not new_enter
        self.assertGreater(entries, 5)
        self.assertGreater(exits, 5)

    def test_fixture_signals(self):
        a = analyze("ETH-USDT", aligned(FakeExchange()), S)
        self.assertTrue(a.entry_signal)
        self.assertEqual(a.strategy_id, STRATEGY_ID)
        self.assertIsNotNone(a.adx)

    def test_extreme_volatility_entry_blocked_in_both(self):
        rows = aligned(FakeExchange(), last_close=103.0)  # crossover on a volatility-spike bar
        old, new, b = legacy.analyze("ETH-USDT", rows, S), analyze("ETH-USDT", rows, S), StrategyB()
        self.assertTrue(old.entry_signal and new.entry_signal)
        self.assertEqual(new.regime, EXTREME_VOL)
        self.assertFalse(old.regime_allows_entry)
        self.assertFalse(b.allows_regime(new.regime))


class TestRegime(unittest.TestCase):
    def test_downtrend_always_below_ema200_and_vol_precedence(self):
        seen = set()
        for seed in range(3):
            rows = walk(seed)
            for end in range(300, len(rows) + 1, 7):
                a = analyze("X", rows[:end], S)
                seen.add(a.regime)
                if a.regime == DOWNTREND:
                    self.assertLess(a.close, a.regime_ema)
                if a.vol_rank >= 0.97:
                    self.assertEqual(a.regime, EXTREME_VOL)
        self.assertTrue({UPTREND, DOWNTREND, RANGE} <= seen, seen)

    def test_adx(self):
        n = 120
        up = [100 + i for i in range(n)]
        a = adx([x + 1 for x in up], [x - 1 for x in up], up, 14)
        self.assertIsNone(a[10])
        self.assertGreater(a[-1], 90)
        flat = [100.0] * n
        self.assertEqual(adx([101.0] * n, [99.0] * n, flat, 14)[-1], 0.0)


def spec(inst):
    return InstrumentSpec.from_api(SPECS[inst], [{"maintenanceMarginRate": "0.003"}])


class TestShortsPlumbing(unittest.TestCase):
    def test_short_sizing_and_ratchet(self):
        p = plan_trade(spec("ETH-USDT"), -1, 2700.0, 2805.0, 1000.0, 0.0025, S)
        self.assertEqual(p.side, "sell")
        self.assertGreater(float(p.stop), 2700)
        self.assertGreater(p.est_liq, float(p.stop))
        self.assertLessEqual(p.risk_amount, 2.5 + 1e-9)
        tick = Decimal("0.01")
        self.assertEqual(ratchet(-1, Decimal("2805"), 2790.004, tick), Decimal("2790.01"))  # rounds toward safety
        self.assertIsNone(ratchet(-1, Decimal("2805"), 2810.0, tick))
        self.assertEqual(ratchet(1, Decimal("2595"), 2600.009, tick), Decimal("2600"))
        self.assertIsNone(ratchet(1, Decimal("2595"), 2590.0, tick))

    def test_short_entries_refused_unless_allowed_and_supported(self):
        fx = FakeExchange()
        ex = Executor(fx, Settings(trading_equity_usdt=1000, instruments=("ETH-USDT",)),
                      Journal(":memory:", "PAPER", clock=fx.clock), clock=fx.clock, sleep=lambda _: None)
        a = Analysis("ETH-USDT", fx.now - 14_460_000, fx.now - 60_000, 2700.0, 30.0, 2700, 2699, 2750, False, False,
                     UPTREND, 0.5, UPTREND, direction=-1, entry=True)
        snap = ex.snapshot()
        self.assertIsNone(ex.try_entry(a, snap, [], 1.0))
        self.assertIn("direction -1", ex.j.events("SIGNAL_REJECTED")[0]["detail"])


class DummyLong(Strategy):
    """Test-only plug-in: B's analysis with its own id, prefix and a fixed take-profit."""
    id, family, timeframe, cid_prefix = "TEST-DUMMY", "test", "4H", "z"
    instruments = ("ETH-USDT",)
    validated_regimes = frozenset({UPTREND, RANGE})

    def analyze(self, inst_id, candles, s):
        a = analyze(inst_id, candles, s)
        return Analysis(**{**a.__dict__, "strategy_id": self.id})

    def initial_stop(self, a, s):
        return a.close - 3 * a.atr

    def trail_stop(self, a, s):
        return a.close - 3 * a.atr

    def take_profit(self, a, s):
        return a.close + 10 * a.atr


class TestPluggableStrategy(unittest.TestCase):
    def setUp(self):
        reg.register(DummyLong())

    def tearDown(self):
        reg.REGISTRY.pop(DummyLong.id, None)

    def test_new_strategy_trades_through_the_same_executor(self):
        fx = FakeExchange()
        s = Settings(trading_equity_usdt=1000, instruments=("ETH-USDT",), strategies=(DummyLong.id,))
        j = Journal(":memory:", "PAPER", clock=fx.clock)
        ex = Executor(fx, s, j, clock=fx.clock, sleep=lambda _: None)
        fx.candle_rows["ETH-USDT"] = aligned(fx)
        fx.price["ETH-USDT"] = 100.5
        ex.run_cycle()
        t = j.open_trades()[0]
        self.assertEqual(t["strategy_id"], DummyLong.id)
        self.assertTrue(t["client_order_id"].startswith("z"))
        self.assertIsNotNone(t["take_profit"])
        bar = json.loads(j.events("BAR")[0]["detail"])
        self.assertEqual(bar["strategy"], DummyLong.id)
        # take-profit closes on a bar close beyond the target
        fx.price["ETH-USDT"] = t["take_profit"] + 1
        a = Analysis(**{**ex.strategies[0].analyze("ETH-USDT", fx.candle_rows["ETH-USDT"], s).__dict__,
                        "close": t["take_profit"] + 1})
        ex.manage_open(t, a)
        self.assertEqual(j.trade(t["id"])["status"], "CLOSED")
        fb = j.feedback()[0]
        self.assertEqual((fb["strategy_id"], fb["result"]), (DummyLong.id, "WIN"))


if __name__ == "__main__":
    unittest.main()

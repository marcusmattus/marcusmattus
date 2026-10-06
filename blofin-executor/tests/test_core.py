import base64
import unittest
from decimal import Decimal

from bfx.client import sign
from bfx.config import ConfigError, Settings
from bfx.indicators import atr, ema
from bfx.risk import (InstrumentSpec, TradeRejected, check_portfolio, evaluate_breakers, plan_trade,
                      position_open_risk)
from bfx.secrets import Credentials
from bfx.strategy import analyze
from tests.fakes import SPECS, flat_then_jump


def spec(inst):
    return InstrumentSpec.from_api(SPECS[inst], [{"maintenanceMarginRate": "0.003"}])


S = Settings(trading_equity_usdt=1000)


class TestSigning(unittest.TestCase):
    def test_signature_is_base64_of_hex_digest(self):
        sig = sign("secret", "/api/v1/account/balanceGET1597026383085abc")
        raw = base64.b64decode(sig).decode()
        self.assertEqual(len(raw), 64)
        int(raw, 16)

    def test_credentials_never_render_secrets(self):
        c = Credentials("KEY1234567890abcd", "SUPERSECRET", "PASSPHRASE")
        self.assertNotIn("SUPERSECRET", repr(c) + str(c))
        self.assertNotIn("PASSPHRASE", repr(c))


class TestConfig(unittest.TestCase):
    def test_hard_limits(self):
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=100, risk_pct=0.011).validate()
        with self.assertRaises(ConfigError):
            Settings(mode="LIVE", trading_equity_usdt=100, risk_pct=0.0075).validate()
        Settings(mode="LIVE", trading_equity_usdt=100, risk_pct=0.0075, explicit_risk_approval=True).validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=100, margin_mode="cross").validate()
        with self.assertRaises(ConfigError):
            Settings(trading_equity_usdt=0).validate()
        self.assertEqual(Settings(trading_equity_usdt=1).max_leverage, 3)
        self.assertEqual(Settings(trading_equity_usdt=1, allow_5x=True).max_leverage, 5)


class TestIndicators(unittest.TestCase):
    def test_ema_constant(self):
        self.assertAlmostEqual(ema([5.0] * 50, 10)[-1], 5.0)

    def test_atr_constant_range(self):
        h, l, c = [11.0] * 30, [9.0] * 30, [10.0] * 30
        self.assertAlmostEqual(atr(h, l, c, 14)[-1], 2.0)
        self.assertIsNone(atr(h, l, c, 14)[5])


class TestStrategy(unittest.TestCase):
    def test_crossover_on_last_bar(self):
        a = analyze("ETH-USDT", flat_then_jump(), S)
        self.assertTrue(a.cross_up)
        self.assertTrue(a.entry_signal)
        self.assertFalse(a.exit_signal)
        self.assertLess(a.trail_candidate(3.5), a.close)

    def test_no_signal_when_flat(self):
        a = analyze("ETH-USDT", flat_then_jump(last_close=100.0), S)
        self.assertFalse(a.entry_signal)

    def test_needs_warmup(self):
        with self.assertRaises(ValueError):
            analyze("ETH-USDT", flat_then_jump(n=100), S)


class TestSizing(unittest.TestCase):
    def test_risk_based_size_and_cap(self):
        p = plan_trade(spec("ETH-USDT"), +1, 2700.0, 2595.0, 1000.0, 0.0025, S)
        self.assertLessEqual(p.risk_amount, 2.5 + 1e-9)       # never above budget (incl. fees+slippage)
        self.assertGreater(p.risk_amount, 2.5 * 0.9)
        self.assertEqual(p.size % Decimal("0.1"), 0)
        self.assertEqual(p.leverage, 1)
        self.assertLess(p.est_liq, float(p.stop))

    def test_below_exchange_minimum_rejected(self):
        # GBP 50 ~ 67 USDT at 0.25%: BTC min 0.1 contract would breach the risk cap -> reject, never round up
        with self.assertRaises(TradeRejected) as cm:
            plan_trade(spec("BTC-USDT"), +1, 100_000.0, 96_000.0, 67.0, 0.0025, S)
        self.assertIn("minimum", str(cm.exception))

    def test_leverage_only_when_margin_requires_and_capped(self):
        p = plan_trade(spec("ETH-USDT"), +1, 2700.0, 2690.0, 100.0, 0.005, S)  # tight stop -> big notional
        self.assertGreaterEqual(p.leverage, 1)
        self.assertLessEqual(p.leverage, 3)
        with self.assertRaises(TradeRejected):
            plan_trade(spec("ETH-USDT"), +1, 2700.0, 2699.0, 100.0, 0.01, S)  # would need >3x

    def test_liquidation_before_stop_rejected(self):
        s5 = Settings(trading_equity_usdt=10, allow_5x=True, liq_buffer_stop_frac=0.5)
        with self.assertRaises(TradeRejected):
            # 5x isolated liq ~ -19.7%; stop at -19% leaves too little buffer
            plan_trade(spec("SOL-USDT"), +1, 200.0, 162.0, 10.0, 0.01, s5)

    def test_wrong_side_stop(self):
        with self.assertRaises(TradeRejected):
            plan_trade(spec("ETH-USDT"), +1, 2700.0, 2800.0, 1000.0, 0.0025, S)


class TestPortfolio(unittest.TestCase):
    def test_correlated_cap(self):
        self.assertIsNone(check_portfolio("ETH-USDT", 2.5, {"BTC-USDT": 2.5}, 1000.0, S))
        why = check_portfolio("SOL-USDT", 2.5, {"BTC-USDT": 5.0, "ETH-USDT": 3.0}, 1000.0, S)
        self.assertIn("correlated", why)

    def test_locked_profit_has_no_open_risk(self):
        self.assertEqual(position_open_risk(+1, 100.0, 105.0, 1.0, 1.0), 0.0)
        self.assertEqual(position_open_risk(+1, 100.0, 95.0, 2.0, 1.0), 10.0)


class TestBreakers(unittest.TestCase):
    def test_levels(self):
        r = evaluate_breakers(S, 979, 1000, 1000, 1000, 0)
        self.assertIn("DAILY_LOSS", [h[0] for h in r.halts])
        r = evaluate_breakers(S, 949, 949, 1000, 1000, 0)
        self.assertIn("WEEKLY_DD", [h[0] for h in r.halts])
        r = evaluate_breakers(S, 915, 915, 915, 1000, 0)
        self.assertEqual(r.risk_multiplier, 0.5)
        r = evaluate_breakers(S, 899, 899, 899, 1000, 0)
        self.assertIn("STRATEGY_DD_DISABLE", [h[0] for h in r.halts])
        r = evaluate_breakers(S, 1000, 1000, 1000, 1000, 3)
        self.assertEqual(r.risk_multiplier, 0.5)
        r = evaluate_breakers(S, 1000, 1000, 1000, 1000, 5)
        self.assertIn("LOSING_STREAK", [h[0] for h in r.halts])
        r = evaluate_breakers(S, 1200, 1000, 1200, 1200, 0)  # winning: no escalation
        self.assertEqual(r.risk_multiplier, 1.0)


if __name__ == "__main__":
    unittest.main()

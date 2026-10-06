"""Strategy registry. Adding a strategy = subclass Strategy + `register(MyStrategy())`, then list its id in
config.json "strategies" and add its research record to research/strategies.json.

The executor only talks to strategies through this interface: analyze() for signals, initial_stop() /
trail_stop() / take_profit() for levels. It owns sizing, protection, ratcheting (stops only ever move in the
trade's favour) and every risk gate, so a strategy can never loosen them.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from . import STRATEGY_ID
from .config import ConfigError, Settings
from .regime import EXTREME_VOL, HIGH_VOL, RANGE, UPTREND
from .strategy import Analysis, analyze as analyze_b


@dataclass(frozen=True)
class Baseline:
    """Backtest (OOS) reference stats. None = unknown -> that drift check is reported as unknown."""
    pf: dict = field(default_factory=dict)        # per symbol
    win_rate: float | None = None
    expectancy_r: float | None = None
    avg_win_r: float | None = None
    avg_loss_r: float | None = None
    max_dd_pct: float | None = None               # fraction, e.g. 0.32
    trades_per_month: float | None = None         # per symbol
    avg_slippage_pct: float | None = None         # of entry notional
    avg_fee_pct: float | None = None              # of entry notional, round trip

    def pf_for(self, symbols: list[str]) -> float | None:
        """Trade-weighted baseline PF for the symbols in a sample (falls back to the mean)."""
        vals = [self.pf[x] for x in symbols if x in self.pf]
        if vals:
            return sum(vals) / len(vals)
        return sum(self.pf.values()) / len(self.pf) if self.pf else None


class Strategy:
    id: str = ""
    family: str = ""
    timeframe: str = "4H"
    instruments: tuple = ()
    directions: tuple = (1,)
    validated_regimes: frozenset = frozenset()
    baseline: Baseline = Baseline()
    cid_prefix: str = "s"          # client-order-id prefix; unique per strategy

    def analyze(self, inst_id: str, candles: list[list], s: Settings) -> Analysis:
        raise NotImplementedError

    def initial_stop(self, a: Analysis, s: Settings) -> float:
        raise NotImplementedError

    def trail_stop(self, a: Analysis, s: Settings) -> float | None:
        """Candidate stop for an open trade on this bar (the executor only ever ratchets it favourably)."""
        return None

    def take_profit(self, a: Analysis, s: Settings) -> float | None:
        return None

    def entry_reason(self, a: Analysis) -> str:
        return f"{self.id} entry"

    def exit_reason(self, a: Analysis) -> str:
        return f"{self.id} exit signal"

    def allows_regime(self, regime: str) -> bool:
        return regime in self.validated_regimes

    def __repr__(self) -> str:
        return f"Strategy({self.id})"


class StrategyB(Strategy):
    """EMA10/EMA100 cross, long-only above EMA200, ATR14 x 3.5 ratcheting stop, 4H.

    Its OOS backtest has no ADX/volatility filter, so it is validated in every regime its own close > EMA200
    filter admits (UPTREND, RANGE, HIGH_VOLATILITY) except EXTREME_VOLATILITY, which was never traded.
    DOWNTREND (close < EMA200) can never coincide with a B entry signal. Entries are therefore identical to
    the pre-registry executor.
    """
    id = STRATEGY_ID
    family = "trend-following / EMA crossover"
    timeframe = "4H"
    instruments = ("BTC-USDT", "ETH-USDT", "SOL-USDT")
    directions = (1,)
    validated_regimes = frozenset({UPTREND, RANGE, HIGH_VOL})
    baseline = Baseline(pf={"BTC-USDT": 1.37, "ETH-USDT": 1.77, "SOL-USDT": 1.75},
                        max_dd_pct=0.32, trades_per_month=1.0)  # 18-26 OOS trades/pair over ~21 months
    cid_prefix = "b"

    def analyze(self, inst_id, candles, s):
        return analyze_b(inst_id, candles, s)

    def initial_stop(self, a, s):
        return a.trail_candidate(s.trail_mult)

    def trail_stop(self, a, s):
        return a.trail_candidate(s.trail_mult)

    def entry_reason(self, a):
        return "EMA10>EMA100 cross, close>EMA200"

    def exit_reason(self, a):
        return "EMA10 crossed under EMA100"


REGISTRY: dict[str, Strategy] = {}


def register(strategy: Strategy) -> Strategy:
    if not strategy.id or strategy.id in REGISTRY:
        raise ValueError(f"strategy id {strategy.id!r} missing or already registered")
    if any(x.cid_prefix == strategy.cid_prefix for x in REGISTRY.values()):
        raise ValueError(f"client-order-id prefix {strategy.cid_prefix!r} already used")
    if EXTREME_VOL in strategy.validated_regimes and not getattr(strategy, "extreme_vol_validated", False):
        raise ValueError("EXTREME_VOLATILITY needs an explicit extreme_vol_validated = True")
    REGISTRY[strategy.id] = strategy
    return strategy


register(StrategyB())


def get(strategy_id: str) -> Strategy | None:
    return REGISTRY.get(strategy_id)


def enabled(s: Settings) -> list[Strategy]:
    unknown = [x for x in s.strategies if x not in REGISTRY]
    if unknown:
        raise ConfigError(f"unknown strategy ids in config: {unknown}; registered: {sorted(REGISTRY)}")
    return [REGISTRY[x] for x in s.strategies]

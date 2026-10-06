"""Strategy B signal + market regime, computed from confirmed BloFin candles.

Mirrors the validated Pine strategy (trader.dev 01M48060TF19E5R3HNM6GE5469):
  longEntry = crossover(EMA10, EMA100) and close > EMA200
  longExit  = crossunder(EMA10, EMA100)
  trail     = max(prev_trail, close - ATR14 * 3.5), ratcheting, evaluated on bar close
The regime label comes from bfx.regime (shared by every strategy); it never changes B's signals.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import STRATEGY_ID
from .config import Settings
from .indicators import adx, atr, ema
from .regime import DOWNTREND, EXTREME_VOL, HIGH_VOL, RANGE, UPTREND, classify  # noqa: F401 (re-exported)

BAR_MS = {"15m": 900_000, "1H": 3_600_000, "2H": 7_200_000, "4H": 14_400_000, "1D": 86_400_000}
MIN_BARS = 300
VALIDATED_TRENDS = {UPTREND}


@dataclass(frozen=True)
class Analysis:
    """One strategy's view of the last CONFIRMED bar.

    fast/slow/regime_ema/cross_* are B's indicator snapshot; strategies that do not use an EMA crossover set
    `entry`/`exit` explicitly and may leave the EMA fields at 0.
    """
    inst_id: str
    bar_ts: int            # open time (ms) of the last CONFIRMED bar
    bar_close_ts: int
    close: float
    atr: float
    fast: float
    slow: float
    regime_ema: float
    cross_up: bool
    cross_down: bool
    trend: str
    vol_rank: float        # percentile of ATR% over the lookback, 0..1
    regime: str            # bfx.regime label; volatility labels take precedence
    strategy_id: str = STRATEGY_ID
    direction: int = 1
    adx: float | None = None
    entry: bool | None = None
    exit: bool | None = None

    @property
    def entry_signal(self) -> bool:
        if self.entry is not None:
            return self.entry
        return self.cross_up and self.close > self.regime_ema

    @property
    def exit_signal(self) -> bool:
        return self.exit if self.exit is not None else self.cross_down

    @property
    def regime_allows_entry(self) -> bool:
        return self.trend in VALIDATED_TRENDS and self.regime != EXTREME_VOL

    def trail_candidate(self, mult: float) -> float:
        return self.close - self.direction * self.atr * mult


def analyze(inst_id: str, candles: list[list], s: Settings) -> Analysis:
    if len(candles) < MIN_BARS:
        raise ValueError(f"{inst_id}: need >= {MIN_BARS} confirmed bars, got {len(candles)}")
    ts = [int(c[0]) for c in candles]
    high = [float(c[2]) for c in candles]
    low = [float(c[3]) for c in candles]
    close = [float(c[4]) for c in candles]
    f = ema(close, s.fast_len)
    sl = ema(close, s.slow_len)
    rg = ema(close, s.regime_len)
    a = atr(high, low, close, s.atr_len)

    cross_up = f[-2] <= sl[-2] and f[-1] > sl[-1]
    cross_down = f[-2] >= sl[-2] and f[-1] < sl[-1]
    r = classify(close, rg, a, adx(high, low, close, s.adx_len), s.adx_trend_min)

    return Analysis(inst_id=inst_id, bar_ts=ts[-1], bar_close_ts=ts[-1] + BAR_MS[s.bar], close=close[-1],
                    atr=a[-1], fast=f[-1], slow=sl[-1], regime_ema=rg[-1], cross_up=cross_up,
                    cross_down=cross_down, trend=r.trend, vol_rank=r.vol_rank, regime=r.regime, adx=r.adx)

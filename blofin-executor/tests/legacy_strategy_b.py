"""Frozen copy of Strategy B analyze() as it was before the strategy registry (reference for equivalence tests)."""
from __future__ import annotations

from dataclasses import dataclass

from bfx.config import Settings
from bfx.indicators import atr, ema

BAR_MS = {"1H": 3_600_000, "2H": 7_200_000, "4H": 14_400_000, "1D": 86_400_000}
MIN_BARS = 300

UPTREND, DOWNTREND, RANGE = "UPTREND", "DOWNTREND", "RANGE"
HIGH_VOL, EXTREME_VOL = "HIGH VOLATILITY", "EXTREME VOLATILITY"
# Strategy B is a trend strategy validated only with close > EMA200; extreme volatility is never traded.
VALIDATED_TRENDS = {UPTREND}


@dataclass(frozen=True)
class Analysis:
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
    regime: str            # reported label; volatility labels take precedence

    @property
    def entry_signal(self) -> bool:
        return self.cross_up and self.close > self.regime_ema

    @property
    def exit_signal(self) -> bool:
        return self.cross_down

    @property
    def regime_allows_entry(self) -> bool:
        return self.trend in VALIDATED_TRENDS and self.regime != EXTREME_VOL

    def trail_candidate(self, mult: float) -> float:
        return self.close - self.atr * mult


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

    atr_pct = [x / c for x, c in zip(a, close) if x is not None]
    window = atr_pct[-500:]
    cur = atr_pct[-1]
    vol_rank = sum(1 for x in window if x <= cur) / len(window)

    slope = rg[-1] - rg[-21]
    if close[-1] > rg[-1]:
        trend = UPTREND
    elif slope < 0:
        trend = DOWNTREND
    else:
        trend = RANGE
    regime = EXTREME_VOL if vol_rank >= 0.97 else HIGH_VOL if vol_rank >= 0.85 else trend

    return Analysis(inst_id=inst_id, bar_ts=ts[-1], bar_close_ts=ts[-1] + BAR_MS[s.bar], close=close[-1],
                    atr=a[-1], fast=f[-1], slow=sl[-1], regime_ema=rg[-1], cross_up=cross_up,
                    cross_down=cross_down, trend=trend, vol_rank=vol_rank, regime=regime)

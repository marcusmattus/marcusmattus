"""Market-regime classifier shared by all strategies.

Precedence: volatility labels first (ATR% percentile over the last 500 bars: >= 0.97 EXTREME, >= 0.85 HIGH),
then ADX < adx_trend_min -> RANGE, then price vs EMA200 with the EMA200 20-bar slope agreeing ->
UPTREND / DOWNTREND, anything mixed -> RANGE. DOWNTREND always has close < EMA200.
"""
from __future__ import annotations

from dataclasses import dataclass

UPTREND, DOWNTREND, RANGE = "UPTREND", "DOWNTREND", "RANGE"
HIGH_VOL, EXTREME_VOL = "HIGH_VOLATILITY", "EXTREME_VOLATILITY"
REGIMES = (UPTREND, DOWNTREND, RANGE, HIGH_VOL, EXTREME_VOL)
VOL_LOOKBACK, HIGH_VOL_RANK, EXTREME_VOL_RANK, SLOPE_BARS = 500, 0.85, 0.97, 20


def normalize(label: str | None) -> str:
    """Map legacy labels ('HIGH VOLATILITY') to the canonical form."""
    return (label or "UNKNOWN").strip().upper().replace(" ", "_")


@dataclass(frozen=True)
class RegimeInfo:
    regime: str
    trend: str          # legacy directional bias: close vs EMA200, else EMA200 slope
    vol_rank: float
    adx: float | None
    slope: float


def vol_rank(atr_vals: list, close: list[float]) -> float:
    atr_pct = [x / c for x, c in zip(atr_vals, close) if x is not None]
    window = atr_pct[-VOL_LOOKBACK:]
    cur = atr_pct[-1]
    return sum(1 for x in window if x <= cur) / len(window)


def classify(close: list[float], ema200: list[float], atr_vals: list, adx_vals: list, adx_min: float) -> RegimeInfo:
    rank = vol_rank(atr_vals, close)
    slope = ema200[-1] - ema200[-1 - SLOPE_BARS]
    above = close[-1] > ema200[-1]
    trend = UPTREND if above else DOWNTREND if slope < 0 else RANGE
    a = adx_vals[-1] if adx_vals else None
    if rank >= EXTREME_VOL_RANK:
        regime = EXTREME_VOL
    elif rank >= HIGH_VOL_RANK:
        regime = HIGH_VOL
    elif a is None or a < adx_min:
        regime = RANGE
    elif above and slope >= 0:
        regime = UPTREND
    elif not above and close[-1] < ema200[-1] and slope <= 0:
        regime = DOWNTREND
    else:
        regime = RANGE
    return RegimeInfo(regime, trend, rank, a, slope)

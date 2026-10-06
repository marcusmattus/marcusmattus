"""Pine-equivalent indicators (ta.ema, ta.rma, ta.atr). Lists are oldest-first; None until defined."""
from __future__ import annotations


def ema(values: list[float], length: int) -> list[float | None]:
    # Pine ta.ema: seeded with the first source value, alpha = 2 / (length + 1)
    alpha = 2.0 / (length + 1)
    out: list[float | None] = []
    prev = None
    for v in values:
        prev = v if prev is None else alpha * v + (1 - alpha) * prev
        out.append(prev)
    return out


def rma(values: list[float], length: int) -> list[float | None]:
    # Pine ta.rma: SMA of the first `length` values, then Wilder smoothing
    out: list[float | None] = []
    prev = None
    for i, v in enumerate(values):
        if i + 1 < length:
            out.append(None)
            continue
        if prev is None:
            prev = sum(values[i + 1 - length:i + 1]) / length
        else:
            prev = (prev * (length - 1) + v) / length
        out.append(prev)
    return out


def true_range(high: list[float], low: list[float], close: list[float]) -> list[float]:
    tr = []
    for i in range(len(close)):
        if i == 0:
            tr.append(high[0] - low[0])
        else:
            pc = close[i - 1]
            tr.append(max(high[i] - low[i], abs(high[i] - pc), abs(low[i] - pc)))
    return tr


def atr(high: list[float], low: list[float], close: list[float], length: int) -> list[float | None]:
    return rma(true_range(high, low, close), length)


def adx(high: list[float], low: list[float], close: list[float], length: int) -> list[float | None]:
    """Pine ta.dmi ADX (DI length == ADX smoothing length)."""
    n = len(close)
    plus_dm, minus_dm = [0.0], [0.0]
    for i in range(1, n):
        up, down = high[i] - high[i - 1], low[i - 1] - low[i]
        plus_dm.append(up if up > down and up > 0 else 0.0)
        minus_dm.append(down if down > up and down > 0 else 0.0)
    tr = rma(true_range(high, low, close), length)
    p, m = rma(plus_dm, length), rma(minus_dm, length)
    dx: list[float] = []
    first = None
    for i in range(n):
        if tr[i] is None:
            continue
        pi, mi = (100 * p[i] / tr[i], 100 * m[i] / tr[i]) if tr[i] else (0.0, 0.0)
        s = pi + mi
        first = i if first is None else first
        dx.append(abs(pi - mi) / (s if s else 1))
    smoothed = rma(dx, length)
    return [None] * (first or n) + [None if v is None else 100 * v for v in smoothed]

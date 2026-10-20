"""Strategy health (drift vs backtest baseline) and the strategy x regime matrix.

Health rule, evaluated on a strategy's last `review_every` (20) closed non-test trades:
  * n < 20                                   -> HEALTHY with sample_ok=False (no evidence either way)
  * mean R significantly below 0             -> DISABLED   (one-sided t = mean/se < -2.326, p < 0.01)
  * PF / baseline PF < 0.6, or net E <= 0    -> DEGRADED   (the pre-registry review rule, kept as a floor)
  * PF ratio < 0.8, or mean R significantly below the baseline expectancy (t < -1.645, p < 0.05),
    or any secondary drift (win rate -15pp, max DD > 1.5x, slippage > 2x, fees > 1.5x, trade frequency
    outside 0.5-2x of baseline)            -> WATCH
  * otherwise                                -> HEALTHY
  se = sample std of R / sqrt(n). Baseline PF is the mean of the per-symbol OOS PFs weighted by the
  sample's trades per symbol. Unknown baseline metrics are reported as "unknown" and never flag.
DEGRADED / DISABLED pause the strategy: no new entries; open positions keep their stops and trailing.
Nothing re-optimises; only a typed manual confirmation resumes a strategy or re-enables a regime.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from .config import Settings
from .journal import Journal
from .regime import normalize
from .strategies import Strategy

HEALTHY, WATCH, DEGRADED, DISABLED = "HEALTHY", "WATCH", "DEGRADED", "DISABLED"
PAUSING = {DEGRADED, DISABLED}
Z95, Z99 = 1.645, 2.326


def _notional(t) -> float:
    return abs((t["entry_fill"] or 0) * float(t["size"] or 0) * (t["contract_value"] or 0))


def trade_metrics(trades, capital_base: float = 0.0) -> dict:
    n = len(trades)
    pnl = [t["pnl"] or 0.0 for t in trades]
    rs = [t["r_multiple"] for t in trades if t["r_multiple"] is not None]
    gw, gl = sum(p for p in pnl if p > 0), -sum(p for p in pnl if p <= 0)
    wins_r = [r for r in rs if r > 0]
    loss_r = [r for r in rs if r <= 0]
    mean_r = sum(rs) / len(rs) if rs else None
    sd_r = math.sqrt(sum((r - mean_r) ** 2 for r in rs) / (len(rs) - 1)) if len(rs) > 1 else None
    curve = peak = mdd = 0.0
    for p in pnl:
        curve += p
        peak = max(peak, curve)
        mdd = max(mdd, peak - curve)
    notional = [_notional(t) for t in trades]
    slip = [(t["slippage"] or 0) / x for t, x in zip(trades, notional) if x]
    fee = [((t["entry_fee"] or 0) + (t["exit_fee"] or 0)) / x for t, x in zip(trades, notional) if x]
    times = [t["opened_ts"] for t in trades if t["opened_ts"]] + [t["exit_ts"] for t in trades if t["exit_ts"]]
    span_days = (max(times) - min(times)) / 86_400_000 if times else 0.0
    symbols = sorted({t["inst_id"] for t in trades})
    return {
        "trades": n, "win_rate": sum(1 for p in pnl if p > 0) / n if n else None,
        "profit_factor": gw / gl if gl > 0 else (math.inf if gw > 0 else None),
        "expectancy": sum(pnl) / n if n else None, "expectancy_r": mean_r, "sd_r": sd_r,
        "avg_win_r": sum(wins_r) / len(wins_r) if wins_r else None,
        "avg_loss_r": sum(loss_r) / len(loss_r) if loss_r else None,
        "net_pnl": sum(pnl), "max_dd": mdd, "max_dd_pct": mdd / capital_base if capital_base > 0 else None,
        "avg_slippage_pct": sum(slip) / len(slip) if slip else None,
        "avg_fee_pct": sum(fee) / len(fee) if fee else None, "span_days": span_days,
        "trades_per_month": (n / (span_days / 30.44) / max(1, len(symbols))) if span_days >= 30 else None,
        "symbols": symbols,
    }


@dataclass
class HealthReport:
    strategy_id: str
    status: str
    n: int
    sample_ok: bool
    metrics: dict
    pf_baseline: float | None
    pf_ratio: float | None
    t_vs_zero: float | None
    t_vs_baseline: float | None
    drift: dict = field(default_factory=dict)
    reasons: list = field(default_factory=list)


def _t(mean: float | None, ref: float, sd: float | None, n: int) -> float | None:
    if mean is None or n < 2 or sd is None:
        return None
    if sd == 0:
        return 0.0 if mean == ref else math.copysign(math.inf, mean - ref)
    return (mean - ref) / (sd / math.sqrt(n))


def assess(strategy: Strategy, trades, s: Settings, capital_base: float = 0.0) -> HealthReport:
    window = list(trades)[-s.review_every:]
    m = trade_metrics(window, capital_base)
    n = m["trades"]
    b = strategy.baseline
    base_pf = b.pf_for([t["inst_id"] for t in window])
    pf = m["profit_factor"]
    ratio = None if pf is None or not base_pf else (math.inf if pf == math.inf else pf / base_pf)
    t0 = _t(m["expectancy_r"], 0.0, m["sd_r"], n)
    tb = _t(m["expectancy_r"], b.expectancy_r, m["sd_r"], n) if b.expectancy_r is not None else None

    def chk(live, base, bad) -> str:
        if base is None or live is None:
            return "unknown"
        return "drift" if bad(live, base) else "ok"
    tpm_ok = m["trades_per_month"]
    drift = {
        "win_rate": chk(m["win_rate"], b.win_rate, lambda x, y: x < y - 0.15),
        "max_dd": chk(m["max_dd_pct"], b.max_dd_pct, lambda x, y: x > 1.5 * y),
        "slippage": chk(m["avg_slippage_pct"], b.avg_slippage_pct, lambda x, y: x > 2 * y),
        "fees": chk(m["avg_fee_pct"], b.avg_fee_pct, lambda x, y: x > 1.5 * y),
        "frequency": chk(tpm_ok, b.trades_per_month, lambda x, y: not 0.5 * y <= x <= 2 * y),
        "profit_factor": chk(pf, base_pf, lambda x, y: x < s.review_watch_pf_ratio * y),
        "expectancy": "unknown" if tb is None else ("drift" if tb < -Z95 else "ok"),
    }
    rep = HealthReport(strategy.id, HEALTHY, n, n >= s.review_every, m, base_pf, ratio, t0, tb, drift)
    if not rep.sample_ok:
        rep.reasons.append(f"insufficient sample: {n} < {s.review_every} closed trades")
        return rep
    if t0 is not None and t0 < -Z99:
        rep.status = DISABLED
        rep.reasons.append(f"mean R {m['expectancy_r']:.3f} significantly < 0 (t={t0:.2f}, p<0.01)")
        return rep
    if ratio is None or ratio < s.review_min_pf_ratio:
        rep.status = DEGRADED
        rep.reasons.append(f"PF {pf} vs baseline {base_pf}: ratio {ratio} < {s.review_min_pf_ratio}")
    if (m["expectancy"] or 0) <= 0:
        rep.status = DEGRADED
        rep.reasons.append(f"net expectancy {m['expectancy']} <= 0 after fees/slippage/funding")
    if rep.status == DEGRADED:
        return rep
    flagged = [k for k, v in drift.items() if v == "drift"]
    if flagged:
        rep.status = WATCH
        rep.reasons.append(f"drift: {flagged}")
    return rep


def capital_base(j: Journal, s: Settings) -> float:
    row = j.capital_row()
    return row["initial"] if row else s.trading_equity_usdt


def status(j: Journal, strategy_id: str) -> tuple[str, bool]:
    st = j.strategy_state(strategy_id)
    return (st["health"] or HEALTHY, bool(st["paused"])) if st else (HEALTHY, False)


def review(j: Journal, s: Settings, strategy: Strategy, force: bool = False) -> HealthReport | None:
    """Automatic every `review_every` closed trades; `force` for the on-demand CLI check."""
    trades = j.closed_trades(strategy_id=strategy.id)
    st = j.strategy_state(strategy.id)
    done = st["reviewed_count"] if st else 0
    if not force and len(trades) < done + s.review_every:
        return None
    rep = assess(strategy, trades, s, capital_base(j, s))
    prev, paused = status(j, strategy.id)
    f: dict = {"health": rep.status}
    if not force:
        f["reviewed_count"] = len(trades)
    m = rep.metrics
    j.event("PERFORMANCE_REVIEW", None, strategy=strategy.id, status=rep.status, trades=rep.n,
            profit_factor=m["profit_factor"], pf_baseline=rep.pf_baseline, pf_ratio=rep.pf_ratio,
            expectancy=m["expectancy"], expectancy_r=m["expectancy_r"], t_vs_zero=rep.t_vs_zero,
            drift=rep.drift, reasons=rep.reasons, on_demand=force)
    if rep.status != prev:
        j.event("STRATEGY_HEALTH", None, strategy=strategy.id, old=prev, new=rep.status, reasons=rep.reasons)
    if rep.status in PAUSING and not paused:
        f.update(paused=1, reason="; ".join(rep.reasons))
        j.event("STRATEGY_PAUSED", None, strategy=strategy.id, status=rep.status, reasons=rep.reasons)
    j.set_strategy_state(strategy.id, **f)
    return rep


def resume(j: Journal, strategy_id: str) -> None:
    """Manual only (CLI typed confirmation). Status becomes WATCH until the next review."""
    j.set_strategy_state(strategy_id, paused=0, health=WATCH, reason="manually resumed")
    j.event("STRATEGY_RESUMED", None, strategy=strategy_id)


# ---------------------------------------------------------------- strategy x regime matrix
def regime_matrix(trades) -> dict:
    """{(strategy_id, regime): {trades, profit_factor, expectancy, expectancy_r, win_rate}}"""
    groups: dict = {}
    for t in trades:
        groups.setdefault((t["strategy_id"], normalize(t["regime"])), []).append(t)
    out = {}
    for k, ts in sorted(groups.items()):
        m = trade_metrics(ts)
        out[k] = {x: m[x] for x in ("trades", "profit_factor", "expectancy", "expectancy_r", "win_rate")}
    return out


def regime_disabled(j: Journal, strategy_id: str, regime: str) -> bool:
    r = j.regime_row(strategy_id, normalize(regime))
    return bool(r and r["disabled"])


def check_regimes(j: Journal, s: Settings, strategy_id: str) -> list[str]:
    """Auto-disable (new entries only) regimes with >= regime_min_trades trades since (re-)enable and E < 0."""
    out = []
    trades = j.closed_trades(strategy_id=strategy_id)
    for regime in sorted({normalize(t["regime"]) for t in trades}):
        row = j.regime_row(strategy_id, regime)
        if row and row["disabled"]:
            continue
        since = row["since_ts"] if row else 0
        ts = [t for t in trades if normalize(t["regime"]) == regime and (t["exit_ts"] or 0) >= since]
        m = trade_metrics(ts)
        if m["trades"] >= s.regime_min_trades and (m["expectancy"] or 0) < 0:
            reason = f"{m['trades']} trades, expectancy {m['expectancy']:.4f} < 0, PF {m['profit_factor']}"
            j.set_regime_state(strategy_id, regime, disabled=1, reason=reason)
            j.event("REGIME_DISABLED", None, strategy=strategy_id, regime=regime, reason=reason)
            out.append(regime)
    return out


def enable_regime(j: Journal, strategy_id: str, regime: str) -> None:
    """Manual only. Evidence restarts from now so a re-enabled regime gets a fresh sample."""
    j.set_regime_state(strategy_id, normalize(regime), disabled=0, reason="manually re-enabled",
                       since_ts=j.clock())
    j.event("REGIME_ENABLED", None, strategy=strategy_id, regime=normalize(regime))

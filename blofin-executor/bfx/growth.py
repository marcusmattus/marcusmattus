"""Growth model: distance to the £1k/£10k/£100k/£1M milestones, realised growth rates and a bootstrap
Monte Carlo over a strategy's actual closed-trade R multiples. Probabilities only; never a date.

Monte Carlo: each path draws R multiples with replacement from the strategy's non-test closed trades
(net of fees, funding and slippage), risks TC x risk_pct per trade and applies the profit lock exactly like
bfx.capital. It does NOT apply the drawdown ladder or breakers (so it shows the raw strategy risk); the share
of paths that touch the ladder's no-new-positions level is reported separately.
"""
from __future__ import annotations

import random

from .capital import CapitalState, apply_realized, max_drawdown_pct

TARGETS_GBP = (1_000, 10_000, 100_000, 1_000_000)
MIN_TRADES, MIN_DAYS = 20, 30


def realised_rates(initial: float, total_equity: float, days: float) -> dict:
    if days < MIN_DAYS or initial <= 0 or total_equity <= 0:
        return {"cagr": None, "monthly": None, "days": days, "note": f"insufficient data (< {MIN_DAYS} days)"}
    g = total_equity / initial
    return {"cagr": g ** (365.25 / days) - 1, "monthly": g ** (30.44 / days) - 1, "days": days, "note": None}


def monte_carlo(rs: list[float], st: CapitalState, risk_pct: float, lock_pct: float, targets_usdt: dict,
                n_trades: int, sims: int, no_new_dd: float = 0.08, seed: int = 7) -> dict:
    """{target_gbp: {p_reach, p_dd10_first, p_dd25_first}, plus overall dd/no-new probabilities}."""
    rng = random.Random(seed)
    out = {g: {"p_reach": 0, "p_dd10_first": 0, "p_dd25_first": 0} for g in targets_usdt}
    any10 = any25 = any_nonew = ruined = 0
    for _ in range(sims):
        cur = st
        reach = {g: None for g in targets_usdt}
        dd10 = dd25 = None
        hit_nonew = False
        for i in range(n_trades):
            cur, _ = apply_realized(cur, rng.choice(rs) * cur.trading_capital * risk_pct, lock_pct)
            te = cur.total_equity
            dd = 1 - te / cur.high_water_mark if cur.high_water_mark > 0 else 0.0
            hit_nonew = hit_nonew or dd >= no_new_dd
            if dd10 is None and dd >= 0.10:
                dd10 = i
            if dd25 is None and dd >= 0.25:
                dd25 = i
            for g, usdt in targets_usdt.items():
                if reach[g] is None and te >= usdt:
                    reach[g] = i
            if cur.trading_capital <= 0:
                ruined += 1
                break
        any10 += dd10 is not None
        any25 += dd25 is not None
        any_nonew += hit_nonew
        for g in targets_usdt:
            r = reach[g]
            out[g]["p_reach"] += r is not None
            out[g]["p_dd10_first"] += dd10 is not None and (r is None or dd10 < r)
            out[g]["p_dd25_first"] += dd25 is not None and (r is None or dd25 < r)
    for g in out:
        out[g] = {k: v / sims for k, v in out[g].items()}
    return {"targets": out, "p_dd10": any10 / sims, "p_dd25": any25 / sims, "p_ladder_no_new": any_nonew / sims,
            "p_ruin": ruined / sims, "n_trades": n_trades, "sims": sims}


def growth_report(st: CapitalState, gbp_per_usdt: float | None, start_ms: int | None, now_ms: int,
                  rs_by_strategy: dict, risk_pct: float, lock_pct: float, n_trades: int, sims: int,
                  no_new_dd: float = 0.08, ledger_path: list[float] | None = None) -> dict:
    te = st.total_equity
    days = (now_ms - start_ms) / 86_400_000 if start_ms else 0.0
    rep = {"total_equity": te, "hwm": st.high_water_mark,
           "current_dd": max(0.0, 1 - te / st.high_water_mark) if st.high_water_mark > 0 else 0.0,
           "max_dd": max_drawdown_pct([st.initial] + (ledger_path or [])),
           "rates": realised_rates(st.initial, te, days), "milestones": {}, "monte_carlo": {}}
    targets = {g: g / gbp_per_usdt for g in TARGETS_GBP} if gbp_per_usdt else {}
    for g, usdt in targets.items():
        rep["milestones"][g] = {"target_usdt": usdt, "required_multiple": usdt / te if te > 0 else None,
                                "reached": te >= usdt}
    for sid, rs in rs_by_strategy.items():
        if len(rs) < MIN_TRADES:
            rep["monte_carlo"][sid] = {"note": f"insufficient data: {len(rs)} closed trades (< {MIN_TRADES})"}
        elif not targets:
            rep["monte_carlo"][sid] = {"note": "gbp_per_usdt not configured"}
        else:
            rep["monte_carlo"][sid] = monte_carlo(rs, st, risk_pct, lock_pct, targets, n_trades, sims, no_new_dd)
    return rep

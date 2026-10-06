"""Local backtester for Strategy B on BloFin's own public candles (no keys).

Chronological TRAIN / VALIDATION / OOS split. Parameters are FIXED (never fitted on OOS). Costs: taker fee per side,
slippage per side, funding assumption. Position sizing matches the executor: risk% of equity / (ATR x mult) stop
distance, notional capped at leverage x equity.
"""
from __future__ import annotations

import calendar
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from . import STRATEGY_ID
from .client import _ssl_context
from .indicators import atr, ema

BASE = "https://openapi.blofin.com"
BAR_MS = {"4H": 14_400_000, "1H": 3_600_000, "15m": 900_000}


def _ms(y: int, m: int, d: int) -> int:
    return calendar.timegm((y, m, d, 0, 0, 0)) * 1000


SPLITS = {"TRAIN": (0, _ms(2024, 1, 1)), "VALIDATION": (_ms(2024, 1, 1), _ms(2025, 1, 1)),
          "OOS": (_ms(2025, 1, 1), 10**15)}


def fetch_history(inst: str, bar: str, cache_dir: Path, refresh: bool = False) -> list[list[float]]:
    """Oldest-first confirmed candles [ts,o,h,l,c], paged back until BloFin returns nothing. Cached on disk."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    p = cache_dir / f"{inst}_{bar}.json"
    rows: dict[int, list[float]] = {}
    if p.exists():
        rows = {int(r[0]): r for r in json.loads(p.read_text())}
    stale = not rows or (time.time() * 1000 - max(rows)) > 2 * BAR_MS[bar]
    if refresh or stale:
        ctx, after = _ssl_context(), None
        for _ in range(200):
            q = {"instId": inst, "bar": bar, "limit": 1440}
            if after:
                q["after"] = after
            url = f"{BASE}/api/v1/market/candles?{urllib.parse.urlencode(q)}"
            req = urllib.request.Request(url, headers={"User-Agent": "bfx/1"})
            data = json.load(urllib.request.urlopen(req, timeout=30, context=ctx))["data"]
            if not data:
                break
            new_after = int(data[-1][0])
            for r in data:
                if str(r[8]) == "1":
                    rows[int(r[0])] = [int(r[0])] + [float(x) for x in r[1:5]]
            if after is not None and new_after >= after:
                break
            after = new_after
            time.sleep(0.12)
        p.write_text(json.dumps([rows[k] for k in sorted(rows)]))
    return [rows[k] for k in sorted(rows)]


def simulate(c: list[list[float]], fast=10, slow=100, reg=200, atr_len=14, mult=3.5, risk=0.0025, lev=5.0,
             fee=0.0006, slip=0.0005, funding_per_bar=0.00005) -> list[dict]:
    """Long-only EMA fast/slow cross above EMA reg, ATR ratcheting trail. Signals on bar close, fills next open."""
    cl = [r[4] for r in c]
    f, s_, g = ema(cl, fast), ema(cl, slow), ema(cl, reg)
    a = atr([r[2] for r in c], [r[3] for r in c], cl, atr_len)
    trades, pos, eq = [], None, 1.0
    start = max(reg, slow, atr_len) + 1
    for i in range(start, len(c) - 1):
        ts, nxt = c[i][0], c[i + 1]
        if pos:
            if c[i][3] <= pos["stop"]:      # stop set at an earlier close; gap-down fills at the open
                px = min(pos["stop"], c[i][1]) * (1 - slip)
                trades.append(_close(pos, px, ts, fee, funding_per_bar))
                eq += trades[-1]["pnl_frac"]
                pos = None
            else:
                pos["bars"] += 1
                pos["stop"] = max(pos["stop"], cl[i] - a[i] * mult)
                if f[i - 1] >= s_[i - 1] and f[i] < s_[i]:
                    px = nxt[1] * (1 - slip)
                    trades.append(_close(pos, px, nxt[0], fee, funding_per_bar))
                    eq += trades[-1]["pnl_frac"]
                    pos = None
        if not pos and f[i - 1] <= s_[i - 1] and f[i] > s_[i] and cl[i] > g[i] and a[i]:
            entry = nxt[1] * (1 + slip)
            stop = cl[i] - a[i] * mult
            dist = entry - stop
            if dist <= 0:
                continue
            notional = min(eq * risk * entry / dist, eq * lev)
            pos = {"entry": entry, "stop": stop, "qty_frac": notional / entry, "t0": nxt[0], "bars": 0,
                   "eq0": eq, "risk_amt": eq * risk}
    return trades


def _close(pos, px, t1, fee, fpb) -> dict:
    gross = (px - pos["entry"]) * pos["qty_frac"]
    costs = pos["qty_frac"] * (pos["entry"] + px) * fee + pos["qty_frac"] * pos["entry"] * fpb * pos["bars"]
    pnl = gross - costs
    return {"t0": pos["t0"], "t1": t1, "pnl_frac": pnl, "r": pnl / pos["risk_amt"]}


def stats(trades: list[dict]) -> dict:
    n = len(trades)
    if not n:
        return {"trades": 0, "pf": None, "net_pct": 0.0, "dd_pct": 0.0, "expectancy_r": None, "win_rate": None,
                "sharpe": None, "sortino": None}
    w = sum(t["pnl_frac"] for t in trades if t["pnl_frac"] > 0)
    l = -sum(t["pnl_frac"] for t in trades if t["pnl_frac"] < 0)
    eq, peak, dd = 1.0, 1.0, 0.0
    for t in trades:
        eq += t["pnl_frac"]
        peak = max(peak, eq)
        dd = max(dd, (peak - eq) / peak)
    rs = [t["r"] for t in trades]
    m = sum(rs) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in rs) / (n - 1)) if n > 1 else 0
    dsd = math.sqrt(sum(min(0, x) ** 2 for x in rs) / n)
    return {"trades": n, "pf": round(w / l, 3) if l else None, "net_pct": round((eq - 1) * 100, 2),
            "dd_pct": round(dd * 100, 2), "expectancy_r": round(m, 3), "win_rate": round(sum(x > 0 for x in rs) / n, 3),
            "sharpe": round(m / sd, 3) if sd else None, "sortino": round(m / dsd, 3) if dsd else None}


def _in(trades, span):
    return [t for t in trades if span[0] <= t["t0"] < span[1]]


def run_research(inst_list, cache_dir: Path, bar="4H", refresh=False) -> dict:
    out: dict = {"strategy_id": STRATEGY_ID, "generated_at": int(time.time() * 1000), "bar": bar, "assumptions": {"fee_per_side": 0.0006, "slippage_per_side": 0.0005,
                 "funding_per_4h": 0.00005, "risk_per_trade": 0.0025, "leverage_cap": 5,
                 "note": "funding is a flat 0.01%/8h long-pays assumption, not historical"},
                 "symbols": {}}
    for inst in inst_list:
        c = fetch_history(inst, bar, cache_dir, refresh)
        d: dict = {"first_bar": time.strftime("%Y-%m-%d", time.gmtime(c[0][0] / 1000)), "bars": len(c), "splits": {}}
        allt = simulate(c)
        for name, span in SPLITS.items():
            d["splits"][name] = stats(_in(allt, span))
        stress = {}
        for label, kw in {"2x_costs": dict(fee=0.0012, slip=0.001, funding_per_bar=0.0001),
                          "3x_slippage": dict(slip=0.0015), "5x_slippage": dict(slip=0.0025)}.items():
            stress[label] = stats(_in(simulate(c, **kw), SPLITS["OOS"]))
        d["oos_stress"] = stress
        nb = []   # diagnostic only; nothing is selected from it
        for fa in (8, 10, 12):
            for sl in (80, 100, 120):
                for m in (3.0, 3.5, 4.0):
                    st = stats(_in(simulate(c, fast=fa, slow=sl, mult=m), SPLITS["OOS"]))
                    nb.append({"fast": fa, "slow": sl, "mult": m, "pf": st["pf"], "net_pct": st["net_pct"],
                               "trades": st["trades"]})
        d["param_neighbourhood"] = {
            "cells": nb,
            "share_profitable": round(sum(1 for x in nb if x["pf"] and x["pf"] > 1 and x["net_pct"] > 0) / len(nb), 3),
            "share_pf_ge_1_3": round(sum(1 for x in nb if x["pf"] and x["pf"] >= 1.3) / len(nb), 3)}
        out["symbols"][inst] = d
    return out

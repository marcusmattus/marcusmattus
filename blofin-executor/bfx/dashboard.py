"""Dashboard: one data dict from the journal (+ an optional exchange snapshot) rendered as text or as a
single self-contained HTML file (inline CSS, light/dark, no external assets, no scripts)."""
from __future__ import annotations

import html
import json
import math
from datetime import datetime, timezone

from . import health as hl
from . import strategies as reg
from .capital import CapitalCorrupt, CapitalEngine, max_drawdown_pct, next_milestone_gbp
from .config import ROOT, Settings
from .failsafe import FailureMonitor
from .journal import Journal
from .robustness import load_research

DAY = 86_400_000


def _ratio_stats(rets: list[float]) -> tuple[float | None, float | None]:
    if len(rets) < 2:
        return None, None
    mean = sum(rets) / len(rets)
    sd = math.sqrt(sum((r - mean) ** 2 for r in rets) / (len(rets) - 1))
    down = math.sqrt(sum(min(r, 0) ** 2 for r in rets) / len(rets))
    return (mean / sd if sd else None), (mean / down if down else None)


def collect(j: Journal, s: Settings, snap=None, paper_j: Journal | None = None) -> dict:
    from .executor import stats, strategy_eligibility  # local import: executor imports this module's peers
    now = j.clock()
    eng = CapitalEngine(j, s)
    try:
        cap = eng.state()
        cap_err = None
    except CapitalCorrupt as e:
        cap, cap_err = None, str(e)
    closed = j.closed_trades()
    st = stats(closed)
    ledger = j.ledger()
    rets = [r["net_pnl"] / (r["total_equity"] - r["net_pnl"]) for r in ledger
            if (r["total_equity"] - r["net_pnl"]) > 0]
    sharpe, sortino = _ratio_stats(rets)
    rs = [t["r_multiple"] for t in closed if t["r_multiple"] is not None]
    research, research_err = load_research(ROOT / s.research_path)
    paper_j = paper_j or j
    strats = []
    for sid in sorted(set(reg.REGISTRY) | set(s.strategies)):
        x = reg.get(sid)
        status, paused = hl.status(j, sid)
        ok, reasons, rob = strategy_eligibility(paper_j, s, x, research, research_err) if x else (False, [], None)
        strats.append({"id": sid, "enabled": sid in s.strategies, "family": x.family if x else "?",
                       "timeframe": x.timeframe if x else "?", "health": status, "paused": paused,
                       "robustness": rob.score if rob else None, "robustness_flags": rob.flags if rob else [],
                       "live_eligible": ok, "eligibility_reasons": reasons,
                       "disabled_regimes": [r["regime"] for r in j.disabled_regimes(sid)]})
    regimes = {}
    for e in reversed(j.events("BAR", 200)):
        regimes[e["inst_id"]] = json.loads(e["detail"]).get("regime")
    matrix = {f"{k[0]} | {k[1]}": v for k, v in hl.regime_matrix(closed).items()}
    te = cap.total_equity if cap else None
    return {
        "mode": s.mode, "generated": datetime.fromtimestamp(now / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "gbp_per_usdt": s.gbp_per_usdt, "capital_error": cap_err,
        "trading_capital": cap.trading_capital if cap else None, "profit_reserve": cap.profit_reserve if cap else None,
        "total_equity": te, "hwm": cap.high_water_mark if cap else None, "initial": cap.initial if cap else None,
        "next_milestone_gbp": next_milestone_gbp(te, s.gbp_per_usdt) if te is not None else None,
        "realised": st["net_pnl"], "unrealised": getattr(snap, "unrealized", None) if snap else None,
        "pnl_day": j.realized_pnl(now - now % DAY), "pnl_week": j.realized_pnl(now - 7 * DAY),
        "pnl_month": j.realized_pnl(now - 30 * DAY),
        "total_return": (te / cap.initial - 1) if cap else None,
        "max_dd": max_drawdown_pct([cap.initial] + [r["total_equity"] for r in ledger]) if cap else None,
        "current_dd": max(0.0, 1 - te / cap.high_water_mark) if cap and cap.high_water_mark else None,
        "trades": st["trades"], "win_rate": st["win_rate"], "profit_factor": st["profit_factor"],
        "sharpe": sharpe, "sortino": sortino, "expectancy": st["expectancy"],
        "avg_r": sum(rs) / len(rs) if rs else None, "fees": st["fees"], "funding": st["funding"],
        "slippage": st["slippage"], "strategies": strats, "regimes": regimes, "matrix": matrix,
        "halts": [{"id": h["id"], "kind": h["kind"], "reason": h["reason"]} for h in j.active_halts()],
        "failures": sorted(FailureMonitor(j).active()), "ladder": j.get("ladder_level", "NORMAL"),
    }


def _m(v, g, pct=False, nd=2) -> str:
    if v is None:
        return "n/a"
    if isinstance(v, float) and math.isinf(v):
        return "∞"
    if pct:
        return f"{v:+.2%}" if v else "0.00%"
    if g:
        return f"£{v * g:,.{nd}f} ({v:,.4f} USDT)"
    return f"{v:,.4f} USDT"


def _f(v, nd=2) -> str:
    if v is None:
        return "n/a"
    if isinstance(v, float) and math.isinf(v):
        return "∞"
    return f"{v:.{nd}f}" if isinstance(v, (int, float)) else str(v)


def rows(d: dict) -> list[tuple[str, str]]:
    g = d["gbp_per_usdt"]
    return [
        ("TRADING CAPITAL", _m(d["trading_capital"], g)), ("PROFIT RESERVE", _m(d["profit_reserve"], g)),
        ("TOTAL EQUITY", _m(d["total_equity"], g)), ("HIGH-WATER MARK", _m(d["hwm"], g)),
        ("NEXT MILESTONE", f"£{d['next_milestone_gbp']:,}" if d["next_milestone_gbp"] else "n/a"),
        ("REALISED P&L", _m(d["realised"], g)), ("UNREALISED P&L", _m(d["unrealised"], g)),
        ("P&L TODAY / 7D / 30D", " | ".join(_m(d[k], g) for k in ("pnl_day", "pnl_week", "pnl_month"))),
        ("TOTAL RETURN", _m(d["total_return"], g, pct=True)), ("MAX DRAWDOWN", _f(d["max_dd"] and d["max_dd"] * 100) + "%"),
        ("CURRENT DD FROM HWM", _f(d["current_dd"] and d["current_dd"] * 100) + f"%  (ladder {d['ladder']})"),
        ("TRADES / WIN RATE", f"{d['trades']} / {_f(d['win_rate'] and d['win_rate'] * 100, 1)}%"),
        ("PROFIT FACTOR", _f(d["profit_factor"])), ("SHARPE / SORTINO (per trade)",
                                                     f"{_f(d['sharpe'])} / {_f(d['sortino'])}"),
        ("EXPECTANCY", _m(d["expectancy"], g)), ("AVG R", _f(d["avg_r"])),
        ("FEES / FUNDING / SLIPPAGE", " | ".join(_m(d[k], g) for k in ("fees", "funding", "slippage"))),
    ]


def render_text(d: dict) -> str:
    out = [f"bfx DASHBOARD [{d['mode']}]  {d['generated']}"]
    if d["capital_error"]:
        out.append(f"!! CAPITAL STATE CORRUPT: {d['capital_error']}")
    out += [f"{k:<30} {v}" for k, v in rows(d)]
    out.append("\nSTRATEGIES")
    for x in d["strategies"]:
        out.append(f"  {x['id']:<26} {'enabled ' if x['enabled'] else 'disabled'} {x['timeframe']:<4} "
                   f"health {x['health']}{' PAUSED' if x['paused'] else ''}  robustness {_f(x['robustness'], 1)}  "
                   f"LIVE_ELIGIBLE {'YES' if x['live_eligible'] else 'NO'}"
                   + (f"  disabled regimes {x['disabled_regimes']}" if x["disabled_regimes"] else ""))
    out.append("\nREGIME PER INSTRUMENT  " + (", ".join(f"{k}: {v}" for k, v in d["regimes"].items()) or "no bars yet"))
    out.append("\nSTRATEGY x REGIME")
    for k, v in d["matrix"].items():
        out.append(f"  {k:<44} n={v['trades']:<4} PF {_f(v['profit_factor'])}  E(R) {_f(v['expectancy_r'])}  "
                   f"win {_f(v['win_rate'] and v['win_rate'] * 100, 1)}%")
    if not d["matrix"]:
        out.append("  no closed trades yet")
    out.append(f"\nHALTS     {[(h['id'], h['kind']) for h in d['halts']] or 'none'}")
    out.append(f"FAILURES  {d['failures'] or 'none'}")
    return "\n".join(out)


CSS = """
:root{--bg:#f7f7f5;--fg:#1d1d1f;--muted:#6b6b70;--card:#fff;--line:#e3e3e0;--ok:#1a7f37;--warn:#b25d00;--bad:#c62828}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#ececee;--muted:#9a9aa2;--card:#1c1c20;--line:#2c2c32;
--ok:#4cc26b;--warn:#f0a03c;--bad:#ff6b6b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,
BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:16px}main{max-width:1100px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.muted{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.k{font-size:11px;letter-spacing:.04em;color:var(--muted);text-transform:uppercase}.v{font-size:15px;margin-top:2px;
font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);
border-radius:10px}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-size:11px;text-transform:uppercase;color:var(--muted)}.ok{color:var(--ok)}.warn{color:var(--warn)}
.bad{color:var(--bad)}
"""


def render_html(d: dict) -> str:
    e = html.escape
    cls = {"HEALTHY": "ok", "WATCH": "warn", "DEGRADED": "bad", "DISABLED": "bad"}
    cards = "".join(f'<div class="card"><div class="k">{e(k)}</div><div class="v">{e(v)}</div></div>'
                    for k, v in rows(d))
    srows = "".join(
        f"<tr><td>{e(x['id'])}</td><td>{'yes' if x['enabled'] else 'no'}</td><td>{e(x['timeframe'])}</td>"
        f"<td class=\"{cls.get(x['health'], '')}\">{e(x['health'])}{' (PAUSED)' if x['paused'] else ''}</td>"
        f"<td>{_f(x['robustness'], 1)}</td><td class=\"{'ok' if x['live_eligible'] else 'bad'}\">"
        f"{'YES' if x['live_eligible'] else 'NO'}</td><td>{e(', '.join(x['disabled_regimes']) or '-')}</td></tr>"
        for x in d["strategies"])
    mrows = "".join(
        f"<tr><td>{e(k)}</td><td>{v['trades']}</td><td>{_f(v['profit_factor'])}</td><td>{_f(v['expectancy_r'])}</td>"
        f"<td>{_f(v['win_rate'] and v['win_rate'] * 100, 1)}%</td></tr>" for k, v in d["matrix"].items()) \
        or '<tr><td colspan="5" class="muted">no closed trades yet</td></tr>'
    reg_rows = "".join(f"<tr><td>{e(k)}</td><td>{e(str(v))}</td></tr>" for k, v in d["regimes"].items()) \
        or '<tr><td colspan="2" class="muted">no bars processed yet</td></tr>'
    alerts = [f"HALT #{h['id']} {h['kind']}: {h['reason']}" for h in d["halts"]] + \
             [f"FAILURE {f}" for f in d["failures"]]
    if d["capital_error"]:
        alerts.insert(0, f"CAPITAL STATE CORRUPT: {d['capital_error']}")
    alert_html = "".join(f'<div class="card bad">{e(a)}</div>' for a in alerts) or \
        '<div class="card ok">No active halts or failure flags</div>'
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>bfx dashboard</title><style>{CSS}</style></head><body><main>
<h1>bfx dashboard <span class="muted">[{e(d['mode'])}]</span></h1><div class="muted">{e(d['generated'])}</div>
<h2>Alerts</h2><div class="grid">{alert_html}</div>
<h2>Capital &amp; performance</h2><div class="grid">{cards}</div>
<h2>Strategies</h2><div class="tbl"><table><tr><th>Strategy</th><th>Enabled</th><th>TF</th><th>Health</th>
<th>Robustness</th><th>LIVE_ELIGIBLE</th><th>Disabled regimes</th></tr>{srows}</table></div>
<h2>Regime per instrument</h2><div class="tbl"><table><tr><th>Instrument</th><th>Regime</th></tr>{reg_rows}</table></div>
<h2>Strategy × regime</h2><div class="tbl"><table><tr><th>Strategy | regime</th><th>Trades</th><th>PF</th>
<th>Expectancy R</th><th>Win rate</th></tr>{mrows}</table></div>
</main></body></html>
"""

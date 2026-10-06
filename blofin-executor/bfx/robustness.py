"""ROBUSTNESS SCORE (0-100) from a strategy's research record + its demo (PAPER) results.

Weights: OOS 30, walk-forward consistency 20, demo performance 15, drawdown 10, profit factor 10,
Sharpe/Sortino 5, parameter stability 5, execution-cost resilience 5. Each component is normalised to 0..1:
  oos            mean over symbols of clamp((PF-1)/0.5) (0 if net <= 0) x sample factor clamp(min trades/30)
  walk_forward   share of folds with PF > 1 and net > 0
  demo           clamp((PF-1)/0.5) x clamp(n/20); 0 if demo expectancy <= 0 or no demo trades
  drawdown       worst of OOS per-symbol DD% and demo DD%: 1 at <= 10%, 0 at >= 40%, linear between
  profit_factor  clamp(mean OOS PF - 1) (PF 2.0 -> full marks)
  sharpe_sortino mean of clamp(Sharpe/2) and clamp(Sortino/3) over the available values
  param_stability the research 0..1 score as given
  cost_resilience clamp((PF at 2x costs - 1)/0.3)
Unknown (null/missing) inputs score 0 and are listed in `flags`, so missing research can only lower the score.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

WEIGHTS = {"oos": 30, "walk_forward": 20, "demo": 15, "drawdown": 10, "profit_factor": 10,
           "sharpe_sortino": 5, "param_stability": 5, "cost_resilience": 5}


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


@dataclass
class RobustnessReport:
    strategy_id: str
    score: float
    components: dict = field(default_factory=dict)   # name -> (normalised 0..1, weight, points)
    flags: list = field(default_factory=list)


def load_research(path: Path) -> tuple[dict, str | None]:
    try:
        data = json.loads(Path(path).read_text())
        if not isinstance(data, dict):
            raise ValueError("top level must be an object")
        return data, None
    except (OSError, ValueError) as e:
        return {}, f"research file unreadable: {e}"


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def score(strategy_id: str, rec: dict | None, demo: dict | None) -> RobustnessReport:
    """`demo` = {trades, profit_factor, expectancy, max_dd_pct} from the PAPER journal (fractions for DD)."""
    rec, demo, flags = rec or {}, demo or {}, []
    if not rec:
        flags.append("no research record")
    oos = rec.get("oos") or {}
    raw: dict[str, float] = {}

    per, pfs, dds, ratios = [], [], [], []
    for sym, r in oos.items():
        pf, net, dd = _num(r.get("pf")), _num(r.get("net_pct")), _num(r.get("dd_pct"))
        if pf is None or net is None:
            flags.append(f"OOS {sym}: pf/net unknown")
            per.append(0.0)
            continue
        pfs.append(pf)
        per.append(clamp((pf - 1) / 0.5) if net > 0 else 0.0)
        if dd is not None:
            dds.append(dd)
        sh, so = _num(r.get("sharpe")), _num(r.get("sortino"))
        if sh is not None:
            ratios.append(clamp(sh / 2))
        if so is not None:
            ratios.append(clamp(so / 3))
    counts = [_num(r.get("trades")) for r in oos.values()]
    if counts and all(c is not None for c in counts):
        n_min = min(counts)
    else:
        rng = rec.get("oos_trades_per_pair") or []
        n_min = _num(rng[0]) if rng else None
    if n_min is None:
        flags.append("OOS trade counts unknown: sample factor 0")
    raw["oos"] = (sum(per) / len(per) if per else 0.0) * (clamp(n_min / 30) if n_min else 0.0)
    if not oos:
        flags.append("no OOS results")

    folds = rec.get("walk_forward")
    if isinstance(folds, list) and folds:
        # PF > 1 iff net > 0, so a fold with only net_pct recorded is judged on net alone
        good = sum(1 for f in folds if (_num(f.get("net_pct")) or 0) > 0
                   and (_num(f.get("pf")) is None or _num(f.get("pf")) > 1))
        raw["walk_forward"] = good / len(folds)
    else:
        raw["walk_forward"] = 0.0
        flags.append("walk-forward unknown")

    n, pf, exp = demo.get("trades") or 0, demo.get("profit_factor"), demo.get("expectancy")
    if not n:
        raw["demo"] = 0.0
        flags.append("no demo trades yet")
    elif exp is None or exp <= 0 or pf is None:
        raw["demo"] = 0.0
    else:
        raw["demo"] = clamp((min(pf, 99) - 1) / 0.5) * clamp(n / 20)

    if demo.get("max_dd_pct") is not None and n:
        dds.append(demo["max_dd_pct"] * 100)
    if dds:
        raw["drawdown"] = clamp((40 - max(dds)) / 30)
    else:
        raw["drawdown"] = 0.0
        flags.append("drawdown unknown")

    raw["profit_factor"] = clamp(sum(pfs) / len(pfs) - 1) if pfs else 0.0
    raw["sharpe_sortino"] = sum(ratios) / len(ratios) if ratios else 0.0
    if not ratios:
        flags.append("Sharpe/Sortino unknown")

    stab = _num(rec.get("param_stability"))
    raw["param_stability"] = clamp(stab) if stab is not None else 0.0
    if stab is None:
        flags.append("parameter stability unknown")

    cs = rec.get("cost_stress")
    pf2 = _num(cs.get("pf_at_2x_costs")) if isinstance(cs, dict) else None
    raw["cost_resilience"] = clamp((pf2 - 1) / 0.3) if pf2 is not None else 0.0
    if pf2 is None:
        flags.append("cost-stress unknown")

    comps = {k: (round(raw[k], 4), w, round(raw[k] * w, 2)) for k, w in WEIGHTS.items()}
    return RobustnessReport(strategy_id, round(sum(c[2] for c in comps.values()), 1), comps, flags)

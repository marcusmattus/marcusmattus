"""Order lifecycle: preflight -> reconcile -> breakers -> per-bar signal handling -> protected entries/exits.

Invariants:
  * PAPER talks only to the demo host; LIVE needs the typed arming phrase AND the PAPER eligibility gate.
  * Every filled entry gets an exchange-side stop, verified by reading it back. If that fails twice the
    position is closed and ORDER_PROTECTION_FAILURE is recorded (never a naked position).
  * Stops only ever move in the trade's favour. No averaging down, no pyramiding, no martingale.
  * Never assume a fill: sizes and prices come from order-detail / positions / fills-history.
  * Strategies only produce signals and stop/target levels (bfx.strategies); sizing, protection, ratcheting and
    every gate live here. Sizing uses TRADING_CAPITAL only (bfx.capital), capped by what the exchange holds.
  * Any failure mode (bfx.failsafe), paused strategy, disabled regime or drawdown-ladder block stops NEW
    entries only; open positions always keep their exchange stop, trailing and exits.
"""
from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from decimal import Decimal

from . import STRATEGY_ID
from . import health as hl
from . import strategies as reg
from .capital import CapitalCorrupt, CapitalEngine, next_milestone_gbp
from .client import BlofinClient, BlofinError, TransportError
from .config import BASE_URLS, LIVE_ARM_PHRASE, MODE_LIVE, MODE_PAPER, ROOT, Settings
from .failsafe import (BALANCE_UNVERIFIABLE, EXCHANGE_UNREACHABLE, RECONCILE_MISMATCH, STALE_DATA, STATE_CORRUPT,
                       STOP_PLACEMENT_FAILURE, TELEGRAM_DOWN, FailureMonitor)
from .journal import Journal, now_ms
from .risk import (HALTED, NORMAL, InstrumentSpec, LadderResult, TradePlan, TradeRejected, check_portfolio,
                   drawdown_ladder, effective_risk_pct, evaluate_breakers, fmt, plan_trade, position_open_risk,
                   ratchet, to_step)
from .robustness import load_research, score as robustness_score
from .strategy import BAR_MS, Analysis

TERMINAL_ORDER_STATES = {"filled", "canceled", "partially_canceled", "order_failed"}
LIVE_STOP_STATES = {"live", "effective"}


class SafetyError(Exception):
    pass


@dataclass
class Snapshot:
    exchange_equity: float
    available: float
    positions: dict = field(default_factory=dict)       # instId -> position row (non-zero only)
    pending_orders: list = field(default_factory=list)
    stops: list = field(default_factory=list)
    trading_equity: float = 0.0                          # sizing capital = min(TC, exchange equity - PR)
    unrealized: float = 0.0
    open_risks: dict = field(default_factory=dict)       # instId -> remaining risk to stop
    blocked: set = field(default_factory=set)            # instruments with unmanaged exposure
    trading_capital: float = 0.0
    profit_reserve: float = 0.0
    total_equity: float = 0.0
    hwm: float = 0.0
    mark_equity: float = 0.0                             # TE + bot unrealised, capped by exchange equity
    capped: bool = False                                 # TC exceeded what the exchange holds
    balance_ok: bool = True
    capital_ok: bool = True


def stats(trades) -> dict:
    n = len(trades)
    pnl = [t["pnl"] or 0.0 for t in trades]
    wins = [p for p in pnl if p > 0]
    losses = [p for p in pnl if p <= 0]
    gw, gl = sum(wins), -sum(losses)
    curve, peak, mdd = 0.0, 0.0, 0.0
    for p in pnl:
        curve += p
        peak = max(peak, curve)
        mdd = max(mdd, peak - curve)
    rs = [t["r_multiple"] for t in trades if t["r_multiple"] is not None]
    dur = [(t["exit_ts"] - t["opened_ts"]) / 3_600_000 for t in trades if t["exit_ts"]]
    return {
        "trades": n, "win_rate": len(wins) / n if n else None,
        "profit_factor": (gw / gl if gl > 0 else (float("inf") if gw > 0 else None)),
        "expectancy": sum(pnl) / n if n else None, "expectancy_r": sum(rs) / len(rs) if rs else None,
        "avg_win": gw / len(wins) if wins else None, "avg_loss": -gl / len(losses) if losses else None,
        "net_pnl": sum(pnl), "max_drawdown": mdd,
        "fees": sum((t["entry_fee"] or 0) + (t["exit_fee"] or 0) for t in trades),
        "funding": sum(t["funding"] or 0 for t in trades),
        "slippage": sum(t["slippage"] or 0 for t in trades),
        "avg_duration_h": sum(dur) / len(dur) if dur else None,
    }


def research_pairs(s: Settings, strategy_id: str) -> tuple[set[str], list[str]]:
    """RESEARCH gate: instruments whose local backtest record qualifies, plus the reasons others/all fail.

    Per pair: OOS PF >= gate_min_pf, OOS expectancy > 0, enough OOS trades, OOS drawdown within limit, PF > 1 and
    net > 0 at 2x costs and at 5x slippage, parameter-neighbourhood stability. Whole record: pooled OOS trades and
    age <= gate_max_research_age_days. Anything missing fails (no trade).
    """
    try:
        rec = json.loads((ROOT / s.backtest_path).read_text())
    except (OSError, ValueError) as e:
        return set(), [f"backtest record unreadable: {e}"]
    if rec.get("strategy_id") != strategy_id:
        return set(), [f"backtest record is for {rec.get('strategy_id')!r}, not {strategy_id}"]
    age_d = (now_ms() - (rec.get("generated_at") or 0)) / 86_400_000
    if age_d > s.gate_max_research_age_days:
        return set(), [f"backtest record is {age_d:.0f} days old (> {s.gate_max_research_age_days}): revalidate"]
    ok: set[str] = set()
    reasons: list[str] = []
    for inst in s.instruments:
        d = (rec.get("symbols") or {}).get(inst)
        if not d:
            reasons.append(f"{inst}: no backtest")
            continue
        o, st, nb = d["splits"]["OOS"], d.get("oos_stress") or {}, d.get("param_neighbourhood") or {}
        why = []
        if o["pf"] is None or o["pf"] < s.gate_min_pf:
            why.append(f"OOS PF {o['pf']} < {s.gate_min_pf}")
        if o["expectancy_r"] is None or o["expectancy_r"] <= 0:
            why.append("OOS expectancy not positive")
        if o["trades"] < s.gate_min_oos_trades_pair:
            why.append(f"OOS trades {o['trades']} < {s.gate_min_oos_trades_pair}")
        if o["dd_pct"] > s.gate_max_oos_dd_pct:
            why.append(f"OOS drawdown {o['dd_pct']}% > {s.gate_max_oos_dd_pct}%")
        for k in ("2x_costs", "5x_slippage"):
            x = st.get(k) or {}
            if x.get("pf") is None or x["pf"] <= 1 or x.get("net_pct", 0) <= 0:
                why.append(f"not profitable at {k}")
        if (nb.get("share_profitable") or 0) < s.gate_min_param_stability:
            why.append(f"parameter stability {nb.get('share_profitable')} < {s.gate_min_param_stability}")
        if why:
            reasons.append(f"{inst}: " + "; ".join(why))
        else:
            ok.add(inst)
    pooled = sum(rec["symbols"][i]["splits"]["OOS"]["trades"] for i in ok)
    if ok and pooled < s.gate_min_oos_trades:
        return set(), reasons + [f"pooled OOS trades {pooled} < {s.gate_min_oos_trades}"]
    return ok, reasons


def eligibility(paper: Journal, s: Settings) -> tuple[bool, list[str]]:
    """LIVE promotion gate: PAPER (BloFin Demo) journal, or only its safety checks when gate_source is RESEARCH."""
    reasons = []
    st = stats(paper.closed_trades())
    if s.gate_source == "PAPER":
        if st["trades"] < s.gate_min_trades:
            reasons.append(f"only {st['trades']} closed PAPER trades (< {s.gate_min_trades})")
        if st["profit_factor"] is None or st["profit_factor"] < s.gate_min_pf:
            reasons.append(f"PAPER profit factor {st['profit_factor']} < {s.gate_min_pf}")
        if st["expectancy"] is None or st["expectancy"] <= 0:
            reasons.append("PAPER expectancy not positive after fees/slippage/funding")
    if any(not json.loads(e["detail"]).get("test") for e in paper.events("ORDER_PROTECTION_FAILURE", limit=500)):
        reasons.append("ORDER_PROTECTION_FAILURE recorded in PAPER: investigate before LIVE")
    manual = [h["kind"] for h in paper.active_halts() if h["manual_reset"]]
    if manual:
        reasons.append(f"unresolved PAPER halts: {manual}")
    return (not reasons), reasons


def demo_stats(paper: Journal, strategy_id: str, s: Settings) -> dict:
    trades = paper.closed_trades(strategy_id=strategy_id)
    st = stats(trades)
    base = hl.capital_base(paper, s)
    st["max_dd_pct"] = st["max_drawdown"] / base if trades and base > 0 else None
    return st


def strategy_eligibility(paper: Journal, s: Settings, strategy, research: dict | None = None,
                         research_error: str | None = None) -> tuple[bool, list[str], object]:
    """LIVE_ELIGIBLE for one strategy: the PAPER gate on THAT strategy's trades + robustness score + HEALTHY."""
    reasons = []
    st = demo_stats(paper, strategy.id, s)
    research_gate = s.gate_source == "RESEARCH"
    if research_gate:
        pairs, why = research_pairs(s, strategy.id)
        if not pairs:
            reasons.append("no instrument passes the research gate")
        reasons.extend(why)
    else:
        if st["trades"] < s.gate_min_trades:
            reasons.append(f"only {st['trades']} closed PAPER trades for {strategy.id} (< {s.gate_min_trades})")
        if st["profit_factor"] is None or st["profit_factor"] < s.gate_min_pf:
            reasons.append(f"PAPER profit factor {st['profit_factor']} < {s.gate_min_pf}")
        if st["expectancy"] is None or st["expectancy"] <= 0:
            reasons.append("PAPER expectancy not positive after fees/slippage/funding")
    if any(not json.loads(e["detail"]).get("test") for e in paper.events("ORDER_PROTECTION_FAILURE", limit=500)):
        reasons.append("ORDER_PROTECTION_FAILURE recorded in PAPER: investigate before LIVE")
    manual = [h["kind"] for h in paper.active_halts() if h["manual_reset"]]
    if manual:
        reasons.append(f"unresolved PAPER halts: {manual}")
    if research is None:
        research, research_error = load_research(ROOT / s.research_path)
    if research_error:
        reasons.append(research_error)
    rep = robustness_score(strategy.id, research.get(strategy.id), st)
    if rep.score < s.robustness_threshold and not research_gate:   # RESEARCH gate replaces the demo-based score
        reasons.append(f"robustness score {rep.score} < {s.robustness_threshold}")
    status, paused = hl.status(paper, strategy.id)
    if status != hl.HEALTHY or paused:
        reasons.append(f"PAPER health {status}{' (paused)' if paused else ''}: must be HEALTHY")
    return (not reasons), reasons, rep


class Executor:
    def __init__(self, client: BlofinClient, s: Settings, journal: Journal, paper_journal: Journal | None = None,
                 clock=now_ms, sleep=time.sleep):
        self.c, self.s, self.j = client, s, journal
        self.paper_j = paper_journal or journal
        self.clock, self.sleep = clock, sleep
        self._specs: dict[str, InstrumentSpec] = {}
        self.strategies = reg.enabled(s)
        self.capital = CapitalEngine(journal, s)
        self.fail = FailureMonitor(journal)
        self._ladder = LadderResult(NORMAL, 0.0, 1.0, False, False)
        self._stop_fail_cycle = False
        self._live_ok: dict = {}

    # ================================================================ safety
    def assert_mode_safe(self) -> None:
        expected = BASE_URLS[self.s.mode]
        if self.c.base_url != expected:
            raise SafetyError(f"{self.s.mode} must use {expected}, client points at {self.c.base_url}")
        if self.j.mode != self.s.mode:
            raise SafetyError("journal mode does not match settings mode")
        if self.s.mode == MODE_LIVE:
            armed = self.s.state_dir / "LIVE_ARMED"
            if not armed.exists() or LIVE_ARM_PHRASE not in armed.read_text():
                raise SafetyError(f"LIVE not armed: run `python3 -m bfx arm-live` and type: {LIVE_ARM_PHRASE}")
            ok, reasons = eligibility(self.paper_j, self.s)
            if not ok:
                raise SafetyError("strategy not LIVE-eligible: " + "; ".join(reasons))

    def spec(self, inst_id: str) -> InstrumentSpec:
        if inst_id not in self._specs:
            self._specs[inst_id] = InstrumentSpec.from_api(self.c.instrument(inst_id),
                                                           self.c.position_tiers(inst_id, self.s.margin_mode))
        return self._specs[inst_id]

    def preflight(self) -> dict:
        self.assert_mode_safe()
        report: dict = {"mode": self.s.mode, "host": self.c.base_url}
        key = self.c.query_apikey()
        if int(key.get("readOnly", 1)) != 0:
            raise SafetyError("API key is read-only; it needs READ + TRADE (never transfer/withdraw)")
        report["sub_account"] = str(key.get("parentUid", "0")) not in ("0", "")
        report["ip_bound"] = bool(key.get("ips"))
        pm = self.c.position_mode()
        if pm.get("positionMode") != "net_mode" or str(pm.get("multiPosition", "false")).lower() == "true":
            raise SafetyError(f"account position mode is {pm}; set One-way (net_mode), Multi-Position off, "
                              "in BloFin before running the bot")
        snap = self.snapshot()
        report.update(exchange_equity=snap.exchange_equity, available=snap.available,
                      trading_equity=snap.trading_equity, open_positions=list(snap.positions),
                      pending_orders=len(snap.pending_orders), stops=len(snap.stops),
                      blocked=sorted(snap.blocked), unrealized=snap.unrealized,
                      allocation=self.s.trading_equity_usdt, trading_capital=snap.trading_capital,
                      profit_reserve=snap.profit_reserve, total_equity=snap.total_equity, hwm=snap.hwm,
                      strategies=[x.id for x in self.strategies])
        if snap.capped:
            report["warning"] = "TRADING_CAPITAL exceeds exchange equity minus PROFIT_RESERVE; sizing capped"
        self.j.event("PREFLIGHT", None, **report)
        return report

    # ================================================================ state
    def snapshot(self) -> Snapshot:
        bal = self.c.balance()
        usdt = next((d for d in bal.get("details", []) if d.get("currency") == "USDT"), {})
        raw_eq = usdt.get("equity") or bal.get("totalEquity")
        try:
            ex_eq = float(raw_eq)
            balance_ok = math.isfinite(ex_eq) and ex_eq >= 0
            avail = float(usdt.get("available") or 0)
        except (TypeError, ValueError):
            ex_eq, avail, balance_ok = 0.0, 0.0, False
        if not balance_ok:
            ex_eq = 0.0
        positions = {p["instId"]: p for p in self.c.positions() if float(p.get("positions") or 0) != 0}
        snap = Snapshot(ex_eq, avail, positions, self.c.orders_pending(), self.c.tpsl_pending())
        snap.balance_ok = balance_ok
        bot = {t["inst_id"]: t for t in self.j.open_trades()}
        snap.unrealized = sum(float(p.get("unrealizedPnl") or 0) for i, p in positions.items() if i in bot)
        try:
            cap = self.capital.state()
            snap.trading_capital, snap.profit_reserve = cap.trading_capital, cap.profit_reserve
            snap.total_equity, snap.hwm = cap.total_equity, cap.high_water_mark
            snap.trading_equity, snap.capped = self.capital.sizing_capital(ex_eq)
        except CapitalCorrupt:
            snap.capital_ok = False   # sizes nothing; STATE_CORRUPT blocks entries
            snap.total_equity = snap.hwm = self.s.trading_equity_usdt
        if not balance_ok:
            snap.trading_equity = 0.0
        te_mtm = snap.total_equity + snap.unrealized
        snap.mark_equity = min(te_mtm, ex_eq) if balance_ok else te_mtm
        for i, t in bot.items():
            snap.open_risks[i] = position_open_risk(t["direction"], t["entry_fill"], t["stop_current"],
                                                    float(t["size"]), t["contract_value"])
        snap.blocked = {i for i in positions if i not in bot}
        return snap

    # ================================================================ protection
    def _find_stop(self, inst_id: str, tpsl_id: str | None = None, client_id: str | None = None) -> dict | None:
        for o in self.c.tpsl_pending(inst_id):
            if (tpsl_id and o.get("tpslId") == tpsl_id) or (client_id and o.get("clientOrderId") == client_id):
                if o.get("state") in LIVE_STOP_STATES:
                    return o
        return None

    def _verify_stop(self, inst_id: str, tpsl_id: str, trigger: Decimal) -> bool:
        tick = self.spec(inst_id).tick_size
        for _ in range(3):
            o = self._find_stop(inst_id, tpsl_id=tpsl_id)
            if o and abs(Decimal(o["slTriggerPrice"]) - trigger) <= tick:
                return True
            self.sleep(0.5)
        return False

    def ensure_protection(self, trade_id: int, inst_id: str, close_side: str, size: Decimal, trigger: Decimal,
                          test: bool = False) -> str | None:
        """Place + verify the exchange stop; retry once; else flatten and record ORDER_PROTECTION_FAILURE."""
        for attempt in (1, 2):
            cid = f"sl{trade_id}a{attempt}t{self.clock() % 10**8}"
            try:
                r = self.c.place_stop(inst_id=inst_id, close_side=close_side, size=fmt(size), trigger=fmt(trigger),
                                      margin_mode=self.s.margin_mode, client_order_id=cid)
                tid = r.get("tpslId")
            except TransportError as e:
                found = self._find_stop(inst_id, client_id=cid)
                tid = found.get("tpslId") if found else None
                if not tid:
                    self.j.event("STOP_PLACE_FAILED", inst_id, trade_id=trade_id, attempt=attempt, error=str(e))
                    continue
            except BlofinError as e:
                self.j.event("STOP_PLACE_FAILED", inst_id, trade_id=trade_id, attempt=attempt, error=str(e))
                continue
            if tid and self._verify_stop(inst_id, tid, trigger):
                self.j.event("STOP_VERIFIED", inst_id, trade_id=trade_id, tpsl_id=tid, trigger=fmt(trigger))
                return tid
            self.j.event("STOP_UNVERIFIED", inst_id, trade_id=trade_id, tpsl_id=tid, attempt=attempt)
        self.j.event("ORDER_PROTECTION_FAILURE", inst_id, trade_id=trade_id, trigger=fmt(trigger), test=test)
        if not test:
            self._stop_fail_cycle = True
            self.fail.update(STOP_PLACEMENT_FAILURE, True, inst=inst_id, trade_id=trade_id)
        self.close_trade(trade_id, "ORDER_PROTECTION_FAILURE: stop could not be established")
        if not test:
            self.j.add_halt("ORDER_PROTECTION_FAILURE", f"{inst_id} trade {trade_id}", manual_reset=True)
        return None

    # ================================================================ entries
    def _reject(self, a: Analysis, reason: str, **kw) -> None:
        self.j.event("SIGNAL_REJECTED", a.inst_id, reason=reason, bar_ts=a.bar_ts, regime=a.regime,
                     strategy=a.strategy_id, **kw)

    @staticmethod
    def _attempt_key(strat, inst: str, bar_ts: int) -> str:
        return f"attempt:{inst}:{bar_ts}" if strat.id == STRATEGY_ID else f"attempt:{strat.id}:{inst}:{bar_ts}"

    @staticmethod
    def _bar_key(strat, inst: str) -> str:
        return f"last_bar:{inst}" if strat.id == STRATEGY_ID else f"last_bar:{strat.id}:{inst}"

    def live_eligible(self, strat) -> tuple[bool, list[str]]:
        if strat.id not in self._live_ok:
            hj = self.j if self.s.gate_source == "RESEARCH" else self.paper_j
            ok, reasons, _ = strategy_eligibility(hj, self.s, strat)
            self._live_ok[strat.id] = (ok, reasons)
        return self._live_ok[strat.id]

    def try_entry(self, a: Analysis, snap: Snapshot, halts: list, risk_mult: float) -> int | None:
        inst, s = a.inst_id, self.s
        strat = reg.get(a.strategy_id)
        if strat is None:
            return self._reject(a, f"unknown strategy {a.strategy_id}")
        if halts:
            return self._reject(a, "circuit breaker active", halts=[h["kind"] for h in halts])
        failures = self.fail.blocking(inst)
        if failures:
            return self._reject(a, "failure mode active: no new entries", failures=failures)
        if self._ladder.block_new:
            return self._reject(a, f"drawdown ladder {self._ladder.level} ({self._ladder.drawdown:.2%} from HWM): "
                                   "no new positions")
        status, paused = hl.status(self.j, strat.id)
        if paused:
            return self._reject(a, f"strategy paused (health {status}): manual resume required")
        if a.direction not in strat.directions or (a.direction < 0 and not s.allow_shorts):
            return self._reject(a, f"direction {a.direction} not allowed for {strat.id}")
        if not strat.allows_regime(a.regime):
            return self._reject(a, f"regime {a.regime} not validated for {strat.id}")
        if hl.regime_disabled(self.j, strat.id, a.regime):
            return self._reject(a, f"regime {a.regime} auto-disabled for {strat.id}: manual re-enable required")
        if s.mode == MODE_LIVE:
            ok, why = self.live_eligible(strat)
            if not ok:
                return self._reject(a, f"{strat.id} not LIVE_ELIGIBLE", reasons=why)
            if s.gate_source == "RESEARCH" and inst not in research_pairs(s, strat.id)[0]:
                return self._reject(a, f"{inst} does not pass the research gate for {strat.id}")
        if self.clock() - a.bar_close_ts > s.max_signal_age_min * 60_000:
            return self._reject(a, "signal is stale")
        if inst in snap.blocked:
            return self._reject(a, "unmanaged exposure on instrument")
        if inst in snap.positions or any(t["inst_id"] == inst for t in self.j.open_trades()):
            return self._reject(a, "already in a position (no pyramiding / averaging)")
        if any(o.get("instId") == inst for o in snap.pending_orders):
            return self._reject(a, "existing pending order on instrument")
        if self.j.get(self._attempt_key(strat, inst, a.bar_ts)):
            return self._reject(a, "entry already attempted for this bar")
        tk = self.c.ticker(inst)
        bid, ask = float(tk["bidPrice"]), float(tk["askPrice"])
        spread = (ask - bid) / ((ask + bid) / 2)
        if spread > s.max_spread_pct:
            return self._reject(a, f"spread {spread:.4%} > {s.max_spread_pct:.4%}")
        px = ask if a.direction > 0 else bid
        drift = (px - a.close) * a.direction
        if drift > s.max_entry_drift_atr * a.atr:
            return self._reject(a, f"NO FOMO: price {px} ran {drift:.4f} past signal close {a.close}")
        spec = self.spec(inst)
        risk_pct = effective_risk_pct(s, risk_mult)   # TC x risk%; multipliers only ever reduce it
        try:
            plan = plan_trade(spec, a.direction, px, strat.initial_stop(a, s), snap.trading_equity, risk_pct, s)
        except TradeRejected as e:
            return self._reject(a, str(e), equity=snap.trading_equity, risk_pct=risk_pct)
        if plan.margin > snap.available:
            return self._reject(a, f"margin {plan.margin:.4f} > available {snap.available:.4f}")
        why = check_portfolio(inst, plan.risk_amount, snap.open_risks, snap.trading_equity, s)
        if why:
            return self._reject(a, why)
        latest = self.c.candles(inst, s.bar, 5)
        if not latest or int(latest[-1][0]) != a.bar_ts:
            return self._reject(a, "signal bar superseded before execution")
        tp = strat.take_profit(a, s)
        self.j.event("ORDER_PLAN", inst, strategy=strat.id, regime=a.regime, entry=plan.entry_ref,
                     stop=fmt(plan.stop), size=fmt(plan.size), leverage=plan.leverage, risk_amount=plan.risk_amount,
                     risk_pct=plan.risk_pct, est_fees=plan.est_fees, est_slippage=plan.est_slippage,
                     est_liq=plan.est_liq, stop_liq_gap=plan.stop_liq_gap, limit=fmt(plan.limit_price),
                     take_profit=tp, trading_capital=snap.trading_capital, sizing_capital=snap.trading_equity,
                     reason=strat.entry_reason(a))
        return self.execute_entry(plan, a.inst_id, a.bar_ts, a.regime, strat.entry_reason(a), strategy=strat,
                                  take_profit=tp)

    def execute_entry(self, plan, inst: str, bar_ts: int, regime: str, reason: str, test: bool = False,
                      strategy=None, take_profit: float | None = None) -> int | None:
        s, spec = self.s, self.spec(plan.inst_id)
        strat = strategy or reg.get(STRATEGY_ID)
        cid = f"{strat.cid_prefix}{inst.split('-')[0]}{bar_ts // 1000}{'t' if test else ''}"[:32]
        self.j.set(self._attempt_key(strat, inst, bar_ts), cid)
        try:
            self.c.set_leverage(inst, plan.leverage, s.margin_mode)
        except (BlofinError, TransportError) as e:
            self.j.event("ORDER_REJECTED", inst, stage="set_leverage", error=str(e), strategy=strat.id)
            return None
        order_id = None
        try:
            order_id = self.c.place_order(inst_id=inst, side=plan.side, order_type="ioc", price=fmt(plan.limit_price),
                                          size=fmt(plan.size), margin_mode=s.margin_mode,
                                          client_order_id=cid)["orderId"]
        except BlofinError as e:
            self.j.event("ORDER_REJECTED", inst, stage="place_order", error=str(e), strategy=strat.id)
            return None
        except TransportError as e:
            self.j.event("ORDER_ACK_UNKNOWN", inst, error=str(e), client_order_id=cid)
        detail = self._await_order(inst, order_id, cid)
        if detail is None:
            self.j.event("ORDER_ACK_MISSING", inst, client_order_id=cid)
            snap_pos = {p["instId"]: p for p in self.c.positions(inst) if float(p.get("positions") or 0)}
            if inst not in snap_pos:
                return None
            detail = {"orderId": order_id, "filledSize": snap_pos[inst]["positions"],
                      "averagePrice": snap_pos[inst]["averagePrice"], "fee": "0", "state": "unknown"}
        self.j.event("ORDER_ACK", inst, order_id=detail.get("orderId"), state=detail.get("state"),
                     filled=detail.get("filledSize"), avg=detail.get("averagePrice"))
        filled = Decimal(detail.get("filledSize") or "0")
        if filled <= 0:
            self.j.event("ENTRY_NOT_FILLED", inst, reason="price beyond IOC slippage cap; not chasing",
                         strategy=strat.id, bar_ts=bar_ts, limit=fmt(plan.limit_price))
            return None
        pos = next((p for p in self.c.positions(inst) if float(p.get("positions") or 0)), None)
        if pos is None:
            self.j.event("POSITION_MISSING_AFTER_FILL", inst, order_id=detail.get("orderId"))
            return None
        size = abs(Decimal(pos["positions"]))
        entry = float(pos["averagePrice"])
        liq = float(pos.get("liquidationPrice") or 0)
        cv = float(spec.contract_value)
        slippage = (entry - plan.entry_ref) * plan.direction * float(size) * cv
        scale = float(size) / float(plan.size)
        risk_amount = plan.risk_amount * scale
        trade_id = self.j.open_trade(
            strategy_id=strat.id, inst_id=inst, direction=plan.direction, regime=regime, signal_bar_ts=bar_ts,
            entry_ref=plan.entry_ref, entry_fill=entry, stop_initial=float(plan.stop), stop_current=float(plan.stop),
            size=fmt(size), contract_value=cv, leverage=plan.leverage, risk_pct=plan.risk_pct * scale,
            risk_amount=risk_amount, entry_order_id=str(detail.get("orderId")), client_order_id=cid,
            entry_fee=abs(float(detail.get("fee") or 0)), slippage=slippage, entry_reason=reason, is_test=int(test),
            timeframe=strat.timeframe, signal_close_ts=bar_ts + BAR_MS.get(strat.timeframe, 0),
            est_fees=plan.est_fees * scale, est_slippage=plan.est_slippage * scale, take_profit=take_profit)
        stop_dist = (entry - float(plan.stop)) * plan.direction
        if liq > 0 and (float(plan.stop) - liq) * plan.direction < s.liq_buffer_stop_frac * stop_dist:
            self.j.event("LIQUIDATION_SAFETY_FAIL", inst, trade_id=trade_id, liq=liq, stop=fmt(plan.stop))
            self.close_trade(trade_id, "liquidation would precede stop")
            return None
        tid = self.ensure_protection(trade_id, inst, plan.close_side, size, plan.stop, test=test)
        if tid:
            self.j.update_trade(trade_id, tpsl_id=tid)
            self.j.event("ENTRY_PROTECTED", inst, trade_id=trade_id, entry=entry, stop=fmt(plan.stop), size=fmt(size),
                         liq=liq, leverage=plan.leverage)
            return trade_id
        return None

    def _await_order(self, inst: str, order_id: str | None, cid: str) -> dict | None:
        for _ in range(20):
            try:
                d = self.c.order_detail(inst, order_id=order_id) if order_id else \
                    self.c.order_detail(inst, client_order_id=cid)
                if d and d.get("state") in TERMINAL_ORDER_STATES:
                    return d
            except BlofinError:
                pass
            self.sleep(0.5)
        if order_id:
            try:
                self.c.cancel_order(inst, order_id)  # cancel any remainder rather than chase
            except (BlofinError, TransportError):
                pass
        return None

    # ================================================================ exits / trailing
    def manage_open(self, t, a: Analysis) -> None:
        strat = reg.get(t["strategy_id"])
        if strat is None:
            self.j.event("STRATEGY_UNKNOWN", t["inst_id"], trade_id=t["id"], strategy=t["strategy_id"],
                         note="exchange stop stays in place; no trailing")
            return
        d = t["direction"]
        if a.exit_signal:
            self.close_trade(t["id"], strat.exit_reason(a), exit_ref=a.close)
            return
        tp = t["take_profit"] if "take_profit" in t.keys() else None
        if tp is not None and (a.close - tp) * d >= 0:
            self.close_trade(t["id"], f"take-profit {tp} reached on bar close", exit_ref=a.close)
            return
        cand = strat.trail_stop(a, self.s)
        if cand is None:
            return
        spec = self.spec(t["inst_id"])
        cur = Decimal(str(t["stop_current"]))
        new = ratchet(d, cur, cand, spec.tick_size)
        if new is None:  # stops only ratchet toward profit
            return
        try:
            self.c.amend_stop(t["inst_id"], t["tpsl_id"], fmt(new))
            ok = self._verify_stop(t["inst_id"], t["tpsl_id"], new)
        except (BlofinError, TransportError) as e:
            self.j.event("TRAIL_AMEND_FAILED", t["inst_id"], trade_id=t["id"], error=str(e))
            ok = False
        if ok:
            self.j.update_trade(t["id"], stop_current=float(new))
            self.j.event("TRAIL_UPDATED", t["inst_id"], trade_id=t["id"], old=fmt(cur), new=fmt(new))
            return
        # amend failed: the old stop may still be live (still protective). Replace it explicitly.
        if t["tpsl_id"] and self._find_stop(t["inst_id"], tpsl_id=t["tpsl_id"]):
            self.j.event("TRAIL_KEPT_OLD_STOP", t["inst_id"], trade_id=t["id"], stop=fmt(cur))
            return
        tid = self.ensure_protection(t["id"], t["inst_id"], "sell" if t["direction"] > 0 else "buy",
                                     Decimal(t["size"]), new, test=bool(t["is_test"]))
        if tid:
            self.j.update_trade(t["id"], tpsl_id=tid, stop_current=float(new))

    def close_trade(self, trade_id: int, reason: str, exit_ref: float | None = None) -> bool:
        t = self.j.trade(trade_id)
        inst = t["inst_id"]
        try:
            self.c.close_position(inst, self.s.margin_mode, "net", client_order_id=f"x{trade_id}t{self.clock() % 10**8}")
        except (BlofinError, TransportError) as e:
            self.j.event("CLOSE_REQUEST_ERROR", inst, trade_id=trade_id, error=str(e))
        flat = False
        for _ in range(20):
            if not any(float(p.get("positions") or 0) for p in self.c.positions(inst)):
                flat = True
                break
            self.sleep(0.5)
        self._cancel_own_stops(t)
        if not flat:
            self.j.event("CLOSE_FAILED", inst, trade_id=trade_id, reason=reason)
            self.j.add_halt("CLOSE_FAILED", f"{inst} trade {trade_id} could not be flattened", manual_reset=True)
            return False
        self.finalize_closed(t, reason, exit_ref)
        return True

    def _cancel_own_stops(self, t) -> None:
        """Cancel only stops this trade created (tracked id or our sl<trade_id>a* client ids)."""
        for o in self.c.tpsl_pending(t["inst_id"]):
            mine = o.get("tpslId") == t["tpsl_id"] or str(o.get("clientOrderId") or "").startswith(f"sl{t['id']}a")
            if mine and o.get("state") in LIVE_STOP_STATES:
                try:
                    self.c.cancel_stop(t["inst_id"], o["tpslId"])
                except (BlofinError, TransportError) as e:
                    self.j.event("STOP_CANCEL_FAILED", t["inst_id"], tpsl_id=o.get("tpslId"), error=str(e))

    def finalize_closed(self, t, reason: str, exit_ref: float | None = None) -> None:
        inst, d = t["inst_id"], t["direction"]
        close_side = "sell" if d > 0 else "buy"
        fills = [f for f in self.c.fills_history(inst)
                 if int(f.get("ts", 0)) >= t["opened_ts"] - 5_000 and f.get("side") == close_side]
        qty = sum(float(f["fillSize"]) for f in fills)
        exit_px = sum(float(f["fillPrice"]) * float(f["fillSize"]) for f in fills) / qty if qty else None
        exit_fee = sum(abs(float(f.get("fee") or 0)) for f in fills)
        funding = 0.0
        try:
            funding = sum(float(x.get("fundingFee") or 0)
                          for x in self.c.funding_fees(inst, t["opened_ts"], self.clock()))
        except (BlofinError, TransportError):
            pass
        pnl = None
        if exit_px is not None:
            pnl = (exit_px - t["entry_fill"]) * d * float(t["size"]) * t["contract_value"] \
                - (t["entry_fee"] or 0) - exit_fee + funding
        r = pnl / t["risk_amount"] if pnl is not None and t["risk_amount"] else None
        qty = float(t["size"]) * t["contract_value"]
        exit_slip = (exit_ref - exit_px) * d * qty if exit_ref is not None and exit_px is not None else 0.0
        slippage = (t["slippage"] or 0.0) + exit_slip
        self.j.update_trade(t["id"], status="CLOSED", exit_ts=self.clock(), exit_fill=exit_px, exit_fee=exit_fee,
                            funding=funding, pnl=pnl if pnl is not None else 0.0, r_multiple=r, exit_reason=reason,
                            exit_ref=exit_ref, slippage=slippage)
        test = bool(t["is_test"])
        fb = self._record_feedback(t, exit_px, exit_ref, exit_fee, funding, slippage, pnl, r, reason)
        if test:
            self.j.event("TRADE_CLOSED", inst, trade_id=t["id"], exit=exit_px, pnl=pnl, r=r, reason=reason,
                         fills_found=len(fills), test=True)
            return
        if pnl is None:
            self.j.event("PNL_UNVERIFIED", inst, trade_id=t["id"], note="no closing fills found; capital not adjusted")
        upd = None
        try:
            upd = self.capital.apply_close(t["id"], t["strategy_id"], pnl or 0.0)
        except CapitalCorrupt as e:
            self.fail.update(STATE_CORRUPT, True, error=str(e)[:300])
        strat = reg.get(t["strategy_id"])
        if strat:
            hl.review(self.j, self.s, strat)
        status, paused = hl.status(self.j, t["strategy_id"])
        cap = upd.after if upd else None
        capf = dict(trading_capital=cap.trading_capital, profit_reserve=cap.profit_reserve,
                    total_equity=cap.total_equity,
                    next_milestone_gbp=next_milestone_gbp(cap.total_equity, self.s.gbp_per_usdt)) if cap else {}
        self.j.event("TRADE_CLOSED", inst, trade_id=t["id"], exit=exit_px, pnl=pnl, r=r, reason=reason,
                     fills_found=len(fills), feedback=True, strategy=t["strategy_id"], regime=t["regime"],
                     result=fb["result"], expected_r=fb["expected_r"], slippage=slippage, fees=fb["actual_fee"],
                     funding=funding, health=status + (" (PAUSED)" if paused else ""), **capf)
        if upd and upd.locked > 0:
            self.j.event("PROFIT_LOCKED", None, trade_id=t["id"], net_pnl=upd.net_pnl, locked=upd.locked,
                         compounded=upd.compounded, lock_pct=self.s.profit_lock_pct, **capf)
        for m in (upd.milestones if upd else ()):
            self.j.event("CAPITAL_MILESTONE", None, milestone_gbp=m, net_realized=cap.total_equity - cap.initial,
                         max_dd_pct=self.capital.max_drawdown_pct(),
                         profit_factor=stats(self.j.closed_trades())["profit_factor"], **capf)
        hl.check_regimes(self.j, self.s, t["strategy_id"])

    def _record_feedback(self, t, exit_px, exit_ref, exit_fee, funding, slippage, pnl, r, reason) -> dict:
        d = t["direction"]
        qty = float(t["size"]) * t["contract_value"]
        keys = t.keys()
        est_fees = t["est_fees"] if "est_fees" in keys else None
        expected_r = None
        if exit_ref is not None and t["risk_amount"]:
            expected_r = ((exit_ref - t["entry_ref"]) * d * qty - (est_fees or 0.0)) / t["risk_amount"]
        if r is None:
            result = "UNKNOWN"
        elif abs(r) < self.s.breakeven_r:
            result = "BE"
        else:
            result = "WIN" if r > 0 else "LOSS"
        sct = t["signal_close_ts"] if "signal_close_ts" in keys else None
        fb = dict(strategy_id=t["strategy_id"], trade_id=t["id"], symbol=t["inst_id"],
                  timeframe=(t["timeframe"] if "timeframe" in keys else None) or self.s.bar, regime=t["regime"],
                  signal_time=sct, expected_entry=t["entry_ref"], actual_entry=t["entry_fill"], expected_exit=exit_ref,
                  actual_exit=exit_px, expected_slippage=t["est_slippage"] if "est_slippage" in keys else None,
                  actual_slippage=slippage, expected_r=expected_r, actual_r=r, expected_fee=est_fees,
                  actual_fee=(t["entry_fee"] or 0.0) + (exit_fee or 0.0), funding=funding,
                  latency_ms=(t["opened_ts"] - sct) if sct else None, result=result, reason_for_exit=reason,
                  notional=abs(t["entry_fill"] * qty), pnl=pnl, is_test=int(t["is_test"] or 0))
        self.j.add_feedback(**fb)
        return fb

    # ================================================================ reconcile
    def reconcile(self, snap: Snapshot) -> list[str]:
        """Sync journal with exchange; returns mismatches (each one blocks new entries until it clears)."""
        issues = []
        for t in self.j.open_trades():
            inst = t["inst_id"]
            pos = snap.positions.get(inst)
            if pos is None:
                self._cancel_own_stops(t)
                self.finalize_closed(t, "position closed on exchange (stop hit / external)", t["stop_current"])
                continue
            if abs(Decimal(pos["positions"])) != Decimal(t["size"]):
                issues.append(f"{inst} size journal={t['size']} exchange={pos['positions']}")
                self.j.event("RECONCILE_SIZE_MISMATCH", inst, trade_id=t["id"], journal=t["size"],
                             exchange=pos["positions"])
            if not (t["tpsl_id"] and self._find_stop(inst, tpsl_id=t["tpsl_id"])):
                self.j.event("STOP_MISSING", inst, trade_id=t["id"])
                tid = self.ensure_protection(t["id"], inst, "sell" if t["direction"] > 0 else "buy",
                                             abs(Decimal(pos["positions"])), Decimal(str(t["stop_current"])),
                                             test=bool(t["is_test"]))
                if tid:
                    self.j.update_trade(t["id"], tpsl_id=tid)
        for inst in snap.positions:
            if inst in self.s.instruments and not any(t["inst_id"] == inst for t in self.j.open_trades()):
                issues.append(f"{inst} unmanaged position")
                self.j.event("UNMANAGED_POSITION", inst, size=snap.positions[inst].get("positions"))
        return issues

    # ================================================================ breakers / ladder / review
    def breakers(self, snap: Snapshot):
        day, week_peak, all_peak = self.j.equity_marks(snap.mark_equity, self.s.trading_equity_usdt)
        _, losses = self.j.consecutive()
        res = evaluate_breakers(self.s, snap.mark_equity, day, week_peak, all_peak, losses)
        for kind, reason, manual in res.halts:
            self.j.add_halt(kind, reason, manual)
        for n in res.notes:
            self.j.event("RISK_REDUCED", None, note=n)
        lad = self.ladder(snap)
        return self.j.active_halts(), min(1.0, res.risk_multiplier * lad.risk_multiplier)

    def ladder(self, snap: Snapshot) -> LadderResult:
        """Drawdown of TOTAL_EQUITY (unrealised losses count, unrealised gains don't) from its HWM."""
        te = snap.total_equity + min(0.0, snap.unrealized)
        lad = drawdown_ladder(self.s, te, snap.hwm)
        self._ladder = lad
        prev = self.j.get("ladder_level", NORMAL)
        if lad.level != prev:
            action = {"NORMAL": "back to normal risk", "CAUTION": "caution: no risk change",
                      "REDUCED": "new-trade risk x0.5", "NO_NEW_POSITIONS": "no new positions",
                      "HALT": "strategy HALTED: manual revalidation required"}[lad.level]
            self.j.set("ladder_level", lad.level)
            self.j.event("DRAWDOWN_LADDER", None, level=lad.level, previous=prev, drawdown=lad.drawdown,
                         total_equity=te, hwm=snap.hwm, action=action)
        if lad.level == HALTED:
            self.j.add_halt("DRAWDOWN_HALT", f"TOTAL_EQUITY {lad.drawdown:.2%} below HWM {snap.hwm:.4f}: "
                            "revalidate before resuming", manual_reset=True)
        return lad

    def maybe_review(self) -> None:
        for strat in self.strategies:
            hl.review(self.j, self.s, strat)

    # ================================================================ failure modes
    def _check_state(self) -> None:
        problems = []
        if not self.j.integrity_ok():
            problems.append("sqlite quick_check failed")
        try:
            self.capital.state()
        except CapitalCorrupt as e:
            problems.append(str(e)[:300])
        self.fail.active()
        if self.fail.index_corrupt:
            problems.append("failure index unparseable")
        self.fail.update(STATE_CORRUPT, bool(problems), problems=problems)

    def _check_telegram(self) -> None:
        n = self.j.notifier
        healthy = getattr(n, "healthy", True)
        self.fail.update(TELEGRAM_DOWN, not healthy,
                         failing_min=round(getattr(n, "failing_for_s", 0) / 60, 1))

    def _capital_cap(self, snap: Snapshot) -> None:
        was = self.j.get("capital_capped", "0") == "1"
        if snap.capped and not was:
            self.j.event("CAPITAL_CAPPED", None, trading_capital=snap.trading_capital,
                         exchange_equity=snap.exchange_equity, profit_reserve=snap.profit_reserve,
                         sizing_capital=snap.trading_equity,
                         warning="TRADING_CAPITAL exceeds exchange equity minus PROFIT_RESERVE; sizing capped")
        elif was and not snap.capped:
            self.j.event("CAPITAL_CAP_CLEARED", None, trading_capital=snap.trading_capital)
        self.j.set("capital_capped", "1" if snap.capped else "0")

    # ================================================================ main cycle
    def run_cycle(self) -> None:
        self.assert_mode_safe()
        self._live_ok = {}
        self._check_state()
        try:
            snap = self.snapshot()
        except (BlofinError, TransportError) as e:
            # can't see the exchange: nothing new is opened; exchange-side stops keep protecting positions
            self.fail.update(EXCHANGE_UNREACHABLE, True, error=str(e)[:200])
            return
        self.fail.update(EXCHANGE_UNREACHABLE, False)
        self.fail.update(BALANCE_UNVERIFIABLE, not snap.balance_ok)
        try:
            self._stop_fail_cycle = False
            issues = self.reconcile(snap)
            self.fail.update(RECONCILE_MISMATCH, bool(issues), issues=issues)
            if not self._stop_fail_cycle:
                self.fail.update(STOP_PLACEMENT_FAILURE, False)
            snap = self.snapshot()
            self._capital_cap(snap)
            self.j.snapshot_equity(snap.mark_equity, snap.available)
            halts, mult = self.breakers(snap)
            self._check_telegram()
            self._process_bars(snap, halts, mult)
            self.maybe_review()
        except TransportError as e:
            self.fail.update(EXCHANGE_UNREACHABLE, True, error=str(e)[:200])
            raise

    def _open_trade(self, inst: str):
        return next((t for t in self.j.open_trades() if t["inst_id"] == inst), None)

    def _process_bars(self, snap: Snapshot, halts: list, mult: float) -> None:
        s, cache = self.s, {}
        for inst in s.instruments:
            strats = [x for x in self.strategies if not x.instruments or inst in x.instruments]
            t = self._open_trade(inst)
            if t and all(x.id != t["strategy_id"] for x in strats):
                owner = reg.get(t["strategy_id"])
                if owner:  # a disabled strategy's open trade is still managed to the end
                    strats.append(owner)
                else:
                    self.j.event("STRATEGY_UNKNOWN", inst, trade_id=t["id"], strategy=t["strategy_id"])
            for strat in strats:
                key = (inst, strat.timeframe)
                stale_key = f"{STALE_DATA}:{inst}:{strat.timeframe}"
                try:
                    if key not in cache:
                        cache[key] = self.c.candles(inst, strat.timeframe, 1000)
                    a = strat.analyze(inst, cache[key], s)
                except ValueError as e:
                    self.j.event("DATA_ERROR", inst, error=str(e), strategy=strat.id)
                    self.fail.update(stale_key, True, error=str(e)[:200])
                    continue
                except (BlofinError, TransportError) as e:
                    self.j.event("DATA_ERROR", inst, error=str(e), strategy=strat.id)
                    continue
                age = self.clock() - a.bar_close_ts
                self.fail.update(stale_key, age > s.stale_bars * BAR_MS[strat.timeframe],
                                 last_bar_close=a.bar_close_ts, age_min=round(age / 60_000, 1))
                bk = self._bar_key(strat, inst)
                if self.j.get(bk) == str(a.bar_ts):
                    continue
                self.j.event("BAR", inst, strategy=strat.id, bar_ts=a.bar_ts, close=a.close, atr=a.atr,
                             regime=a.regime, adx=a.adx, entry_signal=a.entry_signal, exit_signal=a.exit_signal)
                t = self._open_trade(inst)
                if t:
                    if t["strategy_id"] == strat.id:
                        self.manage_open(t, a)  # exits/trailing always run, even under halts/pauses/failures
                elif a.entry_signal:
                    self.try_entry(a, snap, halts, mult)
                    snap = self.snapshot()
                self.j.set(bk, a.bar_ts)

    # ================================================================ demo end-to-end test
    def e2e_demo(self, inst: str = "ETH-USDT", log=print) -> bool:
        if self.s.mode != MODE_PAPER or self.c.base_url != BASE_URLS[MODE_PAPER]:
            raise SafetyError("e2e test runs only against BloFin Demo")
        results = []

        def step(name, ok, info=""):
            results.append((name, ok))
            log(f"[{'PASS' if ok else 'FAIL'}] {name} {info}")
            self.j.event("E2E_STEP", inst, step=name, ok=ok, info=str(info))
            return ok

        rep = self.preflight()
        step("preflight", True, {k: rep[k] for k in ("available", "trading_equity", "open_positions", "sub_account")})
        if inst in rep["open_positions"]:
            step("instrument flat before test", False, "existing position; aborting")
            return False
        spec = self.spec(inst)
        tk = self.c.ticker(inst)
        ask = float(tk["askPrice"])
        stop = to_step(ask * 0.97, spec.tick_size)
        size = spec.min_size
        plan = TradePlan(inst, +1, ask, stop, size, float(size * spec.contract_value),
                         float(size * spec.contract_value) * ask, 1, float(size * spec.contract_value) * ask,
                         0.0, 0.0, 0.0, 0.0, 0.0, 0.0, to_step(ask * 1.002, spec.tick_size, up=True))
        risk = (ask - float(stop)) * float(size * spec.contract_value)
        plan = TradePlan(**{**plan.__dict__, "risk_amount": risk, "risk_pct": risk / max(rep["trading_equity"], 1e-9)})
        trade_id = None
        try:
            trade_id = self.execute_entry(plan, inst, self.clock() // 1000 * 1000, "TEST", "E2E TEST", test=True)
            if not step("IOC entry filled + stop verified on exchange", bool(trade_id)):
                return False
            t = self.j.trade(trade_id)
            pos = next(p for p in self.c.positions(inst) if float(p.get("positions") or 0))
            step("position reconciles with journal", abs(Decimal(pos["positions"])) == Decimal(t["size"]),
                 f"exchange={pos['positions']} journal={t['size']} liq={pos.get('liquidationPrice')}")
            new = to_step(t["entry_fill"] * 0.975, spec.tick_size)
            self.c.amend_stop(inst, t["tpsl_id"], fmt(new))
            step("trailing stop amend verified", self._verify_stop(inst, t["tpsl_id"], new), fmt(new))
            self.j.update_trade(trade_id, stop_current=float(new))
            snap = self.snapshot()
            self.reconcile(snap)
            step("reconcile pass keeps managed position", self.j.trade(trade_id)["status"] == "OPEN")
            step("close + orphan-stop cleanup", self.close_trade(trade_id, "E2E TEST close"))
            left = [o for o in self.c.tpsl_pending(inst) if o.get("state") in LIVE_STOP_STATES]
            step("no stops left after close", not left, len(left))
            ct = self.j.trade(trade_id)
            step("fills/fees/P&L journaled", ct["exit_fill"] is not None,
                 f"entry={ct['entry_fill']} exit={ct['exit_fill']} fees={(ct['entry_fee'] or 0) + (ct['exit_fee'] or 0):.6f} pnl={ct['pnl']:.6f}")
            # failure path: a stop on the wrong side is rejected by the exchange -> position must be flattened
            bad_ts = self.clock() // 1000 * 1000 + 1000
            tk = self.c.ticker(inst)
            ask = float(tk["askPrice"])
            bad = TradePlan(**{**plan.__dict__, "entry_ref": ask, "stop": to_step(ask * 1.05, spec.tick_size),
                               "limit_price": to_step(ask * 1.002, spec.tick_size, up=True)})
            tid2 = self.execute_entry(bad, inst, bad_ts, "TEST", "E2E protection-failure test", test=True)
            flat = not any(float(p.get("positions") or 0) for p in self.c.positions(inst))
            failure_logged = bool(self.j.events("ORDER_PROTECTION_FAILURE", limit=1))
            step("unprotectable position is flattened + ORDER_PROTECTION_FAILURE logged",
                 tid2 is None and flat and failure_logged, f"flat={flat} logged={failure_logged}")
        finally:
            if any(float(p.get("positions") or 0) for p in self.c.positions(inst)):
                for t in self.j.open_trades():
                    if t["inst_id"] == inst and t["is_test"]:
                        self.close_trade(t["id"], "E2E cleanup")
                if any(float(p.get("positions") or 0) for p in self.c.positions(inst)):
                    self.c.close_position(inst, self.s.margin_mode, "net")
                    log("[WARN] cleanup force-closed a leftover test position")
        ok = all(r[1] for r in results)
        log(f"E2E {'PASSED' if ok else 'FAILED'}: {sum(r[1] for r in results)}/{len(results)} steps")
        return ok

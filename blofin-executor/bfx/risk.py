"""Risk-based sizing, liquidation safety, portfolio limits and circuit breakers (pure functions)."""
from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

from .config import Settings


class TradeRejected(Exception):
    pass


@dataclass(frozen=True)
class InstrumentSpec:
    inst_id: str
    contract_value: Decimal   # base units per contract
    min_size: Decimal         # contracts
    lot_size: Decimal         # contracts
    tick_size: Decimal
    max_leverage: int
    mmr: float                # maintenance margin rate (first tier)

    @classmethod
    def from_api(cls, inst: dict, tiers: list[dict]) -> "InstrumentSpec":
        mmr = float(tiers[0]["maintenanceMarginRate"]) if tiers else 0.005
        return cls(inst["instId"], Decimal(inst["contractValue"]), Decimal(inst["minSize"]),
                   Decimal(inst["lotSize"]), Decimal(inst["tickSize"]), int(float(inst["maxLeverage"])), mmr)


def to_step(x: float | Decimal, step: Decimal, up: bool = False) -> Decimal:
    q = (Decimal(str(x)) / step).to_integral_value(rounding=ROUND_CEILING if up else ROUND_FLOOR)
    return (q * step).normalize() if q else Decimal(0)


def fmt(d: Decimal) -> str:
    return format(d.normalize(), "f")


@dataclass(frozen=True)
class TradePlan:
    inst_id: str
    direction: int            # +1 long, -1 short
    entry_ref: float
    stop: Decimal
    size: Decimal             # contracts
    qty_base: float
    notional: float
    leverage: int
    margin: float
    risk_amount: float        # loss at stop incl. est. fees + slippage
    risk_pct: float
    est_fees: float
    est_slippage: float
    est_liq: float
    stop_liq_gap: float
    limit_price: Decimal      # IOC cap: max acceptable fill
    target: str = "trailing ATR stop / EMA cross-down exit (no fixed target)"

    @property
    def side(self) -> str:
        return "buy" if self.direction > 0 else "sell"

    @property
    def close_side(self) -> str:
        return "sell" if self.direction > 0 else "buy"


def estimate_liq(entry: float, leverage: int, mmr: float, fee: float, direction: int) -> float:
    # Isolated-margin approximation, padded by the closing fee so it errs toward the entry.
    return entry * (1 - direction * (1 / leverage - mmr - fee))


def plan_trade(spec: InstrumentSpec, direction: int, entry_ref: float, stop: float, equity: float,
               risk_pct: float, s: Settings) -> TradePlan:
    stop_d = to_step(stop, spec.tick_size, up=direction < 0)  # round away from entry; sizing uses the rounded stop
    stop_f = float(stop_d)
    stop_dist = (entry_ref - stop_f) * direction
    if stop_dist <= 0:
        raise TradeRejected(f"stop {stop_f} is not on the losing side of entry {entry_ref}")
    if risk_pct > 0.01:
        raise TradeRejected("risk above 1% per trade is never allowed")
    cv = float(spec.contract_value)
    fee, slip = s.taker_fee_pct, s.max_slippage_pct
    loss_per_contract = (stop_dist + entry_ref * slip + (entry_ref + stop_f) * fee) * cv
    budget = equity * risk_pct
    size = to_step(budget / loss_per_contract, spec.lot_size)
    if size < spec.min_size:
        min_risk = float(spec.min_size) * loss_per_contract
        raise TradeRejected(
            f"position below exchange minimum: {fmt(spec.min_size)} contracts would risk "
            f"{min_risk:.4f} USDT = {min_risk / equity:.2%} of TRADING_EQUITY (cap {risk_pct:.2%})")
    n = float(size)
    notional = n * cv * entry_ref
    usable = equity * 0.9
    lev = max(1, math.ceil(notional / usable))
    if lev > min(s.max_leverage, spec.max_leverage):
        raise TradeRejected(f"needs {lev}x leverage to fit margin; max allowed {s.max_leverage}x")
    liq = estimate_liq(entry_ref, lev, spec.mmr, fee, direction)
    gap = (stop_f - liq) * direction
    if gap < s.liq_buffer_stop_frac * stop_dist:
        raise TradeRejected(f"liquidation {liq:.4f} too close to stop {stop_f} (gap {gap:.4f})")
    est_fees = (entry_ref + stop_f) * fee * n * cv
    est_slip = entry_ref * slip * n * cv
    risk_amount = n * loss_per_contract
    limit = to_step(entry_ref * (1 + direction * slip), spec.tick_size, up=direction > 0)
    return TradePlan(spec.inst_id, direction, entry_ref, stop_d, size, n * cv, notional, lev, notional / lev,
                     risk_amount, risk_amount / equity, est_fees, est_slip, liq, gap, limit)


def position_open_risk(direction: int, entry: float, stop: float, size: float, cv: float) -> float:
    """Remaining loss to the current stop; zero once the stop has locked in profit."""
    return max(0.0, (entry - stop) * direction) * size * cv


def check_portfolio(inst_id: str, new_risk: float, open_risks: dict[str, float], equity: float,
                    s: Settings) -> str | None:
    total = sum(open_risks.values()) + new_risk
    if total > equity * s.max_open_risk_pct + 1e-12:
        return f"total open risk {total:.4f} would exceed {s.max_open_risk_pct:.0%} of TRADING_EQUITY"
    for group in s.correlated_groups:
        if inst_id in group:
            g = sum(r for i, r in open_risks.items() if i in group) + new_risk
            if g > equity * s.max_correlated_risk_pct + 1e-12:
                return f"correlated risk {g:.4f} in {group} would exceed {s.max_correlated_risk_pct:.0%}"
    return None


@dataclass(frozen=True)
class BreakerResult:
    risk_multiplier: float
    halts: list            # [(kind, reason, manual_reset)]
    notes: list


def evaluate_breakers(s: Settings, equity_now: float, day_start: float, week_peak: float, all_peak: float,
                      consecutive_losses: int) -> BreakerResult:
    halts, notes, mult = [], [], 1.0
    if equity_now <= day_start * (1 - s.daily_loss_halt_pct):
        halts.append(("DAILY_LOSS", f"day P&L {equity_now - day_start:+.4f} hit -{s.daily_loss_halt_pct:.0%}", False))
    if equity_now <= week_peak * (1 - s.weekly_dd_halt_pct):
        halts.append(("WEEKLY_DD", f"weekly drawdown hit -{s.weekly_dd_halt_pct:.0%}", True))
    dd = 1 - equity_now / all_peak if all_peak > 0 else 0.0
    if dd >= s.strategy_dd_disable_pct:
        halts.append(("STRATEGY_DD_DISABLE", f"strategy drawdown {dd:.2%} >= {s.strategy_dd_disable_pct:.0%}", True))
    elif dd >= s.strategy_dd_reduce_pct:
        mult *= 0.5
        notes.append(f"strategy drawdown {dd:.2%}: risk halved")
    if consecutive_losses >= s.losses_halt:
        halts.append(("LOSING_STREAK", f"{consecutive_losses} consecutive losses: run diagnostics", True))
    elif consecutive_losses >= s.losses_reduce:
        mult *= 0.5
        notes.append(f"{consecutive_losses} consecutive losses: risk halved")
    return BreakerResult(mult, halts, notes)


def ratchet(direction: int, current: Decimal, candidate: float, tick: Decimal) -> Decimal | None:
    """New stop if `candidate` moves it in the trade's favour (rounded toward the position), else None."""
    new = to_step(candidate, tick, up=direction < 0)
    return new if (new - current) * direction > 0 else None


NORMAL, CAUTION, REDUCED, NO_NEW, HALTED = "NORMAL", "CAUTION", "REDUCED", "NO_NEW_POSITIONS", "HALT"
LADDER_ORDER = (NORMAL, CAUTION, REDUCED, NO_NEW, HALTED)


@dataclass(frozen=True)
class LadderResult:
    level: str
    drawdown: float
    risk_multiplier: float   # never above 1
    block_new: bool
    halt: bool


def drawdown_ladder(s: Settings, total_equity: float, hwm: float) -> LadderResult:
    """Drawdown of TOTAL_EQUITY from its high-water mark -> CAUTION / x0.5 risk / no new / HALT."""
    dd = round(max(0.0, 1 - total_equity / hwm), 10) if hwm > 0 else 0.0  # exact at the boundaries
    if dd >= s.dd_halt_pct:
        return LadderResult(HALTED, dd, 0.0, True, True)
    if dd >= s.dd_no_new_pct:
        return LadderResult(NO_NEW, dd, 0.5, True, False)
    if dd >= s.dd_reduce_pct:
        return LadderResult(REDUCED, dd, 0.5, False, False)
    if dd >= s.dd_caution_pct:
        return LadderResult(CAUTION, dd, 1.0, False, False)
    return LadderResult(NORMAL, dd, 1.0, False, False)


def effective_risk_pct(s: Settings, *multipliers: float) -> float:
    """Configured risk scaled down by every active multiplier; can never exceed the configured value."""
    m = 1.0
    for x in multipliers:
        m *= min(1.0, max(0.0, x))
    return min(s.risk_pct, s.risk_pct * m)

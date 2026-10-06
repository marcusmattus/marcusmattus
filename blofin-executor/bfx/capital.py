"""Capital engine: TRADING_CAPITAL (TC), PROFIT_RESERVE (PR), TOTAL_EQUITY (TE = TC + PR), HIGH_WATER_MARK.

Rules (journal-persisted, one state per mode):
  * TC starts at the configured allocation the first time the engine runs for a mode; afterwards the journal
    is the source of truth (existing closed trades are replayed once on first start).
  * Every realised, non-test trade close adds its NET P&L (after fees, funding and slippage) to TC.
  * Profit lock: only realised profit that lifts TE above the previous HWM is lockable. profit_lock_pct (10%)
    of that excess moves TC -> PR, the rest compounds in TC, then HWM = TE. Recovering earlier losses never
    locks; unrealised P&L never locks.
  * Only TC is used for sizing, capped at what the exchange holds (equity minus PR). PR is protected: it is
    only recorded here. There is no transfer or withdrawal code anywhere in bfx.
  * Milestones (GBP) are informational and never change risk.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, replace

from .config import Settings
from .journal import Journal

MILESTONES_GBP = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
                  500_000, 1_000_000]
MAJOR_MILESTONES_GBP = (1_000, 10_000, 100_000, 1_000_000)


class CapitalCorrupt(Exception):
    pass


@dataclass(frozen=True)
class CapitalState:
    initial: float
    trading_capital: float
    profit_reserve: float
    high_water_mark: float
    milestone_alerted_gbp: float = 0.0

    @property
    def total_equity(self) -> float:
        return self.trading_capital + self.profit_reserve


@dataclass(frozen=True)
class CapitalUpdate:
    net_pnl: float
    locked: float
    before: CapitalState
    after: CapitalState
    milestones: tuple = ()      # major GBP milestones crossed by this close

    @property
    def compounded(self) -> float:
        return self.net_pnl - self.locked


def apply_realized(st: CapitalState, net: float, lock_pct: float) -> tuple[CapitalState, float]:
    """Pure profit-lock step for one realised close."""
    tc = st.trading_capital + net
    te = tc + st.profit_reserve
    if te > st.high_water_mark:
        locked = (te - st.high_water_mark) * lock_pct
        return replace(st, trading_capital=tc - locked, profit_reserve=st.profit_reserve + locked,
                       high_water_mark=te), locked
    return replace(st, trading_capital=tc), 0.0


def next_milestone_gbp(total_equity_usdt: float, gbp_per_usdt: float | None) -> int | None:
    if not gbp_per_usdt:
        return None
    gbp = total_equity_usdt * gbp_per_usdt
    return next((m for m in MILESTONES_GBP if gbp < m), None)


def max_drawdown_pct(path: list[float]) -> float:
    peak, mdd = 0.0, 0.0
    for v in path:
        peak = max(peak, v)
        if peak > 0:
            mdd = max(mdd, 1 - v / peak)
    return mdd


class CapitalEngine:
    def __init__(self, journal: Journal, s: Settings):
        self.j, self.s = journal, s

    def _major_reached(self, te: float) -> float:
        if not self.s.gbp_per_usdt:
            return 0.0
        return max((m for m in MAJOR_MILESTONES_GBP if te * self.s.gbp_per_usdt >= m), default=0.0)

    def state(self) -> CapitalState:
        row = self.j.capital_row()
        if row is None:
            return self._init()
        st = CapitalState(row["initial"], row["trading_capital"], row["profit_reserve"], row["high_water_mark"],
                          row["milestone_alerted_gbp"] or 0.0)
        vals = (st.initial, st.trading_capital, st.profit_reserve, st.high_water_mark)
        if any(v is None or not math.isfinite(v) for v in vals) or st.profit_reserve < 0 \
                or st.total_equity > st.high_water_mark + 1e-6 or st.initial <= 0:
            raise CapitalCorrupt(f"capital state invalid: {dict(row)}")
        return st

    def _init(self) -> CapitalState:
        a = self.s.trading_equity_usdt
        st = CapitalState(a, a, 0.0, a, self._major_reached(a))
        replayed = 0
        for t in self.j.closed_trades():
            st, locked = apply_realized(st, t["pnl"] or 0.0, self.s.profit_lock_pct)
            self.j.ledger_add(trade_id=t["id"], strategy_id=t["strategy_id"], kind="REPLAY", net_pnl=t["pnl"] or 0.0,
                              locked=locked, trading_capital=st.trading_capital, profit_reserve=st.profit_reserve,
                              total_equity=st.total_equity, high_water_mark=st.high_water_mark)
            replayed += 1
        st = replace(st, milestone_alerted_gbp=self._major_reached(st.total_equity))
        self._save(st)
        self.j.event("CAPITAL_INIT", None, allocation=a, replayed_trades=replayed, trading_capital=st.trading_capital,
                     profit_reserve=st.profit_reserve, high_water_mark=st.high_water_mark)
        return st

    def _save(self, st: CapitalState) -> None:
        self.j.capital_save(initial=st.initial, trading_capital=st.trading_capital, profit_reserve=st.profit_reserve,
                            high_water_mark=st.high_water_mark, milestone_alerted_gbp=st.milestone_alerted_gbp)

    def apply_close(self, trade_id: int, strategy_id: str, net_pnl: float) -> CapitalUpdate:
        before = self.state()
        after, locked = apply_realized(before, net_pnl, self.s.profit_lock_pct)
        crossed: tuple = ()
        if self.s.gbp_per_usdt:
            gbp = after.total_equity * self.s.gbp_per_usdt
            crossed = tuple(m for m in MAJOR_MILESTONES_GBP if m > before.milestone_alerted_gbp and gbp >= m)
            if crossed:
                after = replace(after, milestone_alerted_gbp=max(crossed))
        self._save(after)
        self.j.ledger_add(trade_id=trade_id, strategy_id=strategy_id, kind="CLOSE", net_pnl=net_pnl, locked=locked,
                          trading_capital=after.trading_capital, profit_reserve=after.profit_reserve,
                          total_equity=after.total_equity, high_water_mark=after.high_water_mark)
        return CapitalUpdate(net_pnl, locked, before, after, crossed)

    def sizing_capital(self, exchange_equity: float) -> tuple[float, bool]:
        """(capital used for sizing, capped?) = min(TC, exchange equity - PR); PR is never sized from."""
        st = self.state()
        usable = max(0.0, exchange_equity - st.profit_reserve)
        cap = max(0.0, min(st.trading_capital, usable))
        return cap, st.trading_capital > usable + 1e-9

    def max_drawdown_pct(self) -> float:
        st = self.state()
        return max_drawdown_pct([st.initial] + [r["total_equity"] for r in self.j.ledger()])

    def gbp(self, usdt: float | None) -> float | None:
        return None if usdt is None or not self.s.gbp_per_usdt else usdt * self.s.gbp_per_usdt

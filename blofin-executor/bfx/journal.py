"""SQLite trade journal: every decision, trade, rejection, halt and equity snapshot. Times are UTC ms."""
from __future__ import annotations

import json
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY, mode TEXT, strategy_id TEXT, inst_id TEXT, direction INTEGER, regime TEXT,
  opened_ts INTEGER, signal_bar_ts INTEGER, entry_ref REAL, entry_fill REAL, stop_initial REAL, stop_current REAL,
  size TEXT, contract_value REAL, leverage INTEGER, risk_pct REAL, risk_amount REAL,
  entry_order_id TEXT, client_order_id TEXT, tpsl_id TEXT, entry_fee REAL,
  exit_ts INTEGER, exit_fill REAL, exit_fee REAL, funding REAL, slippage REAL, pnl REAL, r_multiple REAL,
  entry_reason TEXT, exit_reason TEXT, status TEXT, is_test INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, kind TEXT, inst_id TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS halts (
  id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, kind TEXT, reason TEXT, manual_reset INTEGER,
  active INTEGER DEFAULT 1, cleared_ts INTEGER
);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS equity (ts INTEGER, mode TEXT, trading_equity REAL, exchange_available REAL);
CREATE TABLE IF NOT EXISTS capital_state (
  mode TEXT PRIMARY KEY, initial REAL, trading_capital REAL, profit_reserve REAL, high_water_mark REAL,
  milestone_alerted_gbp REAL DEFAULT 0, created_ts INTEGER, updated_ts INTEGER
);
CREATE TABLE IF NOT EXISTS capital_ledger (
  id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, trade_id INTEGER, strategy_id TEXT, kind TEXT, net_pnl REAL,
  locked REAL, trading_capital REAL, profit_reserve REAL, total_equity REAL, high_water_mark REAL
);
CREATE TABLE IF NOT EXISTS execution_feedback (
  id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, strategy_id TEXT, trade_id INTEGER, symbol TEXT, timeframe TEXT,
  regime TEXT, signal_time INTEGER, expected_entry REAL, actual_entry REAL, expected_exit REAL, actual_exit REAL,
  expected_slippage REAL, actual_slippage REAL, expected_r REAL, actual_r REAL, expected_fee REAL, actual_fee REAL,
  funding REAL, latency_ms INTEGER, result TEXT, reason_for_exit TEXT, notional REAL, pnl REAL,
  is_test INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS strategy_state (
  mode TEXT, strategy_id TEXT, health TEXT, paused INTEGER DEFAULT 0, reason TEXT, reviewed_count INTEGER DEFAULT 0,
  updated_ts INTEGER, PRIMARY KEY (mode, strategy_id)
);
CREATE TABLE IF NOT EXISTS regime_state (
  mode TEXT, strategy_id TEXT, regime TEXT, disabled INTEGER DEFAULT 0, reason TEXT, since_ts INTEGER DEFAULT 0,
  updated_ts INTEGER, PRIMARY KEY (mode, strategy_id, regime)
);
"""
# columns added after v1; existing databases are upgraded in place (no data is rewritten)
TRADE_COLUMNS_V2 = {"timeframe": "TEXT", "signal_close_ts": "INTEGER", "est_fees": "REAL", "est_slippage": "REAL",
                    "exit_ref": "REAL", "take_profit": "REAL"}
SCHEMA_VERSION = 2


def now_ms() -> int:
    return int(time.time() * 1000)


def utc_day_start(ms: int) -> int:
    d = datetime.fromtimestamp(ms / 1000, timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(d.timestamp() * 1000)


def utc_week_start(ms: int) -> int:
    d = datetime.fromtimestamp(utc_day_start(ms) / 1000, timezone.utc)
    return int((d - timedelta(days=d.weekday())).timestamp() * 1000)


class Journal:
    def __init__(self, path: Path | str, mode: str, clock=now_ms, notifier=None):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path))
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self._migrate()
        self.mode = mode
        self.clock = clock
        self.notifier = notifier  # callable(kind, inst_id, detail); best-effort, never raises

    def _migrate(self) -> None:
        have = {r[1] for r in self.db.execute("PRAGMA table_info(trades)")}
        for col, typ in TRADE_COLUMNS_V2.items():
            if col not in have:
                self.db.execute(f"ALTER TABLE trades ADD COLUMN {col} {typ}")
        if self.db.execute("PRAGMA user_version").fetchone()[0] < SCHEMA_VERSION:
            self.db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        self.db.commit()

    def integrity_ok(self) -> bool:
        try:
            return self.db.execute("PRAGMA quick_check").fetchone()[0] == "ok"
        except sqlite3.DatabaseError:
            return False

    # ------------------------------------------------------------------ events
    def event(self, kind: str, inst_id: str | None = None, **detail) -> None:
        self.db.execute("INSERT INTO events(ts, mode, kind, inst_id, detail) VALUES (?,?,?,?,?)",
                        (self.clock(), self.mode, kind, inst_id, json.dumps(detail, default=str)))
        self.db.commit()
        if self.notifier:
            try:
                self.notifier(kind, inst_id, detail)
            except Exception:
                pass

    def events(self, kind: str | None = None, limit: int = 50) -> list[sqlite3.Row]:
        q = "SELECT * FROM events WHERE mode=?" + (" AND kind=?" if kind else "") + " ORDER BY id DESC LIMIT ?"
        args = (self.mode, kind, limit) if kind else (self.mode, limit)
        return list(self.db.execute(q, args))

    # ------------------------------------------------------------------ trades
    def open_trade(self, **f) -> int:
        f.setdefault("mode", self.mode)
        f.setdefault("status", "OPEN")
        f.setdefault("opened_ts", self.clock())
        cols = ",".join(f)
        cur = self.db.execute(f"INSERT INTO trades({cols}) VALUES ({','.join('?' * len(f))})", tuple(f.values()))
        self.db.commit()
        return cur.lastrowid

    def update_trade(self, trade_id: int, **f) -> None:
        sets = ",".join(f"{k}=?" for k in f)
        self.db.execute(f"UPDATE trades SET {sets} WHERE id=?", (*f.values(), trade_id))
        self.db.commit()

    def trade(self, trade_id: int) -> sqlite3.Row:
        return self.db.execute("SELECT * FROM trades WHERE id=?", (trade_id,)).fetchone()

    def open_trades(self, include_test: bool = True) -> list[sqlite3.Row]:
        q = "SELECT * FROM trades WHERE mode=? AND status='OPEN'" + ("" if include_test else " AND is_test=0")
        return list(self.db.execute(q, (self.mode,)))

    def closed_trades(self, include_test: bool = False, strategy_id: str | None = None) -> list[sqlite3.Row]:
        q = "SELECT * FROM trades WHERE mode=? AND status='CLOSED'" + ("" if include_test else " AND is_test=0")
        if strategy_id:
            return list(self.db.execute(q + " AND strategy_id=? ORDER BY exit_ts, id", (self.mode, strategy_id)))
        return list(self.db.execute(q + " ORDER BY exit_ts, id", (self.mode,)))

    def realized_pnl(self, since_ms: int = 0) -> float:
        r = self.db.execute("SELECT COALESCE(SUM(pnl),0) FROM trades WHERE mode=? AND status='CLOSED' "
                            "AND is_test=0 AND exit_ts>=?", (self.mode, since_ms)).fetchone()
        return float(r[0])

    def consecutive(self) -> tuple[int, int]:
        """(consecutive wins, consecutive losses) counted back from the latest closed trade."""
        wins = losses = 0
        for t in reversed(self.closed_trades()):
            if t["pnl"] > 0 and losses == 0:
                wins += 1
            elif t["pnl"] <= 0 and wins == 0:
                losses += 1
            else:
                break
        return wins, losses

    # ------------------------------------------------------------------ halts
    def add_halt(self, kind: str, reason: str, manual_reset: bool) -> bool:
        if any(h["kind"] == kind for h in self.active_halts()):
            return False
        self.db.execute("INSERT INTO halts(ts, mode, kind, reason, manual_reset) VALUES (?,?,?,?,?)",
                        (self.clock(), self.mode, kind, reason, int(manual_reset)))
        self.db.commit()
        self.event("HALT", None, halt=kind, reason=reason, manual_reset=manual_reset)
        return True

    def active_halts(self) -> list[sqlite3.Row]:
        # automatic halts (daily loss) expire at the next UTC day
        today = utc_day_start(self.clock())
        self.db.execute("UPDATE halts SET active=0, cleared_ts=? WHERE mode=? AND active=1 AND manual_reset=0 "
                        "AND ts<?", (self.clock(), self.mode, today))
        self.db.commit()
        return list(self.db.execute("SELECT * FROM halts WHERE mode=? AND active=1", (self.mode,)))

    def clear_halt(self, halt_id: int) -> None:
        self.db.execute("UPDATE halts SET active=0, cleared_ts=? WHERE id=? AND mode=?",
                        (self.clock(), halt_id, self.mode))
        self.db.commit()
        self.event("HALT_CLEARED", None, halt_id=halt_id)

    # ------------------------------------------------------------------ kv + equity
    def get(self, key: str, default: str | None = None) -> str | None:
        r = self.db.execute("SELECT value FROM kv WHERE key=?", (f"{self.mode}:{key}",)).fetchone()
        return r[0] if r else default

    def set(self, key: str, value) -> None:
        self.db.execute("INSERT OR REPLACE INTO kv(key, value) VALUES (?,?)", (f"{self.mode}:{key}", str(value)))
        self.db.commit()

    def snapshot_equity(self, trading_equity: float, exchange_available: float) -> None:
        self.db.execute("INSERT INTO equity VALUES (?,?,?,?)",
                        (self.clock(), self.mode, trading_equity, exchange_available))
        self.db.commit()

    def equity_marks(self, current: float, allocation: float) -> tuple[float, float, float]:
        """(day_start, week_peak, all_time_peak) of TRADING_EQUITY, falling back to `current`/allocation."""
        now = self.clock()
        first_today = self.db.execute("SELECT trading_equity FROM equity WHERE mode=? AND ts>=? ORDER BY ts LIMIT 1",
                                      (self.mode, utc_day_start(now))).fetchone()
        last_before = self.db.execute("SELECT trading_equity FROM equity WHERE mode=? AND ts<? ORDER BY ts DESC LIMIT 1",
                                      (self.mode, utc_day_start(now))).fetchone()
        day_start = (last_before or first_today or [current])[0]
        wk = self.db.execute("SELECT MAX(trading_equity) FROM equity WHERE mode=? AND ts>=?",
                             (self.mode, utc_week_start(now))).fetchone()[0]
        allp = self.db.execute("SELECT MAX(trading_equity) FROM equity WHERE mode=?", (self.mode,)).fetchone()[0]
        return day_start, max(wk or current, current), max(allp or allocation, allocation, current)

    # ------------------------------------------------------------------ capital engine
    def capital_row(self) -> sqlite3.Row | None:
        return self.db.execute("SELECT * FROM capital_state WHERE mode=?", (self.mode,)).fetchone()

    def capital_save(self, **f) -> None:
        f["updated_ts"] = self.clock()
        if self.capital_row() is None:
            f.setdefault("created_ts", self.clock())
            cols = ",".join(["mode", *f])
            self.db.execute(f"INSERT INTO capital_state({cols}) VALUES ({','.join('?' * (len(f) + 1))})",
                            (self.mode, *f.values()))
        else:
            sets = ",".join(f"{k}=?" for k in f)
            self.db.execute(f"UPDATE capital_state SET {sets} WHERE mode=?", (*f.values(), self.mode))
        self.db.commit()

    def ledger_add(self, **f) -> None:
        f.setdefault("ts", self.clock())
        f["mode"] = self.mode
        self.db.execute(f"INSERT INTO capital_ledger({','.join(f)}) VALUES ({','.join('?' * len(f))})",
                        tuple(f.values()))
        self.db.commit()

    def ledger(self, limit: int = 100000) -> list[sqlite3.Row]:
        return list(self.db.execute("SELECT * FROM capital_ledger WHERE mode=? ORDER BY id LIMIT ?",
                                    (self.mode, limit)))

    # ------------------------------------------------------------------ execution feedback
    def add_feedback(self, **f) -> None:
        f.setdefault("ts", self.clock())
        f["mode"] = self.mode
        self.db.execute(f"INSERT INTO execution_feedback({','.join(f)}) VALUES ({','.join('?' * len(f))})",
                        tuple(f.values()))
        self.db.commit()

    def feedback(self, strategy_id: str | None = None, include_test: bool = False,
                 limit: int = 100000) -> list[sqlite3.Row]:
        q = "SELECT * FROM execution_feedback WHERE mode=?" + ("" if include_test else " AND is_test=0")
        args: tuple = (self.mode,)
        if strategy_id:
            q, args = q + " AND strategy_id=?", (*args, strategy_id)
        return list(self.db.execute(q + " ORDER BY id DESC LIMIT ?", (*args, limit)))

    # ------------------------------------------------------------------ strategy health / regime switches
    def strategy_state(self, strategy_id: str) -> sqlite3.Row | None:
        return self.db.execute("SELECT * FROM strategy_state WHERE mode=? AND strategy_id=?",
                               (self.mode, strategy_id)).fetchone()

    def set_strategy_state(self, strategy_id: str, **f) -> None:
        f["updated_ts"] = self.clock()
        if self.strategy_state(strategy_id) is None:
            cols = ",".join(["mode", "strategy_id", *f])
            self.db.execute(f"INSERT INTO strategy_state({cols}) VALUES ({','.join('?' * (len(f) + 2))})",
                            (self.mode, strategy_id, *f.values()))
        else:
            sets = ",".join(f"{k}=?" for k in f)
            self.db.execute(f"UPDATE strategy_state SET {sets} WHERE mode=? AND strategy_id=?",
                            (*f.values(), self.mode, strategy_id))
        self.db.commit()

    def regime_row(self, strategy_id: str, regime: str) -> sqlite3.Row | None:
        return self.db.execute("SELECT * FROM regime_state WHERE mode=? AND strategy_id=? AND regime=?",
                               (self.mode, strategy_id, regime)).fetchone()

    def set_regime_state(self, strategy_id: str, regime: str, **f) -> None:
        f["updated_ts"] = self.clock()
        if self.regime_row(strategy_id, regime) is None:
            cols = ",".join(["mode", "strategy_id", "regime", *f])
            self.db.execute(f"INSERT INTO regime_state({cols}) VALUES ({','.join('?' * (len(f) + 3))})",
                            (self.mode, strategy_id, regime, *f.values()))
        else:
            sets = ",".join(f"{k}=?" for k in f)
            self.db.execute(f"UPDATE regime_state SET {sets} WHERE mode=? AND strategy_id=? AND regime=?",
                            (*f.values(), self.mode, strategy_id, regime))
        self.db.commit()

    def disabled_regimes(self, strategy_id: str | None = None) -> list[sqlite3.Row]:
        q = "SELECT * FROM regime_state WHERE mode=? AND disabled=1"
        if strategy_id:
            return list(self.db.execute(q + " AND strategy_id=?", (self.mode, strategy_id)))
        return list(self.db.execute(q, (self.mode,)))

    def equity_history(self) -> list[sqlite3.Row]:
        return list(self.db.execute("SELECT * FROM equity WHERE mode=? ORDER BY ts", (self.mode,)))

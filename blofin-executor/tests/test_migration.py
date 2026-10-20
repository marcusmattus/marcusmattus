import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bfx.capital import CapitalEngine
from bfx.config import Settings
from bfx.executor import stats
from bfx.journal import Journal

V1_SCHEMA = """
CREATE TABLE trades (
  id INTEGER PRIMARY KEY, mode TEXT, strategy_id TEXT, inst_id TEXT, direction INTEGER, regime TEXT,
  opened_ts INTEGER, signal_bar_ts INTEGER, entry_ref REAL, entry_fill REAL, stop_initial REAL, stop_current REAL,
  size TEXT, contract_value REAL, leverage INTEGER, risk_pct REAL, risk_amount REAL,
  entry_order_id TEXT, client_order_id TEXT, tpsl_id TEXT, entry_fee REAL,
  exit_ts INTEGER, exit_fill REAL, exit_fee REAL, funding REAL, slippage REAL, pnl REAL, r_multiple REAL,
  entry_reason TEXT, exit_reason TEXT, status TEXT, is_test INTEGER DEFAULT 0
);
CREATE TABLE events (id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, kind TEXT, inst_id TEXT, detail TEXT);
CREATE TABLE halts (id INTEGER PRIMARY KEY, ts INTEGER, mode TEXT, kind TEXT, reason TEXT, manual_reset INTEGER,
  active INTEGER DEFAULT 1, cleared_ts INTEGER);
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE equity (ts INTEGER, mode TEXT, trading_equity REAL, exchange_available REAL);
"""


class TestMigration(unittest.TestCase):
    def test_v1_database_upgrades_without_data_loss(self):
        with TemporaryDirectory() as d:
            path = Path(d) / "journal.sqlite"
            db = sqlite3.connect(path)
            db.executescript(V1_SCHEMA)
            q = ("INSERT INTO trades(mode,strategy_id,inst_id,direction,regime,opened_ts,entry_fill,size,"
                 "contract_value,risk_amount,exit_ts,pnl,r_multiple,status,is_test,exit_reason) "
                 "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            db.execute(q, ("PAPER", "B-EMA10-100-LO-ATR3.5", "ETH-USDT", 1, "TEST", 1, 2700, "0.1", 0.01, 1, 2,
                           -0.03, -0.1, "CLOSED", 1, "E2E TEST close"))
            db.execute(q, ("PAPER", "B-EMA10-100-LO-ATR3.5", "ETH-USDT", 1, "HIGH VOLATILITY", 3, 2700, "0.1", 0.01,
                           1, 4, 5.0, 5.0, "CLOSED", 0, "trail"))
            db.execute(q, ("PAPER", "B-EMA10-100-LO-ATR3.5", "SOL-USDT", 1, "UPTREND", 5, 200, "1", 1.0,
                           1, None, None, None, "OPEN", 0, None))
            db.execute("INSERT INTO events(ts,mode,kind,inst_id,detail) VALUES (1,'PAPER','E2E_STEP','ETH-USDT','{}')")
            db.execute("INSERT INTO halts(ts,mode,kind,reason,manual_reset) VALUES (1,'PAPER','WEEKLY_DD','x',1)")
            db.execute("INSERT INTO kv VALUES ('PAPER:last_bar:ETH-USDT','123')")
            db.commit()
            db.close()

            j = Journal(path, "PAPER")
            self.assertEqual(j.db.execute("SELECT COUNT(*) FROM trades").fetchone()[0], 3)
            self.assertEqual(len(j.closed_trades()), 1)                       # is_test row still excluded
            self.assertEqual(len(j.closed_trades(include_test=True)), 2)
            self.assertEqual(len(j.open_trades()), 1)
            self.assertEqual(j.get("last_bar:ETH-USDT"), "123")
            self.assertEqual(len(j.active_halts()), 1)
            self.assertEqual(len(j.events("E2E_STEP")), 1)
            cols = {r[1] for r in j.db.execute("PRAGMA table_info(trades)")}
            self.assertTrue({"timeframe", "signal_close_ts", "est_fees", "est_slippage", "exit_ref",
                             "take_profit"} <= cols)
            tables = {r[0] for r in j.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertTrue({"capital_state", "capital_ledger", "execution_feedback", "strategy_state",
                             "regime_state"} <= tables)
            self.assertEqual(j.db.execute("PRAGMA user_version").fetchone()[0], 2)
            st = CapitalEngine(j, Settings(trading_equity_usdt=67)).state()
            self.assertAlmostEqual(st.total_equity, 72.0)                      # replay of the real trade only
            self.assertAlmostEqual(st.profit_reserve, 0.5)
            self.assertEqual(stats(j.closed_trades())["trades"], 1)
            j.db.close()

            j2 = Journal(path, "PAPER")                                        # idempotent re-open
            self.assertEqual(j2.db.execute("SELECT COUNT(*) FROM trades").fetchone()[0], 3)
            self.assertAlmostEqual(CapitalEngine(j2, Settings(trading_equity_usdt=999)).state().total_equity, 72.0)
            self.assertTrue(j2.integrity_ok())
            j2.db.close()


if __name__ == "__main__":
    unittest.main()

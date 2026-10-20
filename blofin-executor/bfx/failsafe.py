"""Failure modes: while any is active the executor opens NO new positions; existing positions keep their
exchange-side stops, trailing and exits. Each condition emits FAILURE_MODE when it starts and
FAILURE_RESTORED when it clears. State lives in the journal kv store so restarts remember it.
"""
from __future__ import annotations

import json

from .journal import Journal

EXCHANGE_UNREACHABLE = "EXCHANGE_UNREACHABLE"
STALE_DATA = "STALE_DATA"                    # scoped per instrument/timeframe: STALE_DATA:ETH-USDT:4H
RECONCILE_MISMATCH = "RECONCILE_MISMATCH"
STOP_PLACEMENT_FAILURE = "STOP_PLACEMENT_FAILURE"
BALANCE_UNVERIFIABLE = "BALANCE_UNVERIFIABLE"
STATE_CORRUPT = "STATE_CORRUPT"
TELEGRAM_DOWN = "TELEGRAM_DOWN"
KINDS = (EXCHANGE_UNREACHABLE, STALE_DATA, RECONCILE_MISMATCH, STOP_PLACEMENT_FAILURE, BALANCE_UNVERIFIABLE,
         STATE_CORRUPT, TELEGRAM_DOWN)
_INDEX = "failures:active"


class FailureMonitor:
    def __init__(self, journal: Journal):
        self.j = journal
        self.index_corrupt = False

    def _load(self) -> dict:
        raw = self.j.get(_INDEX, "{}")
        try:
            d = json.loads(raw)
            if not isinstance(d, dict) or not all(isinstance(v, dict) and "since" in v for v in d.values()):
                raise ValueError
            self.index_corrupt = False
            return d
        except ValueError:
            # unparseable failure state is itself a corrupted-state failure: fail closed
            self.index_corrupt = True
            return {STATE_CORRUPT: {"since": self.j.clock(), "detail": {"error": "failure index unparseable"}}}

    def active(self) -> dict:
        return self._load()

    def update(self, name: str, on: bool, **detail) -> bool:
        """Set or clear `name`; returns True when the state changed."""
        cur = self._load()
        if self.index_corrupt:
            cur = {}  # rebuilt from this cycle's checks; every condition is re-evaluated each cycle
        if on and name not in cur:
            cur[name] = {"since": self.j.clock(), "detail": detail}
            self.j.set(_INDEX, json.dumps(cur, default=str))
            self.j.event("FAILURE_MODE", name.split(":", 2)[1] if name.startswith(STALE_DATA + ":") else None,
                         failure=name, **detail)
            return True
        if not on and name in cur:
            since = cur.pop(name)["since"]
            self.j.set(_INDEX, json.dumps(cur, default=str))
            self.j.event("FAILURE_RESTORED", None, failure=name, duration_min=round((self.j.clock() - since) / 60_000, 1))
            return True
        return False

    def blocking(self, inst_id: str | None = None) -> list[str]:
        """Active failures that block a new entry on `inst_id` (STALE_DATA only blocks its own instrument)."""
        out = []
        for name in self._load():
            if name.startswith(STALE_DATA + ":"):
                if inst_id is None or name.split(":")[1] == inst_id:
                    out.append(name)
            else:
                out.append(name)
        return out

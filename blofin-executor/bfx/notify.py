"""Telegram alerts for journal events. Best-effort: a failed or slow send never blocks or breaks trading.

Bot token: env BFX_TELEGRAM_BOT_TOKEN, else macOS Keychain service "bfx-telegram", account "bot_token".
Chat id: config.json "telegram_chat_id". Either missing -> notifications are off.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request

from .client import _ssl_context
from .secrets import _keychain

# Events worth a phone buzz. Routine per-bar evaluations (BAR) and E2E steps stay journal-only.
NOTIFY_KINDS = {
    "ENTRY_PROTECTED", "TRADE_CLOSED", "TRAIL_UPDATED", "SIGNAL_REJECTED", "ENTRY_NOT_FILLED",
    "ORDER_REJECTED", "ORDER_ACK_UNKNOWN", "ORDER_ACK_MISSING", "POSITION_MISSING_AFTER_FILL",
    "ORDER_PROTECTION_FAILURE", "STOP_MISSING", "STOP_CANCEL_FAILED", "LIQUIDATION_SAFETY_FAIL",
    "CLOSE_FAILED", "CLOSE_REQUEST_ERROR", "UNMANAGED_POSITION", "RECONCILE_SIZE_MISMATCH",
    "HALT", "RISK_REDUCED", "PERFORMANCE_REVIEW", "LOOP_STARTED",
    "PROFIT_LOCKED", "CAPITAL_MILESTONE", "DRAWDOWN_LADDER", "STRATEGY_HEALTH", "STRATEGY_PAUSED",
    "STRATEGY_RESUMED", "FAILURE_MODE", "FAILURE_RESTORED", "REGIME_DISABLED", "REGIME_ENABLED",
    "CAPITAL_CAPPED", "PNL_UNVERIFIED",
}
URGENT = {"ORDER_PROTECTION_FAILURE", "STOP_MISSING", "LIQUIDATION_SAFETY_FAIL", "CLOSE_FAILED",
          "UNMANAGED_POSITION", "RECONCILE_SIZE_MISMATCH", "HALT", "ORDER_ACK_UNKNOWN",
          "POSITION_MISSING_AFTER_FILL", "FAILURE_MODE", "STRATEGY_PAUSED", "PNL_UNVERIFIED"}
_SECRETISH = ("secret", "token", "passphrase", "api_key", "apikey", "password", "sign")
LADDER_ICON = {"NORMAL": "✅", "CAUTION": "⚠️", "REDUCED": "⚠️", "NO_NEW_POSITIONS": "🛑", "HALT": "🚨"}


def _num(v, nd=4):
    try:
        return f"{float(v):,.{nd}f}"
    except (TypeError, ValueError):
        return str(v)


def _money(v, g: float | None, signed: bool = False) -> str:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return "n/a"
    sign = ("+" if x > 0 else "-" if x < 0 else "") if signed else ("-" if x < 0 else "")
    return f"{sign}£{abs(x) * g:,.2f}" if g else f"{sign}{abs(x):,.2f} USDT"


def _r(v) -> str:
    try:
        return f"{float(v):+.2f}R"
    except (TypeError, ValueError):
        return "n/a"


def _ms(v) -> str:
    return f"£{v:,}" if isinstance(v, (int, float)) and v else "n/a"


def _capital_lines(d: dict, g: float | None, pr_label: str = "Profit Reserve") -> list[str]:
    return [f"Trading Capital: {_money(d.get('trading_capital'), g)}",
            f"{pr_label}: {_money(d.get('profit_reserve'), g)}",
            f"Total Equity: {_money(d.get('total_equity'), g)}",
            f"Next Milestone: {_ms(d.get('next_milestone_gbp'))}"]


def _safe_items(d: dict) -> str:
    return "  ".join(f"{k}={v}" for k, v in d.items()
                     if v not in (None, "") and not any(x in k.lower() for x in _SECRETISH))


def format_message(mode: str, kind: str, inst_id: str | None, d: dict, gbp_per_usdt: float | None = None) -> str:
    g = gbp_per_usdt
    head = f"{'🚨 ' if kind in URGENT else ''}[{mode}] {kind}{' ' + inst_id if inst_id else ''}"
    if kind == "TRADE_CLOSED" and d.get("feedback"):
        lines = [f"📊 TRADE FEEDBACK [{mode}]", f"Pair: {inst_id}", f"Strategy: {d.get('strategy')}",
                 f"Regime: {d.get('regime')}", f"Result: {d.get('result')} {_money(d.get('pnl'), g, True)}",
                 f"R: {_r(d.get('r'))}", f"Expected R: {_r(d.get('expected_r'))}",
                 f"Slippage: {_money(d.get('slippage'), g)}", f"Fees: {_money(d.get('fees'), g)}",
                 *_capital_lines(d, g)[:3], f"Next Milestone: {_ms(d.get('next_milestone_gbp'))}",
                 f"Strategy Health: {d.get('health')}", f"Exit: {d.get('reason', '')}"]
        return "\n".join(lines)[:3500]
    if kind == "PROFIT_LOCKED":
        pct = float(d.get("lock_pct") or 0.10)
        lines = [f"🔐 PROFIT LOCKED [{mode}]", f"Realized Net Profit: {_money(d.get('net_pnl'), g, True)}",
                 f"{pct:.0%} Reserved: {_money(d.get('locked'), g)}",
                 f"{1 - pct:.0%} Compounded: {_money(d.get('compounded'), g)}",
                 *_capital_lines(d, g, "Protected Reserve")]
        return "\n".join(lines)[:3500]
    if kind == "CAPITAL_MILESTONE":
        lines = [f"🏆 CAPITAL MILESTONE [{mode}]", f"Milestone: {_ms(d.get('milestone_gbp'))}",
                 f"Trading Capital: {_money(d.get('trading_capital'), g)}",
                 f"Profit Reserve: {_money(d.get('profit_reserve'), g)}",
                 f"Total Equity: {_money(d.get('total_equity'), g)}",
                 f"Net Realized Profit: {_money(d.get('net_realized'), g, True)}",
                 f"Max DD: {float(d.get('max_dd_pct') or 0):.2%}", f"PF: {_num(d.get('profit_factor'), 2)}"]
        return "\n".join(lines)[:3500]
    if kind == "DRAWDOWN_LADDER":
        lvl = d.get("level")
        lines = [f"{LADDER_ICON.get(lvl, '⚠️')} DRAWDOWN {lvl} [{mode}]",
                 f"Drawdown from HWM: {float(d.get('drawdown') or 0):.2%}",
                 f"Total Equity: {_money(d.get('total_equity'), g)}  HWM: {_money(d.get('hwm'), g)}",
                 f"Action: {d.get('action', '')}"]
        return "\n".join(lines)[:3500]
    if kind in ("STRATEGY_HEALTH", "STRATEGY_PAUSED", "STRATEGY_RESUMED"):
        icon = {"STRATEGY_PAUSED": "🚨⏸", "STRATEGY_RESUMED": "▶️"}.get(kind, "🩺")
        body = f"{d.get('old')} → {d.get('new')}" if kind == "STRATEGY_HEALTH" else d.get("status", "")
        reasons = "; ".join(d.get("reasons") or [])
        return f"{icon} {kind.replace('_', ' ')} [{mode}]\nStrategy: {d.get('strategy')}\n{body}\n{reasons}"[:3500]
    if kind == "FAILURE_MODE":
        return (f"🚨 FAILURE [{mode}]: {d.get('failure')}\nNo new entries; existing positions keep their stops."
                f"\n{_safe_items({k: v for k, v in d.items() if k != 'failure'})}")[:3500]
    if kind == "FAILURE_RESTORED":
        return f"✅ RESTORED [{mode}]: {d.get('failure')} (after {d.get('duration_min')} min)"
    if kind in ("REGIME_DISABLED", "REGIME_ENABLED"):
        icon = "⛔" if kind == "REGIME_DISABLED" else "✅"
        return f"{icon} {kind.replace('_', ' ')} [{mode}]\n{d.get('strategy')} / {d.get('regime')}\n{d.get('reason', '')}"
    if kind == "ENTRY_PROTECTED":
        body = f"LONG entry {d.get('entry')}  stop {d.get('stop')}  size {d.get('size')}"
    elif kind == "TRADE_CLOSED":
        body = f"exit {d.get('exit')}  P&L {_num(d.get('pnl'))} USDT  R {_num(d.get('r'), 2)}\n{d.get('reason', '')}"
    elif kind == "TRAIL_UPDATED":
        body = f"stop {d.get('old')} → {d.get('new')}"
    elif kind == "SIGNAL_REJECTED":
        body = f"{d.get('reason')}  (regime {d.get('regime')})"
    elif kind == "HALT":
        body = f"{d.get('halt')}: {d.get('reason')}" + ("\nmanual review required" if d.get("manual_reset") else "")
    else:
        body = _safe_items(d)
    return f"{head}\n{body}"[:3500]


class TelegramNotifier:
    def __init__(self, token: str, chat_id: str, mode: str, timeout: float = 8.0, gbp_per_usdt: float | None = None,
                 down_after_min: float = 30, clock=time.time):
        self._token = token
        self.chat_id = str(chat_id)
        self.mode = mode
        self.timeout = timeout
        self.gbp_per_usdt = gbp_per_usdt
        self.down_after_s = down_after_min * 60
        self.clock = clock
        self._fail_since: float | None = None
        self._lock = threading.Lock()
        self._ssl = None

    def record(self, ok: bool) -> None:
        with self._lock:
            if ok:
                self._fail_since = None
            elif self._fail_since is None:
                self._fail_since = self.clock()

    @property
    def failing_for_s(self) -> float:
        fs = self._fail_since
        return 0.0 if fs is None else self.clock() - fs

    @property
    def healthy(self) -> bool:
        """False after down_after_min of consecutive send failures (no success in between)."""
        return self._fail_since is None or self.failing_for_s < self.down_after_s

    def _deliver(self, text: str) -> None:
        try:
            ok = bool(self.send(text))
        except Exception:
            ok = False
        self.record(ok)

    def __repr__(self) -> str:  # never leak the token
        return f"TelegramNotifier(chat_id={self.chat_id}, mode={self.mode})"

    def send(self, text: str) -> bool:
        data = urllib.parse.urlencode({"chat_id": self.chat_id, "text": text,
                                       "disable_web_page_preview": "true"}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{self._token}/sendMessage", data=data)
        if self._ssl is None:
            self._ssl = _ssl_context()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self._ssl) as r:
                return bool(json.loads(r.read().decode()).get("ok"))
        except Exception:
            return False

    def __call__(self, kind: str, inst_id: str | None, detail: dict) -> None:
        if kind not in NOTIFY_KINDS:
            return
        text = format_message(self.mode, kind, inst_id, detail, self.gbp_per_usdt)
        threading.Thread(target=self._deliver, args=(text,), daemon=True).start()


def load_notifier(chat_id: str | None, mode: str, gbp_per_usdt: float | None = None,
                  down_after_min: float = 30) -> TelegramNotifier | None:
    if not chat_id:
        return None
    token = os.environ.get("BFX_TELEGRAM_BOT_TOKEN") or _keychain("bfx-telegram", "bot_token")
    return TelegramNotifier(token, chat_id, mode, gbp_per_usdt=gbp_per_usdt,
                            down_after_min=down_after_min) if token else None

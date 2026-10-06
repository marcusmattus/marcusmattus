"""Settings and hard safety limits.

Values in config.json can tighten behaviour but never loosen the HARD_* limits below.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, fields
from pathlib import Path

MODE_PAPER = "PAPER"
MODE_LIVE = "LIVE"
BASE_URLS = {
    MODE_PAPER: "https://demo-trading-openapi.blofin.com",
    MODE_LIVE: "https://openapi.blofin.com",
}
LIVE_ARM_PHRASE = "ENABLE BLOFIN LIVE TRADING"

# Hard limits: not configurable.
HARD_MAX_RISK_PCT = 0.01          # never exceed 1% account risk per trade
LIVE_DEFAULT_MAX_RISK_PCT = 0.005  # LIVE above 0.5% needs explicit_risk_approval
HARD_MAX_LEVERAGE = 5              # 10x+ disabled; 5x only with allow_5x
DEFAULT_MAX_LEVERAGE = 3
VALIDATED_MAX_RISK_PCT = 0.005     # any mode above 0.5% is "experimental" and needs explicit_risk_approval
MIN_PROFIT_LOCK_PCT = 0.10         # at least 10% of each new high-water-mark gain goes to PROFIT_RESERVE
MIN_ROBUSTNESS_THRESHOLD = 70.0
# drawdown ladder from the TOTAL_EQUITY high-water mark: config may only tighten these
LADDER_DEFAULTS = {"dd_caution_pct": 0.03, "dd_reduce_pct": 0.05, "dd_no_new_pct": 0.08, "dd_halt_pct": 0.10}

ROOT = Path(os.environ.get("BFX_HOME", Path(__file__).resolve().parent.parent))


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    mode: str = MODE_PAPER
    trading_equity_usdt: float = 0.0       # TRADING_EQUITY allocation; the bot treats this as the whole account
    gbp_per_usdt: float | None = None      # display/milestones only
    risk_pct: float = 0.0025
    explicit_risk_approval: bool = False   # required for risk_pct > 0.5% (experimental, up to the 1% hard cap)
    strategies: tuple = ("B-EMA10-100-LO-ATR3.5",)   # enabled strategy ids (see bfx/strategies.py)
    allow_shorts: bool = False             # direction -1 entries refused unless set (no short strategy validated)
    allow_5x: bool = False
    margin_mode: str = "isolated"
    instruments: tuple = ("BTC-USDT", "ETH-USDT", "SOL-USDT")
    correlated_groups: tuple = (("BTC-USDT", "ETH-USDT", "SOL-USDT"),)
    bar: str = "4H"
    # strategy B params (must match the validated backtest)
    fast_len: int = 10
    slow_len: int = 100
    regime_len: int = 200
    atr_len: int = 14
    trail_mult: float = 3.5
    # portfolio / breakers
    max_open_risk_pct: float = 0.02
    max_correlated_risk_pct: float = 0.01
    daily_loss_halt_pct: float = 0.02
    weekly_dd_halt_pct: float = 0.05
    strategy_dd_reduce_pct: float = 0.08
    strategy_dd_disable_pct: float = 0.10
    losses_reduce: int = 3
    losses_halt: int = 5
    # drawdown ladder on TOTAL_EQUITY vs its high-water mark (tighten only)
    dd_caution_pct: float = 0.03
    dd_reduce_pct: float = 0.05
    dd_no_new_pct: float = 0.08
    dd_halt_pct: float = 0.10
    # capital engine
    profit_lock_pct: float = 0.10
    # regime classifier
    adx_len: int = 14
    adx_trend_min: float = 20.0
    regime_min_trades: int = 10            # auto-disable a strategy's regime after this many trades with E < 0
    # failure modes
    stale_bars: int = 2                    # last confirmed bar older than this many bars -> no new entries
    telegram_down_min: int = 30            # consecutive Telegram failures this long -> no new entries
    # execution
    max_spread_pct: float = 0.0008
    max_slippage_pct: float = 0.002
    max_entry_drift_atr: float = 0.5       # NO FOMO: skip if price ran > 0.5 ATR past the signal close
    max_signal_age_min: int = 60           # skip signals older than this after bar close
    taker_fee_pct: float = 0.0006
    liq_buffer_stop_frac: float = 0.5      # stop must sit at least 0.5 x stop-distance inside liquidation
    # live-eligibility gate (computed from PAPER journal)
    gate_min_trades: int = 20
    gate_min_pf: float = 1.3
    # gate_source PAPER: needs gate_min_trades closed demo trades. RESEARCH: promotion on the local backtest record
    # (TRAIN/VALIDATION/OOS + cost stress + parameter neighbourhood) instead of days of demo trading.
    gate_source: str = "PAPER"
    backtest_path: str = "research/backtest_B.json"
    gate_min_oos_trades: int = 30          # pooled OOS trades over the traded pairs
    gate_min_oos_trades_pair: int = 15     # per pair (a thinner pair is simply not traded)
    gate_min_param_stability: float = 0.7  # share of neighbouring parameter sets still profitable OOS
    gate_max_oos_dd_pct: float = 8.0       # OOS drawdown at the configured risk (matches the strategy DISABLE level)
    gate_max_research_age_days: int = 30   # stale research => revalidate before live entries
    # backtest baseline for degradation review (OOS Jan 2025-Oct 2026)
    baseline_pf: dict = field(default_factory=lambda: {"BTC-USDT": 1.37, "ETH-USDT": 1.77, "SOL-USDT": 1.75})
    review_every: int = 20
    review_min_pf_ratio: float = 0.6       # DEGRADED below this PF ratio vs baseline
    review_watch_pf_ratio: float = 0.8     # WATCH below this PF ratio vs baseline
    breakeven_r: float = 0.05              # |R| below this is recorded as BE
    robustness_threshold: float = 70.0     # LIVE_ELIGIBLE needs at least this score (can only be raised)
    research_path: str = "research/strategies.json"
    growth_trades: int = 500               # Monte Carlo horizon (trades)
    growth_sims: int = 2000
    # alerts (bot token lives in Keychain service bfx-telegram / account bot_token)
    telegram_chat_id: str | None = None

    @property
    def base_url(self) -> str:
        return BASE_URLS[self.mode]

    @property
    def max_leverage(self) -> int:
        return HARD_MAX_LEVERAGE if self.allow_5x else DEFAULT_MAX_LEVERAGE

    @property
    def state_dir(self) -> Path:
        return ROOT / "state"

    def validate(self) -> None:
        if self.mode not in BASE_URLS:
            raise ConfigError(f"mode must be PAPER or LIVE, got {self.mode!r}")
        if self.trading_equity_usdt <= 0:
            raise ConfigError("trading_equity_usdt must be set (> 0): it is the only capital the bot may use")
        if not 0 < self.risk_pct <= HARD_MAX_RISK_PCT:
            raise ConfigError(f"risk_pct must be in (0, {HARD_MAX_RISK_PCT}]")
        if self.mode == MODE_LIVE and self.risk_pct > LIVE_DEFAULT_MAX_RISK_PCT and not self.explicit_risk_approval:
            raise ConfigError("LIVE risk_pct > 0.5% requires explicit_risk_approval: true")
        if self.risk_pct > VALIDATED_MAX_RISK_PCT and not self.explicit_risk_approval:
            raise ConfigError("risk_pct > 0.5% is experimental and requires explicit_risk_approval: true")
        if not self.strategies:
            raise ConfigError("at least one strategy id must be enabled")
        levels = [getattr(self, k) for k in LADDER_DEFAULTS]
        if any(getattr(self, k) > v for k, v in LADDER_DEFAULTS.items()) or levels != sorted(levels) or min(levels) <= 0:
            raise ConfigError("drawdown ladder levels may only be tightened and must be increasing")
        if not MIN_PROFIT_LOCK_PCT <= self.profit_lock_pct <= 0.5:
            raise ConfigError("profit_lock_pct must be in [0.10, 0.50]")
        if self.robustness_threshold < MIN_ROBUSTNESS_THRESHOLD:
            raise ConfigError(f"robustness_threshold may not be below {MIN_ROBUSTNESS_THRESHOLD}")
        if self.review_min_pf_ratio < 0.6 or self.review_watch_pf_ratio < 0.8:
            raise ConfigError("health PF-ratio thresholds may only be raised")
        if self.review_every > 20 or self.regime_min_trades > 10:
            raise ConfigError("review_every <= 20 and regime_min_trades <= 10 (checks may not be made rarer)")
        if self.gate_source not in ("PAPER", "RESEARCH"):
            raise ConfigError("gate_source must be PAPER or RESEARCH")
        if self.gate_source == "RESEARCH" and (self.gate_min_pf < 1.3 or self.gate_min_oos_trades < 30
                                               or self.gate_min_oos_trades_pair < 15
                                               or self.gate_min_param_stability < 0.7
                                               or self.gate_max_oos_dd_pct > 8.0
                                               or self.gate_max_research_age_days > 30):
            raise ConfigError("RESEARCH gate thresholds may only be tightened")
        if self.margin_mode != "isolated":
            raise ConfigError("margin_mode must be isolated so liquidation is confined to the position margin")
        if self.max_leverage > HARD_MAX_LEVERAGE:
            raise ConfigError("leverage above 5x is disabled")


def load_settings(path: Path | None = None) -> Settings:
    path = path or ROOT / "config.json"
    raw: dict = {}
    if path.exists():
        raw = json.loads(path.read_text())
    known = {f.name for f in fields(Settings)}
    unknown = set(raw) - known
    if unknown:
        raise ConfigError(f"unknown config keys: {sorted(unknown)}")
    for k in ("instruments", "strategies"):
        if k in raw:
            raw[k] = tuple(raw[k])
    if "correlated_groups" in raw:
        raw["correlated_groups"] = tuple(tuple(g) for g in raw["correlated_groups"])
    s = Settings(**raw)
    s.validate()
    return s

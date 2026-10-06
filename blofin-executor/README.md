# bfx — BloFin executor (multi-strategy, closed-loop capital engine)

Stdlib-only Python (3.10+). No third-party packages touch your keys.

Strategies are pluggable (`bfx/strategies.py`); `config.json` `"strategies"` lists the enabled ids (default:
Strategy B only). Strategy B = EMA10/EMA100 cross, long-only, close > EMA200, ATR(14)×3.5 ratcheting stop, 4H,
BTC/ETH/SOL USDT perps. Signals are computed from BloFin's own confirmed candles and match the
validated trader.dev Pine strategy `01M48060TF19E5R3HNM6GE5469`.

## Modes
- `PAPER` (default): only ever talks to `demo-trading-openapi.blofin.com`.
- `LIVE`: refused unless **all** hold: `config.json` says `"mode": "LIVE"`; `python3 -m bfx arm-live` was run
  in a terminal and `ENABLE BLOFIN LIVE TRADING` typed; the PAPER journal passes the eligibility gate
  (≥20 closed demo trades, PF ≥ 1.3, positive expectancy after fees/slippage/funding, no protection failures,
  no unresolved halts). LIVE keys are separate Keychain entries.
- In LIVE each strategy additionally needs **LIVE_ELIGIBLE**: the same gate on *its own* PAPER trades, robustness
  score ≥ `robustness_threshold` (default 70, can only be raised) and PAPER health HEALTHY (not paused).
  Strategy B's walk-forward / stability / cost-stress results are unknown in `research/strategies.json`, so it
  scores ~25–40 and is **not** LIVE_ELIGIBLE until that research is filled in.

## Setup
1. BloFin → Demo Trading → API: create a key with **Read + Trade only** (no Transfer/Withdraw), bind your IP.
   Account settings: One-way position mode (net), Multi-Position off.
2. Store it in Keychain (prompts hide input; nothing lands in shell history):
   ```
   security add-generic-password -U -s bfx-blofin-demo -a api_key -w
   security add-generic-password -U -s bfx-blofin-demo -a api_secret -w
   security add-generic-password -U -s bfx-blofin-demo -a passphrase -w
   ```
3. `cp config.example.json config.json` and set `trading_equity_usdt` (the starting TRADING_CAPITAL allocation;
   after the first run the journal's capital engine is the source of truth for that mode).

## Commands (`python3 -m bfx …`)
| command | what |
|---|---|
| `signals` | current signal, ADX and regime per enabled strategy and pair (public data) |
| `plan [--equity N]` | dry-run order ticket: entry, stop, size, leverage, risk, fees, liquidation (no orders) |
| `preflight` | key permissions, sub-account, position mode, balance, positions, orders |
| `e2e-demo [--inst ETH-USDT]` | **demo only**: min-size IOC entry → stop placed + read back → stop amended → reconcile → close → orphan-stop cleanup → fills/fees journaled → deliberately unprotectable entry must be flattened + `ORDER_PROTECTION_FAILURE` logged |
| `run [--once]` | trade loop (60s cycle; acts once per confirmed 4H bar) |
| `status` | equity, P&L, open risk, drawdown, win rate, PF, expectancy, fees, funding, slippage, regime, streaks, halts |
| `journal [--kind K]`, `trades` | decision log incl. rejected signals; trade rows |
| `review` | overall stats vs backtest baseline |
| `health [--strategy ID]` | on-demand drift check (same rule + pause as the automatic 20-trade review) |
| `strategies` | registry: family, timeframe, validated regimes, health, robustness, LIVE_ELIGIBLE |
| `strategy-resume ID` | resume a paused strategy (type `RESUME <ID>`) |
| `regimes` | strategy × regime matrix (trades, PF, expectancy, win rate) + disabled regimes |
| `regime-enable ID REGIME` | re-enable an auto-disabled regime (type `ENABLE <ID> <REGIME>`) |
| `capital [-n N]` | TRADING_CAPITAL / PROFIT_RESERVE / TOTAL_EQUITY / HWM + ledger |
| `feedback [-n N]` | execution feedback: expected vs actual entry/exit/slippage/fees/R, latency |
| `failures` | active failure modes |
| `robustness [--strategy ID]` | robustness score breakdown + flags |
| `growth [--trades N --sims N]` | milestone distances, realised CAGR (≥30 days), bootstrap Monte Carlo (≥20 trades); never a date |
| `dashboard [--html PATH] [--live]` | text dashboard, or one self-contained HTML file (light/dark, no external assets) |
| `eligibility` | LIVE gate result (account + per strategy) |
| `telegram-test` | send a test alert to Telegram |
| `halts [--clear ID]` | breakers; manual ones need a typed confirmation to clear |

## Capital engine (`bfx/capital.py`, per mode, persisted in the journal)
- TRADING_CAPITAL (TC) starts at the allocation; existing closed trades are replayed once on first start.
- Every realised non-test close adds its NET P&L (after fees, funding, slippage) to TC.
- **10% profit lock**: only realised profit that lifts TOTAL_EQUITY (TC + PROFIT_RESERVE) above the previous
  HIGH_WATER_MARK is lockable: 10% of that excess moves to PROFIT_RESERVE, 90% compounds in TC, then
  HWM = TE. Recovering earlier losses never locks; unrealised P&L never locks; losses only hit TC.
  Example: 1000 → +100 → PR 10 / TC 1090 / HWM 1100; −70 → TC 1020; +70 → TC 1090 (no lock); +50 → PR +5, TC +45.
- Sizing: RISK_AMOUNT = sizing capital × risk%, sizing capital = min(TC, exchange equity − PR). The stored TC is
  never reduced by the cap (a `CAPITAL_CAPPED` warning is journaled instead).
- PROFIT_RESERVE is protected capital: recorded only. There are no transfer/withdraw endpoints in the code.
- Milestones (£ via `gbp_per_usdt`): 50 … 1M; `🏆 CAPITAL MILESTONE` alert at £1k/£10k/£100k/£1M. Milestones never
  change risk.

## Strategy health, regimes, ladder
- Regime classifier (`bfx/regime.py`): ATR% percentile over 500 bars ≥ 0.97 EXTREME_VOLATILITY, ≥ 0.85
  HIGH_VOLATILITY; else ADX(14) < 20 RANGE; else close vs EMA200 with the 20-bar EMA200 slope agreeing UPTREND /
  DOWNTREND; mixed RANGE. A strategy only enters in its validated regimes; EXTREME needs explicit validation.
  Strategy B is validated in UPTREND/RANGE/HIGH_VOLATILITY (exactly what its own close > EMA200 filter admitted
  before), so its entries are unchanged.
- Health (every 20 closed non-test trades per strategy, on the last 20): **DISABLED** if mean R is significantly
  < 0 (one-sided t < −2.326, p<0.01); **DEGRADED** if PF / baseline PF < 0.6 or net expectancy ≤ 0;
  **WATCH** if PF ratio < 0.8, mean R significantly below the baseline expectancy (t < −1.645) or any drift
  (win rate −15pp, DD > 1.5×, slippage > 2×, fees > 1.5×, frequency outside 0.5–2×); else **HEALTHY**.
  Fewer than 20 trades = no evidence (HEALTHY, flagged). Unknown baselines never flag.
  DEGRADED/DISABLED → strategy PAUSED (no new entries; open trades keep stops/trailing/exits). Nothing
  re-optimises; `strategy-resume` needs the typed phrase.
- Strategy × regime: ≥ 10 trades in a regime with expectancy < 0 → that regime is disabled for new entries;
  `regime-enable` needs the typed phrase and restarts the sample.
- Drawdown ladder on TOTAL_EQUITY vs HWM (unrealised losses count, gains don't): 3% CAUTION (alert only),
  5% new-trade risk ×0.5, 8% no new positions, 10% HALT (`DRAWDOWN_HALT`, manual reset). Thresholds may only be
  tightened in config. All multipliers compound downward and never exceed 1.

## Failure modes → no new entries, existing positions protected
BloFin unreachable, stale market data (last confirmed bar older than 2 bars), reconciliation mismatch
(size mismatch or unmanaged position), stop placement failure, balance unverifiable, corrupted/unparseable
state (sqlite quick_check, capital state, failure index), Telegram failing ≥ 30 min. Each emits
`🚨 FAILURE` when it starts and `✅ RESTORED` when it clears (`python3 -m bfx failures`).

## Risk rules enforced in code
Risk 0.25% default (hard cap 1%; anything > 0.5% is experimental and needs `explicit_risk_approval`), size = risk ÷ (stop distance + fees + max slippage),
floored to lot size — **never rounded up**; below exchange minimum → rejected. Isolated margin; leverage = smallest that fits margin,
max 3x (5x with `allow_5x`); trade rejected if estimated or actual liquidation isn't well beyond the stop. Max open risk 2%,
correlated (BTC/ETH/SOL) 1%. Breakers: daily −2% (auto-clears next UTC day), weekly −5%, strategy DD 8% halves risk / 10% disables,
3 losses halve risk / 5 halt. Entry via IOC limit capped at max slippage (no chasing), NO FOMO drift check, stale-signal check,
no pyramiding/averaging. Stops only ratchet favourably; exits/trailing keep running under halts.

## Telegram alerts
Optional. Set `"telegram_chat_id"` in `config.json` and store the bot token in Keychain:
```
security add-generic-password -U -s bfx-telegram -a bot_token -w
```
Then `python3 -m bfx telegram-test`. Alerts: loop start, entries, `📊 TRADE FEEDBACK` after every close, `🔐 PROFIT
LOCKED`, `🏆 CAPITAL MILESTONE`, drawdown-ladder changes, health changes / pauses, regime disables, failure /
restored, stop moves, rejected signals, order and protection failures, reconcile mismatches, halts. Amounts in £
when `gbp_per_usdt` is set. Messages never include keys or tokens. Per-bar checks and
`e2e-demo` stay journal-only. Sends run in a background thread; a Telegram outage never affects open trades, but
30 min of consecutive send failures blocks new entries until a send succeeds.

## Adding a strategy
Subclass `Strategy` in `bfx/strategies.py` (id, family, timeframe, instruments, directions, validated_regimes,
`Baseline`, unique `cid_prefix`; `analyze()`, `initial_stop()`, optional `trail_stop()` / `take_profit()`),
`register()` it, add its research record to `research/strategies.json`, and list its id in `"strategies"`.
Shorts (direction −1) are supported in sizing, stops, liquidation checks and trailing but refused unless
`allow_shorts` is set; no short strategy has been validated or run through `e2e-demo`.

## Journal migrations
Existing `state/journal.sqlite` files upgrade in place on open (new columns via ALTER TABLE, new tables via
CREATE IF NOT EXISTS, `PRAGMA user_version` = 2). Test trades (`is_test=1`) stay excluded everywhere.

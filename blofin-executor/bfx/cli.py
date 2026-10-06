"""Command line: python3 -m bfx <command>. Defaults to PAPER (BloFin Demo)."""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from . import dashboard as dash
from . import health as hl
from . import strategies as reg
from .capital import MILESTONES_GBP, CapitalCorrupt, CapitalEngine, next_milestone_gbp  # noqa: F401
from .client import BlofinClient, BlofinError, TransportError
from .config import LIVE_ARM_PHRASE, MODE_LIVE, MODE_PAPER, ROOT, ConfigError, Settings, load_settings
from .executor import Executor, SafetyError, eligibility, stats, strategy_eligibility
from .failsafe import FailureMonitor
from .growth import growth_report
from .journal import Journal
from .notify import load_notifier
from .regime import REGIMES, normalize
from .risk import TradeRejected, plan_trade, fmt
from .robustness import load_research
from .secrets import CredentialError, load_credentials


def money(s: Settings, usdt: float | None) -> str:
    if usdt is None:
        return "-"
    gbp = f" (£{usdt * s.gbp_per_usdt:,.2f})" if s.gbp_per_usdt else ""
    return f"{usdt:,.4f} USDT{gbp}"


def ts(ms) -> str:
    return datetime.fromtimestamp(int(ms) / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if ms else "-"


def build(s: Settings, auth: bool = True, notify: bool = True):
    creds = load_credentials(s.mode) if auth else None
    client = BlofinClient(s.base_url, creds)
    db = s.state_dir / "journal.sqlite"
    n = load_notifier(s.telegram_chat_id, s.mode, s.gbp_per_usdt, s.telegram_down_min) if notify else None
    j = Journal(db, s.mode, notifier=n)
    paper = j if s.mode == MODE_PAPER else Journal(db, MODE_PAPER)
    return Executor(client, s, j, paper_journal=paper)


def journal(s, mode=None):
    return Journal(s.state_dir / "journal.sqlite", mode or s.mode)


def cmd_signals(s, args):
    ex = build(s, auth=False, notify=False)
    for strat in ex.strategies:
        print(f"== {strat.id} ({strat.timeframe}; validated regimes {sorted(strat.validated_regimes)})")
        for inst in [i for i in s.instruments if not strat.instruments or i in strat.instruments]:
            a = strat.analyze(inst, ex.c.candles(inst, strat.timeframe, 1000), s)
            sig = ("ENTER " + ("LONG" if a.direction > 0 else "SHORT")) if a.entry_signal else \
                "EXIT" if a.exit_signal else "none"
            print(f"{inst:9} bar {ts(a.bar_ts)}  close {a.close:<10g} EMA10 {a.fast:<10.4f} EMA100 {a.slow:<10.4f} "
                  f"EMA200 {a.regime_ema:<10.4f} ATR {a.atr:<8.4f} ADX {a.adx or 0:<6.1f} regime {a.regime:<18} "
                  f"{'(entry allowed)' if strat.allows_regime(a.regime) else '(regime not validated)'} signal {sig}")


def cmd_plan(s, args):
    """Dry run: what an entry would look like right now (no orders)."""
    ex = build(s, auth=not args.equity)
    if args.equity:
        equity, balance, capped = args.equity, None, False
    else:
        snap = ex.snapshot()
        equity, balance, capped = snap.trading_equity, snap.exchange_equity, bool(getattr(snap, "capped", False))
    for strat, inst in [(x, i) for x in ex.strategies for i in s.instruments
                        if not x.instruments or i in x.instruments]:
        a = strat.analyze(inst, ex.c.candles(inst, strat.timeframe, 1000), s)
        tk = ex.c.ticker(inst)
        ask = float(tk["askPrice"])
        print(f"\nSTRATEGY        {strat.id} ({s.mode})\nPAIR            {inst}\nTIMEFRAME       {strat.timeframe}")
        print(f"CURRENT SIGNAL  {'ENTER LONG' if a.entry_signal else 'EXIT' if a.exit_signal else 'NO SIGNAL = NO TRADE'}"
              f"  | regime {a.regime}")
        print(f"BLOFIN BALANCE  {money(s, balance)}\nSIZING CAPITAL  {money(s, equity)} "
              f"({'TRADING_CAPITAL capped to exchange equity' if capped else 'TRADING_CAPITAL'})")
        try:
            p = plan_trade(ex.spec(inst), +1, ask, strat.initial_stop(a, s), equity, s.risk_pct, s)
        except TradeRejected as e:
            print(f"HYPOTHETICAL    REJECTED: {e}")
            continue
        print(f"ENTRY           {p.entry_ref}  (IOC cap {fmt(p.limit_price)})\nSTOP            {fmt(p.stop)}"
              f"\nPOSITION SIZE   {fmt(p.size)} contracts = {p.qty_base:g} {inst.split('-')[0]}  notional {p.notional:.2f}"
              f"\nLEVERAGE        {p.leverage}x isolated   est. liq {p.est_liq:.4f}  (stop-liq gap {p.stop_liq_gap:.4f})"
              f"\nRISK            {money(s, p.risk_amount)} = {p.risk_pct:.3%}\nTARGET          {p.target}"
              f"\nEXPECTED R:R    open-ended (trend follower; backtest OOS PF {strat.baseline.pf.get(inst)})"
              f"\nEST. FEES       {money(s, p.est_fees)}   est. slippage {money(s, p.est_slippage)}"
              f"\nMAX LOSS        {money(s, p.risk_amount)} (gap risk beyond stop not included)")


def cmd_preflight(s, args):
    print(json.dumps(build(s).preflight(), indent=2, default=str))


def cmd_status(s, args):
    ex = build(s)
    snap = ex.snapshot()
    j = ex.j
    closed = j.closed_trades()
    st = stats(closed)
    now = j.clock()
    day = j.realized_pnl(now - now % 86_400_000)
    wk = j.realized_pnl(now - 7 * 86_400_000)
    mo = j.realized_pnl(now - 30 * 86_400_000)
    wins, losses = j.consecutive()
    nxt = next_milestone_gbp(snap.total_equity, s.gbp_per_usdt)
    regimes = {e["inst_id"]: json.loads(e["detail"]).get("regime") for e in reversed(j.events("BAR", 50))}
    print(f"MODE {s.mode} @ {s.base_url}   STRATEGIES {', '.join(x.id for x in ex.strategies)}")
    print(f"TRADING CAPITAL  {money(s, snap.trading_capital)}  (sizing {money(s, snap.trading_equity)}"
          f"{' CAPPED by exchange' if snap.capped else ''})")
    print(f"PROFIT RESERVE   {money(s, snap.profit_reserve)}   TOTAL EQUITY {money(s, snap.total_equity)}   "
          f"HWM {money(s, snap.hwm)}")
    print(f"EXCHANGE EQUITY  {money(s, snap.exchange_equity)}  (allocation {money(s, s.trading_equity_usdt)})")
    if s.gbp_per_usdt:
        print(f"NEXT MILESTONE   £{nxt:,}" if nxt else "NEXT MILESTONE   -")
    print(f"P&L realised     today {money(s, day)} | 7d {money(s, wk)} | 30d {money(s, mo)} | "
          f"unrealised {money(s, snap.unrealized)}")
    print(f"OPEN POSITIONS   {list(snap.positions) or 'none'}   OPEN RISK {money(s, sum(snap.open_risks.values()))}")
    print(f"MAX DRAWDOWN     {money(s, st['max_drawdown'])}   WIN RATE {st['win_rate']}   PF {st['profit_factor']}"
          f"   EXPECTANCY {money(s, st['expectancy'])} ({st['expectancy_r']} R)")
    print(f"FEES {money(s, st['fees'])}  FUNDING {money(s, st['funding'])}  SLIPPAGE {money(s, st['slippage'])}")
    print(f"CURRENT REGIME   {regimes or 'no bars processed yet'}")
    print(f"STREAK           wins {wins} / losses {losses}")
    halts = j.active_halts()
    print(f"HALTS            {[(h['id'], h['kind'], h['reason']) for h in halts] or 'none'}")
    print(f"FAILURES         {sorted(ex.fail.active()) or 'none'}   LADDER {j.get('ladder_level', 'NORMAL')}")
    for x in ex.strategies:
        st, paused = hl.status(j, x.id)
        print(f"STRATEGY HEALTH  {x.id}: {st}{' (PAUSED)' if paused else ''}")
    if snap.blocked:
        print(f"UNMANAGED        {sorted(snap.blocked)} (bot will not trade these)")


def cmd_journal(s, args):
    j = Journal(s.state_dir / "journal.sqlite", s.mode)
    for e in reversed(j.events(args.kind, args.n)):
        print(f"{ts(e['ts'])} {e['kind']:<26} {e['inst_id'] or '':9} {e['detail']}")


def cmd_trades(s, args):
    j = Journal(s.state_dir / "journal.sqlite", s.mode)
    rows = j.db.execute("SELECT * FROM trades WHERE mode=? ORDER BY id DESC LIMIT ?", (s.mode, args.n)).fetchall()
    for t in rows:
        print({k: t[k] for k in t.keys()})


def cmd_review(s, args):
    j = journal(s)
    closed = j.closed_trades()
    print(json.dumps({"all": stats(closed), f"last_{s.review_every}": stats(closed[-s.review_every:]),
                      "baseline_pf": {x.id: x.baseline.pf for x in reg.enabled(s)}}, indent=2, default=str))
    print("(per-strategy drift: python3 -m bfx health)")


def cmd_eligibility(s, args):
    paper = journal(s, MODE_PAPER)
    ok, reasons = eligibility(paper, s)
    print("LIVE ELIGIBLE (account gate)" if ok else "NOT ELIGIBLE -> DO NOT TRADE LIVE")
    for r in reasons:
        print(f"  - {r}")
    research, err = load_research(ROOT / s.research_path)
    for x in reg.enabled(s):
        ok, reasons, rob = strategy_eligibility(paper, s, x, research, err)
        print(f"{x.id}: LIVE_ELIGIBLE {'YES' if ok else 'NO'} (robustness {rob.score})")
        for r in reasons:
            print(f"  - {r}")


def _strategy_arg(s, sid):
    x = reg.get(sid)
    if x is None:
        raise ConfigError(f"unknown strategy {sid!r}; registered: {sorted(reg.REGISTRY)}")
    return x


def cmd_strategies(s, args):
    j, paper = journal(s), journal(s, MODE_PAPER)
    research, err = load_research(ROOT / s.research_path)
    for sid, x in sorted(reg.REGISTRY.items()):
        st, paused = hl.status(j, sid)
        ok, _, rob = strategy_eligibility(paper, s, x, research, err)
        print(f"{sid}\n  family {x.family}  timeframe {x.timeframe}  instruments {list(x.instruments) or 'any'}  "
              f"directions {list(x.directions)}\n  validated regimes {sorted(x.validated_regimes)}  "
              f"enabled {sid in s.strategies}\n  health {st}{' PAUSED' if paused else ''}  robustness {rob.score}  "
              f"LIVE_ELIGIBLE {'YES' if ok else 'NO'}  disabled regimes "
              f"{[r['regime'] for r in j.disabled_regimes(sid)] or 'none'}")


def cmd_health(s, args):
    """On-demand drift check vs backtest baseline (applies the same pause rule as the automatic review)."""
    ex_j = build(s, auth=False).j
    for x in ([_strategy_arg(s, args.strategy)] if args.strategy else reg.enabled(s)):
        rep = hl.review(ex_j, s, x, force=True)
        m = rep.metrics
        st, paused = hl.status(ex_j, x.id)
        print(f"{x.id}: {rep.status}{' (PAUSED)' if paused else ''}  n={rep.n} (window {s.review_every})")
        print(f"  PF {_r3(m['profit_factor'])} vs baseline {_r3(rep.pf_baseline)} -> ratio {_r3(rep.pf_ratio)}")
        print(f"  mean R {_r3(m['expectancy_r'])}  sd {_r3(m['sd_r'])}  t(vs 0) {_r3(rep.t_vs_zero)}  "
              f"t(vs baseline) {_r3(rep.t_vs_baseline)}")
        print(f"  win rate {m['win_rate']}  net E {m['expectancy']}  DD% {m['max_dd_pct']}  slippage% "
              f"{m['avg_slippage_pct']}  fee% {m['avg_fee_pct']}  trades/month/symbol {m['trades_per_month']}")
        print(f"  drift {rep.drift}")
        for r in rep.reasons:
            print(f"  - {r}")


def cmd_strategy_resume(s, args):
    x = _strategy_arg(s, args.strategy)
    j = build(s, auth=False).j
    st, paused = hl.status(j, x.id)
    if not paused:
        print(f"{x.id} is not paused (health {st})")
        return 0
    print(f"{x.id} paused with health {st}: {j.strategy_state(x.id)['reason']}")
    if _confirm(f"Diagnostics done, nothing re-optimised? Type 'RESUME {x.id}': ", f"RESUME {x.id}"):
        hl.resume(j, x.id)
        print("resumed (health WATCH until the next review)")
        return 0
    print("not resumed")
    return 1


def cmd_regimes(s, args):
    j = journal(s)
    if not j.closed_trades():
        print("no closed trades yet")
    for (sid, regime), v in hl.regime_matrix(j.closed_trades()).items():
        flag = " DISABLED" if hl.regime_disabled(j, sid, regime) else ""
        print(f"{sid:<26} {regime:<20} n={v['trades']:<4} PF {v['profit_factor']}  E {v['expectancy']}  "
              f"E(R) {v['expectancy_r']}  win {v['win_rate']}{flag}")
    for r in j.disabled_regimes():
        print(f"disabled: {r['strategy_id']} / {r['regime']} since {ts(r['updated_ts'])}: {r['reason']}")


def cmd_regime_enable(s, args):
    x = _strategy_arg(s, args.strategy)
    regime = normalize(args.regime)
    if regime not in REGIMES:
        raise ConfigError(f"regime must be one of {REGIMES}")
    j = build(s, auth=False).j
    if not hl.regime_disabled(j, x.id, regime):
        print(f"{x.id} / {regime} is not disabled")
        return 0
    if _confirm(f"Type 'ENABLE {x.id} {regime}' to allow new entries again: ", f"ENABLE {x.id} {regime}"):
        hl.enable_regime(j, x.id, regime)
        print("re-enabled (evidence restarts from now)")
        return 0
    print("not re-enabled")
    return 1


def _gbp_ms(m) -> str:
    return f"£{m:,}" if m else "-"


def _r3(v):
    return round(v, 3) if isinstance(v, float) else v


def cmd_capital(s, args):
    j = journal(s)
    try:
        st = CapitalEngine(j, s).state()
    except CapitalCorrupt as e:
        print(f"STOP: {e}", file=sys.stderr)
        return 2
    print(f"[{s.mode}] TRADING CAPITAL {money(s, st.trading_capital)}\n  PROFIT RESERVE {money(s, st.profit_reserve)} "
          f"(protected, never traded or moved by code)\n  TOTAL EQUITY {money(s, st.total_equity)}\n  "
          f"HIGH-WATER MARK {money(s, st.high_water_mark)}\n  initial {money(s, st.initial)}  next milestone "
          f"{_gbp_ms(next_milestone_gbp(st.total_equity, s.gbp_per_usdt))}")
    for r in j.ledger()[-args.n:]:
        print(f"  {ts(r['ts'])} {r['kind']:<6} trade {r['trade_id']} net {r['net_pnl']:+.4f} locked {r['locked']:.4f} "
              f"TC {r['trading_capital']:.4f} PR {r['profit_reserve']:.4f} TE {r['total_equity']:.4f} "
              f"HWM {r['high_water_mark']:.4f}")


def cmd_robustness(s, args):
    paper = journal(s, MODE_PAPER)
    research, err = load_research(ROOT / s.research_path)
    for x in ([_strategy_arg(s, args.strategy)] if args.strategy else reg.enabled(s)):
        ok, reasons, rob = strategy_eligibility(paper, s, x, research, err)
        print(f"{x.id}: ROBUSTNESS {rob.score}/100 (threshold {s.robustness_threshold})  "
              f"LIVE_ELIGIBLE {'YES' if ok else 'NO'}")
        for k, (raw, w, pts) in rob.components.items():
            print(f"  {k:<16} {raw:>6.3f} x {w:>2} = {pts:>5.2f}")
        for f in rob.flags:
            print(f"  ! {f}")
        for r in reasons:
            print(f"  - {r}")


def cmd_growth(s, args):
    j = journal(s)
    try:
        st = CapitalEngine(j, s).state()
    except CapitalCorrupt as e:
        print(f"STOP: {e}", file=sys.stderr)
        return 2
    row = j.capital_row()
    starts = [row["created_ts"]] + [t["opened_ts"] for t in j.closed_trades()[:1]]
    rs = {x.id: [t["r_multiple"] for t in j.closed_trades(strategy_id=x.id) if t["r_multiple"] is not None]
          for x in reg.enabled(s)}
    rep = growth_report(st, s.gbp_per_usdt, min(v for v in starts if v), j.clock(), rs, s.risk_pct,
                        s.profit_lock_pct, args.trades or s.growth_trades, args.sims or s.growth_sims,
                        s.dd_no_new_pct, [r["total_equity"] for r in j.ledger()])
    print(f"[{s.mode}] TOTAL EQUITY {money(s, rep['total_equity'])}  HWM {money(s, rep['hwm'])}  "
          f"current DD {rep['current_dd']:.2%}  max DD {rep['max_dd']:.2%}")
    r = rep["rates"]
    print("realised growth: " + (r["note"] if r["note"] else
          f"CAGR {r['cagr']:+.2%}  monthly {r['monthly']:+.2%} over {r['days']:.0f} days"))
    if not rep["milestones"]:
        print("milestones need gbp_per_usdt in config.json")
    for g, m in rep["milestones"].items():
        need = 'reached' if m['reached'] else f"needs x{m['required_multiple']:,.2f} from here"
        print(f"£{g:>9,}: {need}")
    for sid, mc in rep["monte_carlo"].items():
        print(f"\nMonte Carlo {sid}: " + (mc["note"] if "note" in mc else
              f"{mc['sims']} paths x {mc['n_trades']} trades at risk {s.risk_pct:.2%} of TC, bootstrap of actual R"))
        if "note" in mc:
            continue
        print(f"  P(-10% DD within horizon) {mc['p_dd10']:.1%}  P(-25%) {mc['p_dd25']:.1%}  "
              f"P(touch ladder no-new level) {mc['p_ladder_no_new']:.1%}  P(ruin) {mc['p_ruin']:.1%}")
        for g, v in mc["targets"].items():
            print(f"  £{g:>9,}: P(reach within {mc['n_trades']} trades) {v['p_reach']:.1%}  "
                  f"P(-10% first) {v['p_dd10_first']:.1%}  P(-25% first) {v['p_dd25_first']:.1%}")
    print("\nNo arrival dates are estimated: trade frequency and future returns are uncertain.")


def cmd_dashboard(s, args):
    j = journal(s)
    snap = None
    if args.live:
        try:
            snap = build(s, notify=False).snapshot()
        except (CredentialError, BlofinError, TransportError, CapitalCorrupt) as e:
            print(f"(exchange snapshot unavailable: {e}; showing journal only)", file=sys.stderr)
    d = dash.collect(j, s, snap, journal(s, MODE_PAPER))
    if args.html:
        Path(args.html).write_text(dash.render_html(d))
        print(f"wrote {args.html}")
    else:
        print(dash.render_text(d))


def cmd_feedback(s, args):
    rows = journal(s).feedback(include_test=args.include_test, limit=args.n)
    if not rows:
        print("no execution feedback yet (one row per completed trade)")
    for r in rows:
        print({k: r[k] for k in r.keys() if k not in ("mode",)})


def cmd_failures(s, args):
    act = FailureMonitor(journal(s)).active()
    if not act:
        print("no active failure modes")
    for name, v in act.items():
        print(f"{name} since {ts(v['since'])}: {v.get('detail')}")


def cmd_run(s, args):
    ex = build(s)
    ex.preflight()
    if not args.once:
        snap = ex.snapshot()
        ex.j.event("LOOP_STARTED", None, instruments=",".join(s.instruments),
                   strategies=",".join(x.id for x in ex.strategies), trading_capital=snap.trading_capital,
                   profit_reserve=snap.profit_reserve, telegram=bool(ex.j.notifier))
    while True:
        try:
            ex.run_cycle()
        except SafetyError:
            raise
        except Exception as e:  # keep running; every failure is journaled
            ex.j.event("CYCLE_ERROR", None, error=repr(e))
            print(f"{ts(ex.clock())} cycle error: {e!r}", file=sys.stderr)
        if args.once:
            return
        time.sleep(args.interval)


def cmd_e2e_demo(s, args):
    if s.mode != MODE_PAPER:
        raise SafetyError("e2e-demo only runs in PAPER mode")
    ok = build(s, notify=False).e2e_demo(args.inst)  # test fills stay journal-only
    return 0 if ok else 1


def cmd_telegram_test(s, args):
    n = load_notifier(s.telegram_chat_id, s.mode)
    if not n:
        print("Telegram off: set telegram_chat_id in config.json and store the bot token with:\n"
              "  security add-generic-password -U -s bfx-telegram -a bot_token -w", file=sys.stderr)
        return 1
    ok = n.send(f"[{s.mode}] bfx Telegram test OK. Strategies {', '.join(s.strategies)}, "
                f"allocation {s.trading_equity_usdt} USDT.")
    print("sent" if ok else "send FAILED (check token / that you've pressed Start on the bot / chat id)")
    return 0 if ok else 1


def _confirm(prompt: str, expected: str) -> bool:
    if not sys.stdin.isatty():
        print("refusing: this confirmation must be typed interactively", file=sys.stderr)
        return False
    return input(prompt).strip() == expected


def cmd_research(s, args):
    """Re-run the local backtest/OOS/stress and rewrite the record the RESEARCH live gate reads (public data only)."""
    from .backtest import run_research
    rec = run_research(list(s.instruments), s.state_dir / "history", refresh=args.refresh)
    (ROOT / s.backtest_path).write_text(json.dumps(rec, indent=1))
    for inst, d in rec["symbols"].items():
        o = d["oos_stress"]
        print(f"{inst}: OOS {d['splits']['OOS']} | 2x costs PF {o['2x_costs']['pf']} | "
              f"5x slippage PF {o['5x_slippage']['pf']} | stability {d['param_neighbourhood']['share_profitable']}")
    print(f"written {s.backtest_path}; run `eligibility` to see the gate result")


def cmd_arm_live(s, args):
    ok, reasons = eligibility(Journal(s.state_dir / "journal.sqlite", MODE_PAPER), s)
    if not ok:
        print("NOT ELIGIBLE for LIVE:\n  - " + "\n  - ".join(reasons))
        return 1
    if not _confirm(f"Type exactly '{LIVE_ARM_PHRASE}' to allow real-money orders: ", LIVE_ARM_PHRASE):
        print("not armed")
        return 1
    s.state_dir.mkdir(parents=True, exist_ok=True)
    (s.state_dir / "LIVE_ARMED").write_text(f"{LIVE_ARM_PHRASE}\n{ts(time.time() * 1000)}\n")
    print("LIVE armed. config.json must also say \"mode\": \"LIVE\".")


def cmd_disarm_live(s, args):
    p = s.state_dir / "LIVE_ARMED"
    if p.exists():
        p.unlink()
    print("LIVE disarmed")


def cmd_halts(s, args):
    j = Journal(s.state_dir / "journal.sqlite", s.mode)
    for h in j.active_halts():
        print(f"#{h['id']} {h['kind']} since {ts(h['ts'])}: {h['reason']} (manual reset: {bool(h['manual_reset'])})")
    if args.clear is not None:
        if _confirm(f"Reviewed the cause? Type 'CLEAR {args.clear}': ", f"CLEAR {args.clear}"):
            j.clear_halt(args.clear)
            print("cleared")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="bfx")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("signals", help="current signal + regime per enabled strategy and instrument (public data)")
    sp = sub.add_parser("plan", help="dry-run order ticket for each instrument (no orders)")
    sp.add_argument("--equity", type=float, help="hypothetical TRADING_EQUITY in USDT (skips auth)")
    sub.add_parser("preflight", help="API key, position mode, balance, positions, orders")
    sub.add_parser("status", help="live monitor")
    sp = sub.add_parser("journal")
    sp.add_argument("--kind")
    sp.add_argument("-n", type=int, default=40)
    sp = sub.add_parser("trades")
    sp.add_argument("-n", type=int, default=20)
    sub.add_parser("review", help="performance vs backtest baseline")
    sub.add_parser("eligibility", help="LIVE promotion gate from PAPER results")
    sp = sub.add_parser("run", help="trade loop")
    sp.add_argument("--once", action="store_true")
    sp.add_argument("--interval", type=int, default=60)
    sp = sub.add_parser("e2e-demo", help="end-to-end order/stop/reconcile test on BloFin Demo")
    sp.add_argument("--inst", default="ETH-USDT")
    sub.add_parser("telegram-test", help="send a test Telegram alert")
    sub.add_parser("strategies", help="registered strategies, health, robustness, LIVE_ELIGIBLE")
    sp = sub.add_parser("health", help="on-demand drift check vs backtest baseline")
    sp.add_argument("--strategy")
    sp = sub.add_parser("strategy-resume", help="resume a paused strategy (typed confirmation)")
    sp.add_argument("strategy")
    sub.add_parser("regimes", help="strategy x regime matrix + disabled regimes")
    sp = sub.add_parser("regime-enable", help="re-enable an auto-disabled regime (typed confirmation)")
    sp.add_argument("strategy")
    sp.add_argument("regime")
    sp = sub.add_parser("capital", help="TRADING_CAPITAL / PROFIT_RESERVE / TOTAL_EQUITY / HWM + ledger")
    sp.add_argument("-n", type=int, default=10)
    sp = sub.add_parser("robustness", help="robustness score breakdown")
    sp.add_argument("--strategy")
    sp = sub.add_parser("growth", help="milestone growth model + bootstrap Monte Carlo (no dates)")
    sp.add_argument("--trades", type=int)
    sp.add_argument("--sims", type=int)
    sp = sub.add_parser("dashboard", help="text dashboard, or --html PATH for a self-contained HTML file")
    sp.add_argument("--html")
    sp.add_argument("--live", action="store_true", help="also read unrealised P&L from the exchange")
    sp = sub.add_parser("feedback", help="execution feedback rows (expected vs actual)")
    sp.add_argument("-n", type=int, default=20)
    sp.add_argument("--include-test", action="store_true")
    sub.add_parser("failures", help="active failure modes")
    sp = sub.add_parser("research", help="re-run backtest/OOS/cost-stress; rewrites the RESEARCH gate record")
    sp.add_argument("--refresh", action="store_true", help="re-download candle history")
    sub.add_parser("arm-live")
    sub.add_parser("disarm-live")
    sp = sub.add_parser("halts")
    sp.add_argument("--clear", type=int)
    args = p.parse_args(argv)
    try:
        s = load_settings()
        fn = globals()["cmd_" + args.cmd.replace("-", "_")]
        return fn(s, args) or 0
    except (SafetyError, CredentialError, BlofinError, ConfigError) as e:
        print(f"STOP: {e}", file=sys.stderr)
        return 2

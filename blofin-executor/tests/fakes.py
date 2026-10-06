"""In-memory BloFin stand-in for executor tests (no network)."""
from __future__ import annotations

from decimal import Decimal

from bfx.client import BlofinError, TransportError
from bfx.config import BASE_URLS, MODE_PAPER

SPECS = {
    "ETH-USDT": {"instId": "ETH-USDT", "contractValue": "0.01", "minSize": "0.1", "lotSize": "0.1",
                 "tickSize": "0.01", "maxLeverage": "150"},
    "BTC-USDT": {"instId": "BTC-USDT", "contractValue": "0.001", "minSize": "0.1", "lotSize": "0.1",
                 "tickSize": "0.1", "maxLeverage": "150"},
    "SOL-USDT": {"instId": "SOL-USDT", "contractValue": "1", "minSize": "0.01", "lotSize": "0.01",
                 "tickSize": "0.01", "maxLeverage": "75"},
}


class FakeExchange:
    def __init__(self, equity: float = 1000.0):
        self.base_url = BASE_URLS[MODE_PAPER]
        self.now = 1_800_000_000_000
        self.price = {"ETH-USDT": 2700.0, "BTC-USDT": 100_000.0, "SOL-USDT": 200.0}
        self.equity = equity
        self.pos: dict = {}
        self.stops: dict = {}
        self.orders: dict = {}
        self.fills: list = []
        self.candle_rows: dict = {}
        self.fail_stop_places = 0
        self.liq_override: float | None = None
        self.calls: list = []
        self._id = 100
        self.upnl = 0.0
        self.balance_override = None
        self.unreachable = False

    def clock(self) -> int:
        return self.now

    def _nid(self) -> str:
        self._id += 1
        return str(self._id)

    # market
    def instrument(self, inst):
        return SPECS[inst]

    def position_tiers(self, inst, mm):
        return [{"maintenanceMarginRate": "0.003"}]

    def ticker(self, inst):
        p = self.price[inst]
        return {"bidPrice": str(p - 0.01), "askPrice": str(p), "last": str(p)}

    def candles(self, inst, bar, limit=1000):
        return self.candle_rows[inst][-limit:]

    # account
    def query_apikey(self):
        return {"readOnly": 0, "parentUid": "42", "ips": ["1.2.3.4"]}

    def position_mode(self):
        return {"positionMode": "net_mode", "multiPosition": "false"}

    def balance(self):
        if self.unreachable:
            raise TransportError("GET /api/v1/account/balance: simulated outage")
        if self.balance_override is not None:
            return self.balance_override
        return {"details": [{"currency": "USDT", "equity": str(self.equity), "available": str(self.equity)}]}

    def positions(self, inst=None):
        return [{"instId": i, "positions": format(p["size"], "f"), "averagePrice": str(p["avg"]),
                 "liquidationPrice": str(self.liq_override if self.liq_override is not None else p["avg"] * 0.01),
                 "unrealizedPnl": str(self.upnl)} for i, p in self.pos.items() if inst in (None, i)]

    def orders_pending(self, inst=None):
        return []

    def tpsl_pending(self, inst=None):
        return [dict(o) for o in self.stops.values() if inst in (None, o["instId"]) and o["state"] == "live"]

    def set_leverage(self, inst, lev, mm):
        self.calls.append(("set_leverage", inst, lev))

    def funding_fees(self, inst, b, e):
        return []

    # trading
    def place_order(self, *, inst_id, side, order_type, size, margin_mode, price=None, client_order_id=None,
                    reduce_only=False, position_side="net"):
        self.calls.append(("place_order", inst_id, side, order_type, size, price))
        oid = self._nid()
        ask = self.price[inst_id]
        cv = float(SPECS[inst_id]["contractValue"])
        if order_type == "ioc" and float(price) < ask:
            self.orders[oid] = {"orderId": oid, "state": "canceled", "filledSize": "0", "averagePrice": "0", "fee": "0"}
            return {"orderId": oid}
        sz = Decimal(size)
        fee = float(sz) * cv * ask * 0.0006
        self.pos[inst_id] = {"size": sz, "avg": ask}
        self.fills.append({"instId": inst_id, "side": side, "fillPrice": str(ask), "fillSize": size,
                           "fee": str(fee), "ts": str(self.now), "orderId": oid})
        self.orders[oid] = {"orderId": oid, "state": "filled", "filledSize": size, "averagePrice": str(ask),
                            "fee": str(fee), "clientOrderId": client_order_id}
        return {"orderId": oid}

    def order_detail(self, inst, order_id=None, client_order_id=None):
        if order_id:
            return self.orders[order_id]
        return next(o for o in self.orders.values() if o.get("clientOrderId") == client_order_id)

    def cancel_order(self, inst, oid):
        pass

    def place_stop(self, *, inst_id, close_side, size, trigger, margin_mode, client_order_id=None,
                   position_side="net"):
        self.calls.append(("place_stop", inst_id, trigger))
        if self.fail_stop_places > 0:
            self.fail_stop_places -= 1
            raise BlofinError("152400", "simulated stop rejection", "/api/v1/trade/order-tpsl")
        if inst_id not in self.pos:
            raise BlofinError("152401", "no position", "/api/v1/trade/order-tpsl")
        if float(trigger) >= self.price[inst_id]:
            raise BlofinError("152402", "SL trigger must be below last price", "/api/v1/trade/order-tpsl")
        tid = self._nid()
        self.stops[tid] = {"tpslId": tid, "instId": inst_id, "slTriggerPrice": trigger, "size": size,
                           "state": "live", "clientOrderId": client_order_id}
        return {"tpslId": tid}

    def amend_stop(self, inst, tid, trig):
        self.stops[tid]["slTriggerPrice"] = trig
        return {"tpslId": tid}

    def cancel_stop(self, inst, tid):
        self.stops[tid]["state"] = "canceled"

    def close_position(self, inst, mm, side="net", client_order_id=None):
        self.calls.append(("close_position", inst))
        p = self.pos.pop(inst, None)
        if p:
            bid = self.price[inst] - 0.01
            self.fills.append({"instId": inst, "side": "sell", "fillPrice": str(bid), "fillSize": format(p["size"], "f"),
                               "fee": str(float(p["size"]) * float(SPECS[inst]["contractValue"]) * bid * 0.0006),
                               "ts": str(self.now), "orderId": self._nid()})

    def fills_history(self, inst, order_id=None, limit=100):
        return [f for f in reversed(self.fills) if f["instId"] == inst]

    # simulation helpers
    def hit_stop(self, inst):
        stop = next(o for o in self.stops.values() if o["instId"] == inst and o["state"] == "live")
        stop["state"] = "triggered"
        p = self.pos.pop(inst)
        px = float(stop["slTriggerPrice"])
        self.fills.append({"instId": inst, "side": "sell", "fillPrice": str(px), "fillSize": format(p["size"], "f"),
                           "fee": "0.01", "ts": str(self.now), "orderId": self._nid()})


def flat_then_jump(n=400, base=100.0, last_close=103.0, start_ms=1_700_000_000_000, step_ms=14_400_000):
    """Flat series (EMA10 == EMA100) then a final up bar -> crossover on the last confirmed bar."""
    rows = []
    for i in range(n):
        r = 1.0 + (i * 7919 % 13) / 10  # deterministic varying range 1.0..2.2
        c = base if i < n - 1 else last_close
        rows.append([str(start_ms + i * step_ms), str(base), str(max(c, base) + r / 2), str(min(c, base) - r / 2),
                     str(c), "1", "1", "1", "1"])
    return rows


def aligned(fx: FakeExchange, n=400, last_close=100.5, age_ms=60_000, step_ms=14_400_000):
    """flat_then_jump whose last confirmed bar closed `age_ms` before the fake clock (fresh data)."""
    return flat_then_jump(n=n, last_close=last_close, start_ms=fx.now - age_ms - n * step_ms, step_ms=step_ms)


def next_bar(rows, close, step_ms=14_400_000):
    """Append one confirmed bar after the last one."""
    ts = int(rows[-1][0]) + step_ms
    prev = float(rows[-1][4])
    rows.append([str(ts), str(prev), str(max(prev, close) + 0.5), str(min(prev, close) - 0.5), str(close),
                 "1", "1", "1", "1"])
    return rows

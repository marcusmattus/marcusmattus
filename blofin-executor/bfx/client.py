"""Minimal BloFin REST client (stdlib only). Signs exactly the bytes it sends.

Signature (docs.blofin.com): base64( hex( HMAC_SHA256(secret, path+query + METHOD + ts + nonce + body) ) )
GET requests are retried on transport errors; POSTs are never auto-retried (the caller reconciles
by clientOrderId instead, so an ambiguous timeout can't double-submit an order).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any

from .secrets import Credentials


class BlofinError(Exception):
    def __init__(self, code: str, msg: str, path: str, data: Any = None):
        super().__init__(f"BloFin {path} -> code={code} msg={msg}")
        self.code, self.msg, self.path, self.data = code, msg, path, data


class TransportError(Exception):
    """Network failure; for POSTs the outcome is UNKNOWN and must be reconciled."""


def _ssl_context() -> ssl.SSLContext:
    """Verified TLS. python.org macOS builds ship without CAs, so fall back to certifi or the system bundle."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if os.path.exists("/etc/ssl/cert.pem"):
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


def sign(secret: str, prehash: str) -> str:
    hex_sig = hmac.new(secret.encode(), prehash.encode(), hashlib.sha256).hexdigest().encode()
    return base64.b64encode(hex_sig).decode()


class BlofinClient:
    def __init__(self, base_url: str, creds: Credentials | None = None, timeout: float = 10.0,
                 min_interval: float = 0.25):
        self.base_url = base_url.rstrip("/")
        self._creds = creds
        self.timeout = timeout
        self.min_interval = min_interval
        self._last = 0.0
        self._ssl = _ssl_context()

    # ---------------------------------------------------------------- transport
    def _request(self, method: str, path: str, params: dict | None = None, body: Any = None,
                 auth: bool = False) -> Any:
        params = {k: v for k, v in (params or {}).items() if v is not None and v != ""}
        req_path = path + ("?" + urllib.parse.urlencode(params) if params else "")
        body_str = json.dumps(body) if body is not None else ""
        headers = {"Content-Type": "application/json", "User-Agent": "bfx/1"}
        attempts = 3 if method == "GET" else 1
        for attempt in range(attempts):
            wait = self.min_interval - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            if auth:
                if not self._creds:
                    raise RuntimeError("authenticated call without credentials")
                ts = str(int(time.time() * 1000))
                nonce = str(uuid.uuid4())
                headers.update({
                    "ACCESS-KEY": self._creds.api_key,
                    "ACCESS-SIGN": sign(self._creds.api_secret, f"{req_path}{method}{ts}{nonce}{body_str}"),
                    "ACCESS-TIMESTAMP": ts,
                    "ACCESS-NONCE": nonce,
                    "ACCESS-PASSPHRASE": self._creds.passphrase,
                })
            req = urllib.request.Request(self.base_url + req_path, method=method, headers=headers,
                                         data=body_str.encode() if body is not None else None)
            self._last = time.monotonic()
            try:
                with urllib.request.urlopen(req, timeout=self.timeout, context=self._ssl) as resp:
                    payload = json.loads(resp.read().decode())
                break
            except urllib.error.HTTPError as e:
                try:
                    payload = json.loads(e.read().decode())
                except Exception:
                    raise BlofinError(str(e.code), e.reason, path) from None
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if attempt == attempts - 1:
                    raise TransportError(f"{method} {path}: {e}") from None
                time.sleep(1.0 * (attempt + 1))
        code = str(payload.get("code"))
        if code != "0":
            raise BlofinError(code, payload.get("msg", ""), path, payload.get("data"))
        return payload.get("data")

    def get(self, path, params=None, auth=False):
        return self._request("GET", path, params=params, auth=auth)

    def post(self, path, body):
        return self._request("POST", path, body=body, auth=True)

    # ---------------------------------------------------------------- public market data
    def instrument(self, inst_id: str) -> dict:
        return self.get("/api/v1/market/instruments", {"instId": inst_id})[0]

    def ticker(self, inst_id: str) -> dict:
        return self.get("/api/v1/market/tickers", {"instId": inst_id})[0]

    def candles(self, inst_id: str, bar: str, limit: int = 1000) -> list[list[str]]:
        """Oldest-first, CONFIRMED candles only: [ts, o, h, l, c, vol, volCcy, volQuote, confirm]."""
        rows = self.get("/api/v1/market/candles", {"instId": inst_id, "bar": bar, "limit": limit})
        return [r for r in reversed(rows) if str(r[8]) == "1"]

    def position_tiers(self, inst_id: str, margin_mode: str) -> list[dict]:
        return self.get("/api/v1/market/position-tiers", {"instId": inst_id, "marginMode": margin_mode})

    def funding_rate(self, inst_id: str) -> dict:
        return self.get("/api/v1/market/funding-rate", {"instId": inst_id})[0]

    # ---------------------------------------------------------------- account
    def query_apikey(self) -> dict:
        return self.get("/api/v1/user/query-apikey", auth=True)

    def balance(self) -> dict:
        return self.get("/api/v1/account/balance", auth=True)

    def positions(self, inst_id: str | None = None) -> list[dict]:
        return self.get("/api/v1/account/positions", {"instId": inst_id}, auth=True) or []

    def position_mode(self) -> dict:
        return self.get("/api/v1/account/position-mode", auth=True)

    def leverage_info(self, inst_id: str, margin_mode: str) -> dict:
        return self.get("/api/v1/account/leverage-info", {"instId": inst_id, "marginMode": margin_mode}, auth=True)

    def set_leverage(self, inst_id: str, leverage: int, margin_mode: str) -> Any:
        return self.post("/api/v1/account/set-leverage",
                         {"instId": inst_id, "leverage": str(leverage), "marginMode": margin_mode})

    def funding_fees(self, inst_id: str, begin_ms: int, end_ms: int) -> list[dict]:
        return self.get("/api/v1/account/funding-fees",
                        {"instId": inst_id, "begin": begin_ms, "end": end_ms, "limit": 100}, auth=True) or []

    # ---------------------------------------------------------------- trading
    def orders_pending(self, inst_id: str | None = None) -> list[dict]:
        return self.get("/api/v1/trade/orders-pending", {"instId": inst_id}, auth=True) or []

    def tpsl_pending(self, inst_id: str | None = None) -> list[dict]:
        return self.get("/api/v1/trade/orders-tpsl-pending", {"instId": inst_id}, auth=True) or []

    def order_detail(self, inst_id: str, order_id: str | None = None, client_order_id: str | None = None) -> dict:
        return self.get("/api/v1/trade/order-detail",
                        {"instId": inst_id, "orderId": order_id, "clientOrderId": client_order_id}, auth=True)

    def orders_history(self, inst_id: str, limit: int = 20) -> list[dict]:
        return self.get("/api/v1/trade/orders-history", {"instId": inst_id, "limit": limit}, auth=True) or []

    def fills_history(self, inst_id: str, order_id: str | None = None, limit: int = 100) -> list[dict]:
        return self.get("/api/v1/trade/fills-history",
                        {"instId": inst_id, "orderId": order_id, "limit": limit}, auth=True) or []

    def place_order(self, *, inst_id: str, side: str, order_type: str, size: str, margin_mode: str,
                    price: str | None = None, client_order_id: str | None = None,
                    reduce_only: bool = False, position_side: str = "net") -> dict:
        body = {"instId": inst_id, "marginMode": margin_mode, "positionSide": position_side, "side": side,
                "orderType": order_type, "size": size}
        if price is not None:
            body["price"] = price
        if client_order_id:
            body["clientOrderId"] = client_order_id
        if reduce_only:
            body["reduceOnly"] = "true"
        res = self.post("/api/v1/trade/order", body)
        item = res[0] if isinstance(res, list) else res
        if str(item.get("code", "0")) != "0":
            raise BlofinError(str(item.get("code")), item.get("msg", ""), "/api/v1/trade/order", item)
        return item

    def place_stop(self, *, inst_id: str, close_side: str, size: str, trigger: str, margin_mode: str,
                   client_order_id: str | None = None, position_side: str = "net") -> dict:
        body = {"instId": inst_id, "marginMode": margin_mode, "positionSide": position_side, "side": close_side,
                "slTriggerPrice": trigger, "slOrderPrice": "-1", "slTriggerPriceType": "last",
                "size": size, "reduceOnly": "true"}
        if client_order_id:
            body["clientOrderId"] = client_order_id
        res = self.post("/api/v1/trade/order-tpsl", body)
        item = res[0] if isinstance(res, list) else res
        if str(item.get("code", "0")) != "0":
            raise BlofinError(str(item.get("code")), item.get("msg", ""), "/api/v1/trade/order-tpsl", item)
        return item

    def amend_stop(self, inst_id: str, tpsl_id: str, new_trigger: str) -> dict:
        res = self.post("/api/v1/trade/amend-tpsl",
                        {"instId": inst_id, "tpslId": tpsl_id, "newSlTriggerPrice": new_trigger,
                         "newSlOrderPrice": "-1", "newSlTriggerPriceType": "last", "requestId": uuid.uuid4().hex[:32]})
        item = res[0] if isinstance(res, list) else res
        if str(item.get("code", "0")) != "0":
            raise BlofinError(str(item.get("code")), item.get("msg", ""), "/api/v1/trade/amend-tpsl", item)
        return item

    def cancel_stop(self, inst_id: str, tpsl_id: str) -> Any:
        return self.post("/api/v1/trade/cancel-tpsl", [{"instId": inst_id, "tpslId": tpsl_id}])

    def cancel_order(self, inst_id: str, order_id: str) -> Any:
        return self.post("/api/v1/trade/cancel-order", {"instId": inst_id, "orderId": order_id})

    def close_position(self, inst_id: str, margin_mode: str, position_side: str = "net",
                       client_order_id: str | None = None) -> Any:
        body = {"instId": inst_id, "marginMode": margin_mode, "positionSide": position_side}
        if client_order_id:
            body["clientOrderId"] = client_order_id
        return self.post("/api/v1/trade/close-position", body)

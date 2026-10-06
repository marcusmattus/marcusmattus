"""Credential loading. Secrets never touch disk, logs or repr().

Lookup order per mode (PAPER -> "demo", LIVE -> "live"):
  1. env BFX_<DEMO|LIVE>_API_KEY / _API_SECRET / _PASSPHRASE
  2. macOS Keychain generic password, service "bfx-blofin-<demo|live>", account api_key|api_secret|passphrase
"""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass

from .config import MODE_LIVE


class CredentialError(Exception):
    pass


@dataclass(frozen=True)
class Credentials:
    api_key: str
    api_secret: str
    passphrase: str

    def __repr__(self) -> str:  # never leak
        return f"Credentials(api_key=…{self.api_key[-4:]}, api_secret=***, passphrase=***)"

    __str__ = __repr__


def _keychain(service: str, account: str) -> str | None:
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-a", account, "-w"],
            capture_output=True, text=True, timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else None


def load_credentials(mode: str) -> Credentials:
    tag = "live" if mode == MODE_LIVE else "demo"
    service = f"bfx-blofin-{tag}"
    vals = {}
    for account, env_suffix in (("api_key", "API_KEY"), ("api_secret", "API_SECRET"), ("passphrase", "PASSPHRASE")):
        v = os.environ.get(f"BFX_{tag.upper()}_{env_suffix}") or _keychain(service, account)
        if not v:
            raise CredentialError(
                f"missing {account} for {mode}. Store it with:\n"
                f"  security add-generic-password -U -s {service} -a {account} -w"
            )
        vals[account] = v
    return Credentials(**vals)

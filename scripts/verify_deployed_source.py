#!/usr/bin/env python3
"""
Deployed-source parity check — cross-platform.

Fetches the contract code the chain is actually running and compares it against
`contracts/SubstituteProof.py`. The expected hash is computed from the repository
file at run time, so the check can never drift from the source it claims to
verify.

The comparison is newline-aware: Studio may store the source with CRLF endings
and may drop the terminal newline. Both copies are normalized to LF and at most
ONE trailing LF is removed from each; every other byte must still match.

This replaces the bash version, which cannot run in Windows cmd.exe — the people
reviewing this project should not need a particular shell to check it.

    python scripts/verify_deployed_source.py
    python scripts/verify_deployed_source.py 0xOTHERADDRESS

Environment: GENLAYER_RPC, VITE_CONTRACT_ADDRESS, CONTRACT_PATH.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

RPC = os.environ.get("GENLAYER_RPC", "https://studio-next.genlayer.com/api")
ADDR = (
    sys.argv[1]
    if len(sys.argv) > 1
    else os.environ.get(
        "VITE_CONTRACT_ADDRESS", "0x2E07cA0D78D3Ec9D0AFa67b82df5E0570F816C78"
    )
)
SRC = Path(os.environ.get("CONTRACT_PATH", "contracts/SubstituteProof.py"))


def canonical(data: bytes) -> bytes:
    data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return data[:-1] if data.endswith(b"\n") else data


def post(payload: dict) -> dict | None:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        RPC, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            obj = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None
    if obj.get("error") or obj.get("result") in (None, "", {}):
        return None
    return obj


def main() -> int:
    if not SRC.is_file():
        print(f"FAIL: không thấy {SRC}. Chạy lệnh này từ thư mục gốc của repo.")
        return 2

    raw_repo = SRC.read_bytes()
    expected_raw = hashlib.sha256(raw_repo).hexdigest()
    expected_lf = hashlib.sha256(canonical(raw_repo)).hexdigest()

    print("SubstituteProof deployed-source parity check (newline-aware)")
    print(f"RPC:      {RPC}")
    print(f"Contract: {ADDR}")
    print(f"Source:   {SRC}")
    print(f"Expected canonical SHA256: {expected_lf}")
    print()

    # The RPC has accepted three shapes across Studio versions; try each.
    attempts = [
        ("address-only", [ADDR]),
        ("address + finalized", [ADDR, "finalized"]),
        ("request object", [{"address": ADDR, "status": "finalized"}]),
    ]
    obj = None
    mode = ""
    for mode, params in attempts:
        obj = post(
            {"jsonrpc": "2.0", "id": 1, "method": "gen_getContractCode", "params": params}
        )
        if obj is not None:
            break

    if obj is None:
        print("RPC did not return contract code.")
        print("Kiểm tra: mạng, địa chỉ contract, và biến GENLAYER_RPC.")
        return 2

    print(f"RPC request mode: {mode}")
    print()

    result = obj.get("result")
    if isinstance(result, dict):
        for key in ("code", "source", "contractCode"):
            if result.get(key):
                result = result[key]
                break
    if not isinstance(result, str) or not result:
        print(f"Unexpected RPC result: {result!r}")
        return 2

    if result.startswith("0x"):
        raw_bytes = bytes.fromhex(result[2:])
    else:
        try:
            raw_bytes = base64.b64decode(result, validate=True)
            if not raw_bytes:
                raise ValueError("empty payload")
        except Exception:  # noqa: BLE001
            raw_bytes = result.encode("utf-8")

    normalized = canonical(raw_bytes)
    raw_hash = hashlib.sha256(raw_bytes).hexdigest()
    norm_hash = hashlib.sha256(normalized).hexdigest()

    print("Deployed bytes:            ", len(raw_bytes))
    print("Raw deployed SHA256:       ", raw_hash)
    print("Normalized deployed bytes: ", len(normalized))
    print("Normalized deployed SHA256:", norm_hash)
    print("Repository raw SHA256:     ", expected_raw)
    print("Expected canonical SHA256: ", expected_lf)
    print()

    first_line = normalized.split(b"\n", 1)[0].decode("utf-8", "replace").strip()
    print("Deployed first line:", first_line)
    if not first_line.startswith("# v0.3"):
        print("WARNING: deployed source does not carry the v0.3 version comment.")
    print()

    if norm_hash != expected_lf:
        print("SOURCE PARITY MISMATCH — substantive source difference remains.")
        return 1

    if raw_hash == expected_raw:
        print("SOURCE PARITY PROVEN — byte-identical to the repository source.")
    else:
        print(
            "SOURCE PARITY PROVEN — identical after CRLF/LF and optional "
            "terminal-newline normalization."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

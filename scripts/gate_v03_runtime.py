#!/usr/bin/env python3.13
"""
Cổng kiểm v0.3 — chạy THẬT constructor và các nhánh tất định của contract trên
SDK py-genlayer v0.3.0-rc7, in-memory, không mạng.

Vì sao cần cổng này chứ không chỉ probe schema: probe chỉ nạp module và trích
schema — đúng phần mạng làm trước khi deploy — nên nó KHÔNG chạy `__init__`.
Một contract còn `self.x = TreeMap()` trong `__init__` sẽ qua probe nhưng chết
lúc deploy với GenerationError. Cổng này gọi `gl.storage.inmem_allocate`, tức là
chạy constructor thật.

Chạy:
    bash scripts/setup_v03_sdk.sh /tmp/genvm-v03
    PYTHONPATH="/tmp/genvm-v03/stub:/tmp/genvm-v03/genvm/runners/genlayer-py-std/src" \
        python3.13 scripts/gate_v03_runtime.py contracts/SubstituteProof.py
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (PASS if cond else FAIL).append(f"{name}{(' — ' + detail) if detail else ''}")


def expect_user_error(name: str, code: str, fn) -> None:
    import genlayer as gl

    try:
        fn()
    except gl.vm.UserError as exc:  # type: ignore[attr-defined]
        # On this SDK the UserError payload is already rendered as
        # "UserError('CODE')" — both str(exc) and exc.args[0] carry that wrapper.
        # Pull the bare code out instead of comparing the rendering.
        raw = exc.args[0] if exc.args else str(exc)
        m = re.search(r"[A-Z][A-Z0-9_]{3,}", str(raw))
        got = m.group(0) if m else str(raw)
        check(name, got == code, f"got {got!r}, want {code}")
    except Exception as exc:  # noqa: BLE001
        check(name, False, f"raised {type(exc).__name__}: {exc}")
    else:
        check(name, False, "không raise")


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "contracts/SubstituteProof.py")

    try:
        import genlayer as gl
        import genlayer.storage
    except Exception as exc:  # noqa: BLE001
        print("FAIL: không import được SDK v0.3. Chạy scripts/setup_v03_sdk.sh trước.")
        print(f"  {type(exc).__name__}: {exc}")
        return 1

    # dont_inherit: không để `from __future__ import annotations` của FILE NÀY
    # lọt sang contract — nó biến annotation storage thành chuỗi và phá
    # auto-allocation của v0.3.
    src = path.read_text(encoding="utf-8")
    code = compile(src, str(path), "exec", flags=0, dont_inherit=True)
    module = importlib.util.module_from_spec(
        importlib.util.spec_from_loader("substitute_proof_under_test", loader=None)
    )
    sys.modules["substitute_proof_under_test"] = module
    try:
        exec(code, module.__dict__)  # noqa: S102
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: nạp module lỗi — {type(exc).__name__}: {exc}")
        return 1
    check("[1] module nạp được trên SDK v0.3", True)

    cls = getattr(module, "SubstituteProof", None)
    check("[1] tìm thấy class SubstituteProof", cls is not None)
    if cls is None:
        return report()

    # ---- [2] constructor chạy thật ----
    try:
        inst = gl.storage.inmem_allocate(cls)
        check("[2] __init__ chạy không lỗi (đây là bước probe schema bỏ qua)", True)
    except Exception as exc:  # noqa: BLE001
        check("[2] __init__ chạy không lỗi", False, f"{type(exc).__name__}: {exc}")
        return report()

    check("[2] agreement_count khởi tạo 0", int(inst.agreement_count) == 0)
    check("[2] proposal_seq khởi tạo 0", int(inst.proposal_seq) == 0)
    check("[2] agreements được cấp phát tự động", inst.agreements is not None)
    check("[2] proposals được cấp phát tự động", inst.proposals is not None)
    check("[2] agreements rỗng lúc đầu", inst.agreements.get("x", "") == "")

    # ---- [3] không còn dấu vết v0.2 trong source ----
    banned = {
        "from genlayer import *": "import * đã bỏ ở v0.3 (gl không còn được bind)",
        "gl.Contract": "phải là gl.contract.Contract",
        "run_nondet_unsafe": "phải là gl.vm.run_nondet",
        "gl.message_raw": "phải là gl.message.raw",
    }
    for token, why in banned.items():
        check(f"[3] không còn `{token}`", token not in src, why)
    check(
        "[3] __init__ không dựng TreeMap thủ công",
        "= TreeMap()" not in src,
        "v0.3 tự cấp phát; dựng tay là GenerationError lúc deploy",
    )
    check(
        "[3] header khai runner v0.3",
        "5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" in src,
    )

    # ---- [4] hàm tất định vẫn đúng sau khi port ----
    manifest = {
        "service_name": "Acme Translation",
        "jurisdiction": "EU",
        "model_class": "frontier-instruct",
        "max_delegation_depth": 2,
        "data_sources": ["customer-upload"],
        "data_retention_mode": "zero-retention",
        "capabilities": "document translation",
        "service_description": "Translates uploaded documents.",
        "limitations": "No legal certification.",
    }
    try:
        a = inst.canonical_manifest_key(json.dumps(manifest, sort_keys=True))
        b = inst.canonical_manifest_key(json.dumps(manifest, sort_keys=False))
        check("[4] canonical_manifest_key bỏ qua thứ tự khoá", a == b)
        check("[4] canonical_manifest_key trả hash hex 64", len(a) == 64)
    except Exception as exc:  # noqa: BLE001
        check("[4] canonical_manifest_key chạy được", False, f"{type(exc).__name__}: {exc}")

    expect_user_error(
        "[4] manifest thiếu khoá bị chặn",
        "MANIFEST_SCHEMA_INVALID",
        lambda: inst.canonical_manifest_key(json.dumps({"service_name": "x"})),
    )
    expect_user_error(
        "[4] manifest không phải JSON bị chặn",
        "MANIFEST_JSON_INVALID",
        lambda: inst.canonical_manifest_key("{not json"),
    )

    # ---- [5] nhánh revert tất định ----
    expect_user_error(
        "[5] AGREEMENT_REF rỗng bị chặn",
        "AGREEMENT_REF_REQUIRED",
        lambda: inst._clean_required_text("   ", "AGREEMENT_REF", 64),
    )

    return report()


def report() -> int:
    for line in PASS:
        print(f"PASS  {line}")
    for line in FAIL:
        print(f"FAIL  {line}")
    total = len(PASS) + len(FAIL)
    print()
    if FAIL:
        print(f"GATE: {len(FAIL)}/{total} FAILED")
        return 1
    print(f"GATE: {total}/{total} PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

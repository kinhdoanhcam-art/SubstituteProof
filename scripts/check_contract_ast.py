#!/usr/bin/env python3
from __future__ import annotations

import ast
import hashlib
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = Path(os.environ.get("SUBSTITUTEPROOF_CONTRACT_PATH", ROOT / "contracts" / "SubstituteProof.py"))
source = PATH.read_text(encoding="utf-8")
errors = []

EXPECTED_DEP = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'
if not source.startswith(EXPECTED_DEP):
    errors.append("dependency header changed or missing")

try:
    tree = ast.parse(source)
except SyntaxError as exc:
    print(f"FAIL syntax: {exc}")
    raise SystemExit(1)

for node in ast.walk(tree):
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        names = []
        if isinstance(node, ast.Import):
            names = [a.name.split('.')[0] for a in node.names]
        else:
            names = [(node.module or '').split('.')[0]]
        for name in names:
            if name in {"os", "sys", "subprocess", "socket", "random", "time", "datetime", "requests"}:
                errors.append(f"forbidden import: {name}")

classes = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "SubstituteProof"]
if len(classes) != 1:
    errors.append("SubstituteProof class missing or duplicated")
else:
    cls = classes[0]
    method_names = {n.name for n in cls.body if isinstance(n, ast.FunctionDef)}
    required = {
        "derive_agreement_id", "canonical_manifest_key", "get_agreement", "get_proposal", "get_counts",
        "create_agreement", "accept_agreement", "grant_semantic_budget", "propose_substitution",
        "approve_substitution", "reject_substitution", "withdraw_substitution", "finalize_handoff", "_semantic_equivalence",
        "_critical_changes", "_strip_prompt_fence_tokens",
    }
    missing = sorted(required - method_names)
    if missing:
        errors.append("missing methods: " + ", ".join(missing))

# High-value invariant markers: these do not replace executable tests.
markers = [
    '"original_manifest"',
    '"active_manifest"',
    'STATUS_BUYER_APPROVAL_REQUIRED',
    'HANDOFF_FROZEN_PENDING_BUYER_APPROVAL',
    'DELIVERED_MANIFEST_NOT_AUTHORIZED',
    'BUYER_REJECTED_CANDIDATE',
    'SEMANTIC_BUDGET_EXHAUSTED',
    'agreement["original_manifest_json"], candidate_json',
    'return material',
    'run_nondet_unsafe',
    'proposal["candidate_manifest_key"]',
]
for marker in markers:
    if marker not in source:
        errors.append(f"missing invariant marker: {marker}")

# Nondeterminism must be confined to the semantic helper.
for node in ast.walk(tree):
    if isinstance(node, ast.Call):
        text = ast.get_source_segment(source, node.func) or ""
        if "exec_prompt" in text:
            parent_fn = None
            for candidate in ast.walk(tree):
                if isinstance(candidate, ast.FunctionDef) and candidate.lineno <= node.lineno <= getattr(candidate, 'end_lineno', candidate.lineno):
                    if parent_fn is None or candidate.lineno >= parent_fn.lineno:
                        parent_fn = candidate
            if parent_fn is None or parent_fn.name != "leader_fn":
                errors.append("exec_prompt escaped leader_fn nondeterministic block")

sha = hashlib.sha256(source.encode("utf-8")).hexdigest()
if errors:
    for error in errors:
        print("FAIL", error)
    print("Contract SHA256", sha)
    raise SystemExit(1)
print("PASS AST contract invariants")
print("Contract SHA256", sha)

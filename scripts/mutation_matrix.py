#!/usr/bin/env python3
"""Mutation checks proving executable tests catch high-value invariant breaks."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "contracts" / "SubstituteProof.py"
CORE_TEST = ROOT / "scripts" / "test_contract_logic.py"
AST_TEST = ROOT / "scripts" / "check_contract_ast.py"
FENCE_TEST = ROOT / "scripts" / "fence_probe.py"
source = SOURCE_PATH.read_text(encoding="utf-8")

mutations = [
    (
        "disable-critical-diff",
        "        return changed\n",
        "        return []\n",
    ),
    (
        "allow-unauthorized-delivered-manifest",
        '        if delivered_key != agreement["active_manifest_key"]:\n',
        "        if False:\n",
    ),
    (
        "bypass-frozen-handoff",
        '        if agreement["status"] == self.STATUS_BUYER_APPROVAL_REQUIRED:\n            raise gl.vm.UserError("HANDOFF_FROZEN_PENDING_BUYER_APPROVAL")\n',
        "        if False:\n            raise gl.vm.UserError(\"HANDOFF_FROZEN_PENDING_BUYER_APPROVAL\")\n",
    ),
    (
        "compare-semantic-delta-to-active-not-original",
        '                    agreement["original_manifest_json"], candidate_json\n',
        '                    agreement["active_manifest_json"], candidate_json\n',
    ),
    (
        "malformed-output-fails-open",
        "            except Exception:\n                return material\n",
        "            except Exception:\n                return equivalent\n",
    ),
    (
        "ignore-rejected-candidate-ledger",
        "        elif candidate_key in rejected:\n",
        "        elif False:\n",
    ),
    (
        "remove-semantic-budget-check",
        "            if calls_used >= capacity:\n",
        "            if False:\n",
    ),
    (
        "allow-self-buyer-provider",
        "        if buyer == provider:\n",
        "        if False:\n",
    ),
    (
        "completion-not-terminal",
        '        agreement["status"] = self.STATUS_COMPLETED\n',
        '        agreement["status"] = self.STATUS_ACTIVE\n',
    ),
    (
        "allow-pending-replacement",
        '        if agreement["status"] == self.STATUS_BUYER_APPROVAL_REQUIRED:\n            raise gl.vm.UserError("PENDING_SUBSTITUTION_MUST_BE_RESOLVED")\n',
        "        if False:\n            raise gl.vm.UserError(\"PENDING_SUBSTITUTION_MUST_BE_RESOLVED\")\n",
    ),
    (
        "accept-extra-manifest-fields",
        "        if keys != expected:\n",
        "        if False:\n",
    ),
    (
        "remove-jurisdiction-criticality",
        '    CRITICAL_FIELDS = (\n        "jurisdiction",\n',
        '    CRITICAL_FIELDS = (\n',
    ),
    (
        "remove-retention-criticality",
        '        "data_sources",\n        "data_retention_mode",\n    )\n\n    def __init__',
        '        "data_sources",\n    )\n\n    def __init__',
    ),
    (
        "overwrite-original-key-on-buyer-approval",
        '        agreement["active_manifest_key"] = proposal["candidate_manifest_key"]\n',
        '        agreement["active_manifest_key"] = proposal["candidate_manifest_key"]\n        agreement["original_manifest_key"] = proposal["candidate_manifest_key"]\n',
    ),
    (
        "rejected-critical-candidate-refreezes",
        '        elif candidate_key in rejected:\n',
        '        elif candidate_key in rejected and len(critical_changes) == 0:\n',
    ),
    (
        "reused-material-auto-approves",
        '            if prior_classification == self.OUTCOME_EQUIVALENT:\n',
        '            if prior_classification in (self.OUTCOME_EQUIVALENT, self.OUTCOME_MATERIAL):\n',
    ),
    (
        "withdraw-clears-existing-rejected-ledger",
        '        rejected = agreement.get("rejected_candidates", {})\n        rejected[proposal["candidate_manifest_key"]] = True\n        agreement["rejected_candidates"] = rejected\n        agreement["status"] = self.STATUS_ACTIVE\n        agreement["pending_proposal_id"] = ""\n        agreement["updated_at"] = now\n\n        proposal["proposal_status"] = self.PROPOSAL_PROVIDER_WITHDRAWN\n',
        '        rejected = {}\n        rejected[proposal["candidate_manifest_key"]] = True\n        agreement["rejected_candidates"] = rejected\n        agreement["status"] = self.STATUS_ACTIVE\n        agreement["pending_proposal_id"] = ""\n        agreement["updated_at"] = now\n\n        proposal["proposal_status"] = self.PROPOSAL_PROVIDER_WITHDRAWN\n',
    ),
    (
        "withdraw-silently-authorizes-pending-candidate",
        '        agreement["status"] = self.STATUS_ACTIVE\n        agreement["pending_proposal_id"] = ""\n        agreement["updated_at"] = now\n\n        proposal["proposal_status"] = self.PROPOSAL_PROVIDER_WITHDRAWN\n',
        '        agreement["active_manifest"] = proposal["candidate_manifest"]\n        agreement["active_manifest_json"] = proposal["candidate_manifest_json"]\n        agreement["active_manifest_key"] = proposal["candidate_manifest_key"]\n        agreement["status"] = self.STATUS_ACTIVE\n        agreement["pending_proposal_id"] = ""\n        agreement["updated_at"] = now\n\n        proposal["proposal_status"] = self.PROPOSAL_PROVIDER_WITHDRAWN\n',
    ),
]

caught = 0
for name, old, new in mutations:
    if source.count(old) != 1:
        print(f"FAIL mutation fixture {name}: expected exactly 1 match, got {source.count(old)}")
        raise SystemExit(1)
    mutated = source.replace(old, new, 1)
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "SubstituteProof.py"
        path.write_text(mutated, encoding="utf-8")
        env = dict(os.environ)
        env["SUBSTITUTEPROOF_CONTRACT_PATH"] = str(path)
        commands = [
            ("core", ["python", str(CORE_TEST)]),
            ("adversarial", ["python", str(CORE_TEST), "--suite", "adversarial"]),
            ("ast", ["python", str(AST_TEST)]),
            ("fence", ["python", str(FENCE_TEST)]),
        ]
        failed_gate = ""
        for gate_name, cmd in commands:
            proc = subprocess.run(
                cmd,
                cwd=str(ROOT),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if proc.returncode != 0:
                failed_gate = gate_name
                break
    if failed_gate == "":
        print("MISSED", name)
    else:
        caught += 1
        print("CAUGHT", name, "by", failed_gate)

print(f"Mutation matrix: {caught}/{len(mutations)} caught")
if caught != len(mutations):
    raise SystemExit(1)

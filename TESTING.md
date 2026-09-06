# Testing

## Exact production contract

SHA256:
`15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`

Final deployment:
`0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`

## Local executable gates — PASS

```bash
python -m py_compile contracts/SubstituteProof.py scripts/*.py tests/direct/*.py
python scripts/check_contract_ast.py
python scripts/test_contract_logic.py
python scripts/test_contract_logic.py --suite adversarial
python scripts/fence_probe.py
python scripts/mutation_matrix.py
```

Observed results:
- AST: PASS
- actual-contract core: 24/24
- actual-contract adversarial: 18/18
- fence: 0/12 bypasses
- mutations: 18/18 caught

`test_contract_logic.py` executes the production contract logic under a minimal GenLayer stub; it is executable behavioral verification, not source-marker-only testing.

## Exact-source GenLayer gates — PASS

```bash
genvm-lint check contracts/SubstituteProof.py
genvm-lint schema contracts/SubstituteProof.py
genvm-lint typecheck contracts/SubstituteProof.py
pytest tests/direct/ -v
```

Recorded results: lint PASS, typecheck PASS, schema PASS (13 methods), and 32/32 Direct Mode executable checks PASS.

## StudioNet on-chain verification — COMPLETED

`onchain-evidence/EXECUTION_TRACE.json` and `onchain-evidence/PROTOCOL_TRACE.md` record the finalized behavioral evidence. Key executed outcomes include:

- wrong-role buyer action -> `ONLY_BUYER` rollback;
- exact active manifest -> `NO_CHANGE_ACTIVE`, no model;
- critical jurisdiction/retention change -> deterministic material, no model;
- frozen finalize -> `HANDOFF_FROZEN_PENDING_BUYER_APPROVAL` rollback;
- provider withdrawal -> liveness restored without authorizing candidate;
- withdrawn/rejected candidate retry -> `BUYER_REJECTED_CANDIDATE`, no reroll;
- prose-only equivalent -> consensus `EQUIVALENT_SUBSTITUTE`, auto-approved;
- prose-only capability loss -> consensus `MATERIAL_SUBSTITUTION`, buyer review;
- buyer reject -> prior active remains;
- original-baseline/salami check -> follow-up still critical versus ORIGINAL;
- old manifest finalization -> `DELIVERED_MANIFEST_NOT_AUTHORIZED` rollback;
- exact authorized manifest finalization -> success -> `COMPLETED`;
- post-completion substitution -> `AGREEMENT_NOT_ACTIVE` rollback.

Final durable state:

```text
status = COMPLETED
proposal_count = 8
semantic_calls_total = 2
budget_grants = 0
pending_proposal_id = ""
```

## Frontend checks

The current React/Vite source is syntax-transpiled with the installed TypeScript compiler. The previous Vercel dependency-installed build passed after replacing `String.replaceAll` with an ES2020-compatible regex replacement. This presentation-only UI refresh must receive one fresh Vercel build/smoke before final freeze.

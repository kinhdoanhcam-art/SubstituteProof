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

Observed current results:
- AST: PASS
- actual-contract core: 24/24
- actual-contract adversarial: 18/18
- fence: 0/12 bypasses
- mutations: 18/18 caught

`test_contract_logic.py` executes the actual production contract logic under a minimal GenLayer stub; it is executable behavioral proof, not source-marker-only testing.

## Independent exact-source GenLayer gates — PASS

Independent review ran on the exact production source SHA:

```bash
genvm-lint check contracts/SubstituteProof.py
genvm-lint schema contracts/SubstituteProof.py
genvm-lint typecheck contracts/SubstituteProof.py
pytest tests/direct/ -v
```

Results: lint PASS, typecheck PASS, schema PASS (13 methods), 19/19 shipped Direct Mode tests PASS, plus 13 reviewer-added adversarial tests (32/32 combined). Review verdict: **SAFE TO DEPLOY AS-IS — YES**.

## StudioNet runtime proof — COMPLETED

`runtime-evidence/RUNTIME_EVIDENCE.json` and `runtime-evidence/STEWARD_RUNTIME_VERIFICATION.md` record the final behavioral proof. Key executed outcomes include:

- wrong-role buyer action -> `ONLY_BUYER` rollback;
- exact active manifest -> `NO_CHANGE_ACTIVE`, no model;
- critical jurisdiction/retention change -> deterministic material, no model;
- frozen finalize -> `HANDOFF_FROZEN_PENDING_BUYER_APPROVAL` rollback;
- provider withdrawal -> liveness restored without authorizing candidate;
- withdrawn/rejected candidate retry -> `BUYER_REJECTED_CANDIDATE`, no reroll;
- prose-only equivalent -> consensus `EQUIVALENT_SUBSTITUTE`, auto-approved;
- prose-only capability loss -> consensus `MATERIAL_SUBSTITUTION`, buyer review;
- buyer reject -> prior active remains;
- original-baseline/salami proof -> follow-up still critical versus ORIGINAL;
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

The final React/Vite source was syntax-transpiled with TypeScript 5.8.3:

```text
PASS src/App.tsx
PASS src/main.tsx
PASS src/genlayer.ts
PASS src/config.ts
PASS src/types.ts
```

The packaging environment could not resolve `registry.npmjs.org` (`EAI_AGAIN`), so a dependency-installed Vite build could not be executed here. Do not report a Vite build as verified until GitHub/Vercel installs dependencies and runs `npm run build` successfully.

# Testing

## Exact production contract

SHA256:
`a4ae789c1df11853a3d40398fc2f020949c740eef0ec2d6dfc1bbb65dd52738a`

Final deployment:
`0x2E07cA0D78D3Ec9D0AFa67b82df5E0570F816C78`

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

## On-chain verification — EXECUTED on this deployment

One complete run, `SP-DEMO-08`, executed against the contract above on
**GenLayer Studio Next**, chain `61997`. Two wallets, because the contract
enforces `BUYER_MUST_DIFFER_FROM_PROVIDER`:

```text
provider   0x3065E3…80B2d3      (truncated as the explorer renders it)
buyer      0x5a52d040581A76e2C032542855D31480f2ea7097
agreement  3c04d9a0e3a83aba0711511897713c892b39b964657456d60f0d238871251cc6
```

| # | Action | Method | From | Result | Model called | Semantic calls after |
|---|---|---|---|---|---|---|
| 1 | Create agreement | `create_agreement` | provider | `PENDING_BUYER_ACCEPTANCE` | — | 0/3 |
| 2 | Buyer accepts | `accept_agreement` | buyer | `ACTIVE`; original sealed at `363d50ddc5…61e1846c` | — | 0/3 |
| 3 | `jurisdiction` EU → US | `propose_substitution` | provider | `CRITICAL_MATERIAL_SUBSTITUTION` → `BUYER_APPROVAL_REQUIRED` | **No** | 0/3 |
| 4 | Buyer rejects | `reject_substitution` | buyer | `ACTIVE`; `rejected_candidates` = 1 | — | 0/3 |
| 5 | Resubmit the rejected candidate | `propose_substitution` | provider | `REJECTED_CANDIDATE`, proposal `BLOCKED`, agreement stays `ACTIVE` | **No** | 0/3 |
| 6 | Prose-only rewording | `propose_substitution` | provider | `EQUIVALENT_SUBSTITUTE`, auto-activated | Yes | 1/3 |
| 7 | Prose change removing terminology review | `propose_substitution` | provider | `MATERIAL_SUBSTITUTION` → `BUYER_APPROVAL_REQUIRED` | Yes | 2/3 |
| 8 | Buyer approves | `approve_substitution` | buyer | `ACTIVE`; active key `e11d66131e…0f133f59` | — | 2/3 |
| 9 | Finalize the authorized manifest | `finalize_handoff` | provider | `COMPLETED` | — | 2/3 |

A tenth interaction — pressing finalize again — is refused by the interface
without a transaction, because `COMPLETED` is terminal.

### Final durable state, read from the contract

```text
status                 COMPLETED
proposal_count         4          (steps 3, 5, 6, 7)
semantic_calls_total   2          (steps 6 and 7 only)
budget_grants          0
rejected_candidates    1
pending_proposal_id    ""
original_manifest_key  363d50ddc5…61e1846c   unchanged since step 2
active_manifest_key    e11d66131e…0f133f59
```

The `adjudicated` map holds exactly two entries, which is the independent check
on `semantic_calls_total`:

```text
991ccc03c0…e98644bc  ->  EQUIVALENT_SUBSTITUTE
e11d66131e…0f133f59  ->  MATERIAL_SUBSTITUTION
```

Steps 3 and 5 produced no entry: neither reached the model.

### Transactions — all FINALIZED

```text
1  create_agreement       0x8a5dd292076663b8ec0b8d019d1cbd69c2d16e2c96a4f71def18959d5b78f600
2  accept_agreement       0xf680297fe0189e7df63415e3155f5c4da1428ca560f26be1c663030c4c6fd964
3  propose · critical     0x0015b971094a47e5f0789e395a7bc9e84e995ea4134271e84dfaa3318f7b2720
4  reject_substitution    0x5dcdddbc6a1489b1ade38b3ed6da20c1672d9b375a1bd0ecc3ab72704539bc04
5  propose · reroll       0x4388cc2b511bf547cbcbc4a19376d092e5b3b020424f2e04d76e7b4ef9df053d
6  propose · equivalent   0xfe929dc0c8b036a2e2f992b5e97da54a5a0c894e6a90a07025485a08274ac11a
7  propose · material     0x7fb78f9c05946d41b85311592fa6b39cc148caf94fdc9cbfe12dc3828c75a93e
8  approve_substitution   0xdee766d51ba53e8207c3d9d21c6c6cb4d0b1be8cb7f6723154ccbe3ff61b8396
9  finalize_handoff       0x8968fac9debfc232a4536407376217620b77c9be97c9297516c594ce1345c598
```

Anyone can re-read this state without a wallet: open the app, go to
**Inspect State**, and paste the agreement id above.

### What this run does NOT prove

Stated plainly, because an earlier version of this file listed outcomes from a
different network and a different contract as if they had happened here.

The following branches exist in `contracts/SubstituteProof.py` and are covered by
the offline suites, but were **not** exercised on this deployment:
`withdraw_substitution`; wrong-role rollbacks (`ONLY_BUYER`, `ONLY_PROVIDER`);
`NO_CHANGE_ACTIVE`; `RESTORE_ORIGINAL`; `DELIVERED_MANIFEST_NOT_AUTHORIZED`;
`SEMANTIC_BUDGET_EXHAUSTED` and `grant_semantic_budget`; and
`PROPOSAL_LIMIT_REACHED`.

Offline coverage is not on-chain coverage, and this section does not present it
as such.

## Frontend checks

The current React/Vite source is syntax-transpiled with the installed TypeScript compiler. The production Vercel build/smoke after the protocol-console UI refresh is **PASS**, including the core navigation, terminal completed-state rendering, finalized-record navigation, explorer link, and clean browser console after refresh.

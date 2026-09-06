# SubstituteProof

**Post-agreement substitution control for AI-agent services.**

SubstituteProof keeps the buyer-accepted service manifest as an immutable on-chain baseline. Critical structured changes are classified as material deterministically; prose-only changes use GenLayer consensus for one narrow material-equivalence question against the ORIGINAL buyer-accepted manifest. A material substitute freezes the declared handoff until the buyer approves it.

This is not an AI court and not an external truth oracle. It governs party-declared manifests and the contract-routed approval/finalization path.

## Final StudioNet deployment

- Contract: `0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`
- Explorer: `https://explorer-studio.genlayer.com/address/0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`
- Production source SHA256: `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`
- Deployed-source parity: **PROVEN** (CRLF deployed copy normalizes to the exact production LF source SHA)

## Why

An AI agent can accept a deal for one service and later try to hand off a different implementation. Comparing only to the latest version enables gradual drift. SubstituteProof always compares substitution candidates against the original accepted manifest.

## Core flow

1. Provider creates an agreement with buyer + declared service manifest.
2. Buyer accepts; the original manifest becomes immutable.
3. Provider proposes a substitute.
4. Critical structured changes (`jurisdiction`, `model_class`, delegation depth, data sources, retention) are material without a model call.
5. Otherwise validators classify `EQUIVALENT_SUBSTITUTE` vs `MATERIAL_SUBSTITUTION` against the ORIGINAL.
6. Equivalent candidates auto-activate.
7. Material candidates freeze handoff until buyer approve/reject; provider may withdraw only back to the previously authorized service.
8. Rejected/withdrawn candidates cannot buy a semantic reroll.
9. Finalization succeeds only for the exact currently authorized manifest.
10. `COMPLETED` is terminal.

## Reference on-chain case

- Agreement ref: `substituteproof-runtime-001`
- Agreement ID: `791b20f01944f2e46a2ffddcd8700429ee58c4cf229e1fd4aec8eef390d87584`
- Final state: `COMPLETED`
- Proposals: `8`
- Semantic calls: `2`
- Budget grants: `0`
- Original manifest key: `6bf0843572c3166e940139b3e2677c7d6fb92ba103869f8178bba6e58ca5d4aa`
- Final authorized/completed key: `3449c092a5e1397741003e739c846336f765371cf5da8d8634af9532b2847e63`

See `onchain-evidence/PROTOCOL_TRACE.md` and `onchain-evidence/EXECUTION_TRACE.json`.

## Frontend

The Vite/React UI uses a web3 protocol-console visual system: a dark on-chain navigation shell with bright, high-clarity work surfaces and a live agreement-to-substitute gate visualization.

- dedicated Overview / Create Agreement / Propose Substitute / Buyer Review / Finalize Handoff / Inspect State / Protocol Trace pages;
- a blank Create flow with no demo values prefilled; the provider signs only what they enter;
- manifest editor with the exact nine-field production schema;
- side-by-side immutable-original vs candidate comparison;
- deterministic critical-field diff labeling before a transaction;
- explicit buyer/provider role awareness;
- finalized-state postcondition verification after writes;
- exact authorized-manifest finalization; and
- one-click access to a reference StudioNet case and the live contract explorer.

The frontend uses `genlayer-js@1.1.8` and does not treat `FINALIZED` alone as proof of successful contract execution; it verifies durable state postconditions.

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

`VITE_CONTRACT_ADDRESS` defaults to the final StudioNet deployment; override it via `.env` if needed.

## Public methods

Views:
- `derive_agreement_id`
- `canonical_manifest_key`
- `get_agreement`
- `get_proposal`
- `get_counts`

Writes:
- `create_agreement`
- `accept_agreement`
- `grant_semantic_budget`
- `propose_substitution`
- `approve_substitution`
- `reject_substitution`
- `withdraw_substitution`
- `finalize_handoff`

## Executed verification

- Python compile: PASS
- AST invariants: PASS
- actual production contract logic: 24/24 PASS
- adversarial actual-contract suite: 18/18 PASS
- prompt fence: 0/12 bypasses
- mutation matrix: 18/18 caught
- exact-source `genvm-lint check`: PASS
- exact-source `genvm-lint typecheck`: PASS
- exact-source schema check: PASS (13 methods)
- GenLayer Direct Mode: 32/32 total executable checks PASS
- exact-source predeployment validation: **PASS**
- deployed source parity: PASS
- StudioNet behavioral on-chain verification: PASS
- final frontend TS/TSX syntax transpile: PASS

Production Vercel build/smoke: **PASS** at `https://substitute-proof.vercel.app`. The production contract and StudioNet state are unchanged.

## Honest scope

SubstituteProof enforces declared manifests and role-bound approval/finalization. It does not independently inspect an off-chain service, verify the truth of manifest claims, or establish publisher provenance. Integrations must route declaration/finalization through the contract for the guard to apply.

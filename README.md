# SubstituteProof

**Post-agreement substitution control for AI-agent services.**

SubstituteProof keeps the buyer-accepted service manifest as an immutable on-chain baseline. Critical structured changes are classified as material deterministically; prose-only changes use GenLayer consensus for one narrow material-equivalence question against the ORIGINAL buyer-accepted manifest. A material substitute freezes the declared handoff until the buyer approves it.

This is not an AI court and not an external truth oracle. It governs party-declared manifests and the contract-routed approval/finalization path.

## Deployment

- Network: **GenLayer Studio Next** (Consensus v0.6)
- RPC: `https://studio-next.genlayer.com/api`
- Chain ID: `61997`
- Contract: `0x2E07cA0D78D3Ec9D0AFa67b82df5E0570F816C78`
- Contract source: `contracts/SubstituteProof.py`
- Contract SHA-256: `a4ae789c1df11853a3d40398fc2f020949c740eef0ec2d6dfc1bbb65dd52738a`
- GenVM: `v0.3.0-rc7`, runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

Deployed-source parity is a check you run, not a claim this file makes:

```bash
npm run verify:deployed
```

It fetches the deployed code over RPC and compares it against the repository
file, computing the expected hash from that file at run time so the check cannot
drift from the source it verifies.

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

## Runtime evidence

None yet on this deployment. The previous evidence — agreement id, proposal
counts, screenshots — belongs to the StudioNet contract at a different address
and does not exist here, so it was removed rather than carried over.

Once a flow has been executed against the contract above, set
`VITE_RUNTIME_AGREEMENT_ID` and `VITE_CONTRACT_SHA256`; until then the app's
Protocol Trace page says so instead of showing figures from somewhere else.

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
- one-click access to the live contract explorer.

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

`VITE_CONTRACT_ADDRESS` defaults to `0x2E07cA0D78D3Ec9D0AFa67b82df5E0570F816C78`; override it via `.env` if needed.

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
- final frontend TS/TSX syntax transpile: PASS


## Honest scope

SubstituteProof enforces declared manifests and role-bound approval/finalization. It does not independently inspect an off-chain service, verify the truth of manifest claims, or establish publisher provenance. Integrations must route declaration/finalization through the contract for the guard to apply.

# SubstituteProof

**Post-agreement substitution control for AI-agent services.**

**Demo video:** https://www.youtube.com/watch?v=v83HU4lKL0M
**Executed run:** `SP-DEMO-08` — four proposals, two model calls, nine finalized
transactions. Full table in [TESTING.md](TESTING.md#on-chain-verification--executed-on-this-deployment).

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

## Shared integration layer

`src/network.ts` and `src/genlayer.ts` are the same Consensus v0.6 wallet
adapter used across my GenLayer submissions: they connect a wallet, assert the
chain id the SDK skips for Studio chains, read contract state, and re-read it
after every write. They contain no protocol logic and are not claimed as novel.

`src/TxGate.tsx` started from that shared adapter but is specific to this
project: it reads the agreement's semantic budget and states, before signing,
whether the write can consume a model call and how many remain — and refuses to
sign when the budget is spent, instead of charging a fee for a transaction that
would return `SEMANTIC_BUDGET_EXHAUSTED`. The fee panel inside it is GenLayer's
own `GenLayerTransactionPanel`.

The protocol lives entirely in `contracts/SubstituteProof.py` and `src/App.tsx`,
neither of which is shared with any other project.

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

One complete run on this contract, `SP-DEMO-08`:

```text
agreement   3c04d9a0e3a83aba0711511897713c892b39b964657456d60f0d238871251cc6
status      COMPLETED
proposals   4        semantic calls  2/3
rejected    1        budget grants   0
original    363d50ddc5…61e1846c   sealed at buyer acceptance, never changed
active      e11d66131e…0f133f59
```

The critical-field change and the resubmitted rejected candidate were both
classified without a model call. Only the two prose changes reached GenLayer
consensus. The nine transaction hashes and the branches this run did **not**
exercise are in [TESTING.md](TESTING.md).

Open the app, go to **Inspect State** and paste the agreement id to read this
state yourself — no wallet needed.

Evidence from the earlier StudioNet contract was removed rather than carried
over; it belongs to a different address on a different network.

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

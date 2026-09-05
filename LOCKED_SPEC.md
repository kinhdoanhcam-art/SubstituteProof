# SubstituteProof — Locked Spec v2

## Agent Tank source-of-truth

SubstituteProof protects buyers when an AI agent/provider changes the service after a deal is accepted. The original accepted service manifest remains the immutable reference point. Deterministic critical changes are enforced directly; prose-only changes use GenLayer consensus to decide only whether the substitute remains materially equivalent. Material substitutions freeze handoff until the buyer approves.

## Non-goals / honest scope
- Not an AI court.
- Does not determine whether a manifest is factually true.
- Does not prove a provider/release is canonical or externally authorized.
- Does not observe an off-chain service unless an integration routes its declared handoff through this contract.
- Different wallet addresses enforce contract-local roles, not real-world independence.
- Equivalent prose substitutions auto-activate by design; there is no buyer-side reversal once such a substitution is active. The semantic equivalence gate is the protection on that path.
- `service_name` is intentionally semantic rather than a deterministic critical field so a name-only rebrand is not automatically material; identity/capability meaning is evaluated by the semantic gate.

## Roles
- Provider: creates agreement, proposes substitutions, may withdraw its own pending material proposal back to the already-authorized active manifest, and finalizes declared handoff.
- Buyer: accepts original manifest, grants bounded semantic budget, approves/rejects material substitutions.
- Provider and buyer must be different addresses.

## Immutable baseline
The buyer-accepted `original_manifest` and `original_manifest_key` are never overwritten. `active_manifest` may change, but every new substitute is classified against the original baseline, never against an intermediate substitute.

## Manifest schema
Exact keys only:
- `service_name`
- `jurisdiction`
- `model_class`
- `max_delegation_depth`
- `data_sources`
- `data_retention_mode`
- `capabilities`
- `service_description`
- `limitations`

Data-source order and duplicates are canonicalized. Extra fields are rejected so material terms cannot hide outside the governed schema.

## Deterministic critical fields
Any change from the original baseline in these fields is immediately `CRITICAL_MATERIAL_SUBSTITUTION` with `model_called=false`:
- jurisdiction
- model_class
- max_delegation_depth
- data_sources
- data_retention_mode

## Semantic gate
Only when critical fields match the original does GenLayer consensus answer:

> Does the proposed substitute preserve the materially relevant capabilities, limitations, and service guarantees of the original buyer-accepted manifest?

Allowed semantic outputs:
- `EQUIVALENT_SUBSTITUTE`
- `MATERIAL_SUBSTITUTION`

Malformed/failed model output fails closed to material.

`note` is audit-only and excluded from the semantic prompt.

## State machine
`PENDING_BUYER_ACCEPTANCE -> ACTIVE`

From ACTIVE:
- same active manifest -> NO_CHANGE_ACTIVE
- restore immutable original -> deterministic RESTORE_ORIGINAL
- equivalent semantic substitute -> auto-activates, remains ACTIVE
- material/critical substitute -> BUYER_APPROVAL_REQUIRED

From BUYER_APPROVAL_REQUIRED:
- buyer approves -> candidate becomes active, ACTIVE
- buyer rejects -> prior active remains, candidate is permanently rejected, ACTIVE
- provider withdraws its own pending proposal -> prior active remains untouched, candidate is permanently blocked, ACTIVE

From ACTIVE:
- provider may finalize only if the declared delivered manifest exactly equals the current authorized active manifest -> COMPLETED

COMPLETED is terminal.

## Non-bypassable consequence
While BUYER_APPROVAL_REQUIRED:
- finalize_handoff reverts
- provider cannot replace the pending proposal
- there is no timeout auto-approval
- provider may only withdraw the pending proposal back to the already-authorized active manifest
- withdrawal never authorizes the candidate and permanently blocks that candidate from a fresh semantic roll

This withdrawal is a liveness escape from buyer silence, not a substitution escape: the provider can only retreat to what was already authorized. Even while ACTIVE, an unreported changed declared manifest cannot finalize because its key does not equal the authorized active manifest key.

## Anti-reroll / bounded consensus
- Semantic candidate classifications are stored by candidate manifest key.
- A buyer-rejected candidate cannot buy a new semantic roll.
- A known-material candidate may re-open buyer review without another semantic call; this is bounded by `MAX_PROPOSALS_PER_AGREEMENT` and never auto-authorizes the candidate.
- Committed semantic calls are bounded: 3 initial calls + at most 5 buyer grants of 3 = max 18 committed semantic consensus calls per agreement. A consensus round that fully reverts before commitment does not persist a call counter or ledger entry.
- Grants never erase the adjudication or rejected-candidate ledgers.

## Salami resistance
All semantic candidates are compared to immutable ORIGINAL, never to `active_manifest`. A sequence A -> B -> C cannot legitimize C merely because each adjacent change looks small.

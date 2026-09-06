# Security Assurance

Use this checklist to challenge the exact deployed source against the protocol’s highest-risk invariants.

## 1. Consequence cannot be bypassed
- Material/critical candidate enters `BUYER_APPROVAL_REQUIRED`.
- Provider cannot finalize while frozen.
- Provider cannot replace a pending material proposal.
- Provider withdrawal, if used, can only retreat to the already-authorized active manifest and permanently blocks the withdrawn candidate.
- No timeout auto-approval exists.
- Unreported changed delivered manifest cannot finalize.

## 2. Original baseline cannot drift
- Buyer acceptance locks original manifest/key.
- Equivalent activation cannot overwrite original.
- Buyer-approved material candidate cannot overwrite original.
- Salami chain is always compared to original, never active.

## 3. Deterministic vs semantic boundary
- Every critical field change is material without model call.
- Exact/no-change paths do not call model.
- Only prose-equivalence path enters nondeterminism.
- Proposal note is audit-only and excluded from gate.

## 4. Anti-reroll and budget
- Rejected identical candidate cannot reroll semantic consensus.
- Semantic calls are bounded.
- Only buyer can grant more budget.
- Grant cap is fixed; grants do not erase ledgers.

## 5. Fail closed
- Malformed/failed LLM result becomes material.
- Prompt boundary tokens are fixed-point stripped.
- Candidate text cannot instruct the validator.

## 6. Roles
- Buyer != provider at creation.
- Only buyer accepts/approves/rejects/grants.
- Only provider proposes/withdraws/finalizes.
- Distinct addresses are contract-local roles, not proof of real-world independence.

## 7. Liveness
- Buyer can approve or reject a material pending proposal.
- Reject restores ACTIVE using prior authorized service.
- Provider can then finalize the prior authorized service.
- No provider-controlled escape can authorize the disputed substitute.

## 8. Provenance / scope honesty
- Stored manifest is party-declared, not canonical publisher provenance.
- Contract does not verify external delivery truth.
- Docs/UI must not claim otherwise.

## 9. Evidence quality
- Static AST/grep checks are supplemental only.
- Executable actual-contract tests must pass.
- Direct Mode must pass before deployment.
- StudioNet runtime evidence must prove observable state/rollback.
- After deployment, source parity must be proven against the exact repository source.

## v2 liveness gate
- `withdraw_substitution` must only retreat to the already-authorized active manifest.
- Withdrawal must permanently block the withdrawn candidate and must not call the model.
- Withdrawal must preserve every earlier buyer-rejected candidate; an unrelated withdraw must not clear or replace the rejection ledger.
- Rejected critical candidates must remain blocked before the critical-change branch.
- Reused MATERIAL classifications must always return to buyer review; they must never auto-activate.

## Final deployed verification status
The exact v2 source was deployed to StudioNet at `0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10` and source parity was proven against SHA256 `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`.

The final runtime case exercised the high-risk attack paths above. Material freeze, wrong-role approval, unauthorized delivered manifest, and post-completion substitution all produced the expected rollbacks. Withdrawal preserved the prior authorized manifest and rejected-candidate ledger. The salami follow-up remained material against the ORIGINAL baseline. See `onchain-evidence/PROTOCOL_TRACE.md`.

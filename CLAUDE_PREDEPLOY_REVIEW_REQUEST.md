# SubstituteProof v2 — independent pre-deploy re-review

Review the exact package/source SHA below. This is a narrow re-review after filtering the v1 findings through the project's steward rules.

Production candidate:
- `contracts/SubstituteProof.py`
- SHA256 `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`

## v1 review findings and decisions

### Patched as blockers / required evidence
1. **SP-B1 Direct Mode suite mechanics**: raw fixture addresses are now converted with `0x + bytes(...).hex()`, and the critical-field test deploys one contract outside the loop.
2. **SP-R1 liveness**: treated as a blocker under our liveness gate even though the v1 review labelled it non-blocking. Added provider-only `withdraw_substitution()`.
   - only valid while `BUYER_APPROVAL_REQUIRED`
   - active manifest is untouched
   - pending candidate is permanently blocked in `rejected_candidates`
   - no model call
   - provider can then finalize only the already-authorized active manifest
3. **SP-R4 test gaps**: added executable regressions for
   - rejected critical candidate must stay blocked before the critical branch
   - reused MATERIAL candidate must never auto-activate
   - withdrawal must never silently authorize the candidate
   Mutation matrix now includes those high-value mutants.

### Intentionally NOT added to contract
- **SP-R2 challenge_active_substitution**: not added. Equivalent prose substitution auto-activation is part of the Agent Tank design: only materially non-equivalent substitutions require buyer approval. This limitation is now documented honestly.
- **SP-R6 service_name as critical**: not changed. A name-only rebrand should not deterministically freeze; service identity/capability meaning remains inside the semantic gate. This is now explicit in the spec.
- **SP-R3 repeated known-material review**: no new state complexity added. This is not a protection bypass and remains bounded by proposal limits; withdrawal itself permanently blocks its candidate.
- **SP-R5**: docs now qualify the 18-call bound as committed consensus rounds.

## Local exact-source results already rerun
- Python compile: PASS
- AST: PASS
- actual production-contract core: 23/23 PASS
- actual production-contract adversarial: 17/17 PASS
- prompt fence: 0/12 bypasses
- mutation matrix: 17/17 caught

## Please rerun on EXACT v2 source
1. `genvm-lint check contracts/SubstituteProof.py`
2. `genvm-lint typecheck contracts/SubstituteProof.py`
3. `genvm-lint schema contracts/SubstituteProof.py`
4. Direct Mode tests under `tests/direct/`

Attack specifically:
- Can `withdraw_substitution` authorize or mutate the pending candidate/active baseline?
- Can withdrawal be used to reroll the same candidate?
- Can provider withdraw after completion/while ACTIVE/no pending state?
- Can outsider/buyer invoke provider withdrawal?
- Can a rejected critical candidate re-freeze?
- Can a stored MATERIAL classification ever auto-activate?
- Does original-baseline salami resistance still hold?
- Does any role/timeout/finalize/replace path bypass buyer protection?
- Do docs still overclaim external truth/provenance?
- Does the new method/type/state shape pass GenVM lint/typecheck and Direct Mode?

Do not recommend cosmetic refactors. Separate true deploy blockers from non-blocking design commentary.

End with exactly:
`SAFE TO DEPLOY AS-IS — YES`
or
`SAFE TO DEPLOY AS-IS — NO`

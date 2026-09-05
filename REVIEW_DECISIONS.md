# SubstituteProof independent-review filtering decisions

The v1 reviewer concluded the contract had no exploitable defect, but returned `SAFE TO DEPLOY AS-IS — NO`.

We filtered the findings through the standing steward rules:

## Patched
- SP-B1 Direct Mode test mechanics: true predeploy evidence blocker.
- SP-R1 buyer-silence deadlock: treated as a liveness blocker under our own gate. Added provider-only withdrawal that can only retreat to the already-authorized active manifest; the withdrawn candidate is permanently blocked.
- SP-R4 V6/V9 mutation survivors: added executable regressions and mutation coverage because reviewer-runnable behavioral proof must catch buyer-protection bypass mutations.

## Documented, not redesigned
- SP-R2: equivalent prose substitutions auto-activate by design; buyer approval is required only for material substitutions. This limitation is now explicit.
- SP-R3: repeated known-material review is griefing, not an authorization bypass, and remains proposal-bounded. No extra state complexity added.
- SP-R5: 18-call bound is explicitly qualified as committed consensus rounds.
- SP-R6: `service_name` remains semantic by design so a name-only rebrand is not automatically material.

No challenge/reversal method was added for an auto-activated equivalent substitute. No service-name critical-field rule was added.


## v2 final independent review
The v2 reviewer concluded **SAFE TO DEPLOY AS-IS — YES** on exact contract SHA `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`.

No production-contract blocker remained. The reviewer identified one uncovered invariant on `withdraw_substitution` (ledger preservation) and packaging hygiene only. We adopted the ledger-preservation regression, added the matching mutation, removed `.pytest_cache/`, clarified the known-material re-review design in `LOCKED_SPEC.md`, and refreshed evidence/manifest/checksums. These changes do not modify the production contract source and therefore do not invalidate the exact-source lint/typecheck/schema/Direct Mode result.

# SubstituteProof security design decisions

This document records the production decisions that materially affect safety, liveness, and claim scope.

## Patched before deployment

- Direct Mode fixture/deployment mechanics were corrected so executable validation matched the production contract path.
- Buyer-silence liveness was addressed with provider-only `withdraw_substitution()`. Withdrawal can only retreat to the already-authorized active manifest; the withdrawn candidate is permanently blocked.
- Regression and mutation coverage was expanded so buyer-protection bypasses, including ledger-preservation failures, are caught by executable tests.

## Intentional design boundaries

- Equivalent prose substitutions auto-activate by design. Buyer approval is required only for material substitutions.
- Repeated known-material review is proposal-bounded and is not treated as an authorization bypass.
- The semantic-call bound applies to committed consensus rounds.
- `service_name` remains semantic rather than a deterministic critical field, so a name-only rebrand is not automatically material.
- No challenge/reversal method is added after an equivalent substitute activates.

## Frozen production source

The deployed contract source is frozen at SHA256:

`15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`

The final StudioNet behavior and source parity are recorded under `onchain-evidence/`.

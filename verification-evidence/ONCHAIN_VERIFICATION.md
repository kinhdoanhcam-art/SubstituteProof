# SubstituteProof — StudioNet Runtime Verification

## Final deployment
- Contract: `0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`
- Explorer: `https://explorer-studio.genlayer.com/address/0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`
- Production source SHA256: `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`
- Source parity: **PROVEN** after newline normalization. The Studio copy uses CRLF; normalized deployed SHA equals the reviewed LF source SHA.

## Runtime agreement
- Agreement ref: `substituteproof-runtime-001`
- Agreement ID: `791b20f01944f2e46a2ffddcd8700429ee58c4cf229e1fd4aec8eef390d87584`
- Provider: `0x3065E31B1D993d7C0D59E6786844cBa56780B2d3`
- Buyer: `0x86895976a0c43A9Be69b1DEd865e9726eE80BA77`

## Executed behavioral proof
1. Provider tried buyer-only acceptance -> rollback `ONLY_BUYER`; buyer acceptance then succeeded.
2. Exact active manifest -> `NO_CHANGE_ACTIVE`, no model call.
3. `jurisdiction` change -> `CRITICAL_MATERIAL_SUBSTITUTION`, `model_called=false`, handoff frozen.
4. Finalize while frozen -> rollback `HANDOFF_FROZEN_PENDING_BUYER_APPROVAL`.
5. Provider tried buyer approval -> rollback `ONLY_BUYER`.
6. Provider withdrawal -> prior authorized manifest remained active; withdrawn candidate became permanently rejected.
7. Retry of withdrawn candidate with new wording -> `BUYER_REJECTED_CANDIDATE`, no model call.
8. Prose-only equivalent candidate -> GenLayer consensus `EQUIVALENT_SUBSTITUTE`, `AUTO_APPROVED`, model called.
9. Prose-only capability loss -> GenLayer consensus `MATERIAL_SUBSTITUTION`, buyer review, model called.
10. Buyer rejected material candidate -> prior authorized manifest remained active.
11. Same buyer-rejected candidate with new wording -> blocked, no new semantic call.
12. `data_retention_mode` change -> deterministic critical material, no model call.
13. Buyer approved that retention change -> active manifest updated while original buyer-accepted manifest stayed immutable.
14. Follow-up candidate retained the same approved retention and only changed prose versus the active version, but still triggered `critical_changes=["data_retention_mode"]` because the contract compares to the ORIGINAL baseline. This is the salami-drift proof.
15. Finalize using the old original manifest -> rollback `DELIVERED_MANIFEST_NOT_AUTHORIZED`.
16. Finalize using the exact active buyer-approved manifest -> success -> `COMPLETED`.
17. New substitution after completion -> rollback `AGREEMENT_NOT_ACTIVE`.

## Final durable state
```text
status = COMPLETED
proposal_count = 8
semantic_calls_total = 2
budget_grants = 0
pending_proposal_id = ""

original_manifest_key =
6bf0843572c3166e940139b3e2677c7d6fb92ba103869f8178bba6e58ca5d4aa

active_manifest_key =
3449c092a5e1397741003e739c846336f765371cf5da8d8634af9532b2847e63

completed_manifest_key =
3449c092a5e1397741003e739c846336f765371cf5da8d8634af9532b2847e63
```

Rejected-candidate ledger retained all withdrawn/rejected candidates, including the jurisdiction change, semantic-material candidate, and salami follow-up candidate.

## Evidence files
The `screenshots/` directory contains source parity plus the key StudioNet success/rollback checkpoints. `RUNTIME_EVIDENCE.json` provides the machine-readable case summary and expected claim-to-evidence mapping.

## Honest scope
This proves the contract's declared-manifest state machine and approval/finalization controls on StudioNet. It does **not** prove that an off-chain service actually matches a submitted manifest, and it does not establish publisher provenance.

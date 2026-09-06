# SubstituteProof — Release Readiness

## Contract
- Final StudioNet deployment: `0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`
- Exact production source SHA256: `15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`
- Source parity: **PROVEN**
- Contract source frozen: **YES**

## Exact-source validation
- `genvm-lint check`: PASS
- `genvm-lint typecheck`: PASS
- schema: PASS (13 methods)
- Direct Mode executable checks: 32/32 PASS

## Executable/local checks
- actual contract core: 24/24 PASS
- adversarial: 18/18 PASS
- prompt fence: 0/12 bypasses
- mutation matrix: 18/18 caught

## StudioNet on-chain verification
**COMPLETE.** The final deployment exercised role boundaries, deterministic critical materiality, frozen-finalize rollback, provider withdrawal liveness, rejected-candidate anti-reroll, semantic equivalent/material consensus, buyer reject/approve behavior, original-baseline salami resistance, exact-delivery binding, and terminal completion.

Reference agreement:
`791b20f01944f2e46a2ffddcd8700429ee58c4cf229e1fd4aec8eef390d87584`

Evidence is stored under `onchain-evidence/`.

## Frontend
- functional React/Vite workspace: COMPLETE
- web3 protocol-console visual system: COMPLETE
- `Protocol Trace` evidence page: COMPLETE
- final deployment address embedded: YES
- reference agreement shortcut: YES
- post-write finalized-state verification: YES
- TypeScript syntax transpile: PASS
- live Vercel build/smoke: RECHECK AFTER UI UPDATE

## Remaining before public release freeze
1. Push this package to GitHub.
2. Let Vercel install dependencies and run `npm run build`.
3. Smoke-test Overview, Protocol Trace, wallet connect, reference agreement loading, and role/status rendering.
4. Freeze the repo unless a real deployment/UI blocker appears.

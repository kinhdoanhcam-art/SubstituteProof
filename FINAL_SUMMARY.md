# SubstituteProof — Final Runtime + UI Summary

SubstituteProof prevents post-agreement AI-service substitution by binding later candidates to the original buyer-accepted manifest. The buyer-accepted manifest stays immutable. Every later candidate is checked against that original baseline: critical structured changes are material deterministically, while prose-only changes use GenLayer validators for one narrow material-equivalence decision. Material changes freeze handoff until buyer action, and completion is bound to the exact authorized manifest.

## Final deployment
`0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`

Explorer:
`https://explorer-studio.genlayer.com/address/0x5C35342ED2bCf45517F676FAAe22fDa83302Bd10`

Source SHA256:
`15475702743d840b77863355833f71fa17e099a7f90070680b8d390f5f655c41`

Source parity: **PROVEN**.

## Protocol trace
Reference agreement:
`791b20f01944f2e46a2ffddcd8700429ee58c4cf229e1fd4aec8eef390d87584`

Final state:
- `COMPLETED`
- 8 proposals
- 2 semantic calls
- 0 budget grants
- original manifest key remained immutable
- active/completed key exactly matched the buyer-approved retention manifest
- three withdrawn/rejected candidates remained in the anti-reroll ledger

The on-chain verification covered every high-risk steward path: role boundaries, deterministic critical classification, non-bypassable freeze, withdrawal liveness, reroll prevention, semantic equivalent/material branches, buyer resolution, salami/original-baseline binding, exact delivery binding, and terminal completion.

## Frontend
The final UI uses a web3 protocol-console system with a dark chain/protocol shell, bright readable work surfaces, modern sans typography, teal/cyan on-chain accents, and an agreement-to-substitute gate motif. It exposes the real production contract path and finalized StudioNet evidence.

Pages:
- Overview
- Create Agreement
- Propose Substitute
- Buyer Review
- Finalize Handoff
- Inspect State
- Protocol Trace

The proposal workspace renders the immutable original beside the candidate and pre-labels declared differences as deterministic critical or semantic fields. Contract verdicts are still taken only from finalized on-chain state.

## Final verification status
- Contract source unchanged after validation and StudioNet deployment.
- Local contract gates PASS.
- StudioNet runtime PASS.
- Frontend syntax PASS.
- Production Vercel build/smoke: PASS (`https://substitute-proof.vercel.app`).

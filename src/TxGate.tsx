import { useCallback, useMemo, useState } from 'react';
import { createTransactionKit, type TransactionKit } from '@genlayer/transaction-kit';
import {
  GenLayerTransactionPanel,
  describeOutcome,
  type SubmitInput,
  type TrackedStatus,
} from '@genlayer/transaction-kit-react';
import { GENLAYER_CHAIN, GENLAYER_CHAIN_NAME } from './network';
import { connectAccount, getProvider, switchAccount } from './genlayer';

/**
 * A pre-signature advisory, supplied by the caller.
 *
 * SubstituteProof is the only project here with a *bounded* AI budget: three
 * semantic calls per grant, at most five grants, and only the buyer can grant
 * more. The fee panel quotes GEN, but GEN is not the scarce resource for a
 * proposal — the semantic call is. Signing blind is how a provider burns the
 * last call on a candidate they could have withdrawn.
 *
 * So the gate states, before signing, whether this write can consume a call and
 * how many remain, and refuses to sign when the budget is already spent rather
 * than letting the user pay a fee for a transaction that returns
 * SEMANTIC_BUDGET_EXHAUSTED.
 */
export type WriteAdvisory = {
  callsUsed: number;
  capacity: number;
  /** true when this method can consume a semantic call. */
  consumesCall: boolean;
};

type Pending = {
  tx: SubmitInput;
  label: string;
  advisory?: WriteAdvisory;
  onHash?: (hash: string) => void;
  resolve: (status: TrackedStatus) => void;
  reject: (error: Error) => void;
};

export type GateClient = {
  run: (
    address: `0x${string}`,
    method: string,
    args: unknown[],
    onHash?: (hash: string) => void,
    advisory?: WriteAdvisory,
  ) => Promise<TrackedStatus>;
};

/**
 * Consensus v0.6 signing gate.
 *
 * Studio Next charges fees, so a write can no longer be a bare `writeContract`.
 * `run()` returns a promise that settles only after the user has reviewed the
 * fee quote, signed, and the network has decided the transaction — which lets
 * the existing call site keep its `await writeAndFinalize(...)` shape and its own
 * contract-state postcondition check.
 *
 * SubstituteProof moves no native value: no method is payable and the contract
 * never emits a transfer, so every write goes through the panel with
 * `userValue: 0n` and none of them needs a message-allocation tree.
 *
 * SP-RACE-1 — why `trackUntil="finalized"` and not `"decided"`:
 * the kit's tracker returns at phase `decided`, which `isDecided()` maps from
 * statusName ACCEPTED onward. Every read in this app passes
 * `TransactionHashVariant.LATEST_FINAL`, which only sees FINALIZED state. With
 * `"decided"` the caller's postcondition read fires in the ACCEPTED→FINALIZED
 * window, `get_agreement` returns "", and a write that SUCCEEDED on chain is
 * reported to the user as a failed postcondition with no agreement id. Observed
 * on SP-DEMO-05: explorer SUCCESS / Finalized, UI "Finalized create did not
 * produce expected agreement state." Gated by scripts/gate_finality_contract.mjs.
 *
 * The kit is rebuilt whenever the account changes, so a wallet switch can never
 * sign with the previous address' quote.
 */
export function useTxGate() {
  const [account, setAccount] = useState<`0x${string}` | ''>('');
  const [pending, setPending] = useState<Pending | null>(null);

  const kit: TransactionKit | null = useMemo(() => {
    const provider = getProvider();
    if (!provider || !account) return null;
    return createTransactionKit({ chain: GENLAYER_CHAIN, provider, account });
  }, [account]);

  const run = useCallback<GateClient['run']>((address, method, args, onHash, advisory) => {
    if (advisory?.consumesCall && advisory.callsUsed >= advisory.capacity) {
      return Promise.reject(
        new Error(
          `Semantic budget exhausted: ${advisory.callsUsed}/${advisory.capacity} calls used. ` +
            'This proposal would be blocked on chain, so nothing was submitted. ' +
            'The buyer can grant three more calls.',
        ),
      );
    }
    return new Promise<TrackedStatus>((resolve, reject) => {
      setPending({
        tx: { kind: 'write', address, method, args },
        label: method,
        advisory,
        onHash,
        resolve,
        reject,
      });
    });
  }, []);

  const client = useMemo<GateClient>(() => ({ run }), [run]);

  const connect = useCallback(async () => {
    const next = await connectAccount();
    setAccount(next);
    return { account: next, client };
  }, [client]);

  const changeAccount = useCallback(async () => {
    const next = await switchAccount();
    setAccount(next);
    return { account: next, client };
  }, [client]);

  function settleDone(status: TrackedStatus) {
    if (!pending) return;
    if (status.genlayerTxId) pending.onHash?.(status.genlayerTxId);
    if (status.successful === false) {
      const outcome = describeOutcome(status.statusName, status.executionResultName);
      pending.reject(new Error(`${pending.label} did not execute: ${outcome.title}. ${outcome.detail}`));
    } else {
      pending.resolve(status);
    }
    setPending(null);
  }

  function cancel() {
    if (!pending) return;
    pending.reject(new Error('Transaction cancelled before signing. Nothing was submitted.'));
    setPending(null);
  }

  const modal =
    pending && kit ? (
      <div className="txgate-backdrop" role="dialog" aria-modal="true" aria-label={`Review fees for ${pending.label}`}>
        <div className="txgate-sheet">
          <div className="txgate-head">
            <div>
              <span className="txgate-eyebrow">Fees · Consensus v0.6</span>
              <b>{pending.label}</b>
            </div>
            <button type="button" className="txgate-close" onClick={cancel}>
              Cancel
            </button>
          </div>

          {pending.advisory?.consumesCall && (
            <div className="txgate-budget">
              <span className="txgate-eyebrow">Semantic budget</span>
              <b>
                {pending.advisory.callsUsed} of {pending.advisory.capacity} calls used
              </b>
              <p>
                A prose-only candidate spends one call. A change to a critical field is
                classified deterministically and spends none. Re-submitting a candidate that was
                already adjudicated spends none either.
              </p>
            </div>
          )}

          <GenLayerTransactionPanel
            kit={kit}
            tx={pending.tx}
            userValue={0n}
            network={GENLAYER_CHAIN_NAME}
            theme="dark"
            trackUntil="finalized"
            onDone={settleDone}
          />

          <p className="txgate-note">
            Tracked to FINALIZED, not merely decided: every postcondition in this app reads
            LATEST_FINAL, so releasing at ACCEPTED would hand the caller a read that cannot see the
            write yet. A finalized transaction is still not a verdict — contract state is re-read
            before anything is reported as done.
          </p>
        </div>
      </div>
    ) : null;

  return { account, client, connect, switchAccount: changeAccount, modal, busy: pending !== null };
}

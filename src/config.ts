export const DEFAULT_CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0x2E07cA0D78D3Ec9D0AFa67b82df5E0570F816C78') as `0x${string}`;

export const IS_DEPLOYED =
  /^0x[a-fA-F0-9]{40}$/.test(DEFAULT_CONTRACT_ADDRESS) &&
  DEFAULT_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

/**
 * Showcase agreement for the Verification page.
 *
 * The previous build hardcoded an agreement id, a provider, a buyer and a
 * contract hash from the StudioNet deployment, and labelled the hash
 * "Source match confirmed". On this deployment those records do not exist, so a
 * reader following them finds nothing — the page was asserting a run that never
 * happened here. Nothing is hardcoded now: set this only after the flow has been
 * executed against the deployed contract, with the id that run produced.
 */
export const RUNTIME_AGREEMENT_ID = import.meta.env.VITE_RUNTIME_AGREEMENT_ID || '';

/**
 * sha256 of contracts/SubstituteProof.py. Displayed as a claim the reader can
 * check with `npm run verify:deployed`, never as a verdict the app asserts.
 */
export const CONTRACT_SHA256 = import.meta.env.VITE_CONTRACT_SHA256 || '';

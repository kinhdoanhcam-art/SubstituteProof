export type Manifest = {
  service_name: string;
  jurisdiction: string;
  model_class: string;
  max_delegation_depth: number;
  data_sources: string[];
  data_retention_mode: string;
  capabilities: string;
  service_description: string;
  limitations: string;
};

export type AgreementStatus = 'PENDING_BUYER_ACCEPTANCE' | 'ACTIVE' | 'BUYER_APPROVAL_REQUIRED' | 'COMPLETED';

export type AgreementRecord = {
  agreement_id: string;
  agreement_ref: string;
  provider: string;
  buyer: string;
  status: AgreementStatus;
  original_manifest: Manifest;
  original_manifest_json: string;
  original_manifest_key: string;
  active_manifest: Manifest;
  active_manifest_json: string;
  active_manifest_key: string;
  pending_proposal_id: string;
  latest_proposal_id: string;
  proposal_count: number;
  semantic_calls_total: number;
  budget_grants: number;
  adjudicated: Record<string, 'EQUIVALENT_SUBSTITUTE' | 'MATERIAL_SUBSTITUTION'>;
  rejected_candidates: Record<string, boolean>;
  completed_manifest_key: string;
  created_at: string;
  accepted_at: string;
  updated_at: string;
  completed_at: string;
};

export type ProposalRecord = {
  proposal_id: string;
  agreement_id: string;
  provider: string;
  note: string;
  candidate_manifest: Manifest;
  candidate_manifest_json: string;
  candidate_manifest_key: string;
  critical_changes: string[];
  outcome:
    | 'NO_CHANGE_ACTIVE'
    | 'RESTORE_ORIGINAL'
    | 'CRITICAL_MATERIAL_SUBSTITUTION'
    | 'EQUIVALENT_SUBSTITUTE'
    | 'MATERIAL_SUBSTITUTION'
    | 'REUSED_EQUIVALENT_CLASSIFICATION'
    | 'REUSED_MATERIAL_CLASSIFICATION'
    | 'BUYER_REJECTED_CANDIDATE'
    | 'SEMANTIC_BUDGET_EXHAUSTED';
  prior_classification: string;
  model_called: boolean;
  proposal_status:
    | 'AUTO_APPROVED'
    | 'BUYER_REVIEW'
    | 'BUYER_APPROVED'
    | 'BUYER_REJECTED'
    | 'PROVIDER_WITHDRAWN'
    | 'BLOCKED'
    | 'NO_CHANGE';
  created_at: string;
  resolved_at: string;
};

export type CountsRecord = { agreement_count: number; global_proposal_count: number };

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, listener: (...args: any[]) => void) => void;
      removeListener?: (event: string, listener: (...args: any[]) => void) => void;
    };
  }
}

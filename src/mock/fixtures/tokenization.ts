/** Tokenization compliance domain — the control surface over the Phase 2
 * ERC-3643 (T-REX) security token that mirrors fund units on chain.
 *
 * Three separable concerns, deliberately three boards rather than one:
 *   - Issuance: does this mint instruction have multi-party approval and does
 *     the requested supply reconcile to units actually in issue off chain?
 *   - Lifecycle: what has happened to tokens since — transfers, freezes,
 *     forced transfers, recoveries, burns — and was each one authorised?
 *   - Smart contracts: which code is live, at which version, audited by whom.
 *
 * The off-chain Postgres ledger stays the book of record. Every number here is
 * a *claim about the chain* that Compliance reconciles against it, which is
 * why supply variance is a first-class field and not a derived footnote. */

export type TokenChain = "Polygon" | "Ethereum" | "Base";

export type IssuanceStatus = "draft" | "pending_approval" | "approved" | "minted" | "rejected";

export const ISSUANCE_STATUS_LABELS: Record<IssuanceStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved — not yet minted",
  minted: "Minted",
  rejected: "Rejected",
};

export type IssuanceApproval = { name: string; role: string; at: string };

export type TokenIssuance = {
  id: string;
  ref: string;
  /** Which sub-fund's units this batch represents. */
  subFund: string;
  tokenSymbol: string;
  chain: TokenChain;
  /** Units requested on chain, and units actually in issue off chain at the
   * same cut. A non-zero difference is the whole reason this board exists. */
  unitsRequested: number;
  unitsOffChain: number;
  status: IssuanceStatus;
  requestedBy: string;
  requestedAt: string;
  /** Multi-party approval — a single compromised credential must never move
   * tokenized units alone (architecture §Tokenization). Two signatures
   * required; one recorded signature is not enough to mint. */
  approvals: IssuanceApproval[];
  requiredApprovals: number;
  /** Every recipient wallet cleared the whitelist registry. */
  whitelistCleared: boolean;
  /** Recipients resolve to jurisdictions currently open for distribution. */
  jurisdictionCleared: boolean;
  txHash?: string;
  note?: string;
};

export type LifecycleEventType = "mint" | "transfer" | "freeze" | "unfreeze" | "forced_transfer" | "burn" | "recovery" | "whitelist_add" | "whitelist_remove";

export const LIFECYCLE_EVENT_LABELS: Record<LifecycleEventType, string> = {
  mint: "Mint",
  transfer: "Transfer",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  forced_transfer: "Forced transfer",
  burn: "Burn",
  recovery: "Wallet recovery",
  whitelist_add: "Whitelist — add",
  whitelist_remove: "Whitelist — remove",
};

/** Which event types are privileged — they move or immobilise someone else's
 * tokens and therefore always need a recorded authority and reason. A
 * privileged event with no authority is the finding, not the event. */
export const PRIVILEGED_EVENTS: readonly LifecycleEventType[] = ["freeze", "forced_transfer", "burn", "recovery", "whitelist_remove"];

export type LifecycleEvent = {
  id: string;
  ref: string;
  type: LifecycleEventType;
  tokenSymbol: string;
  units: number;
  holder: string;
  counterparty?: string;
  at: string;
  initiatedBy: string;
  /** The control record: who authorised a privileged action, and why. */
  authorisedBy?: string;
  reason?: string;
  /** Set when the event needs Compliance attention rather than being routine. */
  flag?: "unauthorised" | "review_pending" | "reconciled_late";
  txHash?: string;
};

export type SmartContractStatus = "active" | "paused" | "deprecated";

export const SMART_CONTRACT_STATUS_LABELS: Record<SmartContractStatus, string> = {
  active: "Active",
  paused: "Paused",
  deprecated: "Deprecated",
};

export type SmartContract = {
  id: string;
  name: string;
  purpose: string;
  standard: string;
  address: string;
  chain: TokenChain;
  version: string;
  status: SmartContractStatus;
  deployedAt: string;
  /** Who holds the admin key, and whether the contract can be upgraded at all.
   * An upgradeable contract with a single-signature owner is the highest-risk
   * combination on this page. */
  owner: string;
  upgradeable: boolean;
  multisigThreshold?: string;
  auditFirm?: string;
  auditedAt?: string;
  auditStatus: "clean" | "findings_open" | "not_audited";
  openFindings: number;
  pendingChange?: string;
};

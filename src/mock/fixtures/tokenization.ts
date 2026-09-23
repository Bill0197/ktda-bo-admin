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

// ---- Token issuance ----

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

export const TOKEN_ISSUANCES: TokenIssuance[] = [
  { id: "ti_7", ref: "MINT-2026-0041", subFund: "KES Fixed Income", tokenSymbol: "ICKES", chain: "Polygon", unitsRequested: 1_250_000, unitsOffChain: 1_250_000, status: "pending_approval", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-09-02T09:20:00Z", approvals: [{ name: "Daniel Kiptoo", role: "Head of Finance", at: "2026-09-02T10:05:00Z" }], requiredApprovals: 2, whitelistCleared: true, jurisdictionCleared: true, note: "Monthly top-up mint for diaspora subscriptions settled in August." },
  { id: "ti_6", ref: "MINT-2026-0040", subFund: "USD Eurobond", tokenSymbol: "ICUSD", chain: "Polygon", unitsRequested: 84_000, unitsOffChain: 83_400, status: "pending_approval", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-09-01T14:40:00Z", approvals: [], requiredApprovals: 2, whitelistCleared: true, jurisdictionCleared: false, note: "Held: 600-unit supply variance against the off-chain register, and two recipient wallets resolve to a jurisdiction still under review." },
  { id: "ti_5", ref: "MINT-2026-0039", subFund: "KES Fixed Income", tokenSymbol: "ICKES", chain: "Polygon", unitsRequested: 940_000, unitsOffChain: 940_000, status: "minted", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-08-04T08:10:00Z", approvals: [{ name: "Daniel Kiptoo", role: "Head of Finance", at: "2026-08-04T09:00:00Z" }, { name: "Kevin Baraka", role: "Institutional Funds Compliance Manager", at: "2026-08-04T09:35:00Z" }], requiredApprovals: 2, whitelistCleared: true, jurisdictionCleared: true, txHash: "0x8f21…c47a", note: "Settled and reconciled to the unit register the same day." },
  { id: "ti_4", ref: "MINT-2026-0038", subFund: "USD Eurobond", tokenSymbol: "ICUSD", chain: "Polygon", unitsRequested: 52_000, unitsOffChain: 52_000, status: "minted", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-07-06T08:05:00Z", approvals: [{ name: "Daniel Kiptoo", role: "Head of Finance", at: "2026-07-06T08:50:00Z" }, { name: "Josephine Muthoni", role: "MLRO", at: "2026-07-06T09:12:00Z" }], requiredApprovals: 2, whitelistCleared: true, jurisdictionCleared: true, txHash: "0x2b90…1ff3" },
  { id: "ti_3", ref: "MINT-2026-0037", subFund: "KES Fixed Income", tokenSymbol: "ICKES", chain: "Polygon", unitsRequested: 300_000, unitsOffChain: 0, status: "rejected", requestedBy: "System (subscription batch)", requestedAt: "2026-06-29T17:02:00Z", approvals: [], requiredApprovals: 2, whitelistCleared: false, jurisdictionCleared: true, note: "Rejected — batch fired before the subscriptions settled, so no units existed off chain to mirror." },
  { id: "ti_2", ref: "MINT-2026-0036", subFund: "KES Fixed Income", tokenSymbol: "ICKES", chain: "Polygon", unitsRequested: 610_000, unitsOffChain: 610_000, status: "approved", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-08-28T11:30:00Z", approvals: [{ name: "Daniel Kiptoo", role: "Head of Finance", at: "2026-08-28T12:00:00Z" }, { name: "Kevin Baraka", role: "Institutional Funds Compliance Manager", at: "2026-08-28T12:20:00Z" }], requiredApprovals: 2, whitelistCleared: true, jurisdictionCleared: true, note: "Approved; queued behind the custodian's chain-indexer maintenance window." },
  { id: "ti_1", ref: "MINT-2026-0035", subFund: "USD Eurobond", tokenSymbol: "ICUSD", chain: "Polygon", unitsRequested: 12_500, unitsOffChain: 12_500, status: "draft", requestedBy: "Ruth Nyambura (Investment Manager)", requestedAt: "2026-09-03T05:50:00Z", approvals: [], requiredApprovals: 2, whitelistCleared: false, jurisdictionCleared: true, note: "Draft — recipient whitelist upload still pending from Operations." },
];

// ---- Token lifecycle ----

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

export const LIFECYCLE_EVENTS: LifecycleEvent[] = [
  { id: "le_12", ref: "EVT-91204", type: "freeze", tokenSymbol: "ICKES", units: 84_000, holder: "Brian Otieno", at: "2026-09-02T11:15:00Z", initiatedBy: "Peter Otieno (Compliance Analyst)", authorisedBy: "Josephine Muthoni (MLRO)", reason: "Structuring case cs_1 open — tokens immobilised pending EDD outcome.", txHash: "0x71ac…9d02" },
  { id: "le_11", ref: "EVT-91198", type: "forced_transfer", tokenSymbol: "ICUSD", units: 1_200, holder: "Wallet 0x9c3f…41b8", counterparty: "Esther Chebet (recovered wallet)", at: "2026-09-01T16:40:00Z", initiatedBy: "IT Admin", reason: "Seed phrase lost — holder identity re-verified.", flag: "review_pending", txHash: "0x55e1…7b4c" },
  { id: "le_10", ref: "EVT-91190", type: "whitelist_remove", tokenSymbol: "ICUSD", units: 0, holder: "Wallet 0x4d70…c113", at: "2026-08-31T08:05:00Z", initiatedBy: "System (daily re-screening)", authorisedBy: "Kevin Baraka (Institutional Funds Compliance Manager)", reason: "Holder's residence jurisdiction moved to Excluded on the distribution whitelist." },
  { id: "le_9", ref: "EVT-91181", type: "transfer", tokenSymbol: "ICKES", units: 45_000, holder: "Amina Wanjiru", counterparty: "Cynthia Njeri", at: "2026-08-30T13:22:00Z", initiatedBy: "Holder", txHash: "0x0a8d…3e19" },
  { id: "le_8", ref: "EVT-91177", type: "burn", tokenSymbol: "ICKES", units: 120_000, holder: "Treasury wallet", at: "2026-08-29T17:00:00Z", initiatedBy: "Ruth Nyambura (Investment Manager)", authorisedBy: "Daniel Kiptoo (Head of Finance)", reason: "Redemption batch RDM-2026-08 settled off chain — mirrored units retired.", txHash: "0x9f42…8c60" },
  { id: "le_7", ref: "EVT-91166", type: "transfer", tokenSymbol: "ICUSD", units: 800, holder: "Esther Chebet", counterparty: "Wallet 0x71bb…20af", at: "2026-08-27T09:44:00Z", initiatedBy: "Holder", flag: "reconciled_late", txHash: "0x3d17…aa55" },
  { id: "le_6", ref: "EVT-91150", type: "mint", tokenSymbol: "ICKES", units: 940_000, holder: "Treasury wallet", at: "2026-08-04T09:40:00Z", initiatedBy: "Ruth Nyambura (Investment Manager)", authorisedBy: "Kevin Baraka (Institutional Funds Compliance Manager)", reason: "MINT-2026-0039.", txHash: "0x8f21…c47a" },
  { id: "le_5", ref: "EVT-91142", type: "unfreeze", tokenSymbol: "ICKES", units: 30_000, holder: "David Mwangi", at: "2026-08-02T10:10:00Z", initiatedBy: "Peter Otieno (Compliance Analyst)", authorisedBy: "Kevin Baraka (Institutional Funds Compliance Manager)", reason: "Alert aml_2 cleared — no suspicious activity found.", txHash: "0x64c9…12de" },
  { id: "le_4", ref: "EVT-91120", type: "whitelist_add", tokenSymbol: "ICUSD", units: 0, holder: "Wallet 0xab52…7701", at: "2026-07-28T12:00:00Z", initiatedBy: "Operations", authorisedBy: "Kevin Baraka (Institutional Funds Compliance Manager)", reason: "Diaspora investor onboarded, enhanced KYC tier." },
  { id: "le_3", ref: "EVT-91101", type: "recovery", tokenSymbol: "ICKES", units: 15_500, holder: "Wallet 0x88fd…4a2c", counterparty: "Amina Wanjiru (new wallet)", at: "2026-07-19T15:25:00Z", initiatedBy: "IT Admin", authorisedBy: "Josephine Muthoni (MLRO)", reason: "Device loss — identity re-verified by video KYC.", txHash: "0x1c77…5e88" },
];

// ---- Smart contract management ----

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

export const SMART_CONTRACTS: SmartContract[] = [
  { id: "sc_1", name: "ICKES Security Token", purpose: "Transfer-restricted token mirroring KES Fixed Income units.", standard: "ERC-3643 (T-REX)", address: "0x5a91b3…7f20", chain: "Polygon", version: "2.1.0", status: "active", deployedAt: "2026-04-18", owner: "Fireblocks vault — Investcent Treasury", upgradeable: true, multisigThreshold: "2 of 3", auditFirm: "Hacken", auditedAt: "2026-04-02", auditStatus: "clean", openFindings: 0 },
  { id: "sc_2", name: "ICUSD Security Token", purpose: "Transfer-restricted token mirroring USD Eurobond units.", standard: "ERC-3643 (T-REX)", address: "0x77c0d2…9a14", chain: "Polygon", version: "2.1.0", status: "active", deployedAt: "2026-04-18", owner: "Fireblocks vault — Investcent Treasury", upgradeable: true, multisigThreshold: "2 of 3", auditFirm: "Hacken", auditedAt: "2026-04-02", auditStatus: "clean", openFindings: 0 },
  { id: "sc_3", name: "Identity Registry", purpose: "On-chain whitelist — maps verified holder identities to wallets.", standard: "ERC-3643 IdentityRegistry", address: "0x1de4a8…33b7", chain: "Polygon", version: "2.0.4", status: "active", deployedAt: "2026-04-18", owner: "Fireblocks vault — Compliance", upgradeable: true, multisigThreshold: "2 of 3", auditFirm: "Hacken", auditedAt: "2026-04-02", auditStatus: "findings_open", openFindings: 2, pendingChange: "v2.1.0 upgrade queued — adds jurisdiction expiry so a whitelist entry lapses instead of persisting after a country moves to Excluded." },
  { id: "sc_4", name: "Compliance Module", purpose: "Enforces transfer rules — jurisdiction, holding limits, lock-ups.", standard: "ERC-3643 ModularCompliance", address: "0x9b02f1…c58d", chain: "Polygon", version: "2.1.0", status: "active", deployedAt: "2026-04-18", owner: "Fireblocks vault — Compliance", upgradeable: true, multisigThreshold: "3 of 4", auditFirm: "Hacken", auditedAt: "2026-04-02", auditStatus: "clean", openFindings: 0 },
  { id: "sc_5", name: "Claim Topics Registry", purpose: "Declares which verified claims a holder must carry to transact.", standard: "ERC-3643 ClaimTopicsRegistry", address: "0x2f74be…41a9", chain: "Polygon", version: "2.0.1", status: "active", deployedAt: "2026-04-18", owner: "Fireblocks vault — Compliance", upgradeable: false, auditFirm: "Hacken", auditedAt: "2026-04-02", auditStatus: "clean", openFindings: 0 },
  { id: "sc_6", name: "Distribution Escrow (pilot)", purpose: "Held coupon distributions for the M-Pesa settlement pilot.", standard: "Custom", address: "0x63aa07…1b52", chain: "Base", version: "0.9.2", status: "paused", deployedAt: "2026-06-30", owner: "EOA — Baracel deployer key", upgradeable: true, auditStatus: "not_audited", openFindings: 0, pendingChange: "Paused pending audit. Single-signature owner on an upgradeable contract — must move to the 2-of-3 vault before it holds live value." },
  { id: "sc_7", name: "ICKES Security Token (v1)", purpose: "Superseded token contract from the closed pilot cohort.", standard: "ERC-3643 (T-REX)", address: "0x30ff62…8e01", chain: "Polygon", version: "1.4.2", status: "deprecated", deployedAt: "2026-01-22", owner: "Fireblocks vault — Investcent Treasury", upgradeable: false, auditFirm: "Hacken", auditedAt: "2026-01-10", auditStatus: "clean", openFindings: 0, pendingChange: "Balances migrated to v2 on 2026-04-20. Retained read-only for the audit trail." },
];

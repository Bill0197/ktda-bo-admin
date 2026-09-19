import type { AdminRole, ApprovalKind } from "./admin";

/** Platform configuration domain — the BO Admin Panel is the single point of
 * truth for every commercial/business parameter the six front ends (and the
 * upcoming investor mobile app) consume. Nothing here changes silently: a
 * setting edit becomes a `static_data_change` approval item and only applies
 * once a second person signs it off (maker-checker), and every change lands
 * in the audit trail. */

export type PlatformSettingSection =
  | "fund_parameters"
  | "liquidity_policy"
  | "fees_commissions"
  | "compliance_thresholds"
  | "nav_valuation"
  | "service_standards"
  | "payments"
  | "security_policy";

export const SETTING_SECTION_LABELS: Record<PlatformSettingSection, { title: string; description: string }> = {
  fund_parameters: { title: "Fund parameters", description: "Product setup per sub-fund — minimums and dealing basics every investor surface reads." },
  liquidity_policy: { title: "Liquidity & redemption policy", description: "The gate clause and facility covenants from the concept note's liquidity framework." },
  fees_commissions: { title: "Fees, commissions & IFA programme", description: "Management fee, exit fee, the IFA commission schedule and partner-programme terms." },
  compliance_thresholds: { title: "Compliance & AML thresholds", description: "Suitability scoring and the ongoing transaction-monitoring rule parameters." },
  nav_valuation: { title: "NAV & valuation", description: "Daily NAV computation controls — cut-offs and the variance tolerance that triggers independent review." },
  service_standards: { title: "Service standards & SLAs", description: "The SOPs' client-service and operations targets — dashboards and breach alerts read these." },
  payments: { title: "Payments & channels", description: "Rail configuration the Payment Ops portal and investor apps read — formats, cut-offs, environments." },
  security_policy: { title: "Security policy", description: "Session, authentication and access-review parameters across BO and investor surfaces." },
};

/** Central pending-change registry: any configurable object can stage a
 * change behind a static_data_change approval. `decideApproval` applies
 * (or discards) the closure when the checker decides. Keyed by approval id. */
export type PendingChange = { label: string; apply: (decidedBy: string) => void; clear: () => void };
export const PENDING_CHANGES = new Map<string, PendingChange>();

export type PlatformSetting = {
  key: string;
  section: PlatformSettingSection;
  label: string;
  description: string;
  value: string;
  unit?: string;
  /** Set while a static_data_change approval for this setting is pending. */
  pendingValue?: string;
  pendingApprovalId?: string;
  updatedAt: string;
  updatedBy: string;
};

export const PLATFORM_SETTINGS: PlatformSetting[] = [
  { key: "kes_min_investment", section: "fund_parameters", label: "Minimum investment — KES Fixed Income", description: "Smallest initial subscription the investor apps accept for the KES sub-fund.", value: "100", unit: "KES", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "usd_min_investment", section: "fund_parameters", label: "Minimum investment — USD Eurobond", description: "Smallest initial subscription the investor apps accept for the USD sub-fund.", value: "10", unit: "USD", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "distribution_day", section: "fund_parameters", label: "Distribution day", description: "When monthly coupon income is paid out or reinvested.", value: "Last business day of month", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "lockup_days", section: "fund_parameters", label: "Soft lock-up period", description: "Applies to the launch cohort — investors subscribing within this window of the fund's launch date pay the early-exit fee if they redeem inside it.", value: "180", unit: "days from launch", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },

  { key: "gate_threshold_pct", section: "liquidity_policy", label: "Redemption gate threshold", description: "If one dealing day's redemption requests exceed this share of AUM, the excess defers FIFO to the next day.", value: "10", unit: "% of AUM", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "gate_max_days", section: "liquidity_policy", label: "Maximum consecutive gate days", description: "Beyond this the gate needs a trustee-approved extension.", value: "5", unit: "dealing days", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "liquidity_facility_floor", section: "liquidity_policy", label: "Liquidity facility covenant", description: "The bank facility backing redemptions must stay at or above this share of AUM as the fund scales.", value: "5", unit: "% of AUM", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "facility_pricing", section: "liquidity_policy", label: "Liquidity facility pricing", description: "Arm's-length rate charged to the fund for the bank facility (concept note band CBR + 1.5–2.0%).", value: "CBR + 1.75", unit: "% p.a.", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "liquidity_review_cadence", section: "liquidity_policy", label: "Liquidity review cadence", description: "Fund-manager liquidity adequacy review presented to the trustee.", value: "Quarterly", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },

  { key: "management_fee_pct", section: "fees_commissions", label: "Management fee", description: "Annual fee accrued daily against NAV (concept note band 0.75–1.25%).", value: "1.00", unit: "% of NAV p.a.", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "exit_fee_pct", section: "fees_commissions", label: "Early-exit fee", description: "Charged on redemptions inside the soft lock-up period.", value: "1.5", unit: "%", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "ifa_commission_pct", section: "fees_commissions", label: "IFA commission rate", description: "Trailing commission on referred AUM — accrued monthly, paid quarterly. The IFA Portal reads this schedule.", value: "0.5", unit: "% of referred AUM p.a.", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "ifa_certification_validity", section: "fees_commissions", label: "IFA certification validity", description: "How long an advisor's certification lasts before recertification — the IFA Portal shows expiry from this.", value: "12", unit: "months", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Faith Kamau" },
  { key: "ifa_dd_review_cadence", section: "fees_commissions", label: "IFA due-diligence review", description: "Ongoing due-diligence and screening refresh for contracted advisors, per the BD SOP.", value: "Annual", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Faith Kamau" },
  { key: "wht_infra_bonds", section: "fees_commissions", label: "Withholding tax — infrastructure bond income", description: "Kenya infrastructure bonds are WHT-exempt per the concept note; income passes through untaxed. Final treatment is Open Question 7 — confirm with Investcent Tax before launch.", value: "0", unit: "%", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "wht_eurobonds", section: "fees_commissions", label: "Withholding tax — Eurobond coupon income", description: "Applied to USD sub-fund coupon income before distribution (Open Question 7 — rate pending Tax confirmation).", value: "15", unit: "%", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },

  { key: "straight_through_activation", section: "compliance_thresholds", label: "Straight-through activation", description: "When enabled, an application that is Low risk, screening-clear and EDD-free activates without a Compliance officer — the KYC/CDD Policy §10 approval table permits system approval for Low risk, subject to controls. Disable to route every application to the Compliance queue. Any other combination is queued regardless of this setting.", value: "enabled", updatedAt: "2026-08-16T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "suitability_pass_score", section: "compliance_thresholds", label: "Suitability pass score", description: "Self-service onboarding below this 0–100 score routes to the BD Officer exception queue instead of auto-activating.", value: "40", unit: "/ 100", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "aml_structuring_window", section: "compliance_thresholds", label: "Structuring detection window", description: "Rolling window the AML engine scans for split-deposit (smurfing) patterns near reporting thresholds.", value: "48", unit: "hours", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "aml_review_threshold", section: "compliance_thresholds", label: "Deposit review threshold", description: "Deposits at or above this trigger the structuring rule's near-threshold scan — the seeded alerts reference splits just under it.", value: "10,000", unit: "KES", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "aml_velocity_max_tx", section: "compliance_thresholds", label: "Velocity rule — daily transaction count", description: "Subscriptions per client per day above this raise a velocity alert against the 90-day average.", value: "3", unit: "tx / day", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "kyc_refresh_cadence", section: "compliance_thresholds", label: "KYC / tax refresh cadence", description: "Periodic re-verification of client KYC and tax status, per the BD SOP's ongoing-servicing controls.", value: "24", unit: "months", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "risk_band_low_max", section: "compliance_thresholds", label: "Risk band — Low ceiling", description: "Customer risk scores at or below this rate as Low risk.", value: "30", unit: "/ 100", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "risk_band_medium_max", section: "compliance_thresholds", label: "Risk band — Medium ceiling", description: "Scores above the Low ceiling up to this rate as Medium; anything above is High.", value: "60", unit: "/ 100", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "edd_trigger_rating", section: "compliance_thresholds", label: "EDD trigger rating", description: "Customers at or above this risk rating require Enhanced Due Diligence before activation.", value: "high", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "screening_cadence", section: "compliance_thresholds", label: "Sanctions / PEP screening cadence", description: "Every customer is re-screened this often by the nightly batch, regardless of risk band (Compliance requirement: daily).", value: "Daily", updatedAt: "2026-08-11T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "aml_review_threshold_high_risk", section: "compliance_thresholds", label: "Deposit review threshold — High risk", description: "Tighter near-threshold scan for High-risk customers (base threshold applies to other bands).", value: "5,000", unit: "KES", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "aml_velocity_max_tx_high_risk", section: "compliance_thresholds", label: "Velocity rule — High-risk daily count", description: "Daily transaction count that raises a velocity alert for High-risk customers.", value: "1", unit: "tx / day", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "sar_decision_sla", section: "compliance_thresholds", label: "SAR decision SLA", description: "MLRO must decide file/no-file within this window after escalation.", value: "5", unit: "business days", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "abc_gift_threshold", section: "compliance_thresholds", label: "ABC gift & hospitality threshold", description: "Gifts or hospitality at or above this value are an anti-bribery risk indicator requiring escalation.", value: "20,000", unit: "KES", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "complaint_ack_sla", section: "service_standards", label: "Complaint acknowledgement SLA", description: "Complaints must be acknowledged within this window of receipt.", value: "1", unit: "business day", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Faith Kamau" },
  { key: "complaint_resolution_sla", section: "service_standards", label: "Complaint resolution SLA", description: "Target window to resolve a complaint; breaches escalate to the Head of BD.", value: "10", unit: "business days", updatedAt: "2026-08-09T09:00:00Z", updatedBy: "Faith Kamau" },

  { key: "nav_variance_tolerance", section: "nav_valuation", label: "NAV variance tolerance", description: "Day-over-day NAV movement beyond this triggers the independent nav-variance review before publication. Indicative — confirm with Fund Accounting.", value: "0.50", unit: "%", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "nav_cutoff_time", section: "nav_valuation", label: "NAV computation cut-off", description: "Daily cut-off for bond prices, cash and accruals entering that dealing day's NAV.", value: "16:00", unit: "EAT", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },
  { key: "dealing_cutoff_time", section: "nav_valuation", label: "Dealing cut-off", description: "Subscriptions and redemptions received after this land on the next dealing day.", value: "15:00", unit: "EAT", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Daniel Kiptoo" },

  { key: "enquiry_ack_days", section: "service_standards", label: "Enquiry acknowledgement", description: "Client Services must acknowledge every enquiry within this window (BD SOP core service standard).", value: "1", unit: "business day", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Faith Kamau" },
  { key: "statement_delivery_days", section: "service_standards", label: "Statement delivery", description: "Client statements delivered within this many business days of period-end (BD SOP).", value: "5", unit: "business days", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Faith Kamau" },
  { key: "record_retention_years", section: "service_standards", label: "Record retention", description: "Minimum secure retention for client records — longer where regulation requires (BD SOP).", value: "7", unit: "years", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Peter Otieno" },
  { key: "break_escalation_age", section: "service_standards", label: "Reconciliation break escalation age", description: "Open breaks older than this escalate to the Head of Operations. Indicative placeholder — the Ops SOP mandates age-based escalation without fixing the number.", value: "5", unit: "business days", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Grace Mumbi" },
  { key: "break_materiality", section: "service_standards", label: "Reconciliation materiality threshold", description: "Breaks at or above this escalate immediately regardless of age. Indicative placeholder pending Ops confirmation.", value: "100,000", unit: "KES", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Grace Mumbi" },

  { key: "wire_ref_format_usd", section: "payments", label: "USD wire reference format", description: "Reference pattern investors must quote on USD wires — unmatched formats land in the Unallocated Funds Register. A change to this pattern is pending in Approvals.", value: "BRF-{investorId}", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "Grace Mumbi" },
  { key: "mpesa_stk_environment", section: "payments", label: "M-Pesa STK Push environment", description: "Daraja environment the investor apps' STK collection runs against.", value: "production", updatedAt: "2026-07-18T08:30:00Z", updatedBy: "IT Admin" },
  { key: "mpesa_b2c_environment", section: "payments", label: "M-Pesa B2C environment", description: "Daraja environment for outbound payouts (redemptions, cash distributions).", value: "production", updatedAt: "2026-07-18T08:30:00Z", updatedBy: "IT Admin" },
  { key: "ussd_shortcode", section: "payments", label: "USSD shortcode", description: "The dial string the feature-phone channel answers on. Pending Safaricom allocation — the channel cannot open until this is real.", value: "Not allocated", updatedAt: "2026-08-20T09:00:00Z", updatedBy: "IT Admin" },
  { key: "ussd_session_timeout", section: "payments", label: "USSD session timeout", description: "Idle seconds before a USSD session drops. Shorter than a web session by an order of magnitude — the carrier closes it regardless, so this is what the app must plan for.", value: "90", unit: "seconds", updatedAt: "2026-08-20T09:00:00Z", updatedBy: "IT Admin" },
  { key: "settlement_retry_limit", section: "payments", label: "Settlement retry limit", description: "Failed settlement callbacks retried this many times before flagging manual review in Payment Ops.", value: "3", unit: "attempts", updatedAt: "2026-07-18T08:30:00Z", updatedBy: "IT Admin" },

  { key: "bo_session_timeout", section: "security_policy", label: "BO session timeout", description: "Idle minutes before a back-office session requires re-authentication.", value: "30", unit: "minutes", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "IT Admin" },
  { key: "access_recert_cadence", section: "security_policy", label: "Access recertification cadence", description: "How often every role's page access is recertified against the permission matrix.", value: "Quarterly", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "IT Admin" },
  { key: "investor_pin_length", section: "security_policy", label: "Investor PIN length", description: "PIN digits required by the investor web and mobile apps.", value: "6", unit: "digits", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "IT Admin" },
  { key: "pin_lockout_attempts", section: "security_policy", label: "PIN lockout threshold", description: "Failed PIN attempts before the investor account locks pending re-verification.", value: "5", unit: "attempts", updatedAt: "2026-06-02T09:00:00Z", updatedBy: "IT Admin" },
];

export type FlagPlatform = "investor_web" | "investor_mobile" | "investor_ussd" | "ifa_portal" | "trustee_portal" | "payment_ops" | "bo_admin";

export const FLAG_PLATFORM_LABELS: Record<FlagPlatform, { title: string; note?: string }> = {
  investor_web: { title: "Investor Web / PWA" },
  investor_mobile: { title: "Investor Mobile", note: "Native app in build — flags are pre-staged so launch is a config change, not a deploy." },
  investor_ussd: { title: "Investor USSD", note: "Feature-phone channel (proposal §4.2, Phase 1b). Not built — flags are staged so the shortcode can be opened without a deploy once Safaricom allocates it." },
  ifa_portal: { title: "IFA Portal" },
  trustee_portal: { title: "Trustee Portal" },
  payment_ops: { title: "Payment Ops Portal" },
  bo_admin: { title: "BO Admin Panel" },
};

export type FeatureFlag = {
  key: string;
  platform: FlagPlatform;
  label: string;
  description: string;
  enabled: boolean;
  stage: "ga" | "beta" | "planned";
  updatedAt: string;
  updatedBy: string;
};

export type ReportCategory = "regulatory" | "finance" | "operations" | "compliance" | "distributions" | "processes" | "audit_mis" | "miscellaneous";

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  regulatory: "Regulatory",
  finance: "Finance",
  operations: "Operations",
  compliance: "Compliance",
  distributions: "Distributions",
  processes: "Processes",
  audit_mis: "Audit MIS",
  miscellaneous: "Miscellaneous",
};

export type ReportColumn = { key: string; label: string; description?: string };

export type ReportDef = {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "on_demand";
  format: "PDF" | "XLSX" | "CSV";
  /** Roles allowed to see/run this report — the Reports page filters by the signed-in role. */
  restrictedTo: AdminRole[];
  /** Every column the report can emit — users pick a subset at generation. */
  columns: ReportColumn[];
  lastRun?: { at: string; by: string; sizeKb: number; columnCount?: number };
  generating?: boolean;
};

/** Who may act as checker for each approval kind, banded by amount. A rule
 * with maxAmount null is the unbounded band. The Approvals page enforces
 * this: a role outside approverRoles can see the item but not decide it.
 * Seed values are indicative — real DoA limits are Open Question 8. */
export type ApprovalPolicyRule = {
  id: string;
  kind: ApprovalKind;
  label: string;
  currency?: "KES" | "USD";
  /** Upper bound of this band (inclusive); null = no upper bound. */
  maxAmount: number | null;
  approverRoles: AdminRole[];
  pendingApprovalId?: string;
  pendingSummary?: string;
};

export const APPROVAL_POLICIES: ApprovalPolicyRule[] = [
  { id: "pol_pay_kes_s", kind: "payment_release", label: "Payment release — KES up to 100,000", currency: "KES", maxAmount: 100_000, approverRoles: ["operations", "head_of_finance"] },
  { id: "pol_pay_kes_l", kind: "payment_release", label: "Payment release — KES above 100,000", currency: "KES", maxAmount: null, approverRoles: ["head_of_finance"] },
  { id: "pol_pay_usd", kind: "payment_release", label: "Payment release — USD (any amount)", currency: "USD", maxAmount: null, approverRoles: ["head_of_finance"] },
  { id: "pol_nav", kind: "nav_publication", label: "NAV publication", maxAmount: null, approverRoles: ["head_of_finance", "investment_committee"] },
  { id: "pol_static", kind: "static_data_change", label: "Static data / configuration change", maxAmount: null, approverRoles: ["operations", "compliance", "head_of_finance", "system_admin"] },
  { id: "pol_dist", kind: "distribution_batch", label: "Distribution batch", maxAmount: null, approverRoles: ["head_of_finance"] },
  { id: "pol_gate", kind: "liquidity_gate_extension", label: "Liquidity gate extension", maxAmount: null, approverRoles: ["head_of_finance", "investment_committee"] },
  { id: "pol_kyc", kind: "kyc_exception", label: "KYC / suitability exception", maxAmount: null, approverRoles: ["compliance"] },
  { id: "pol_activation", kind: "account_activation", label: "Account / wallet activation", maxAmount: null, approverRoles: ["compliance", "mlro"] },
  { id: "pol_closure", kind: "account_closure", label: "Customer-initiated account closure", maxAmount: null, approverRoles: ["compliance", "mlro"] },
  { id: "pol_edd", kind: "edd_signoff", label: "EDD sign-off", maxAmount: null, approverRoles: ["compliance", "mlro"] },
  { id: "pol_str", kind: "str_filing", label: "STR filing", maxAmount: null, approverRoles: ["mlro"] },
  { id: "pol_case_close", kind: "case_closure", label: "Compliance case closure", maxAmount: null, approverRoles: ["compliance", "mlro"] },
];

export type JurisdictionStatus = "open" | "planned" | "under_review" | "excluded";

export const JURISDICTION_STATUS_LABELS: Record<JurisdictionStatus, string> = {
  open: "Open",
  planned: "Planned",
  under_review: "Under review",
  excluded: "Excluded",
};

/** Concept note §6.3 — investor-segment priority for tokenized (Phase 2)
 * subscriptions. When the whitelist smart contract ships, this matrix IS its
 * policy, so it lives under BO governance from day one. */
export type Jurisdiction = {
  id: string;
  segment: string;
  priority: "highest" | "high" | "medium_high" | "medium" | "low" | "excluded";
  rationale: string;
  timing: string;
  status: JurisdictionStatus;
  kycTier: "standard" | "enhanced";
  pendingApprovalId?: string;
  pendingSummary?: string;
};

export const JURISDICTIONS: Jurisdiction[] = [
  { id: "jur_ke", segment: "Kenya (domestic)", priority: "highest", rationale: "Home market — live from Phase 1 via the traditional register.", timing: "Live (Phase 1)", status: "open", kycTier: "standard" },
  { id: "jur_diaspora", segment: "Kenyan Diaspora (global)", priority: "highest", rationale: "CBK and CMA actively support diaspora products; USD fund removes the FX barrier.", timing: "Phase 2 launch", status: "planned", kycTier: "standard" },
  { id: "jur_eac", segment: "East Africa Regional", priority: "high", rationale: "EAC capital-market harmonization; technically trivial with tokenization.", timing: "6–12 months post-Phase 2", status: "planned", kycTier: "standard" },
  { id: "jur_gulf", segment: "Gulf / UAE", priority: "medium_high", rationale: "Growing appetite for African sovereign debt; ADGM/DIFC pathway available.", timing: "12–18 months post-Phase 2", status: "under_review", kycTier: "enhanced" },
  { id: "jur_africa", segment: "Rest of Africa", priority: "medium", rationale: "Jurisdiction-by-jurisdiction securities-law review required.", timing: "18–24 months post-Phase 2", status: "under_review", kycTier: "enhanced" },
  { id: "jur_eu_uk", segment: "EU / UK", priority: "low", rationale: "AIFMD and MiFID II compliance complex and costly.", timing: "Long-term only", status: "excluded", kycTier: "enhanced" },
  { id: "jur_us", segment: "United States", priority: "excluded", rationale: "SEC jurisdiction; Reg S / Reg D structuring required — separate structure needed.", timing: "Not planned", status: "excluded", kycTier: "enhanced" },
];

export type AuditCategory = "config" | "security" | "approval" | "data" | "report" | "compliance";

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  config: "Configuration",
  security: "Security",
  approval: "Approval",
  data: "Data",
  report: "Report",
  compliance: "Compliance",
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  category: AuditCategory;
  action: string;
  target: string;
  detail?: string;
  /** Entity linkage — lets the trail be filtered to one client/case/wallet. */
  entityType?: "client" | "case" | "alert" | "complaint" | "screening" | "wallet";
  entityId?: string;
  /** Tamper-evident chain: hash of (prevHash + event fields). Demo-grade —
   * a real backend would use an HMAC over an append-only store. */
  hash: string;
  prevHash: string;
};

let auditCounter = 100;

function chainHash(prev: string, e: { id: string; at: string; actor: string; action: string; target: string; entityType?: string; entityId?: string }): string {
  const s = `${prev}|${e.id}|${e.at}|${e.actor}|${e.action}|${e.target}|${e.entityType ?? ""}|${e.entityId ?? ""}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

const AUDIT_SEEDS: Omit<AuditEvent, "hash" | "prevHash">[] = [
  { id: "au_99", at: "2026-08-08T16:12:00Z", actor: "System (NAV Engine)", actorRole: "System", category: "report", action: "Generated", target: "Daily NAV pack", detail: "2026-08-08 dealing day, no variance flags." },
  { id: "au_98", at: "2026-08-08T08:05:00Z", actor: "Grace Mumbi", actorRole: "Operations", category: "approval", action: "Proposed", target: "Payment release — subscription refund KES 50,000", detail: "Duplicate Daraja STK callback reversal for inv_2891." },
  { id: "au_97", at: "2026-08-07T13:20:00Z", actor: "Samuel Kariuki", actorRole: "Payment Ops", category: "approval", action: "Proposed", target: "Payment release — RDM-2308-USD" },
  { id: "au_96", at: "2026-08-06T11:00:00Z", actor: "System (AML Engine)", actorRole: "System", category: "data", action: "Raised alert", target: "Structuring pattern — Brian Otieno", detail: "4 deposits just under the KES 10,000 review threshold within 48h." },
  { id: "au_95", at: "2026-08-06T09:14:00Z", actor: "System (Suitability Engine)", actorRole: "System", category: "approval", action: "Proposed", target: "Suitability exception — inv_3350", detail: "Scored 38/100, below the configured pass score of 40." },
  { id: "au_94", at: "2026-08-05T09:02:00Z", actor: "IT Admin", actorRole: "System Admin", category: "config", action: "Pre-staged flags", target: "Investor Mobile — biometric login, push notifications, in-app STK", detail: "Launch becomes a config change, not a deploy." },
  { id: "au_93", at: "2026-08-04T10:12:00Z", actor: "Grace Mumbi", actorRole: "Operations", category: "config", action: "Proposed change", target: "USD wire reference format", detail: "BRF-{investorId} → BRF-USD-{investorId}-{ddmmyy} to cut unmatched receipts." },
  { id: "au_92", at: "2026-08-02T14:01:00Z", actor: "IT Admin", actorRole: "System Admin", category: "config", action: "Flag disabled", target: "Payment Ops — auto-retry failed settlements", detail: "Held in beta pending Daraja sandbox soak test." },
  { id: "au_91", at: "2026-08-01T10:00:00Z", actor: "IT Admin", actorRole: "System Admin", category: "security", action: "Completed", target: "Quarterly access recertification", detail: "All six roles recertified against the page-access matrix." },
  { id: "au_90", at: "2026-07-31T17:55:00Z", actor: "Daniel Kiptoo", actorRole: "Head of Finance", category: "approval", action: "Approved", target: "July 2026 distribution batch", detail: "KES 6.76M + USD 11.3k across both sub-funds, WHT at 15%." },
  { id: "au_89", at: "2026-07-18T08:30:00Z", actor: "IT Admin", actorRole: "System Admin", category: "config", action: "Flag enabled", target: "Investor Web — USD Eurobond subscriptions" },
  { id: "au_88", at: "2026-07-05T10:04:00Z", actor: "Daniel Kiptoo", actorRole: "Head of Finance", category: "report", action: "Generated", target: "CMA quarterly CIS return", detail: "Q2 2026 filing package." },
];

/** Seeds chained oldest→newest at module load — never hand-write hashes. */
export const AUDIT_EVENTS: AuditEvent[] = (() => {
  const chained: AuditEvent[] = [];
  let prev = "genesis";
  for (let i = AUDIT_SEEDS.length - 1; i >= 0; i--) {
    const hash = chainHash(prev, AUDIT_SEEDS[i]);
    chained.unshift({ ...AUDIT_SEEDS[i], hash, prevHash: prev });
    prev = hash;
  }
  return chained;
})();

export function logAudit(event: Omit<AuditEvent, "id" | "at" | "hash" | "prevHash">): AuditEvent {
  const prevHash = AUDIT_EVENTS[0]?.hash ?? "genesis";
  const base = { id: `au_${auditCounter++}`, at: new Date().toISOString(), ...event };
  const entry: AuditEvent = { ...base, prevHash, hash: chainHash(prevHash, base) };
  AUDIT_EVENTS.unshift(entry);
  return entry;
}

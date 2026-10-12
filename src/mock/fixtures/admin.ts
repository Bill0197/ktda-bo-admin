import type { EmploymentType, Gender } from "./reference";

/** `client_services` and `head_of_bd` exist because the BD SOP names them as
 * separate functions and this app used to collapse both into `bd_officer`
 * ("BD Officer / RM"). Client Services handles first-line enquiries and holds
 * customer contact — and must NOT reach cases, screening or AML alerts, which
 * is the tipping-off boundary. Head of BD owns institutional opportunities,
 * RFPs, commercial exceptions and the IFA channel. */
export type AdminRole = "ceo" | "bd_officer" | "client_services" | "head_of_bd" | "compliance" | "mlro" | "compliance_analyst" | "operations" | "head_of_finance" | "investment_manager" | "investment_committee" | "system_admin";

export const ROLE_LABELS: Record<AdminRole, string> = {
  ceo: "Chief Executive Officer",
  bd_officer: "BD Officer / RM",
  client_services: "Client Services",
  head_of_bd: "Head of Business Development",
  compliance: "Institutional Funds Compliance Manager",
  mlro: "MLRO",
  compliance_analyst: "Compliance Analyst",
  operations: "Operations",
  head_of_finance: "Head of Finance",
  investment_manager: "Investment Manager",
  investment_committee: "Investment Committee",
  system_admin: "System Admin",
};

/** Page-level RBAC — mirrors the "BO Admin Panel roles" table in the
 * architecture artifact. A route not listed for a role is not just
 * hidden from nav, ProtectedRoute below refuses it outright. */
export const ROLE_PAGE_ACCESS: Record<AdminRole, string[]> = {
  bd_officer: ["/", "/clients", "/leads", "/enquiries", "/tasks", "/coverage", "/campaigns", "/pipeline", "/bd-performance", "/suitability", "/reports"],
  // Client Services reaches the customer-facing desk and nothing behind it:
  // no cases, no screening, no AML alerts, no pipeline. The redaction on
  // compliance-flagged interactions is the second half of that boundary —
  // route access alone would not stop a case reason reaching a call script.
  client_services: ["/", "/clients", "/enquiries", "/tasks", "/complaints", "/leads"],
  head_of_bd: ["/", "/clients", "/leads", "/enquiries", "/tasks", "/coverage", "/campaigns", "/pipeline", "/bd-performance", "/suitability", "/complaints", "/reports"],
  // Institutional Investment Compliance belongs to this seat, not the analyst's.
  // The holder is the Institutional Funds Compliance Manager, and a mandate
  // breach carries a cure decision and a client-notification obligation —
  // manager work, not monitoring work.
  compliance: ["/", "/clients", "/kyc-queue", "/kyc-periodic", "/kyc-dynamic", "/suitability", "/aml-alerts", "/cases", "/fraud-alerts", "/fraud-cases", "/screening", "/complaints", "/approvals", "/reports", "/audit-log", "/settings", "/institutional-compliance/breaches", "/institutional-compliance/restrictions", "/institutional-compliance/counterparties", "/institutional-compliance/clients"],
  // MLRO: everything Compliance has. Analyst: the same surface minus the
  // Approvals queue — analysts investigate, they don't act as checkers.
  mlro: ["/", "/clients", "/kyc-queue", "/kyc-periodic", "/kyc-dynamic", "/suitability", "/aml-alerts", "/cases", "/fraud-alerts", "/fraud-cases", "/screening", "/complaints", "/approvals", "/reports", "/audit-log", "/settings"],
  // Tokenization Compliance and Market Conduct are the analyst's two newer
  // surfaces — monitoring work, whose filing and sign-off decisions still route
  // through Approvals. Institutional Investment Compliance is deliberately NOT
  // here; it sits with the Institutional Funds Compliance Manager above.
  compliance_analyst: ["/", "/clients", "/kyc-queue", "/kyc-periodic", "/kyc-dynamic", "/suitability", "/aml-alerts", "/cases", "/fraud-alerts", "/fraud-cases", "/screening", "/complaints", "/reports", "/audit-log", "/settings", "/tokenization/issuance", "/tokenization/lifecycle", "/tokenization/smart-contracts", "/market-conduct/market-abuse", "/market-conduct/conflicts", "/market-conduct/employee-trading"],
  // The CEO reads across every function and writes to none of the platform's
  // configuration — oversight, not administration. Deliberately excludes
  // Users & roles, Feature flags, Platform settings and System: an executive
  // who can silently change an approval route is a control weakness, not a
  // convenience.
  ceo: ["/", "/clients", "/complaints", "/pipeline", "/bd-performance", "/nav", "/distributions", "/liquidity", "/ledger", "/bond-ladder", "/approvals", "/reports", "/audit-log"],
  operations: ["/", "/clients", "/transactions", "/reconciliation", "/unallocated-funds", "/ledger", "/complaints", "/approvals", "/reports"],
  head_of_finance: ["/", "/nav", "/distributions", "/approvals", "/liquidity", "/ledger", "/catalogue", "/reports", "/settings"],
  // Investment Manager runs the mandate day to day: products, orders, the book,
  // valuations and the institutional side. It does NOT hold /approvals — the
  // manager proposes into the IC queue, the Committee decides. Same
  // maker-checker split the payment side already has.
  investment_manager: ["/", "/investment/products", "/investment/orders", "/investment/portfolio", "/investment/holdings", "/investment/valuations", "/investment/redemptions", "/investment/corporate-actions", "/investment/ic-approvals", "/investment/mandates", "/institutional/clients", "/institutional/mandates", "/institutional/portfolios", "/institutional/fees", "/institutional/reporting", "/bond-ladder", "/catalogue", "/reports"],
  investment_committee: ["/", "/bond-ladder", "/approvals", "/liquidity", "/catalogue", "/reports", "/investment/ic-approvals", "/investment/mandates"],
  // System Admin reaches every page. The SAR restriction it used to carry lives
  // where it actually holds: `canSeeCase` filters restricted cases seam-side by
  // role, so opening the Cases page to System Admin shows the register without
  // suspicious-activity matters — the control is on the data, not the route.
  system_admin: ["/", "/clients", "/leads", "/suitability", "/complaints", "/kyc-queue", "/kyc-periodic", "/kyc-dynamic", "/aml-alerts", "/cases", "/fraud-alerts", "/fraud-cases", "/screening", "/approvals", "/transactions", "/reconciliation", "/unallocated-funds", "/enquiries", "/tasks", "/coverage", "/campaigns", "/pipeline", "/bd-performance", "/nav", "/distributions", "/liquidity", "/bond-ladder", "/ledger", "/catalogue", "/reports", "/settings", "/feature-flags", "/users", "/system", "/audit-log", "/tokenization/issuance", "/tokenization/lifecycle", "/tokenization/smart-contracts", "/token-console/overview", "/token-console/investors", "/token-console/accounts", "/token-console/offerings", "/token-console/products", "/token-console/journals", "/token-console/trial-balance", "/token-console/unit-ledger", "/token-console/reconciliation", "/token-console/runs", "/token-console/policies", "/token-console/compliance", "/token-console/funds", "/token-console/tariffs", "/token-console/configuration", "/token-console/changes", "/token-console/loans", "/token-console/kyc", "/token-console/customers", "/token-console/transactions", "/token-console/users", "/token-console/nav", "/token-console/assets", "/market-conduct/market-abuse", "/market-conduct/conflicts", "/market-conduct/employee-trading", "/institutional-compliance/breaches", "/institutional-compliance/restrictions", "/institutional-compliance/counterparties", "/institutional-compliance/clients", "/investment/products", "/investment/orders", "/investment/portfolio", "/investment/holdings", "/investment/valuations", "/investment/redemptions", "/investment/corporate-actions", "/investment/ic-approvals", "/investment/mandates", "/institutional/clients", "/institutional/mandates", "/institutional/portfolios", "/institutional/fees", "/institutional/reporting"],
};

export const ADMIN_USERS: Record<AdminRole, { name: string; initials: string; email: string }> = {
  ceo: { name: "Charles Mburu", initials: "CM", email: "charles.mburu@investcent.co.ke" },
  bd_officer: { name: "Faith Kamau", initials: "FK", email: "faith.kamau@investcent.co.ke" },
  client_services: { name: "Mercy Wanjala", initials: "MW", email: "mercy.wanjala@investcent.co.ke" },
  head_of_bd: { name: "Anthony Mwenda", initials: "AM", email: "anthony.mwenda@investcent.co.ke" },
  compliance: { name: "Kevin Baraka", initials: "KB", email: "kevin.baraka@investcent.co.ke" },
  mlro: { name: "Josephine Muthoni", initials: "JM", email: "josephine.muthoni@investcent.co.ke" },
  compliance_analyst: { name: "Peter Otieno", initials: "PO", email: "peter.otieno@investcent.co.ke" },
  operations: { name: "Grace Mumbi", initials: "GM", email: "grace.mumbi@investcent.co.ke" },
  head_of_finance: { name: "Daniel Kiptoo", initials: "DK", email: "daniel.kiptoo@investcent.co.ke" },
  investment_manager: { name: "Ruth Nyambura", initials: "RN", email: "ruth.nyambura@investcent.co.ke" },
  investment_committee: { name: "Susan Achieng", initials: "SA", email: "susan.achieng@investcent.co.ke" },
  system_admin: { name: "IT Admin", initials: "IT", email: "admin@investcent.co.ke" },
};

export type ApprovalKind =
  | "payment_release" | "nav_publication" | "static_data_change" | "distribution_batch"
  | "liquidity_gate_extension" | "kyc_exception"
  | "account_activation" | "account_closure" | "edd_signoff" | "str_filing" | "case_closure";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  amount?: number;
  currency?: "KES" | "USD";
  proposedBy: string;
  proposedAt: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  /** Deep-link to the record this approval governs (client, case, wallet…). */
  entityRef?: { entityType: string; entityId: string };
};

export const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  payment_release: "Payment release",
  nav_publication: "NAV publication",
  static_data_change: "Static data change",
  distribution_batch: "Distribution batch",
  liquidity_gate_extension: "Liquidity gate extension",
  kyc_exception: "KYC / suitability exception",
  account_activation: "Account activation",
  account_closure: "Account closure",
  edd_signoff: "EDD sign-off",
  str_filing: "STR filing",
  case_closure: "Case closure",
};

export const APPROVAL_QUEUE: ApprovalItem[] = [
  { id: "ap_onb_inv_3402", kind: "account_activation", title: "Review & activate — Kevin Mwangi", detail: "Self-service onboarding. Risk MEDIUM. Queued because: medium risk rating. Verify documents and screening before approving.", proposedBy: "System", proposedAt: "2026-08-16T07:12:00Z", status: "pending", entityRef: { entityType: "client", entityId: "inv_3402" } },
  { id: "ap_cls_inv_2601", kind: "account_closure", title: "Account closure request — Esther Chebet", detail: "Customer-initiated closure (CLS-40318827). Reason given: \"Moving my savings to a bank product.\" Run exit screening, review open monitoring alerts and investigations, settle remaining holdings and confirm the payout destination before disabling access (Customer Exit \u00a77, \u00a710, \u00a712).", proposedBy: "Esther Chebet", proposedAt: "2026-08-16T06:40:00Z", status: "pending", entityRef: { entityType: "client", entityId: "inv_2601" } },
  { id: "ap_1", kind: "nav_publication", title: "Publish NAV — KES Fixed Income Fund, 2026-08-06", detail: "NAV derived as 12.4857 from AUM 878,744,000 ÷ 70,380,000 units — bond ladder 858,100,000 mark to market, cash 12,400,000, accrued coupon income 9,850,000, less 1,606,000 accrued fees and facility interest. +0.0160% vs the published 12.4837. All 6 bond prices sourced from custodian statement, no variance flags.", proposedBy: "System (NAV Engine)", proposedAt: "2026-08-06T16:02:00Z", status: "pending" },
  { id: "ap_2", kind: "payment_release", title: "Redemption payout — RDM-2201-KES", detail: "KES 20,000 redemption for investor inv_2891, tier: 2-day settlement, no gate triggered (AUM utilisation 2.18%).", amount: 20_000, currency: "KES", proposedBy: "Grace Mumbi (Operations)", proposedAt: "2026-08-05T15:00:00Z", status: "pending" },
  { id: "ap_3", kind: "distribution_batch", title: "July 2026 distribution batch — both sub-funds", detail: "KES 4.82M to reinvest, KES 1.94M to pay out; USD 8,200 to reinvest, USD 3,100 to pay out. Withholding tax applied at 15%.", proposedBy: "System (Distribution Engine)", proposedAt: "2026-07-31T17:30:00Z", status: "approved", decidedBy: "Daniel Kiptoo", decidedAt: "2026-07-31T17:55:00Z" },
  { id: "ap_4", kind: "static_data_change", title: "Update bank transfer reference format", detail: "Change USD wire reference pattern from BRF-{investorId} to BRF-USD-{investorId}-{ddmmyy} to reduce unmatched receipts.", proposedBy: "Grace Mumbi (Operations)", proposedAt: "2026-08-04T10:12:00Z", status: "pending" },
  { id: "ap_5", kind: "kyc_exception", title: "Suitability exception — investor inv_3350", detail: "Self-service onboarding scored 38/100 (below the 40 threshold for the KES Fixed Income packaged product). Flagged for BD Officer discovery call before activation, per suitability SOP.", proposedBy: "System (Suitability Engine)", proposedAt: "2026-08-06T09:14:00Z", status: "pending" },
  { id: "ap_6", kind: "liquidity_gate_extension", title: "No active gate — informational", detail: "AUM utilisation for KES Fixed Income Fund at 2.18% of the 10% gate threshold. No action required.", proposedBy: "System", proposedAt: "2026-08-06T00:00:00Z", status: "approved", decidedBy: "—", decidedAt: "2026-08-06T00:00:00Z" },
  { id: "ap_7", kind: "payment_release", title: "Redemption payout — RDM-2308-USD", detail: "USD 500 redemption for investor inv_2601, USD Eurobond Fund, tier: 7-day settlement, bank wire payout.", amount: 500, currency: "USD", proposedBy: "Samuel Kariuki (Payment Ops)", proposedAt: "2026-08-07T13:20:00Z", status: "pending" },
  { id: "ap_8", kind: "payment_release", title: "Subscription refund — duplicate STK Push", detail: "Investor inv_2891 was charged twice by a duplicated Daraja callback for the same subscription — KES 50,000 refund pending reversal approval.", amount: 50_000, currency: "KES", proposedBy: "Grace Mumbi (Operations)", proposedAt: "2026-08-08T08:05:00Z", status: "pending" },
];

export type ClientRow = {
  id: string;
  name: string;
  /** Optional — many Kenyan IDs carry three names, some carry two. */
  middleName?: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | null;
  /** Town or city of residence, from the controlled `CITIES` list. */
  city: string | null;
  nationality: string;
  /** National ID or passport number, captured alongside the KRA PIN. */
  idNumber: string | null;
  /* --- Profile questions, answered after the account is created. Null until
     the customer completes the post-signup profile step, which is why every
     one of them is nullable rather than defaulted. --- */
  employmentType: EmploymentType | null;
  industry: string | null;
  /** Monthly income band — a key from `INCOME_RANGES`, not a free figure. */
  incomeRange: string | null;
  kycStatus: string;
  /** Legacy — the suitability questionnaire was retired from the investor
   * apps, so this is null for anyone who onboarded after that. Retained so the
   * scores already on file stay visible to Compliance. */
  suitabilityScore: number | null;
  aum: number;
  currency: "KES" | "USD";
  channel: string;
  /** Onboarding date — when the application was submitted. */
  joinedAt: string;
};

export const CLIENTS: ClientRow[] = [
  { id: "inv_2891", name: "Amina Wanjiru", middleName: "Njoki", email: "amina.wanjiru@example.com", phone: "+254 712 334 455", dateOfBirth: "1991-06-23", gender: "female", city: "Nairobi", nationality: "Kenyan", idNumber: "31245678", employmentType: "employed", industry: "Retail & wholesale trade", incomeRange: "150k_300k", kycStatus: "verified", suitabilityScore: 72, aum: 474_000, currency: "KES", channel: "Self-service", joinedAt: "2026-03-14" },
  { id: "inv_3350", name: "Brian Otieno", email: "brian.otieno@example.com", phone: "+254 733 221 100", dateOfBirth: "1998-11-04", gender: "male", city: "Nairobi", nationality: "Kenyan", idNumber: "34112907", employmentType: "self_employed", industry: "Retail & wholesale trade", incomeRange: "50k_150k", kycStatus: "suitability_exception", suitabilityScore: 38, aum: 0, currency: "KES", channel: "Self-service", joinedAt: "2026-08-06" },
  { id: "inv_3122", name: "Cynthia Njeri", middleName: "Wangui", email: "cynthia.njeri@example.com", phone: "+254 722 908 771", dateOfBirth: "1979-02-15", gender: "female", city: "Nakuru", nationality: "Kenyan", idNumber: "22884401", employmentType: "self_employed", industry: "Transport & logistics", incomeRange: "over_1m", kycStatus: "verified", suitabilityScore: 81, aum: 1_240_000, currency: "KES", channel: "IFA referral", joinedAt: "2026-05-02" },
  { id: "inv_2765", name: "David Mwangi", email: "david.mwangi@example.com", phone: "+254 701 445 902", dateOfBirth: "1995-09-30", gender: "male", city: "Nairobi", nationality: "Kenyan", idNumber: "29903115", employmentType: "employed", industry: "ICT & technology", incomeRange: "300k_1m", kycStatus: "pending_review", suitabilityScore: null, aum: 0, currency: "KES", channel: "Self-service", joinedAt: "2026-08-05" },
  { id: "inv_2601", name: "Esther Chebet", email: "esther.chebet@example.com", phone: "+254 728 660 143", dateOfBirth: "1984-12-08", gender: "female", city: "Other", nationality: "Kenyan", idNumber: "A1129045", employmentType: "employed", industry: "Healthcare", incomeRange: "300k_1m", kycStatus: "verified", suitabilityScore: 66, aum: 8_400, currency: "USD", channel: "BD officer", joinedAt: "2026-02-11" },
];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  stage: "new" | "contacted" | "discovery_scheduled" | "converted" | "lost";
  suitabilityScore: number | null;
  /** Suitability-review context (Compliance review additions). */
  geography: string;
  product: string;
  deliveryChannel: "Mobile app" | "Web" | "Branch" | "IFA";
  customerRisk: "low" | "medium" | "high" | null;
  createdAt: string;
};

export const LEADS: Lead[] = [
  { id: "ld_1", name: "Brian Otieno", phone: "+254733221100", source: "Self-service signup", stage: "discovery_scheduled", suitabilityScore: 38, geography: "Nairobi, KE", product: "KES Fixed Income", deliveryChannel: "Mobile app", customerRisk: "high", createdAt: "2026-08-06T09:14:00Z" },
  { id: "ld_2", name: "Felix Ndungu", phone: "+254711220099", source: "Website form", stage: "new", suitabilityScore: null, geography: "Mombasa, KE", product: "KES Fixed Income", deliveryChannel: "Web", customerRisk: null, createdAt: "2026-08-06T08:02:00Z" },
  { id: "ld_3", name: "Grace Wairimu", phone: "+254722334455", source: "Referral — Kevin Mutuku (IFA)", stage: "contacted", suitabilityScore: null, geography: "Nakuru, KE", product: "USD Eurobond", deliveryChannel: "IFA", customerRisk: null, createdAt: "2026-08-05T14:20:00Z" },
  { id: "ld_4", name: "Hassan Ali", phone: "+254700112233", source: "Branch walk-in", stage: "converted", suitabilityScore: 74, geography: "Nairobi, KE", product: "KES Fixed Income", deliveryChannel: "Branch", customerRisk: "low", createdAt: "2026-08-01T11:00:00Z" },
];

export type AmlAlert = {
  id: string;
  clientId?: string;
  clientName: string;
  rule: string;
  detail: string;
  severity: "low" | "medium" | "high";
  status: "open" | "under_review" | "cleared" | "escalated";
  assignee?: string;
  caseId?: string;
  raisedAt: string;
  /** Which board the alert belongs to. Same record shape, same workflow, two
   * queues: money-laundering typologies are reviewed by Compliance, fraud
   * indicators (account takeover, third-party payment, replayed callbacks) by
   * the fraud desk. Absent means `aml` — every alert that predates the fraud
   * board is one. */
  kind?: "aml" | "fraud";
};

export const AML_ALERTS: AmlAlert[] = [
  { id: "aml_att_1", clientId: "inv_3122", clientName: "Cynthia Njeri", rule: "Blocked transaction attempts", detail: "3 blocked transaction attempt events within an hour on investor-mobile.", severity: "medium", status: "open", raisedAt: "2026-08-16T05:55:00Z" },
  { id: "aml_1", clientId: "inv_3350", clientName: "Brian Otieno", rule: "Structuring pattern", detail: "4 deposits of KES 9,800–9,950 within 48 hours, just under the KES 10,000 reporting-review threshold.", severity: "high", status: "under_review", assignee: "Peter Otieno", caseId: "cs_1", raisedAt: "2026-08-06T11:00:00Z" },
  { id: "aml_2", clientId: "inv_2601", clientName: "Esther Chebet", rule: "Velocity check", detail: "3 subscriptions in one day across both sub-funds, higher than the client's 90-day average.", severity: "low", status: "cleared", raisedAt: "2026-08-03T09:40:00Z" },
  { id: "aml_3", clientId: "inv_3122", clientName: "Cynthia Njeri", rule: "Geo-mismatch", detail: "Login from a new device/location shortly before a large redemption request.", severity: "medium", status: "open", raisedAt: "2026-08-05T20:15:00Z" },
];

/** Fraud-desk alerts. Same shape and workflow as the AML board — raised by the
 * rules engine, triaged, then escalated into a case — but the indicators are
 * fraud rather than laundering typologies. */
export const FRAUD_ALERTS: AmlAlert[] = [
  { id: "fr_1", kind: "fraud", clientId: "inv_3122", clientName: "Cynthia Njeri", rule: "Payout name mismatch", detail: "Redemption payout account registered to 'C. NJERI ENTERPRISES', not the client's own name — third-party payment indicator (TM-005).", severity: "high", status: "open", raisedAt: "2026-08-17T08:20:00Z" },
  { id: "fr_2", kind: "fraud", clientId: "inv_3350", clientName: "Brian Otieno", rule: "Device change before withdrawal", detail: "New device and SIM registered 14 minutes before a full redemption request — account-takeover pattern.", severity: "high", status: "under_review", assignee: "Kevin Baraka", raisedAt: "2026-08-16T19:05:00Z" },
  { id: "fr_3", kind: "fraud", clientId: "inv_2601", clientName: "Esther Chebet", rule: "Shared payout destination", detail: "The M-Pesa number on this payout is already the default destination on two other client files — possible mule account.", severity: "medium", status: "open", raisedAt: "2026-08-14T13:40:00Z" },
  { id: "fr_4", kind: "fraud", clientId: "inv_2765", clientName: "David Mwangi", rule: "Failed-OTP burst", detail: "6 failed OTP attempts in 4 minutes, then a successful login from an unrecognised device.", severity: "medium", status: "open", raisedAt: "2026-08-12T07:15:00Z" },
  { id: "fr_5", kind: "fraud", clientId: "inv_2891", clientName: "Amina Wanjiru", rule: "Duplicate settlement callback", detail: "Daraja delivered the same STK confirmation twice for reference QGH4K2P1M9 — the investor was charged for one subscription and billed twice.", severity: "medium", status: "under_review", assignee: "Peter Otieno", caseId: "cs_2", raisedAt: "2026-08-08T08:20:00Z" },
  { id: "fr_6", kind: "fraud", clientId: "inv_2891", clientName: "Amina Wanjiru", rule: "Bank wire recall attempt", detail: "Remitting bank requested recall of a USD subscription five days after settlement — units already issued.", severity: "high", status: "open", raisedAt: "2026-08-15T10:30:00Z" },
];

export type ReconciliationBreak = {
  id: string;
  type: "cash" | "unit_holding" | "nav" | "custodian_statement";
  description: string;
  variance: number;
  currency: "KES" | "USD";
  status: "open" | "resolved";
  detectedAt: string;
};

export const RECONCILIATION_BREAKS: ReconciliationBreak[] = [
  { id: "rc_1", type: "custodian_statement", description: "Coupon receipt for IFB1/2023/6.5Yr posted a day early vs. custodian statement", variance: 0, currency: "KES", status: "resolved", detectedAt: "2026-08-05T07:00:00Z" },
  { id: "rc_2", type: "cash", description: "M-Pesa settlement batch total is KES 1,240 short of Daraja's confirmation report", variance: -1240, currency: "KES", status: "open", detectedAt: "2026-08-06T06:30:00Z" },
];

export type UnallocatedFund = {
  id: string;
  reference: string;
  amount: number;
  currency: "KES" | "USD";
  receivedAt: string;
  reason: string;
  status: "unmatched" | "matched" | "returned";
};

export const UNALLOCATED_FUNDS: UnallocatedFund[] = [
  { id: "uf_1", reference: "WIRE-KE-88301", amount: 500, currency: "USD", receivedAt: "2026-08-04T10:00:00Z", reason: "Reference missing investor ID", status: "unmatched" },
  { id: "uf_2", reference: "WIRE-KE-88213", amount: 500, currency: "USD", receivedAt: "2026-07-22T11:05:00Z", reason: "Matched after manual review", status: "matched" },
];

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "suspended" | "invited";
  /** Empty string until the user's first sign-in (e.g. freshly invited). */
  lastLogin: string;
};

export const SYSTEM_USERS: SystemUser[] = [
  { id: "u_1", name: "Faith Kamau", email: "faith.kamau@investcent.co.ke", role: "bd_officer", status: "active", lastLogin: "2026-08-06T09:10:00Z" },
  { id: "u_2", name: "Peter Otieno", email: "peter.otieno@investcent.co.ke", role: "compliance_analyst", status: "active", lastLogin: "2026-08-06T08:45:00Z" },
  { id: "u_3", name: "Grace Mumbi", email: "grace.mumbi@investcent.co.ke", role: "operations", status: "active", lastLogin: "2026-08-06T07:30:00Z" },
  { id: "u_4", name: "Daniel Kiptoo", email: "daniel.kiptoo@investcent.co.ke", role: "head_of_finance", status: "active", lastLogin: "2026-08-05T18:00:00Z" },
  { id: "u_5", name: "Susan Achieng", email: "susan.achieng@investcent.co.ke", role: "investment_committee", status: "active", lastLogin: "2026-08-05T16:20:00Z" },
  { id: "u_6", name: "IT Admin", email: "admin@investcent.co.ke", role: "system_admin", status: "active", lastLogin: "2026-08-06T06:00:00Z" },
  { id: "u_7", name: "Josephine Muthoni", email: "josephine.muthoni@investcent.co.ke", role: "mlro", status: "active", lastLogin: "2026-08-08T15:30:00Z" },
  { id: "u_8", name: "Kevin Baraka", email: "kevin.baraka@investcent.co.ke", role: "compliance", status: "active", lastLogin: "2026-08-11T08:10:00Z" },
  { id: "u_9", name: "Mercy Wanjala", email: "mercy.wanjala@investcent.co.ke", role: "client_services", status: "active", lastLogin: "2026-09-02T06:05:00Z" },
  { id: "u_10", name: "Anthony Mwenda", email: "anthony.mwenda@investcent.co.ke", role: "head_of_bd", status: "active", lastLogin: "2026-09-01T17:40:00Z" },
  { id: "u_11", name: "Charles Mburu", email: "charles.mburu@investcent.co.ke", role: "ceo", status: "active", lastLogin: "2026-09-03T06:20:00Z" },
  { id: "u_12", name: "Ruth Nyambura", email: "ruth.nyambura@investcent.co.ke", role: "investment_manager", status: "active", lastLogin: "2026-09-02T15:05:00Z" },
];

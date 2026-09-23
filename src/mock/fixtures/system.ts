import type { AdminRole } from "./admin";

/** System-management domain — departments, third-party integrations,
 * scheduled batch jobs and per-app maintenance mode. All BO-managed. */

// ---- Departments (mirror the four Investcent SOPs + control functions) ----

export type Department = {
  id: string;
  name: string;
  head: string;
  description: string;
  /** BO Admin roles that belong to this department — users inherit their
   * department through their role. */
  roles: AdminRole[];
};

export const DEPARTMENTS: Department[] = [
  { id: "dep_exec", name: "Executive", head: "Charles Mburu", description: "Firm-wide oversight — performance, risk appetite, regulatory standing and the approvals that reach board level.", roles: ["ceo"] },
  { id: "dep_bd", name: "Business Development & Client Services", head: "Faith Kamau", description: "Client acquisition, discovery, suitability, IFA channel and ongoing servicing (BD SOP).", roles: ["bd_officer", "client_services", "head_of_bd"] },
  { id: "dep_ops", name: "Operations", head: "Grace Mumbi", description: "Onboarding, static data, receipts and unit allocation, settlement, custody, reconciliations (Ops SOP).", roles: ["operations"] },
  { id: "dep_fin", name: "Finance", head: "Daniel Kiptoo", description: "Close, treasury, client money, revenue, tax and regulatory reporting (Finance SOP).", roles: ["head_of_finance"] },
  { id: "dep_inv", name: "Investments / Fund Management", head: "Susan Achieng", description: "Portfolio management, market analysis, trade governance and risk limits (Investments SOP).", roles: ["investment_manager", "investment_committee"] },
  { id: "dep_comp", name: "Compliance & Risk", head: "Kevin Baraka", description: "Screening, suitability exceptions, AML monitoring, EDD, suspicious-activity reporting (MLRO) and regulatory liaison.", roles: ["compliance", "mlro", "compliance_analyst"] },
  { id: "dep_it", name: "Technology", head: "IT Admin", description: "Platform administration, access control, integrations and system monitoring.", roles: ["system_admin"] },
];

export function departmentForRole(role: AdminRole): Department | undefined {
  return DEPARTMENTS.find((d) => d.roles.includes(role));
}

// ---- Third-party integrations ----

export type Integration = {
  id: string;
  name: string;
  purpose: string;
  environment: "sandbox" | "production";
  health: "healthy" | "degraded" | "down";
  lastCheckedAt: string;
  note?: string;
};

export const INTEGRATIONS: Integration[] = [
  { id: "int_smile", name: "Smile Identity", purpose: "Onboarding KYC — ID document, biometric liveness, sanctions/PEP screening.", environment: "production", health: "healthy", lastCheckedAt: "2026-08-09T06:00:00Z" },
  { id: "int_daraja", name: "M-Pesa Daraja", purpose: "STK Push collections and B2C payouts on the bank's own Paybill.", environment: "production", health: "healthy", lastCheckedAt: "2026-08-09T06:00:00Z" },
  { id: "int_custodian", name: "Custodian statement feed", purpose: "Daily positions and coupon settlement statements for NAV reconciliation.", environment: "production", health: "degraded", lastCheckedAt: "2026-08-09T05:30:00Z", note: "Yesterday's statement arrived 40 minutes late — monitoring." },
  { id: "int_pricing", name: "Bond pricing feed", purpose: "NSE / market prices and yields feeding the daily NAV computation.", environment: "production", health: "healthy", lastCheckedAt: "2026-08-09T06:00:00Z" },
  { id: "int_airtel", name: "Airtel Money", purpose: "Second mobile-money rail for collections and payouts (proposal §4.3).", environment: "sandbox", health: "down", lastCheckedAt: "2026-08-20T09:00:00Z", note: "Merchant onboarding not started — Phase 1b. Down here means \u201cno integration\u201d, not \u201coutage\u201d." },
  { id: "int_pesalink", name: "Pesalink", purpose: "Instant bank-to-bank transfers for KES subscriptions and payouts.", environment: "sandbox", health: "down", lastCheckedAt: "2026-08-20T09:00:00Z", note: "Awaiting IPSL scheme onboarding — Phase 1b." },
  { id: "int_ussd", name: "USSD gateway", purpose: "Feature-phone session handling on the investor shortcode.", environment: "sandbox", health: "down", lastCheckedAt: "2026-08-20T09:00:00Z", note: "Shortcode not yet allocated by Safaricom; see the ussd_shortcode platform setting." },
  { id: "int_comms", name: "SMS / email gateway", purpose: "Transactional notices — welcome packs, distribution and settlement alerts.", environment: "sandbox", health: "healthy", lastCheckedAt: "2026-08-09T06:00:00Z", note: "Cut over to production alongside the mobile app launch." },
];

// ---- Scheduled batch jobs (Ops SOP: EOD/EOM processing) ----

export type SystemJob = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun?: { at: string; status: "success" | "failed"; detail?: string };
};

export const SYSTEM_JOBS: SystemJob[] = [
  { id: "job_nav", name: "Daily NAV computation", description: "Prices, accruals and unit pricing per sub-fund; queues the publication approval.", schedule: "Daily 16:15 EAT", enabled: true, lastRun: { at: "2026-08-08T16:15:00Z", status: "success" } },
  { id: "job_recon", name: "Daily reconciliation sweep", description: "Cash, unit-holding, custodian and suspense reconciliations; raises breaks.", schedule: "Daily 06:30 EAT", enabled: true, lastRun: { at: "2026-08-09T06:30:00Z", status: "success", detail: "1 new break raised (M-Pesa settlement batch)." } },
  { id: "job_dist", name: "Monthly distribution batch", description: "Accrued coupon income allocation — reinvest vs payout — with WHT applied.", schedule: "Last business day, 17:30 EAT", enabled: true, lastRun: { at: "2026-07-31T17:30:00Z", status: "success" } },
  { id: "job_aml", name: "AML monitoring scan", description: "Structuring, velocity and geo-mismatch rules over the rolling window.", schedule: "Hourly", enabled: true, lastRun: { at: "2026-08-09T07:00:00Z", status: "success" } },
  { id: "job_screening", name: "Daily sanctions / PEP re-screening", description: "Re-screens every customer against sanctions, PEP and adverse-media lists — the whole register, daily.", schedule: "Daily 05:00 EAT", enabled: true, lastRun: { at: "2026-08-11T05:00:00Z", status: "success", detail: "5 customers screened, 0 new matches." } },
  { id: "job_statements", name: "Monthly statement generation", description: "Investor statements rendered and released after review.", schedule: "1st business day, 06:00 EAT", enabled: true, lastRun: { at: "2026-08-03T06:00:00Z", status: "success" } },
  { id: "job_kyc_refresh", name: "KYC refresh sweep", description: "Flags clients due periodic KYC/tax re-verification per the configured cadence.", schedule: "Weekly, Mon 05:00 EAT", enabled: false, lastRun: { at: "2026-07-27T05:00:00Z", status: "failed", detail: "Timed out against Smile Identity sandbox — re-enable after gateway cutover." } },
];

// ---- Per-app maintenance mode ----

export type MaintenanceTarget = {
  id: string;
  app: string;
  maintenance: boolean;
  note?: string;
};

export const MAINTENANCE_TARGETS: MaintenanceTarget[] = [
  { id: "mt_investor", app: "Investor Web / PWA", maintenance: false },
  { id: "mt_mobile", app: "Investor Mobile", maintenance: true, note: "Pre-launch — held in maintenance until go-live." },
  { id: "mt_ifa", app: "IFA Portal", maintenance: false },
  { id: "mt_trustee", app: "Trustee Portal", maintenance: false },
  { id: "mt_payops", app: "Payment Ops Portal", maintenance: false },
];

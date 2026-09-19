import { USE_MOCK, latency, NotImplementedError } from "./config";
import { SUB_FUNDS, CENTRAL_BANK_RATE, type SubFundCode } from "./fixtures/fund";
import { REDEMPTION_TIERS } from "./fixtures/investor";
import { APPROVAL_QUEUE, LEADS, AML_ALERTS, FRAUD_ALERTS, SYSTEM_USERS, ROLE_LABELS, type AdminRole, type ApprovalItem } from "./fixtures/admin";
import { CONTENT_BLOCKS } from "./fixtures/cms";
import {
  PLATFORM_SETTINGS, logAudit, PENDING_CHANGES, APPROVAL_POLICIES, JURISDICTIONS, JURISDICTION_STATUS_LABELS,
  type PendingChange, type ApprovalPolicyRule, type Jurisdiction, type JurisdictionStatus, type AuditEvent,
} from "./fixtures/platform";
import { COMPLIANCE_CASES, RISK_FACTORS, type RiskFactorDef, type ComplianceCase } from "./fixtures/compliance";

import {
  CLASSIFIER_TYPES, assignClassifier, classifierAsOf, classifierHistory, classifierType, eligibleForProduct,
  type ClassifierTypeId,
} from "./fixtures/classifiers";
import {
  INSTITUTION_ACCOUNTS, INSTITUTION_ACCOUNT_LABELS, INVESTOR_CONTRACTS, CONTRACT_STATUS_LABELS,
  contractsForClient, productById,
} from "./fixtures/catalogue";
import {
  CHART_OF_ACCOUNTS, GL_ACCOUNTS, CONTRACT_ACCRUALS, BUSINESS_RULES, availableBalance, balanceOf,
  unitBalance,
} from "./fixtures/ledger";
import {
  INTERACTIONS, INTERACTION_TYPE_LABELS, CRM_TASKS, SEGMENT_LABELS, SEGMENT_SERVICE_MODEL, SERVICE_REVIEWS,
  acknowledgementSla, coverageAsOf, coverageHistory, interactionsFor, ownerName, segmentAsOf, segmentHistory,
  visibleInteraction, type Enquiry, type Interaction, type InteractionSubject, type InteractionType,
} from "./fixtures/crm";

export type FeeAccrual = {
  subFund: SubFundCode;
  currency: "KES" | "USD";
  annualRate: number;
  /** Today's accrual: AUM × rate ÷ 365. */
  dailyAccrual: number;
  /** Accrued and not yet settled — already deducted from the AUM pricing NAV. */
  accruedToDate: number;
  /** Effect of the accrued fee on NAV per unit. */
  navImpactPerUnit: number;
};

export type WithholdingPolicy = {
  subFund: SubFundCode;
  settingKey: string;
  label: string;
  /** Rate as a fraction, e.g. 0.15. */
  rate: number;
  /** True while the treatment is still pending Tax confirmation
   * (Open Question 7). A confirmed 0% and an unconfirmed rate are different
   * states and must not be displayed the same way. */
  unconfirmed: boolean;
};

export type FacilityState = {
  subFund: SubFundCode;
  currency: "KES" | "USD";
  facilitySize: number;
  drawn: number;
  headroom: number;
  /** Concept note §5.1 — CBR + a 1.5–2.0% margin. */
  interestRate: number;
  interestAccrued: number;
  /** The facility must be at least 5% of AUM (scaling covenant). */
  covenantMinimum: number;
  covenantBreached: boolean;
  /** Share of AUM one dealing day's redemptions may reach before the gate. */
  gateThresholdValue: number;
};

export async function getFacilityState(subFund: SubFundCode): Promise<FacilityState> {
  if (!USE_MOCK) throw new NotImplementedError("getFacilityState");
  await latency();
  const fund = SUB_FUNDS.find((f) => f.code === subFund)!;
  const covenantMinimum = fund.aum * (settingNumber("liquidity_facility_floor", 5) / 100);
  return {
    subFund,
    currency: fund.currency,
    facilitySize: fund.liquidityFacility,
    drawn: fund.liquidityUsed,
    headroom: fund.liquidityFacility - fund.liquidityUsed,
    interestRate: CENTRAL_BANK_RATE + facilityMargin(),
    interestAccrued: fund.facilityInterestAccrued,
    covenantMinimum,
    covenantBreached: fund.liquidityFacility < covenantMinimum,
    gateThresholdValue: fund.aum * (settingNumber("gate_threshold_pct", 10) / 100),
  };
}

/** Reads a numeric platform setting. BO Admin is the point of truth for these,
 * so nothing downstream should hardcode the value. Falls back only if the key
 * is missing or unparseable, which would be a seeding bug. */
function settingNumber(key: string, fallback: number): number {
  const raw = PLATFORM_SETTINGS.find((s) => s.key === key)?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `facility_pricing` is stored for humans as "CBR + 1.75", so the margin is
 * pulled out of it rather than kept as a second, drift-prone setting. */
function facilityMargin(): number {
  const raw = PLATFORM_SETTINGS.find((s) => s.key === "facility_pricing")?.value ?? "";
  const parsed = Number(/[\d.]+/.exec(raw)?.[0]);
  return (Number.isFinite(parsed) ? parsed : 1.75) / 100;
}

// ---- BO admin ----
export async function getApprovalQueue() {
  if (!USE_MOCK) throw new NotImplementedError("getApprovalQueue");
  await latency();
  return APPROVAL_QUEUE;
}

export async function getLeads() {
  if (!USE_MOCK) throw new NotImplementedError("getLeads");
  await latency();
  return LEADS;
}

// ---- CMS ----
export async function getContentBlocks() {
  if (!USE_MOCK) throw new NotImplementedError("getContentBlocks");
  await latency();
  return CONTENT_BLOCKS;
}

let configApprovalCounter = 100;

/** Raises a static_data_change approval carrying a staged change closure —
 * nothing applies until a second person approves it in the queue. */
function raiseConfigApproval(title: string, detail: string, proposedBy: string, pending: PendingChange): ApprovalItem {
  const approval: ApprovalItem = {
    id: `ap_cfg_${configApprovalCounter++}`,
    kind: "static_data_change",
    title,
    detail,
    proposedBy,
    proposedAt: new Date().toISOString(),
    status: "pending",
  };
  APPROVAL_QUEUE.unshift(approval);
  PENDING_CHANGES.set(approval.id, pending);
  logAudit({ actor: proposedBy, actorRole: "Maker", category: "config", action: "Proposed change", target: pending.label });
  return approval;
}

/** All tiers, both currencies — the BO configuration view. */
export async function getRedemptionTierConfig() {
  if (!USE_MOCK) throw new NotImplementedError("getRedemptionTierConfig");
  await latency();
  return REDEMPTION_TIERS;
}

export async function proposeTierChange(id: string, settlementDays: number, proposedBy: string, reason: string) {
  if (!USE_MOCK) throw new NotImplementedError("proposeTierChange");
  await latency(400, 900);
  const tier = REDEMPTION_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error("not found");
  if (tier.pendingApprovalId) throw new Error("A change to this tier is already awaiting approval");
  const approval = raiseConfigApproval(
    `Redemption tier — ${tier.label}: ${tier.settlementDays} → ${settlementDays} settlement days`,
    `${reason} Investor apps quote settlement timing from this schedule (${tier.currency}).`,
    proposedBy,
    {
      label: `Redemption tier — ${tier.label}`,
      apply: () => { tier.settlementDays = settlementDays; },
      clear: () => {
        tier.pendingApprovalId = undefined;
        tier.pendingSummary = undefined;
      },
    },
  );
  tier.pendingApprovalId = approval.id;
  tier.pendingSummary = `${settlementDays} days`;
  return tier;
}

export async function getApprovalPolicies(): Promise<ApprovalPolicyRule[]> {
  if (!USE_MOCK) throw new NotImplementedError("getApprovalPolicies");
  await latency();
  return APPROVAL_POLICIES;
}

/** DoA lookup: which roles may approve this item. Falls back to "any role
 * with Approvals access" when no rule matches (permissive default). */
export function approverRolesFor(item: Pick<ApprovalItem, "kind" | "amount" | "currency">): AdminRole[] | null {
  const rules = APPROVAL_POLICIES.filter((r) => r.kind === item.kind)
    .filter((r) => !r.currency || !item.currency || r.currency === item.currency)
    .sort((a, b) => (a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity));
  const match = rules.find((r) => r.maxAmount === null || (item.amount ?? 0) <= r.maxAmount);
  return match ? match.approverRoles : null;
}

export async function proposeApprovalRouteChange(id: string, approverRoles: AdminRole[], proposedBy: string, reason: string) {
  if (!USE_MOCK) throw new NotImplementedError("proposeApprovalRouteChange");
  await latency(400, 900);
  const rule = APPROVAL_POLICIES.find((r) => r.id === id);
  if (!rule) throw new Error("not found");
  if (rule.pendingApprovalId) throw new Error("A change to this routing rule is already awaiting approval");
  if (approverRoles.length === 0) throw new Error("At least one approver role is required");
  const roleNames = (roles: AdminRole[]) => roles.map((r) => ROLE_LABELS[r]).join(", ");
  const approval = raiseConfigApproval(
    `Approval routing — ${rule.label}`,
    `${reason} Approvers change from [${roleNames(rule.approverRoles)}] to [${roleNames(approverRoles)}]. Delegation-of-Authority control.`,
    proposedBy,
    {
      label: `Approval routing — ${rule.label}`,
      apply: () => { rule.approverRoles = approverRoles; },
      clear: () => {
        rule.pendingApprovalId = undefined;
        rule.pendingSummary = undefined;
      },
    },
  );
  rule.pendingApprovalId = approval.id;
  rule.pendingSummary = roleNames(approverRoles);
  return rule;
}

export async function getJurisdictions(): Promise<Jurisdiction[]> {
  if (!USE_MOCK) throw new NotImplementedError("getJurisdictions");
  await latency();
  return JURISDICTIONS;
}

export async function proposeJurisdictionStatus(id: string, status: JurisdictionStatus, proposedBy: string, reason: string) {
  if (!USE_MOCK) throw new NotImplementedError("proposeJurisdictionStatus");
  await latency(400, 900);
  const jur = JURISDICTIONS.find((j) => j.id === id);
  if (!jur) throw new Error("not found");
  if (jur.pendingApprovalId) throw new Error("A change to this jurisdiction is already awaiting approval");
  const approval = raiseConfigApproval(
    `Tokenization whitelist — ${jur.segment}: ${JURISDICTION_STATUS_LABELS[jur.status]} → ${JURISDICTION_STATUS_LABELS[status]}`,
    `${reason} Phase 2 whitelist policy — this matrix becomes the on-chain eligibility contract, so changes carry compliance weight.`,
    proposedBy,
    {
      label: `Tokenization whitelist — ${jur.segment}`,
      apply: () => { jur.status = status; },
      clear: () => {
        jur.pendingApprovalId = undefined;
        jur.pendingSummary = undefined;
      },
    },
  );
  jur.pendingApprovalId = approval.id;
  jur.pendingSummary = JURISDICTION_STATUS_LABELS[status];
  return jur;
}

export type CouponMonth = {
  month: string;
  /** Coupon cash expected that month, per sub-fund currency. */
  kes: number;
  usd: number;
  bonds: string[];
};

const complianceAudit = (actor: string, actorRole: string, action: string, target: string, entityType: AuditEvent["entityType"], entityId: string, detail?: string) =>
  logAudit({ actor, actorRole, category: "compliance", action, target, entityType, entityId, detail });

let riskFactorCounter = 100;

export async function getRiskFactors(): Promise<RiskFactorDef[]> {
  if (!USE_MOCK) throw new NotImplementedError("getRiskFactors");
  await latency();
  return RISK_FACTORS;
}

export async function addRiskFactor(label: string, description: string, actor: string): Promise<RiskFactorDef> {
  if (!USE_MOCK) throw new NotImplementedError("addRiskFactor");
  await latency(300, 700);
  const trimmed = label.trim();
  if (!trimmed) throw new Error("A label is required");
  if (RISK_FACTORS.some((f) => f.label.toLowerCase() === trimmed.toLowerCase())) throw new Error("That factor already exists");
  const factor: RiskFactorDef = { id: `rf_${riskFactorCounter++}`, label: trimmed, description: description.trim(), enabled: true };
  RISK_FACTORS.push(factor);
  logAudit({ actor, actorRole: "Compliance", category: "compliance", action: "Risk factor added", target: factor.label });
  return factor;
}

export async function setRiskFactorEnabled(id: string, enabled: boolean, actor: string): Promise<RiskFactorDef> {
  if (!USE_MOCK) throw new NotImplementedError("setRiskFactorEnabled");
  await latency(250, 600);
  const factor = RISK_FACTORS.find((f) => f.id === id);
  if (!factor) throw new Error("not found");
  factor.enabled = enabled;
  logAudit({ actor, actorRole: "Compliance", category: "compliance", action: enabled ? "Risk factor enabled" : "Risk factor disabled", target: factor.label });
  return factor;
}

let caseCounter = 7;
let caseNoteCounter = 100;
let caseEvidenceCounter = 100;

export async function openCaseFromAlert(alertId: string, actor: string): Promise<ComplianceCase> {
  if (!USE_MOCK) throw new NotImplementedError("openCaseFromAlert");
  await latency(400, 900);
  const alert = [...AML_ALERTS, ...FRAUD_ALERTS].find((a) => a.id === alertId);
  if (!alert) throw new Error("not found");
  if (alert.caseId) throw new Error("A case already exists for this alert");
  const created: ComplianceCase = {
    id: `cs_${caseCounter++}`,
    // The board the alert came from decides the case type — a fraud alert must
    // not open an AML case, or the case listing and the STR path both lie.
    type: alert.kind === "fraud" ? "fraud" : "aml",
    title: `${alert.rule} — ${alert.clientName}`,
    summary: alert.detail,
    clientId: alert.clientId,
    clientName: alert.clientName,
    linkedAlertIds: [alert.id],
    severity: alert.severity,
    status: "open",
    assignee: actor,
    openedAt: new Date().toISOString(),
    openedBy: actor,
    notes: [{ id: `cn_${caseNoteCounter++}`, at: new Date().toISOString(), by: actor, byRole: "Compliance", text: `Case opened from alert ${alert.id}.`, kind: "note" }],
    evidence: [{ id: `ce_${caseEvidenceCounter++}`, label: `Alert ${alert.id} — ${alert.rule}`, type: "external", ref: alert.id, addedAt: new Date().toISOString(), addedBy: actor }],
  };
  COMPLIANCE_CASES.unshift(created);
  alert.status = "under_review";
  alert.assignee = actor;
  alert.caseId = created.id;
  complianceAudit(actor, "Compliance", "Case opened from alert", created.title, "case", created.id, `Alert ${alert.id}`);
  return created;
}

export async function getInstitutionAccounts() {
  if (!USE_MOCK) throw new NotImplementedError("getInstitutionAccounts");
  await latency();
  return INSTITUTION_ACCOUNTS.map((ia) => ({
    ...ia,
    label: INSTITUTION_ACCOUNT_LABELS[ia.purpose],
    glAccountId: GL_ACCOUNTS.find((g) => g.institutionAccountId === ia.id)?.id ?? null,
    balance: balanceOf(GL_ACCOUNTS.find((g) => g.institutionAccountId === ia.id)?.id ?? ""),
  }));
}

export async function getContracts(clientId?: string) {
  if (!USE_MOCK) throw new NotImplementedError("getContracts");
  await latency();
  const rows = clientId ? contractsForClient(clientId) : INVESTOR_CONTRACTS;
  return rows.map((c) => ({
    ...c,
    productName: productById(c.productId)!.name,
    distributionClass: productById(c.productId)!.distributionClass,
    units: unitBalance(c.id),
    availableBalance: availableBalance(c.id),
    statusLabel: CONTRACT_STATUS_LABELS[c.status],
  }));
}

export async function getChartOfAccounts() {
  if (!USE_MOCK) throw new NotImplementedError("getChartOfAccounts");
  await latency();
  return CHART_OF_ACCOUNTS.map((a) => ({
    ...a,
    instances: GL_ACCOUNTS.filter((g) => g.code === a.code).length,
    balanceKes: GL_ACCOUNTS.filter((g) => g.code === a.code && g.currency === "KES").reduce((s, g) => s + balanceOf(g.id), 0),
    balanceUsd: GL_ACCOUNTS.filter((g) => g.code === a.code && g.currency === "USD").reduce((s, g) => s + balanceOf(g.id), 0),
  }));
}

export async function getContractAccruals(runId?: string) {
  if (!USE_MOCK) throw new NotImplementedError("getContractAccruals");
  await latency();
  return CONTRACT_ACCRUALS.filter((a) => !runId || a.runId === runId);
}

export async function getBusinessRules() {
  if (!USE_MOCK) throw new NotImplementedError("getBusinessRules");
  await latency();
  return BUSINESS_RULES;
}

export async function getClassifierTypes() {
  if (!USE_MOCK) throw new NotImplementedError("getClassifierTypes");
  await latency();
  return CLASSIFIER_TYPES;
}

export async function getClassifierHistory(clientId: string, typeId?: ClassifierTypeId) {
  if (!USE_MOCK) throw new NotImplementedError("getClassifierHistory");
  await latency();
  return classifierHistory(clientId, typeId).map((a) => ({
    ...a,
    typeLabel: classifierType(a.typeId).label,
    valueLabel: classifierType(a.typeId).values.find((v) => v.value === a.value)?.label ?? a.value,
    current: a.validTo === null,
  }));
}

/** The query the empty `investor_risk_history` table made unanswerable. */
export async function getClassifiersAsOf(clientId: string, asOf: string) {
  if (!USE_MOCK) throw new NotImplementedError("getClassifiersAsOf");
  await latency();
  return CLASSIFIER_TYPES.map((t) => {
    const found = classifierAsOf(clientId, t.id, asOf);
    return {
      typeId: t.id,
      label: t.label,
      value: found?.value ?? null,
      valueLabel: found ? t.values.find((v) => v.value === found.value)?.label ?? found.value : null,
      since: found?.validFrom ?? null,
      reason: found?.reason ?? null,
    };
  });
}

export async function getProductEligibility(clientId: string, asOf?: string) {
  if (!USE_MOCK) throw new NotImplementedError("getProductEligibility");
  await latency();
  return eligibleForProduct(clientId, asOf);
}

export async function setClassifier(clientId: string, typeId: ClassifierTypeId, value: string, actor: string, reason?: string) {
  if (!USE_MOCK) throw new NotImplementedError("setClassifier");
  await latency(300, 700);
  const assigned = assignClassifier(clientId, typeId, value, actor, reason);
  if (!assigned) return null;
  complianceAudit(actor, "Compliance", `${classifierType(typeId).label} reassigned`,
    `${assigned.previousValue ?? "unset"} → ${value}`, "client", clientId, reason);
  return assigned;
}

const crmAudit = (actor: string, actorRole: string, action: string, target: string, detail?: string) =>
  logAudit({ actor, actorRole, category: "data", action, target, detail });

export type EnquiryRow = Enquiry & {
  channelLabel: string;
  categoryLabel: string;
  statusLabel: string;
  routing: { queue: string; note: string };
  sla: ReturnType<typeof acknowledgementSla>;
  ownerName: string | null;
};

/** `canSeeComplianceDetail` defaults to FALSE: a caller that forgets the flag
 * redacts rather than leaks. Only Compliance, MLRO and System Admin pass true. */
export async function getInteractions(
  subjectType: InteractionSubject, subjectId: string, canSeeComplianceDetail = false,
) {
  if (!USE_MOCK) throw new NotImplementedError("getInteractions");
  await latency();
  return interactionsFor(subjectType, subjectId)
    .map((i) => visibleInteraction(i, canSeeComplianceDetail))
    .map((i) => ({ ...i, typeLabel: INTERACTION_TYPE_LABELS[i.type], byName: ownerName(i.byId) }));
}

export async function logInteraction(input: {
  subjectType: InteractionSubject;
  subjectId: string;
  type: InteractionType;
  summary: string;
  detail?: string;
  outcome?: string;
  nextAction?: string;
  nextActionDue?: string;
  byId: string;
  actor: string;
}) {
  if (!USE_MOCK) throw new NotImplementedError("logInteraction");
  await latency(300, 800);
  if (!input.summary.trim()) throw new Error("An interaction needs a summary");
  if (input.nextAction && !input.nextActionDue) throw new Error("A next action needs a date, or it will never surface in anyone's queue");

  const interaction: Interaction = {
    id: `int_${Date.now()}`,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    type: input.type,
    summary: input.summary.trim(),
    ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
    ...(input.outcome?.trim() ? { outcome: input.outcome.trim() } : {}),
    ...(input.nextAction?.trim() ? { nextAction: input.nextAction.trim() } : {}),
    ...(input.nextActionDue ? { nextActionDue: input.nextActionDue } : {}),
    byId: input.byId,
    occurredAt: new Date().toISOString(),
  };
  INTERACTIONS.unshift(interaction);

  /* A next action becomes a real task rather than a note somebody has to
     remember to read. This is the whole difference between an activity log
     and a system that makes follow-up happen. */
  if (interaction.nextAction && interaction.nextActionDue) {
    CRM_TASKS.unshift({
      id: `tsk_${Date.now()}`,
      title: interaction.nextAction,
      ownerId: input.byId,
      dueDate: interaction.nextActionDue,
      status: "open",
      source: "interaction",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      createdAt: new Date().toISOString(),
    });
  }

  crmAudit(input.actor, "Client Services", `Logged ${INTERACTION_TYPE_LABELS[input.type].toLowerCase()}`, input.summary.trim());
  return interaction;
}

export async function getClientCrmProfile(clientId: string) {
  if (!USE_MOCK) throw new NotImplementedError("getClientCrmProfile");
  await latency();
  const coverage = coverageAsOf(clientId);
  const segment = segmentAsOf(clientId);
  return {
    clientId,
    ownerId: coverage?.value ?? null,
    ownerLabel: coverage ? ownerName(coverage.value) : null,
    ownerSince: coverage?.validFrom ?? null,
    segment: segment?.value ?? null,
    segmentLabel: segment ? SEGMENT_LABELS[segment.value] : null,
    segmentSince: segment?.validFrom ?? null,
    serviceModel: segment ? SEGMENT_SERVICE_MODEL[segment.value] : null,
    coverageHistory: coverageHistory(clientId).map((a) => ({ ...a, valueLabel: ownerName(a.value), current: a.validTo === null })),
    segmentHistory: segmentHistory(clientId).map((a) => ({ ...a, valueLabel: SEGMENT_LABELS[a.value], current: a.validTo === null })),
    reviews: SERVICE_REVIEWS.filter((r) => r.clientId === clientId).map((r) => ({ ...r, ownerLabel: ownerName(r.ownerId) })),
  };
}

export async function getCrmOwners() {
  if (!USE_MOCK) throw new NotImplementedError("getCrmOwners");
  await latency();
  return SYSTEM_USERS.filter((u) => u.status === "active").map((u) => ({ id: u.id, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role] }));
}

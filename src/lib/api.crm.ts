/* CRM: leads, enquiries, interactions, tasks, coverage, campaigns, pipeline,
 * BD performance. Owned by the CRM-domain wiring pass — edit only this file
 * for that domain. See apiClient.ts / api.ts.
 *
 * Every controller under crm/api/* is plain JdbcTemplate — `SELECT *` rows
 * come back as raw snake_case columns (plus a couple of SQL-aliased joins
 * like `owner_name`), not the camelCase, pre-computed shape
 * `src/mock/api.ts` produced. Pages were written against the mock
 * shape and are NOT being rewritten here, so every function below reshapes
 * the real response into exactly what the page's existing render code reads
 * (camelCase fields, computed labels, SLA/bid-score math). Pure label maps
 * and pure functions (acknowledgementSla, ENQUIRY_*_LABELS, SEGMENT_LABELS,
 * BID_CRITERIA, ...) are imported from "../mock" for that reshaping only —
 * pages keep importing those same constants directly, unchanged. */
import { get, post } from "./apiClient";
import {
  ENQUIRY_CHANNEL_LABELS, ENQUIRY_CATEGORY_LABELS, ENQUIRY_STATUS_LABELS, ENQUIRY_ROUTING,
  acknowledgementSla, INTERACTION_TYPE_LABELS, TASK_SOURCE_LABELS, SEGMENT_LABELS,
  SEGMENT_SERVICE_MODEL, OPPORTUNITY_STAGE_LABELS, BID_CRITERIA, ROLE_LABELS,
  type Lead, type EnquiryRow, type Enquiry, type Interaction, type CrmTask,
  type CommercialSegment, type BidCriterion, type AdminRole, type OpportunityStage,
} from "../mock";

// ---- Leads ----

type RawLead = {
  id: string; name: string; phone: string; source: string; stage: string;
  suitability_score: number | null; geography: string; product: string;
  delivery_channel: string; customer_risk: string | null; campaign_id: string | null;
  created_at: string;
};

function mapLead(r: RawLead): Lead {
  return {
    id: r.id, name: r.name, phone: r.phone, source: r.source,
    stage: r.stage as Lead["stage"],
    suitabilityScore: r.suitability_score,
    geography: r.geography, product: r.product,
    deliveryChannel: r.delivery_channel as Lead["deliveryChannel"],
    customerRisk: r.customer_risk as Lead["customerRisk"],
    createdAt: r.created_at,
  };
}

export const getLeads = async (): Promise<Lead[]> =>
  (await get<RawLead[]>("/api/leads")).map(mapLead);

// ---- Enquiries ----

type RawEnquiry = {
  id: string; client_id: string | null; name: string; contact: string; channel: string;
  category: string; subject: string; body: string; status: string; owner_id: string | null;
  received_at: string; acknowledged_at: string | null; resolved_at: string | null;
  resolution: string | null; converted_lead_id: string | null; campaign_id: string | null;
  owner_name: string | null;
};

function mapEnquiryBase(r: RawEnquiry): Enquiry {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    contact: r.contact,
    channel: r.channel as Enquiry["channel"],
    category: r.category as Enquiry["category"],
    subject: r.subject,
    body: r.body,
    status: r.status as Enquiry["status"],
    ownerId: r.owner_id,
    receivedAt: r.received_at,
    ...(r.acknowledged_at ? { acknowledgedAt: r.acknowledged_at } : {}),
    ...(r.resolved_at ? { resolvedAt: r.resolved_at } : {}),
    ...(r.resolution ? { resolution: r.resolution } : {}),
    ...(r.converted_lead_id ? { convertedLeadId: r.converted_lead_id } : {}),
    ...(r.campaign_id ? { campaignId: r.campaign_id } : {}),
  };
}

// The one-business-day acknowledgement standard lives in Platform Settings
// (config_settings.enquiry_ack_days), same source the real BdPerformance
// controller reads. Falls back to 1, matching that controller's own default.
async function ackSlaDays(): Promise<number> {
  try {
    const settings = await get<{ key: string; value: string }[]>("/api/settings");
    const raw = settings.find((s) => s.key === "enquiry_ack_days")?.value;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 1;
  }
}

export const getEnquiries = async (): Promise<EnquiryRow[]> => {
  const [rows, slaDays] = await Promise.all([get<RawEnquiry[]>("/api/enquiries"), ackSlaDays()]);
  return rows.map((r) => {
    const enquiry = mapEnquiryBase(r);
    return {
      ...enquiry,
      channelLabel: ENQUIRY_CHANNEL_LABELS[enquiry.channel],
      categoryLabel: ENQUIRY_CATEGORY_LABELS[enquiry.category],
      statusLabel: ENQUIRY_STATUS_LABELS[enquiry.status],
      routing: ENQUIRY_ROUTING[enquiry.category],
      sla: acknowledgementSla(enquiry, slaDays),
      ownerName: r.owner_name,
    };
  });
};

export const acknowledgeEnquiry = (id: string, _actor?: string) => post(`/api/enquiries/${id}/acknowledge`);

// The backend's AssignRequest wants the *new owner's* display name for its
// audit entry (`ownerId == null ? "Unassigned" : ownerName`), not the acting
// staff member's name the page passes as its third argument — resolved here
// so the audit trail reads correctly without changing the page's call site.
export const assignEnquiry = async (id: string, ownerId: string | null, _actor?: string) => {
  let ownerName: string | undefined;
  if (ownerId) {
    const owners = await get<{ id: string; name: string }[]>("/api/crm-owners");
    ownerName = owners.find((o) => o.id === ownerId)?.name;
  }
  return post(`/api/enquiries/${id}/assign`, { ownerId, ownerName });
};

export const resolveEnquiry = (id: string, resolution: string, _actor?: string) =>
  post(`/api/enquiries/${id}/resolve`, { resolution });

export const convertEnquiryToLead = (id: string, _actor?: string) => post(`/api/enquiries/${id}/convert`);

// ---- Interactions ----

type RawInteraction = {
  id: string; subject_type: string; subject_id: string; type: string; summary: string;
  detail: string | null; outcome: string | null; next_action: string | null;
  next_action_due: string | null; by_id: string; occurred_at: string; compliance_only: boolean;
  by_name: string;
};

function mapInteraction(r: RawInteraction): Interaction & { typeLabel: string; byName: string } {
  const type = r.type as Interaction["type"];
  return {
    id: r.id,
    subjectType: r.subject_type as Interaction["subjectType"],
    subjectId: r.subject_id,
    type,
    summary: r.summary,
    ...(r.detail ? { detail: r.detail } : {}),
    ...(r.outcome ? { outcome: r.outcome } : {}),
    ...(r.next_action ? { nextAction: r.next_action } : {}),
    ...(r.next_action_due ? { nextActionDue: r.next_action_due } : {}),
    byId: r.by_id,
    occurredAt: r.occurred_at,
    complianceOnly: r.compliance_only,
    typeLabel: INTERACTION_TYPE_LABELS[type],
    byName: r.by_name,
  };
}

export const getInteractions = async (subjectType: string, subjectId: string, _canSeeComplianceDetail?: boolean) =>
  (await get<RawInteraction[]>(`/api/interactions?subjectType=${subjectType}&subjectId=${subjectId}`)).map(mapInteraction);

// The backend redacts compliance-only interactions server-side, from the
// caller's actual JWT permissions (`cases:read`) — it never trusts a
// client-supplied flag, so the second argument is accepted for call-site
// compatibility and intentionally not sent.
export const getRecentInteractions = async (limit = 20, _canSeeComplianceDetail = false) =>
  (await get<RawInteraction[]>(`/api/interactions/recent?limit=${limit}`)).map(mapInteraction);

export const logInteraction = (input: {
  subjectType: string; subjectId: string; type: string; summary: string; detail?: string;
  outcome?: string; nextAction?: string; nextActionDue?: string; complianceOnly?: boolean;
}) => post("/api/interactions", {
  subjectType: input.subjectType, subjectId: input.subjectId, type: input.type, summary: input.summary,
  detail: input.detail, outcome: input.outcome, nextAction: input.nextAction, nextActionDue: input.nextActionDue,
  complianceOnly: input.complianceOnly ?? false,
});

// ---- Tasks ----

type RawTask = {
  id: string; title: string; detail: string | null; owner_id: string; due_date: string;
  status: string; source: string; subject_type: string | null; subject_id: string | null;
  created_at: string; completed_at: string | null; owner_name: string;
};

export const getCrmTasks = async (ownerId?: string) => {
  const rows = await get<RawTask[]>(`/api/tasks${ownerId ? `?ownerId=${ownerId}` : ""}`);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    ...(t.detail ? { detail: t.detail } : {}),
    ownerId: t.owner_id,
    dueDate: t.due_date,
    status: t.status as CrmTask["status"],
    source: t.source as CrmTask["source"],
    subjectType: (t.subject_type as CrmTask["subjectType"]) ?? null,
    subjectId: t.subject_id,
    createdAt: t.created_at,
    ...(t.completed_at ? { completedAt: t.completed_at } : {}),
    ownerLabel: t.owner_name,
    sourceLabel: TASK_SOURCE_LABELS[t.source as CrmTask["source"]],
    overdue: t.status === "open" && t.due_date < today,
    dueToday: t.status === "open" && t.due_date === today,
  }));
};

export const createCrmTask = (input: {
  title: string; detail?: string; ownerId: string; dueDate: string;
  subjectType?: string; subjectId?: string; actor?: string;
}) => post("/api/tasks", {
  title: input.title, detail: input.detail, ownerId: input.ownerId, dueDate: input.dueDate,
  subjectType: input.subjectType, subjectId: input.subjectId,
});

export const setCrmTaskStatus = (id: string, status: "done" | "cancelled" | "open", _actor?: string) =>
  post(`/api/tasks/${id}/status`, { status });

// ---- Coverage & segmentation ----

type RawCoverageGap = {
  clientId: string; name: string; segment: string; ownerId: string; expectsOwner: boolean; gap: boolean;
};

export const getCoverageBook = async () => {
  const [gaps, owners] = await Promise.all([
    get<RawCoverageGap[]>("/api/coverage"),
    get<{ id: string; name: string }[]>("/api/crm-owners"),
  ]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? null;
  return gaps.map((r) => {
    const segment = r.segment ? (r.segment as CommercialSegment) : null;
    const ownerId = r.ownerId || null;
    return {
      id: r.clientId,
      clientId: r.clientId,
      name: r.name,
      segment,
      segmentLabel: segment ? SEGMENT_LABELS[segment] : null,
      ownerId,
      ownerLabel: ownerId ? ownerName(ownerId) : null,
      expectsOwner: r.expectsOwner,
      gap: r.gap,
      serviceModel: segment ? SEGMENT_SERVICE_MODEL[segment] : null,
    };
  });
};

/** Reference data for the Coverage page's "Service model" tab — real
 * `GET /api/coverage/segment-model` (`CrmService#segmentModel`). The backend
 * builds the row as a hand-populated `LinkedHashMap` with the exact
 * camelCase keys the page already expects (`key`, `label`, `coverage`,
 * `reviewMonths`, `clients`) — a JdbcTemplate `SELECT *` result this is not,
 * so no snake_case remap is needed here. */
export const getSegmentModel = () =>
  get<{ key: CommercialSegment; label: string; coverage: string; reviewMonths: number | null; clients: number }[]>(
    "/api/coverage/segment-model",
  );

export const getClientCrmProfile = async (clientId: string) => {
  const raw = await get<{
    clientId: string;
    owner: Record<string, unknown>;
    segment: Record<string, unknown>;
    coverageHistory: Record<string, unknown>[];
    segmentHistory: Record<string, unknown>[];
  }>(`/api/coverage/${clientId}`);
  return raw;
};

// Named setCoverageOwner/setCoverageSegment (not setClientOwner/setClientSegment)
// because api.compliance.ts already exports a same-named pair against a
// different endpoint (/api/clients/{id}/owner|segment) — re-exporting both
// from the barrel under identical names is a TS2308 ambiguous-export error.
// Coverage.tsx imports these aliased back to the names it already calls.
export const setCoverageOwner = (clientId: string, ownerId: string, _actor?: string, reason?: string) =>
  post(`/api/coverage/${clientId}/owner`, { ownerId, reason });

export const setCoverageSegment = (clientId: string, segment: CommercialSegment, _actor?: string, reason?: string) =>
  post(`/api/coverage/${clientId}/segment`, { segment, reason });

// ---- Campaigns ----

type RawCampaign = {
  id: string; name: string; channel: string; started_at: string; ended_at: string | null;
  spend_kes: number | null; note: string | null;
};
type RawCampaignStats = {
  campaign: RawCampaign; enquiries: number; leads: number; converted: number;
  conversionPct: number | ""; costPerConversion: number | "";
};

export const getCampaigns = async () => {
  const rows = await get<RawCampaignStats[]>("/api/campaigns");
  return rows.map((r) => ({
    id: r.campaign.id,
    name: r.campaign.name,
    channel: r.campaign.channel,
    startedAt: r.campaign.started_at,
    endedAt: r.campaign.ended_at,
    spendKes: r.campaign.spend_kes,
    ...(r.campaign.note ? { note: r.campaign.note } : {}),
    enquiries: r.enquiries,
    leads: r.leads,
    converted: r.converted,
    conversionPct: r.conversionPct === "" ? null : r.conversionPct,
    costPerConversion: r.costPerConversion === "" ? null : r.costPerConversion,
  }));
};

export const getLeadsWithCampaign = async () => {
  const [leads, campaigns] = await Promise.all([get<RawLead[]>("/api/leads-with-campaign"), getCampaigns()]);
  return leads.map((l) => {
    const lead = mapLead(l);
    const campaignId = l.campaign_id ?? null;
    const campaignName = campaignId ? campaigns.find((c) => c.id === campaignId)?.name ?? null : null;
    return { ...lead, campaignId, campaignName };
  });
};

// ---- Institutional pipeline ----

type RawOpportunity = {
  id: string; counterparty: string; type: string; stage: string; currency: string;
  indicative_amount: number; owner_id: string; opened_at: string; expected_decision_at: string | null;
  closed_at: string | null; scores: Partial<Record<BidCriterion, number>>; decision: string | null;
  decision_by: string | null; decision_note: string | null; source_enquiry_id: string | null;
  owner_name: string;
};

function bidScoreOf(scores: Partial<Record<BidCriterion, number>>) {
  const values = BID_CRITERIA.map((c) => scores[c.key]).filter((v): v is number => typeof v === "number");
  return {
    score: values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)) : null,
    scored: values.length,
    total: BID_CRITERIA.length,
  };
}

export const getOpportunities = async () => {
  const rows = await get<RawOpportunity[]>("/api/pipeline");
  return rows.map((o) => {
    const stage = o.stage as OpportunityStage;
    return {
      id: o.id,
      counterparty: o.counterparty,
      type: o.type as "institutional" | "corporate" | "sacco" | "pension" | "ifa_channel",
      stage,
      stageLabel: OPPORTUNITY_STAGE_LABELS[stage],
      currency: o.currency as "KES" | "USD",
      indicativeAmount: o.indicative_amount,
      ownerId: o.owner_id,
      ownerLabel: o.owner_name,
      openedAt: o.opened_at,
      ...(o.expected_decision_at ? { expectedDecisionAt: o.expected_decision_at } : {}),
      ...(o.closed_at ? { closedAt: o.closed_at } : {}),
      scores: o.scores ?? {},
      ...(o.decision ? { decision: o.decision as "bid" | "no_bid" } : {}),
      ...(o.decision_by ? { decisionBy: o.decision_by } : {}),
      ...(o.decision_note ? { decisionNote: o.decision_note } : {}),
      ...(o.source_enquiry_id ? { sourceEnquiryId: o.source_enquiry_id } : {}),
      ...bidScoreOf(o.scores ?? {}),
    };
  });
};

export const getBidCriteria = () =>
  get<{ key: BidCriterion; label: string; hint: string; inverted?: boolean }[]>("/api/pipeline/bid-criteria");

export const scoreOpportunity = (id: string, scores: Record<string, number>, _actor?: string) =>
  post(`/api/pipeline/${id}/score`, scores);

export const decideOpportunity = (id: string, decision: "bid" | "no_bid", note: string, _actor?: string) =>
  post(`/api/pipeline/${id}/decision`, { decision, note });

export const setOpportunityStage = (id: string, stage: string, _actor?: string) =>
  post(`/api/pipeline/${id}/stage`, { stage });

// ---- BD performance ----
// The real controller's kpi() helper already emits exactly this shape
// (key/label/value/unit/target/direction/source/unavailableReason) — no
// reshaping needed.

export const getBdKpis = () => get<{
  key: string; label: string; value: number | null; unit: string; target?: number;
  direction: "lower_better" | "higher_better"; source: string; unavailableReason?: string;
}[]>("/api/bd-performance");

export const getCrmOwners = async () => {
  const rows = await get<{ id: string; name: string; role: AdminRole }[]>("/api/crm-owners");
  return rows.map((o) => ({ id: o.id, name: o.name, role: o.role, roleLabel: ROLE_LABELS[o.role] }));
};

import { SYSTEM_USERS } from "./admin";

/** CRM domain — the Business Development & Client Services SOP made concrete.
 *
 * The SOP is explicit that this is a known gap: "All enquiries are captured in
 * a controlled lead register **until a CRM is implemented**." That register is
 * `LEADS` in `admin.ts`; everything here is what the SOP assumes sits around
 * it — enquiry intake with a measurable acknowledgement SLA, an interaction
 * history, relationship ownership, commercial segmentation, the institutional
 * Bid/No-Bid pipeline, campaign attribution and the BD KPI set.
 *
 * TWO BOOKS, ONE DOMAIN. The retail book is thousands of self-service
 * contracts from KES 100 where no relationship exists per client — it needs a
 * service desk (enquiries, interactions, tasks, SLAs). The named book (HNWI,
 * institutional, IFA-introduced) is the only part with a pipeline. Both are
 * modelled here; the pipeline deliberately carries far fewer rows because it
 * is the smaller half of the problem, not the headline.
 *
 * TIPPING-OFF (Transaction Monitoring §17, STR §14): interaction notes and
 * enquiry text are written by, and read back to, staff who talk to customers.
 * They must never carry the reason an account is restricted. `complianceOnly`
 * below is the control — a non-Compliance user reads *that* an account is
 * restricted, never *why*. Adding a free-text field that leaks a case reason
 * would be a regulatory breach with a friendlier UI than the last one. */

export type CrmOwnerId = string;

export function ownerName(id: CrmOwnerId): string {
  return SYSTEM_USERS.find((u) => u.id === id)?.name ?? "Unassigned";
}

/** The object `enquiry_ack_days` finally has something to measure. Before
 * this, the SOP's one-business-day acknowledgement standard was a number in
 * Platform Settings with nothing to hold it against. */
export type EnquiryChannel = "app" | "web_form" | "email" | "phone" | "branch" | "ussd" | "ifa";
export type EnquiryCategory =
  | "product_information" | "how_to_invest" | "account_access" | "transaction_query"
  | "statement_request" | "redemption_query" | "ifa_partnership" | "institutional" | "other";
export type EnquiryStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "converted" | "closed";

export const ENQUIRY_CHANNEL_LABELS: Record<EnquiryChannel, string> = {
  app: "Investor app",
  web_form: "Website form",
  email: "Email",
  phone: "Phone",
  branch: "Branch walk-in",
  ussd: "USSD",
  ifa: "IFA",
};

export const ENQUIRY_CATEGORY_LABELS: Record<EnquiryCategory, string> = {
  product_information: "Product information",
  how_to_invest: "How to invest",
  account_access: "Account access",
  transaction_query: "Transaction query",
  statement_request: "Statement request",
  redemption_query: "Redemption query",
  ifa_partnership: "IFA partnership",
  institutional: "Institutional / RFP",
  other: "Other",
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  converted: "Converted",
  closed: "Closed",
};

/** Routing is a rule, not a habit: the SOP requires enquiries be "acknowledged,
 * classified and routed according to client type and issue". Keeping the map
 * as data means Client Services can see *why* something landed where it did. */
export const ENQUIRY_ROUTING: Record<EnquiryCategory, { queue: string; note: string }> = {
  product_information: { queue: "Client Services", note: "First-line answer from published fund copy." },
  how_to_invest: { queue: "Client Services", note: "Self-service walkthrough; convert to a lead if the enquirer wants help." },
  account_access: { queue: "Client Services", note: "Identity re-verification before any access change." },
  transaction_query: { queue: "Operations", note: "Needs the settlement log — Client Services cannot see it." },
  statement_request: { queue: "Client Services", note: "Statements are self-service; resend rather than regenerate." },
  redemption_query: { queue: "Operations", note: "Tier and gate state answer most of these." },
  ifa_partnership: { queue: "Head of BD", note: "IFA onboarding runs its own due-diligence track." },
  institutional: { queue: "Head of BD", note: "Opens a Bid/No-Bid assessment before any commitment." },
  other: { queue: "Client Services", note: "Triage and reclassify — 'other' should stay rare." },
};

export type Enquiry = {
  id: string;
  /** Set when the enquirer is already a client; null for a cold enquiry. */
  clientId: string | null;
  name: string;
  contact: string;
  channel: EnquiryChannel;
  category: EnquiryCategory;
  subject: string;
  body: string;
  status: EnquiryStatus;
  ownerId: CrmOwnerId | null;
  receivedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  /** Set once this enquiry becomes a lead, so conversion is traceable rather
   * than the lead simply appearing from nowhere. */
  convertedLeadId?: string;
  campaignId?: string;
};

/** Business days between two instants. The SLA is stated in business days by
 * the SOP, so counting calendar days would report weekend breaches that are
 * not breaches and let a genuine Friday-to-Tuesday lapse look like one day. */
export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (to <= from) return 0;
  let days = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

export type SlaState = "within" | "due_today" | "breached" | "met" | "met_late";

/** An enquiry that has been acknowledged is judged on what actually happened;
 * one still waiting is judged against now. Collapsing those two into a single
 * "overdue?" boolean loses the difference between a live problem and a
 * historical one, which is the difference between a queue and a report. */
export function acknowledgementSla(enquiry: Enquiry, slaBusinessDays: number, now = new Date().toISOString()): { state: SlaState; elapsed: number } {
  if (enquiry.acknowledgedAt) {
    const elapsed = businessDaysBetween(enquiry.receivedAt, enquiry.acknowledgedAt);
    return { state: elapsed > slaBusinessDays ? "met_late" : "met", elapsed };
  }
  const elapsed = businessDaysBetween(enquiry.receivedAt, now);
  if (elapsed > slaBusinessDays) return { state: "breached", elapsed };
  if (elapsed === slaBusinessDays) return { state: "due_today", elapsed };
  return { state: "within", elapsed };
}

/** The timeline. Every conversation with a lead, client, IFA or institutional
 * counterparty lands here, so "what have we already told this person" has an
 * answer before the next call starts. */
export type InteractionType = "call_inbound" | "call_outbound" | "email" | "meeting" | "note" | "system";
export type InteractionSubject = "lead" | "client" | "enquiry" | "opportunity" | "ifa";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  call_inbound: "Inbound call",
  call_outbound: "Outbound call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  system: "System event",
};

export type Interaction = {
  id: string;
  subjectType: InteractionSubject;
  subjectId: string;
  type: InteractionType;
  summary: string;
  detail?: string;
  outcome?: string;
  /** What happens next, and when. An interaction with no next action on an
   * open relationship is how pipelines go quiet. */
  nextAction?: string;
  nextActionDue?: string;
  byId: CrmOwnerId;
  occurredAt: string;
  /** TIPPING-OFF CONTROL. Set on any interaction whose detail touches a
   * compliance matter. Every non-Compliance role sees the row exists and who
   * handled it, never the body — so a restriction can be worked without the
   * reason reaching a customer-facing screen.
   *
   * Named for the restriction, not for one role: it first applied only to
   * Client Services, which quietly let BD Officers read the same body. The
   * boundary is Compliance, and the flag now says so. */
  complianceOnly?: boolean;
};

export const INTERACTIONS: Interaction[] = [
  { id: "int_1", subjectType: "client", subjectId: "inv_2891", type: "call_inbound", summary: "Reported a double M-Pesa deduction", detail: "Customer calm, has the two M-Pesa messages. Confirmed reference QGH4K2P1M9 and raised it with Operations.", outcome: "Enquiry enq_2 opened, routed to Operations", nextAction: "Call back once Operations confirms the duplicate callback", nextActionDue: "2026-09-03", byId: "u_9", occurredAt: "2026-08-08T08:05:00Z" },
  { id: "int_2", subjectType: "client", subjectId: "inv_2891", type: "email", summary: "Sent July statement on request", byId: "u_9", occurredAt: "2026-08-02T10:12:00Z" },
  { id: "int_3", subjectType: "client", subjectId: "inv_2891", type: "system", summary: "Distribution paid — July 2026", detail: "KES 5,384.12 reinvested.", byId: "u_6", occurredAt: "2026-07-31T18:04:00Z" },
  { id: "int_4", subjectType: "client", subjectId: "inv_3350", type: "note", summary: "Compliance matter — restricted access", detail: "Account restricted pending EDD. Do not discuss the reason with the customer; refer any query to Compliance.", byId: "u_2", occurredAt: "2026-08-08T12:00:00Z", complianceOnly: true },
  { id: "int_5", subjectType: "lead", subjectId: "ld_2", type: "call_outbound", summary: "First contact attempt — no answer", outcome: "Voicemail left", nextAction: "Second attempt", nextActionDue: "2026-09-03", byId: "u_1", occurredAt: "2026-09-01T09:30:00Z" },
  { id: "int_6", subjectType: "lead", subjectId: "ld_3", type: "meeting", summary: "Discovery with IFA-referred prospect", detail: "Objectives: monthly income, 3-year horizon, USD exposure to hedge school fees abroad. Comfortable with a 7-day redemption notice.", outcome: "Matched to the USD Eurobond sub-fund", nextAction: "Send the factsheet and open onboarding", nextActionDue: "2026-09-04", byId: "u_1", occurredAt: "2026-08-29T14:00:00Z" },
  { id: "int_7", subjectType: "opportunity", subjectId: "opp_1", type: "meeting", summary: "Treasury committee introduction", detail: "Committee wants a same-week liquidity answer for at least half the placement. Flagged that KES 40M sits above the same-day tier.", outcome: "Bid/No-Bid assessment opened", nextAction: "Return with a tiered liquidity proposal", nextActionDue: "2026-09-08", byId: "u_10", occurredAt: "2026-08-26T10:00:00Z" },
  { id: "int_8", subjectType: "ifa", subjectId: "ifa_1", type: "call_outbound", summary: "Quarterly channel review", detail: "Referred book up 18% on the quarter. Asked about a co-branded factsheet.", outcome: "Marketing to review co-branding", byId: "u_10", occurredAt: "2026-08-20T11:00:00Z" },
  { id: "int_9", subjectType: "client", subjectId: "inv_3122", type: "call_outbound", summary: "Annual servicing review", detail: "Holding unchanged, happy with monthly payout. Confirmed UK address still current.", outcome: "No change; next review scheduled", nextAction: "Annual review", nextActionDue: "2027-05-03", byId: "u_1", occurredAt: "2026-08-15T13:00:00Z" },
];

/** A non-Compliance viewer sees that a restricted interaction happened and who
 * owns it, never its body. Applied at the seam, not in the component, so a new
 * page cannot forget it.
 *
 * The parameter is the POSITIVE permission and defaults to withholding at every
 * call site, so a caller that forgets to pass it redacts rather than leaks. */
export function visibleInteraction(i: Interaction, canSeeComplianceDetail: boolean): Interaction {
  if (canSeeComplianceDetail || !i.complianceOnly) return i;
  return {
    ...i,
    summary: "Compliance matter — restricted",
    detail: undefined,
    outcome: undefined,
    nextAction: undefined,
    nextActionDue: undefined,
  };
}

export type TaskStatus = "open" | "done" | "cancelled";
export type TaskSource = "manual" | "sla" | "interaction" | "review_cycle";

export const TASK_SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "Created manually",
  sla: "Raised by a service standard",
  interaction: "Follow-up from an interaction",
  review_cycle: "Servicing review cycle",
};

export type CrmTask = {
  id: string;
  title: string;
  detail?: string;
  ownerId: CrmOwnerId;
  dueDate: string;
  status: TaskStatus;
  source: TaskSource;
  subjectType: InteractionSubject | null;
  subjectId: string | null;
  createdAt: string;
  completedAt?: string;
};

export const CRM_TASKS: CrmTask[] = [
  { id: "tsk_1", title: "Call Amina Wanjiru back on the duplicate deduction", ownerId: "u_9", dueDate: "2026-09-03", status: "open", source: "interaction", subjectType: "client", subjectId: "inv_2891", createdAt: "2026-08-08T08:10:00Z" },
  { id: "tsk_2", title: "Second contact attempt — Felix Ndungu", ownerId: "u_1", dueDate: "2026-09-03", status: "open", source: "interaction", subjectType: "lead", subjectId: "ld_2", createdAt: "2026-09-01T09:35:00Z" },
  { id: "tsk_3", title: "Send USD factsheet to Grace Wairimu and open onboarding", ownerId: "u_1", dueDate: "2026-09-04", status: "open", source: "interaction", subjectType: "lead", subjectId: "ld_3", createdAt: "2026-08-29T14:30:00Z" },
  { id: "tsk_4", title: "Acknowledge enquiry from Wanjiku Njeri", detail: "USSD PIN lockout — unacknowledged and inside the one-business-day standard.", ownerId: "u_9", dueDate: "2026-09-03", status: "open", source: "sla", subjectType: "enquiry", subjectId: "enq_7", createdAt: "2026-09-02T06:10:00Z" },
  { id: "tsk_5", title: "Tiered liquidity proposal for Kilimo SACCO", ownerId: "u_10", dueDate: "2026-09-08", status: "open", source: "interaction", subjectType: "opportunity", subjectId: "opp_1", createdAt: "2026-08-26T10:30:00Z" },
  // Overdue, on purpose — a task board where nothing is ever late has not been
  // tested against the state that actually matters.
  { id: "tsk_6", title: "Chase Josphat Kariuki — deceased-estate statement request", detail: "Needs a grant of probate before anything is released.", ownerId: "u_9", dueDate: "2026-08-27", status: "open", source: "sla", subjectType: "enquiry", subjectId: "enq_6", createdAt: "2026-08-25T09:15:00Z" },
  { id: "tsk_7", title: "Annual servicing review — Cynthia Njeri", ownerId: "u_1", dueDate: "2027-05-03", status: "open", source: "review_cycle", subjectType: "client", subjectId: "inv_3122", createdAt: "2026-08-15T13:30:00Z" },
  { id: "tsk_8", title: "Send fund factsheet to Mercy Adhiambo", ownerId: "u_9", dueDate: "2026-08-28", status: "done", source: "manual", subjectType: "enquiry", subjectId: "enq_3", createdAt: "2026-08-28T09:25:00Z", completedAt: "2026-08-28T09:47:00Z" },
];

/** Deliberately the same shape as `classifiers.ts`: a window with a validity
 * range, closed and reopened rather than overwritten. "Who covered this client
 * in June, and why did it move" is the same class of question as "what was
 * their risk tier", and a handover that erases its predecessor is the same
 * bug. Kept in this file rather than added to the compliance classifiers
 * because coverage and commercial segment are BD facts, not AML ones. */
export type DatedAssignment<T extends string> = {
  id: string;
  clientId: string;
  value: T;
  validFrom: string;
  validTo: string | null;
  assignedBy: string;
  reason?: string;
  previousValue?: T;
};

/** Commercial segment — a different axis from the risk band already on the
 * client file. A Low-risk customer can be institutional; a High-risk one can
 * be mass retail. Conflating them is how a book gets serviced by its AML
 * rating. */
export type CommercialSegment = "mass_retail" | "mass_affluent" | "hnwi" | "institutional" | "ifa_introduced";

export const SEGMENT_LABELS: Record<CommercialSegment, string> = {
  mass_retail: "Mass retail",
  mass_affluent: "Mass affluent",
  hnwi: "HNWI",
  institutional: "Institutional",
  ifa_introduced: "IFA-introduced",
};

/** Servicing expectations per segment. The SOP requires ongoing servicing but
 * fixes no cadence; these are indicative and BO-editable in a real build —
 * flagged rather than presented as Investcent policy. */
export const SEGMENT_SERVICE_MODEL: Record<CommercialSegment, { coverage: string; reviewMonths: number | null }> = {
  mass_retail: { coverage: "Self-service, pooled Client Services queue — no named owner", reviewMonths: null },
  mass_affluent: { coverage: "Pooled queue with a named BD Officer for escalations", reviewMonths: 12 },
  hnwi: { coverage: "Named Relationship Manager", reviewMonths: 6 },
  institutional: { coverage: "Named RM plus Head of BD oversight", reviewMonths: 3 },
  ifa_introduced: { coverage: "Serviced through the introducing advisor, with direct escalation", reviewMonths: 12 },
};

let assignSeq = 1;
function dated<T extends string>(clientId: string, value: T, validFrom: string, validTo: string | null, assignedBy: string, reason?: string, previousValue?: T): DatedAssignment<T> {
  return { id: `CRMA-${String(assignSeq++).padStart(4, "0")}`, clientId, value, validFrom, validTo, assignedBy, ...(reason ? { reason } : {}), ...(previousValue ? { previousValue } : {}) };
}

export const COVERAGE_ASSIGNMENTS: DatedAssignment<CrmOwnerId>[] = [
  dated("inv_2891", "u_1", "2026-03-14", null, "System (Onboarding)", "Default BD coverage on activation."),
  dated("inv_3122", "u_1", "2026-05-03", "2026-07-01", "Faith Kamau", "IFA-introduced; BD covers the direct relationship."),
  dated("inv_3122", "u_1", "2026-07-01", null, "Faith Kamau", "Retained after the mid-year book review.", "u_1"),
  dated("inv_2601", "u_9", "2026-02-11", null, "System (Onboarding)", "Mass retail — pooled Client Services queue."),
  dated("inv_3350", "u_9", "2026-08-06", null, "System (Onboarding)", "Mass retail — pooled Client Services queue."),
];

export const SEGMENT_ASSIGNMENTS: DatedAssignment<CommercialSegment>[] = [
  dated("inv_2891", "mass_affluent", "2026-03-14", "2026-06-20", "System (Onboarding)", "Initial segment from declared investment amount."),
  dated("inv_2891", "hnwi", "2026-06-20", null, "Faith Kamau", "Crossed the HNWI threshold after the June top-up.", "mass_affluent"),
  dated("inv_3122", "ifa_introduced", "2026-05-03", null, "Faith Kamau", "Referred by Kevin Mutuku."),
  dated("inv_2601", "mass_retail", "2026-02-11", null, "System (Onboarding)"),
  dated("inv_3350", "mass_retail", "2026-08-06", null, "System (Onboarding)"),
  dated("inv_2765", "mass_retail", "2026-08-05", null, "System (Onboarding)"),
];

function assignmentAsOf<T extends string>(rows: DatedAssignment<T>[], clientId: string, asOf: string): DatedAssignment<T> | undefined {
  return rows.find((a) => a.clientId === clientId && a.validFrom <= asOf && (a.validTo === null || a.validTo > asOf));
}

export function coverageAsOf(clientId: string, asOf = new Date().toISOString().slice(0, 10)) {
  return assignmentAsOf(COVERAGE_ASSIGNMENTS, clientId, asOf);
}

export function segmentAsOf(clientId: string, asOf = new Date().toISOString().slice(0, 10)) {
  return assignmentAsOf(SEGMENT_ASSIGNMENTS, clientId, asOf);
}

export function coverageHistory(clientId: string) {
  return [...COVERAGE_ASSIGNMENTS.filter((a) => a.clientId === clientId)].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}

export function segmentHistory(clientId: string) {
  return [...SEGMENT_ASSIGNMENTS.filter((a) => a.clientId === clientId)].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}

/** The SOP's Bid/No-Bid framework, verbatim on its seven criteria: "strategic
 * fit, capability, profitability, operational complexity, compliance, win
 * probability and reputation". Scored 1–5 each. */
export type BidCriterion =
  | "strategic_fit" | "capability" | "profitability" | "operational_complexity"
  | "compliance" | "win_probability" | "reputation";

export const BID_CRITERIA: { key: BidCriterion; label: string; hint: string; inverted?: boolean }[] = [
  { key: "strategic_fit", label: "Strategic fit", hint: "Does this counterparty and mandate fit where the fund is going?" },
  { key: "capability", label: "Capability", hint: "Can we actually deliver what is being asked, today?" },
  { key: "profitability", label: "Profitability", hint: "Margin after the servicing this segment demands." },
  { key: "operational_complexity", label: "Operational complexity", hint: "Scored inverted — 5 means simple, 1 means it will consume Operations.", inverted: true },
  { key: "compliance", label: "Compliance", hint: "KYB burden, jurisdiction, UBO chain, screening load." },
  { key: "win_probability", label: "Win probability", hint: "Honest read, not the optimistic one." },
  { key: "reputation", label: "Reputation", hint: "What association with this name does to the franchise." },
];

export type OpportunityStage = "qualifying" | "bid_no_bid" | "proposal" | "negotiation" | "won" | "lost" | "no_bid";

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  qualifying: "Qualifying",
  bid_no_bid: "Bid / No-Bid",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  no_bid: "No-bid (declined)",
};

export type ServiceReview = {
  id: string;
  clientId: string;
  dueDate: string;
  completedAt?: string;
  ownerId: CrmOwnerId;
  note?: string;
};

export const SERVICE_REVIEWS: ServiceReview[] = [
  { id: "svr_1", clientId: "inv_3122", dueDate: "2027-05-03", ownerId: "u_1", note: "Annual — IFA-introduced." },
  { id: "svr_2", clientId: "inv_2891", dueDate: "2026-12-20", ownerId: "u_1", note: "Six-monthly since the HNWI reclassification." },
  { id: "svr_3", clientId: "inv_2601", dueDate: "2026-08-11", ownerId: "u_9", note: "Mass retail — no named review; raised only because the account went quiet." },
];

export function interactionsFor(subjectType: InteractionSubject, subjectId: string) {
  return INTERACTIONS
    .filter((i) => i.subjectType === subjectType && i.subjectId === subjectId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

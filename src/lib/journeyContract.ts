/* The KTDA farmer journey: register, activate (a wallet opens), fund.

   PROPOSED, NOT AGREED. Omnichannel today has two bulk flows, ONBOARDING (the
   farmer, the KES wallet and a login in one step) and PAYMENT, and no farmers
   endpoint. Everything this back office assumes about the rest lives in this
   file (flow names, CSV columns, gates, endpoint paths and shapes), so the
   change is small when the real contract is confirmed. See
   docs/ktda/ktda-journeys-implementation-notes.md for the backend's notes.

   The lifecycle:
     REGISTERED  the farmer record only (grower number, name, phone, factory):
                 no wallet, no PIN. In real life the farmer then finishes
                 onboarding in the app or on the web.
     ACTIVATED   onboarding finished and the KES wallet open. In the demo a
                 CSV stands in for the farmers' own onboarding.
     FUNDED      the wallet has been credited at least once. */

/** The bulk-loads flow values: today's two and the two proposed. */
export type BulkFlow = "ONBOARDING" | "REGISTRATION" | "ACTIVATION" | "PAYMENT";

/** The CSV header each flow takes. ONBOARDING and PAYMENT are live; the
 *  other two are proposals to confirm. */
export const BULK_COLUMNS: Record<BulkFlow, string[]> = {
  ONBOARDING: ["grower_no", "national_id", "full_name", "msisdn"],
  REGISTRATION: ["grower_no", "full_name", "msisdn", "factory"],
  ACTIVATION: ["grower_no", "national_id", "date_of_birth", "id_document_ref"],
  PAYMENT: ["grower_no", "amount_kes", "payment_ref"],
};

/** Flows omnichannel does not have yet: an upload of one answers "not
 *  available on this environment yet", never falls back to ONBOARDING. */
export const PROPOSED_FLOWS: ReadonlySet<BulkFlow> = new Set(["REGISTRATION", "ACTIVATION"]);

/** Which flow's completed run opens which. PAYMENT's gate is omnichannel's own
 *  answer (GET /bulk-loads/onboarding-status); under the proposal it turns
 *  true once an ACTIVATION run has completed, and today once an ONBOARDING
 *  run has. ACTIVATION has no such endpoint, so the page reads it from the
 *  recent runs; omnichannel refuses the upload (409) either way. */
export const OPENED_BY: Partial<Record<BulkFlow, BulkFlow>> = {
  ACTIVATION: "REGISTRATION",
  PAYMENT: "ACTIVATION",
};

/** The three steps, in order, as the demo walks them. */
export type JourneyStep = {
  n: 1 | 2 | 3;
  flow: BulkFlow;
  title: string;
  /** Where the step's upload page is. */
  to: string;
  /** What one processed row means for this step. */
  processed: string;
  /** One line on what the step does, for the overview. */
  does: string;
};

export const JOURNEY: JourneyStep[] = [
  {
    n: 1, flow: "REGISTRATION", title: "Register farmers", to: "/journey/register", processed: "Farmers registered",
    does: "Creates each farmer's record from their grower number and basic details. No wallet and no PIN yet.",
  },
  {
    n: 2, flow: "ACTIVATION", title: "Farmer onboarding (simulated)", to: "/journey/activate", processed: "Wallets opened",
    does: "Stands in for the farmers finishing onboarding themselves in the app or on the web. Opens each farmer's KES wallet.",
  },
  {
    n: 3, flow: "PAYMENT", title: "Fund wallets", to: "/bulk/payments", processed: "Wallets credited",
    does: "Credits the farmers' wallets. Each payment_ref is applied once, so a file is safe to send again.",
  },
];

export const stepFor = (flow: BulkFlow) => JOURNEY.find((s) => s.flow === flow) ?? null;

/* ---- Farmers (proposed omnichannel endpoints, scoped to the institution) ---- */

export type FarmerState = "REGISTERED" | "ACTIVATED" | "FUNDED";
export const FARMER_STATES: FarmerState[] = ["REGISTERED", "ACTIVATED", "FUNDED"];
export const STATE_LABEL: Record<FarmerState, string> = {
  REGISTERED: "Registered",
  ACTIVATED: "Activated",
  FUNDED: "Funded",
};
export const STATE_MEANS: Record<FarmerState, string> = {
  REGISTERED: "Has a record, still has to onboard: no wallet yet",
  ACTIVATED: "Onboarded, wallet open, not paid yet",
  FUNDED: "Wallet credited at least once",
};

export type Farmer = {
  growerNo: string;
  fullName: string | null;
  phone: string | null;
  factory: string | null;
  state: FarmerState;
  registeredAt: string | null;
  activatedAt: string | null;
  lastFundedAt: string | null;
};

/** GET /farmers?state=&q=&page=&size= : one page, and the institution's
 *  counts per state (over every farmer, not just this page). */
export type FarmersPage = {
  items: Farmer[];
  page: number;
  size: number;
  total: number;
  counts: Record<FarmerState, number>;
};

/** POST /farmers: one farmer, the record only. Idempotent on growerNo; 409
 *  when that grower exists with a different identity. */
export type RegisterFarmer = { growerNo: string; nationalId: string; fullName: string; phone: string; factory: string };
export type RegisteredFarmer = { growerNo: string; status: "REGISTERED" };

export const FARMERS_PATH = "/farmers";

/* ---- Not built yet ---- */

/** What the page says when this environment's omnichannel has no such flow
 *  or endpoint. */
export const NOT_AVAILABLE = "Not available on this environment yet: omnichannel here does not have this step. The demo needs the backend change described in the KTDA journeys notes.";

/** Whether a failed call means "this environment does not have it": an
 *  unknown path or method (404, 405, 501), or today's answer to an unknown
 *  flow value (400 "Parameter 'flow' must be a valid BulkFlow"). */
export function notBuiltYet(status: number, message: string | null | undefined): boolean {
  if (status === 404 || status === 405 || status === 501) return true;
  return status === 400 && /parameter 'flow'|bulkflow/i.test(message ?? "");
}

/* ---- Template and samples ---- */

/** A header-only CSV for the flow. */
export const templateCsv = (flow: BulkFlow) => `${BULK_COLUMNS[flow].join(",")}\n`;

export const templateName = (flow: BulkFlow) => `ktda-${flow.toLowerCase()}-template.csv`;

/** Five test farmers, the same growers through all three steps (public/demo). */
export const SAMPLE_FILES: Partial<Record<BulkFlow, string>> = {
  REGISTRATION: "demo/ktda-journey/1-register.csv",
  ACTIVATION: "demo/ktda-journey/2-activate.csv",
  PAYMENT: "demo/ktda-journey/3-fund.csv",
};

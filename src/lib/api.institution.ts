/* This back office's institution, as omnichannel knows it. Omnichannel scopes
   every operator call to one institution, which the proxy in front of it sets
   from configuration (OMNI_INSTITUTION_ID); these reads answer for that one
   only, so the browser never names it. */

import { omniCall } from "./omniApi";

/** An institution as omnichannel knows it. `name` and the rest are null for
 *  an institution omnichannel has not loaded a file for yet. */
export type OmniInstitution = {
  id: string;
  name: string | null;
  localCurrency: string | null;
  country: string | null;
  status: string | null;
};

/** What an institution's customers may use. */
export type InstitutionFeature = "INVESTING" | "FX" | "TRANSFERS" | "WITHDRAWALS" | "TOP_UPS";
export const ALL_FEATURES: InstitutionFeature[] = ["TRANSFERS", "WITHDRAWALS", "TOP_UPS", "INVESTING", "FX"];

/** The institution's settings: its features, and every value it carries over
 *  the platform defaults, by name ("sms.sender", "withdrawals.kes.per-day").
 *  An amount may be "none", meaning no limit. Read-only: changing one is not
 *  offered yet. */
export type InstitutionSettings = {
  institutionId: string;
  features: InstitutionFeature[];
  set: Record<string, string>;
};

export const institutionApi = {
  /** Omnichannel lists only the caller's own: exactly one entry. */
  own: () => omniCall.get<OmniInstitution[]>("/institutions"),
  settings: () => omniCall.get<InstitutionSettings>("/institution/settings"),
};

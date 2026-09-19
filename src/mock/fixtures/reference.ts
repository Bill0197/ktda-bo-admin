/** Reference data used by onboarding.
 *
 * Nationality and country of residence are mandatory screening identifiers —
 * the Screening Policy §9.1 requires name, date of birth, nationality and
 * country of residence for an individual, because a name alone cannot clear a
 * fuzzy sanctions match. Capturing them as free text would defeat that, so
 * both are selected from this controlled list.
 *
 * `higherRisk` marks jurisdictions that carry additional monitoring under
 * Kenyan law (FATF-listed, or listed by the Cabinet Secretary / FRC). It is a
 * placeholder set: the live list changes at FATF plenary and must be
 * BO-Admin-managed and version-controlled before production (System
 * Requirements CR-027, Screening §7). Do not treat this array as authoritative. */

export type Gender = "female" | "male" | "other" | "undisclosed";

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

export function genderLabel(value: string): string {
  return GENDERS.find((g) => g.value === value)?.label ?? value;
}

/** Employment basis — the first of the three profile questions asked after the
 * account is created. */
export type EmploymentType = "employed" | "self_employed";

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
];

export function employmentTypeLabel(value: string): string {
  return EMPLOYMENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

/** Monthly income bands, KES. Bands rather than an exact figure: the value is
 * used for expected-activity profiling (Transaction Monitoring §6), which
 * works on ranges, and a band is far likelier to be answered honestly. */
export const INCOME_RANGES: { value: string; label: string }[] = [
  { value: "under_50k", label: "Under KES 50,000" },
  { value: "50k_150k", label: "KES 50,000 – 150,000" },
  { value: "150k_300k", label: "KES 150,000 – 300,000" },
  { value: "300k_1m", label: "KES 300,000 – 1,000,000" },
  { value: "over_1m", label: "Over KES 1,000,000" },
];

export function incomeRangeLabel(value: string): string {
  return INCOME_RANGES.find((r) => r.value === value)?.label ?? value;
}

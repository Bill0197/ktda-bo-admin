import { employmentTypeLabel, genderLabel, incomeRangeLabel, type ClientRow } from "../mock";
import type { ReactNode } from "react";

/** The personal-details rows shown on a client file.
 *
 * One definition, three consumers (Client detail, KYC onboarding review, KYC
 * periodic review) — they were drifting apart field by field, and a reviewer
 * comparing two screens of the same person should not see two different sets
 * of facts.
 *
 * Country of residence is deliberately absent: it is no longer collected. The
 * product is Kenya-only, so it duplicated nationality for effectively every
 * applicant and the screening call now supplies it internally.
 */
export function identityRows(client: ClientRow, formatDate: (d: string) => string): { label: string; value: ReactNode }[] {
  return [
    { label: "Full name", value: fullName(client) },
    { label: "Date of birth", value: formatDate(client.dateOfBirth) },
    { label: "Gender", value: client.gender ? genderLabel(client.gender) : "—" },
    { label: "City / town", value: client.city ?? "—" },
    { label: "Nationality", value: client.nationality },
    { label: "ID / passport no.", value: client.idNumber ?? "—" },
  ];
}

/** The three post-signup profile answers.
 *
 * Rendered as "Not provided yet" rather than "—" when absent: these are asked
 * *after* activation now, so a blank is an expected in-progress state on a new
 * client file, not missing data a reviewer should chase. They feed the
 * expected-activity profile transaction monitoring compares against (TM §6),
 * so a file that stays blank is worth noticing.
 */
export function profileRows(client: ClientRow): { label: string; value: ReactNode }[] {
  const pending = <span className="text-text-faint">Not provided yet</span>;
  return [
    { label: "Occupation", value: client.employmentType ? employmentTypeLabel(client.employmentType) : pending },
    { label: "Industry", value: client.industry ?? pending },
    { label: "Income range", value: client.incomeRange ? incomeRangeLabel(client.incomeRange) : pending },
  ];
}

/** Full legal name, with the middle name where one is on file. */
export function fullName(client: ClientRow): string {
  const [first, ...rest] = client.name.split(" ");
  if (!client.middleName) return client.name;
  return [first, client.middleName, ...rest].join(" ");
}

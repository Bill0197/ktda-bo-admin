import { staffName } from "../omniApi";

/* Words for the customer interventions (BRD FR-ADM-03): reinstating or
 * closing a customer, proposed by one staff member and approved by another. */

export const INTERVENTION_LABEL: Record<string, string> = { REINSTATE: "Reinstate", CLOSE: "Close profile" };

/** A recorded subject as a person reads it, "You" for the one signed in
 *  (`me` is the subject omnichannel records for them, see omniSubjectFor). */
export const whoIs = (subject: string | null | undefined, me: string) =>
  subject && subject === me ? `You (${staffName(subject)})` : staffName(subject);

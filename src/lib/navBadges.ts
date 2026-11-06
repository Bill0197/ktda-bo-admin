import { useEffect, useState } from "react";
import { getApprovalQueue, getClients, getFraudAlerts } from "./api";
import { approverRolesFor } from "../mock";
import { useAuth, ADMIN_USERS } from "./auth";

/* The counts beside menu entries, each read from the same source as the page
   it sits beside, so the badge and the page always agree:
   - Approvals: pending items the signed-in user may decide (not their own
     request, and within the roles the approval routing allows).
   - Onboarding review: sign-ups waiting for review.
   - Fraud alerts: alerts still open.
   A source that fails just shows no badge. */
export function useNavBadges(): Record<string, number> {
  const { role } = useAuth();
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    const me = role ? ADMIN_USERS[role]?.name ?? "" : "";
    const count = <T,>(load: () => Promise<T[]>, keep: (x: T) => boolean) =>
      load().then((rows) => rows.filter(keep).length).catch(() => 0);

    Promise.all([
      count(getApprovalQueue, (a) => {
        if (a.status !== "pending" || (me && a.proposedBy.includes(me))) return false;
        const roles = approverRolesFor(a);
        return !roles || !role || roles.includes(role);
      }),
      count(getClients, (c) => c.kycStatus === "pending_review"),
      count(getFraudAlerts, (f) => f.status === "open"),
    ]).then(([approvals, onboarding, fraud]) => {
      if (live) setBadges({ "/approvals": approvals, "/kyc-queue": onboarding, "/fraud-alerts": fraud });
    });
    return () => { live = false; };
  }, [role]);

  return badges;
}

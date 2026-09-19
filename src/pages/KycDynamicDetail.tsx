import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LIFECYCLE_LABELS, CASE_TYPE_LABELS, CASE_STATUS_LABELS, type RiskRating } from "../mock";
import { getClientComplianceDetail, runScreening } from "../lib/api";
import { PageHeader, Card, Badge, Button, Skeleton, EmptyState, useToast, formatDateTime } from "../ui";
import { ArrowLeft, Activity, PlayCircle } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

/** Dynamic-review workspace — why this client was flagged and the linked
 * alerts/cases driving it. Distinct from the full client 360. */
export default function KycDynamicDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useAsyncData(() => getClientComplianceDetail(id ?? ""));
  const [busy, setBusy] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-72 mb-6" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={<Activity size={20} />}
          title="Client not found"
          body={error ?? "The link may be stale."}
          action={<Link to="/kyc-dynamic" className="text-sm text-primary-600 font-medium">Back to Dynamic Review</Link>}
        />
      </Card>
    );
  }

  const { client, profile, alerts, cases } = data;
  const openAlerts = alerts.filter((a) => a.status === "open" || a.status === "under_review");
  const activeCases = cases.filter((c) => c.status !== "closed_cleared" && c.status !== "closed_reported");
  const triggers: string[] = [
    ...(openAlerts.length ? [`${openAlerts.length} open monitoring alert${openAlerts.length === 1 ? "" : "s"}`] : []),
    ...(activeCases.length ? [`${activeCases.length} active case${activeCases.length === 1 ? "" : "s"}`] : []),
    ...(profile.eddRequired && !profile.eddCompletedAt ? ["EDD outstanding"] : []),
    ...(profile.lifecycleStatus === "suspended" ? ["Account suspended"] : []),
    ...(profile.riskRating === "high" ? ["High risk band"] : []),
  ];

  const screen = async () => {
    setBusy(true);
    try {
      await runScreening(client.id, "on_demand", me);
      toast.push("Screening complete", "success");
      await reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Screening failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/kyc-dynamic" className="inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text mb-4">
        <ArrowLeft size={15} /> Dynamic Review
      </Link>

      <PageHeader
        eyebrow="KYC Review"
        title={client.name}
        subtitle="Event-driven review — this client's risk picture changed."
        actions={
          <div className="flex items-center gap-2">
            {profile.riskRating && <Badge tone={RISK_TONE[profile.riskRating]}>{profile.riskRating} risk</Badge>}
            <Badge tone="neutral">{LIFECYCLE_LABELS[profile.lifecycleStatus]}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-3">Review triggers</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {triggers.length ? triggers.map((t) => <Badge key={t} tone="warning">{t}</Badge>) : <span className="text-sm text-text-faint">No active triggers — this review can be closed.</span>}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Monitoring alerts</div>
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text">{a.rule}</span>
                    <p className="text-xs text-text-soft truncate">{a.detail}</p>
                  </div>
                  <Badge tone={a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info"}>{a.severity}</Badge>
                  <Badge tone="neutral">{a.status.replace("_", " ")}</Badge>
                </li>
              ))}
              {alerts.length === 0 && <li className="px-5 py-6 text-sm text-text-faint text-center">No alerts.</li>}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Cases</div>
            <ul className="divide-y divide-border">
              {cases.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <Link to={`/cases/${c.id}`} className="flex items-center gap-3 group">
                    <Badge tone={c.type === "sar" ? "danger" : "info"}>{CASE_TYPE_LABELS[c.type]}</Badge>
                    <span className="text-sm text-text group-hover:text-primary-600 flex-1 truncate">{c.title}</span>
                    <Badge tone="neutral">{CASE_STATUS_LABELS[c.status]}</Badge>
                  </Link>
                </li>
              ))}
              {cases.length === 0 && <li className="px-5 py-6 text-sm text-text-faint text-center">No cases.</li>}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-1">Review actions</h2>
            <p className="text-xs text-text-soft mb-4">
              Last screened {profile.lastScreenedAt ? formatDateTime(profile.lastScreenedAt) : "never"}. Risk-rating changes,
              EDD and wallet controls live on the full client file.
            </p>
            <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={screen}>
              <PlayCircle size={14} /> {busy ? "Screening…" : "Run screening now"}
            </Button>
          </Card>
          <Link to={`/clients/${client.id}`} className="text-sm text-primary-600 font-medium text-center">Open full client file →</Link>
        </div>
      </div>
    </div>
  );
}

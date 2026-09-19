import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { KYC_STATUS_LABELS, DOCUMENT_TYPE_LABELS, type RiskRating } from "../mock";
import { getClientComplianceDetail, markKycRefreshed, runScreening } from "../lib/api";
import { PageHeader, Card, Badge, Button, KeyValue, Skeleton, EmptyState, useToast, formatDate, formatDateTime } from "../ui";
import { ArrowLeft, CalendarCheck2, PlayCircle } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";
import { identityRows, profileRows } from "../lib/clientProfile";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

/** Periodic-review workspace — confirm the client's KYC is still current and
 * restamp the refresh cycle. Distinct from the full client 360. */
export default function KycPeriodicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useAsyncData(() => getClientComplianceDetail(id ?? ""));
  const [busy, setBusy] = useState<string | null>(null);

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
          icon={<CalendarCheck2 size={20} />}
          title="Client not found"
          body={error ?? "The link may be stale."}
          action={<Link to="/kyc-periodic" className="text-sm text-primary-600 font-medium">Back to Periodic Review</Link>}
        />
      </Card>
    );
  }

  const { client, profile, documents, screenings } = data;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!profile.nextKycRefreshDue && profile.nextKycRefreshDue < today;
  const latestScreening = screenings[0];

  const complete = async () => {
    setBusy("refresh");
    try {
      await markKycRefreshed(client.id, me, "Periodic review — documents and profile re-confirmed.");
      toast.push(`${client.name}'s periodic KYC review recorded`, "success");
      navigate("/kyc-periodic");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not record the review", "error");
      setBusy(null);
    }
  };

  const screen = async () => {
    setBusy("screen");
    try {
      await runScreening(client.id, "on_demand", me);
      toast.push("Screening complete", "success");
      await reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Screening failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link to="/kyc-periodic" className="inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text mb-4">
        <ArrowLeft size={15} /> KYC Periodic Review
      </Link>

      <PageHeader
        eyebrow="KYC Review"
        title={client.name}
        subtitle="Scheduled re-verification — confirm the profile, documents and screening are still current."
        actions={
          <div className="flex items-center gap-2">
            {profile.riskRating && <Badge tone={RISK_TONE[profile.riskRating]}>{profile.riskRating} risk</Badge>}
            {overdue ? <Badge tone="danger">overdue</Badge> : <Badge tone="neutral">scheduled</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Refresh status</h2>
            <KeyValue
              rows={[
                { label: "KYC status", value: KYC_STATUS_LABELS[client.kycStatus] ?? client.kycStatus },
                { label: "Last refresh", value: profile.lastKycRefreshAt ? formatDateTime(profile.lastKycRefreshAt) : "Never" },
                { label: "Next due", value: profile.nextKycRefreshDue ?? "Not scheduled" },
                { label: "Last screened", value: profile.lastScreenedAt ? formatDateTime(profile.lastScreenedAt) : "Never" },
                { label: "Risk factors", value: profile.riskFactors.length ? profile.riskFactors.join("; ") : "None recorded" },
              ]}
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Profile on record</h2>
            <KeyValue
              rows={[
                ...identityRows(client, formatDate),
                ...profileRows(client),
                { label: "Email / phone", value: `${client.email} · ${client.phone}` },
              ]}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Documents on file</div>
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-sm text-text flex-1">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                  <Badge tone={d.status === "verified" ? "success" : d.status === "rejected" || d.status === "expired" ? "danger" : "info"}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-1">Complete this review</h2>
            <p className="text-xs text-text-soft mb-4">
              Confirms KYC and tax details were re-verified; the next review is scheduled from the configured cadence.
              {latestScreening && latestScreening.runAt.slice(0, 10) !== today ? " Consider a fresh screening first." : ""}
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={screen}>
                <PlayCircle size={14} /> {busy === "screen" ? "Screening…" : "Run screening"}
              </Button>
              <Button size="sm" disabled={busy !== null} onClick={complete}>
                <CalendarCheck2 size={14} /> {busy === "refresh" ? "Recording…" : "Mark review complete"}
              </Button>
            </div>
          </Card>
          <Link to={`/clients/${client.id}`} className="text-sm text-primary-600 font-medium text-center">Open full client file →</Link>
        </div>
      </div>
    </div>
  );
}

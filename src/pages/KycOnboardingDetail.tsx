import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DOCUMENT_TYPE_LABELS, KYC_STATUS_LABELS,
} from "../mock";
import { getClientComplianceDetail, decideKycApplication, setDocumentStatus, setUboStatus, submitActivation, getActivationBlockers } from "../lib/api";
import { PageHeader, Card, Badge, Button, KeyValue, Skeleton, EmptyState, useToast, formatDate, formatDateTime } from "../ui";
import { ArrowLeft, ShieldCheck, Undo2, FileCheck2 } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";
import { identityRows, profileRows } from "../lib/clientProfile";

const DOC_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  verified: "success", submitted: "info", missing: "warning", rejected: "danger", expired: "danger",
};
const SCREEN_TONE = (v: string): "success" | "warning" | "danger" => (v === "clear" ? "success" : v === "potential_match" ? "warning" : "danger");

/** Focused onboarding-review workspace — everything needed to decide ONE
 * application, distinct from the full client 360 at /clients/:id. */
export default function KycOnboardingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useAuth();
  const { data, loading, error, reload } = useAsyncData(() => getClientComplianceDetail(id ?? ""));
  // activationBlockers used to be a synchronous, fixture-derived helper —
  // the real backend only exposes it as its own endpoint, so it's fetched
  // alongside the client detail rather than computed inline at render time.
  const { data: blockersData, loading: blockersLoading, reload: reloadBlockers } = useAsyncData(() => getActivationBlockers(id ?? ""));
  const [busy, setBusy] = useState<string | null>(null);

  const me = role ? ADMIN_USERS[role].name : "";

  const act = async (key: string, fn: () => Promise<unknown>, success: string, thenBack = false) => {
    setBusy(key);
    try {
      await fn();
      toast.push(success, "success");
      if (thenBack) navigate("/kyc-queue");
      else {
        await reload();
        await reloadBlockers();
      }
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-72 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={<FileCheck2 size={20} />}
          title="Application not found"
          body={error ?? "It may have been decided already, or the link is stale."}
          action={<Link to="/kyc-queue" className="text-sm text-primary-600 font-medium">Back to KYC Onboarding</Link>}
        />
      </Card>
    );
  }

  const { client, profile, documents, ubos, screenings } = data;
  const latestScreening = screenings[0];
  const blockers = blockersData ?? [];
  // A control that can't yet be read withholds access rather than defaulting
  // to a pass — don't treat "still loading" the same as "no blockers".
  const eligible = !blockersLoading && blockers.length === 0;

  return (
    <div>
      <Link to="/kyc-queue" className="inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text mb-4">
        <ArrowLeft size={15} /> KYC Onboarding
      </Link>

      <PageHeader
        eyebrow="KYC Review"
        title={client.name}
        subtitle={`Application via ${client.channel} — submitted ${formatDate(client.joinedAt)}.`}
        actions={<Badge tone="info">{KYC_STATUS_LABELS[client.kycStatus] ?? client.kycStatus}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Applicant</h2>
            <KeyValue
              rows={[
                { label: "Investor ID", value: <span className="tabular">{client.id}</span> },
                ...identityRows(client, formatDate),
                { label: "Email / phone", value: `${client.email} · ${client.phone}` },
                ...profileRows(client),
              ]}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Documents</div>
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                      <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
                    </div>
                    {d.note && <p className="text-[11px] text-text-faint mt-1">{d.note}</p>}
                  </div>
                  {d.status === "submitted" && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => act(d.id, () => setDocumentStatus(d.id, "rejected", me), "Document rejected")}>Reject</Button>
                      <Button size="sm" disabled={busy === d.id} onClick={() => act(d.id, () => setDocumentStatus(d.id, "verified", me), "Document verified")}>Verify</Button>
                    </div>
                  )}
                </li>
              ))}
              {documents.length === 0 && <li className="px-5 py-6 text-sm text-text-faint text-center">No documents submitted yet.</li>}
            </ul>
          </Card>

          {ubos.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Identity & UBO</div>
              <ul className="divide-y divide-border">
                {ubos.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text">{u.name}</span>
                      <p className="text-xs text-text-soft">{u.relationship}{u.ownershipPct != null ? ` · ${u.ownershipPct}%` : ""}</p>
                    </div>
                    <Badge tone={u.status === "verified" ? "success" : u.status === "flagged" ? "danger" : "warning"}>{u.status}</Badge>
                    {u.status !== "verified" && (
                      <Button size="sm" disabled={busy === u.id} onClick={() => act(u.id, () => setUboStatus(u.id, "verified", me), "UBO verified")}>Verify</Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-text mb-3">Latest screening</h2>
            {latestScreening ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={SCREEN_TONE(latestScreening.sanctions)}>sanctions {latestScreening.sanctions.replace("_", " ")}</Badge>
                <Badge tone={SCREEN_TONE(latestScreening.pep)}>PEP {latestScreening.pep.replace("_", " ")}</Badge>
                <Badge tone={SCREEN_TONE(latestScreening.adverseMedia)}>media {latestScreening.adverseMedia.replace("_", " ")}</Badge>
                <span className="text-xs text-text-faint">{formatDateTime(latestScreening.runAt)} · {latestScreening.runBy}</span>
              </div>
            ) : (
              <p className="text-sm text-text-faint">No screening on record.</p>
            )}
            {latestScreening?.matchDetail && !latestScreening.resolution && (
              <p className="text-xs text-warning mt-2">{latestScreening.matchDetail} — resolve on the <Link to={`/clients/${client.id}`} className="font-medium underline">full client file</Link>.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text mb-1">
              <ShieldCheck size={15} className="text-primary-600" /> Decision
            </h2>
            <p className="text-xs text-text-soft mb-3">Activation needs every check green, then a second Compliance approver.</p>
            <ul className="flex flex-col gap-1.5 mb-4">
              {[
                { label: "Documents verified", ok: !blockers.includes("All submitted documents must be verified") },
                ...(ubos.length > 0 ? [{ label: "UBO verified", ok: !blockers.includes("UBO verification incomplete") }] : []),
                { label: "Screening clear / resolved", ok: !blockers.some((b) => b.toLowerCase().includes("screening")) },
                { label: "Risk rating assigned", ok: !!profile.riskRating },
                ...(profile.eddRequired ? [{ label: "EDD signed off", ok: !!profile.eddCompletedAt }] : []),
              ].map((step) => (
                <li key={step.label} className="flex items-center gap-2 text-[13px]">
                  <span className={`h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${step.ok ? "bg-success-bg text-success" : "bg-surface-sunken text-text-faint"}`}>
                    {step.ok ? "✓" : "·"}
                  </span>
                  <span className={step.ok ? "text-text" : "text-text-soft"}>{step.label}</span>
                </li>
              ))}
            </ul>
            {profile.activationApprovalId ? (
              <p className="text-xs text-text-soft">Awaiting approval — <Link to="/approvals" className="text-primary-600 font-medium">view in Approvals</Link></p>
            ) : (
              <>
                <Button className="w-full" disabled={!eligible || busy === "activate"} onClick={() => act("activate", () => submitActivation(client.id, me), "Sent for Compliance activation approval", true)}>
                  {busy === "activate" ? "Submitting…" : "Submit for activation"}
                </Button>
                {!eligible && <p className="text-[11px] text-text-faint mt-2">{blockers[0]}</p>}
                {client.kycStatus === "pending_review" && (
                  <Button variant="ghost" size="sm" className="w-full mt-2" disabled={busy === "recapture"} onClick={() => act("recapture", () => decideKycApplication(client.id, "recapture", me), "Sent back for document re-capture", true)}>
                    <Undo2 size={14} /> Request re-capture
                  </Button>
                )}
              </>
            )}
          </Card>
          <Link to={`/clients/${client.id}`} className="text-sm text-primary-600 font-medium text-center">Open full client file →</Link>
        </div>
      </div>
    </div>
  );
}

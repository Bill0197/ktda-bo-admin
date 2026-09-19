import { useState } from "react";
import { identityRows, profileRows } from "../lib/clientProfile";
import { Link, useParams } from "react-router-dom";
import {
  DOCUMENT_TYPE_LABELS, LIFECYCLE_LABELS, CASE_TYPE_LABELS, CASE_STATUS_LABELS, WALLET_RESTRICTION_LABELS,
  AUDIT_CATEGORY_LABELS, KYC_STATUS_LABELS,
  type ScreeningResult, type RiskRating, type WalletRestriction,
} from "../mock";
import {
  getClientComplianceDetail, decideKycApplication, setDocumentStatus, setUboStatus, setRiskRating, runScreening, resolveScreeningMatch,
  submitActivation, getActivationBlockers, completeEdd, setWalletStatus, setWalletRestrictions,
  setClientSuspended, getRiskFactors, getComplianceProfiles, getPlatformSettings,
} from "../lib/api";
import {
  PageHeader, Card, Badge, Button, Tabs, KeyValue, Skeleton, EmptyState, Modal, Field, Textarea, Dropdown,
  useToast, formatDate, formatDateTime, Money,
} from "../ui";
import { ArrowLeft, ShieldCheck, Snowflake, Ban, PlayCircle, UserSearch } from "lucide-react";
import ClassifierPanel from "../components/ClassifierPanel";
import InteractionTimeline from "../components/InteractionTimeline";
import RelationshipPanel from "../components/RelationshipPanel";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };
const LIFECYCLE_TONE: Record<string, "success" | "warning" | "info" | "danger" | "neutral"> = {
  active: "success", pending_activation: "info", edd_required: "danger", screening: "warning",
  docs_pending: "warning", onboarding: "neutral", suspended: "danger", closed: "neutral",
};
const DOC_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  verified: "success", submitted: "info", missing: "warning", rejected: "danger", expired: "danger",
};
const SCREEN_TONE = (v: string): "success" | "warning" | "danger" => (v === "clear" ? "success" : v === "potential_match" ? "warning" : "danger");

export default function ClientDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(() => getClientComplianceDetail(id ?? ""));
  // activationBlockers used to be a synchronous, fixture-derived helper —
  // the real backend only exposes it as its own endpoint, so it's fetched
  // alongside the client detail rather than computed inline at render time.
  const { data: blockersData, loading: blockersLoading, reload: reloadBlockers } = useAsyncData(() => getActivationBlockers(id ?? ""));
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ScreeningResult | null>(null);

  const me = role ? ADMIN_USERS[role].name : "";
  const isCompliance = role === "compliance" || role === "mlro" || role === "system_admin";

  const act = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      await reload();
      await reloadBlockers();
      toast.push(success, "success");
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={<UserSearch size={20} />}
          title="Client not found"
          body={error ?? "This client may have been removed, or the link is stale."}
          action={<Link to="/clients" className="text-sm text-primary-600 font-medium">Back to clients</Link>}
        />
      </Card>
    );
  }

  const { client, profile, documents, ubos, screenings, cases, alerts, wallet, holdings, auditEvents } = data;
  const blockers = blockersData ?? [];
  // A control that can't yet be read withholds access rather than defaulting
  // to a pass — don't treat "still loading" the same as "no blockers".
  const eligible = !blockersLoading && blockers.length === 0;
  // Pre-activation accounts can't transact, so there is nothing to monitor
  // yet — the alerts/cases tab only appears once the pipeline completes.
  const preActivation = ["onboarding", "docs_pending", "screening", "pending_activation"].includes(profile.lifecycleStatus);

  const tabs = [
    { key: "overview", label: "Overview" },
    // Relationship and Interactions are the customer-facing half of the client
    // file, so Client Services reaches them without any of the compliance tabs
    // below. Redaction inside the timeline is what makes that safe.
    { key: "relationship", label: "Relationship" },
    { key: "interactions", label: "Interactions" },
    ...(isCompliance
      ? [
          { key: "documents", label: "Documents", count: documents.length },
          { key: "ubo", label: "Identity & UBO", count: ubos.length },
          { key: "screening", label: "Screening", count: screenings.length },
          { key: "segmentation", label: "Customer segmentation" },
          { key: "classifiers", label: "Classifiers" },
          { key: "wallet", label: "Wallet & holdings" },
          ...(!preActivation ? [{ key: "cases", label: "Alerts & cases", count: cases.length + alerts.length }] : []),
          { key: "audit", label: "Audit", count: auditEvents.length },
        ]
      : []),
  ];

  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text mb-4">
        <ArrowLeft size={15} /> Clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.email} · ${client.phone} · via ${client.channel}`}
        actions={
          /* TIPPING-OFF (TM §17, STR §14). Lifecycle status, risk band, PEP and
             EDD state are Compliance facts. A Client Services agent with this
             on screen can read "high risk, EDD outstanding" to the customer on
             the phone — which is the breach, regardless of how the account got
             there. Non-compliance roles get the neutral three-state read
             Compliance itself defined (Active / Pending activation / Inactive),
             derived from account status alone and carrying no reason. */
          <div className="flex items-center gap-2 flex-wrap">
            {isCompliance ? (
              <>
                <Badge tone={LIFECYCLE_TONE[profile.lifecycleStatus] ?? "neutral"}>{LIFECYCLE_LABELS[profile.lifecycleStatus]}</Badge>
                {profile.riskRating && <Badge tone={RISK_TONE[profile.riskRating]}>{profile.riskRating} risk</Badge>}
                {profile.pepFlag && <Badge tone="danger">PEP</Badge>}
                {profile.eddRequired && !profile.eddCompletedAt && <Badge tone="warning">EDD outstanding</Badge>}
              </>
            ) : (
              <Badge tone={client.kycStatus === "verified" ? "success" : "neutral"}>
                {KYC_STATUS_LABELS[client.kycStatus] ?? "Pending Activation"}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0">
          <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

          {tab === "overview" && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-text mb-4">Profile</h2>
                <KeyValue
                  rows={[
                    ...identityRows(client, formatDate),
                    ...profileRows(client),
                    { label: "Onboarding date", value: formatDate(client.joinedAt) },
                    ...(isCompliance
                      ? [{ label: "Risk rating", value: profile.riskRating ? <Badge tone={RISK_TONE[profile.riskRating]}>{profile.riskRating}</Badge> : "Not rated yet" }]
                      : []),
                  ]}
                />
              </Card>
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-text mb-4">
                  {isCompliance ? "Account & compliance" : "Account"}
                </h2>
                <KeyValue
                  rows={[
                    { label: "Investor ID", value: <span className="tabular">{client.id}</span> },
                    { label: "Account status", value: KYC_STATUS_LABELS[client.kycStatus] ?? client.kycStatus.replace(/_/g, " ") },
                    { label: "AUM", value: <Money amount={client.aum} currency={client.currency} /> },
                    /* Risk factors, screening dates and the retired suitability
                       score are the "why" behind an account's state. Same
                       control as the header badges above. */
                    ...(isCompliance
                      ? [
                          { label: "Suitability score", value: client.suitabilityScore != null ? `${client.suitabilityScore}/100` : <span className="text-text-faint">Not scored — questionnaire retired</span> },
                          { label: "Risk factors", value: profile.riskFactors.length ? profile.riskFactors.join("; ") : "None recorded" },
                          { label: "Last screened", value: profile.lastScreenedAt ? formatDateTime(profile.lastScreenedAt) : "Never" },
                          { label: "Next screening due", value: profile.nextScreeningDue ?? "—" },
                          { label: "Next KYC refresh", value: profile.nextKycRefreshDue ?? "—" },
                        ]
                      : []),
                  ]}
                />
                {!isCompliance && (
                  <p className="mt-4 pt-3 border-t border-border text-xs text-text-faint leading-relaxed">
                    Account status only. Any customer question about why an account is restricted goes to Compliance —
                    it is not answerable from this screen by design.
                  </p>
                )}
              </Card>
            </div>
          )}

          {tab === "documents" && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                        <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
                      </div>
                      <p className="text-[11px] text-text-faint mt-1">
                        {d.submittedAt ? `Submitted ${formatDateTime(d.submittedAt)}` : "Not submitted"}
                        {d.reviewedBy ? ` · reviewed by ${d.reviewedBy}` : ""}
                        {d.note ? ` · ${d.note}` : ""}
                      </p>
                    </div>
                    {d.status === "submitted" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => act(d.id, () => setDocumentStatus(d.id, "rejected", me), "Document rejected")}>Reject</Button>
                        <Button size="sm" disabled={busy === d.id} onClick={() => act(d.id, () => setDocumentStatus(d.id, "verified", me), "Document verified")}>Verify</Button>
                      </div>
                    )}
                  </li>
                ))}
                {documents.length === 0 && <li className="px-5 py-8 text-sm text-text-faint text-center">No documents on record.</li>}
              </ul>
            </Card>
          )}

          {tab === "ubo" && ubos.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-sm text-text-soft">UBO verification applies to entity clients (companies, trusts).</p>
              <p className="text-xs text-text-faint mt-1">This is an individual client — no beneficial-ownership records are required.</p>
            </Card>
          )}
          {tab === "ubo" && ubos.length > 0 && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {ubos.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{u.name}</span>
                        <Badge tone={u.status === "verified" ? "success" : u.status === "flagged" ? "danger" : "warning"}>{u.status}</Badge>
                      </div>
                      <p className="text-xs text-text-soft mt-0.5">
                        {u.relationship}{u.ownershipPct != null ? ` · ${u.ownershipPct}% beneficial ownership` : ""}
                        {u.verifiedBy ? ` · verified by ${u.verifiedBy}` : ""}
                      </p>
                    </div>
                    {u.status !== "verified" && (
                      <Button size="sm" disabled={busy === u.id} onClick={() => act(u.id, () => setUboStatus(u.id, "verified", me), "UBO verified")}>Verify</Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {tab === "screening" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button size="sm" disabled={busy === "screen"} onClick={() => act("screen", () => runScreening(client.id, "on_demand", me), "Screening complete")}>
                  <PlayCircle size={14} /> {busy === "screen" ? "Screening…" : "Run screening now"}
                </Button>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {screenings.map((s) => (
                    <li key={s.id} className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text">{formatDateTime(s.runAt)}</span>
                        <Badge tone="neutral">{s.trigger.replace("_", " ")}</Badge>
                        <Badge tone={SCREEN_TONE(s.sanctions)}>sanctions {s.sanctions.replace("_", " ")}</Badge>
                        <Badge tone={SCREEN_TONE(s.pep)}>PEP {s.pep.replace("_", " ")}</Badge>
                        <Badge tone={SCREEN_TONE(s.adverseMedia)}>media {s.adverseMedia.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-[11px] text-text-faint mt-1">Run by {s.runBy}{s.matchDetail ? ` · ${s.matchDetail}` : ""}</p>
                      {s.resolution ? (
                        <p className="text-xs text-text-soft mt-1.5">
                          Resolved as <span className="font-medium">{s.resolution.outcome.replace(/_/g, " ")}</span> by {s.resolution.by} — {s.resolution.note}
                        </p>
                      ) : (
                        (s.sanctions !== "clear" || s.pep !== "clear" || s.adverseMedia !== "clear") && (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setResolveTarget(s)}>Resolve match</Button>
                        )
                      )}
                    </li>
                  ))}
                  {screenings.length === 0 && <li className="px-5 py-8 text-sm text-text-faint text-center">No screening on record.</li>}
                </ul>
              </Card>
            </div>
          )}

          {tab === "segmentation" && (
            <SegmentationTab rating={profile.riskRating} factors={profile.riskFactors} onEdit={() => setRatingOpen(true)} />
          )}

          {tab === "relationship" && <RelationshipPanel clientId={client.id} />}

          {tab === "interactions" && <InteractionTimeline subjectType="client" subjectId={client.id} />}

          {tab === "classifiers" && <ClassifierPanel clientId={client.id} />}

          {tab === "wallet" && (
            <div className="flex flex-col gap-4">
              {wallet ? (
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-text">Wallet {wallet.id}</h2>
                      <Badge tone={wallet.status === "active" ? "success" : wallet.status === "frozen" ? "danger" : "info"}>{wallet.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {wallet.status !== "pending_activation" && wallet.status !== "closed" && (
                        wallet.status === "frozen" ? (
                          <Button size="sm" disabled={busy === "wallet"} onClick={() => act("wallet", () => setWalletStatus(wallet.id, "active", me, "Unfrozen after review"), "Wallet unfrozen")}>Unfreeze</Button>
                        ) : (
                          <Button size="sm" variant="danger" onClick={() => setFreezeOpen(true)}><Snowflake size={14} /> Freeze wallet</Button>
                        )
                      )}
                      {profile.lifecycleStatus === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setSuspendOpen(true)}><Ban size={14} /> Suspend</Button>
                      )}
                      {profile.lifecycleStatus === "suspended" && (
                        <Button size="sm" disabled={busy === "suspend"} onClick={() => act("suspend", () => setClientSuspended(client.id, false, me, "Reinstated after review"), "Account reactivated")}>Reactivate account</Button>
                      )}
                    </div>
                  </div>
                  <KeyValue
                    rows={[
                      { label: "Ownership", value: wallet.ownership },
                      { label: "Created", value: formatDateTime(wallet.createdAt) },
                      { label: "Activated", value: wallet.activatedAt ? formatDateTime(wallet.activatedAt) : "Not yet" },
                      { label: "Restrictions", value: wallet.restrictions.length ? wallet.restrictions.map((r) => WALLET_RESTRICTION_LABELS[r]).join(", ") : "None" },
                      ...(wallet.statusReason ? [{ label: "Status reason", value: wallet.statusReason }] : []),
                    ]}
                  />
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs font-medium text-text-soft mb-2">Restrictions</div>
                    <div className="flex flex-col gap-1.5">
                      {(Object.keys(WALLET_RESTRICTION_LABELS) as WalletRestriction[]).map((r) => (
                        <label key={r} className="flex items-center gap-2.5 text-sm text-text cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wallet.restrictions.includes(r)}
                            disabled={busy === "restrict"}
                            onChange={() =>
                              act("restrict", () => setWalletRestrictions(
                                wallet.id,
                                wallet.restrictions.includes(r) ? wallet.restrictions.filter((x) => x !== r) : [...wallet.restrictions, r],
                                me,
                              ), "Restrictions updated")
                            }
                            className="h-4 w-4 accent-[var(--primary-600)]"
                          />
                          {WALLET_RESTRICTION_LABELS[r]}
                        </label>
                      ))}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center text-sm text-text-faint">No wallet provisioned yet.</Card>
              )}
              {holdings.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">Token holdings</div>
                  <ul className="divide-y divide-border">
                    {holdings.map((h) => (
                      <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-text">{h.product.replace("_", " ")}</span>
                          <p className="text-[11px] text-text-faint mt-0.5">Issuer: {h.issuer}{h.restrictions.length ? ` · ${h.restrictions.map((r) => WALLET_RESTRICTION_LABELS[r]).join(", ")}` : ""}</p>
                        </div>
                        <span className="tabular text-sm text-text">{h.quantity.toLocaleString()} units</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {tab === "cases" && (
            <div className="flex flex-col gap-4">
              {/* Alerts first — the workflow starts with an alert, which may
                  then be escalated into a case. */}
              <Card className="overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border text-sm font-semibold text-text">AML alerts</div>
                <ul className="divide-y divide-border">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm text-text flex-1">{a.rule}</span>
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
          )}

          {tab === "audit" && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {auditEvents.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <Badge tone={e.category === "compliance" ? "danger" : "info"}>{AUDIT_CATEGORY_LABELS[e.category]}</Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-text"><span className="font-medium">{e.action}</span> — {e.target}</span>
                      {e.detail && <p className="text-xs text-text-soft truncate">{e.detail}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-text-faint">{formatDateTime(e.at)}</div>
                      <div className="text-[10px] tabular text-text-faint">#{e.hash}</div>
                    </div>
                  </li>
                ))}
                {auditEvents.length === 0 && <li className="px-5 py-8 text-sm text-text-faint text-center">No linked audit events yet.</li>}
              </ul>
            </Card>
          )}
        </div>

        {isCompliance && (
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text mb-1">
                <ShieldCheck size={15} className="text-primary-600" /> Activation control
              </h2>
              <p className="text-xs text-text-soft mb-3">
                No account or wallet activates until every step below is complete and a second Compliance approver signs off.
              </p>
              <ul className="flex flex-col gap-1.5 mb-4">
                {[
                  { label: "Documents verified", ok: !blockers.includes("All submitted documents must be verified") },
                  ...(ubos.length > 0 ? [{ label: "UBO verified", ok: !blockers.includes("UBO verification incomplete") }] : []),
                  { label: "Screening clear / resolved", ok: !blockers.some((b) => b.includes("screening") || b.includes("Screening")) },
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
              {profile.lifecycleStatus === "active" ? (
                <Badge tone="success">Account active</Badge>
              ) : profile.activationApprovalId ? (
                <div className="text-xs text-text-soft">
                  Awaiting approval — <Link to="/approvals" className="text-primary-600 font-medium">view in Approvals</Link>
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={!eligible || busy === "activate"}
                    onClick={() => act("activate", () => submitActivation(client.id, me), "Sent for Compliance activation approval")}
                  >
                    {busy === "activate" ? "Submitting…" : "Submit for activation"}
                  </Button>
                  {!eligible && <p className="text-[11px] text-text-faint mt-2">{blockers[0]}</p>}
                  {client.kycStatus === "pending_review" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      disabled={busy === "recapture"}
                      onClick={() => act("recapture", () => decideKycApplication(client.id, "recapture", me), "Sent back for document re-capture")}
                    >
                      Request re-capture
                    </Button>
                  )}
                </>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-text mb-3">Risk & EDD</h2>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => setRatingOpen(true)}>
                  {profile.riskRating ? "Change risk rating" : "Assign risk rating"}
                </Button>
                {profile.eddRequired && !profile.eddCompletedAt && (
                  <Button variant="outline" size="sm" disabled={busy === "edd"} onClick={() => act("edd", () => completeEdd(client.id, me, "EDD file complete — source of funds corroborated."), "EDD sent for sign-off")}>
                    Submit EDD for sign-off
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      <RiskRatingModal
        key={String(ratingOpen)} /* remount per open so current rating/factors re-seed */
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        current={profile.riskRating}
        currentFactors={profile.riskFactors}
        onSave={async (rating, factors) => {
          await setRiskRating(client.id, rating, factors, me);
          await reload();
          toast.push(`Risk rating set to ${rating}`, "success");
          setRatingOpen(false);
        }}
      />

      <Modal open={freezeOpen} onClose={() => setFreezeOpen(false)} title="Freeze wallet" size="md">
        <FreezeForm
          description="Freezing blocks all transacting immediately. The reason is audit-logged and shown on the profile."
          confirmLabel="Freeze wallet"
          onCancel={() => setFreezeOpen(false)}
          onFreeze={async (reason) => {
            if (!wallet) return;
            await setWalletStatus(wallet.id, "frozen", me, reason);
            await reload();
            toast.push("Wallet frozen — client can no longer transact", "warning");
            setFreezeOpen(false);
          }}
        />
      </Modal>

      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title="Suspend account" size="md">
        <FreezeForm
          description="Suspension halts the whole relationship — the account leaves Active status and all transacting stops until reactivated. The reason is audit-logged."
          confirmLabel="Suspend account"
          onCancel={() => setSuspendOpen(false)}
          onFreeze={async (reason) => {
            await setClientSuspended(client.id, true, me, reason);
            await reload();
            toast.push("Account suspended", "warning");
            setSuspendOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title="Resolve screening match" size="md">
        {resolveTarget && (
          <ResolveForm
            detail={resolveTarget.matchDetail}
            onCancel={() => setResolveTarget(null)}
            onResolve={async (outcome, note) => {
              await resolveScreeningMatch(resolveTarget.id, outcome, note, me);
              await reload();
              toast.push("Match resolved", "success");
              setResolveTarget(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** Customer segmentation — where this customer sits in the risk-band model
 * (Low / Medium / High) and how the whole book distributes across bands. */
function SegmentationTab({ rating, factors, onEdit }: { rating: RiskRating | null; factors: string[]; onEdit: () => void }) {
  const { data, loading } = useAsyncData(() => Promise.all([getComplianceProfiles(), getPlatformSettings()]));
  const [profiles, settings] = data ?? [[], []];

  if (loading) return <Skeleton className="h-64 w-full" />;

  const lowMax = settings.find((s) => s.key === "risk_band_low_max")?.value ?? "30";
  const mediumMax = settings.find((s) => s.key === "risk_band_medium_max")?.value ?? "60";
  const counts = {
    low: profiles.filter((p) => p.riskRating === "low").length,
    medium: profiles.filter((p) => p.riskRating === "medium").length,
    high: profiles.filter((p) => p.riskRating === "high").length,
    unrated: profiles.filter((p) => p.riskRating === null).length,
  };
  const total = profiles.length || 1;

  const BANDS: { key: RiskRating; label: string; range: string; controls: string }[] = [
    { key: "low", label: "Low", range: `Score 0–${lowMax}`, controls: "Standard monitoring · daily screening · 24-month KYC refresh" },
    { key: "medium", label: "Medium", range: `Score ${Number(lowMax) + 1}–${mediumMax}`, controls: "Standard monitoring with tighter velocity review" },
    { key: "high", label: "High", range: `Score above ${mediumMax}`, controls: "Mandatory EDD · tighter deposit thresholds · enhanced monitoring" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-text">This customer's segment</h2>
          <Button size="sm" variant="outline" onClick={onEdit}>Change rating</Button>
        </div>
        <div className="flex flex-col gap-2">
          {BANDS.map((b) => {
            const isCurrent = rating === b.key;
            return (
              <div key={b.key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${isCurrent ? "border-primary-500/50 bg-primary-50" : "border-border"}`}>
                <Badge tone={RISK_TONE[b.key]}>{b.label}</Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text">{b.range}</span>
                  <p className="text-xs text-text-soft mt-0.5">{b.controls}</p>
                </div>
                {isCurrent && <Badge tone="info">current segment</Badge>}
              </div>
            );
          })}
          {!rating && <p className="text-xs text-text-faint">Not yet segmented — assign a risk rating to place this customer in a band.</p>}
          {rating && factors.length > 0 && (
            <p className="text-xs text-text-soft mt-1">Drivers: {factors.join("; ")}</p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Book distribution</h2>
        <p className="text-xs text-text-soft mb-4">All customers by segment — band ceilings are configurable in Platform Settings.</p>
        <div className="flex flex-col gap-2.5">
          {([["low", counts.low], ["medium", counts.medium], ["high", counts.high]] as [RiskRating, number][]).map(([band, count]) => (
            <div key={band} className="flex items-center gap-3">
              <span className="w-16 text-xs font-medium text-text-soft capitalize">{band}</span>
              <div className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden">
                <div className={`h-full rounded-full ${band === "low" ? "bg-success" : band === "medium" ? "bg-warning" : "bg-danger"}`} style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-xs tabular text-text">{count}</span>
            </div>
          ))}
          {counts.unrated > 0 && <p className="text-[11px] text-text-faint">{counts.unrated} customer{counts.unrated === 1 ? "" : "s"} not yet rated.</p>}
        </div>
      </Card>
    </div>
  );
}

function RiskRatingModal({ open, onClose, current, currentFactors, onSave }: {
  open: boolean;
  onClose: () => void;
  current: RiskRating | null;
  currentFactors: string[];
  onSave: (rating: RiskRating, factors: string[]) => Promise<void>;
}) {
  const [rating, setRating] = useState<RiskRating>(current ?? "low");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentFactors));
  const [saving, setSaving] = useState(false);
  const { data: catalogue, loading } = useAsyncData(getRiskFactors);
  const toast = useToast();

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(rating, [...selected]);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not save the rating", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Customer risk rating" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Rating" hint="High ratings trigger mandatory EDD before activation (configurable in Platform Settings).">
          <Dropdown
            value={rating}
            onChange={(v) => setRating(v as RiskRating)}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            ariaLabel="Risk rating"
          />
        </Field>
        <Field label="Risk factors" hint="The catalogue is managed in Platform Settings → Risk factors.">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-sunken p-3">
              {(catalogue ?? []).filter((f) => f.enabled).map((f) => (
                <label key={f.id} className="flex items-start gap-2.5 text-sm text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(f.label)}
                    onChange={() => toggle(f.label)}
                    className="h-4 w-4 mt-0.5 accent-[var(--primary-600)]"
                  />
                  <span>
                    {f.label}
                    <span className="block text-[11px] text-text-faint">{f.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save rating"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function FreezeForm({ description, confirmLabel, onCancel, onFreeze }: {
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onFreeze: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-soft">{description}</p>
      <Field label="Reason" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Open SAR investigation cs_4…" />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button
          variant="danger"
          disabled={saving || !reason.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onFreeze(reason.trim());
            } catch (e) {
              toast.push(e instanceof Error ? e.message : "Action failed", "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function ResolveForm({ detail, onCancel, onResolve }: {
  detail?: string;
  onCancel: () => void;
  onResolve: (outcome: "false_positive" | "true_match_accepted" | "true_match_rejected", note: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<"false_positive" | "true_match_accepted" | "true_match_rejected">("false_positive");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-col gap-4">
      {detail && <p className="text-sm text-text-soft">{detail}</p>}
      <Field label="Outcome">
        <Dropdown
          value={outcome}
          onChange={(v) => setOutcome(v as typeof outcome)}
          options={[
            { value: "false_positive", label: "False positive", description: "Different person — documented and cleared." },
            { value: "true_match_accepted", label: "True match — accepted with controls", description: "Genuine match; proceed with EDD/enhanced monitoring." },
            { value: "true_match_rejected", label: "True match — relationship declined", description: "Genuine match; do not proceed." },
          ]}
          ariaLabel="Resolution outcome"
        />
      </Field>
      <Field label="Resolution note" required>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Evidence for the decision — written for the file and the regulator." />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button
          disabled={saving || !note.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onResolve(outcome, note.trim());
            } catch (e) {
              toast.push(e instanceof Error ? e.message : "Could not resolve the match", "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Resolve"}
        </Button>
      </div>
    </div>
  );
}

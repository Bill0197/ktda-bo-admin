import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BadgeCheck, Camera, Fingerprint, ShieldQuestion } from "lucide-react";
import {
  Badge, Button, Field, FilterBar, GlassStat, Modal, NotePanel, PageHeader, SearchInput, SectionTitle, SelectFilter,
  StatRail, Textarea, useToast,
} from "../../ui";
import { tokenConsole } from "../../lib/api";
import { omniApi, type CheckedApplication, type QueuedDocument } from "../../lib/omniApi";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateOf, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import {
  allReviews, canDecideKyc, classifierOutstanding, currentClassifier, decideKyc, isKycReview, KYC_DECIDER_ROLES, type KycDecision,
} from "../../lib/tokenConsole/kyc";
import { DOC_LABEL, DOC_ORDER, fieldWords, REGISTRY_RESULT } from "../../lib/tokenConsole/identity";
import { TokApiError } from "../../lib/tokApi";
import { useAuth } from "../../lib/auth";
import type { ComplianceReviewItem, Investor } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge, type Source } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { ApplicantPhotos, ApplicationSection } from "../../components/tokenconsole/IdentityReview";
import { CustomerPhotos } from "../../components/tokenconsole/CustomerPhotos";
import { customerDeskLink } from "../../lib/tokenConsole/customerSearch";

/* The KYC desk: everything a reviewer needs to decide who someone is, on one
   page, one row per applicant.
   - The KYC review (accounting): onboarding opens one whenever it cannot clear
     an applicant itself. Until someone decides, the investor sits at
     UNDER_REVIEW and the investor app shows "we're reviewing your application"
     with investing disabled. A decision writes the review and the register —
     see lib/tokenConsole/kyc.ts.
   - The identity checks (omnichannel): what they applied with in the app and
     what the population registry made of it (a MISMATCH or an unreachable
     registry is what usually opens the review), and the selfie and ID photos,
     each approved or rejected with a note the customer receives.
   Joined on the investor: an application names its investor (externalRef) and
   its app profile, and photos belong to the profile. */

type Row = {
  /** The investor id, or `profile:<id>` for photos from someone with no investor yet. */
  key: string;
  investorId: string | null;
  /** The open review if there is one, else the latest. */
  review: ComplianceReviewItem | null;
  investor?: Investor;
  application: CheckedApplication | null;
  /** Waiting for a decision. */
  photos: QueuedDocument[];
  accepted: QueuedDocument[];
  name: string;
  reference: string;
  /** When they first needed attention. */
  since: string;
};

const TO_DECIDE = "TODO";
const SHOW_OPTIONS = [
  { value: TO_DECIDE, label: "To decide" },
  { value: "OPEN", label: "Review open" },
  { value: "MISMATCH", label: "Registry mismatch" },
  { value: "UNCHECKED", label: "Registry not checked" },
  { value: "PHOTOS", label: "Photos waiting" },
  { value: "ACCEPTED", label: "Photos approved" },
  { value: "CLEARED", label: "Cleared" },
  { value: "REJECTED", label: "Rejected" },
];

const toDecide = (r: Row) => r.review?.status === "OPEN" || r.photos.length > 0;

function matches(r: Row, show: string) {
  switch (show) {
    case "all": return true;
    case TO_DECIDE: return toDecide(r);
    case "MISMATCH":
    case "UNCHECKED": return r.application?.identityResult === show;
    case "PHOTOS": return r.photos.length > 0;
    case "ACCEPTED": return r.accepted.length > 0;
    default: return r.review?.status === show; // OPEN, CLEARED, REJECTED
  }
}

/** One row per applicant from the four sources; see the comment above. */
function applicants(
  reviews: ComplianceReviewItem[], investors: Investor[], applications: CheckedApplication[],
  waiting: QueuedDocument[], accepted: QueuedDocument[],
): Row[] {
  const investorsById = new Map(investors.map((i) => [i.investorId ?? "", i]));
  const appByInvestor = new Map(applications.map((a) => [a.externalRef, a]));
  const appByProfile = new Map(applications.map((a) => [a.profileId, a]));
  const rows = new Map<string, Row>();
  const row = (investorId: string | null, profileId?: string) => {
    const key = investorId ?? `profile:${profileId}`;
    let r = rows.get(key);
    if (!r) {
      rows.set(key, (r = {
        key, investorId, review: null, application: investorId ? appByInvestor.get(investorId) ?? null : appByProfile.get(profileId ?? "") ?? null,
        photos: [], accepted: [], name: "", reference: "", since: "",
      }));
    }
    return r;
  };
  for (const review of reviews) {
    if (!review.investorId) continue;
    const r = row(review.investorId);
    // The open one decides; otherwise the latest is the story so far.
    if (!r.review || (review.status === "OPEN" && r.review.status !== "OPEN")
      || (r.review.status !== "OPEN" && (review.openedAt ?? "") > (r.review.openedAt ?? ""))) r.review = review;
  }
  for (const app of applications) {
    if (app.identityResult !== "MATCH") row(app.externalRef || null, app.profileId);
  }
  const place = (doc: QueuedDocument) => row(appByProfile.get(doc.profileId)?.externalRef || null, doc.profileId);
  for (const doc of waiting) place(doc).photos.push(doc);
  for (const doc of accepted) place(doc).accepted.push(doc);
  for (const r of rows.values()) {
    r.investor = r.investorId ? investorsById.get(r.investorId) : undefined;
    r.name = r.investor?.displayName ?? r.application?.fullName ?? "";
    r.reference = r.investor?.externalRef ?? "";
    r.photos.sort((x, y) => DOC_ORDER.indexOf(x.type) - DOC_ORDER.indexOf(y.type));
    // What is waiting now: the open review and the photos. Otherwise, when it started.
    r.since = [r.review?.status === "OPEN" ? r.review.openedAt ?? "" : "", ...r.photos.map((p) => p.uploadedAt)]
      .filter(Boolean).sort()[0] ?? r.application?.submittedAt ?? r.review?.openedAt ?? "";
  }
  return [...rows.values()];
}

export default function TokenConsoleKyc() {
  const reviews = useAsyncData(allReviews);
  const investors = useAsyncData(tokenConsole.investors);
  // Omnichannel's half, each read on its own so one failing never hides the rest.
  const mismatched = useAsyncData(() => omniApi.applications("MISMATCH"));
  const unchecked = useAsyncData(() => omniApi.applications("UNCHECKED"));
  const matched = useAsyncData(() => omniApi.applications("MATCH"));
  const waiting = useAsyncData(omniApi.pendingDocuments);
  const accepted = useAsyncData(omniApi.acceptedDocuments);
  const [show, setShow] = useState(TO_DECIDE);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo<Row[]>(() => applicants(
    (reviews.data ?? []).filter(isKycReview), investors.data ?? [],
    [...(mismatched.data ?? []), ...(unchecked.data ?? []), ...(matched.data ?? [])],
    waiting.data ?? [], accepted.data ?? [],
  ), [reviews.data, investors.data, mismatched.data, unchecked.data, matched.data, waiting.data, accepted.data]);

  const term = q.trim().toLowerCase();
  const showingAccepted = show === "ACCEPTED";
  const latestAccepted = (r: Row) => r.accepted.map((d) => d.reviewedAt ?? "").sort().at(-1) ?? "";
  const rows = all
    .filter((r) => matches(r, show))
    .filter((r) => !term || [r.name, r.reference, r.investorId, r.application?.profileId].some((v) => (v ?? "").toLowerCase().includes(term)))
    // To decide: whoever has waited longest is next. Approved photos: the latest decisions first.
    .sort((a, b) => showingAccepted ? latestAccepted(b).localeCompare(latestAccepted(a)) : a.since.localeCompare(b.since));

  const loaded = !!reviews.data;
  const openReviews = all.filter((r) => r.review?.status === "OPEN").length;
  const photosWaiting = waiting.data?.length ?? 0;
  const mismatches = all.filter((r) => r.application?.identityResult === "MISMATCH" && toDecide(r)).length;
  const oldest = all.filter(toDecide).map((r) => r.since).filter(Boolean).sort()[0];
  // Deciding someone's last photo can take their row off the desk; the panel
  // stays open on what it had, with nothing left to decide.
  const found = all.find((r) => r.key === selected);
  const lastOpen = useRef<Row | null>(null);
  if (found) lastOpen.current = found;
  const selectedRow = found ?? (selected && lastOpen.current?.key === selected ? { ...lastOpen.current, photos: [], accepted: [] } : undefined);
  // The omnichannel half failing leaves the reviews usable: say what is missing.
  const partial = [
    (mismatched.error || unchecked.error || matched.error) && `the registry results (${mismatched.error ?? unchecked.error ?? matched.error})`,
    waiting.error && `the photos waiting (${waiting.error})`,
    accepted.error && `the approved photos (${accepted.error})`,
  ].filter(Boolean);
  const reloadAll = () => {
    for (const s of [reviews, investors, mismatched, unchecked, matched, waiting, accepted]) void s.reload();
  };

  const source: Source<Row> = {
    data: loaded ? rows : null,
    loading: reviews.loading || investors.loading,
    error: reviews.error ?? investors.error,
    reload: reloadAll,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="KYC desk"
        subtitle="Who each applicant is, in one place: the KYC review, what the population registry said about their application, and the selfie and ID photos they sent. Clearing someone lets them invest straight away."
      />

      <StatRail className="mb-6">
        <GlassStat label="Reviews open" value={loaded ? openReviews : "—"} icon={<ShieldQuestion size={16} />} tone={openReviews ? "warning" : "neutral"} />
        <GlassStat label="Photos waiting" value={waiting.data ? photosWaiting : "—"} icon={<Camera size={16} />} tone={photosWaiting ? "warning" : "neutral"} emphasis={false} />
        <GlassStat label="Registry mismatches" value={mismatched.data ? mismatches : "—"} icon={<Fingerprint size={16} />} tone={mismatches ? "danger" : "neutral"} emphasis={false}
          hint="To decide, with a name or date of birth the registry does not hold." />
        <GlassStat label="Oldest waiting" value={oldest ? dateOf(oldest) : "—"} hint={oldest ? "Decide this one first." : "Nothing is waiting."} />
      </StatRail>

      {partial.length > 0 && (
        <NotePanel tone="warning" className="mb-4" title="Part of this page could not be loaded">
          Missing: {partial.join("; ")}. The KYC reviews below are complete.
        </NotePanel>
      )}

      <FilterBar className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Name, reference or investor id…" className="w-72" />
        <SelectFilter value={show} onChange={setShow} options={SHOW_OPTIONS} allLabel="Everyone" />
      </FilterBar>

      <ConsoleTable<Row>
        what="the KYC desk"
        source={source}
        rows={rows}
        rowId={(r) => r.key}
        onRowClick={(r) => setSelected(r.key)}
        selectedId={selected}
        title={showingAccepted ? "Photos approved" : "Applicants"}
        description={loaded ? `${rows.length} of ${all.length}` : undefined}
        emptyLabel={show === TO_DECIDE ? "Nothing is waiting on a KYC decision" : "Nobody matches that"}
        columns={[
          { key: "applicant", header: "Applicant", className: "min-w-[200px]", render: (r) => (
            <div>
              <div className="font-medium text-text">{r.name || <Code>{shortId(r.investorId ?? r.application?.profileId)}</Code>}</div>
              <div className="mt-0.5 text-xs text-text-faint">
                {r.application ? `Born ${dateOf(r.application.dateOfBirth)} · ${r.application.nationality}` : r.reference || "—"}
              </div>
            </div>
          ) },
          { key: "registry", header: "Registry", render: (r) => r.application ? (
            <div>
              <Badge tone={REGISTRY_RESULT[r.application.identityResult]?.tone ?? "neutral"} className="whitespace-nowrap">
                {REGISTRY_RESULT[r.application.identityResult]?.text ?? label(r.application.identityResult)}
              </Badge>
              {r.application.identityMismatches?.length ? (
                <div className="mt-1 text-xs text-text-soft">Differs: {r.application.identityMismatches.map(fieldWords).join(", ")}</div>
              ) : null}
            </div>
          ) : <span className="text-xs text-text-faint">Not via the app</span>, hideOnMobile: true },
          { key: "photos", header: showingAccepted ? "Photos approved" : "Photos waiting", render: (r) => {
            const list = showingAccepted ? r.accepted : r.photos;
            return list.length
              ? <span className="text-text">{list.map((p) => DOC_LABEL[p.type] ?? p.type).join(", ")}</span>
              : <span className="text-xs text-text-faint">None</span>;
          } },
          { key: "since", header: showingAccepted ? "Approved" : "Waiting since", className: "whitespace-nowrap", render: (r) => {
            const at = showingAccepted ? latestAccepted(r) : r.since;
            return <span className="tabular text-xs text-text-soft">{at ? dateTime(at) : "—"}</span>;
          }, hideOnMobile: true },
          { key: "decision", header: "Review", render: (r) => r.review
            ? <StatusBadge status={r.review.status} />
            : <span className="text-xs text-text-faint">No review</span> },
        ]}
      />

      <Modal open={!!selectedRow} onClose={() => setSelected(null)} title={selectedRow?.name || "Applicant"} size="lg">
        {/* Keyed so one applicant's notes, images and errors never carry to the next. */}
        {selectedRow && (
          <ApplicantPanel
            key={selectedRow.key}
            row={selectedRow}
            onDone={() => {
              setSelected(null);
              reloadAll();
            }}
            onPhotoDecided={(decided) => {
              // Moved across before the reloads, so an approved photo never leaves the panel in between.
              if (decided) {
                waiting.setData((list) => list?.filter((d) => d.id !== decided.id) ?? list);
                if (decided.status === "PASSED") accepted.setData((list) => [decided, ...(list ?? []).filter((d) => d.id !== decided.id)]);
              }
              void waiting.reload();
              void accepted.reload();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** The photos to decide, with the latest approved one of each kind and the
 *  ones rejected while the panel is open beside them. */
function photosOnShow(r: Row, rejected: QueuedDocument[]): QueuedDocument[] {
  const approved = DOC_ORDER.flatMap((type) => {
    const latest = r.accepted.filter((d) => d.type === type)
      .sort((x, y) => (y.reviewedAt ?? "").localeCompare(x.reviewedAt ?? ""))[0];
    return latest ? [latest] : [];
  });
  return [...r.photos, ...rejected, ...approved].sort((x, y) => DOC_ORDER.indexOf(x.type) - DOC_ORDER.indexOf(y.type));
}

function ApplicantPanel({ row, onDone, onPhotoDecided }: { row: Row; onDone: () => void; onPhotoDecided: (decided?: QueuedDocument) => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const mayDecide = canDecideKyc(user?.tokRoles);
  const investorId = row.investorId ?? "";
  const detail = useAsyncData(() => (investorId ? tokenConsole.investor(investorId) : Promise.resolve(null)));
  const decide = useAction(async (args: Parameters<typeof decideKyc>[0]) => {
    try {
      return await decideKyc(args);
    } catch (e) {
      // Someone else decided it first: say so and show the queue as it is now.
      if (e instanceof TokApiError && e.status === 409) {
        toast.push(e.message, "warning");
        setDecision(null);
        onDone();
        return undefined;
      }
      throw e;
    }
  });
  const [decision, setDecision] = useState<KycDecision | null>(null);
  const [note, setNote] = useState("");

  const v = detail.data;
  const kyc = currentClassifier(v, "KYC_STATUS");
  const risk = currentClassifier(v, "RISK_TIER");
  const jurisdiction = currentClassifier(v, "JURISDICTION");
  const review = row.review;
  const isOpen = review?.status === "OPEN";
  const outstanding = classifierOutstanding(v);
  const name = v?.displayName ?? row.name;
  // Rejected just now: kept on show until the panel closes. After that they are in "Every photo sent".
  const [rejected, setRejected] = useState<QueuedDocument[]>([]);
  const photos = photosOnShow(row, rejected);
  const photoDecided = (decided?: QueuedDocument) => {
    if (decided?.status === "FAILED") setRejected((list) => [...list, decided]);
    onPhotoDecided(decided);
  };
  const profileId = row.application?.profileId ?? photos[0]?.profileId;

  const submit = async () => {
    if (!decision) return;
    const done = await decide.run({ investorId, queueId: review?.queueId, reviewOpen: isOpen, decision, note });
    if (!done) return; // the error is on the confirmation
    toast.push(decision === "verify" ? `${name || "Applicant"} is approved and can invest now.` : `${name || "Applicant"} was rejected.`);
    setDecision(null);
    onDone();
  };

  const start = (d: KycDecision) => {
    setNote("");
    decide.reset();
    setDecision(d);
  };

  return (
    <div className="flex flex-col">
      {detail.error && <NotePanel tone="danger" className="mb-4">{detail.error}</NotePanel>}
      {!investorId && (
        <NotePanel tone="info" className="mb-4">
          Photos from someone who has not applied yet: there is no investor record or review to decide.
        </NotePanel>
      )}
      {investorId && <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailItem term="Applicant">{v?.displayName ?? row.name ?? "—"}</DetailItem>
        <DetailItem term="Reference"><Code>{v?.externalRef ?? "—"}</Code></DetailItem>
        <DetailItem term="Category">{label(v?.category)}</DetailItem>
        <DetailItem term="Lifecycle"><StatusBadge status={v?.lifecycleStatus} /></DetailItem>
        <DetailItem term="KYC status"><StatusBadge status={kyc?.code} /></DetailItem>
        <DetailItem term="Risk tier">{risk?.name ?? "—"}</DetailItem>
        <DetailItem term="Jurisdiction">{jurisdiction?.name ?? "—"}</DetailItem>
        <DetailItem term="Accounts">{detail.loading && !v ? "…" : (v?.accounts?.length ?? 0)}</DetailItem>
      </dl>}

      {review && (
        <div className="mt-6">
          <SectionTitle title="Why this is here" description="The rule that opened the review, in the wording onboarding recorded." />
          <div className="rounded-md border border-border bg-surface-sunken px-4 py-3">
            <p className="text-[13px] text-text">{review.reason ?? "No reason recorded."}</p>
            <p className="mt-1 text-xs text-text-soft">
              Opened {dateTime(review.openedAt)}
              {review.assignedTo ? ` · assigned to ${review.assignedTo}` : ""}
            </p>
            {!isOpen && (
              <p className="mt-2 text-xs text-text-soft">
                {label(review.status)} {dateTime(review.resolvedAt)}
                {review.resolutionNote ? ` — “${review.resolutionNote}”` : ""}
              </p>
            )}
          </div>
          {/* ID and KRA numbers stay with onboarding; neither service returns them. */}
          <p className="mt-2 text-xs text-text-soft">
            Identity numbers stay with onboarding and are not shown. What is checkable is the registry result and the
            photos below, and the register's own classifiers above.
          </p>
        </div>
      )}

      {row.application && <div className="mt-6"><ApplicationSection app={row.application} /></div>}
      {(row.application || photos.length > 0) && (
        <div className="mt-6"><ApplicantPhotos photos={photos} onDecided={photoDecided} /></div>
      )}
      {profileId && (
        <div className="mt-6">
          <SectionTitle title="Every photo sent" />
          <CustomerPhotos key={row.photos.map((p) => p.id).join()} profileId={profileId} onKycDesk />
        </div>
      )}
      {(row.investorId ?? row.application?.profileId) && (
        <p className="mt-4 text-[12.5px] text-text-soft">
          Their M-Pesa payments, the messages we sent and what they did in the app are on the{" "}
          <Link to={customerDeskLink(row.investorId ?? row.application?.profileId)} className="font-medium text-primary-600 hover:text-primary-700">Customer desk</Link>.
        </p>
      )}

      {v?.lifecycle?.length ? (
        <div className="mt-6">
          <SectionTitle title="History" description="Every lifecycle move on this investor." />
          <ol className="space-y-2">
            {v.lifecycle.map((e, i) => (
              <li key={`${e.occurredAt}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                <span className="text-text">{e.fromStatus ? `${label(e.fromStatus)} → ` : ""}{label(e.toStatus)}</span>
                <span className="text-text-soft">{e.reason ?? "—"}</span>
                <span className="ml-auto text-text-faint">{dateTime(e.occurredAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {investorId && <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {(isOpen || outstanding) && !mayDecide ? (
          <span className="text-[12.5px] text-text-soft">
            Deciding a KYC review needs the {KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role. You can see the queue; someone with that role decides.
          </span>
        ) : isOpen || outstanding ? (
          <>
            <Button size="sm" disabled={decide.pending || !investorId || !v} onClick={() => start("verify")}>
              <BadgeCheck size={14} /> Approve
            </Button>
            <Button variant="outline" size="sm" disabled={decide.pending || !investorId || !v} onClick={() => start("reject")}>
              Reject
            </Button>
            {!isOpen && outstanding && (
              <span className="text-[12.5px] text-text-soft">The review is closed, but the register still says {kyc?.name?.toLowerCase()}.</span>
            )}
          </>
        ) : (
          <span className="text-[12.5px] text-text-soft">{review ? "This one is decided. Nothing is outstanding." : "No KYC review is open for them."}</span>
        )}
      </div>}

      {decision &&
        // Portalled: BO Admin's Modal is not, and this one opens over another.
        createPortal(
          <ConfirmDecision
            decision={decision}
            name={name}
            clearsReview={isOpen}
            note={note}
            onNote={setNote}
            busy={decide.pending}
            error={decide.error}
            onCancel={() => setDecision(null)}
            onConfirm={() => void submit()}
          />,
          document.body,
        )}
    </div>
  );
}



/** Both decisions are irreversible from here — a cleared applicant can start
 *  moving money immediately — so each states its consequence and takes a note
 *  for the audit trail. */
function ConfirmDecision({
  decision, name, clearsReview, note, onNote, busy, error, onCancel, onConfirm,
}: {
  decision: KycDecision;
  name: string;
  clearsReview: boolean;
  note: string;
  onNote: (v: string) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const verifying = decision === "verify";
  const who = name || "this applicant";
  const consequence = verifying
    ? clearsReview
      ? `${who} will be marked verified on the register and cleared for investing straight away.`
      : `The register will record ${who} as verified. Their review is already closed.`
    : clearsReview
      ? `${who} will be marked rejected and will not be able to invest.`
      : `The register will record ${who} as rejected. Their review is already closed.`;
  return (
    <Modal
      open
      onClose={busy ? () => undefined : onCancel}
      size="sm"
      title={verifying ? "Approve this applicant?" : "Reject this applicant?"}
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant={verifying ? "primary" : "danger"} size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? "Saving…" : verifying ? "Approve applicant" : "Reject applicant"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-soft">{consequence}</p>
      <Field label="Note" hint={clearsReview ? "Kept with the decision on the review." : "Not recorded — the review is already closed."}>
        <Textarea
          rows={3}
          value={note}
          disabled={!clearsReview}
          onChange={(e) => onNote(e.target.value)}
          placeholder={verifying ? "Documents checked against the application." : "Why this was refused."}
        />
      </Field>
      {error && <NotePanel tone="danger" className="mt-3">{error}</NotePanel>}
    </Modal>
  );
}

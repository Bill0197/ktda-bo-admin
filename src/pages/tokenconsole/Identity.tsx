import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Clock, Fingerprint, ScanFace } from "lucide-react";
import {
  Badge, Button, Field, FilterBar, GlassStat, Modal, NotePanel, PageHeader, SearchInput, SectionTitle, SelectFilter,
  StatRail, Textarea, useToast,
} from "../../ui";
import {
  omniApi, OmniApiError, type CheckedApplication, type DocumentType, type IdentityResult, type QueuedDocument,
} from "../../lib/omniApi";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAuth } from "../../lib/auth";
import { canDecideKyc, KYC_DECIDER_ROLES } from "../../lib/tokenConsole/kyc";
import { dateOf, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { Code, ConsoleTable, type Source } from "../../components/tokenconsole/ConsoleTable";
import { DetailItem } from "../../components/tokenconsole/DetailItem";
import { CustomerPhotos } from "../../components/tokenconsole/CustomerPhotos";

/* Compliance's identity checks, from omnichannel (the customer channel):
   - the population-registry check run when a customer applies: a MISMATCH
     (name or date of birth differs) or UNCHECKED (the registry could not be
     reached) holds the applicant for a person to look at;
   - the selfie and both sides of the ID the customer photographed, each
     waiting for a pass, or a turn-down with a note the customer receives.
   One row per applicant, joined on the app profile. The KYC decision itself
   stays on the KYC desk; this page is what a reviewer looks at before it. */

const DOC_LABEL: Record<DocumentType, string> = { SELFIE: "Selfie", ID_FRONT: "ID front", ID_BACK: "ID back" };
const DOC_ORDER: DocumentType[] = ["SELFIE", "ID_FRONT", "ID_BACK"];

const RESULT: Record<IdentityResult, { tone: "success" | "danger" | "warning"; text: string }> = {
  MATCH: { tone: "success", text: "Matches registry" },
  MISMATCH: { tone: "danger", text: "Registry mismatch" },
  UNCHECKED: { tone: "warning", text: "Not checked" },
};

const ID_SIDES: DocumentType[] = ["ID_FRONT", "ID_BACK"];
const ALL_PHOTOS: DocumentType[] = ["SELFIE", ...ID_SIDES];

/** Ready-made reasons, in the customer's words: the note is sent to them.
 *  `short` labels the chip; `text` is what is sent. */
const TURN_DOWN_REASONS: { short: string; text: string; for: DocumentType[] }[] = [
  { short: "Face not visible", text: "Your face is not fully visible. Please retake the selfie in good light.", for: ["SELFIE"] },
  { short: "Blurry", text: "The photo is blurry. Please retake it holding the phone steady.", for: ALL_PHOTOS },
  { short: "Glare", text: "Glare covers part of the ID. Please retake it away from direct light.", for: ID_SIDES },
  { short: "Cut off", text: "Part of the ID is cut off. Please fit all four corners in the frame.", for: ID_SIDES },
  { short: "Not their ID", text: "The ID in the photo doesn't match the details you applied with. Please photograph your own ID.", for: ID_SIDES },
  { short: "Not the same person", text: "The selfie doesn't match the photo on your ID. Please retake the selfie yourself.", for: ["SELFIE"] },
];

const FILTERS = [
  { value: "MISMATCH", label: "Registry mismatch" },
  { value: "UNCHECKED", label: "Not checked" },
  { value: "PHOTOS", label: "Photos waiting" },
];

type Applicant = {
  profileId: string;
  application: CheckedApplication | null;
  photos: QueuedDocument[];
  /** When they first needed attention: applied, or the oldest photo sent. */
  since: string;
};

export default function TokenConsoleIdentity() {
  // Read separately, so one failing list never hides the others.
  const mismatched = useAsyncData(() => omniApi.applications("MISMATCH"));
  const unchecked = useAsyncData(() => omniApi.applications("UNCHECKED"));
  // Matched applications carry no flag, but name the applicants whose photos wait.
  const matched = useAsyncData(() => omniApi.applications("MATCH"));
  const flaggedList = useMemo(() => [...(mismatched.data ?? []), ...(unchecked.data ?? [])], [mismatched.data, unchecked.data]);
  const photos = useAsyncData(omniApi.pendingDocuments);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo<Applicant[]>(() => {
    const byProfile = new Map<string, Applicant>();
    const get = (profileId: string) => {
      let a = byProfile.get(profileId);
      if (!a) byProfile.set(profileId, (a = { profileId, application: null, photos: [], since: "" }));
      return a;
    };
    for (const app of flaggedList) get(app.profileId).application = app;
    for (const doc of photos.data ?? []) get(doc.profileId).photos.push(doc);
    const known = new Map((matched.data ?? []).map((a) => [a.profileId, a]));
    for (const a of byProfile.values()) {
      a.application ??= known.get(a.profileId) ?? null;
      a.photos.sort((x, y) => DOC_ORDER.indexOf(x.type) - DOC_ORDER.indexOf(y.type));
      a.since = [a.application?.submittedAt ?? "", ...a.photos.map((p) => p.uploadedAt)].filter(Boolean).sort()[0] ?? "";
    }
    return [...byProfile.values()];
  }, [flaggedList, matched.data, photos.data]);

  const term = q.trim().toLowerCase();
  const rows = all
    .filter((a) => filter === "all"
      || (filter === "PHOTOS" ? a.photos.length > 0 : a.application?.identityResult === filter))
    .filter((a) => !term || [a.application?.fullName, a.profileId, a.application?.externalRef]
      .some((v) => (v ?? "").toLowerCase().includes(term)))
    // Oldest first: whoever has waited longest is the one to check next.
    .sort((a, b) => a.since.localeCompare(b.since));

  const loaded = !!mismatched.data && !!photos.data;
  const mismatchCount = mismatched.data?.length ?? 0;
  const uncheckedCount = unchecked.data?.length ?? 0;
  // Parts that failed while the rest loaded: said, not hidden.
  const partial = [
    unchecked.error && `applications the registry could not check (${unchecked.error})`,
    matched.error && `the names of applicants whose photos are waiting (${matched.error})`,
  ].filter(Boolean);
  const waitingPhotos = photos.data?.length ?? 0;
  const oldestPhoto = (photos.data ?? []).map((p) => p.uploadedAt).sort()[0];
  const selectedRow = all.find((a) => a.profileId === selected);

  // The table's loading and error come from whichever read has not finished.
  const source: Source<Applicant> = {
    data: loaded ? all : null,
    loading: mismatched.loading || photos.loading,
    error: mismatched.error ?? photos.error,
    reload: () => { void mismatched.reload(); void unchecked.reload(); void matched.reload(); void photos.reload(); },
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Identity checks"
        subtitle="Applicants the population registry could not confirm, and the selfie and ID photos waiting for a decision. Decide the KYC status itself on the KYC desk."
      />

      <StatRail className="mb-6">
        <GlassStat label="Registry mismatches" value={loaded ? mismatchCount : "—"} icon={<Fingerprint size={16} />} tone={mismatchCount ? "danger" : "neutral"}
          hint="Name or date of birth differs from the registry." />
        <GlassStat label="Not checked" value={unchecked.data ? uncheckedCount : "—"} icon={<Clock size={16} />} tone={uncheckedCount ? "warning" : "neutral"} emphasis={false}
          hint="The registry could not be reached when they applied." />
        <GlassStat label="Photos waiting" value={loaded ? waitingPhotos : "—"} icon={<Camera size={16} />} tone={waitingPhotos ? "warning" : "neutral"} />
        <GlassStat label="Oldest photo waiting" value={oldestPhoto ? dateOf(oldestPhoto) : "—"} icon={<ScanFace size={16} />} emphasis={false}
          hint={waitingPhotos ? "Check this one first." : "Nothing is waiting."} />
      </StatRail>

      {partial.length > 0 && (
        <NotePanel tone="warning" className="mb-4" title="Part of this page could not be loaded">
          Missing: {partial.join("; ")}. Everything else below is complete.
        </NotePanel>
      )}

      <FilterBar className="mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Name, profile or investor id…" className="w-72" />
        <SelectFilter value={filter} onChange={setFilter} options={FILTERS} allLabel="Everything to check" />
      </FilterBar>

      <ConsoleTable<Applicant>
        what="the identity checks"
        source={source}
        rows={rows}
        rowId={(a) => a.profileId}
        onRowClick={(a) => setSelected(a.profileId)}
        selectedId={selected}
        title="To check"
        description={loaded ? `${rows.length} of ${all.length}` : undefined}
        emptyLabel={all.length ? "Nothing matches that" : "Nothing to check"}
        columns={[
          { key: "applicant", header: "Applicant", className: "min-w-[220px]", render: (a) => (
            <div>
              <div className="font-medium text-text">{a.application?.fullName ?? "No application yet"}</div>
              <div className="mt-0.5 text-xs text-text-faint">
                {a.application ? `Born ${dateOf(a.application.dateOfBirth)} · ${a.application.nationality}` : <>Profile <Code>{shortId(a.profileId)}</Code></>}
              </div>
            </div>
          ) },
          { key: "registry", header: "Registry", render: (a) => a.application ? (
            <div>
              <Badge tone={RESULT[a.application.identityResult].tone} className="whitespace-nowrap">{RESULT[a.application.identityResult].text}</Badge>
              {a.application.identityMismatches?.length ? (
                <div className="mt-1 text-xs text-text-soft">Differs: {a.application.identityMismatches.map((f) => label(f.toUpperCase()).toLowerCase()).join(", ")}</div>
              ) : null}
            </div>
          ) : <span className="text-xs text-text-faint">—</span> },
          { key: "photos", header: "Photos waiting", render: (a) => a.photos.length
            ? <span className="text-text">{a.photos.map((p) => DOC_LABEL[p.type] ?? p.type).join(", ")}</span>
            : <span className="text-xs text-text-faint">None</span> },
          { key: "since", header: "Waiting since", className: "whitespace-nowrap", render: (a) => (
            <span className="tabular text-xs text-text-soft">{a.since ? dateTime(a.since) : "—"}</span>
          ), hideOnMobile: true },
        ]}
      />

      <Modal open={!!selectedRow} onClose={() => setSelected(null)} title={selectedRow?.application?.fullName ?? "Applicant"} size="lg">
        {/* Keyed so one applicant's images and notes never carry to the next. */}
        {selectedRow && (
          <ApplicantPanel key={selectedRow.profileId} applicant={selectedRow} onDecided={() => void photos.reload()} />
        )}
      </Modal>
    </div>
  );
}

function ApplicantPanel({ applicant, onDecided }: { applicant: Applicant; onDecided: () => void }) {
  const app = applicant.application;
  // Photo decisions are identity decisions: the same roles as the KYC desk.
  const { user } = useAuth();
  const mayDecide = canDecideKyc(user?.tokRoles);
  return (
    <div className="flex flex-col gap-6">
      {app ? (
        <section>
          <SectionTitle title="Application" />
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <DetailItem term="Name as applied">{app.fullName}</DetailItem>
            <DetailItem term="Date of birth">{dateOf(app.dateOfBirth)}</DetailItem>
            <DetailItem term="Nationality">{app.nationality}</DetailItem>
            <DetailItem term="Registry">
              <Badge tone={RESULT[app.identityResult].tone}>{RESULT[app.identityResult].text}</Badge>
            </DetailItem>
            <DetailItem term="Checked">
              {app.identityCheckedAt ? `${dateTime(app.identityCheckedAt)}${app.identitySource ? ` · ${app.identitySource}` : ""}` : "—"}
            </DetailItem>
            <DetailItem term="Screening">{app.screeningClear ? "Clear" : "Needs a look"}</DetailItem>
            <DetailItem term="Investor"><Code>{shortId(app.externalRef)}</Code></DetailItem>
            <DetailItem term="Applied">{dateTime(app.submittedAt)}</DetailItem>
          </dl>
          {app.identityResult === "MISMATCH" && (
            <NotePanel tone="danger" className="mt-3" title={`The registry holds a different ${(app.identityMismatches ?? ["detail"]).map((f) => label(f.toUpperCase()).toLowerCase()).join(" and ")}`}>
              Compare the photos with what was applied for. The customer is not told what differed.
            </NotePanel>
          )}
          {app.identityResult === "UNCHECKED" && (
            <NotePanel tone="warning" className="mt-3" title="The registry could not be reached">
              Nothing was confirmed against it; check the ID photos by eye.
            </NotePanel>
          )}
          <p className="mt-3 text-[13px] text-text-soft">
            Clear or reject the applicant on the <Link to="/token-console/kyc" className="font-medium text-primary-600 hover:text-primary-700">KYC desk</Link>.
          </p>
        </section>
      ) : (
        <NotePanel tone="info">This profile sent photos but has not applied yet.</NotePanel>
      )}

      <section>
        <SectionTitle title="Photos waiting" />
        {applicant.photos.length === 0 ? (
          <p className="text-[13px] text-text-soft">None.</p>
        ) : (
          <>
            <p className="mb-3 text-[12.5px] text-text-faint">
              Opening this applicant is recorded as viewing their photos.
              {!mayDecide && ` Accepting or turning down a photo needs the ${KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role.`}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {applicant.photos.map((doc) => <PhotoReview key={doc.id} doc={doc} mayDecide={mayDecide} onDecided={onDecided} />)}
            </div>
          </>
        )}
      </section>

      <section>
        <SectionTitle title="Every photo sent" />
        <CustomerPhotos key={applicant.photos.map((p) => p.id).join()} profileId={applicant.profileId} onIdentityPage />
      </section>
    </div>
  );
}

/** One photo: the image, then a pass or a turn-down with a note. */
function PhotoReview({ doc, mayDecide, onDecided }: { doc: QueuedDocument; mayDecide: boolean; onDecided: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turningDown, setTurningDown] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const name = DOC_LABEL[doc.type] ?? doc.type;

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    omniApi.documentImage(doc.id).then(
      (blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      (e: unknown) => { if (!revoked) setLoadError(e instanceof Error ? e.message : "The photo could not be loaded."); },
    );
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id]);

  const decide = async (decision: "PASSED" | "FAILED") => {
    if (decision === "FAILED" && !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await omniApi.reviewDocument(doc.id, decision, decision === "FAILED" ? note.trim() : undefined);
      toast.push(decision === "PASSED" ? `${name} accepted.` : `${name} turned down. The customer has been asked to retake it.`);
      onDecided();
    } catch (e) {
      if (e instanceof OmniApiError && e.status === 409) {
        setError("Someone else has already decided this photo.");
        onDecided();
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3" data-testid={`review-${doc.type}`}>
      <div>
        <div className="text-[13.5px] font-semibold text-text">{name}</div>
        <div className="tabular text-[11.5px] text-text-faint" title={dateTime(doc.uploadedAt)}>Sent {dateOf(doc.uploadedAt)}</div>
      </div>
      <button type="button" onClick={() => url && setZoom(true)} disabled={!url}
        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-surface-sunken"
        aria-label={`Enlarge the ${name.toLowerCase()}`}>
        {url ? <img src={url} alt={name} className="h-full w-full object-contain" />
          : <span className="px-3 text-center text-[12px] text-text-faint">{loadError ?? "Loading…"}</span>}
      </button>
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
      {!mayDecide ? null : turningDown ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TURN_DOWN_REASONS.filter((r) => r.for.includes(doc.type)).map((r) => (
              <button key={r.short} type="button" onClick={() => setNote(r.text)} aria-pressed={note === r.text}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] ${note === r.text ? "border-primary-500 bg-primary-50 text-primary-700" : "border-border text-text-soft hover:bg-surface-sunken"}`}>
                {r.short}
              </button>
            ))}
          </div>
          <Field label="Note to the customer" required hint="Sent to them as a message. Say what to redo; don't mention the registry.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={busy || !note.trim()} onClick={() => void decide("FAILED")}>
              {busy ? "Sending…" : "Turn down"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setTurningDown(false); setNote(""); }}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !url} onClick={() => void decide("PASSED")} data-testid={`pass-${doc.type}`}>
            {busy ? "Saving…" : "Accept"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setTurningDown(true)} data-testid={`turn-down-${doc.type}`}>
            Turn down
          </Button>
        </div>
      )}
      <Modal open={zoom} onClose={() => setZoom(false)} title={name} size="lg">
        {url && <img src={url} alt={name} className="mx-auto max-h-[75vh] w-auto object-contain" />}
      </Modal>
    </div>
  );
}

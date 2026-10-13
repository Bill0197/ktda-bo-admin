import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Field, Modal, NotePanel, SectionTitle, Textarea, useToast } from "../../ui";
import { omniApi, OmniApiError, type CheckedApplication, type QueuedDocument } from "../../lib/omniApi";
import { useAuth } from "../../lib/auth";
import { canDecideKyc, KYC_DECIDER_ROLES } from "../../lib/tokenConsole/kyc";
import { dateOf, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { DOC_LABEL, fieldWords, REGISTRY_RESULT, TURN_DOWN_REASONS } from "../../lib/tokenConsole/identity";
import { Code } from "./ConsoleTable";
import { DetailItem } from "./DetailItem";

/* The identity half of the KYC desk: what the customer applied with and what
   the population registry made of it, and the photos to approve or reject.
   Photo decisions are identity decisions, so they take the KYC decider roles. */

/** The application as compliance sees it, with the registry result. */
export function ApplicationSection({ app }: { app: CheckedApplication }) {
  const result = REGISTRY_RESULT[app.identityResult];
  const differs = (app.identityMismatches ?? []).map(fieldWords);
  return (
    <section>
      <SectionTitle title="Application" description="What they applied with in the app, checked against the population registry." />
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <DetailItem term="Name as applied">{app.fullName}</DetailItem>
        <DetailItem term="Date of birth">{dateOf(app.dateOfBirth)}</DetailItem>
        <DetailItem term="Nationality">{app.nationality}</DetailItem>
        <DetailItem term="Registry">{result ? <Badge tone={result.tone}>{result.text}</Badge> : label(app.identityResult)}</DetailItem>
        <DetailItem term="Checked">
          {app.identityCheckedAt ? `${dateTime(app.identityCheckedAt)}${app.identitySource ? ` · ${app.identitySource}` : ""}` : "—"}
        </DetailItem>
        <DetailItem term="Screening">{app.screeningClear ? "Clear" : "Needs a look"}</DetailItem>
        <DetailItem term="Profile"><Code>{shortId(app.profileId)}</Code></DetailItem>
        <DetailItem term="Applied">{dateTime(app.submittedAt)}</DetailItem>
      </dl>
      {app.identityResult === "MISMATCH" && (
        <NotePanel tone="danger" className="mt-3" title={`The registry holds a different ${(differs.length ? differs : ["detail"]).join(" and ")}`}>
          Compare the photos with what was applied for. The customer is not told what differed.
        </NotePanel>
      )}
      {app.identityResult === "UNCHECKED" && (
        <NotePanel tone="warning" className="mt-3" title="The registry could not be reached">
          Nothing was confirmed against it; check the ID photos by eye.
        </NotePanel>
      )}
    </section>
  );
}

/** The photos waiting for a decision, each with its own approve or reject, and
 *  the decided ones, which stay on show. `onDecided` gets the photo as decided,
 *  or nothing when someone else decided it first. */
export function ApplicantPhotos({ photos, onDecided }: { photos: QueuedDocument[]; onDecided: (decided?: QueuedDocument) => void }) {
  const { user } = useAuth();
  const mayDecide = canDecideKyc(user?.tokRoles);
  const waiting = photos.some((p) => p.status === "PENDING_REVIEW");
  return (
    <section>
      <SectionTitle title="Photos" />
      {photos.length === 0 ? (
        <p className="text-[13px] text-text-soft">None.</p>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-text-faint">
            Opening this applicant is recorded as viewing their photos.
            {waiting && !mayDecide && ` Approving or rejecting a photo needs the ${KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role.`}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {photos.map((doc) => <PhotoReview key={doc.id} doc={doc} mayDecide={mayDecide} onDecided={onDecided} />)}
          </div>
        </>
      )}
    </section>
  );
}

/** One photo: the image, then an approve or a reject. Once decided it keeps
 *  its image and shows the decision instead of the buttons. */
function PhotoReview({ doc, mayDecide, onDecided }: { doc: QueuedDocument; mayDecide: boolean; onDecided: (decided?: QueuedDocument) => void }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const name = DOC_LABEL[doc.type] ?? doc.type;
  const approved = doc.status === "PASSED";
  const rejected = doc.status === "FAILED";

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

  const decide = async (decision: "PASSED" | "FAILED", note = "") => {
    if (decision === "FAILED" && !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const decided = await omniApi.reviewDocument(doc.id, decision, decision === "FAILED" ? note.trim() : undefined);
      toast.push(decision === "PASSED" ? `${name} approved.` : `${name} rejected. The customer has been asked to retake it.`);
      setRejecting(false);
      onDecided({ ...doc, ...decided, status: decision });
    } catch (e) {
      if (e instanceof OmniApiError && e.status === 409) {
        setError("Someone else has already decided this photo.");
        setRejecting(false);
        onDecided();
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3" data-testid={`review-${doc.type}`} data-status={doc.status}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-semibold text-text">{name}</div>
          <div className="tabular text-[11.5px] text-text-faint" title={dateTime(doc.uploadedAt)}>Sent {dateOf(doc.uploadedAt)}</div>
        </div>
        {approved && <Badge tone="success" className="whitespace-nowrap">Approved</Badge>}
        {rejected && <Badge tone="danger" className="whitespace-nowrap">Rejected</Badge>}
      </div>
      <button type="button" onClick={() => url && setZoom(true)} disabled={!url}
        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-surface-sunken"
        aria-label={`Enlarge the ${name.toLowerCase()}`}>
        {url ? <img src={url} alt={name} className="h-full w-full object-contain" />
          : <span className="px-3 text-center text-[12px] text-text-faint">{loadError ?? "Loading…"}</span>}
      </button>
      {error && !rejecting && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
      {approved ? (
        doc.reviewedAt && (
          <div className="tabular text-[11.5px] text-text-faint" title={dateTime(doc.reviewedAt)}>Approved {dateOf(doc.reviewedAt)}</div>
        )
      ) : rejected ? (
        <p className="text-[12px] text-text-soft">
          Asked to retake it{doc.reviewNote ? <>: “{doc.reviewNote}”</> : "."}
        </p>
      ) : mayDecide ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !url} onClick={() => void decide("PASSED")} data-testid={`pass-${doc.type}`}>
            {busy && !rejecting ? "Saving…" : "Approve"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { setError(null); setRejecting(true); }} data-testid={`turn-down-${doc.type}`}>
            Reject
          </Button>
        </div>
      ) : null}
      {rejecting &&
        // Portalled: BO Admin's Modal is not, and this one opens over the applicant's.
        createPortal(
          <RejectPhoto
            doc={doc}
            url={url}
            busy={busy}
            error={error}
            onCancel={() => { setError(null); setRejecting(false); }}
            onConfirm={(note) => void decide("FAILED", note)}
          />,
          document.body,
        )}
      <Modal open={zoom} onClose={() => setZoom(false)} title={name} size="lg">
        {url && <img src={url} alt={name} className="mx-auto max-h-[75vh] w-auto object-contain" />}
      </Modal>
    </div>
  );
}

const NOTE_LIMIT = 500;

/** Rejecting one photo: the photo beside the reason, because the reason is
 *  about what is in it, and the message exactly as the customer will get it. */
function RejectPhoto({
  doc, url, busy, error, onCancel, onConfirm,
}: {
  doc: QueuedDocument;
  url: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const name = DOC_LABEL[doc.type] ?? doc.type;
  const reasons = TURN_DOWN_REASONS.filter((r) => r.for.includes(doc.type));
  return (
    <Modal
      open
      onClose={busy ? () => undefined : onCancel}
      size="lg"
      title={`Reject photo · ${name}`}
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="sm" disabled={busy || !note.trim()} onClick={() => onConfirm(note)} data-testid={`confirm-reject-${doc.type}`}>
            {busy ? "Sending…" : "Reject and ask for a retake"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex aspect-[4/3] items-center justify-center self-start overflow-hidden rounded-lg bg-surface-sunken">
          {url ? <img src={url} alt={name} className="h-full w-full object-contain" />
            : <span className="px-3 text-center text-[12px] text-text-faint">The photo is not loaded.</span>}
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-soft">The customer gets the message below and is asked to send this photo again.</p>
          {reasons.length > 0 && (
            <Field group label="What is wrong with it" hint="Picking one writes the message. You can still edit it.">
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((r) => (
                  <button key={r.short} type="button" disabled={busy} onClick={() => setNote(r.text)} aria-pressed={note === r.text}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${note === r.text ? "border-primary-500 bg-primary-50 text-primary-700" : "border-border text-text-soft hover:bg-surface-sunken"}`}>
                    {r.short}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Message to the customer" required
            hint={`Say what to redo; don't mention the registry. ${note.length}/${NOTE_LIMIT}`}>
            <Textarea value={note} disabled={busy} onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))} rows={4}
              placeholder="Pick a reason above or write your own." />
          </Field>
          {error && <NotePanel tone="danger">{error}</NotePanel>}
        </div>
      </div>
    </Modal>
  );
}

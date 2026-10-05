import { useEffect, useState } from "react";
import { Badge, Button, Field, Modal, NotePanel, SectionTitle, Textarea, useToast } from "../../ui";
import { omniApi, OmniApiError, type CheckedApplication, type QueuedDocument } from "../../lib/omniApi";
import { useAuth } from "../../lib/auth";
import { canDecideKyc, KYC_DECIDER_ROLES } from "../../lib/tokenConsole/kyc";
import { dateOf, dateTime, label, shortId } from "../../lib/tokenConsole/format";
import { DOC_LABEL, fieldWords, REGISTRY_RESULT, TURN_DOWN_REASONS } from "../../lib/tokenConsole/identity";
import { Code } from "./ConsoleTable";
import { DetailItem } from "./DetailItem";

/* The identity half of the KYC desk: what the customer applied with and what
   the population registry made of it, and the photos to accept or turn down.
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

/** The photos still waiting for a decision, each with its own accept or turn-down. */
export function PhotosWaiting({ photos, onDecided }: { photos: QueuedDocument[]; onDecided: () => void }) {
  const { user } = useAuth();
  const mayDecide = canDecideKyc(user?.tokRoles);
  return (
    <section>
      <SectionTitle title="Photos waiting" />
      {photos.length === 0 ? (
        <p className="text-[13px] text-text-soft">None.</p>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-text-faint">
            Opening this applicant is recorded as viewing their photos.
            {!mayDecide && ` Accepting or turning down a photo needs the ${KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role.`}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {photos.map((doc) => <PhotoReview key={doc.id} doc={doc} mayDecide={mayDecide} onDecided={onDecided} />)}
          </div>
        </>
      )}
    </section>
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

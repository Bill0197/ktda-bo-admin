import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, DataTable, Modal, NotePanel } from "../../ui";
import { omniApi, type DocumentType, type QueuedDocument } from "../../lib/omniApi";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAuth } from "../../lib/auth";
import { canDecideKyc, KYC_DECIDER_ROLES } from "../../lib/tokenConsole/kyc";
import { dateOf, dateTime, label } from "../../lib/tokenConsole/format";

/* The selfie and ID photos a customer sent from the app, decided ones
   included, so compliance can look at them again after the review. Decisions
   are made on the KYC desk; this only lists and shows. Each image is fetched
   only when someone opens it, because omnichannel records every view
   (DOCUMENT_VIEWED), and only the KYC reviewer roles can open one. */

const DOC_LABEL: Record<DocumentType, string> = { SELFIE: "Selfie", ID_FRONT: "ID front", ID_BACK: "ID back" };

const STATUS: Record<QueuedDocument["status"], { tone: "success" | "danger" | "warning"; text: string }> = {
  PASSED: { tone: "success", text: "Accepted" },
  FAILED: { tone: "danger", text: "Turned down" },
  PENDING_REVIEW: { tone: "warning", text: "Waiting" },
};

/** `staff:someone@bank` as omnichannel records the reviewer -> the email. */
const reviewer = (by: string | null) => (by ? by.replace(/^staff:/, "") : "—");

/** For an accounting investor: finds their app profile first. */
export function InvestorPhotos({ investorId }: { investorId: string }) {
  const app = useAsyncData(() => omniApi.applicationFor(investorId));
  if (app.error) return <NotePanel tone="danger">The photos could not be loaded: {app.error}</NotePanel>;
  if (app.loading) return <p className="text-sm text-text-soft">Loading…</p>;
  if (!app.data) return <p className="text-sm text-text-soft">They did not apply through the app, so there are no photos.</p>;
  return <CustomerPhotos profileId={app.data.profileId} />;
}

/** Every photo one app profile sent, newest first. `onKycDesk` drops the
 *  pointer to the KYC desk when the list is already shown there. */
export function CustomerPhotos({ profileId, onKycDesk = false }: { profileId: string; onKycDesk?: boolean }) {
  const { user } = useAuth();
  const mayView = canDecideKyc(user?.tokRoles);
  const docs = useAsyncData(() => omniApi.customerDocuments(profileId));
  const [open, setOpen] = useState<QueuedDocument | null>(null);
  const waiting = (docs.data ?? []).some((d) => d.status === "PENDING_REVIEW");

  if (docs.error) return <NotePanel tone="danger">The photos could not be loaded: {docs.error}</NotePanel>;
  return (
    <>
      <p className="mb-2 text-[12.5px] text-text-faint">
        {mayView
          ? "Opening a photo is recorded as viewing it."
          : `Opening a photo needs the ${KYC_DECIDER_ROLES.map((r) => label(r)).join(" or ")} role.`}
        {waiting && !onKycDesk && <> Photos still waiting are decided on the <Link to="/token-console/kyc" className="font-medium text-primary-600 hover:text-primary-700">KYC desk</Link>.</>}
      </p>
      <DataTable
        rows={docs.data ?? []}
        emptyLabel={docs.loading ? "Loading…" : "No photos sent"}
        columns={[
          { key: "photo", header: "Photo", className: "whitespace-nowrap", render: (d) => <span className="font-medium text-text">{DOC_LABEL[d.type] ?? d.type}</span> },
          { key: "status", header: "Status", className: "whitespace-nowrap", render: (d) => <Badge tone={STATUS[d.status]?.tone ?? "neutral"}>{STATUS[d.status]?.text ?? d.status}</Badge> },
          { key: "sent", header: "Sent", className: "whitespace-nowrap", render: (d) => <span className="tabular text-xs text-text-soft" title={dateTime(d.uploadedAt)}>{dateOf(d.uploadedAt)}</span> },
          { key: "decided", header: "Decided", hideOnMobile: true, render: (d) => d.reviewedAt ? (
            <div className="text-xs text-text-soft">
              <div className="tabular whitespace-nowrap" title={dateTime(d.reviewedAt)}>{dateOf(d.reviewedAt)}</div>
              <div>{reviewer(d.reviewedBy)}</div>
            </div>
          ) : <span className="text-xs text-text-faint">—</span> },
          { key: "note", header: "Note", hideOnMobile: true, render: (d) => <span className="text-xs text-text-soft">{d.reviewNote ?? "—"}</span> },
          { key: "view", header: "", className: "text-right", render: (d) => mayView ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen(d)} data-testid={`view-photo-${d.type}`}>View</Button>
          ) : null },
        ]}
      />
      {open && <PhotoViewer doc={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoViewer({ doc, onClose }: { doc: QueuedDocument; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = DOC_LABEL[doc.type] ?? doc.type;

  useEffect(() => {
    let stale = false;
    let objectUrl: string | null = null;
    omniApi.documentImage(doc.id).then(
      (blob) => {
        if (stale) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      (e: unknown) => { if (!stale) setError(e instanceof Error ? e.message : "The photo could not be loaded."); },
    );
    return () => {
      stale = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id]);

  return (
    <Modal open onClose={onClose} title={`${name} · ${STATUS[doc.status]?.text ?? doc.status}`} size="lg">
      {url ? <img src={url} alt={name} className="mx-auto max-h-[75vh] w-auto object-contain" />
        : <p role={error ? "alert" : undefined} className="py-10 text-center text-sm text-text-soft">{error ?? "Loading…"}</p>}
    </Modal>
  );
}

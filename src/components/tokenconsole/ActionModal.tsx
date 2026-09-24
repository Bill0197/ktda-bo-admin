import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Modal, NotePanel } from "../../ui";

/**
 * One write to the tokenization service, as a dialog: the form (children),
 * the consequence in a sentence, and a submit that stays disabled while the
 * form has a problem or the call is in flight. The error the service returns
 * is shown as it came — it is written to be read.
 *
 * Portalled to <body>, because these open from inside other panels and BO
 * Admin's Modal is not; and Escape closes this dialog only, not the panel
 * underneath with whatever was typed in it.
 */
export function ActionModal({
  title, description, submitLabel, pendingLabel = "Saving…", tone = "primary", problem, showProblem = true, pending, error,
  onSubmit, onClose, size = "md", children,
}: {
  title: string;
  description?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  tone?: "primary" | "danger";
  /** Why the form cannot be submitted yet. Always disables submit. */
  problem?: string;
  /** Whether to say so — false until the user has typed, so a fresh form
   *  doesn't open with a complaint. */
  showProblem?: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      // An open picker list takes the key first (it stops it in this phase too).
      if (document.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')) return;
      if (!pendingRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  return createPortal(
    <Modal
      open
      size={size}
      onClose={() => (pending ? undefined : onClose())}
      title={title}
      footer={
        <>
          {problem && showProblem && <p className="mr-auto self-center text-[12.5px] text-text-soft">{problem}</p>}
          <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="sm" disabled={!!problem || pending} onClick={onSubmit}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!problem && !pending) onSubmit();
        }}
      >
        {description && <div className="mb-4 text-sm text-text-soft">{description}</div>}
        {children}
        {/* Enter submits from any field. */}
        <button type="submit" hidden />
      </form>
      {error && <NotePanel tone="danger" className="mt-4">{error}</NotePanel>}
    </Modal>,
    document.body,
  );
}

/* ---- small parsing helpers shared by the console's forms ---- */

/** A number the user typed, or undefined when blank; NaN when it isn't one. */
export const numberOrBlank = (s: string) => (s.trim() === "" ? undefined : Number(s));
export const isNumber = (s: string) => s.trim() !== "" && Number.isFinite(Number(s));
export const isPositive = (s: string) => isNumber(s) && Number(s) > 0;
export const isWhole = (s: string) => isPositive(s) && Number.isInteger(Number(s));
export const blankToUndefined = (s: string) => (s.trim() === "" ? undefined : s.trim());
/** Today in the viewer's own zone — toISOString() is UTC, and would read as
 *  yesterday for three hours every evening in Nairobi. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

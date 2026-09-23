import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3.5 h-11 text-sm text-text placeholder:text-text-faint outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:bg-surface-sunken";

export function Field({
  label,
  hint,
  error,
  required,
  group,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Render as a labelled group instead of a <label>. For a composite control
   *  (a picker plus a button, a chip list) — a <label> would forward every
   *  click inside it to the first button it contains. */
  group?: boolean;
  children: ReactNode;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className="flex flex-col gap-1.5" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      {label && (
        <span className="text-[13px] font-medium text-text-soft">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-faint">{hint}</span>
      ) : null}
    </Wrapper>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={clsx(fieldBase, invalid && "border-danger focus:border-danger focus:ring-danger/20", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx(fieldBase, "h-auto min-h-[96px] py-2.5 resize-y", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={clsx(fieldBase, "appearance-none bg-[right_0.9rem_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
        checked ? "bg-primary-600" : "bg-border-strong",
      )}
    >
      <span className={clsx("inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-[3px]")} />
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}

/** A tick-box with its label as the hit target.
 *
 * Distinct from `Toggle`: a toggle applies a setting immediately, a checkbox
 * records a decision that only takes effect when the form is submitted —
 * which is exactly what a consent tick-box is. The whole row is the label, so
 * the tap target is the full width rather than a 16px square, and `children`
 * rather than a string so the label can carry a link.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-2.5 select-none", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border border-border-strong bg-surface accent-primary-600 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed"
      />
      <span className="text-[13px] leading-relaxed text-text-soft">{children}</span>
    </label>
  );
}

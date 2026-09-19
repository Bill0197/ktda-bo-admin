import { type ReactNode, useEffect, useId } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              "relative w-full bg-surface border border-border sm:rounded-lg rounded-t-2xl shadow-lg max-h-[90vh] overflow-y-auto",
              size === "sm" && "sm:max-w-sm",
              size === "lg" && "sm:max-w-2xl",
              size === "md" && "sm:max-w-md",
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
                <h3 id={titleId} className="text-sm font-semibold text-text">{title}</h3>
                <button type="button" onClick={onClose} aria-label="Close" className="text-text-faint hover:text-text p-1 -mr-1 rounded-md hover:bg-surface-sunken transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

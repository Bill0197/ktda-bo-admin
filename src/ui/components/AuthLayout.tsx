import type { ReactNode } from "react";
import { AmbientBackdrop } from "./Ambient";

/** Split-screen shell for every login/auth screen — a soft lavender brand
 * panel on desktop (hidden on mobile, where the form panel takes the full
 * screen), and a form panel on the right. Keeps the five apps' auth
 * screens visually consistent without duplicating the layout five times. */
export function AuthLayout({
  eyebrow,
  title,
  description,
  bullets,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: { label: string; icon: ReactNode }[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg lg:flex">
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] relative overflow-hidden bg-primary-50 flex-col justify-between p-12 xl:p-14">
        <AmbientBackdrop />
        <div className="relative z-10 h-11 w-11 rounded-xl brand-mark text-white flex items-center justify-center font-display font-bold animate-float-slow">
          BF
        </div>
        <div className="relative z-10">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600 mb-4">{eyebrow}</div>
          <h1 className="text-3xl xl:text-4xl font-display font-semibold text-gradient leading-[1.15] mb-4">{title}</h1>
          <p className="text-text-soft text-[15px] leading-relaxed">{description}</p>
        </div>
        <div className="relative z-10 flex flex-col gap-3">
          {bullets?.map((b, i) => (
            <div
              key={b.label}
              className="flex items-center gap-3 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
            >
              <div className="h-8 w-8 rounded-lg bg-surface text-primary-600 shadow-sm flex items-center justify-center shrink-0">
                {b.icon}
              </div>
              <span className="text-sm text-text-soft">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-screen lg:min-h-0 relative overflow-hidden p-6">
        {children}
      </div>
    </div>
  );
}

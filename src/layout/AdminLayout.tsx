import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../ui";
import { useContentField } from "../mock";
import { useAuth } from "../lib/auth";
import { navForRole, NAV_DEFS, SECTION_ICONS } from "../lib/navConfig";
import { versionLabel, versionTitle } from "../lib/version";

// Every signed-in user sees every page (see lib/auth.tsx).
const ALL_PAGES = NAV_DEFS.map((n) => n.to);

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const footerNote = useContentField("regulatory_footer", "text", "KTDA Digital Tea Payment Solution.");
  if (!user) return null;

  return (
    <AppShell
      appName="KTDA"
      appTag="Back Office"
      nav={navForRole(ALL_PAGES)}
      user={{ name: user.name, role: user.tokRoles.join(", ") || "Staff", avatarInitials: user.initials }}
      footerNote={
        <>
          <div>{footerNote}</div>
          {/* Which commit is live — so a deploy is verifiable at a glance. */}
          <div className="mt-1.5 font-mono text-[10px] text-text-faint" title={versionTitle()}>{versionLabel()}</div>
        </>
      }
      onLogout={() => { logout(); navigate("/login"); }}
      collapsibleNav
      navStorageKey="ktda-bo"
      sectionIcons={SECTION_ICONS}
    >
      {children}
    </AppShell>
  );
}

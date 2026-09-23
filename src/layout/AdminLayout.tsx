import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../ui";
import { useContentField } from "../mock";
import { useAuth } from "../lib/auth";
import { navForRole, NAV_DEFS, SECTION_ICONS } from "../lib/navConfig";

// Every signed-in user sees every page (see lib/auth.tsx).
const ALL_PAGES = NAV_DEFS.map((n) => n.to);

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const footerNote = useContentField("regulatory_footer", "text", "Bond Retail Fund is regulated by the Capital Markets Authority (CMA).");
  if (!user) return null;

  return (
    <AppShell
      appName="BRF BO Admin"
      appTag="Investcent Investment Bank"
      nav={navForRole(ALL_PAGES)}
      user={{ name: user.name, role: user.tokRoles.join(", ") || "Staff", avatarInitials: user.initials }}
      footerNote={footerNote}
      onLogout={() => { logout(); navigate("/login"); }}
      collapsibleNav
      navStorageKey="bo-admin"
      sectionIcons={SECTION_ICONS}
    >
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../ui";
import { ROLE_PAGE_ACCESS, useContentField } from "../mock";
import { useAuth, ADMIN_USERS, ROLE_LABELS } from "../lib/auth";
import { navForRole, SECTION_ICONS } from "../lib/navConfig";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const footerNote = useContentField("regulatory_footer", "text", "Bond Retail Fund is regulated by the Capital Markets Authority (CMA).");
  if (!role) return null;

  const user = ADMIN_USERS[role];

  return (
    <AppShell
      appName="BRF BO Admin"
      appTag="Investcent Investment Bank"
      nav={navForRole(ROLE_PAGE_ACCESS[role])}
      user={{ name: user.name, role: ROLE_LABELS[role], avatarInitials: user.initials }}
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

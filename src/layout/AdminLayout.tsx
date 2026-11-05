import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../ui";
import { useContentField } from "../mock";
import { useAuth } from "../lib/auth";
import { navForRole, NAV_DEFS, SECTION_ICONS } from "../lib/navConfig";
import { useNavBadges } from "../lib/navBadges";
import { isDemoRoute } from "../lib/dataSource";
import { versionLabel, versionTitle } from "../lib/version";
import { GlobalSearch } from "../components/GlobalSearch";
import { ThemeSwitch } from "../components/ThemeSwitch";

// Every signed-in user sees every page (see lib/auth.tsx).
const ALL_PAGES = NAV_DEFS.map((n) => n.to);

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const badges = useNavBadges();
  const footerNote = useContentField("regulatory_footer", "text", "KTDA Digital Tea Payment Solution.");
  if (!user) return null;

  return (
    <AppShell
      appName="KTDA"
      appTag="Back Office"
      nav={navForRole(ALL_PAGES, badges)}
      user={{ name: user.name, role: user.tokRoles.join(", ") || "Staff", avatarInitials: user.initials }}
      headerStart={<GlobalSearch />}
      headerEnd={<ThemeSwitch />}
      footerNote={
        <>
          {/* Only while the page in view runs on sample data. */}
          {isDemoRoute(pathname) && (
            <div className="mb-1.5 font-medium text-warning" data-testid="demo-footer">Demo data: no real farmers or money</div>
          )}
          <div>{footerNote}</div>
          {/* Which commit is live, so a deploy is verifiable at a glance. */}
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

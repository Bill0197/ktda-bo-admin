import {
  LayoutDashboard, Users, UserPlus, ClipboardCheck, ShieldAlert, FileCheck2, Receipt, GitCompareArrows,
  Wallet, Landmark, UserCog, FileBarChart2, SlidersHorizontal, ToggleLeft, ScrollText, ServerCog,
  MessageSquareWarning, FolderSearch, Radar, CalendarCheck2, Activity, UsersRound, ShieldCheck, Siren, Scale,
  Stamp, Workflow, CircleDollarSign, Briefcase, BarChart3, Settings, Shield, TriangleAlert, FileSearch,
  Fingerprint, BookOpenCheck, Inbox, ListChecks, Megaphone, Blocks, CalendarClock, FileSignature, Percent,
  BadgeCheck, LifeBuoy, HandCoins, KeyRound, ArrowLeftRight, UserCheck, FileSpreadsheet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavItem } from "../ui";
import { isHiddenPage } from "./hiddenPages";

type NavDef = Omit<NavItem, "icon"> & { icon: typeof LayoutDashboard };

/** Every page as the source back office lists it. Kept whole so its changes
 *  still merge; KTDA trims and relabels it below. */
const ALL_NAV_DEFS: NavDef[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Bulk onboarding", to: "/bulk/onboarding", section: "Farmer Payments", icon: UserPlus },
  { label: "Bulk payments", to: "/bulk/payments", section: "Farmer Payments", icon: HandCoins },
  { label: "Clients", to: "/clients", section: "Client Services", icon: Users },
  { label: "Enquiries", to: "/enquiries", section: "Client Services", icon: Inbox },
  { label: "Follow-ups", to: "/tasks", section: "Client Services", icon: ListChecks },
  { label: "Complaints", to: "/complaints", section: "Client Services", icon: MessageSquareWarning },
  { label: "Campaigns", to: "/campaigns", section: "Business Development", icon: Megaphone },
  { label: "KYC Onboarding", to: "/kyc-queue", section: "KYC Review", icon: FileCheck2 },
  { label: "KYC Periodic Review", to: "/kyc-periodic", section: "KYC Review", icon: CalendarCheck2 },
  { label: "Dynamic Review", to: "/kyc-dynamic", section: "KYC Review", icon: Activity },
  { label: "Alerts", to: "/aml-alerts", section: "Transaction Monitoring", icon: ShieldAlert },
  { label: "Case management", to: "/cases", section: "Transaction Monitoring", icon: FolderSearch },
  { label: "Fraud alerts", to: "/fraud-alerts", section: "Fraud Reporting", icon: TriangleAlert },
  { label: "Fraud cases", to: "/fraud-cases", section: "Fraud Reporting", icon: FileSearch },
  { label: "Screening", to: "/screening", section: "Compliance", icon: Radar },
  { label: "Overview", to: "/token-console/overview", section: "Baracel Unyt", icon: LayoutDashboard },
  { label: "Investors", to: "/token-console/investors", section: "Baracel Unyt", icon: Users },
  { label: "Accounts", to: "/token-console/accounts", section: "Baracel Unyt", icon: Wallet },
  { label: "Journals", to: "/token-console/journals", section: "Baracel Unyt", icon: BookOpenCheck },
  { label: "Trial balance", to: "/token-console/trial-balance", section: "Baracel Unyt", icon: Scale },
  { label: "Reconciliation", to: "/token-console/reconciliation", section: "Baracel Unyt", icon: GitCompareArrows },
  { label: "Batch runs", to: "/token-console/runs", section: "Baracel Unyt", icon: CalendarClock },
  { label: "Policies", to: "/token-console/policies", section: "Baracel Unyt", icon: FileSignature },
  { label: "Loans", to: "/token-console/loans", section: "Baracel Unyt", icon: HandCoins },
  { label: "KYC desk", to: "/token-console/kyc", section: "Baracel Unyt", icon: BadgeCheck },
  { label: "Customer desk", to: "/token-console/customers", section: "Baracel Unyt", icon: LifeBuoy },
  { label: "Customer approvals", to: "/token-console/customer-approvals", section: "Baracel Unyt", icon: UserCheck },
  { label: "Transactions", to: "/token-console/transactions", section: "Baracel Unyt", icon: ArrowLeftRight },
  { label: "Review queue", to: "/token-console/compliance", section: "Baracel Unyt", icon: ShieldCheck },
  { label: "Surveillance", to: "/token-console/surveillance", section: "Baracel Unyt", icon: Siren },
  { label: "Reports", to: "/token-console/reports", section: "Baracel Unyt", icon: FileSpreadsheet },
  { label: "Funds", to: "/token-console/funds", section: "Baracel Unyt", icon: Landmark },
  { label: "Tariffs", to: "/token-console/tariffs", section: "Baracel Unyt", icon: Percent },
  { label: "Configuration", to: "/token-console/configuration", section: "Baracel Unyt", icon: SlidersHorizontal },
  { label: "Change approvals", to: "/token-console/changes", section: "Baracel Unyt", icon: ClipboardCheck },
  { label: "Tokenization users", to: "/token-console/users", section: "Baracel Unyt", icon: KeyRound },
  { label: "Approvals", to: "/approvals", section: "Controls", icon: ClipboardCheck },
  { label: "Transactions", to: "/transactions", section: "Operations", icon: Receipt },
  { label: "Reconciliation", to: "/reconciliation", section: "Operations", icon: GitCompareArrows },
  { label: "Unallocated funds", to: "/unallocated-funds", section: "Operations", icon: Wallet },
  { label: "General ledger", to: "/ledger", section: "Finance", icon: BookOpenCheck },
  { label: "Reports", to: "/reports", section: "Reporting", icon: FileBarChart2 },
  { label: "Platform settings", to: "/settings", section: "Platform", icon: SlidersHorizontal },
  { label: "Feature flags", to: "/feature-flags", section: "Platform", icon: ToggleLeft },
  { label: "Users & roles", to: "/users", section: "Admin", icon: UserCog },
  { label: "System", to: "/system", section: "Admin", icon: ServerCog },
  { label: "Audit log", to: "/audit-log", section: "Admin", icon: ScrollText },
];

/** KTDA's names for pages it keeps, by route. */
const KTDA_LABELS: Record<string, string> = {
  "/clients": "Farmers",
  "/token-console/investors": "Farmers",
  "/token-console/funds": "Institutions",
};
/** KTDA's names for sections, where the source's do not fit. */
const KTDA_SECTIONS: Record<string, string> = {
  "Client Services": "Farmer Services",
};

/** The navigation KTDA shows: investment-only pages hidden (hiddenPages.ts),
 *  and the rest relabelled where KTDA's word differs. */
export const NAV_DEFS: NavDef[] = ALL_NAV_DEFS
  .filter((n) => !isHiddenPage(n.to))
  .map((n) => ({
    ...n,
    label: KTDA_LABELS[n.to] ?? n.label,
    section: n.section ? KTDA_SECTIONS[n.section] ?? n.section : n.section,
  }));

export function navForRole(allowedPaths: string[]): NavItem[] {
  return NAV_DEFS.filter((n) => allowedPaths.includes(n.to)).map((n) => ({
    ...n,
    icon: <n.icon size={16} />,
  }));
}

/** Parent-menu icons, one per `section` used above. */
export const SECTION_ICONS: Record<string, ReactNode> = {
  "Client Services": <UsersRound size={16} />,
  "Farmer Services": <UsersRound size={16} />,
  "Business Development": <Briefcase size={16} />,
  "KYC Review": <ShieldCheck size={16} />,
  "Transaction Monitoring": <Siren size={16} />,
  "Fraud Reporting": <Fingerprint size={16} />,
  Compliance: <Scale size={16} />,
  "Farmer Payments": <HandCoins size={16} />,
  "Baracel Unyt": <Blocks size={16} />,
  Controls: <Stamp size={16} />,
  Operations: <Workflow size={16} />,
  Finance: <CircleDollarSign size={16} />,
  Reporting: <BarChart3 size={16} />,
  Platform: <Settings size={16} />,
  Admin: <Shield size={16} />,
};

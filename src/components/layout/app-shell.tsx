"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BookOpen,
  Boxes,
  MessageSquare,
  Fingerprint,
  Swords,
  Sunrise,
  DoorOpen,
  BadgeCheck,
  FlaskConical,
  Banknote,
  Share2,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  Radar,
  ScanSearch,
  Globe,
  GitCompareArrows,
  Sparkles,
  FileText,
  KeyRound,
  Plug,
  Scale,
  Settings,
  ShieldAlert,
  Server,
  Landmark,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { NotificationBell } from "@/components/notification-bell";
import { BrandMark } from "@/components/brand-mark";

const navGroups = [
  {
    label: "Decide",
    items: [
      { label: "Radar", href: "/dashboard", icon: LayoutDashboard },
      { label: "Brief", href: "/brief", icon: Sunrise },
      { label: "Ask VERIQ", href: "/ask", icon: MessageSquare },
      { label: "Decide", href: "/decide", icon: DoorOpen },
    ],
  },
  {
    label: "Truth",
    items: [
      { label: "Truth", href: "/truth", icon: Fingerprint },
      { label: "Challenge", href: "/challenge", icon: Swords },
      { label: "Passport", href: "/passport", icon: BadgeCheck },
      { label: "Score", href: "/score", icon: Scale },
      { label: "Risk Graph", href: "/graph", icon: Share2 },
      { label: "Scenarios", href: "/scenarios", icon: FlaskConical },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Findings", href: "/findings", icon: ShieldAlert },
      { label: "Actions", href: "/actions", icon: ListChecks },
      { label: "Reports", href: "/reports", icon: FileText },
      { label: "Changes", href: "/changes", icon: GitCompareArrows },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "Integrity", href: "/integrity", icon: Landmark },
      { label: "External", href: "/world", icon: Globe },
      { label: "Technology", href: "/technology", icon: Server },
      { label: "Repositories", href: "/repositories", icon: GitBranch },
      { label: "Regulations", href: "/regulations", icon: BookOpen },
      { label: "Vendors", href: "/vendors", icon: Boxes },
      { label: "Finance", href: "/finance", icon: Banknote },
      { label: "AI", href: "/ai", icon: Sparkles },
    ],
  },
  {
    label: "System",
    items: [
      { label: "API", href: "/developers", icon: KeyRound },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Scans", href: "/scans", icon: Activity },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors",
        isActive
          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--ink)]",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { organizations, currentOrg, setCurrentOrgId } = useWorkspace();
  const addingCompany = pathname === "/onboarding";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <BrandMark href="/dashboard" className="text-[1.55rem]" onClick={onNavigate} />
        {organizations.length > 1 && currentOrg ? (
          <select
            value={currentOrg.id}
            onChange={(e) => setCurrentOrgId(e.target.value)}
            className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 py-1.5 text-xs text-[var(--ink)]"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : currentOrg ? (
          <p className="mt-3 truncate text-[12px] text-[var(--muted)]">
            {currentOrg.name}
          </p>
        ) : null}
        <Link
          href="/onboarding"
          onClick={onNavigate}
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors",
            addingCompany
              ? "text-[var(--accent)]"
              : "text-[var(--muted)] hover:text-[var(--ink)]",
          )}
        >
          <Plus className="h-3 w-3" />
          Add company
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] px-4 py-4">
        <p className="font-display text-[15px] italic leading-snug text-[var(--muted)]">
          Before you trust a company, VERIQ it.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentOrg } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] print:hidden md:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 print:hidden md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-[var(--surface)] shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-[var(--muted)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 backdrop-blur-md print:hidden md:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 md:flex md:items-center md:gap-2">
            <Radar className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="truncate text-[13px] text-[var(--ink)]">
              {currentOrg?.name ?? "Workspace"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/scans"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--elevated)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              <ScanSearch className="h-3.5 w-3.5 text-[var(--accent)]" />
              Scan
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto p-5 pb-24 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

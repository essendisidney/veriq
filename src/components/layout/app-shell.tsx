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

const navItems = [
  { label: "Radar", href: "/dashboard", icon: LayoutDashboard },
  { label: "Brief", href: "/brief", icon: Sunrise },
  { label: "Ask VERIQ", href: "/ask", icon: MessageSquare },
  { label: "Score", href: "/score", icon: Scale },
  { label: "Risk Graph", href: "/graph", icon: Share2 },
  { label: "Decide", href: "/decide", icon: DoorOpen },
  { label: "Scenarios", href: "/scenarios", icon: FlaskConical },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Changes", href: "/changes", icon: GitCompareArrows },
  { label: "External", href: "/world", icon: Globe },
  { label: "Integrity", href: "/integrity", icon: Landmark },
  { label: "Truth", href: "/truth", icon: Fingerprint },
  { label: "Challenge", href: "/challenge", icon: Swords },
  { label: "Passport", href: "/passport", icon: BadgeCheck },
  { label: "Findings", href: "/findings", icon: ShieldAlert },
  { label: "Actions", href: "/actions", icon: ListChecks },
  { label: "Technology", href: "/technology", icon: Server },
  { label: "Repositories", href: "/repositories", icon: GitBranch },
  { label: "Regulations", href: "/regulations", icon: BookOpen },
  { label: "Vendors", href: "/vendors", icon: Boxes },
  { label: "Finance", href: "/finance", icon: Banknote },
  { label: "AI", href: "/ai", icon: Sparkles },
  { label: "API", href: "/developers", icon: KeyRound },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Scans", href: "/scans", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--ink)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { organizations, currentOrg, setCurrentOrgId } = useWorkspace();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="font-display text-2xl tracking-tight text-[var(--ink)]"
        >
          VERIQ
        </Link>
        {organizations.length > 1 && currentOrg ? (
          <select
            value={currentOrg.id}
            onChange={(e) => setCurrentOrgId(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 py-1.5 text-xs text-[var(--ink)]"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : currentOrg ? (
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {currentOrg.name}
          </p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
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
      <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] print:hidden md:block">
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
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur print:hidden md:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 md:flex md:items-center md:gap-2">
            <Radar className="h-4 w-4 text-[var(--accent)]" />
            <p className="truncate text-sm text-[var(--ink)]">
              {currentOrg?.name ?? "Workspace"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/scans"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <ScanSearch className="h-4 w-4 text-[var(--accent)]" />
              Scan
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8">{children}</main>
      </div>
    </div>
  );
}

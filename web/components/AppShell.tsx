"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore, ROLE_LABEL, type Role } from "@/lib/store";
import { building } from "@/lib/data";
import { ChatDock } from "@/components/ChatDock";

type NavItem = { href: string; label: string; icon: string; roles: Role[] };

const NAV: NavItem[] = [
  { href: "/overview", label: "ภาพรวม", icon: "grid", roles: ["executive"] },
  { href: "/reports", label: "รายงานค่าไฟ & Anomaly", icon: "chart", roles: ["executive"] },
  { href: "/live", label: "Live Operations", icon: "activity", roles: ["operator"] },
  { href: "/alerts", label: "Peak Alerts & สั่งการ", icon: "bell", roles: ["operator"] },
  { href: "/schedule", label: "แผนเปิด-ปิดแอร์/โซน", icon: "clock", roles: ["operator"] },
  { href: "/actions", label: "มาตรการแนะนำ", icon: "bulb", roles: ["operator", "executive"] },
];

const ICON_PATHS: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chart: "M4 20V10M10 20V4M16 20v-7M20 20H3",
  activity: "M3 12h4l2 6 4-14 2 8h6",
  bell: "M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1.5 1.5 1.5 3h5c0-1.5.5-2 1.5-3a6 6 0 0 0-4-10z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

const HOME: Record<Role, string> = { operator: "/live", executive: "/overview" };

export function AppShell({ children }: { children: ReactNode }) {
  const { role, hydrated, alerts, recs, setRole } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  // route guard: require a role, and keep users inside their allowed routes.
  useEffect(() => {
    if (!hydrated) return;
    if (role === null) {
      router.replace("/");
      return;
    }
    const current = NAV.find((n) => n.href === pathname);
    if (current && !current.roles.includes(role)) {
      router.replace(HOME[role]);
    }
  }, [role, hydrated, pathname, router]);

  if (!hydrated)
    return <div className="grid min-h-screen place-items-center text-sm text-faint">กำลังโหลด…</div>;
  if (role === null) return null;

  const items = NAV.filter((n) => n.roles.includes(role));
  const newAlerts = alerts.filter((a) => a.status === "new").length;
  const pendingRecs = recs.filter((r) => r.status === "pending").length;

  const badge = (href: string) => {
    if (href === "/alerts" && newAlerts) return newAlerts;
    if (href === "/actions" && pendingRecs) return pendingRecs;
    return null;
  };

  const switchRole = () => {
    setRole(null);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-panel px-3 py-4 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-primary/30 bg-primary/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="var(--color-primary)" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold">CU-EnergyBrain</div>
            <div className="text-[10px] text-faint">Energy Management</div>
          </div>
        </div>

        <div className="chip mt-4 flex items-center gap-2 px-2.5 py-2">
          <span className="text-sm">🏢</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-medium text-fg">{building.name_th}</div>
            <div className="text-[10px] text-faint">CU Smart #{building.cusmart_building_id}</div>
          </div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {items.map((n) => {
            const active = pathname === n.href;
            const b = badge(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-primary/10 text-fg"
                    : "text-muted hover:bg-black/[0.04] hover:text-fg"
                }`}
              >
                <span className={active ? "text-primary" : "text-faint"}>
                  <Icon name={n.icon} />
                </span>
                <span className="flex-1">{n.label}</span>
                {b != null && (
                  <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-bg">
                    {b}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-border-soft p-3">
          <div className="text-[10px] uppercase tracking-wider text-faint">เข้าใช้งานในบทบาท</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-medium text-fg">{ROLE_LABEL[role]}</span>
          </div>
          <button
            onClick={switchRole}
            className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-xs text-muted transition hover:text-fg"
          >
            สลับบทบาท
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border-soft bg-bg/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
          <span className="font-display text-sm font-semibold">CU-EnergyBrain</span>
          <span className="chip ml-auto px-2 py-1 text-xs text-muted">{ROLE_LABEL[role]}</span>
          <button onClick={switchRole} className="text-xs text-faint">
            สลับ
          </button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border-soft px-2 py-2 md:hidden">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
                pathname === n.href ? "bg-primary/10 text-fg" : "text-muted"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">{children}</main>
      </div>

      <ChatDock />
    </div>
  );
}

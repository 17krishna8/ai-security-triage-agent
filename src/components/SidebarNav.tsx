"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon: (active: boolean) => React.ReactNode;
}

const ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Findings Queue",
    icon: (active) => (
      <svg
        className={`h-4 w-4 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    href: "/accuracy",
    label: "Accuracy Dashboard",
    badge: "+80 pts",
    badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: (active) => (
      <svg
        className={`h-4 w-4 transition-colors ${active ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/alerts",
    label: "Memory Alerts",
    icon: (active) => (
      <svg
        className={`h-4 w-4 transition-colors ${active ? "text-amber-400" : "text-slate-400 group-hover:text-amber-400"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Org Settings",
    icon: (active) => (
      <svg
        className={`h-4 w-4 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1.5">
      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Navigation
      </div>
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname.startsWith("/findings")
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-all duration-150 ${
              active
                ? "bg-slate-800 text-white font-semibold border border-slate-700/80 shadow-xs"
                : "text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent font-medium"
            }`}
          >
            {active && (
              <span className="absolute -left-[17px] top-2.5 bottom-2.5 w-1 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
            )}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all ${
                  active
                    ? "bg-slate-900 border-slate-600 shadow-inner"
                    : "bg-slate-800/80 border-slate-700/60 group-hover:border-slate-600 group-hover:bg-slate-800"
                }`}
              >
                {item.icon(active)}
              </div>
              <span className="tracking-tight text-[13px]">{item.label}</span>
            </div>

            {item.badge && (
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-tight ${
                  item.badgeColor ?? "border-slate-700 bg-slate-800 text-slate-300"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

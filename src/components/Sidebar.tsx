import Link from "next/link";
import { getSessionContext } from "@/lib/session";
import { OrgUserSwitcher } from "@/components/OrgUserSwitcher";

const NAV = [
  { href: "/", label: "Findings Queue", icon: "🗂️" },
  { href: "/accuracy", label: "Accuracy Dashboard", icon: "📊" },
  { href: "/alerts", label: "Memory Alerts", icon: "🚨" },
  { href: "/settings", label: "Org Settings", icon: "⚙️" },
];

export async function Sidebar() {
  const { org, orgs, orgUsers, user } = await getSessionContext();

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 px-5 py-6 text-slate-100">
      <div>
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-bold text-slate-950">
            T
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">TriageMind</div>
            <div className="text-[11px] text-slate-400">memory-powered triage</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-800 pt-4">
        <OrgUserSwitcher
          orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
          currentOrgId={org.id}
          orgUsers={orgUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
          currentUserId={user?.id ?? null}
        />
        <p className="text-[11px] leading-snug text-slate-500">
          Memory bank: <span className="text-slate-300">{org.memoryBankId}</span>. Scoped strictly to this
          organization — no cross-org memory leakage.
        </p>
      </div>
    </aside>
  );
}

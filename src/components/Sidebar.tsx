import { getSessionContext } from "@/lib/session";
import { SidebarNav } from "@/components/SidebarNav";
import { OrgUserSwitcher } from "@/components/OrgUserSwitcher";

export async function Sidebar() {
  const { org, orgs, orgUsers, user } = await getSessionContext();

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 px-4 py-5 text-slate-100 select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-white shadow-xs">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-bold tracking-tight text-white leading-tight">
                TriageMind
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Autonomous Security Triage
              </div>
            </div>
          </div>
          <span className="rounded border border-slate-700/80 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-300">
            PRO
          </span>
        </div>

        {/* Navigation Buttons */}
        <SidebarNav />
      </div>

      {/* Footer / Enclave Telemetry */}
      <div className="space-y-3.5 border-t border-slate-800/80 pt-4 px-1">
        <OrgUserSwitcher
          orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
          currentOrgId={org.id}
          orgUsers={orgUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
          currentUserId={user?.id ?? null}
        />

        <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-slate-200 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Hindsight Cloud
            </span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
              Connected
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 truncate">
            Bank: {org.memoryBankId}
          </p>
        </div>
      </div>
    </aside>
  );
}

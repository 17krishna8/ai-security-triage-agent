import { db } from "@/db";
import { memoryAlerts } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { desc, eq } from "drizzle-orm";
import { ResolveAlertButton } from "@/components/ResolveAlertButton";
import { SeverityBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const org = await getCurrentOrg();
  const alerts = await db
    .select()
    .from(memoryAlerts)
    .where(eq(memoryAlerts.orgId, org.id))
    .orderBy(desc(memoryAlerts.createdAt));

  const open = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Memory Alerts</h1>
      <p className="mt-1 text-sm text-slate-500">
        Basic poisoning-detection heuristic: flags a reviewer rapidly pushing a large share of &ldquo;ignore&rdquo;
        (false_positive) overrides — a pattern consistent with someone trying to train the memory bank to suppress
        real findings.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {open.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
            No open alerts for {org.name}.
          </div>
        )}
        {open.map((a) => (
          <div key={a.id} className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <SeverityBadge severity={a.severity} />
              <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
              <div className="ml-auto">
                <ResolveAlertButton alertId={a.id} />
              </div>
            </div>
            <p className="text-sm text-slate-800">{a.description}</p>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Resolved</h2>
          <div className="flex flex-col gap-3">
            {resolved.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 opacity-70">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">resolved</span>
                </div>
                {a.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

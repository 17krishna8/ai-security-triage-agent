import { db } from "@/db";
import { findings, memories, users } from "@/db/schema";
import { getSessionContext, listOrganizations } from "@/lib/session";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org } = await getSessionContext();
  const orgs = await listOrganizations();

  const orgUsers = await db.select().from(users).where(eq(users.orgId, org.id));
  const findingCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(findings)
    .where(eq(findings.orgId, org.id));
  const memoryTypeRows = await db
    .select({ memoryType: memories.memoryType, count: sql<number>`count(*)::int` })
    .from(memories)
    .where(eq(memories.orgId, org.id))
    .groupBy(memories.memoryType);

  const totalMemories = memoryTypeRows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Org Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Multi-tenant memory scoping: every org owns a fully isolated memory bank.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Findings ingested</p>
          <p className="mt-1 text-3xl font-semibold text-slate-800">{findingCountRows[0]?.count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Memories retained</p>
          <p className="mt-1 text-3xl font-semibold text-slate-800">{totalMemories}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Memory bank ID</p>
          <p className="mt-1 font-mono text-sm text-slate-700">{org.memoryBankId}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Memory breakdown by type</h2>
        <div className="flex flex-wrap gap-2">
          {memoryTypeRows.map((r) => (
            <span key={r.memoryType} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {r.memoryType}: {r.count}
            </span>
          ))}
          {memoryTypeRows.length === 0 && <p className="text-sm text-slate-400">No memories retained yet.</p>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Team members — {org.name}</h2>
        <ul className="divide-y divide-slate-100">
          {orgUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{u.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">All organizations</h2>
        <ul className="divide-y divide-slate-100">
          {orgs.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2 text-sm">
              <span className={o.id === org.id ? "font-semibold text-slate-900" : "text-slate-600"}>{o.name}</span>
              <span className="font-mono text-xs text-slate-400">{o.memoryBankId}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-800">
        <p className="font-semibold">Known limitations</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Memory poisoning heuristics here are a starting point, not a complete defense (OWASP ASI06).</li>
          <li>Memory can go stale as codebases evolve; no decay/staleness scoring is implemented yet.</li>
          <li>Cross-team/cross-client memory scoping is enforced by org id — verify this assumption before production use.</li>
          <li>Accuracy numbers are against a small synthetic evaluation set — a proof of concept, not a live pilot result.</li>
        </ul>
      </div>
    </div>
  );
}

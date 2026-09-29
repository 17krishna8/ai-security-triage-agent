import Link from "next/link";
import { getCurrentOrg } from "@/lib/session";
import { listFindingsWithLatestVerdict } from "@/lib/queries";
import { DecisionBadge, SeverityBadge, SourceBadge, StatusBadge } from "@/components/Badges";
import { NewFindingForm } from "@/components/NewFindingForm";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "needs_human_review", label: "Needs Human Review" },
  { key: "triaged", label: "Triaged" },
  { key: "resolved", label: "Resolved" },
];

function timeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function FindingsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const org = await getCurrentOrg();
  const rows = await listFindingsWithLatestVerdict(org.id, status || null);

  const counts = {
    pending: rows.filter((r) => r.finding.status === "pending").length,
    needs_human_review: rows.filter((r) => r.finding.status === "needs_human_review").length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Findings Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            {org.name} · {rows.length} finding{rows.length === 1 ? "" : "s"} loaded · {counts.pending} pending ·{" "}
            {counts.needs_human_review} awaiting human sign-off
          </p>
        </div>
        <NewFindingForm />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key ? `/?status=${tab.key}` : "/"}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              (status || "") === tab.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Finding</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">CWE</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Decision</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ finding, latestVerdict, isEval }) => (
              <tr key={finding.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/findings/${finding.id}`} className="font-medium text-slate-900 hover:text-cyan-700">
                    {finding.title}
                  </Link>
                  {isEval && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                      eval set
                    </span>
                  )}
                  {finding.filePath && <div className="mt-0.5 truncate text-xs text-slate-400">{finding.filePath}</div>}
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={finding.source} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{finding.cweType ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={finding.status} />
                </td>
                <td className="px-4 py-3">
                  <DecisionBadge decision={latestVerdict?.decision} />
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={latestVerdict?.severity} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(finding.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No findings match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

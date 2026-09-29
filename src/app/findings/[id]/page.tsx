import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrg } from "@/lib/session";
import { getFindingDetail } from "@/lib/queries";
import { DecisionBadge, SeverityBadge, SourceBadge, StatusBadge } from "@/components/Badges";
import { TriageDetailClient, type FullVerdict } from "@/components/TriageDetailClient";
import type { RecalledMemory } from "@/lib/types";

export const dynamic = "force-dynamic";

function toFullVerdict(v: {
  id: string;
  memoryEnabled: boolean;
  decision: string;
  severity: string | null;
  severityReasoning: string | null;
  suggestedFix: string | null;
  confidence: number | null;
  decisionSource: string;
  requiresHumanSignoff: boolean;
  memoriesRecalled: unknown;
  memoriesUsed: unknown;
  note?: string | null;
}): FullVerdict {
  return {
    id: v.id,
    memoryEnabled: v.memoryEnabled,
    decision: v.decision,
    severity: v.severity ?? "Medium",
    severityReasoning: v.severityReasoning ?? "",
    suggestedFix: v.suggestedFix ?? "",
    confidence: v.confidence ?? 0,
    decisionSource: v.decisionSource,
    requiresHumanSignoff: v.requiresHumanSignoff,
    memoriesRecalled: (v.memoriesRecalled as RecalledMemory[] | null) ?? [],
    memoriesUsed: (v.memoriesUsed as RecalledMemory[] | null) ?? [],
  };
}

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getCurrentOrg();
  const detail = await getFindingDetail(org.id, id);
  if (!detail) notFound();

  const { finding, verdicts, humanOutcomes, fixOutcomes, evalInfo } = detail;

  const latestOn = verdicts.find((v) => v.memoryEnabled);
  const latestOff = verdicts.find((v) => !v.memoryEnabled);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
        ← Back to queue
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{finding.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SourceBadge source={finding.source} />
            <span className="text-xs text-slate-400">{finding.cweType ?? "unclassified"}</span>
            <StatusBadge status={finding.status} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500">Description</p>
          <p className="mt-1 text-sm text-slate-700">{finding.description || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">Evidence</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {finding.evidence || "—"}
          </pre>
        </div>
        {finding.filePath && (
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-slate-500">File path</p>
            <p className="mt-1 font-mono text-xs text-slate-600">{finding.filePath}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <TriageDetailClient
          findingId={finding.id}
          findingStatus={finding.status}
          initialMemoryOn={latestOn ? toFullVerdict(latestOn) : null}
          initialMemoryOff={latestOff ? toFullVerdict(latestOff) : null}
          groundTruth={evalInfo ? { decision: evalInfo.groundTruthDecision, severity: evalInfo.groundTruthSeverity ?? "" } : null}
        />
      </div>

      {(humanOutcomes.length > 0 || fixOutcomes.length > 0) && (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {humanOutcomes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Review history</h3>
              <ul className="flex flex-col gap-3">
                {humanOutcomes.map((h) => (
                  <li key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-700">{h.reviewerName ?? "Unknown reviewer"}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          h.outcome === "overridden" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {h.outcome}
                      </span>
                      <DecisionBadge decision={h.finalDecision} />
                      <SeverityBadge severity={h.finalSeverity} />
                      <span className="ml-auto text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                    {h.overrideReason && <p className="text-slate-600">{h.overrideReason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fixOutcomes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Fix outcomes</h3>
              <ul className="flex flex-col gap-3">
                {fixOutcomes.map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          f.result === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : f.result === "regression"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {f.result}
                      </span>
                      <span className="ml-auto text-slate-400">{new Date(f.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600">{f.fixDescription}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

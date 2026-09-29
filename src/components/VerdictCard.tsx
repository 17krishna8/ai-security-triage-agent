import { DecisionBadge, SeverityBadge } from "@/components/Badges";

export interface VerdictView {
  id?: string;
  memoryEnabled: boolean;
  decision: string;
  severity: string;
  severityReasoning: string;
  suggestedFix: string;
  confidence: number;
  decisionSource: string;
  requiresHumanSignoff: boolean;
  note?: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  heuristic: "Fresh reasoning (no memory match)",
  memory: "Steered by recalled memory",
  llm: "LLM reasoning",
  failsafe: "Fail-safe (error fallback)",
};

export function VerdictCard({ verdict, label }: { verdict: VerdictView | null; label: string }) {
  if (!verdict) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
        <p className="font-medium">{label}</p>
        <p className="mt-1">Not yet triaged in this mode.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            verdict.decisionSource === "memory"
              ? "bg-cyan-100 text-cyan-800"
              : verdict.decisionSource === "failsafe"
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {SOURCE_LABEL[verdict.decisionSource] ?? verdict.decisionSource}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DecisionBadge decision={verdict.decision} />
        <SeverityBadge severity={verdict.severity} />
        <span className="text-xs text-slate-400">confidence {Math.round(verdict.confidence * 100)}%</span>
      </div>

      {verdict.requiresHumanSignoff && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
          🔒 {verdict.note || "This severity always requires human sign-off before resolution."}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-500">Severity reasoning</p>
        <p className="mt-1 text-sm text-slate-700">{verdict.severityReasoning}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500">Suggested fix</p>
        <p className="mt-1 text-sm text-slate-700">{verdict.suggestedFix}</p>
      </div>
    </div>
  );
}

import type { RecalledMemory } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  override: "bg-fuchsia-100 text-fuchsia-800",
  verdict: "bg-slate-100 text-slate-700",
  severity: "bg-amber-100 text-amber-800",
  fix: "bg-emerald-100 text-emerald-800",
  reflection: "bg-indigo-100 text-indigo-800",
};

export function MemoryInspector({
  recalled,
  usedIds,
  memoryEnabled,
}: {
  recalled: RecalledMemory[];
  usedIds: Set<string>;
  memoryEnabled: boolean;
}) {
  if (!memoryEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
        Memory is OFF for this run — recall was skipped entirely, so no memories were retrieved.
      </div>
    );
  }

  if (recalled.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
        No memories cleared the relevance bar for this finding — the agent reasoned from scratch.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {recalled.map((m) => {
        const used = usedIds.has(m.id);
        return (
          <div
            key={m.id}
            className={`rounded-xl border p-3 text-sm ${used ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[m.memoryType] ?? "bg-slate-100 text-slate-700"}`}>
                {m.memoryType}
              </span>
              {m.weight === "high" && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                  high-weight override
                </span>
              )}
              <span className="text-[11px] text-slate-400">similarity {(m.similarity * 100).toFixed(0)}%</span>
              {used ? (
                <span className="ml-auto rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  used in verdict
                </span>
              ) : (
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                  retrieved, not used
                </span>
              )}
            </div>
            <p className="text-slate-700">{m.summary}</p>
          </div>
        );
      })}
    </div>
  );
}

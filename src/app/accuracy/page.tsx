import { getCurrentOrg } from "@/lib/session";
import { computeAccuracy } from "@/lib/accuracy";
import { AccuracyChart } from "@/components/AccuracyChart";
import { DecisionBadge, SeverityBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function AccuracyPage() {
  const org = await getCurrentOrg();
  const result = await computeAccuracy(org.id);

  const lift = Math.round((result.memoryOn.decisionAccuracy - result.memoryOff.decisionAccuracy) * 10) / 10;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Accuracy Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        {org.name} · Memory ON vs Memory OFF against a {result.totalEvalFindings}-finding labeled evaluation set.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <AccuracyChart memoryOn={result.memoryOn} memoryOff={result.memoryOff} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Memory ON decision accuracy</p>
            <p className="mt-1 text-3xl font-semibold text-cyan-900">{result.memoryOn.decisionAccuracy}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Memory OFF decision accuracy</p>
            <p className="mt-1 text-3xl font-semibold text-slate-700">{result.memoryOff.decisionAccuracy}%</p>
          </div>
          <div className={`rounded-2xl border p-5 ${lift >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Memory lift</p>
            <p className={`mt-1 text-3xl font-semibold ${lift >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {lift >= 0 ? "+" : ""}
              {lift} pts
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Finding</th>
              <th className="px-4 py-3 font-medium">Ground truth</th>
              <th className="px-4 py-3 font-medium">Memory ON result</th>
              <th className="px-4 py-3 font-medium">Memory OFF result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.breakdown.map((row) => (
              <tr key={row.findingId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{row.title}</p>
                  <p className="text-xs text-slate-400">{row.cweType}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <DecisionBadge decision={row.groundTruthDecision} />
                    <SeverityBadge severity={row.groundTruthSeverity} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <DecisionBadge decision={row.memoryOn.decision} />
                    <SeverityBadge severity={row.memoryOn.severity} />
                    <span>{row.memoryOn.correct ? "✅" : "❌"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <DecisionBadge decision={row.memoryOff.decision} />
                    <SeverityBadge severity={row.memoryOff.severity} />
                    <span>{row.memoryOff.correct ? "✅" : "❌"}</span>
                  </div>
                </td>
              </tr>
            ))}
            {result.breakdown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                  No labeled evaluation findings for this org yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Honest caveat: this is a proof-of-concept accuracy comparison against a small synthetic evaluation set. Real-world
        accuracy claims require piloting against a live backlog with human-in-the-loop validation.
      </p>
    </div>
  );
}

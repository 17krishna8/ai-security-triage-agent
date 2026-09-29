"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DECISIONS = ["true_positive", "false_positive", "needs_human_review"];
const SEVERITIES = ["Critical", "High", "Medium", "Low", "Info"];

export function OverrideForm({
  findingId,
  verdictOptions,
}: {
  findingId: string;
  verdictOptions: { id: string; label: string; decision: string; severity: string }[];
}) {
  const router = useRouter();
  const [verdictId, setVerdictId] = useState(verdictOptions[0]?.id ?? "");
  const active = verdictOptions.find((v) => v.id === verdictId) ?? verdictOptions[0];
  const [finalDecision, setFinalDecision] = useState(active?.decision ?? "true_positive");
  const [finalSeverity, setFinalSeverity] = useState(active?.severity ?? "Medium");
  const [reason, setReason] = useState("");
  const [fixDescription, setFixDescription] = useState("");
  const [fixResult, setFixResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (verdictOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
        Run triage first to produce a verdict before recording a human decision.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800">
        ✅ Outcome recorded and written back into memory for future triage.
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/overrides/${findingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdictId,
          finalDecision,
          finalSeverity,
          overrideReason: reason || undefined,
          fixDescription: fixDescription || undefined,
          fixResult: fixResult || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit outcome");
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const changed = active && (finalDecision !== active.decision || finalSeverity !== active.severity);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Human review</h3>

      {verdictOptions.length > 1 && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Reviewing which run?
          <select
            value={verdictId}
            onChange={(e) => {
              setVerdictId(e.target.value);
              const opt = verdictOptions.find((v) => v.id === e.target.value);
              if (opt) {
                setFinalDecision(opt.decision);
                setFinalSeverity(opt.severity);
              }
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {verdictOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Final decision
          <select value={finalDecision} onChange={(e) => setFinalDecision(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {DECISIONS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Final severity
          <select value={finalSeverity} onChange={(e) => setFinalSeverity(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Reason {changed && <span className="text-amber-600">(required — this will be an override)</span>}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          required={changed}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Why did you accept/override this verdict? This gets written back into memory."
        />
      </label>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer select-none font-medium text-slate-600">Optionally record fix outcome</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={fixDescription}
            onChange={(e) => setFixDescription(e.target.value)}
            placeholder="Fix applied…"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <select value={fixResult} onChange={(e) => setFixResult(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">No fix result</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="regression">Regression</option>
          </select>
        </div>
      </details>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-60 ${
          changed ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {submitting ? "Saving…" : changed ? "Override verdict" : "Accept verdict"}
      </button>
    </form>
  );
}

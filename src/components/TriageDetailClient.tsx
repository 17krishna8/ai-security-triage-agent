"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictCard, type VerdictView } from "@/components/VerdictCard";
import { MemoryInspector } from "@/components/MemoryInspector";
import { OverrideForm } from "@/components/OverrideForm";
import type { RecalledMemory } from "@/lib/types";

export interface FullVerdict extends VerdictView {
  id: string;
  memoriesRecalled: RecalledMemory[];
  memoriesUsed: RecalledMemory[];
}

export function TriageDetailClient({
  findingId,
  findingStatus,
  initialMemoryOn,
  initialMemoryOff,
  groundTruth,
}: {
  findingId: string;
  findingStatus: string;
  initialMemoryOn: FullVerdict | null;
  initialMemoryOff: FullVerdict | null;
  groundTruth: { decision: string; severity: string } | null;
}) {
  const router = useRouter();
  const [memoryOn, setMemoryOn] = useState(initialMemoryOn);
  const [memoryOff, setMemoryOff] = useState(initialMemoryOff);
  const [loading, setLoading] = useState<"on" | "off" | "both" | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"on" | "off">(initialMemoryOn ? "on" : "off");
  const [error, setError] = useState<string | null>(null);

  async function runTriage(memoryEnabled: boolean) {
    const res = await fetch(`/api/triage/${findingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryEnabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Triage failed");
    }
    const data = await res.json();
    return data.verdict as FullVerdict;
  }

  async function handleRun(mode: "on" | "off" | "both") {
    setLoading(mode);
    setError(null);
    try {
      if (mode === "on" || mode === "both") {
        const v = await runTriage(true);
        setMemoryOn(v);
        setInspectorTab("on");
      }
      if (mode === "off" || mode === "both") {
        const v = await runTriage(false);
        setMemoryOff(v);
        if (mode === "off") setInspectorTab("off");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  const activeInspectorVerdict = inspectorTab === "on" ? memoryOn : memoryOff;
  const usedIds = new Set((activeInspectorVerdict?.memoriesUsed ?? []).map((m) => m.id));

  const verdictOptions = [
    memoryOn && { id: memoryOn.id, label: "Memory ON run", decision: memoryOn.decision, severity: memoryOn.severity },
    memoryOff && { id: memoryOff.id, label: "Memory OFF run", decision: memoryOff.decision, severity: memoryOff.severity },
  ].filter((v): v is { id: string; label: string; decision: string; severity: string } => Boolean(v));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-slate-700">Run triage:</span>
        <button
          onClick={() => handleRun("on")}
          disabled={loading !== null}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-700 disabled:opacity-60"
        >
          {loading === "on" ? "Running…" : "Memory ON"}
        </button>
        <button
          onClick={() => handleRun("off")}
          disabled={loading !== null}
          className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {loading === "off" ? "Running…" : "Memory OFF"}
        </button>
        <button
          onClick={() => handleRun("both")}
          disabled={loading !== null}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {loading === "both" ? "Running…" : "Run both & compare"}
        </button>
        {findingStatus !== "pending" && (
          <span className="ml-auto text-xs text-slate-400">Finding status: {findingStatus.replace(/_/g, " ")}</span>
        )}
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>

      {groundTruth && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-800">
          📋 This finding is part of the labeled evaluation set. Ground truth: <strong>{groundTruth.decision.replace(/_/g, " ")}</strong> /{" "}
          <strong>{groundTruth.severity}</strong>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VerdictCard verdict={memoryOn} label="Memory ON" />
        <VerdictCard verdict={memoryOff} label="Memory OFF" />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Memory Inspector</h2>
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setInspectorTab("on")}
              className={`rounded-full px-3 py-1 ${inspectorTab === "on" ? "bg-slate-900 text-white" : "text-slate-500"}`}
            >
              Memory ON
            </button>
            <button
              onClick={() => setInspectorTab("off")}
              className={`rounded-full px-3 py-1 ${inspectorTab === "off" ? "bg-slate-900 text-white" : "text-slate-500"}`}
            >
              Memory OFF
            </button>
          </div>
        </div>
        <MemoryInspector
          recalled={activeInspectorVerdict?.memoriesRecalled ?? []}
          usedIds={usedIds}
          memoryEnabled={inspectorTab === "on"}
        />
      </div>

      <OverrideForm findingId={findingId} verdictOptions={verdictOptions} />
    </div>
  );
}

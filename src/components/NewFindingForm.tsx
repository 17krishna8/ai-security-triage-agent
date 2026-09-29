"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CWE_OPTIONS = [
  "CWE-79", "CWE-89", "CWE-798", "CWE-22", "CWE-352", "CWE-611", "CWE-502", "CWE-916", "CWE-601", "CVE",
];

export function NewFindingForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      source: form.get("source"),
      cweType: form.get("cweType") || null,
      title: form.get("title"),
      description: form.get("description"),
      evidence: form.get("evidence"),
      filePath: form.get("filePath"),
    };
    try {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create finding");
      }
      const data = await res.json();
      setOpen(false);
      router.push(`/findings/${data.finding.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
      >
        + New Finding
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Ingest a new finding</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          cancel
        </button>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Source
          <select name="source" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" defaultValue="manual">
            <option value="manual">Manual</option>
            <option value="sast">SAST</option>
            <option value="dependency_scan">Dependency Scan</option>
            <option value="bug_bounty">Bug Bounty</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          CWE / Type
          <select name="cweType" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" defaultValue="">
            <option value="">Unknown</option>
            {CWE_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="col-span-full flex flex-col gap-1 text-xs font-medium text-slate-600">
          Title
          <input name="title" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. Reflected XSS in search parameter" />
        </label>
        <label className="col-span-full flex flex-col gap-1 text-xs font-medium text-slate-600">
          Description
          <textarea name="description" rows={2} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="What the scanner/report says..." />
        </label>
        <label className="col-span-full flex flex-col gap-1 text-xs font-medium text-slate-600">
          Evidence / code snippet
          <textarea name="evidence" rows={2} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono" placeholder="Offending line / request..." />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          File path (optional)
          <input name="filePath" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="src/app/..." />
        </label>
        <div className="col-span-full flex items-center justify-between pt-1">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Ingest finding"}
          </button>
        </div>
      </form>
    </div>
  );
}

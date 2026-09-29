const SEVERITY_STYLES: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-300",
  High: "bg-orange-100 text-orange-800 border-orange-300",
  Medium: "bg-amber-100 text-amber-800 border-amber-300",
  Low: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Info: "bg-slate-100 text-slate-700 border-slate-300",
};

const DECISION_STYLES: Record<string, string> = {
  true_positive: "bg-red-100 text-red-800 border-red-300",
  false_positive: "bg-emerald-100 text-emerald-800 border-emerald-300",
  needs_human_review: "bg-violet-100 text-violet-800 border-violet-300",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-300",
  triaged: "bg-blue-100 text-blue-800 border-blue-300",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  needs_human_review: "bg-violet-100 text-violet-800 border-violet-300",
};

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity?: string | null }) {
  if (!severity) return <Badge text="—" className="bg-slate-100 text-slate-500 border-slate-200" />;
  return <Badge text={severity} className={SEVERITY_STYLES[severity] ?? "bg-slate-100 text-slate-700 border-slate-300"} />;
}

export function DecisionBadge({ decision }: { decision?: string | null }) {
  if (!decision) return <Badge text="—" className="bg-slate-100 text-slate-500 border-slate-200" />;
  return (
    <Badge
      text={decision.replace(/_/g, " ")}
      className={DECISION_STYLES[decision] ?? "bg-slate-100 text-slate-700 border-slate-300"}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge text={status.replace(/_/g, " ")} className={STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-300"} />;
}

export function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    sast: "SAST",
    dependency_scan: "Dependency Scan",
    bug_bounty: "Bug Bounty",
    manual: "Manual",
  };
  return <Badge text={labels[source] ?? source} className="bg-slate-100 text-slate-600 border-slate-300" />;
}

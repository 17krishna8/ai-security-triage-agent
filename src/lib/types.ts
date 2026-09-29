export type Decision = "true_positive" | "false_positive" | "needs_human_review";
export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type MemoryType = "verdict" | "severity" | "fix" | "override" | "reflection";
export type MemoryWeight = "normal" | "high";
export type DecisionSource = "heuristic" | "memory" | "llm" | "failsafe";

export interface ParsedFinding {
  id: string;
  orgId: string | null;
  cweType: string;
  title: string;
  summary: string;
  filePath: string | null;
  source: string;
  keywords: string[];
}

export interface MemoryContent {
  findingSummary: string;
  cweType: string;
  decision?: Decision;
  severity?: Severity;
  reasoning?: string;
  fixDescription?: string;
  fixResult?: "success" | "regression" | "partial";
  agentVerdict?: Decision;
  humanVerdict?: Decision;
  outcome?: "confirmed" | "overridden";
}

export interface RecalledMemory {
  id: string;
  memoryType: MemoryType;
  cweType: string | null;
  summary: string;
  content: MemoryContent;
  weight: MemoryWeight;
  similarity: number;
  createdAt: string;
}

export interface Verdict {
  id?: string;
  findingId: string;
  memoryEnabled: boolean;
  decision: Decision;
  severity: Severity;
  severityReasoning: string;
  suggestedFix: string;
  confidence: number;
  decisionSource: DecisionSource;
  requiresHumanSignoff: boolean;
  memoriesRecalled: RecalledMemory[];
  memoriesUsed: RecalledMemory[];
  note?: string;
  llmRawResponse?: unknown;
  createdAt?: string;
}

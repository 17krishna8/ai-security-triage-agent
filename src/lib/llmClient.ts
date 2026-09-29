import type { Decision, ParsedFinding, RecalledMemory, Severity } from "@/lib/types";
import { baseHeuristicCall } from "@/lib/heuristics";
import { seededFloat } from "@/lib/similarity";

export interface LlmDecision {
  decision: Decision;
  severity: Severity;
  severityReasoning: string;
  suggestedFix: string;
  confidence: number;
  decisionSource: "heuristic" | "memory" | "llm";
  memoriesUsed: RecalledMemory[];
  rawResponse: unknown;
}

const VALID_DECISIONS: Decision[] = ["true_positive", "false_positive", "needs_human_review"];
const VALID_SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low", "Info"];

/**
 * Decide whether recalled memories should steer the base call away from the
 * naive/context-blind heuristic. This is where "memory verification before
 * use" happens — only memories that both match on CWE type and clear a
 * similarity bar are allowed to move the verdict; everything else is
 * discarded rather than blindly trusted (spec safeguard #2).
 */
function memoryInformedDecision(finding: ParsedFinding, memories: RecalledMemory[]): LlmDecision {
  const base = baseHeuristicCall(finding);
  const SIMILARITY_FLOOR = 0.18;

  const usable = memories.filter(
    (m) =>
      m.similarity >= SIMILARITY_FLOOR &&
      (m.cweType === finding.cweType || m.cweType === null) &&
      (m.memoryType === "override" || m.memoryType === "verdict" || m.memoryType === "severity" || m.memoryType === "fix")
  );

  if (usable.length === 0) {
    return {
      ...base,
      confidence: Math.round(seededFloat(finding.id + "heuristic", 0.55, 0.72) * 100) / 100,
      decisionSource: "heuristic",
      memoriesUsed: [],
      rawResponse: { mode: "stub-heuristic", note: "no memory cleared the relevance bar; used fresh reasoning only" },
    };
  }

  // Weigh corrective (override) memories most heavily — they represent a
  // human explicitly correcting a past agent mistake for this pattern.
  const overrides = usable.filter((m) => m.memoryType === "override");
  const votes = { decision: new Map<Decision, number>(), severity: new Map<Severity, number>() };

  for (const m of usable) {
    const weight = (m.memoryType === "override" ? 2.0 : 1.0) * (m.weight === "high" ? 1.5 : 1.0) * m.similarity;
    const decision = m.content.humanVerdict ?? m.content.decision;
    const severity = m.content.severity;
    if (decision) votes.decision.set(decision, (votes.decision.get(decision) ?? 0) + weight);
    if (severity) votes.severity.set(severity, (votes.severity.get(severity) ?? 0) + weight);
  }

  const topDecision = [...votes.decision.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSeverity = [...votes.severity.entries()].sort((a, b) => b[1] - a[1])[0];

  const memoryDecision = topDecision ? topDecision[0] : base.decision;
  const memorySeverity = topSeverity ? topSeverity[0] : base.severity;

  const changed = memoryDecision !== base.decision || memorySeverity !== base.severity;
  const citedSummaries = usable
    .slice(0, 3)
    .map((m) => `"${m.summary}" (similarity ${(m.similarity * 100).toFixed(0)}%, ${m.memoryType})`)
    .join("; ");

  const reasoning = changed
    ? `Memory recall found ${usable.length} closely related past case(s) — ${citedSummaries}. Adjusting from the default assessment (${base.decision}/${base.severity}) to ${memoryDecision}/${memorySeverity} based on this team's prior, human-confirmed handling of this exact pattern.`
    : `Memory recall found ${usable.length} related past case(s) that corroborate the default assessment: ${citedSummaries}.`;

  const avgSim = usable.reduce((s, m) => s + m.similarity, 0) / usable.length;
  const confidence = Math.min(0.97, 0.65 + avgSim * 0.3 + (overrides.length > 0 ? 0.08 : 0));

  return {
    decision: memoryDecision,
    severity: memorySeverity,
    severityReasoning: reasoning,
    suggestedFix: usable.find((m) => m.content.fixDescription)?.content.fixDescription ?? base.suggestedFix,
    confidence: Math.round(confidence * 100) / 100,
    decisionSource: "memory",
    memoriesUsed: usable,
    rawResponse: { mode: "stub-memory-informed", votes: Object.fromEntries(votes.decision) },
  };
}

/** Attempt a real Groq call when GROQ_API_KEY is configured; otherwise stays null. */
async function tryGroq(finding: ParsedFinding, memories: RecalledMemory[]): Promise<LlmDecision | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const memoryBlock = memories.length
    ? memories
        .map(
          (m, i) =>
            `[${i + 1}] (${m.memoryType}, similarity ${(m.similarity * 100).toFixed(0)}%) ${m.summary} — content: ${JSON.stringify(m.content)}`
        )
        .join("\n")
    : "No relevant memories were recalled.";

  const system = `You are a security triage analyst. Given a vulnerability finding and a list of related past-decision memories, output ONLY a JSON object with keys: decision (true_positive|false_positive|needs_human_review), severity (Critical|High|Medium|Low|Info), severity_reasoning (string, cite memory numbers like [1] if you used them), suggested_fix (string), confidence (0-1 number), used_memory_indexes (array of integers referencing the memory list, empty if none were relevant).`;
  const user = `Finding:\nCWE type: ${finding.cweType}\nTitle: ${finding.title}\nDetails: ${finding.summary}\nFile: ${finding.filePath ?? "n/a"}\n\nRelated memories:\n${memoryBlock}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);

    if (!VALID_DECISIONS.includes(parsed.decision) || !VALID_SEVERITIES.includes(parsed.severity)) {
      return null; // invalid structured output -> caller fails safe
    }

    const usedIdx: number[] = Array.isArray(parsed.used_memory_indexes) ? parsed.used_memory_indexes : [];
    const memoriesUsed = usedIdx
      .map((i) => memories[i - 1])
      .filter((m): m is RecalledMemory => Boolean(m));

    return {
      decision: parsed.decision,
      severity: parsed.severity,
      severityReasoning: String(parsed.severity_reasoning ?? ""),
      suggestedFix: String(parsed.suggested_fix ?? ""),
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
      decisionSource: memoriesUsed.length > 0 ? "memory" : "llm",
      memoriesUsed,
      rawResponse: data,
    };
  } catch {
    return null;
  }
}

/**
 * decide() — the single entry point the triage engine calls. Tries a real
 * Groq call when a key is configured, and otherwise (or on any failure)
 * falls back to the deterministic stub reasoning engine. This function never
 * throws: callers get either a valid LlmDecision or null (meaning "fail safe").
 */
export async function decide(finding: ParsedFinding, memories: RecalledMemory[]): Promise<LlmDecision | null> {
  try {
    const groqResult = await tryGroq(finding, memories);
    if (groqResult) return groqResult;
    return memoryInformedDecision(finding, memories);
  } catch {
    return null;
  }
}

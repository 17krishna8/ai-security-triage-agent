import { db } from "@/db";
import { findings, organizations, verdicts, humanOutcomes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { memoryBank } from "@/lib/memoryBank";
import { decide } from "@/lib/llmClient";
import { applyCriticalGate, checkPoisoningSignal, failSafeVerdict } from "@/lib/safeguards";
import { parseFindingText } from "@/lib/heuristics";
import type { Decision, RecalledMemory, Severity, Verdict } from "@/lib/types";

type FindingRow = typeof findings.$inferSelect;

/** Look up the org's memoryBankId from the organizations table. */
async function getMemoryBankId(orgId: string | null): Promise<string | undefined> {
  if (!orgId) return undefined;
  const rows = await db.select().from(organizations).where(eq(organizations.id, orgId));
  return rows[0]?.memoryBankId;
}

/**
 * The 4-step triage loop: UNDERSTAND -> RECALL -> DECIDE -> (persist, LEARN
 * happens later when a human reviews the verdict).
 */
export async function runTriage(finding: FindingRow, memoryEnabled: boolean): Promise<Verdict> {
  // 1. UNDERSTAND
  const parsed = parseFindingText(finding);

  // 2. RECALL (skipped entirely when memory is toggled off, for direct comparison)
  let memoriesRecalled: RecalledMemory[] = [];
  if (memoryEnabled) {
    try {
      const memoryBankId = await getMemoryBankId(finding.orgId);
      memoriesRecalled = await memoryBank.recall({
        orgId: finding.orgId!,
        query: parsed.summary,
        cweType: parsed.cweType,
        topK: 5,
        memoryBankId,
      });
    } catch {
      memoriesRecalled = [];
    }
  }

  // 3. DECIDE
  let verdict: Verdict;
  try {
    const result = await decide(parsed, memoriesRecalled);
    if (!result) {
      verdict = failSafeVerdict(finding.id, memoryEnabled, "empty/invalid model output");
    } else {
      verdict = {
        findingId: finding.id,
        memoryEnabled,
        decision: result.decision as Decision,
        severity: result.severity as Severity,
        severityReasoning: result.severityReasoning,
        suggestedFix: result.suggestedFix,
        confidence: result.confidence,
        decisionSource: result.decisionSource,
        requiresHumanSignoff: false,
        memoriesRecalled,
        memoriesUsed: result.memoriesUsed,
        llmRawResponse: result.rawResponse,
      };
    }
  } catch (err) {
    verdict = failSafeVerdict(finding.id, memoryEnabled, err instanceof Error ? err.message : "unknown error");
  }

  // Safeguard: critical-finding human gate (never bypassed, memory or not)
  verdict = applyCriticalGate(verdict);
  return verdict;
}

/** Dry-run version used by the accuracy dashboard: computes a verdict without writing to the DB. */
export async function dryRunTriage(finding: FindingRow, memoryEnabled: boolean): Promise<Verdict> {
  return runTriage(finding, memoryEnabled);
}

/** Runs triage and persists the resulting verdict row + finding status update. */
export async function runAndPersistTriage(findingId: string, memoryEnabled: boolean): Promise<Verdict> {
  const rows = await db.select().from(findings).where(eq(findings.id, findingId));
  const finding = rows[0];
  if (!finding) throw new Error("Finding not found");

  const verdict = await runTriage(finding, memoryEnabled);

  const [saved] = await db
    .insert(verdicts)
    .values({
      findingId,
      memoryEnabled: verdict.memoryEnabled,
      decision: verdict.decision,
      severity: verdict.severity,
      severityReasoning: verdict.severityReasoning,
      suggestedFix: verdict.suggestedFix,
      confidence: verdict.confidence,
      decisionSource: verdict.decisionSource,
      requiresHumanSignoff: verdict.requiresHumanSignoff,
      memoriesRecalled: verdict.memoriesRecalled,
      memoriesUsed: verdict.memoriesUsed,
      llmRawResponse: verdict.llmRawResponse ?? null,
    })
    .returning();

  const newStatus = verdict.decision === "needs_human_review" || verdict.requiresHumanSignoff ? "needs_human_review" : "triaged";
  await db.update(findings).set({ status: newStatus }).where(eq(findings.id, findingId));

  return { ...verdict, id: saved.id, createdAt: saved.createdAt.toISOString() };
}

/** LEARN step — a human accepts/overrides a verdict; the outcome is written back into memory. */
export async function recordHumanOutcome(params: {
  findingId: string;
  verdictId: string;
  reviewerId: string;
  finalDecision: Decision;
  finalSeverity: Severity;
  overrideReason?: string;
}) {
  const findingRows = await db.select().from(findings).where(eq(findings.id, params.findingId));
  const finding = findingRows[0];
  if (!finding) throw new Error("Finding not found");

  const verdictRows = await db.select().from(verdicts).where(eq(verdicts.id, params.verdictId));
  const agentVerdict = verdictRows[0];
  if (!agentVerdict) throw new Error("Verdict not found");

  const outcome =
    agentVerdict.decision === params.finalDecision && agentVerdict.severity === params.finalSeverity
      ? "confirmed"
      : "overridden";

  const [saved] = await db
    .insert(humanOutcomes)
    .values({
      findingId: params.findingId,
      verdictId: params.verdictId,
      reviewerId: params.reviewerId,
      finalDecision: params.finalDecision,
      finalSeverity: params.finalSeverity,
      outcome,
      overrideReason: params.overrideReason ?? null,
    })
    .returning();

  const parsed = parseFindingText(finding);
  const memoryBankId = await getMemoryBankId(finding.orgId);

  await memoryBank.retain({
    orgId: finding.orgId!,
    findingId: finding.id,
    memoryType: outcome === "overridden" ? "override" : "verdict",
    cweType: parsed.cweType,
    summary: `${finding.title} — ${parsed.summary.slice(0, 180)}`,
    content: {
      findingSummary: parsed.summary,
      cweType: parsed.cweType,
      agentVerdict: agentVerdict.decision as Decision,
      humanVerdict: params.finalDecision,
      decision: params.finalDecision,
      severity: params.finalSeverity,
      outcome,
      reasoning: params.overrideReason || `Human ${outcome} the agent's verdict.`,
    },
    weight: outcome === "overridden" ? "high" : "normal",
    sourceUserId: params.reviewerId,
    memoryBankId,
  });

  await db
    .update(findings)
    .set({ status: "resolved" })
    .where(eq(findings.id, params.findingId));

  await checkPoisoningSignal(finding.orgId!, params.reviewerId);

  return saved;
}

import { db } from "@/db";
import { humanOutcomes, memoryAlerts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Verdict } from "@/lib/types";

const HIGH_SEVERITIES = new Set(["Critical", "High"]);

/**
 * Critical-finding human gate: Critical/High severity is NEVER treated as
 * auto-resolved, no matter how confident memory or the LLM is. The agent's
 * decision is still shown as a recommendation, but `requiresHumanSignoff`
 * forces the finding to stay in `needs_human_review` until a person signs off.
 */
export function applyCriticalGate(verdict: Verdict): Verdict {
  const requiresHumanSignoff = HIGH_SEVERITIES.has(verdict.severity) || verdict.decision === "needs_human_review";
  if (requiresHumanSignoff && verdict.decision !== "needs_human_review") {
    return {
      ...verdict,
      requiresHumanSignoff: true,
      note: `${verdict.severity} severity findings always require human sign-off before resolution, regardless of confidence.`,
    };
  }
  return { ...verdict, requiresHumanSignoff };
}

/** Fail-safe verdict used whenever the decision pipeline throws or returns invalid output. */
export function failSafeVerdict(findingId: string, memoryEnabled: boolean, reason: string): Verdict {
  return {
    findingId,
    memoryEnabled,
    decision: "needs_human_review",
    severity: "Medium",
    severityReasoning: `Automated triage could not produce a confident verdict (${reason}). Failing safe to human review instead of guessing.`,
    suggestedFix: "Manual triage required.",
    confidence: 0,
    decisionSource: "failsafe",
    requiresHumanSignoff: true,
    memoriesRecalled: [],
    memoriesUsed: [],
    note: "Fail-safe engaged: never silently approve or drop a finding on error.",
  };
}

const POISON_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const POISON_MIN_COUNT = 5;
const POISON_MIN_RATIO = 0.7;

/**
 * Poisoning-detection heuristic: flags a reviewer who is rapidly pushing a
 * large volume of "ignore" (false_positive) overrides, especially across
 * many different CWE types — a pattern consistent with someone trying to
 * train the memory bank to suppress real findings.
 */
export async function checkPoisoningSignal(orgId: string, reviewerId: string): Promise<void> {
  const reviewerRows = await db.select().from(users).where(eq(users.id, reviewerId));
  const reviewer = reviewerRows[0];
  if (!reviewer) return;

  const rows = await db.select().from(humanOutcomes).where(eq(humanOutcomes.reviewerId, reviewerId));
  const now = Date.now();
  const recent = rows.filter((r) => now - new Date(r.createdAt).getTime() <= POISON_WINDOW_MS);
  if (recent.length === 0) return;

  const dismissals = recent.filter((r) => r.finalDecision === "false_positive" && r.outcome === "overridden");
  const ratio = dismissals.length / recent.length;

  if (dismissals.length >= POISON_MIN_COUNT && ratio >= POISON_MIN_RATIO) {
    const existing = await db.select().from(memoryAlerts).where(eq(memoryAlerts.orgId, orgId));
    const already = existing.some(
      (a) => !a.resolved && a.description?.includes(reviewer.name) && a.description?.includes("suspicious override pattern")
    );
    if (!already) {
      await db.insert(memoryAlerts).values({
        orgId,
        description: `Reviewer "${reviewer.name}" shows a suspicious override pattern: ${dismissals.length}/${recent.length} recent overrides (${Math.round(ratio * 100)}%) dismissed findings as false_positive. This memory bank may be getting poisoned toward silently ignoring real findings — review before trusting further overrides from this reviewer.`,
        severity: "High",
        resolved: false,
      });
    }
  }
}

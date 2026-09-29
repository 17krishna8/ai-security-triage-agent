import { db } from "@/db";
import { memories, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getHindsightClient, orgBankId } from "@/lib/hindsightClient";
import { NextResponse } from "next/server";
import type { MemoryContent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/memory/sync
 *
 * One-time sync: pushes all Postgres memories into Hindsight memory banks.
 * Also creates the Hindsight banks if they don't already exist.
 * Useful after initial seed or when Hindsight credentials are first configured.
 */
export async function POST() {
  const hindsight = getHindsightClient();
  if (!hindsight) {
    return NextResponse.json(
      { error: "HINDSIGHT_BASE_URL not configured" },
      { status: 400 }
    );
  }

  const orgs = await db.select().from(organizations);
  const results: { org: string; bankId: string; synced: number; errors: number; details?: string[] }[] = [];

  for (const org of orgs) {
    const bankId = orgBankId(org.memoryBankId);
    const mission = `You are the memory system for a security vulnerability triage agent serving the "${org.name}" team. Your job is to remember past triage decisions, human overrides, severity adjustments, and fix outcomes so the agent can learn from this team's specific patterns and preferences. When recalling memories, prioritize human override memories (where a reviewer corrected the agent) as these are the most valuable signals for improving future decisions.`;

    // Try to create the bank (may already exist — that's fine)
    try {
      await hindsight.createBank(bankId, {
        name: `Security Triage — ${org.name}`,
        reflectMission: mission,
        retainMission: "Extract security triage decisions, CWE types, severity levels, false positive determinations, and reviewer reasoning.",
        dispositionSkepticism: 4,
        dispositionLiteralism: 4,
        dispositionEmpathy: 2,
      });
    } catch (createErr) {
      console.log(`[hindsight-sync] Bank ${bankId} may already exist:`, (createErr as Error).message);
    }

    // Sync all memories for this org
    const rows = await db.select().from(memories).where(eq(memories.orgId, org.id));
    let synced = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const row of rows) {
      const content = row.content as MemoryContent;
      const retainContent = `[${row.memoryType.toUpperCase()}] ${row.summary}\n\nCWE: ${row.cweType ?? "N/A"}\nDecision: ${content.decision ?? "N/A"}\nSeverity: ${content.severity ?? "N/A"}\nReasoning: ${content.reasoning ?? "N/A"}${content.fixDescription ? `\nFix: ${content.fixDescription}` : ""}`;

      try {
        await hindsight.retain(bankId, retainContent, {
          context: `security-triage ${row.memoryType}`,
          timestamp: row.createdAt,
          metadata: {
            memoryType: row.memoryType,
            cweType: row.cweType ?? "unknown",
            weight: row.weight ?? "normal",
            findingId: row.findingId ?? "",
            sourceUserId: row.sourceUserId ?? "",
            content: JSON.stringify(content),
            postgresMemoryId: row.id,
            createdAt: row.createdAt.toISOString(),
          },
          async: false,
        });
        synced++;
      } catch (err) {
        console.error(`[hindsight-sync] Failed to sync memory ${row.id}:`, err);
        errors++;
        errorDetails.push(`ID ${row.id}: ${(err as Error).message}`);
      }
    }

    results.push({ org: org.name, bankId, synced, errors, ...(errorDetails.length ? { details: errorDetails } : {}) });
  }

  return NextResponse.json({ ok: true, results });
}

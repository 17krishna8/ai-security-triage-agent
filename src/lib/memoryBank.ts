import { db } from "@/db";
import { memories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { textSimilarity } from "@/lib/similarity";
import { getHindsightClient, orgBankId } from "@/lib/hindsightClient";
import type { MemoryContent, MemoryType, MemoryWeight, RecalledMemory } from "@/lib/types";

/**
 * MemoryBank — the ONLY module that reads/writes the memory store.
 *
 * This implements the "Hindsight wrapper" described in the architecture
 * blueprint: `recall()` / `retain()` / `reflect()` are the three verbs
 * every other module is allowed to use.
 *
 * When HINDSIGHT_BASE_URL is configured, all three operations are routed
 * through the real Hindsight SDK (with Postgres used as an audit log).
 * When it's not configured, the original Postgres-only implementation is
 * used as a fallback so the app can still run locally without signup.
 */
export const memoryBank = {
  /**
   * Recall the top-k memories in an org's bank that are semantically close
   * to `query`.
   */
  async recall(params: {
    orgId: string;
    query: string;
    cweType?: string | null;
    topK?: number;
    memoryBankId?: string;
  }): Promise<RecalledMemory[]> {
    const { orgId, query, cweType, topK = 5, memoryBankId } = params;

    // ── Hindsight path ──────────────────────────────────────────────
    const hindsight = getHindsightClient();
    if (hindsight && memoryBankId) {
      try {
        const bankId = orgBankId(memoryBankId);
        const response = await hindsight.recall(bankId, query, {
          maxTokens: 4096,
          budget: "high",
        });

        // Map Hindsight results back to our RecalledMemory shape
        const results: RecalledMemory[] = (response.results ?? [])
          .slice(0, topK)
          .map((r: any, idx: number) => {
            const metadata = (r.metadata ?? {}) as Record<string, unknown>;
            const rawCwe =
              (metadata.cweType as string) ??
              r.entities?.find?.((e: string) => /^cwe-\d+/i.test(e)) ??
              (r.text?.match(/CWE-\d+/i)?.[0]) ??
              null;

            let content: MemoryContent;
            if (typeof metadata.content === "string") {
              try {
                content = JSON.parse(metadata.content);
              } catch {
                content = { findingSummary: r.text ?? "", cweType: rawCwe ?? "unknown" };
              }
            } else if (metadata.content && typeof metadata.content === "object") {
              content = metadata.content as MemoryContent;
            } else {
              content = {
                findingSummary: r.text ?? "",
                cweType: rawCwe ?? "unknown",
                reasoning: r.text ?? "",
              };
            }

            const rawScore = r.scores?.final ?? r.score ?? 0.5;
            const normalizedSim = Math.min(1, Math.max(0, typeof rawScore === "number" ? rawScore : 0.5));

            return {
              id: r.id ?? `hs-${idx}`,
              memoryType: ((metadata.memoryType as string) ?? (r.text?.includes("[OVERRIDE]") ? "override" : "verdict")) as MemoryType,
              cweType: rawCwe,
              summary: r.text ?? "",
              content,
              weight: ((metadata.weight as string) ?? "normal") as MemoryWeight,
              similarity: Math.round(normalizedSim * 1000) / 1000,
              createdAt: (metadata.createdAt as string) ?? new Date().toISOString(),
            } satisfies RecalledMemory;
          });

        // Apply CWE boost (same logic as Postgres path) for consistency
        for (const m of results) {
          if (cweType && m.cweType && m.cweType.toLowerCase() === cweType.toLowerCase()) {
            m.similarity = Math.min(1, m.similarity * 1.35 + 0.12);
          }
        }

        return results.filter((m) => m.similarity > 0.03);
      } catch (err) {
        console.error("[hindsight] recall failed, falling back to Postgres:", err);
        // fall through to Postgres
      }
    }

    // ── Postgres fallback path ──────────────────────────────────────
    // Memory is strictly scoped to the org's own bank — this is the
    // multi-tenant isolation guarantee: one org's memory can never leak
    // into another org's recall results.
    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.orgId, orgId))
      .orderBy(desc(memories.createdAt))
      .limit(500);

    const scored = rows.map((row) => {
      const content = row.content as MemoryContent;
      let sim = textSimilarity(query, row.summary);
      // Reward an exact CWE-type match — a strong structural signal that a
      // pure text-embedding search would otherwise under-weight.
      if (cweType && row.cweType && row.cweType === cweType) {
        sim = Math.min(1, sim * 1.35 + 0.12);
      }
      // High-weight memories (human overrides) get a modest visibility boost,
      // same idea as Hindsight's importance-weighted retrieval.
      if (row.weight === "high") {
        sim = Math.min(1, sim + 0.05);
      }
      return {
        id: row.id,
        memoryType: row.memoryType as MemoryType,
        cweType: row.cweType,
        summary: row.summary,
        content,
        weight: row.weight as MemoryWeight,
        similarity: Math.round(sim * 1000) / 1000,
        createdAt: row.createdAt.toISOString(),
      } satisfies RecalledMemory;
    });

    return scored
      .filter((m) => m.similarity > 0.03)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  },

  /**
   * Persist a new memory (verdict / severity / fix / override / reflection).
   * Writes to both Hindsight (when available) and Postgres (always, as audit log).
   */
  async retain(params: {
    orgId: string;
    findingId?: string | null;
    memoryType: MemoryType;
    cweType?: string | null;
    summary: string;
    content: MemoryContent;
    weight?: MemoryWeight;
    sourceUserId?: string | null;
    memoryBankId?: string;
  }) {
    // ── Always write to Postgres (audit log + fallback) ─────────────
    const [row] = await db
      .insert(memories)
      .values({
        orgId: params.orgId,
        findingId: params.findingId ?? null,
        memoryType: params.memoryType,
        cweType: params.cweType ?? null,
        summary: params.summary,
        content: params.content,
        weight: params.weight ?? "normal",
        sourceUserId: params.sourceUserId ?? null,
      })
      .returning();

    // ── Hindsight path ──────────────────────────────────────────────
    const hindsight = getHindsightClient();
    if (hindsight && params.memoryBankId) {
      try {
        const bankId = orgBankId(params.memoryBankId);
        const retainContent = `[${params.memoryType.toUpperCase()}] ${params.summary}\n\nCWE: ${params.cweType ?? "N/A"}\nDecision: ${params.content.decision ?? "N/A"}\nSeverity: ${params.content.severity ?? "N/A"}\nReasoning: ${params.content.reasoning ?? "N/A"}${params.content.fixDescription ? `\nFix: ${params.content.fixDescription}` : ""}`;

        await hindsight.retain(bankId, retainContent, {
          context: `security-triage ${params.memoryType}`,
          metadata: {
            memoryType: params.memoryType,
            cweType: params.cweType ?? "unknown",
            weight: params.weight ?? "normal",
            findingId: params.findingId ?? "",
            sourceUserId: params.sourceUserId ?? "",
            postgresMemoryId: row.id,
            createdAt: row.createdAt.toISOString(),
            content: JSON.stringify(params.content),
          },
          async: false,
        });
      } catch (err) {
        console.error("[hindsight] retain failed (Postgres write succeeded):", err);
      }
    }

    return row;
  },

  /**
   * Reflect — periodic batch summarization of accumulated memories into a
   * higher-level pattern memory. When Hindsight is available, uses its
   * reflect() for AI-powered reasoning; otherwise falls back to the
   * manual aggregation logic.
   */
  async reflect(orgId: string, memoryBankId?: string) {
    // ── Hindsight path ──────────────────────────────────────────────
    const hindsight = getHindsightClient();
    if (hindsight && memoryBankId) {
      try {
        const bankId = orgBankId(memoryBankId);
        const answer = await hindsight.reflect(
          bankId,
          "Analyze all security triage memories and identify recurring patterns. For each CWE type with multiple overrides, summarize: (1) whether this team tends to downgrade or upgrade findings of that type, (2) the ratio of overrides, and (3) what reasoning they consistently apply. Format each pattern as a concise summary suitable for informing future triage decisions.",
          { budget: "high" }
        );

        // Parse the reflect response into our summaries format
        if (answer.text) {
          return [
            {
              cweType: "all",
              summary: answer.text,
              source: "hindsight" as const,
            },
          ];
        }
      } catch (err) {
        console.error("[hindsight] reflect failed, falling back to manual aggregation:", err);
      }
    }

    // ── Postgres fallback path ──────────────────────────────────────
    const rows = await db
      .select()
      .from(memories)
      .where(and(eq(memories.orgId, orgId), eq(memories.memoryType, "override")));

    const byCwe = new Map<string, { total: number; downgraded: number; upgraded: number }>();
    for (const row of rows) {
      const content = row.content as MemoryContent;
      const cwe = row.cweType ?? "unknown";
      const bucket = byCwe.get(cwe) ?? { total: 0, downgraded: 0, upgraded: 0 };
      bucket.total += 1;
      if (content.agentVerdict === "true_positive" && content.humanVerdict === "false_positive") {
        bucket.downgraded += 1;
      }
      if (content.agentVerdict === "false_positive" && content.humanVerdict === "true_positive") {
        bucket.upgraded += 1;
      }
      byCwe.set(cwe, bucket);
    }

    const summaries: { cweType: string; summary: string }[] = [];
    for (const [cwe, bucket] of byCwe) {
      if (bucket.total < 2) continue;
      if (bucket.downgraded / bucket.total >= 0.5) {
        summaries.push({
          cweType: cwe,
          summary: `This team has downgraded/dismissed ${cwe} findings in ${bucket.downgraded}/${bucket.total} past overrides — review context carefully before flagging as high severity.`,
        });
      } else if (bucket.upgraded / bucket.total >= 0.5) {
        summaries.push({
          cweType: cwe,
          summary: `This team has upgraded ${cwe} findings in ${bucket.upgraded}/${bucket.total} past overrides — do not under-call these.`,
        });
      }
    }
    return summaries;
  },
};

import { db } from "@/db";
import { evalFindings, findings, fixOutcomes, humanOutcomes, users, verdicts } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function getFindingDetail(orgId: string, findingId: string) {
  const findingRows = await db.select().from(findings).where(eq(findings.id, findingId));
  const finding = findingRows[0];
  if (!finding || finding.orgId !== orgId) return null;

  const verdictRows = await db
    .select()
    .from(verdicts)
    .where(eq(verdicts.findingId, findingId))
    .orderBy(desc(verdicts.createdAt));

  const outcomeRows = await db
    .select({
      id: humanOutcomes.id,
      verdictId: humanOutcomes.verdictId,
      finalDecision: humanOutcomes.finalDecision,
      finalSeverity: humanOutcomes.finalSeverity,
      outcome: humanOutcomes.outcome,
      overrideReason: humanOutcomes.overrideReason,
      createdAt: humanOutcomes.createdAt,
      reviewerName: users.name,
    })
    .from(humanOutcomes)
    .leftJoin(users, eq(users.id, humanOutcomes.reviewerId))
    .where(eq(humanOutcomes.findingId, findingId))
    .orderBy(desc(humanOutcomes.createdAt));

  const fixRows = await db
    .select()
    .from(fixOutcomes)
    .where(eq(fixOutcomes.findingId, findingId))
    .orderBy(desc(fixOutcomes.createdAt));

  const evalRows = await db.select().from(evalFindings).where(eq(evalFindings.findingId, findingId));

  return {
    finding,
    verdicts: verdictRows,
    humanOutcomes: outcomeRows,
    fixOutcomes: fixRows,
    evalInfo: evalRows[0] ?? null,
  };
}

export async function listFindingsWithLatestVerdict(orgId: string, status?: string | null) {
  const rows = await db
    .select()
    .from(findings)
    .where(eq(findings.orgId, orgId))
    .orderBy(desc(findings.createdAt));

  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  if (filtered.length === 0) return [];

  const ids = filtered.map((f) => f.id);
  const verdictRows = await db.select().from(verdicts).where(inArray(verdicts.findingId, ids));
  const evalRows = await db.select().from(evalFindings).where(inArray(evalFindings.findingId, ids));
  const evalSet = new Set(evalRows.map((e) => e.findingId));

  const latestByFinding = new Map<string, typeof verdictRows>();
  for (const v of verdictRows) {
    const list = latestByFinding.get(v.findingId!) ?? [];
    list.push(v);
    latestByFinding.set(v.findingId!, list);
  }

  return filtered.map((f) => {
    const list = (latestByFinding.get(f.id) ?? []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      finding: f,
      latestVerdict: list[0] ?? null,
      isEval: evalSet.has(f.id),
    };
  });
}

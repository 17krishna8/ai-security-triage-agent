import { db } from "@/db";
import { findings, verdicts } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getCurrentOrg();
  const findingRows = await db.select().from(findings).where(eq(findings.id, id));
  const finding = findingRows[0];
  if (!finding || finding.orgId !== org.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const verdictId = req.nextUrl.searchParams.get("verdictId");
  let verdict;
  if (verdictId) {
    const rows = await db.select().from(verdicts).where(eq(verdicts.id, verdictId));
    verdict = rows[0];
  } else {
    const rows = await db
      .select()
      .from(verdicts)
      .where(eq(verdicts.findingId, id))
      .orderBy(desc(verdicts.createdAt))
      .limit(1);
    verdict = rows[0];
  }

  if (!verdict) return NextResponse.json({ recalled: [], used: [] });

  return NextResponse.json({
    verdictId: verdict.id,
    memoryEnabled: verdict.memoryEnabled,
    recalled: verdict.memoriesRecalled ?? [],
    used: verdict.memoriesUsed ?? [],
  });
}

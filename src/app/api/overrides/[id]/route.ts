import { db } from "@/db";
import { findings, fixOutcomes } from "@/db/schema";
import { getCurrentOrg, getCurrentUser } from "@/lib/session";
import { recordHumanOutcome } from "@/lib/triageEngine";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { Decision, Severity } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set<Decision>(["true_positive", "false_positive", "needs_human_review"]);
const VALID_SEVERITIES = new Set<Severity>(["Critical", "High", "Medium", "Low", "Info"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getCurrentOrg();
  const rows = await db.select().from(findings).where(eq(findings.id, id));
  const finding = rows[0];
  if (!finding || finding.orgId !== org.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.verdictId || !VALID_DECISIONS.has(body.finalDecision) || !VALID_SEVERITIES.has(body.finalSeverity)) {
    return NextResponse.json({ error: "verdictId, finalDecision and finalSeverity are required and must be valid" }, { status: 400 });
  }

  const reviewer = await getCurrentUser(org.id);
  if (!reviewer) return NextResponse.json({ error: "no reviewer available for this org" }, { status: 400 });

  const saved = await recordHumanOutcome({
    findingId: id,
    verdictId: body.verdictId,
    reviewerId: reviewer.id,
    finalDecision: body.finalDecision,
    finalSeverity: body.finalSeverity,
    overrideReason: body.overrideReason,
  });

  if (body.fixDescription && body.fixResult) {
    await db.insert(fixOutcomes).values({
      findingId: id,
      fixDescription: body.fixDescription,
      result: body.fixResult,
      notes: body.fixNotes || null,
    });
  }

  return NextResponse.json({ outcome: saved });
}

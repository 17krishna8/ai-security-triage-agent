import { db } from "@/db";
import { findings, verdicts } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { runAndPersistTriage } from "@/lib/triageEngine";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function assertOwnedFinding(id: string) {
  const org = await getCurrentOrg();
  const rows = await db.select().from(findings).where(eq(findings.id, id));
  const finding = rows[0];
  if (!finding || finding.orgId !== org.id) return null;
  return finding;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finding = await assertOwnedFinding(id);
  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(verdicts)
    .where(eq(verdicts.findingId, id))
    .orderBy(desc(verdicts.createdAt));

  const latestWithMemory = rows.find((r) => r.memoryEnabled);
  const latestWithoutMemory = rows.find((r) => !r.memoryEnabled);

  return NextResponse.json({ finding, verdicts: rows, latestWithMemory, latestWithoutMemory });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finding = await assertOwnedFinding(id);
  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const memoryEnabled = body.memoryEnabled !== false;

  try {
    const verdict = await runAndPersistTriage(id, memoryEnabled);
    return NextResponse.json({ verdict });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "triage failed" },
      { status: 500 }
    );
  }
}

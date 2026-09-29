import { db } from "@/db";
import { findings } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const org = await getCurrentOrg();
  const status = req.nextUrl.searchParams.get("status");

  const rows = await db
    .select()
    .from(findings)
    .where(status ? and(eq(findings.orgId, org.id), eq(findings.status, status)) : eq(findings.orgId, org.id))
    .orderBy(desc(findings.createdAt));

  return NextResponse.json({ findings: rows });
}

const VALID_SOURCES = new Set(["sast", "dependency_scan", "bug_bounty", "manual"]);

export async function POST(req: NextRequest) {
  const org = await getCurrentOrg();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const source = VALID_SOURCES.has(body.source) ? body.source : "manual";

  const [row] = await db
    .insert(findings)
    .values({
      orgId: org.id,
      source,
      cweType: body.cweType || null,
      title: body.title.trim(),
      description: body.description || null,
      evidence: body.evidence || null,
      filePath: body.filePath || null,
      rawPayload: body.rawPayload || null,
      status: "pending",
    })
    .returning();

  return NextResponse.json({ finding: row }, { status: 201 });
}

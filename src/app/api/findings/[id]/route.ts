import { db } from "@/db";
import { findings } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getCurrentOrg();
  const rows = await db.select().from(findings).where(eq(findings.id, id));
  const finding = rows[0];
  if (!finding || finding.orgId !== org.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ finding });
}

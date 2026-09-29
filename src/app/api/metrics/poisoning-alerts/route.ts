import { db } from "@/db";
import { memoryAlerts } from "@/db/schema";
import { getCurrentOrg } from "@/lib/session";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const org = await getCurrentOrg();
  const rows = await db
    .select()
    .from(memoryAlerts)
    .where(eq(memoryAlerts.orgId, org.id))
    .orderBy(desc(memoryAlerts.createdAt));
  return NextResponse.json({ alerts: rows });
}

export async function POST(req: NextRequest) {
  const org = await getCurrentOrg();
  const body = await req.json().catch(() => null);
  if (!body?.alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  const [updated] = await db
    .update(memoryAlerts)
    .set({ resolved: true })
    .where(and(eq(memoryAlerts.id, body.alertId), eq(memoryAlerts.orgId, org.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ alert: updated });
}

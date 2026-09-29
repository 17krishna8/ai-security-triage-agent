import { getCurrentOrg } from "@/lib/session";
import { computeAccuracy } from "@/lib/accuracy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const org = await getCurrentOrg();
  const result = await computeAccuracy(org.id);
  return NextResponse.json(result);
}

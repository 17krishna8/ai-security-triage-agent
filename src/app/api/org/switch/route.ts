import { ORG_COOKIE, USER_COOKIE } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_COOKIE, orgId, { path: "/" });
  res.cookies.delete(USER_COOKIE);
  return res;
}

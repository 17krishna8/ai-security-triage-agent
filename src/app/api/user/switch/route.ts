import { USER_COOKIE } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, userId, { path: "/" });
  return res;
}

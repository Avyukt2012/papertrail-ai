import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getNotionToken } from "@/lib/store";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    connected: Boolean(getNotionToken(userId)),
  });
}

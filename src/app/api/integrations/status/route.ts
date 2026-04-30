import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getManualNotes, getNotionToken } from "@/lib/store";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const notionConnected = Boolean(getNotionToken(userId));
  const manualNotes = getManualNotes(userId).length;

  return NextResponse.json({
    ok: true,
    integrations: [
      {
        id: "notion",
        name: "Notion",
        connected: notionConnected,
        itemCount: 0,
      },
      {
        id: "manual",
        name: "Manual Notes",
        connected: true,
        itemCount: manualNotes,
      },
    ],
  });
}

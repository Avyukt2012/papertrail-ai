import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "Missing NOTION_CLIENT_ID or NOTION_REDIRECT_URI." },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";
  const notionAuthUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  notionAuthUrl.searchParams.set("client_id", clientId);
  notionAuthUrl.searchParams.set("response_type", "code");
  notionAuthUrl.searchParams.set("owner", "user");
  notionAuthUrl.searchParams.set("redirect_uri", redirectUri);
  notionAuthUrl.searchParams.set("state", `${userId}::${returnTo}`);

  return NextResponse.redirect(notionAuthUrl.toString());
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setNotionToken } from "@/lib/store";

type NotionOauthResponse = {
  access_token?: string;
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const [stateUserId, returnToRaw] = state.split("::");
  const returnTo = returnToRaw || "/";

  if (!code || !stateUserId || stateUserId !== userId) {
    return NextResponse.json({ ok: false, error: "Invalid OAuth callback state." }, { status: 400 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "Missing Notion OAuth env vars." },
      { status: 500 }
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const bodyText = await tokenRes.text();
    return NextResponse.json(
      { ok: false, error: `Failed to exchange Notion OAuth code: ${bodyText}` },
      { status: 500 }
    );
  }

  const tokenJson = (await tokenRes.json()) as NotionOauthResponse;
  if (!tokenJson.access_token) {
    return NextResponse.json({ ok: false, error: "No access token from Notion." }, { status: 500 });
  }

  setNotionToken(userId, tokenJson.access_token);
  return NextResponse.redirect(new URL(returnTo, url.origin));
}

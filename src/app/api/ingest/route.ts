import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chunkText } from "@/lib/chunk";
import { fetchNotionPages } from "@/lib/notion";
import { addChunks, clearChunks, getNotionToken, type MemoryChunk } from "@/lib/store";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const notionToken = getNotionToken(userId);
    if (!notionToken) {
      return NextResponse.json(
        { ok: false, error: "Notion is not connected. Click Connect Notion first." },
        { status: 400 }
      );
    }

    const docs = await fetchNotionPages(notionToken, 200);
    clearChunks(userId);

    const allChunks: MemoryChunk[] = [];

    for (const doc of docs) {
      const chunks = chunkText(doc.content);
      for (let i = 0; i < chunks.length; i += 1) {
        const text = chunks[i];
        allChunks.push({
          id: `${doc.id}-${i}`,
          sourceTitle: doc.title,
          sourceUrl: doc.url,
          text,
        });
      }
    }

    addChunks(userId, allChunks);

    return NextResponse.json({
      ok: true,
      pages: docs.length,
      chunks: allChunks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chunkText } from "@/lib/chunk";
import { fetchNotionPages } from "@/lib/notion";
import {
  getManualNotes,
  getNotionToken,
  setChunks,
  type MemoryChunk,
} from "@/lib/store";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const notionToken = getNotionToken(userId);
    const notionDocs = notionToken ? await fetchNotionPages(notionToken, 200) : [];
    const manualNotes = getManualNotes(userId);
    const allChunks: MemoryChunk[] = [];

    for (const doc of notionDocs) {
      const chunks = chunkText(doc.content);
      for (let i = 0; i < chunks.length; i += 1) {
        const text = chunks[i];
        allChunks.push({
          id: `notion-${doc.id}-${i}`,
          sourceTitle: `${doc.title} (Notion)`,
          sourceUrl: doc.url,
          text,
        });
      }
    }

    for (const note of manualNotes) {
      const chunks = chunkText(note.content);
      for (let i = 0; i < chunks.length; i += 1) {
        allChunks.push({
          id: `manual-${note.id}-${i}`,
          sourceTitle: `${note.title} (Manual Note)`,
          sourceUrl: `manual://note/${note.id}`,
          text: chunks[i],
        });
      }
    }

    if (!allChunks.length) {
      return NextResponse.json(
        { ok: false, error: "No connected sources or notes to ingest yet." },
        { status: 400 }
      );
    }

    setChunks(userId, allChunks);

    return NextResponse.json({
      ok: true,
      pages: notionDocs.length + manualNotes.length,
      chunks: allChunks.length,
      sources: {
        notionPages: notionDocs.length,
        manualNotes: manualNotes.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

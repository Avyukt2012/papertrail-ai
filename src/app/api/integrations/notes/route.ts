import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addManualNote, addChunks, type MemoryChunk } from "@/lib/store";
import { chunkText } from "@/lib/chunk";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as { title?: string; content?: string };
    const title = body.title?.trim() || "Untitled note";
    const content = body.content?.trim() || "";
    if (!content) {
      return NextResponse.json({ ok: false, error: "Note content is required." }, { status: 400 });
    }

    const note = addManualNote(userId, title, content);
    const chunks = chunkText(content);
    const chunkRows: MemoryChunk[] = chunks.map((text, i) => ({
      id: `manual-${note.id}-${i}`,
      sourceTitle: `${note.title} (Manual Note)`,
      sourceUrl: `manual://note/${note.id}`,
      text,
    }));
    addChunks(userId, chunkRows);

    return NextResponse.json({ ok: true, noteId: note.id, chunks: chunkRows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

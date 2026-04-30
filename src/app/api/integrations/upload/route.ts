import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addChunks, addManualNote, type MemoryChunk } from "@/lib/store";
import { chunkText } from "@/lib/chunk";

function isSupportedTextFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const form = await req.formData();
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No files uploaded." }, { status: 400 });
    }

    let uploaded = 0;
    let chunksTotal = 0;
    const rejected: string[] = [];
    const chunkRows: MemoryChunk[] = [];

    for (const file of files) {
      if (!isSupportedTextFile(file)) {
        rejected.push(file.name);
        continue;
      }

      const content = (await file.text()).trim();
      if (!content) {
        rejected.push(file.name);
        continue;
      }

      const note = addManualNote(userId, file.name, content);
      const chunks = chunkText(content);
      chunks.forEach((text, i) => {
        chunkRows.push({
          id: `upload-${note.id}-${i}`,
          sourceTitle: `${file.name} (File Upload)`,
          sourceUrl: `upload://file/${note.id}`,
          text,
        });
      });
      uploaded += 1;
      chunksTotal += chunks.length;
    }

    if (chunkRows.length) {
      addChunks(userId, chunkRows);
    }

    return NextResponse.json({
      ok: true,
      uploaded,
      chunks: chunksTotal,
      rejected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { YoutubeTranscript } from "youtube-transcript";
import { addChunks, addManualNote, type MemoryChunk } from "@/lib/store";
import { chunkText } from "@/lib/chunk";

function getYouTubeId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "") || null;
    }
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }
  } catch {
    // Not a full URL, maybe direct id.
  }

  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim() ?? "";
    if (!url) {
      return NextResponse.json({ ok: false, error: "YouTube URL is required." }, { status: 400 });
    }

    const videoId = getYouTubeId(url);
    if (!videoId) {
      return NextResponse.json({ ok: false, error: "Invalid YouTube URL." }, { status: 400 });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const text = transcript.map((line) => line.text).join(" ").trim();
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "No transcript found for this video." },
        { status: 400 }
      );
    }

    const note = addManualNote(userId, `YouTube ${videoId}`, text);
    const chunks = chunkText(text);
    const rows: MemoryChunk[] = chunks.map((chunk, i) => ({
      id: `youtube-${note.id}-${i}`,
      sourceTitle: `YouTube ${videoId} (Transcript)`,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      text: chunk,
    }));
    addChunks(userId, rows);

    return NextResponse.json({
      ok: true,
      videoId,
      chunks: rows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

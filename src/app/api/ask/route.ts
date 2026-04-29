import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateWithGroq } from "@/lib/groq";
import { getChunks } from "@/lib/store";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "it",
  "this",
  "that",
  "i",
  "you",
  "we",
  "they",
  "what",
  "how",
  "when",
  "where",
  "why",
  "about",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function buildBigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function countMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function topSentences(queryTokens: string[], text: string, count = 2): string[] {
  const sentences = sentenceSplit(text);
  const scored = sentences
    .map((sentence) => {
      const tokens = new Set(tokenize(sentence));
      let score = 0;
      for (const token of queryTokens) {
        if (tokens.has(token)) score += 1;
      }
      return { sentence, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.sentence);

  return scored.length ? scored : [text.slice(0, 220)];
}

function bm25LikeScore(
  queryTokens: string[],
  queryBigrams: string[],
  content: string,
  title: string,
  idf: Map<string, number>
): number {
  const cTokens = tokenize(content);
  if (!cTokens.length) return 0;

  const tf = countMap(cTokens);
  const unique = new Set(cTokens);
  let score = 0;

  // TF-IDF style relevance.
  for (const token of queryTokens) {
    const termFreq = tf.get(token) ?? 0;
    if (!termFreq) continue;
    score += termFreq * (idf.get(token) ?? 1);
  }

  // Phrase matches increase confidence.
  const lowerContent = content.toLowerCase();
  for (const phrase of queryBigrams) {
    if (lowerContent.includes(phrase)) score += 1.5;
  }

  // Light boost for title overlap.
  const titleTokens = new Set(tokenize(title));
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 1;
  }

  // Coverage: reward chunks that match more unique query terms.
  let covered = 0;
  for (const token of queryTokens) {
    if (unique.has(token)) covered += 1;
  }
  score += covered / Math.max(queryTokens.length, 1);

  return score;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as { question?: string };
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json({ ok: false, error: "Question is required." }, { status: 400 });
    }

    const chunks = getChunks(userId);
    if (!chunks.length) {
      return NextResponse.json({ ok: false, error: "No memory yet. Click ingest first." }, { status: 400 });
    }

    const queryTokens = tokenize(question);
    if (!queryTokens.length) {
      return NextResponse.json(
        { ok: false, error: "Question is too short. Try adding specific keywords." },
        { status: 400 }
      );
    }

    const queryBigrams = buildBigrams(queryTokens);

    // Build corpus-level IDF once per request.
    const docFreq = new Map<string, number>();
    for (const chunk of chunks) {
      const unique = new Set(tokenize(chunk.text));
      for (const token of unique) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }
    const totalDocs = chunks.length;
    const idf = new Map<string, number>();
    for (const token of queryTokens) {
      const df = docFreq.get(token) ?? 0;
      idf.set(token, Math.log(1 + (totalDocs + 1) / (df + 1)));
    }

    const ranked = chunks
      .map((chunk) => ({
        chunk,
        score: bm25LikeScore(queryTokens, queryBigrams, chunk.text, chunk.sourceTitle, idf),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const meaningful = ranked.filter(({ score }) => score > 0);
    const selected = meaningful.length ? meaningful : ranked;

    const extractiveAnswer = selected.length
      ? [
          `Best matches for: "${question}"`,
          ...selected.map(({ chunk }, idx) => {
            const highlights = topSentences(queryTokens, chunk.text, 2).join(" ");
            return `[${idx + 1}] ${chunk.sourceTitle}: ${highlights}`;
          }),
        ].join("\n\n")
      : "I could not find matching notes. Try different keywords.";

    const context = selected
      .map(({ chunk }, idx) => `[${idx + 1}] ${chunk.sourceTitle}\n${chunk.text}`)
      .join("\n\n");

    let answer = extractiveAnswer;
    let provider: "groq" | "extractive" = "extractive";
    let debug: string | undefined;
    try {
      const groq = await generateWithGroq(question, context);
      if (groq) {
        answer = groq;
        provider = "groq";
      } else {
        debug = "Groq not configured or returned empty response.";
      }
    } catch (error) {
      // Fallback to extractive mode if model API is unavailable.
      debug = error instanceof Error ? error.message : "Unknown model error";
      // Keep extractive fallback.
    }

    return NextResponse.json({
      ok: true,
      answer,
      provider,
      debug,
      citations: selected.map(({ chunk }, idx) => ({
        id: idx + 1,
        title: chunk.sourceTitle,
        url: chunk.sourceUrl,
        snippet: chunk.text.slice(0, 200),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

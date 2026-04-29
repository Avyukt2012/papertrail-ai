import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }
  return new OpenAI({ apiKey });
}

export async function embedText(input: string): Promise<number[]> {
  const client = getOpenAIClient();
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return res.data[0]?.embedding ?? [];
}

type GroqChoice = {
  message?: {
    content?: string;
  };
};

type GroqResponse = {
  choices?: GroqChoice[];
};

export async function generateWithGroq(
  question: string,
  context: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You answer only from provided context. Be concise, practical, and cite blocks as [1], [2]. If context is insufficient, say so clearly.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nContext:\n${context}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`Groq error: ${res.status} ${res.statusText}${bodyText ? ` - ${bodyText}` : ""}`);
  }

  const data = (await res.json()) as GroqResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

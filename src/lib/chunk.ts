export function chunkText(text: string, size = 700): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size) {
    out.push(clean.slice(i, i + size));
  }
  return out;
}

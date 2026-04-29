export type MemoryChunk = {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  text: string;
};

const chunksByUser = new Map<string, MemoryChunk[]>();
const notionTokenByUser = new Map<string, string>();

export function addChunks(userId: string, next: MemoryChunk[]) {
  const current = chunksByUser.get(userId) ?? [];
  current.push(...next);
  chunksByUser.set(userId, current);
}

export function getChunks(userId: string) {
  return chunksByUser.get(userId) ?? [];
}

export function clearChunks(userId: string) {
  chunksByUser.set(userId, []);
}

export function setNotionToken(userId: string, token: string) {
  notionTokenByUser.set(userId, token);
}

export function getNotionToken(userId: string) {
  return notionTokenByUser.get(userId) ?? null;
}

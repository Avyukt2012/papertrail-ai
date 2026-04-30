export type MemoryChunk = {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  text: string;
};

export type ManualNote = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
};

const chunksByUser = new Map<string, MemoryChunk[]>();
const notionTokenByUser = new Map<string, string>();
const manualNotesByUser = new Map<string, ManualNote[]>();

export function addChunks(userId: string, next: MemoryChunk[]) {
  const current = chunksByUser.get(userId) ?? [];
  current.push(...next);
  chunksByUser.set(userId, current);
}

export function setChunks(userId: string, next: MemoryChunk[]) {
  chunksByUser.set(userId, next);
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

export function addManualNote(userId: string, title: string, content: string): ManualNote {
  const current = manualNotesByUser.get(userId) ?? [];
  const note: ManualNote = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || "Untitled note",
    content: content.trim(),
    createdAt: Date.now(),
  };
  current.unshift(note);
  manualNotesByUser.set(userId, current);
  return note;
}

export function getManualNotes(userId: string) {
  return manualNotesByUser.get(userId) ?? [];
}

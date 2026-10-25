import type { Message } from "./types";

export function mergeMessages(previous: Message[], incoming: Message[]) {
  const merged = new Map(previous.map(m => [m.id, m]));
  incoming.forEach(m => merged.set(m.id, m));
  return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

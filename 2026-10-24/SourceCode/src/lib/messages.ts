import type { Message } from "./types";

// Database pagination remains ordered by (created_at, id).
export function compareMessageCursor(a: Message, b: Message) {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

export function sortMessages(messages: Message[]) {
  return [...messages].sort((a, b) => {
    const time = a.created_at.localeCompare(b.created_at);
    if (time) return time;
    // Transaction timestamps tie. Group by the question ID first, then put
    // its reply after it. Unlike pairwise parent checks this is transitive.
    const group = (a.parent_id || a.id).localeCompare(b.parent_id || b.id);
    return group || Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id)) || a.id.localeCompare(b.id);
  });
}

export function mergeMessages(previous: Message[], incoming: Message[]) {
  const merged = new Map(previous.map(m => [m.id, m]));
  incoming.forEach(m => merged.set(m.id, m));
  return sortMessages([...merged.values()]);
}

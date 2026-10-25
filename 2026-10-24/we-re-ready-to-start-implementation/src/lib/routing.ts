import type { AgentId } from "./types";
export function mentionedAgent(content: string): AgentId | null {
  const match = content.match(/(?:^|\s)@(paul|ravi|kaira)\b/i);
  return match ? match[1].toLowerCase() as AgentId : null;
}

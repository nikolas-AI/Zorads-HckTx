import type { AgentId, Message } from './types';
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH';
export type RoutingDecision = { agentId: AgentId | null; complexity: Complexity; escalate: boolean; replyToId: string | null; clarify: boolean; reason: string };
type RoutingFriend = { id: string; name: string };
const defaults: RoutingFriend[] = [{id:'paul',name:'Paul'},{id:'ravi',name:'Ravi'},{id:'kaira',name:'Kaira'}];
export function mentionedAgent(content: string, agents: RoutingFriend[] = defaults): AgentId | null {
  for (const match of content.matchAll(/(?:^|\s)@([A-Za-z][A-Za-z0-9_-]*)/g)) {
    const friend = agents.find(a => a.name.toLowerCase() === match[1].toLowerCase());
    if (friend) return friend.id;
  }
  return null;
}
export function classifyComplexity(content: string): Complexity {
  if (/\b(deep research|dig deeper|in.depth|rigorous|verify|evidence|sources|prove|trade.?offs|think (harder|again)|rethink)\b/i.test(content) || content.length > 1800) return 'HIGH';
  if (/\b(compare|plan|itinerary|summari[sz]e|brainstorm|budget|step.by.step|pros and cons)\b/i.test(content) || content.length > 500) return 'MEDIUM';
  return 'LOW';
}
const followup = /\b(dig deeper|go deeper|more detail|more specific|too generic|think (harder|again)|rethink|reconsider|try again|expand on|explain (that|why)|what about|can you (also|instead)|smaller budget|doesn.t (work|help)|not (quite|helpful)|your (answer|suggestion|plan))\b/i;
const stronger = /\b(dig deeper|go deeper|more detail|more specific|too generic|think (harder|again)|rethink|reconsider|try again|doesn.t (work|help)|not (quite|helpful))\b/i;
export function routeMessage(content: string, history: Message[], userId: string, humanNames: string[] = [], now = Date.now(), agents: RoutingFriend[] = defaults): RoutingDecision {
  history = [...history].sort((a,b) => a.created_at.localeCompare(b.created_at) || (a.parent_id === b.id ? 1 : b.parent_id === a.id ? -1 : a.id.localeCompare(b.id)));
  const explicit = mentionedAgent(content, agents);
  const name = content.match(/^(?:hey\s+)?([A-Za-z][A-Za-z0-9_-]*)(?:\s*[,!:?]|\s+(?:can|could|would|please|help|what|why|how|that|rethink|dig)\b)/i)?.[1]?.toLowerCase();
  const named = name && !humanNames.some(n => n.toLowerCase() === name) ? agents.find(a => a.id !== 'zorad' && a.name.toLowerCase() === name)?.id : null;
  let agentId = explicit || named || null;
  const complete = history.filter(m => m.status === 'complete');
  const last = history.at(-1);
  const isFollowup = followup.test(content);
  // Unnamed replies only continue this user's immediately preceding AI exchange.
  if (!agentId && isFollowup && last?.agent_id && last.agent_id !== 'zorad' && agents.some(a => a.id === last.agent_id) && last.status === 'complete' && now - Date.parse(last.created_at) < 10 * 60_000 && complete.some(m => m.id === last.parent_id && m.user_id === userId)) agentId = last.agent_id;
  if (!agentId) return { agentId: null, complexity: 'LOW', escalate: false, replyToId: null, clarify: false, reason: 'Human conversation; no clear invitation to an AI friend.' };
  const candidates = [...complete].reverse().filter(m => m.agent_id === agentId);
  const ownReplies = candidates.filter(m => complete.some(q => q.id === m.parent_id && q.user_id === userId));
  const prior = ownReplies[0] || (candidates.length === 1 ? candidates[0] : undefined);
  const referential = isFollowup || /\b(that|it|this|your (answer|suggestion|plan))\b/i.test(content);
  const replyToId = referential ? prior?.id || null : null;
  const clarify = isFollowup && !prior;
  return { agentId, complexity: clarify ? 'LOW' : classifyComplexity(content), escalate: !clarify && stronger.test(content) && !!prior, replyToId, clarify, reason: clarify ? 'Named friend, but no earlier answer found; ask a brief clarification.' : replyToId ? 'Conversational follow-up to this friend’s earlier answer.' : 'Friend explicitly addressed.' };
}




// A private chat with one AI has an unambiguous addressee; groups still require an invitation.
export function routeRoomMessage(content:string, history:Message[], userId:string, humanNames:string[], agents:{id:string;name:string}[], aiOnly:boolean, now=Date.now()) {
 const route=routeMessage(content,history,userId,humanNames,now,agents);
 const conversational = agents.filter(a => a.id !== 'zorad');
 return aiOnly && conversational.length===1 && !route.agentId ? routeMessage(`@${conversational[0].name} ${content}`,history,userId,humanNames,now,agents) : route;
}

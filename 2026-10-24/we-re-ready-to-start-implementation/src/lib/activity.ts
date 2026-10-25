export type Attempt = {
 id: string; room_id: string; reply_id: string; attempt: number; agent_id: string; model: string; provider: string;
 complexity: 'LOW'|'MEDIUM'|'HIGH'; reason: string; reply_to_id: string|null; escalated: boolean;
 status: 'running'|'complete'|'failed'; input_tokens: number|null; output_tokens: number|null;
 estimated_cost: number|null; baseline_cost: number|null; baseline_model: string|null;
 latency_ms: number|null; error: string|null; created_at: string;
};
export function activitySummary(rows: Attempt[]) {
 const priced = rows.filter(r=>r.estimated_cost !== null);
 const comparable = rows.filter(r=>r.estimated_cost !== null && r.baseline_cost !== null);
 const finished = rows.filter(r=>r.latency_ms !== null);
 return {
  requests: new Set(rows.map(r=>r.reply_id)).size,
  cost: priced.reduce((n,r)=>n+Number(r.estimated_cost),0),
  unknown: rows.length-priced.length,
  savings: comparable.length===rows.length && rows.length>0 ? comparable.reduce((n,r)=>n+Number(r.baseline_cost)-Number(r.estimated_cost),0) : null,
  averageLatency: finished.length ? finished.reduce((n,r)=>n+r.latency_ms!,0)/finished.length : null,
  byModel: Object.entries(rows.reduce<Record<string,number>>((counts,r)=>{counts[r.model]=(counts[r.model]||0)+1;return counts;},{})),
  byAgent: Object.entries(rows.reduce<Record<string,number>>((counts,r)=>{counts[r.agent_id]=(counts[r.agent_id]||0)+1;return counts;},{})),
  byComplexity: Object.entries(rows.reduce<Record<string,number>>((counts,r)=>{counts[r.complexity]=(counts[r.complexity]||0)+1;return counts;},{}))
 };
}

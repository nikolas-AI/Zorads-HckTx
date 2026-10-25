import type { Complexity } from './routing';
export type ModelSpec = { id: string; provider: 'gemini'; tier: Complexity; rank: number; capabilities: readonly string[]; inputPrice: number | null; outputPrice: number | null };
function price(value: string | undefined): number | null { return value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null; }
export function modelRegistry(env: Record<string, string | undefined> = process.env): ModelSpec[] {
  const ids = [env.GEMINI_MODEL_LOW || env.GEMINI_MODEL || 'gemini-3.5-flash-lite', env.GEMINI_MODEL_MEDIUM || 'gemini-3.8-flash', env.GEMINI_MODEL_HIGH || 'gemini-4-argon'];
  const tiers: Complexity[] = ['LOW','MEDIUM','HIGH'];
  return ids.flatMap((id, rank) => id === 'disabled' || ids.indexOf(id) !== rank ? [] : [{ id, provider: 'gemini' as const, tier: tiers[rank], rank, capabilities: ['text'], inputPrice: price(env[`GEMINI_${tiers[rank]}_INPUT_USD_PER_MILLION`]), outputPrice: price(env[`GEMINI_${tiers[rank]}_OUTPUT_USD_PER_MILLION`]) }]);
}
export function selectModel(models: ModelSpec[], complexity: Complexity, previousModel?: string | null, escalate = false): ModelSpec {
  const ordered = [...models].filter(m => m.capabilities.includes('text')).sort((a,b)=>a.rank-b.rank);
  if (!ordered.length) throw new Error('No text model is configured.');
  const desired = ['LOW','MEDIUM','HIGH'].indexOf(complexity);
  const prior = ordered.find(m => m.id === previousModel);
  const rank = escalate && prior ? Math.max(desired, prior.rank + 1) : desired;
  return ordered.find(m => m.rank >= rank) || ordered.at(-1)!;
}
export function estimateCost(model: ModelSpec, input: number | null, output: number | null): number | null {
  if (input === null || output === null || model.inputPrice === null || model.outputPrice === null) return null;
  return (input * model.inputPrice + output * model.outputPrice) / 1_000_000;
}


import type { ModelSpec } from './models';
export type Generation = { text: string; model: string; inputTokens: number | null; outputTokens: number | null };
export class ProviderError extends Error {
  constructor(message: string, public retryable = false, public usage: { input: number | null; output: number | null } = { input: null, output: null }) { super(message); }
}
export interface ModelProvider { generate(system: string, conversation: string, model?: ModelSpec): Promise<Generation> }
export class GeminiProvider implements ModelProvider {
  async generate(system: string, conversation: string, selected?: ModelSpec): Promise<Generation> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ProviderError('AI is not configured yet. Ask the host to add GEMINI_API_KEY.');
    const model = selected?.id || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: conversation }] }], generationConfig: { maxOutputTokens: 4096 } })
      });
    } catch { throw new ProviderError('Our connection was interrupted. Please try again in a new message.'); }
    // Only definite HTTP rejections can fall back; a timeout may already have incurred usage.
    if (!response.ok) throw new ProviderError(response.status === 429 ? 'Our AI friend is busy. Please try again shortly.' : 'Our AI friend could not connect. Please try again shortly.', [404,429,503].includes(response.status));
    const data = await response.json();
    const count = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    const inputTokens = count(data.usageMetadata?.promptTokenCount);
    const candidateTokens = count(data.usageMetadata?.candidatesTokenCount);
    const thoughts = count(data.usageMetadata?.thoughtsTokenCount) ?? 0;
    const outputTokens = candidateTokens === null ? null : candidateTokens + thoughts;
    const text = data.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) throw new ProviderError("Our AI friend couldn't answer this request. Try rephrasing it.", false, { input: inputTokens, output: outputTokens });
    return { text, model, inputTokens, outputTokens };
  }
}

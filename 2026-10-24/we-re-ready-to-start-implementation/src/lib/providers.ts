export type Generation = { text: string; model: string; inputTokens: number | null; outputTokens: number | null };
export interface ModelProvider { generate(system: string, conversation: string): Promise<Generation> }
export class GeminiProvider implements ModelProvider {
  async generate(system: string, conversation: string): Promise<Generation> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("AI is not configured yet. Ask the host to add GEMINI_API_KEY.");
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: conversation }] }], generationConfig: { maxOutputTokens: 1536 } })
    });
    if (!response.ok) throw new Error(response.status === 429 ? "Our AI friend is busy. Please try a new mention shortly." : "Our AI friend could not connect. Please try a new mention shortly.");
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("").trim();
    if (!text) throw new Error("Our AI friend couldn't answer this request. Try rephrasing it.");
    return { text, model, inputTokens: data.usageMetadata?.promptTokenCount ?? null, outputTokens: data.usageMetadata?.candidatesTokenCount ?? null };
  }
}


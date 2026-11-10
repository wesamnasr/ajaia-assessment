import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(envFile = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (val && !process.env[key]) process.env[key] = val;
  }
}

export function parseStructuredJson(rawText: string): Record<string, unknown> {
  const text = String(rawText ?? '').trim();
  if (!text) return {};

  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(unfenced);
    if (parsed !== null && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    const firstBrace = unfenced.indexOf('{');
    const lastBrace = unfenced.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
      if (candidate !== null && typeof candidate === 'object') return candidate as Record<string, unknown>;
    }
    throw new Error('LLM response did not contain valid JSON object');
  }

  throw new Error('LLM response was not a JSON object');
}

export function resolveModelForProvider(provider: string, defaultModel: string): string {
  const providerSpecific = (process.env[`${provider.toUpperCase()}_MODEL`] || '').trim();
  if (providerSpecific) return providerSpecific;

  const shared = (process.env.AI_MODEL || '').trim();
  if (!shared) return defaultModel;

  const lower = shared.toLowerCase();
  const isGeminiModel = lower.startsWith('gemini-');
  const isOpenAiModel =
    lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4');
  const isAnthropicModel = lower.startsWith('claude-');

  if (provider === 'gemini' && (isOpenAiModel || isAnthropicModel)) return defaultModel;
  if (provider === 'openai' && (isGeminiModel || isAnthropicModel)) return defaultModel;
  if (provider === 'anthropic' && (isGeminiModel || isOpenAiModel)) return defaultModel;

  return shared;
}

export interface AIResult {
  provider: string;
  data: {
    summary: string;
    actions: string[];
    suggestedHtml: string;
  };
  degradedReason?: string;
}

export async function generateStructuredAI({
  systemPrompt,
  userPrompt,
  timeoutMs = 15000,
  fallbackFn,
  fetchImpl = globalThis.fetch,
}: {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  fallbackFn?: (input: string) => { summary: string; actions: string[]; suggestedHtml: string };
  fetchImpl?: typeof globalThis.fetch;
}): Promise<AIResult> {
  loadEnv();

  const providers: Array<{
    name: string;
    call: (signal: AbortSignal) => Promise<Record<string, unknown>>;
  }> = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini',
      call: async (signal) => {
        const primaryModel = resolveModelForProvider('gemini', 'gemini-2.5-flash');
        const fallbackChain = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        const candidateModels = [
          primaryModel,
          ...fallbackChain.filter((m) => m !== primaryModel),
        ];

        let lastErr: unknown;
        for (const model of candidateModels) {
          const attemptController = new AbortController();
          const onOuterAbort = () => attemptController.abort();
          signal.addEventListener('abort', onOuterAbort, { once: true });
          const attemptTimer = setTimeout(
            () => attemptController.abort(),
            Math.max(4000, Math.floor(timeoutMs / 2))
          );

          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY || '')}`;
            const res = await fetchImpl(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: attemptController.signal,
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
              }),
            });
            if (!res.ok) {
              lastErr = new Error(`Gemini (${model}) HTTP ${res.status}`);
              if (res.status === 404 || res.status === 429 || res.status >= 500) continue;
              throw lastErr;
            }
            const data = (await res.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            return parseStructuredJson(rawText);
          } catch (err) {
            lastErr = err;
            if (signal.aborted) throw err;
          } finally {
            clearTimeout(attemptTimer);
            signal.removeEventListener('abort', onOuterAbort);
          }
        }
        throw lastErr || new Error('Gemini inference failed');
      },
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      call: async (signal) => {
        const model = resolveModelForProvider('openai', 'gpt-4o-mini');
        const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal,
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawText = data?.choices?.[0]?.message?.content || '{}';
        return parseStructuredJson(rawText);
      },
    });
  }

  const errors: string[] = [];

  for (const provider of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const parsedData = await provider.call(controller.signal);
      return {
        provider: provider.name,
        data: {
          summary: String(parsedData.summary ?? ''),
          actions: Array.isArray(parsedData.actions)
            ? parsedData.actions.map((a) => String(a))
            : [],
          suggestedHtml: String(parsedData.suggestedHtml ?? ''),
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${provider.name}: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  if (typeof fallbackFn === 'function') {
    return {
      provider: 'deterministic-fallback',
      data: fallbackFn(userPrompt),
      ...(errors.length > 0 ? { degradedReason: errors.join(' | ') } : {}),
    };
  }

  throw new Error(errors.join(' | ') || 'No AI provider key configured in .env');
}

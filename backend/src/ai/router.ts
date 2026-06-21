import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/**
 * Tipos de tarea → determinan qué proveedor se usa primero y el orden de fallback.
 *
 *  classify  → Mistral Small (JSON estructurado, barato)  → DeepSeek → Claude
 *  reply     → Mistral (conversacional)                   → DeepSeek → Claude
 *  sequence  → Mistral Small (mensajes cortos)            → DeepSeek → Claude
 *  code      → Codestral (generación de código)           → Mistral  → DeepSeek → Claude
 */
export type TaskType = 'classify' | 'reply' | 'sequence' | 'code';

type Provider = 'mistral' | 'codestral' | 'deepseek' | 'claude';

const CHAIN: Record<TaskType, Provider[]> = {
  classify: ['mistral',   'deepseek', 'claude'],
  reply:    ['mistral',   'deepseek', 'claude'],
  sequence: ['mistral',   'deepseek', 'claude'],
  code:     ['codestral', 'mistral',  'deepseek', 'claude'],
};

const MODELS: Record<Provider, string> = {
  mistral:   config.mistral.model,
  codestral: config.mistral.codeModel,
  deepseek:  config.deepseek.model,
  claude:    config.anthropic.model,
};

// Codestral tiene su propia API key separada de Mistral.
const OPENAI_COMPAT: Record<string, { baseUrl: string; apiKey: string }> = {
  mistral:   { baseUrl: 'https://api.mistral.ai/v1',   apiKey: config.mistral.apiKey },
  codestral: { baseUrl: 'https://api.mistral.ai/v1',   apiKey: config.mistral.codestralApiKey },
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1', apiKey: config.deepseek.apiKey },
};

async function callOpenAICompat(
  provider: Provider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const { baseUrl, apiKey } = OPENAI_COMPAT[provider];
  if (!apiKey) throw new Error(`Sin API key para ${provider}`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS[provider],
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${provider} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message?.content?.trim();
  if (!text) throw new Error(`${provider} devolvió respuesta vacía`);
  return text;
}

const _anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await _anthropic.messages.create({
    model: MODELS.claude,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
    .trim();
  if (!text) throw new Error('Claude devolvió respuesta vacía');
  return text;
}

/**
 * Llama al LLM adecuado para la tarea, con fallback automático según la cadena de prioridad.
 * Registra en consola cuando se usa un proveedor de respaldo.
 */
export async function llm(
  task: TaskType,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const chain = CHAIN[task];
  let lastErr: unknown;

  for (const provider of chain) {
    try {
      const text =
        provider === 'claude'
          ? await callClaude(system, user, maxTokens)
          : await callOpenAICompat(provider, system, user, maxTokens);

      if (provider !== chain[0]) {
        console.warn(`[llm:${task}] fallback activo → ${provider} (${MODELS[provider]})`);
      }
      return text;
    } catch (err) {
      console.warn(`[llm:${task}] ${provider} falló: ${(err as Error).message}`);
      lastErr = err;
    }
  }

  throw new Error(
    `[llm:${task}] todos los proveedores fallaron. Último: ${(lastErr as Error)?.message}`,
  );
}

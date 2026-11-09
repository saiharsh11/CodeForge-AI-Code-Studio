// In production the API lives on Railway (VITE_API_URL); in dev Vite proxies /api.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export interface ModelInfo {
  provider: 'openrouter' | 'groq';
  model: string;
  name: string;
  context: number | null;
}

export interface ModelRef {
  provider: ModelInfo['provider'];
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const modelKey = (m: ModelRef) => `${m.provider}:${m.model}`;

/** "Cohere: North Mini Code" -> "North Mini Code" */
export const shortName = (m: ModelInfo) => m.name.replace(/^[^:]+:\s*/, '');

interface StreamChunk {
  codeforge?: StreamMeta;
  error?: { message?: string };
  choices?: { delta?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
}

export async function fetchModels(): Promise<{ models: ModelInfo[]; default: ModelRef | null }> {
  const res = await fetch(`${API_BASE}/api/models`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Model list failed (${res.status})`);
  return body;
}

/** Sent by our server before the model output: who answered, and whether it was free. */
export interface StreamMeta {
  provider: ModelInfo['provider'];
  model: string;
  name: string;
  cached?: boolean;
  fallbackFrom?: string;
}

export interface StreamDelta {
  content?: string;
  reasoning?: string;
  meta?: StreamMeta;
}

const CONTEXT_BUDGET_CHARS = 48_000; // ~12k tokens: plenty for code, gentle on free-tier limits

/**
 * Keep follow-ups cheap: always send the system prompt and the first user turn
 * (it carries the code), then as many of the most recent turns as fit.
 */
export function trimHistory(messages: ChatMessage[]): { messages: ChatMessage[]; dropped: number } {
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total <= CONTEXT_BUDGET_CHARS || messages.length <= 3) return { messages, dropped: 0 };
  const [system, first, ...rest] = messages;
  let budget = CONTEXT_BUDGET_CHARS - system.content.length - first.content.length;
  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    if (kept.length && budget - rest[i].content.length < 0) break;
    budget -= rest[i].content.length;
    kept.unshift(rest[i]);
  }
  // Conversations must resume on a user turn after the first message pair.
  while (kept.length > 1 && kept[0].role !== 'assistant') kept.shift();
  const dropped = rest.length - kept.length;
  const note: ChatMessage = { role: 'user', content: `(${dropped} earlier messages were omitted to save space.)` };
  return { messages: dropped ? [system, first, note, ...kept] : messages, dropped };
}

// Answers to identical requests, kept ONLY in this tab's memory: never sent anywhere,
// never written to disk or browser storage, and gone when the tab is closed or reloaded.
const tabCache = new Map<string, StreamDelta[]>();
const TAB_CACHE_MAX = 40;

/**
 * Stream a reply. An identical request made earlier in this tab is replayed from
 * memory (no network request, no quota). `noCache` (Regenerate) always asks the model.
 */
export async function* streamChat(
  ref: ModelRef,
  messages: ChatMessage[],
  signal: AbortSignal,
  opts: { noCache?: boolean } = {}
): AsyncGenerator<StreamDelta> {
  const key = JSON.stringify([ref.provider, ref.model, messages]);
  const hit = opts.noCache ? undefined : tabCache.get(key);
  if (hit) {
    for (const d of hit) yield d.meta ? { meta: { ...d.meta, cached: true, fallbackFrom: undefined } } : d;
    return;
  }
  const seen: StreamDelta[] = [];
  for await (const d of streamFromServer(ref, messages, signal)) {
    seen.push(d);
    yield d;
  }
  // Only complete answers are kept (an aborted or failed stream throws before this line).
  if (seen.some((d) => d.content)) {
    tabCache.delete(key);
    tabCache.set(key, seen);
    while (tabCache.size > TAB_CACHE_MAX) tabCache.delete(tabCache.keys().next().value!);
  }
}

/** POST to /api/chat and yield content / reasoning deltas from the SSE stream. */
async function* streamFromServer(ref: ModelRef, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<StreamDelta> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ref, messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue; // skip ": keep-alive" comments
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        let json: StreamChunk;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        // Providers can report errors mid-stream after a 200.
        if (json.error) throw new Error(json.error.message || 'The model returned an error.');
        if (json.codeforge) { yield { meta: json.codeforge }; continue; }

        const delta = json.choices?.[0]?.delta ?? {};
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (delta.content || reasoning) yield { content: delta.content || undefined, reasoning: reasoning || undefined };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface Quota { used: number; limit: number; remaining: number; resetsAt: string; hoursLeft: number }

/** Today's free-model allowance as reported by OpenRouter (null when unavailable). */
export async function fetchQuota(fresh = false): Promise<Quota | null> {
  try {
    const res = await fetch(`${API_BASE}/api/quota${fresh ? '?fresh=1' : ''}`);
    const body = await res.json();
    if (!res.ok || !Number.isFinite(body.limit)) return null;
    const hoursLeft = Math.max(0, Math.ceil((new Date(body.resetsAt).getTime() - Date.now()) / 3_600_000));
    return { ...body, hoursLeft };
  } catch {
    return null;
  }
}

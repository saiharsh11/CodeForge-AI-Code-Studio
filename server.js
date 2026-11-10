require('dotenv').config({ quiet: true });
const express = require('express');

const { cors, limitReads, limitChat, checkMessages, withPolicy, misuse } = require('./guardrails');

const app = express();
// Behind Railway's (or any) proxy, req.ip comes from X-Forwarded-For; trust exactly one hop
// so a client can't spoof its address by sending the header itself.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use('/api', cors);
app.use(express.json({ limit: '200kb' }));

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const APP_URL = process.env.APP_URL; // your public site URL, sent to OpenRouter for attribution
const DEFAULT_MODEL = process.env.DEFAULT_MODEL; // e.g. "openrouter:google/gemma-4-31b-it:free"

// Base URLs are overridable so the proxy can be pointed at a mock in tests.
const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    base: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    key: OPENROUTER_API_KEY,
    headers: { ...(APP_URL ? { 'HTTP-Referer': APP_URL } : {}), 'X-Title': 'CodeForge' },
  },
  groq: {
    label: 'Groq',
    base: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    key: GROQ_API_KEY,
    headers: {},
  },
};

const MODEL_CACHE_MS = 10 * 60 * 1000;
let modelCache = { at: 0, models: [] };

// ── Model curation ─────────────────────────────────────────────────────────
// Three layers decide which free models users see:
//  1. Hard rules (always): OpenRouter's official ":free" text models from trusted
//     publishers, not scheduled to expire within MIN_DAYS_LEFT days, and whose
//     description doesn't say prompts are retained or used for training.
//  2. A curated list (MODEL_ALLOWLIST), in order — the first is the default model.
//  3. Safety net: if none of the curated models are available any more, fall back
//     to everything that passes the hard rules (and log a warning), never to nothing.
const TRUSTED_PUBLISHERS = (process.env.TRUSTED_PUBLISHERS || 'google,nvidia,cohere,meta-llama,mistralai,microsoft,openai,ibm-granite')
  .split(',').map((s) => s.trim()).filter(Boolean);
// Order matters: the first model is the default, and busy models fall back to the others.
// North Mini Code and Nemotron 3 Ultra passed every format check in real tests
// (2026-11-09). The Gemma 4 models are included for choice and because they support
// zero-data-retention endpoints, but their free tier was often busy in testing, so they
// come last. Keep this list in sync with the "Model & provider access" guardrail on the
// OpenRouter key, or requests to the missing models will be rejected.
const MODEL_ALLOWLIST = (process.env.MODEL_ALLOWLIST || [
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const MIN_DAYS_LEFT = 60;
const RETENTION_WARNING = /(prompts?|inputs?|outputs?|data)[^.]{0,60}\b(retain|retained|logged|stored|used (for|to) (train|improve))|\b(may|will) be used (for|to) (train|improve)/i;

function passesHardRules(m) {
  if (!m.id.endsWith(':free')) return false; // excludes stealth previews, routers, non-text promos
  if (!m.pricing || Number(m.pricing.prompt) !== 0 || Number(m.pricing.completion) !== 0) return false;
  if (m.architecture?.output_modalities && !m.architecture.output_modalities.includes('text')) return false;
  if (!TRUSTED_PUBLISHERS.includes(m.id.split('/')[0])) return false;
  if (m.expiration_date && new Date(m.expiration_date).getTime() - Date.now() < MIN_DAYS_LEFT * 86_400_000) return false;
  if (RETENTION_WARNING.test(m.description || '')) return false;
  return true;
}

async function fetchOpenRouterModels() {
  const res = await fetch(`${PROVIDERS.openrouter.base}/models`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
  const { data = [] } = await res.json();
  const safe = data.filter(passesHardRules);
  const curated = MODEL_ALLOWLIST.map((id) => safe.find((m) => m.id === id)).filter(Boolean);
  const missing = MODEL_ALLOWLIST.filter((id) => !curated.some((m) => m.id === id));
  if (missing.length) console.warn(`[Models] curated models unavailable or failing the rules: ${missing.join(', ')}`);
  if (!curated.length) console.warn('[Models] no curated model available — falling back to every model that passes the rules');
  const chosen = curated.length ? curated : safe;
  return chosen.map((m, i) => ({
    provider: 'openrouter',
    model: m.id,
    name: (m.name || m.id).replace(/\s*\(free\)\s*$/i, '').trim(),
    context: m.context_length || null,
    rank: curated.length ? i : 100 + i, // curated order; the first is the default
  }));
}

async function fetchGroqModels() {
  const res = await fetch(`${PROVIDERS.groq.base}/models`, {
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Groq models ${res.status}`);
  const { data = [] } = await res.json();
  return data
    .filter((m) => m.active !== false && !/whisper|tts|guard|orpheus|playai/i.test(m.id))
    .map((m) => ({ provider: 'groq', model: m.id, name: m.id, context: m.context_window || null }));
}

async function getModels() {
  if (Date.now() - modelCache.at < MODEL_CACHE_MS && modelCache.models.length) return modelCache.models;

  const jobs = [];
  if (OPENROUTER_API_KEY) jobs.push(fetchOpenRouterModels());
  if (GROQ_API_KEY) jobs.push(fetchGroqModels());
  const results = await Promise.allSettled(jobs);

  const models = [];
  for (const r of results) {
    if (r.status === 'fulfilled') models.push(...r.value);
    else console.error('[Models]', r.reason.message);
  }
  models.sort((a, b) => a.provider.localeCompare(b.provider) || (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name));

  // Keep serving the last good list if a refresh fails entirely.
  if (models.length) modelCache = { at: Date.now(), models };
  return modelCache.models;
}

function pickDefault(models) {
  const key = (m) => `${m.provider}:${m.model}`;
  const byRank = [...models].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return models.find((m) => key(m) === DEFAULT_MODEL) || byRank[0] || null;
}

app.get('/api/models', limitReads, async (req, res) => {
  try {
    const models = await getModels();
    const def = pickDefault(models);
    res.json({ models, default: def ? { provider: def.provider, model: def.model } : null });
  } catch (err) {
    console.error('[Models]', err.message);
    res.status(502).json({ error: 'Could not load the model list.' });
  }
});

/** True when OpenRouter itself rate-limited the account, rather than relaying a provider's 429. */
function isAccountLimit(body) {
  try {
    const meta = JSON.parse(body).error?.metadata || {};
    return !meta.provider_code && !meta.provider_name;
  } catch {
    return false;
  }
}

// ── Quota meter ────────────────────────────────────────────────────────────
// OpenRouter reports free-model usage per UTC day on GET /key.
let quotaCache = { at: 0, value: null };
async function getQuota(fresh = false) {
  if (!OPENROUTER_API_KEY) return null;
  if (!fresh && Date.now() - quotaCache.at < 20_000) return quotaCache.value;
  const res = await fetch(`${PROVIDERS.openrouter.base}/key`, {
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenRouter key info ${res.status}`);
  const d = (await res.json()).data?.free_model_daily_requests;
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const value = d && Number.isFinite(d.limit)
    ? { used: d.used, limit: d.limit, remaining: d.remaining, resetsAt: next.toISOString() }
    : null;
  quotaCache = { at: Date.now(), value };
  return value;
}

app.get('/api/quota', limitReads, async (req, res) => {
  try {
    // ?fresh=1 after a reply; throttled so the browser can't hammer OpenRouter's /key.
    const fresh = req.query.fresh === '1' && Date.now() - quotaCache.at > 3000;
    const quota = await getQuota(fresh);
    res.json(quota ?? { unavailable: true });
  } catch (err) {
    console.error('[Quota]', err.message);
    res.json({ unavailable: true });
  }
});

function upstreamError(status, body) {
  let detail = '';
  try {
    const j = JSON.parse(body);
    detail = j.error?.metadata?.raw || j.error?.message || j.message || '';
  } catch { }
  if (status === 429) return 'This model is rate-limited right now. Try again in a moment or pick another model.';
  if (status === 401 || status === 403) return 'The server API key was rejected.';
  return `Model provider returned ${status}${detail ? `: ${String(detail).slice(0, 300)}` : '.'}`;
}

// ── Quota saver ────────────────────────────────────────────────────────────
// Free models are rate-limited and flaky. Two things stretch the quota:
//  1. health tracking: a model that just returned 429 is skipped for a while,
//  2. fallback: a failed request is retried once or twice on the free model with
//     the best recent success rate, before the user ever sees an error.
// Only model names and success/failure counts are kept — never request content.

const modelKeyOf = (provider, model) => `${provider}:${model}`;
const health = new Map(); // key -> { ok, fail, coolUntil }

function markOk(key) {
  const h = health.get(key) || { ok: 0, fail: 0, coolUntil: 0 };
  h.ok += 1;
  h.coolUntil = 0;
  health.set(key, h);
}
function markFail(key, status) {
  const h = health.get(key) || { ok: 0, fail: 0, coolUntil: 0 };
  h.fail += 1;
  h.coolUntil = Date.now() + (status === 429 ? 90_000 : 30_000);
  health.set(key, h);
}
const coolingDown = (key) => (health.get(key)?.coolUntil || 0) > Date.now();
const score = (key) => {
  const h = health.get(key);
  return h ? (h.ok + 1) / (h.ok + h.fail + 2) : 0.5;
};

const RETRYABLE = (status) => status === 408 || status === 429 || status >= 500;
const MAX_ATTEMPTS = 3;

function pickCandidates(models, requested, approxTokens) {
  const fits = (m) => !m.context || approxTokens < m.context * 0.85;
  const usable = (m) => PROVIDERS[m.provider]?.key && fits(m);
  const first = usable(requested) && !coolingDown(modelKeyOf(requested.provider, requested.model)) ? [requested] : [];
  const others = models
    .filter((m) => !(m.provider === requested.provider && m.model === requested.model))
    .filter((m) => usable(m) && !coolingDown(modelKeyOf(m.provider, m.model)))
    .sort((a, b) => score(modelKeyOf(b.provider, b.model)) - score(modelKeyOf(a.provider, a.model)) || (b.context || 0) - (a.context || 0));
  return [...first, ...others].slice(0, MAX_ATTEMPTS);
}

const sseMeta = (meta) => `data: ${JSON.stringify({ codeforge: meta })}\n\n`;

function startSse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

app.post('/api/chat', limitChat, async (req, res) => {
  // Privacy: nothing from the request or the answer is stored or logged by this server.
  // It is streamed straight through and dropped when the response ends.
  const { provider, model, messages } = req.body || {};

  const invalid = checkMessages(messages);
  if (invalid) return res.status(400).json({ error: invalid });
  const refused = misuse(messages);
  if (refused) return res.status(422).json({ error: refused });

  const p = PROVIDERS[provider];
  if (!p) return res.status(400).json({ error: 'Unknown provider.' });
  if (!p.key) return res.status(500).json({ error: `${p.label} API key is not configured on the server.` });

  const models = await getModels().catch(() => []);
  const requested = models.find((m) => m.provider === provider && m.model === model);
  if (!requested) return res.status(400).json({ error: 'That model is not available. Refresh the model list.' });

  // Stop the upstream request if the browser disconnects (e.g. the user hits Stop).
  const clientGone = new AbortController();
  res.on('close', () => clientGone.abort());

  // The server's policy always goes first; the caller can't remove it.
  const guarded = withPolicy(messages);
  const approxTokens = guarded.reduce((n, m) => n + m.content.length, 0) / 4;
  const candidates = pickCandidates(models, requested, approxTokens);
  if (!candidates.length) {
    return res.status(429).json({ error: 'Every free model is rate-limited right now. Please try again in a minute.' });
  }

  let lastError = { status: 502, message: 'Could not reach the model provider.', final: false };
  let attempts = 0;

  // 2) Fallback: try the requested model, then the alternatives with the best recent success rate.
  for (const cand of candidates) {
    attempts += 1;
    const cp = PROVIDERS[cand.provider];
    const key = modelKeyOf(cand.provider, cand.model);
    const attempt = new AbortController();
    const onGone = () => attempt.abort();
    clientGone.signal.addEventListener('abort', onGone);
    const firstByte = setTimeout(() => attempt.abort(), 30_000); // provider hung before responding

    try {
      const upstream = await fetch(`${cp.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cp.key}`, ...cp.headers },
        body: JSON.stringify({ model: cand.model, messages: guarded, stream: true, temperature: 0.4, max_tokens: 8192 }),
        signal: attempt.signal,
      });
      clearTimeout(firstByte);

      if (!upstream.ok) {
        const body = await upstream.text();
        console.error(`[Upstream ${upstream.status}] ${key}`); // status only: never log content
        lastError = { status: upstream.status, message: upstreamError(upstream.status, body) };
        // An OpenRouter account limit (free requests per minute/day) applies to every free
        // model, so switching models would only burn more requests. Only a 429 relayed from an
        // upstream provider (it carries provider_code) is worth retrying elsewhere.
        if (upstream.status === 429 && cand.provider === 'openrouter' && isAccountLimit(body)) {
          const quota = await getQuota(true).catch(() => null);
          lastError = {
            status: 429,
            message: quota && quota.remaining === 0
              ? `You've used all ${quota.limit} free requests for today. The limit resets at 00:00 UTC.`
              : 'Free-tier limit reached (20 requests per minute). Please wait a minute and try again.',
            final: true, // the account is limited: this message is exactly right, don't generalise it
          };
          break;
        }
        if (RETRYABLE(upstream.status)) { markFail(key, upstream.status); continue; }
        break; // 4xx such as a bad request: another model will not help
      }

      const meta = {
        provider: cand.provider,
        model: cand.model,
        name: cand.name,
        fallbackFrom: cand === requested ? undefined : requested.name,
      };
      startSse(res);
      res.write(sseMeta(meta));

      // Stream straight through; nothing is kept.
      for await (const chunk of upstream.body) res.write(chunk);
      res.end();
      markOk(key);
      return;
    } catch (err) {
      clearTimeout(firstByte);
      if (clientGone.signal.aborted) return;
      if (res.headersSent) { console.error('[Chat stream]', err.message); res.end(); return; }
      console.error(`[Chat] ${key}`, err.message);
      markFail(key, 0);
      lastError = { status: 504, message: 'The model took too long to respond.' };
    } finally {
      clientGone.signal.removeEventListener('abort', onGone);
    }
  }

  if (!res.headersSent) {
    const status = lastError.status === 429 ? 429 : lastError.status >= 400 && lastError.status < 500 ? lastError.status : 502;
    const message = !lastError.final && attempts > 1 && RETRYABLE(lastError.status)
      ? `Tried ${attempts} free models and all were busy. Please try again in a minute.`
      : lastError.message;
    res.status(status).json({ error: message });
  }
});

// Body too large or not valid JSON: answer plainly, never echo the body back.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large. Paste a smaller piece of code.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON.' });
  next(err);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, groq: !!GROQ_API_KEY, openrouter: !!OPENROUTER_API_KEY });
});

// This server is API-only: the website (landing page + studio) is a separate static
// build in web/, hosted on its own (e.g. Vercel). Anything outside /api is a 404.
app.get('/', (req, res) => res.json({ name: 'CodeForge API', health: '/api/health' }));
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`CodeForge API listening on port ${PORT}`);
  if (!OPENROUTER_API_KEY && !GROQ_API_KEY) console.warn('No API keys set — see .env.example');
});

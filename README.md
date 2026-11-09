# CodeForge

**A free AI code workbench where answers get run, not just read.**

CodeForge helps you write, review, understand and debug code with free AI models — and then checks the result by actually running it in your browser: examples are executed, edge-case inputs are thrown at your function, and complexity claims are timed.

> Live site: _coming soon_ (frontend on Vercel, API on Railway)

---

## What it does

The studio has 14 modes, grouped into four menus.

| Group | Modes |
|---|---|
| **Write** | Generate · Refactor · Convert (between languages) · Write tests · Regex |
| **Understand** | Explain · Diagram (Mermaid flowchart / sequence / class / state) · Step through |
| **Fix** | Review · Debug · Error (paste a stack trace) |
| **Check** | By example · Break it · Big-O |

Every answer is a conversation — ask follow-ups, and use **Continue with this code** to send the result straight into the next mode.

### Checks that run in your browser

Most AI tools hand you code and hope it works. These modes test the answer instead of trusting it:

- **Run** — JavaScript, TypeScript and Python code blocks have a Run button. Python runs via [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly). On an error, *Fix this error* sends it back to the model.
- **By example** — you give input → expected output pairs; the model writes `solve()`; every example is executed and failures are sent back for repair automatically (at most twice).
- **Break it** — the model proposes adversarial inputs (empty, huge, wrong types, unicode…); each one is run against *your* code with its own time limit, and you see which crash, hang or return the wrong value. After a fix, the same inputs re-run on the new code.
- **Big-O** — the model states a complexity and writes an input generator; your function is timed at doubling input sizes, fitted against O(1)…O(2ⁿ) on log-log axes, and the claim is compared with the measurements.
- **Step through** — Python executes line by line with every variable's value at each step (no AI request at all).
- **Regex** — a live tester highlights matches as you edit the pattern; runaway patterns are stopped after 500 ms.
- **Diff** — refactors and fixes can be viewed as a line diff against the code you pasted.

**Limits, stated plainly:** passing your examples or a few hundred generated inputs is evidence, not proof of correctness. Only JavaScript, TypeScript and Python can be executed. Code runs in a background Web Worker in your own browser and is stopped on a time limit — that keeps the page responsive, but it is *not* a security sandbox (a worker shares the page's origin and can make network requests), so only run code you'd be comfortable running on your own machine.

---

## Architecture

```
 Browser (web/ — React + Vite, hosted on Vercel)
 ├─ Landing page  /
 ├─ Studio        /app
 └─ In-browser execution: Web Workers (JS/TS) and Pyodide (Python), with timeouts
          │  POST /api/chat (SSE stream)
          ▼
 API (server.js — Express, hosted on Railway)
 ├─ Guardrails: per-visitor rate limits, size caps, CORS allow-list,
 │              misuse pre-check, server-side policy prepended to every request
 ├─ Model curation: official ":free" models, trusted publishers, not expiring soon
 ├─ Fallback: a busy model's request is retried on the other model
 └─ Quota: today's free-request allowance read from OpenRouter
          │
          ▼
 OpenRouter → model providers
```

### Models

Two free models from [OpenRouter](https://openrouter.ai), chosen after testing every mode against them:

- **Cohere North Mini Code** (default)
- **NVIDIA Nemotron 3 Ultra**

The server only offers OpenRouter's official `:free` variants from established publishers, skips any model scheduled to be retired within 60 days, and skips models whose description says prompts are retained. If the curated models disappear, it falls back to anything that passes those rules. The list is configurable with `MODEL_ALLOWLIST`.

Free models are rate-limited: 50 requests per day per OpenRouter account (1,000 after buying $10 of credits) and 20 per minute. The studio's status bar shows how many are left today; asking the same question twice in one tab is answered from that tab's memory and doesn't use any.

### Guardrails

Enforced by the API, so they also apply to anyone calling it directly:

- Per-visitor limits (default 6 requests/minute, 30/day, 2 in progress at once). Visitors are told apart by a salted hash of the IP address, kept in memory only and dropped within a day.
- Request size caps and a CORS allow-list for the website's origin.
- A server-side policy, prepended to every model request, that treats pasted code as data rather than instructions and keeps the assistant to programming help.
- A narrow keyword pre-check that refuses obvious malware requests before any model is called.

The deterministic checks (limits, caps, CORS) are reliable; the policy and keyword check reduce risk but are not guarantees. The OpenRouter key itself carries a second layer: a $0 budget, a two-model allow-list, and redaction of API keys, card numbers and similar secrets.

### Privacy

CodeForge has no accounts and does not save code or prompts. The API streams each request through without storing or logging its content (logs contain only status codes and model names). Conversations live in the browser tab. Requests are sent to OpenRouter and the model's provider, and the free providers used **may keep prompts and use them for training** — don't paste secrets or private data.

---

## Running locally

Requirements: Node.js 20+ and a free [OpenRouter API key](https://openrouter.ai/keys).

```bash
# 1. API
cp .env.example .env          # then put your key in OPENROUTER_API_KEY
npm install
npm run dev                   # http://localhost:3000

# 2. Web app (second terminal)
cd web
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :3000)
```

### Configuration

API (`.env`, see [.env.example](.env.example)):

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Required |
| `ALLOWED_ORIGINS` | Comma-separated website origins allowed to call the API (required in production) |
| `MODEL_ALLOWLIST` | Free models to offer, in order; the first is the default |
| `RATE_CHAT_PER_MIN`, `RATE_CHAT_PER_DAY`, `RATE_CONCURRENT`, `RATE_READS_PER_MIN` | Per-visitor limits |
| `APP_URL` | Public site URL, sent to OpenRouter for attribution |
| `NODE_ENV=production` | Disables the localhost development origins |

Web (`web/.env` or the hosting dashboard):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | URL of the deployed API, e.g. `https://your-api.up.railway.app` |

## Deploying

- **API → Railway:** deploy the repository root. [`railway.json`](railway.json) sets the start command and the `/api/health` check. Set `OPENROUTER_API_KEY`, `ALLOWED_ORIGINS` and `NODE_ENV=production`.
- **Web → Vercel:** import the repository with **Root Directory = `web`**. [`web/vercel.json`](web/vercel.json) handles the build and the `/app` route. Set `VITE_API_URL` to the Railway URL.

---

## Project structure

```
server.js          Express API: model list, chat streaming, fallback, quota
guardrails.js      Rate limits, size caps, CORS, policy, misuse pre-check
railway.json       Railway deploy settings
web/
  src/landing/     Landing page (animated preview, model ticker, FAQ)
  src/studio/      The studio
    lib/modes.ts       Mode definitions and instructions
    lib/runner.ts      In-browser execution (Web Workers, Pyodide)
    lib/harness.ts     Example runner, input runner, timing + curve fitting, Python tracer
    components/        Composer, model picker, code blocks, diff, regex tester,
                       diagram renderer, check panels, step-through debugger
  vercel.json      Vercel deploy settings
```

## Tech stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Express 5 · Pyodide · Mermaid · OpenRouter

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, Copy, CornerDownRight, Plus, RotateCw, Scissors, Shuffle, Sparkles, Square, Zap } from 'lucide-react';
import { Github } from '@/components/GithubIcon';
import { Clouds } from '@/components/Clouds';
import { Composer } from './components/Composer';
import { Markdown } from './components/Markdown';
import { StudioContext } from './components/studioContext';
import { ModelPicker } from './components/ModelPicker';
import { ModeNav } from './components/ModeNav';
import { BigOPanel, BreakPanel, SpecPanel, type Analysis, type BreakCase } from './components/Analysis';
import { TracePanel } from './components/TracePanel';
import { detectFunction, fitComplexity, harnessLang, judgeChange, judgeClaim, measureTiming, normaliseClaim, runCases, tracePython, type Trace } from './lib/harness';
import { fetchModels, fetchQuota, modelKey, shortName, streamChat, trimHistory, type ChatMessage, type ModelInfo, type ModelRef, type Quota } from './lib/api';
import { CONTINUE_LABEL, NEXT, mainCodeBlock } from './lib/continueIn';
import { MODES, canSubmit, langLabel, modeById, normaliseInput, type ComposerInput, type ModeId } from './lib/modes';

const SKY = 'https://images.pexels.com/photos/35636373/pexels-photo-35636373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const MODEL_STORE = 'codeforge.model';
const SPLIT_STORE = 'codeforge.split';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  error?: string;
  model?: string;
  ms?: number;
  streaming?: boolean;
  cached?: boolean;
  fallbackFrom?: string;
  trimmed?: number;
  /** First user turn only: the code the session started from. */
  origin?: string;
  /** User turns sent automatically (e.g. "Auto-repair 1 of 2"). */
  auto?: string;
  /** In-browser check result for this answer (verify modes). */
  analysis?: Analysis;
  /** Step-through trace (local mode, no AI). */
  trace?: Trace;
  traceCode?: string;
}

const MAX_AUTO_REPAIRS = 2;

/** All fenced blocks of an answer, with their tags. */
/**
 * The JSON payload of an answer: a \`\`\`json block if there is one, otherwise the first
 * balanced {...} object in the text. Real models sometimes return bare JSON without
 * the fence (seen with Nemotron 3 Ultra), so accepting both avoids a needless failure.
 */
function findJson(md: string): string | null {
  const fenced = [...md.matchAll(/```json[^\n]*\n([\s\S]*?)```/gi)][0]?.[1];
  if (fenced) return fenced;
  const start = md.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < md.length; i++) {
    const c = md[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return md.slice(start, i + 1);
  }
  return null;
}

const blocksOf = (md: string) => [...md.matchAll(/```([\w+#-]*)[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ tag: m[1].toLowerCase(), code: m[2].replace(/\n$/, '') }));

const emptyInput = (): ComposerInput => ({
  code: '', notes: '', extra: '', language: 'auto', target: 'python', diagram: 'auto',
  cases: [{ args: '', expected: '' }, { args: '', expected: '' }, { args: '', expected: '' }],
});
const uid = () => Math.random().toString(36).slice(2, 10);
/** Event-time clock (kept outside the component: timings are only taken in handlers). */
const clock = () => performance.now();
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export default function Studio() {
  const [modeId, setModeId] = useState<ModeId>('generate');
  const mode = modeById(modeId);

  // Each mode keeps its own conversation. The code box (and its language) is shared by every
  // code-based mode, so you paste once and move between Review, Refactor, Tests and so on.
  const [inputs, setInputs] = useState<Record<ModeId, ComposerInput>>(
    () => Object.fromEntries(MODES.map((m) => [m.id, { ...emptyInput(), language: m.id === 'generate' ? 'python' : 'auto' }])) as Record<ModeId, ComposerInput>
  );
  const [sessions, setSessions] = useState<Record<ModeId, Turn[]>>(
    () => Object.fromEntries(MODES.map((m) => [m.id, []])) as unknown as Record<ModeId, Turn[]>
  );
  const turns = sessions[modeId];
  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const [followUp, setFollowUp] = useState('');
  // The code each session started from, for diffs (the shared box may have changed since).
  const [origins, setOrigins] = useState<Partial<Record<ModeId, string>>>({});

  const updateInput = (m: ModeId, v: ComposerInput) =>
    setInputs((s) => {
      const next = { ...s, [m]: v };
      if (modeById(m).fields.code) {
        for (const other of MODES) if (other.fields.code) next[other.id] = { ...next[other.id], code: v.code, language: v.language };
      }
      return next;
    });

  // Free-tier allowance, refreshed after every reply and once a minute.
  const [quota, setQuota] = useState<Quota | null>(null);
  const refreshQuota = (fresh = false) => { fetchQuota(fresh).then(setQuota); };
  useEffect(() => {
    let alive = true;
    const load = () => fetchQuota().then((q) => alive && setQuota(q));
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelRef, setModelRef] = useState<ModelRef | null>(null);
  const selected = useMemo(() => (modelRef ? models.find((m) => modelKey(m) === modelKey(modelRef)) ?? null : null), [models, modelRef]);

  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchModels().then(
      (data) => {
        if (!alive) return;
        const saved = data.models.find((m) => modelKey(m) === store.get(MODEL_STORE));
        setModels(data.models);
        setModelRef(saved ? { provider: saved.provider, model: saved.model } : data.default);
        setModelStatus(data.models.length ? 'ready' : 'error');
      },
      () => alive && setModelStatus('error')
    );
    return () => { alive = false; };
  }, [reload]);
  const retryModels = () => { setModelStatus('loading'); setReload((n) => n + 1); };
  // Refresh the "busy right now" markers whenever the picker opens.
  const refreshBusy = () => {
    fetchModels().then((data) => data.models.length && setModels(data.models), () => {});
  };

  const chooseModel = (ref: ModelRef) => {
    setModelRef(ref);
    store.set(MODEL_STORE, modelKey(ref));
  };

  // Resizable split, remembered per browser.
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(() => Number(store.get(SPLIT_STORE)) || 40);
  const setLeft = (pct: number) => {
    const v = Math.min(70, Math.max(24, pct));
    setLeftPct(v);
    store.set(SPLIT_STORE, String(v));
  };
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = splitRef.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => setLeft(((ev.clientX - box.left) / box.width) * 100);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Streaming
  const abortRef = useRef<AbortController | null>(null);
  const busy = turns.some((t) => t.streaming);
  const anyBusy = Object.values(sessions).some((s) => s.some((t) => t.streaming));

  const patchTurn = (m: ModeId, id: string, patch: Partial<Turn>) =>
    setSessions((s) => ({ ...s, [m]: s[m].map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  // Keep the output pinned to the bottom while streaming, unless the user scrolled up.
  const outRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = outRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  // analyse() starts auto-repair runs and run() starts analyses; the ref breaks the cycle
  // so neither function refers to the other before it is declared.
  const runRef = useRef<((m: ModeId, history: Turn[], opts?: { noCache?: boolean }) => Promise<void>) | null>(null);

  /**
   * After an answer in a verify mode, run it in the browser and attach the result.
   * Break it and Big-O re-run on new code automatically when a follow-up returns a fix.
   */
  const analyse = async (m: ModeId, history: Turn[], reply: Turn) => {
    if (m !== 'spec' && m !== 'break' && m !== 'bigo') return;
    const input = normaliseInput(modeById(m), inputs[m]);
    const lang = harnessLang(input.language);
    if (!lang) return;
    const set = (analysis: Analysis) => patchTurn(m, reply.id, { analysis });
    const earlier = (sessionsRef.current[m] ?? []).filter((t) => t.role === 'assistant' && t.id !== reply.id);
    const origin = history.find((t) => t.origin !== undefined)?.origin ?? input.code;
    const blocks = blocksOf(reply.content).filter((b) => !['json', 'text', 'mermaid', 'regex', 'diff', 'console', 'output'].includes(b.tag));
    const generatorRe = /\b(def\s+make_input|function\s+makeInput|const\s+makeInput)\b/;
    // Latest code the model wrote in this session for `fn`, newest first.
    const latestCode = (fn: string | undefined) => {
      const mine = blocks.filter((b) => !generatorRe.test(b.code)).find((b) => !fn || detectFunction(lang, b.code, fn) === fn);
      if (mine) return { code: mine.code, fixed: true };
      for (const t of [...earlier].reverse()) {
        const b = blocksOf(t.content).find((x) => !generatorRe.test(x.code) && !['json', 'text'].includes(x.tag) && (!fn || detectFunction(lang, x.code, fn) === fn));
        if (b) return { code: b.code, fixed: true };
      }
      return { code: origin, fixed: false };
    };

    if (m === 'spec') {
      const cases = input.cases.filter((c) => c.args.trim() && c.expected.trim());
      const block = blocks.sort((a, b) => b.code.length - a.code.length)[0];
      if (!block) return set({ kind: 'spec', status: 'done', cases, error: 'The answer didn’t include a code block to check. Try Regenerate or another model.' });
      const fn = detectFunction(lang, block.code, 'solve') ?? 'solve';
      const repairs = history.filter((t) => t.auto).length;
      set({ kind: 'spec', status: 'running', fn, cases, repair: repairs });
      const rep = await runCases(lang, block.code, fn, cases);
      set({ kind: 'spec', status: 'done', fn, cases, results: rep.results, error: rep.error, repair: repairs });
      const failing = rep.error ? null : cases.map((c, i) => ({ c, r: rep.results[i] })).filter((x) => !x.r?.ok);
      if ((rep.error || failing?.length) && repairs < MAX_AUTO_REPAIRS) {
        const detail = rep.error
          ? `The code failed to run:\n\`\`\`text\n${rep.error}\n\`\`\``
          : failing!.map(({ c, r }) => `- ${fn}(${c.args}) → ${r?.error ?? r?.got} (expected ${c.expected})`).join('\n');
        const next: Turn = { id: uid(), role: 'user', auto: `Auto-repair ${repairs + 1} of ${MAX_AUTO_REPAIRS}`, content: `I ran your code against my examples and some failed:\n\n${detail}\n\nFix \`${fn}\` so every example passes. Return the full corrected code in one block.` };
        const latest = sessionsRef.current[m];
        void runRef.current?.(m, [...latest.filter((t) => t.id !== reply.id).concat(latest.find((t) => t.id === reply.id) ?? reply)].filter((t) => !t.streaming).concat(next));
      }
      return;
    }

    if (m === 'break') {
      let cases: BreakCase[] | undefined;
      let fn: string | undefined;
      const jsonText = findJson(reply.content);
      const json = jsonText ? { code: jsonText } : null;
      if (json) {
        try {
          const parsed = JSON.parse(json.code) as { function?: string; cases?: { args?: unknown; why?: unknown; expect?: unknown }[] };
          fn = typeof parsed.function === 'string' ? parsed.function : undefined;
          cases = (parsed.cases ?? []).filter((c) => typeof c.args === 'string').slice(0, 14).map((c) => {
            const expect = c.expect === null || c.expect === undefined ? '' : String(c.expect);
            const expectError = expect.trim().toLowerCase() === 'error';
            return { args: c.args as string, why: typeof c.why === 'string' ? c.why : '', expectError, expected: expectError ? undefined : expect || undefined };
          });
        } catch {
          return set({ kind: 'break', status: 'done', target: 'original', cases: [], error: 'The model’s list of inputs wasn’t valid JSON, so nothing could be run. Try Regenerate or another model.' });
        }
      } else {
        // A follow-up with a fix: re-run the previous inputs on the new code.
        const prev = [...earlier].reverse().find((t) => t.analysis?.kind === 'break' && t.analysis.cases.length)?.analysis;
        if (!prev || prev.kind !== 'break' || !blocks.length) return;
        cases = prev.cases;
        fn = prev.fn;
      }
      if (!cases?.length) return set({ kind: 'break', status: 'done', target: 'original', cases: [], error: 'The model didn’t propose any inputs to run.' });
      const target = json ? { code: origin, fixed: false } : latestCode(fn);
      const callable = detectFunction(lang, target.code, input.notes.trim() || fn) ?? fn;
      if (!callable) return set({ kind: 'break', status: 'done', target: 'original', cases, error: 'Couldn’t find a function to call in the code.' });
      const tgt = target.fixed ? 'fixed' : 'original';
      set({ kind: 'break', status: 'running', fn: callable, target: tgt, cases });
      const rep = await runCases(lang, target.code, callable, cases.map((c) => ({ args: c.args, expected: c.expected })), { isolate: true, limitMs: 2500 });
      set({ kind: 'break', status: 'done', fn: callable, target: tgt, cases, results: rep.results, error: rep.error });
      return;
    }

    // Big-O
    const claimLine = /claim\s*:?\s*\**\s*`?(O\([^)\n]*\))/i.exec(reply.content)?.[1] ?? /\bO\((?:1|log ?n|n(?: ?log ?n)?|n\^?[23²³]|2\^n)\)/i.exec(reply.content)?.[0];
    let generator = blocks.find((b) => generatorRe.test(b.code))?.code;
    if (!generator) {
      for (const t of [...earlier].reverse()) {
        const g = blocksOf(t.content).find((b) => generatorRe.test(b.code));
        if (g) { generator = g.code; break; }
      }
    }
    const fnHint = input.notes.trim() || undefined;
    const target = latestCode(fnHint);
    const prevClaim = [...earlier].reverse().find((t) => t.analysis?.kind === 'bigo')?.analysis;
    const claimText = claimLine ?? (prevClaim?.kind === 'bigo' ? prevClaim.claimText : undefined);
    const claim = claimText ? normaliseClaim(claimText) : null;
    const tgt = target.fixed ? 'fixed' : 'original';
    if (!generator) return set({ kind: 'bigo', status: 'done', target: tgt, claim, claimText, error: 'The answer didn’t include an input generator, so the code couldn’t be timed. Try Regenerate.' });
    const fn = detectFunction(lang, target.code, fnHint) ?? undefined;
    if (!fn) return set({ kind: 'bigo', status: 'done', target: tgt, claim, claimText, error: 'Couldn’t find a function to time in the code.' });
    set({ kind: 'bigo', status: 'running', fn, target: tgt, claim, claimText });
    const genName = lang === 'python' ? 'make_input' : 'makeInput';
    const t = await measureTiming(lang, target.code, fn, generator, genName);
    const fit = fitComplexity(t.points);
    if (t.error || !fit) {
      return set({ kind: 'bigo', status: 'done', fn, target: tgt, claim, claimText, points: t.points, error: t.error ?? 'The function ran too fast (or too few sizes finished) to measure a trend. Try a heavier input generator.' });
    }
    // A rewrite with no fresh claim is compared with the previous measurement, not the old claim.
    const before = prevClaim?.kind === 'bigo' ? prevClaim.best : undefined;
    const rewrite = tgt === 'fixed' && !claimLine && before;
    const judged = rewrite ? judgeChange(before, fit.best.key) : judgeClaim(fit, claim);
    set({
      kind: 'bigo', status: 'done', fn, target: tgt, claim: rewrite ? null : claim, claimText, before: rewrite ? before : undefined, points: t.points,
      best: fit.best.key, slope: fit.slope, constants: Object.fromEntries(fit.fits.map((f) => [f.key, f.c])),
      verdict: judged.verdict, note: judged.note,
    });
  };

  /** Step through: trace locally, no AI request. */
  const startTrace = async (code: string) => {
    const user: Turn = { id: uid(), role: 'user', content: mode.build({ ...inputs[modeId], code }), origin: code };
    const reply: Turn = { id: uid(), role: 'assistant', content: '', streaming: true, model: 'Python in your browser', traceCode: code };
    setSessions((s) => ({ ...s, trace: [user, reply] }));
    const started = clock();
    const trace = await tracePython(code);
    const summary = `(I ran the program in a step-through debugger: ${trace.steps.length} steps${trace.error ? `, stopped with ${trace.error}` : ''}.${trace.stdout ? ` It printed:\n${trace.stdout.slice(0, 1500)}` : ''})`;
    patchTurn('trace', reply.id, { streaming: false, trace, content: summary, ms: clock() - started });
  };

  const run = async (m: ModeId, history: Turn[], opts: { noCache?: boolean } = {}) => {
    if (!modelRef || !selected) return;
    const def = modeById(m);
    const input = inputs[m];
    const { messages, dropped } = trimHistory([
      { role: 'system', content: def.system(input.language, input.target, input.diagram) },
      ...history.filter((t) => !t.error && t.content).map((t): ChatMessage => ({ role: t.role, content: t.content })),
    ]);
    const reply: Turn = { id: uid(), role: 'assistant', content: '', streaming: true, model: shortName(selected), trimmed: dropped || undefined };
    // Keep the newest version of each earlier turn (analysis results are attached after the fact).
    setSessions((s) => ({ ...s, [m]: [...history.map((h) => s[m].find((c) => c.id === h.id) ?? h), reply] }));

    const controller = new AbortController();
    abortRef.current = controller;
    const started = clock();
    let content = '';
    let reasoning = '';
    let frame = 0;
    const flush = () => { frame = 0; patchTurn(m, reply.id, { content, reasoning }); };

    try {
      for await (const d of streamChat(modelRef, messages, controller.signal, opts)) {
        if (d.meta) {
          const meta = d.meta;
          patchTurn(m, reply.id, { model: shortName({ ...meta, context: null }), cached: meta.cached, fallbackFrom: meta.fallbackFrom ? meta.fallbackFrom.replace(/^[^:]+:\s*/, '') : undefined });
          continue;
        }
        if (d.content) content += d.content;
        if (d.reasoning) reasoning += d.reasoning;
        if (!frame) frame = requestAnimationFrame(flush); // batch renders to one per frame
      }
      cancelAnimationFrame(frame);
      patchTurn(m, reply.id, {
        content, reasoning, streaming: false, ms: clock() - started,
        error: content ? undefined : 'The model returned an empty response. Try again or pick another model.',
      });
      if (content) void analyse(m, history, { ...reply, content, reasoning, streaming: false });
    } catch (err) {
      cancelAnimationFrame(frame);
      const stopped = controller.signal.aborted;
      patchTurn(m, reply.id, {
        content, reasoning, streaming: false, ms: clock() - started,
        error: stopped ? (content ? undefined : 'Stopped.') : (err as Error).message,
      });
    } finally {
      abortRef.current = null;
      refreshQuota(true);
    }
  };

  const start = () => {
    const value = normaliseInput(mode, inputs[modeId]);
    if (!canSubmit(mode, value) || busy) return;
    setOrigins((o) => ({ ...o, [modeId]: value.code }));
    if (mode.fields.local) { void startTrace(value.code); return; }
    if (!selected) return;
    if (value.language !== inputs[modeId].language) updateInput(modeId, value);
    run(modeId, [{ id: uid(), role: 'user', content: mode.build(value), origin: value.code }]);
  };

  useEffect(() => { runRef.current = run; });

  /** Any follow-up in the current mode (used by "Explain this step", "Fix these failures"…). */
  const ask = (text: string) => {
    if (busy || !selected) return;
    pinned.current = true;
    run(modeId, [...turns, { id: uid(), role: 'user', content: text }]);
  };

  const sendFollowUp = () => {
    const text = followUp.trim();
    if (!text || busy || !selected) return;
    setFollowUp('');
    run(modeId, [...turns, { id: uid(), role: 'user', content: text }]);
  };

  const askFix = (kind: 'diagram' | 'run', detail: string, lang = '') => {
    if (busy || !selected) return;
    const content = kind === 'diagram'
      ? `The Mermaid diagram failed to render with this error:\n\n\`\`\`text\n${detail}\n\`\`\`\n\nReturn the full corrected Mermaid block, following the Mermaid rules strictly.`
      : `I ran the ${lang} code from your answer in the browser and it failed:\n\n\`\`\`text\n${detail}\n\`\`\`\n\nFix it and return the full corrected code. Note: it runs in a browser background worker (no filesystem, network or third-party packages).`;
    run(modeId, [...turns, { id: uid(), role: 'user', content }]);
  };

  const regenerate = () => {
    const lastUser = turns.map((t) => t.role).lastIndexOf('user');
    if (lastUser >= 0 && !busy) run(modeId, turns.slice(0, lastUser + 1), { noCache: true });
  };

  const newSession = () => {
    if (busy) abortRef.current?.abort();
    setSessions((s) => ({ ...s, [modeId]: [] }));
    setFollowUp('');
  };

  const last = [...turns].reverse().find((t) => t.role === 'assistant');
  const status = busy ? 'streaming' : last?.error ? 'error' : last ? 'done' : 'ready';
  const input = inputs[modeId];
  const fileLabel = `${mode.id}${input.language === 'auto' ? '' : ` · ${langLabel(input.language)}`}${mode.fields.targetLanguage ? ` → ${langLabel(input.target)}` : ''}`;

  /** Carry the answer's code (or the session's code) into another mode, ready to run. */
  const continueIn = (target: ModeId) => {
    if (!last) return;
    const block = mainCodeBlock(last.content);
    const code = block?.code ?? origins[modeId] ?? input.code;
    const language = block && block.language !== 'auto' ? block.language : input.language;
    if (sessions[target].length && !window.confirm(`Start a new ${modeById(target).title} session? Your current one in that tab will be cleared.`)) return;
    updateInput(target, { ...inputs[target], code, language, notes: '', extra: '' });
    setSessions((s) => ({ ...s, [target]: [] }));
    setModeId(target);
    pinned.current = true;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#151719] lg:h-dvh">
      {/* Slim sky bar: brand, modes and model in one row */}
      {/* No overflow-hidden here: popovers (model picker) must escape the bar. Only the sky layer is clipped. */}
      <header className="relative z-30 shrink-0 bg-[#2469a9] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <img src={SKY} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_32%] opacity-90" />
          <div className="absolute inset-0 bg-linear-to-r from-[#0e4377]/70 via-[#267bbb]/35 to-[#0e4377]/60" />
          <Clouds />
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5 lg:h-14 lg:flex-nowrap lg:py-0">
          <a href="/" className="-my-1.5 flex shrink-0 items-center gap-2 py-1.5 text-[15px] font-semibold tracking-[-0.03em]" title="Back to home">
            <Sparkles size={17} strokeWidth={2.5} /> CodeForge
            <span className="ml-1 hidden rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.18em] text-white/85 sm:inline">Studio</span>
          </a>
          <ModeNav active={modeId} live={(id) => sessions[id].some((t) => t.streaming)} onSelect={setModeId} />
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            <ModelPicker models={models} selected={selected} status={modelStatus} onSelect={chooseModel} onRetry={retryModels} onOpen={refreshBusy} />
            <a href="https://github.com/saiharsh11/CodeForge-AI-Code-Studio" target="_blank" rel="noopener noreferrer" className="hidden rounded-full border border-white/30 bg-white/10 p-1.5 backdrop-blur-sm transition hover:bg-white/20 sm:block" aria-label="GitHub">
              <Github size={14} />
            </a>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col lg:flex-row" style={{ '--left': `${leftPct}%` } as React.CSSProperties}>
            {/* Left: input or session */}
            <section className="flex min-h-0 flex-col border-b border-black/10 bg-[#fcfcfb] p-4 sm:p-6 lg:w-[var(--left)] lg:shrink-0 lg:border-b-0">
              {turns.length === 0 ? (
                <Composer mode={mode} value={normaliseInput(mode, input)} onChange={(v) => updateInput(modeId, v)} onSubmit={() => { start(); }} disabled={(!selected && !mode.fields.local) || anyBusy} />
              ) : (
                <div className="cf-fade-in flex min-h-0 flex-1 flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">Session · {mode.title}</span>
                    <button onClick={newSession} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-black/45 transition hover:bg-[#f4f4f1] hover:text-black">
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                    {turns.filter((t) => t.role === 'user').map((t, i) => (
                      <li key={t.id} className="cf-fade-in rounded-xl border border-black/10 bg-white p-3.5">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#267bbb]">{i === 0 ? mode.title : t.auto ?? `Follow-up ${i}`}</p>
                        <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-5 text-black/60">{(i === 0 ? t.content.split('\n\n').slice(1).join('\n\n') : t.content).replace(/\*\*/g, '').replace(/^```.*$/gm, '').trim()}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 rounded-xl border border-black/10 bg-white p-2 transition focus-within:border-[#267bbb]/50">
                    <textarea
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp(); }
                      }}
                      rows={2}
                      placeholder="Ask a follow-up… e.g. “now add error handling”"
                      className="w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none placeholder:text-black/30"
                    />
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-black/30">Enter to send · Shift+Enter for a new line</span>
                      {busy ? (
                        <button onClick={() => abortRef.current?.abort()} className="flex items-center gap-1.5 rounded-lg bg-[#111317] px-3 py-1.5 text-[11px] font-semibold text-white">
                          <Square size={10} fill="currentColor" /> Stop
                        </button>
                      ) : (
                        <button onClick={sendFollowUp} disabled={!followUp.trim() || !selected} className="rounded-lg bg-[#111317] p-1.5 text-white transition hover:bg-black disabled:opacity-25" aria-label="Send">
                          <ArrowUp size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Drag to resize (desktop) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              tabIndex={0}
              onPointerDown={startDrag}
              onDoubleClick={() => setLeft(40)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setLeft(leftPct - 2);
                if (e.key === 'ArrowRight') setLeft(leftPct + 2);
              }}
              className="group relative hidden w-px shrink-0 cursor-col-resize bg-black/10 outline-none lg:block"
            >
              <span className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
              <span className="absolute left-1/2 top-1/2 z-10 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/15 transition group-hover:bg-[#267bbb] group-focus-visible:bg-[#267bbb]" />
            </div>

            {/* Right: dark output */}
            <section className={`flex ${turns.length ? 'min-h-[460px]' : 'min-h-[260px]'} min-w-0 flex-1 flex-col bg-[#171b20] text-[#d2dce3] lg:min-h-0`}>
              <div className="flex items-center justify-between px-5 pb-3 pt-5 font-mono text-[10px] text-white/35 sm:px-7">
                <span className="truncate">{fileLabel}</span>
                <span className={status === 'streaming' ? 'text-[#79b8e4]' : status === 'error' ? 'text-[#f08c7c]' : status === 'done' ? 'text-[#7cc597]' : ''}>
                  {status === 'streaming' ? 'streaming…' : status}
                </span>
              </div>
              <div
                ref={outRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7"
              >
                <StudioContext.Provider value={{ askFix: busy ? null : askFix, ask: busy || !selected ? null : ask, original: origins[modeId] ?? '', sample: input.extra }}>
                {turns.length === 0 ? (
                  <Placeholder mode={modeId} />
                ) : (
                  turns.map((t, i) =>
                    t.role === 'user' ? (
                      i > 0 && (
                        <div key={t.id} className="cf-fade-in mb-4 mt-8 flex items-start gap-2 border-t border-white/[.07] pt-5 text-xs text-white/45">
                          {t.auto ? <RotateCw size={13} className="mt-0.5 shrink-0 text-[#e7c47a]" /> : <CornerDownRight size={13} className="mt-0.5 shrink-0 text-[#79b8e4]" />}
                          <span className="line-clamp-2">
                            {t.auto && <b className="mr-1.5 font-semibold text-[#e7c47a]">{t.auto}:</b>}
                            {t.auto ? 'some examples failed, so the errors were sent back for a fix.' : t.content}
                          </span>
                        </div>
                      )
                    ) : (
                      <Reply key={t.id} turn={t} isLast={t === last} onRegenerate={regenerate} />
                    )
                  )
                )}
                {last && !busy && !last.error && last.content && NEXT[modeId].length > 0 && (
                  <div className="cf-fade-in mt-7 border-t border-white/[.07] pt-4">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">
                      Continue with {mainCodeBlock(last.content) ? 'this code' : 'your code'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {NEXT[modeId].map((target) => {
                        const Icon = modeById(target).icon;
                        return (
                          <button
                            key={target}
                            onClick={() => continueIn(target)}
                            className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/70 transition hover:-translate-y-0.5 hover:border-[#267bbb] hover:bg-[#267bbb] hover:text-white"
                          >
                            <Icon size={12} /> {CONTINUE_LABEL[target]}
                            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </StudioContext.Provider>
              </div>
            </section>
          </div>

          {/* Status bar */}
          <div className="flex h-7 shrink-0 items-center gap-4 border-t border-black/10 bg-[#fcfcfb] px-4 text-[10px] text-black/40">
            <span className="mr-auto truncate">
              {last && !last.streaming && last.ms
                ? `${last.content.length.toLocaleString()} chars · ${(last.ms / 1000).toFixed(1)}s`
                : busy ? 'Generating…' : `${models.length || '—'} free models available`}
            </span>
            {quota && <QuotaMeter quota={quota} />}
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${modelStatus === 'error' ? 'bg-[#be634f]' : 'bg-[#56aa75]'}`} />
              <span className="truncate">{selected ? `${shortName(selected)} · ${selected.provider === 'groq' ? 'Groq' : 'OpenRouter'}` : modelStatus === 'error' ? 'Offline' : '…'}</span>
            </span>
          </div>
      </main>
    </div>
  );
}

function Reply({ turn, isLast, onRegenerate }: { turn: Turn; isLast: boolean; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const thinking = turn.streaming && !turn.content;

  return (
    <article className="cf-fade-in">
      {(turn.fallbackFrom || turn.trimmed) && (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          {turn.fallbackFrom && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#e7c47a]/25 bg-[#e7c47a]/[.08] px-2.5 py-1 text-[#e7c47a]">
              <Shuffle size={11} /> {turn.fallbackFrom} was busy, so {turn.model} answered
            </span>
          )}
          {turn.trimmed && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-white/40">
              <Scissors size={11} /> {turn.trimmed} older messages left out to save quota
            </span>
          )}
        </div>
      )}
      {turn.reasoning && (
        <details className="mb-3 text-xs text-white/40" open={thinking}>
          <summary className="cursor-pointer select-none list-none">
            <span className={thinking ? 'animate-pulse' : ''}>{thinking ? 'Thinking…' : 'Show reasoning'}</span>
          </summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap border-l border-white/10 pl-3 font-mono text-[11px] leading-5">{turn.reasoning}</p>
        </details>
      )}
      {turn.traceCode !== undefined ? (
        turn.trace ? <TracePanel code={turn.traceCode} trace={turn.trace} /> : <p className="flex items-center gap-2 text-xs text-white/45"><span className="cf-caret">Running your program step by step</span></p>
      ) : thinking && !turn.reasoning && <p className="cf-caret font-mono text-xs text-white/35">Waiting for the model</p>}
      {turn.content && turn.traceCode === undefined && (
        <div>
          <Markdown text={turn.content} streaming={!!turn.streaming} />
          {turn.streaming && <span className="cf-caret" />}
        </div>
      )}
      {turn.analysis?.kind === 'spec' && <SpecPanel a={turn.analysis} />}
      {turn.analysis?.kind === 'break' && <BreakPanel a={turn.analysis} />}
      {turn.analysis?.kind === 'bigo' && <BigOPanel a={turn.analysis} />}
      {turn.error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#f08c7c]/25 bg-[#f08c7c]/[.07] px-4 py-3 text-xs text-[#f5b3a8]">
          <span>{turn.error}</span>
          {isLast && (
            <button onClick={onRegenerate} className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-white transition hover:bg-white/15">
              <RotateCw size={11} /> Retry
            </button>
          )}
        </div>
      )}
      {!turn.streaming && turn.content && turn.traceCode === undefined && (
        <div className="mt-4 flex items-center gap-1 text-[11px] text-white/35">
          <button
            onClick={async () => { await navigator.clipboard.writeText(turn.content); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/5 hover:text-white"
          >
            {copied ? <Check size={12} className="text-[#7cc597]" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
          {isLast && (
            <button onClick={onRegenerate} className="flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-white/5 hover:text-white">
              <RotateCw size={12} /> Regenerate
            </button>
          )}
          {turn.cached && (
            <span className="ml-2 flex items-center gap-1 rounded-full bg-[#7cc597]/10 px-2 py-0.5 text-[10px] text-[#7cc597]" title="Same question as earlier in this tab: answered from this tab’s memory, no request sent, no quota used">
              <Zap size={10} /> from this tab · 0 quota used
            </span>
          )}
          {turn.model && <span className="ml-auto truncate pl-3 text-white/25">{turn.model}{turn.ms ? ` · ${(turn.ms / 1000).toFixed(1)}s` : ''}</span>}
        </div>
      )}
    </article>
  );
}

const PLACEHOLDERS: Record<ModeId, string[]> = {
  generate: ['Describe what you want to build.', 'Mention libraries, constraints or style.', 'Pick a language, or let the model choose.'],
  review: ['Paste code to get a structured review:', '  bugs · security · performance · quality', 'Add a focus if something worries you.'],
  explain: ['Paste unfamiliar code.', 'Ask a specific question, or get a guided walkthrough.'],
  error: ['Paste just the error or stack trace — no code needed.', 'Get what it means, the likely causes, and the fix.'],
  regex: ['Describe the pattern in plain English.', 'Add sample text and test the regex live, right here.'],
  spec: ['Give a few examples of inputs and the outputs you expect.', 'The AI writes solve(), and every example is run to check it.', 'Failures are sent back for repair automatically (twice at most).'],
  break: ['Paste a function. The AI invents edge-case inputs,', 'then each one is actually run against your code.', 'You see which inputs crash, hang or return the wrong thing.'],
  bigo: ['Paste a function. The AI states its time complexity,', 'then your code is timed at growing input sizes', 'and the claim is compared with the measurements.'],
  trace: ['Paste Python and watch it run one line at a time,', 'with every variable’s value at every step.', 'No AI request — this runs entirely in your browser.'],
  diagram: ['Paste code to visualise.', 'Flowchart, sequence, class or state diagram —', 'or let the model pick the clearest one.'],
  refactor: ['Paste code to clean up.', 'Behaviour and public interface stay the same.'],
  convert: ['Paste code and choose a target language.', 'You get idiomatic code, not a line-by-line copy.'],
  tests: ['Paste code to test.', 'Happy path, edge cases and error paths.', 'Name a framework or use the default.'],
  debug: ['Paste the code and the error.', 'Get the root cause, the fix, and how to avoid it.'],
};

function Placeholder({ mode }: { mode: ModeId }) {
  return (
    <div key={mode} className="cf-fade-in font-mono text-xs leading-[1.9] text-white/30">
      {PLACEHOLDERS[mode].map((l) => <p key={l}>{'// '}{l}</p>)}
      <p className="mt-4">{'// '}<span className="text-[#79b8e4]">⌘↵</span> to run · follow up in the chat afterwards</p>
      <p className="cf-caret mt-4" />
    </div>
  );
}

function QuotaMeter({ quota }: { quota: Quota }) {
  const pct = quota.limit ? quota.remaining / quota.limit : 0;
  const hours = quota.hoursLeft;
  const tone = quota.remaining === 0 ? 'text-[#be634f]' : pct < 0.2 ? 'text-[#a27822]' : 'text-black/45';
  const bar = quota.remaining === 0 ? 'bg-[#be634f]' : pct < 0.2 ? 'bg-[#e0a43a]' : 'bg-[#56aa75]';
  return (
    <span
      className={`hidden shrink-0 items-center gap-2 sm:flex ${tone}`}
      title={`OpenRouter free-model requests today: ${quota.used} used of ${quota.limit}. Resets at 00:00 UTC${hours ? ` (in about ${hours}h)` : ''}. Cached answers don't count.`}
    >
      <span className="h-1 w-14 overflow-hidden rounded-full bg-black/10">
        <span className={`block h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
      {quota.remaining === 0 ? `Daily free limit reached · resets in ${hours}h` : `${quota.remaining} of ${quota.limit} free requests left today`}
    </span>
  );
}

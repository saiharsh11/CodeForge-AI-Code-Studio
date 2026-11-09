import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, Copy, Download, FlaskConical, Play, Recycle, RotateCw, ScanSearch, Sparkles, Wand2, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Github } from '@/components/GithubIcon';
import { Clouds } from '@/components/Clouds';

// A self-playing studio preview: types a prompt, streams the answer, then moves
// on to the next scenario. Only ticks while visible on screen.

type Seg = [text: string, cls?: string];

const K = 'text-[#72b5e4]'; // keyword
const S = 'text-[#b7d58d]'; // string
const F = 'text-[#e7c47a]'; // function / title
const D = 'text-white/35'; // dim
const W = 'text-[#f3f6f8] font-semibold';
const M = 'font-mono text-[11px] text-white/45'; // inline code line in prose

interface Scenario {
  tab: 'Generate' | 'Review';
  language: string;
  file: string;
  prompt: string;
  /** Characters typed per tick: code is long, so it types faster than prose. */
  typeSpeed: number;
  mono: boolean;
  inputPlaceholder: string;
  outputPlaceholder: string[];
  model: string;
  /** 'code' streams into a code card (like Generate); 'prose' streams as a written answer (like Review). */
  kind: 'code' | 'prose';
  intro?: string;
  next: { icon: LucideIcon; label: string }[];
  out: Seg[];
}

const SCENARIOS: Scenario[] = [
  {
    tab: 'Generate', language: 'TypeScript', file: 'useDebounce.ts', model: 'North Mini Code',
    prompt: 'Build a debounce hook in React',
    typeSpeed: 1, mono: false,
    inputPlaceholder: 'Describe what you want to build…',
    outputPlaceholder: ['// Describe what you want to build.', '// Mention libraries, constraints or style.'],
    kind: 'code', intro: 'Here’s a small, typed debounce hook.',
    next: [{ icon: ScanSearch, label: 'Review it' }, { icon: FlaskConical, label: 'Write tests' }, { icon: Workflow, label: 'Diagram it' }],
    out: [
      ['import', K], [' { useEffect, useState } '], ['from', K], [" 'react'", S], [';\n\n'],
      ['export function', K], [' '], ['useDebounce', F], ['<T>('], ['value', F], [': T, '], ['delay', F], [' = '], ['300', F], [') {\n'],
      ['  const [debounced, setDebounced] = useState(value);\n\n', D],
      ['  useEffect(() => {\n', D],
      ['    const timer = setTimeout(() => setDebounced(value), delay);\n', D],
      ['    return () => clearTimeout(timer);\n', D],
      ['  }, [value, delay]);\n\n', D],
      ['  return', K], [' debounced;\n}'],
    ],
  },
  {
    tab: 'Review', language: 'Python', file: 'auth.py', model: 'Nemotron 3 Ultra',
    prompt: `def login(email, password):
    user = db.execute(f"SELECT * FROM users WHERE email = '{email}'")
    if user and user.password == password:
        return create_session(user)`,
    typeSpeed: 4, mono: true,
    inputPlaceholder: 'Paste your code here…',
    outputPlaceholder: ['// Paste code to get a structured review:', '//   bugs · security · performance · quality'],
    kind: 'prose',
    next: [{ icon: Recycle, label: 'Refactor it' }, { icon: FlaskConical, label: 'Write tests' }, { icon: BookOpen, label: 'Explain it' }],
    out: [
      ['Verdict', W], [' — works, but two issues need fixing before release.\n\n'],
      ['[Security] ', 'text-[#f08c7c]'], ['Line 2 builds SQL with an f-string → injection.\n'],
      ['  db.execute("SELECT * FROM users WHERE email = %s", (email,))\n\n', M],
      ['[Bug] ', 'text-[#e7c47a]'], ['Passwords compared with ', ''], ['==', K], [' → timing leak.\n'],
      ['  hmac.compare_digest(user.password_hash, hash(password))\n\n', M],
      ['[Quality] ', K], ['Return early instead of nesting three ifs.'],
    ],
  },
];

const TOTAL = SCENARIOS.map((s) => s.out.reduce((n, [t]) => n + t.length, 0));
// Character offset at which each segment starts, per scenario.
const OFFSETS = SCENARIOS.map((s) => s.out.map((_, j) => s.out.slice(0, j).reduce((n, [t]) => n + t.length, 0)));
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LiveMockup() {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() =>
    reduceMotion() ? { i: 0, round: 0, typed: SCENARIOS[0].prompt.length, streamed: TOTAL[0], wait: 0 } : { i: 0, round: 0, typed: 0, streamed: 0, wait: 12 }
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el || reduceMotion()) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setState((s) => {
        const sc = SCENARIOS[s.i];
        if (s.wait > 0) return { ...s, wait: s.wait - 1 };
        if (s.typed < sc.prompt.length) {
          const typed = Math.min(sc.prompt.length, s.typed + sc.typeSpeed);
          return { ...s, typed, wait: typed === sc.prompt.length ? 14 : 0 };
        }
        if (s.streamed < TOTAL[s.i]) {
          const streamed = Math.min(TOTAL[s.i], s.streamed + 3);
          return { ...s, streamed, wait: streamed === TOTAL[s.i] ? 110 : 0 };
        }
        return { i: (s.i + 1) % SCENARIOS.length, round: (s.round + 1) % 20, typed: 0, streamed: 0, wait: 10 };
      });
    }, 34);
    return () => clearInterval(id);
  }, [visible]);

  // Gentle 3D tilt toward the cursor.
  const onMove = (e: React.MouseEvent) => {
    const el = root.current;
    if (!el || reduceMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1400px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg) translateY(-4px)`;
    el.style.boxShadow = `${(-x * 30).toFixed(0)}px ${(34 - y * 12).toFixed(0)}px 90px rgba(20,45,70,.24)`;
  };
  const onLeave = () => {
    if (!root.current) return;
    root.current.style.transform = '';
    root.current.style.boxShadow = '';
  };

  const sc = SCENARIOS[state.i];
  const streaming = state.typed === sc.prompt.length && state.streamed < TOTAL[state.i];
  const done = state.streamed === TOTAL[state.i];

  const shown = sc.out.map(([t, cls], j) => {
    const part = t.slice(0, Math.max(0, state.streamed - OFFSETS[state.i][j]));
    return part ? <span key={j} className={cls}>{part}</span> : null;
  });

  const tabs: { label: string; icon: LucideIcon }[] = [
    { label: 'Generate', icon: Wand2 }, { label: 'Review', icon: ScanSearch }, { label: 'Explain', icon: BookOpen },
    { label: 'Diagram', icon: Workflow }, { label: 'Refactor', icon: Recycle },
  ];
  // Each finished answer "uses" one free request, so the meter ticks down like the real one.
  const left = 49 - state.round - (done ? 1 : 0);
  const SKY = 'https://images.pexels.com/photos/35636373/pexels-photo-35636373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

  return (
    <div
      ref={root}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="cf-tilt overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(20,45,70,.18)]"
    >
      {/* Studio top bar: sky, brand, mode pills, model */}
      <div className="relative bg-[#2469a9] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img src={SKY} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_32%] opacity-90" />
          <div className="absolute inset-0 bg-linear-to-r from-[#0e4377]/70 via-[#267bbb]/35 to-[#0e4377]/60" />
          <Clouds />
        </div>
        <div className="relative flex h-12 items-center gap-3 px-3 sm:px-4">
          <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold tracking-[-0.03em]">
            <Sparkles size={14} strokeWidth={2.5} /> CodeForge
            <span className="ml-0.5 hidden rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.18em] text-white/85 md:inline">Studio</span>
          </span>
          <div className="mx-auto hidden gap-0.5 rounded-full bg-[#0b2f55]/45 p-0.5 text-[10px] font-semibold ring-1 ring-white/10 backdrop-blur-md sm:flex">
            {tabs.map((t, i) => (
              <span
                key={t.label}
                className={`items-center gap-1 rounded-full px-2.5 py-1 ${i > 2 ? 'hidden lg:flex' : 'flex'} ${t.label === sc.tab ? 'bg-white text-[#236aa3] shadow-[0_3px_10px_rgba(7,38,70,.25)]' : 'text-white/90'}`}
              >
                <t.icon size={10} /> {t.label}
              </span>
            ))}
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[#267bbb]/30 bg-[#edf6fd] px-2.5 py-1 text-[10px] font-medium text-[#236aa3] sm:ml-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[#56aa75]" /> <span className="hidden sm:inline">OpenRouter ·</span> {sc.model} <ChevronDown size={10} />
          </span>
          <span className="hidden rounded-full border border-white/30 bg-white/10 p-1 sm:block"><Github size={11} /></span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Input */}
        <div className="border-b border-black/10 bg-[#fcfcfb] p-4 sm:p-6 md:w-[40%] md:shrink-0 md:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">{sc.tab === 'Generate' ? 'Your prompt' : 'Your code'}</span>
            <span className="text-[10px] text-black/30">{state.typed.toLocaleString()} chars</span>
          </div>
          <div className="min-h-[180px] rounded-xl border border-black/10 bg-white p-4 text-sm text-black/60">
            {state.typed === 0 ? (
              <span className="text-black/30">{sc.inputPlaceholder}</span>
            ) : (
              <span className={sc.mono ? 'whitespace-pre-wrap font-mono text-[11px] leading-[1.7] text-black/65 sm:text-xs' : ''}>{sc.prompt.slice(0, state.typed)}</span>
            )}
            {state.typed < sc.prompt.length && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[#267bbb] align-middle" />}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[11px] text-black/50">{sc.language} <ChevronDown className="ml-3 inline" size={11} /></span>
            <span className={`flex items-center gap-1.5 rounded-lg bg-[#111317] px-3.5 py-1.5 text-[11px] font-semibold text-white transition ${streaming ? 'scale-95 opacity-70' : ''}`}>
              {sc.tab} <ArrowRight size={11} /> <span className="hidden font-normal text-white/45 sm:inline">⌘↵</span>
            </span>
          </div>
        </div>

        {/* Drag handle, as in the studio */}
        <div className="relative hidden w-px shrink-0 bg-black/10 md:block">
          <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/15" />
        </div>

        {/* Output */}
        <div className="min-h-[340px] min-w-0 flex-1 bg-[#171b20] p-4 text-[#d2dce3] sm:p-6">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-white/35">
            <span>{sc.tab.toLowerCase()} · {sc.language}</span>
            <span className={streaming ? 'text-[#79b8e4]' : done ? 'text-[#7cc597]' : ''}>{streaming ? 'streaming…' : done ? 'done' : 'ready'}</span>
          </div>

          {state.streamed === 0 ? (
            <div className="font-mono text-[11px] leading-[1.9] text-white/30 sm:text-xs">
              {sc.outputPlaceholder.map((l) => <p key={l}>{l}</p>)}
              {!streaming && <p className="cf-caret mt-3" />}
            </div>
          ) : sc.kind === 'code' ? (
            <>
              <p className="mb-3 text-[13px] text-[#d2dce3]">{sc.intro}</p>
              <div className="overflow-hidden rounded-xl border border-white/[.07] bg-[#0f1216]">
                <div className="flex items-center justify-between border-b border-white/[.06] px-3 py-1.5 text-[9px] uppercase tracking-[.16em] text-white/35">
                  <span>{sc.language}</span>
                  <span className="flex gap-3 normal-case tracking-normal">
                    <span className="flex items-center gap-1 text-[#7cc597]"><Play size={10} /> Run</span>
                    <span className="flex items-center gap-1"><Copy size={10} /> Copy</span>
                    <span className="hidden items-center gap-1 sm:flex"><Download size={10} /> Download</span>
                  </span>
                </div>
                <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-[1.75] sm:text-xs">{shown}{!done && <span className="cf-caret" />}</pre>
              </div>
            </>
          ) : (
            <div className="whitespace-pre-wrap text-[12.5px] leading-[1.75]">{shown}{!done && <span className="cf-caret" />}</div>
          )}

          {done && (
            <div className="cf-fade-in">
              <div className="mt-3 flex items-center gap-3 text-[10px] text-white/35">
                <span className="flex items-center gap-1"><Copy size={10} /> Copy</span>
                <span className="flex items-center gap-1"><RotateCw size={10} /> Regenerate</span>
              </div>
              <div className="mt-4 border-t border-white/[.07] pt-3">
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Continue with this code</p>
                <div className="flex flex-wrap gap-1.5">
                  {sc.next.map((n) => (
                    <span key={n.label} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] text-white/70">
                      <n.icon size={10} /> {n.label} <ArrowRight size={9} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-7 items-center gap-4 border-t border-black/10 bg-[#fcfcfb] px-4 text-[10px] text-black/40">
        <span className="mr-auto">{done ? `${TOTAL[state.i]} chars · ${(TOTAL[state.i] / 260).toFixed(1)}s` : streaming ? 'Generating…' : 'Ready'}</span>
        <span className="hidden items-center gap-2 sm:flex">
          <span className="h-1 w-12 overflow-hidden rounded-full bg-black/10">
            <span className="block h-full rounded-full bg-[#56aa75] transition-all duration-500" style={{ width: `${(left / 50) * 100}%` }} />
          </span>
          {left} of 50 free requests left today
        </span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#56aa75]" /> {sc.model}</span>
      </div>
    </div>
  );
}

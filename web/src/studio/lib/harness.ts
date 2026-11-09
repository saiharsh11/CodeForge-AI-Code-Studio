// Drives model-written code inside the browser's execution worker: call a function with specific
// inputs, time it at growing sizes, or trace it line by line. Results come back
// on one stdout line tagged __CF__, so the program's own prints stay separate.

import { runCode, type RunLang, type RunLine } from './runner';

const TAG = '__CF__';

export interface Case { args: string; expected?: string; note?: string }
export interface CaseResult { ok: boolean | null; got?: string; expected?: string; error?: string; timedOut?: boolean }

export type HarnessLang = RunLang;
export const harnessLang = (lang: string): HarnessLang | null =>
  ({ python: 'python', py: 'python', javascript: 'javascript', js: 'javascript', typescript: 'typescript', ts: 'typescript' } as const)[lang.toLowerCase() as 'python'] ?? null;

/** The function under test: the requested name if defined, else the first top-level function. */
export function detectFunction(lang: HarnessLang, code: string, preferred?: string): string | null {
  const names = lang === 'python'
    ? [...code.matchAll(/^def\s+([A-Za-z_]\w*)\s*\(/gm)].map((m) => m[1])
    : [...code.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/gm)].map((m) => m[1] ?? m[2]);
  if (preferred && names.includes(preferred)) return preferred;
  return names.find((n) => !n.startsWith('_') && n !== 'main' && n !== 'make_input' && n !== 'makeInput') ?? names[0] ?? null;
}

function parseTagged<T>(lines: RunLine[]): T | null {
  const line = [...lines].reverse().find((l) => l.kind === 'out' && l.text.startsWith(TAG));
  if (!line) return null;
  try { return JSON.parse(line.text.slice(TAG.length)) as T; } catch { return null; }
}
const userOutput = (lines: RunLine[]) => lines.filter((l) => !(l.kind === 'out' && l.text.startsWith(TAG)));

// ── Cases ──────────────────────────────────────────────────────────────────

const PY_EQ = `
def __cf_eq(a, b):
    import math
    if isinstance(a, float) or isinstance(b, float):
        try: return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12)
        except TypeError: return False
    return a == b
`;
const JS_EQ = `
const __cf_eq = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => __cf_eq(a[k], b[k]));
  }
  return Object.is(a, b);
};
const __cf_show = (v) => { try { return v === undefined ? 'undefined' : typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); } catch { return String(v); } };`;

function casesDriver(lang: HarnessLang, fn: string, cases: Case[]) {
  if (lang === 'python') {
    const rows = cases.map((c) => `    (lambda: (${c.args},), ${c.expected?.trim() ? `lambda: (${c.expected})` : 'None'}),`).join('\n');
    return `${PY_EQ}
import json as __cf_json
__cf_out = []
for __cf_a, __cf_e in [
${rows}
]:
    try:
        __cf_got = ${fn}(*__cf_a())
        if __cf_e is None:
            __cf_out.append({"ok": None, "got": repr(__cf_got)})
        else:
            __cf_exp = __cf_e()
            __cf_out.append({"ok": bool(__cf_eq(__cf_got, __cf_exp)), "got": repr(__cf_got), "expected": repr(__cf_exp)})
    except Exception as __cf_x:
        __cf_out.append({"ok": False, "error": type(__cf_x).__name__ + ": " + str(__cf_x)})
print("${TAG}" + __cf_json.dumps(__cf_out))
`;
  }
  const rows = cases.map((c) => `  [() => [${c.args}], ${c.expected?.trim() ? `() => (${c.expected})` : 'null'}],`).join('\n');
  return `${JS_EQ}
const __cf_out = [];
for (const [__cf_a, __cf_e] of [
${rows}
]) {
  try {
    const __cf_got = await ${fn}(...__cf_a());
    if (!__cf_e) __cf_out.push({ ok: null, got: __cf_show(__cf_got) });
    else { const __cf_exp = __cf_e(); __cf_out.push({ ok: __cf_eq(__cf_got, __cf_exp), got: __cf_show(__cf_got), expected: __cf_show(__cf_exp) }); }
  } catch (__cf_x) {
    __cf_out.push({ ok: false, error: (__cf_x && __cf_x.name ? __cf_x.name + ': ' : '') + (__cf_x && __cf_x.message || String(__cf_x)) });
  }
}
console.log("${TAG}" + JSON.stringify(__cf_out));`;
}

export interface CasesReport { results: CaseResult[]; output: RunLine[]; error?: string }

/**
 * Run each case against `fn`. With `isolate`, every case gets its own run and
 * time limit, so one hanging input can't hide the results of the others.
 */
export async function runCases(lang: HarnessLang, code: string, fn: string, cases: Case[], opts: { isolate?: boolean; limitMs?: number } = {}): Promise<CasesReport> {
  const limitMs = opts.limitMs ?? (opts.isolate ? 3000 : 8000);
  const batches = opts.isolate ? cases.map((c) => [c]) : [cases];
  const results: CaseResult[] = [];
  let output: RunLine[] = [];
  for (const batch of batches) {
    const r = await runCode(lang, `${code}\n\n${casesDriver(lang, fn, batch)}`, () => {}, { limitMs });
    const parsed = parseTagged<CaseResult[]>(r.lines);
    output = output.concat(userOutput(r.lines));
    if (parsed) results.push(...parsed);
    else if (r.timedOut) results.push(...batch.map(() => ({ ok: false, timedOut: true, error: `Timed out after ${limitMs / 1000}s` })));
    else if (!opts.isolate) return { results: [], output, error: r.error ?? 'The code did not run.' };
    else results.push({ ok: false, error: r.error ?? 'The code did not run.' });
  }
  return { results, output };
}

// ── Timing (Big-O) ─────────────────────────────────────────────────────────

export interface TimingPoint { n: number; seconds: number }

function timingDriver(lang: HarnessLang, fn: string, gen: string, budgetS: number) {
  // Every name here carries a reserved prefix: a user function called "total" or "n"
  // must never be shadowed by the harness.
  if (lang === 'python') {
    return `
import json as _cfh_json, time as _cfh_time
def _cfh_bench():
    _cfh_out, _cfh_n = [], 8
    _cfh_stop = _cfh_time.perf_counter() + ${budgetS}
    while _cfh_n <= 2 ** 22 and _cfh_time.perf_counter() < _cfh_stop:
        _cfh_total, _cfh_reps = 0.0, 0
        while _cfh_reps < 50 and _cfh_total < 0.03:
            _cfh_args = ${gen}(_cfh_n)
            if not isinstance(_cfh_args, tuple): _cfh_args = (_cfh_args,)
            _cfh_t0 = _cfh_time.perf_counter()
            ${fn}(*_cfh_args)
            _cfh_total += _cfh_time.perf_counter() - _cfh_t0
            _cfh_reps += 1
        _cfh_per = _cfh_total / _cfh_reps
        _cfh_out.append([_cfh_n, _cfh_per])
        if _cfh_per > 0.6: break
        _cfh_n *= 2
    print("${TAG}" + _cfh_json.dumps(_cfh_out))
_cfh_bench()
`;
  }
  return `
{
  const _cfh_out = []; let _cfh_n = 8;
  const _cfh_stop = performance.now() + ${budgetS * 1000};
  while (_cfh_n <= 2 ** 22 && performance.now() < _cfh_stop) {
    let _cfh_total = 0, _cfh_reps = 0;
    while (_cfh_reps < 50 && _cfh_total < 30) {
      let _cfh_args = ${gen}(_cfh_n);
      if (!Array.isArray(_cfh_args)) _cfh_args = [_cfh_args];
      const _cfh_t0 = performance.now();
      await ${fn}(..._cfh_args);
      _cfh_total += performance.now() - _cfh_t0;
      _cfh_reps++;
    }
    const _cfh_per = _cfh_total / _cfh_reps / 1000;
    _cfh_out.push([_cfh_n, _cfh_per]);
    if (_cfh_per > 0.6) break;
    _cfh_n *= 2;
  }
  console.log("${TAG}" + JSON.stringify(_cfh_out));
}`;
}

export async function measureTiming(lang: HarnessLang, code: string, fn: string, generatorCode: string, generatorName: string): Promise<{ points: TimingPoint[]; error?: string }> {
  const budget = 6;
  const r = await runCode(lang, `${code}\n\n${generatorCode}\n\n${timingDriver(lang, fn, generatorName, budget)}`, () => {}, { limitMs: (budget + 6) * 1000 });
  const parsed = parseTagged<[number, number][]>(r.lines);
  if (!parsed) return { points: [], error: r.error ?? 'Timing run produced no data.' };
  return { points: parsed.map(([n, seconds]) => ({ n, seconds })) };
}

export const COMPLEXITIES = [
  { key: 'O(1)', f: () => 1 },
  { key: 'O(log n)', f: (n: number) => Math.log2(n) },
  { key: 'O(n)', f: (n: number) => n },
  { key: 'O(n log n)', f: (n: number) => n * Math.log2(n) },
  { key: 'O(n²)', f: (n: number) => n * n },
  { key: 'O(n³)', f: (n: number) => n ** 3 },
  { key: 'O(2ⁿ)', f: (n: number) => 2 ** Math.min(n, 1000) },
] as const;
export type ComplexityKey = (typeof COMPLEXITIES)[number]['key'];

/** Map a model's claim ("O(n^2)", "O(N log N)", "linear") onto our canonical keys. */
export function normaliseClaim(text: string): ComplexityKey | null {
  const t = text.toLowerCase().replace(/\s+/g, '').replace(/\*/g, '').replace(/·/g, '');
  if (/o\(1\)|constant/.test(t)) return 'O(1)';
  if (/o\(n\^?3\)|o\(n³\)|cubic/.test(t)) return 'O(n³)';
  if (/o\(n\^?2\)|o\(n²\)|quadratic/.test(t)) return 'O(n²)';
  if (/o\(2\^n\)|o\(2ⁿ\)|exponential/.test(t)) return 'O(2ⁿ)';
  if (/o\(nlog(2)?n\)|o\(nlgn\)|linearithmic/.test(t)) return 'O(n log n)';
  if (/o\(log(2)?n\)|o\(lgn\)|logarithmic/.test(t)) return 'O(log n)';
  if (/o\(n\)|linear/.test(t)) return 'O(n)';
  return null;
}

/**
 * Best-fitting growth class for measured times. Fits t ≈ c·f(n) in log space on
 * points above the timer's noise floor, and also reports the log-log slope.
 */
export function fitComplexity(points: TimingPoint[]) {
  const usable = points.filter((p) => p.seconds > 2e-6);
  if (usable.length < 4) return null;
  const xs = usable.map((p) => Math.log(p.n));
  const ys = usable.map((p) => Math.log(p.seconds));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);

  const fits = COMPLEXITIES.filter((c) => c.key !== 'O(2ⁿ)' || usable[usable.length - 1].n <= 64).map((c) => {
    const logs = usable.map((p) => Math.log(Math.max(c.f(p.n), 1e-12)));
    const logC = ys.reduce((s, y, i) => s + (y - logs[i]), 0) / ys.length; // best constant in log space
    const err = ys.reduce((s, y, i) => s + (y - (logC + logs[i])) ** 2, 0) / ys.length;
    return { key: c.key as ComplexityKey, err, c: Math.exp(logC) };
  }).sort((a, b) => a.err - b.err);
  return { best: fits[0], fits, slope };
}

// ── Tracing (Python) ───────────────────────────────────────────────────────

export interface TraceStep {
  line: number;
  event: 'line' | 'call' | 'return' | 'exception';
  func: string;
  depth: number;
  locals: Record<string, string>;
  stdout: number; // characters of output written so far
  value?: string; // return value / exception text
}
export interface Trace { steps: TraceStep[]; stdout: string; truncated: boolean; error?: string }

const MAX_STEPS = 600;

export async function tracePython(code: string): Promise<Trace> {
  const driver = `
import sys as _cft_sys, json as _cft_json, types as _cft_types
_cft_src = ${JSON.stringify(code)}
_cft_steps, _cft_buf = [], []
class _CftOut:
    def write(self, s): _cft_buf.append(s); return len(s)
    def flush(self): pass
def _cft_repr(v):
    try: r = repr(v)
    except Exception: r = '<unrepresentable>'
    return r if len(r) <= 80 else r[:77] + '...'
def _cft_vars(frame):
    out = {}
    for k, v in frame.f_locals.items():
        if k.startswith('__') or isinstance(v, (_cft_types.ModuleType, _cft_types.FunctionType, type)): continue
        out[k] = _cft_repr(v)
        if len(out) >= 24: break
    return out
class _CftStop(Exception): pass
def _cft_depth(frame):
    d = 0
    while frame is not None:
        if frame.f_code.co_filename == '<code>': d += 1
        frame = frame.f_back
    return d
def _cft_tracer(frame, event, arg):
    if frame.f_code.co_filename != '<code>': return None
    if event in ('line', 'call', 'return', 'exception'):
        step = {"line": frame.f_lineno, "event": event, "func": frame.f_code.co_name, "depth": _cft_depth(frame),
                "locals": _cft_vars(frame), "stdout": sum(len(s) for s in _cft_buf)}
        if event == 'return': step["value"] = _cft_repr(arg)
        if event == 'exception': step["value"] = arg[0].__name__ + ': ' + str(arg[1])
        _cft_steps.append(step)
        if len(_cft_steps) >= ${MAX_STEPS}: raise _CftStop()
    return _cft_tracer
_cft_err, _cft_trunc = None, False
_cft_real = _cft_sys.stdout
_cft_sys.stdout = _CftOut()
try:
    _cft_code = compile(_cft_src, '<code>', 'exec')
    _cft_sys.settrace(_cft_tracer)
    exec(_cft_code, {"__name__": "__main__"})
except _CftStop:
    _cft_trunc = True
except SyntaxError as e:
    _cft_err = "SyntaxError: " + str(e)
except Exception as e:
    _cft_err = type(e).__name__ + ": " + str(e)
finally:
    _cft_sys.settrace(None)
    _cft_sys.stdout = _cft_real
print("${TAG}" + _cft_json.dumps({"steps": _cft_steps, "stdout": "".join(_cft_buf), "truncated": _cft_trunc, "error": _cft_err}))
`;
  const r = await runCode('python', driver, () => {}, { limitMs: 20_000, importsFrom: code });
  const parsed = parseTagged<{ steps: TraceStep[]; stdout: string; truncated: boolean; error: string | null }>(r.lines);
  if (!parsed) return { steps: [], stdout: '', truncated: false, error: r.error ?? 'Tracing failed.' };
  return { steps: parsed.steps, stdout: parsed.stdout, truncated: parsed.truncated, error: parsed.error ?? undefined };
}

export type Verdict = 'match' | 'close' | 'mismatch' | 'unknown' | 'improved' | 'unchanged' | 'worse';

/** Compare a re-measured (rewritten) function against the previous measurement. */
export function judgeChange(before: ComplexityKey, after: ComplexityKey): { verdict: Verdict; note: string } {
  const order = COMPLEXITIES.map((c) => c.key as ComplexityKey);
  const d = order.indexOf(after) - order.indexOf(before);
  if (d < 0) return { verdict: 'improved', note: `The rewrite grows like ${after}, down from ${before}.` };
  if (d > 0) return { verdict: 'worse', note: `The rewrite grows like ${after} — slower than the original ${before}.` };
  return { verdict: 'unchanged', note: `Same growth as before (${after}). It may be faster by a constant factor, but it doesn’t scale better.` };
}

/**
 * Compare a claimed class with the measurements. Neighbouring classes such as
 * O(n) and O(n log n) differ by a slowly growing factor that a few seconds of
 * browser timing can't always separate, so a claim that fits almost as well as
 * the best class counts as consistent.
 */
export function judgeClaim(fit: NonNullable<ReturnType<typeof fitComplexity>>, claim: ComplexityKey | null): { verdict: Verdict; note: string } {
  if (!claim) return { verdict: 'unknown', note: 'The model didn’t state a complexity we could read.' };
  if (claim === fit.best.key) return { verdict: 'match', note: `Measured growth matches ${claim}.` };
  const claimed = fit.fits.find((f) => f.key === claim);
  if (!claimed) return { verdict: 'unknown', note: `${claim} can’t be tested at these input sizes.` };
  const ratio = claimed.err / Math.max(fit.best.err, 1e-6);
  const order = COMPLEXITIES.map((c) => c.key as ComplexityKey);
  const neighbours = Math.abs(order.indexOf(claim) - order.indexOf(fit.best.key)) === 1;
  if (ratio < 2.5 || (neighbours && ratio < 6)) {
    return { verdict: 'close', note: `Best fit is ${fit.best.key}, but ${claim} fits almost as well — at these sizes the two are hard to tell apart.` };
  }
  return { verdict: 'mismatch', note: `The model claimed ${claim}, but the measurements grow like ${fit.best.key}.` };
}

import { useContext, useMemo, useState } from 'react';
import { Bomb, Check, CircleAlert, Clock, ListChecks, Loader2, TrendingUp, Wrench, X } from 'lucide-react';
import { COMPLEXITIES, type Case, type CaseResult, type ComplexityKey, type TimingPoint, type Verdict } from '../lib/harness';
import { StudioContext } from './studioContext';

// ── Types attached to an assistant turn ────────────────────────────────────

export interface SpecAnalysis { kind: 'spec'; status: 'running' | 'done'; fn?: string; cases: Case[]; results?: CaseResult[]; error?: string; repair?: number }
export type BreakOutcome = 'ok' | 'returned' | 'crash' | 'hang' | 'wrong' | 'no-error' | 'threw';
export interface BreakCase extends Case { why: string; expectError: boolean }
export interface BreakAnalysis { kind: 'break'; status: 'running' | 'done'; fn?: string; target: 'original' | 'fixed'; cases: BreakCase[]; results?: CaseResult[]; error?: string }
export interface BigOAnalysis {
  kind: 'bigo'; status: 'running' | 'done'; fn?: string; target: 'original' | 'fixed';
  claim: ComplexityKey | null; claimText?: string; points?: TimingPoint[];
  /** For a rewrite: the growth class measured for the previous version. */
  before?: ComplexityKey;
  best?: ComplexityKey; slope?: number; constants?: Partial<Record<ComplexityKey, number>>;
  verdict?: Verdict; note?: string; error?: string;
}
export type Analysis = SpecAnalysis | BreakAnalysis | BigOAnalysis;

const shell = 'cf-fade-in mt-4 overflow-hidden rounded-xl border border-white/[.08] bg-[#0f1216]';
const head = 'flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-2.5';
const fixBtn = 'flex items-center gap-1.5 rounded-lg bg-[#267bbb] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#2f8ad0]';

function Running({ label }: { label: string }) {
  return <p className="flex items-center gap-2 px-4 py-4 text-xs text-white/45"><Loader2 size={13} className="animate-spin" /> {label}</p>;
}

// ── By example ─────────────────────────────────────────────────────────────

export function SpecPanel({ a }: { a: SpecAnalysis }) {
  const passed = a.results?.filter((r) => r.ok).length ?? 0;
  const total = a.cases.length;
  const allPass = a.status === 'done' && !a.error && passed === total;
  return (
    <div className={shell}>
      <div className={head}>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#79b8e4]"><ListChecks size={12} /> Checked against your examples</span>
        {a.status === 'done' && !a.error && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${allPass ? 'bg-[#7cc597]/15 text-[#9bd6b0]' : 'bg-[#f08c7c]/15 text-[#f5b3a8]'}`}>
            {allPass ? <Check size={12} /> : <X size={12} />} {allPass ? `Passes all ${total} examples` : `${passed} of ${total} examples pass`}
          </span>
        )}
      </div>
      {a.status === 'running' ? <Running label="Running your examples in your browser…" /> : a.error ? (
        <p className="px-4 py-3 text-xs text-[#f5b3a8]">{a.error}</p>
      ) : (
        <table className="cf-diff w-full border-collapse font-mono text-[11.5px]">
          <tbody>
            {a.cases.map((c, i) => {
              const r = a.results?.[i];
              return (
                <tr key={i} className="border-b border-white/[.04] last:border-0">
                  <td className="w-7 py-2 pl-4 align-top">{r?.ok ? <Check size={13} className="text-[#7cc597]" /> : <X size={13} className="text-[#f08c7c]" />}</td>
                  <td className="py-2 pr-3 align-top text-[#d2dce3]">{a.fn ?? 'solve'}({c.args})</td>
                  <td className="py-2 pr-4 align-top text-white/45">
                    {r?.error ? <span className="text-[#f5b3a8]">{r.error}</span> : r?.ok ? <>→ {r.got}</> : <>→ {r?.got} <span className="text-[#f5b3a8]">(expected {r?.expected ?? c.expected})</span></>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Break it ───────────────────────────────────────────────────────────────

/**
 * Low-level runtime failures. When the right behaviour is "raise an error", these don't
 * count as handling it: a ZeroDivisionError on an empty list is a crash, not validation.
 * (TypeError is left out on purpose — it is also what deliberate type checks raise.)
 */
const ACCIDENTAL = /^(ZeroDivisionError|IndexError|KeyError|AttributeError|UnboundLocalError|NameError|RecursionError|OverflowError|RangeError)\b|Cannot read propert(y|ies) of (undefined|null)|is not a function|Maximum call stack/;
const isAccidental = (error?: string) => !!error && ACCIDENTAL.test(error);

function classifyBreak(c: BreakCase, r?: CaseResult): BreakOutcome {
  if (!r) return 'crash';
  if (r.timedOut) return 'hang';
  if (c.expectError) return !r.error ? 'no-error' : isAccidental(r.error) ? 'crash' : 'ok';
  if (r.error) return c.expected ? 'crash' : 'threw';
  if (r.ok === true) return 'ok';
  if (r.ok === false) return 'wrong';
  return 'returned';
}
const OUTCOME: Record<BreakOutcome, { label: string; bad: boolean; tone: string }> = {
  ok: { label: 'Handled', bad: false, tone: 'text-[#9bd6b0]' },
  returned: { label: 'Returned', bad: false, tone: 'text-white/50' },
  crash: { label: 'Crashed', bad: true, tone: 'text-[#f5b3a8]' },
  hang: { label: 'Hung', bad: true, tone: 'text-[#f5b3a8]' },
  wrong: { label: 'Wrong answer', bad: true, tone: 'text-[#f5b3a8]' },
  'no-error': { label: 'Should have raised', bad: true, tone: 'text-[#f5b3a8]' },
  threw: { label: 'Raised an error', bad: false, tone: 'text-[#e7c47a]' },
};

export function BreakPanel({ a }: { a: BreakAnalysis }) {
  const { ask } = useContext(StudioContext);
  const outcomes = a.cases.map((c, i) => classifyBreak(c, a.results?.[i]));
  const broken = outcomes.filter((o) => OUTCOME[o].bad).length;
  const fixRequest = () => {
    const lines = a.cases.map((c, i) => ({ c, o: outcomes[i], r: a.results?.[i] })).filter((x) => OUTCOME[x.o].bad || x.o === 'threw')
      .map(({ c, o, r }) => `- ${a.fn}(${c.args}) → ${OUTCOME[o].label}${r?.error ? `: ${r.error}` : r?.got ? ` (got ${r.got}${c.expected ? `, expected ${c.expected}` : ''})` : ''}${c.why ? ` — ${c.why}` : ''}`);
    ask?.(`I ran your edge cases against the code. These broke it:\n\n${lines.join('\n')}\n\nFix the code so it handles all of them correctly (raise a clear error where raising is the right behaviour). Return the full corrected code in one block.`);
  };
  return (
    <div className={shell}>
      <div className={head}>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#79b8e4]">
          <Bomb size={12} /> {a.target === 'fixed' ? 'Same inputs, run on the fixed code' : 'Edge cases, run against your code'}
        </span>
        {a.status === 'done' && !a.error && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${broken ? 'bg-[#f08c7c]/15 text-[#f5b3a8]' : 'bg-[#7cc597]/15 text-[#9bd6b0]'}`}>
            {broken ? `${broken} of ${a.cases.length} inputs broke it` : `Survived all ${a.cases.length} inputs`}
          </span>
        )}
      </div>
      {a.status === 'running' ? <Running label={`Running ${a.cases.length} inputs one by one…`} /> : a.error ? (
        <p className="px-4 py-3 text-xs text-[#f5b3a8]">{a.error}</p>
      ) : (
        <>
          <table className="cf-diff w-full border-collapse text-[11.5px]">
            <tbody>
              {a.cases.map((c, i) => {
                const o = outcomes[i];
                const r = a.results?.[i];
                return (
                  <tr key={i} className="border-b border-white/[.04] last:border-0 align-top">
                    <td className="py-2 pl-4 pr-2">
                      <span className={`flex items-center gap-1 whitespace-nowrap font-semibold ${OUTCOME[o].tone}`}>
                        {o === 'hang' ? <Clock size={12} /> : OUTCOME[o].bad ? <X size={12} /> : o === 'threw' ? <CircleAlert size={12} /> : <Check size={12} />} {OUTCOME[o].label}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <code className="break-all font-mono text-[#d2dce3]">{a.fn}({c.args})</code>
                      <p className="mt-0.5 text-[11px] text-white/35">{c.why}</p>
                    </td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-white/45">
                      {r?.error ? <span className={OUTCOME[o].bad ? 'text-[#f5b3a8]' : ''}>{r.error}{o === 'crash' && c.expectError && <span className="block font-sans text-[10.5px] text-white/40">An error is right here, but this is an unhandled crash — raise a clear error instead.</span>}</span> : r?.got !== undefined ? <>→ {r.got}{o === 'wrong' && <span className="text-[#f5b3a8]"> (expected {r.expected})</span>}</> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {broken > 0 && ask && (
            <div className="border-t border-white/[.06] px-4 py-3">
              <button onClick={fixRequest} className={fixBtn}><Wrench size={12} /> Fix these {broken} failures</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Big-O ──────────────────────────────────────────────────────────────────

// Categorical dark steps, validated on #0f1216 (all-pairs CVD ΔE 9.4, normal 20.9, contrast ≥ 3:1).
const C_MEASURED = '#3987e5';
const C_CLAIM = '#d95926';
const C_FIT = '#199e70';

const fmtTime = (s: number) => (s >= 1 ? `${s.toFixed(2)} s` : s >= 1e-3 ? `${(s * 1e3).toPrecision(3)} ms` : `${(s * 1e6).toPrecision(3)} µs`);
const fmtN = (n: number) => (n >= 1e6 ? `${n / 2 ** 20}M` : n >= 1024 ? `${n / 1024}K` : String(n));
const fnOf = (k: ComplexityKey) => COMPLEXITIES.find((c) => c.key === k)!.f;

function TimingChart({ a }: { a: BigOAnalysis }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => (a.points ?? []).filter((p) => p.seconds > 0), [a.points]);
  const W = 560, H = 230, L = 58, R = 92, T = 14, B = 30;
  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const curves: { key: ComplexityKey; role: 'fit' | 'claim'; c: number }[] = [];
    if (a.best && a.constants?.[a.best]) curves.push({ key: a.best, role: 'fit', c: a.constants[a.best]! });
    if (a.claim && a.claim !== a.best && a.constants?.[a.claim]) curves.push({ key: a.claim, role: 'claim', c: a.constants[a.claim]! });
    const xs = pts.map((p) => Math.log2(p.n));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const samples = (k: ComplexityKey, c: number) => Array.from({ length: 41 }, (_, i) => {
      const lx = x0 + ((x1 - x0) * i) / 40; const n = 2 ** lx;
      return { lx, ly: Math.log10(Math.max(c * fnOf(k)(n), 1e-9)) };
    });
    const curveSamples = curves.map((cv) => ({ ...cv, s: samples(cv.key, cv.c) }));
    const ys = [...pts.map((p) => Math.log10(p.seconds)), ...curveSamples.flatMap((c) => c.s.map((q) => q.ly))];
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    const sx = (lx: number) => L + ((lx - x0) / Math.max(x1 - x0, 1e-9)) * (W - L - R);
    const sy = (ly: number) => T + (1 - (ly - y0) / Math.max(y1 - y0, 1e-9)) * (H - T - B);
    return { x0, x1, y0, y1, sx, sy, curveSamples };
  }, [pts, a.best, a.claim, a.constants]);
  if (!geo) return <p className="px-4 py-3 text-xs text-white/40">Not enough timing data to draw a curve.</p>;
  const { sx, sy, curveSamples } = geo;
  const path = (s: { lx: number; ly: number }[]) => s.map((q, i) => `${i ? 'L' : 'M'}${sx(q.lx).toFixed(1)},${sy(q.ly).toFixed(1)}`).join(' ');
  const xTicks = pts.filter((_, i) => i % Math.ceil(pts.length / 7) === 0);
  const yTicks = Array.from({ length: geo.y1 - geo.y0 + 1 }, (_, i) => geo.y0 + i);
  const legend = [
    { label: 'Measured', color: C_MEASURED, dash: undefined },
    ...curveSamples.map((c) => ({ label: `${c.role === 'fit' ? 'Best fit' : 'Claimed'} ${c.key}`, color: c.role === 'fit' ? C_FIT : C_CLAIM, dash: c.role === 'fit' ? '7 4' : '2 4' })),
  ];
  const hp = hover !== null ? pts[hover] : null;

  return (
    <div className="px-3 pb-2 pt-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pb-1 text-[11px] text-white/60">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true"><line x1="1" y1="4" x2="17" y2="4" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={l.dash} /></svg>
            {l.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Run time against input size, log-log scale">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="#1f262e" strokeWidth="1" />
              <text x={L - 8} y={sy(t) + 3.5} textAnchor="end" className="fill-white/40" fontSize="10">{fmtTime(10 ** t)}</text>
            </g>
          ))}
          {xTicks.map((p) => (
            <text key={p.n} x={sx(Math.log2(p.n))} y={H - 10} textAnchor="middle" className="fill-white/40" fontSize="10">{fmtN(p.n)}</text>
          ))}
          <text x={W - R} y={H - 10} textAnchor="start" dx="6" className="fill-white/30" fontSize="10">n</text>
          {curveSamples.map((c) => (
            <path key={c.role} d={path(c.s)} fill="none" stroke={c.role === 'fit' ? C_FIT : C_CLAIM} strokeWidth="2" strokeLinecap="round" strokeDasharray={c.role === 'fit' ? '7 4' : '2 4'} />
          ))}
          <path d={path(pts.map((p) => ({ lx: Math.log2(p.n), ly: Math.log10(p.seconds) })))} fill="none" stroke={C_MEASURED} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hp && <line x1={sx(Math.log2(hp.n))} x2={sx(Math.log2(hp.n))} y1={T} y2={H - B} stroke="#3a4552" strokeWidth="1" />}
          {pts.map((p, i) => (
            <circle key={p.n} cx={sx(Math.log2(p.n))} cy={sy(Math.log10(p.seconds))} r={hover === i ? 5 : 4} fill={C_MEASURED} stroke="#0f1216" strokeWidth="2" />
          ))}
          {/* Direct labels at the line ends (text in ink, identity from the key beside it). */}
          {[
            { label: 'Measured', y: sy(Math.log10(pts[pts.length - 1].seconds)), color: C_MEASURED },
            ...curveSamples.map((c) => ({ label: c.role === 'fit' ? `fit ${c.key}` : `claim ${c.key}`, y: sy(c.s[c.s.length - 1].ly), color: c.role === 'fit' ? C_FIT : C_CLAIM })),
          ].sort((p, q) => p.y - q.y).map((l, i, arr) => {
            const y = i && l.y - arr[i - 1].y < 12 ? arr[i - 1].y + 12 : l.y; // nudge apart
            arr[i] = { ...l, y };
            return (
              <g key={l.label}>
                <circle cx={W - R + 8} cy={y} r="3" fill={l.color} />
                <text x={W - R + 15} y={y + 3.5} className="fill-white/70" fontSize="10">{l.label}</text>
              </g>
            );
          })}
          {/* Hit targets wider than the marks */}
          {pts.map((p, i) => {
            const x = sx(Math.log2(p.n));
            const prev = i ? sx(Math.log2(pts[i - 1].n)) : L;
            const next = i < pts.length - 1 ? sx(Math.log2(pts[i + 1].n)) : W - R;
            return <rect key={p.n} x={(x + prev) / 2} y={T} width={Math.max(4, (next - prev) / 2)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
          })}
        </svg>
        {hp && (
          <div className="pointer-events-none absolute top-1 rounded-lg border border-white/10 bg-[#171b20] px-2.5 py-1.5 text-[11px] shadow-lg" style={{ left: `${(sx(Math.log2(hp.n)) / W) * 100}%`, transform: 'translateX(-50%)' }}>
            <p className="text-white/45">n = {hp.n.toLocaleString()}</p>
            <p className="flex items-center gap-1.5 text-[#e6edf2]"><span className="h-2 w-2 rounded-full" style={{ background: C_MEASURED }} /> {fmtTime(hp.seconds)} per call</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function BigOPanel({ a }: { a: BigOAnalysis }) {
  const [table, setTable] = useState(false);
  const good = a.verdict === 'match' || a.verdict === 'improved';
  const bad = a.verdict === 'mismatch' || a.verdict === 'worse';
  const tone = good ? 'bg-[#7cc597]/15 text-[#9bd6b0]' : bad ? 'bg-[#f08c7c]/15 text-[#f5b3a8]' : a.verdict === 'close' ? 'bg-[#79b8e4]/15 text-[#a9d2ef]' : 'bg-white/10 text-white/60';
  const verdictLabel = {
    match: 'Matches the measurements', close: 'Consistent with the measurements', mismatch: 'Doesn’t match the measurements', unknown: 'Inconclusive',
    improved: `Faster: ${a.before} → ${a.best}`, unchanged: 'Same complexity as before', worse: `Slower: ${a.before} → ${a.best}`,
  }[a.verdict ?? 'unknown'];
  return (
    <div className={shell}>
      <div className={head}>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#79b8e4]">
          <TrendingUp size={12} /> {a.target === 'fixed' ? 'Timed the new code' : 'Timed your code'}{a.fn ? ` · ${a.fn}()` : ''}
        </span>
        {a.status === 'done' && !a.error && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
            {good ? <Check size={12} /> : bad ? <X size={12} /> : <CircleAlert size={12} />} {verdictLabel}
          </span>
        )}
      </div>
      {a.status === 'running' ? <Running label="Timing the function at growing input sizes (up to ~6s)…" /> : a.error ? (
        <p className="px-4 py-3 text-xs text-[#f5b3a8]">{a.error}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px border-b border-white/[.06] bg-white/[.06] text-center">
            {[[a.before ? 'Before' : 'Claimed', a.before ?? a.claim ?? '—'], [a.before ? 'Now' : 'Measured', a.best ?? '—'], ['Log-log slope', a.slope !== undefined ? a.slope.toFixed(2) : '—']].map(([k, v]) => (
              <div key={k} className="bg-[#0f1216] px-2 py-2.5">
                <p className="text-[10px] uppercase tracking-[.14em] text-white/35">{k}</p>
                <p className="mt-0.5 font-mono text-[15px] text-[#e6edf2]">{v}</p>
              </div>
            ))}
          </div>
          {a.note && <p className="px-4 pt-3 text-xs text-white/55">{a.note}</p>}
          {table ? (
            <table className="cf-diff mx-4 my-3 w-[calc(100%-2rem)] border-collapse font-mono text-[11.5px] text-white/60">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-white/35"><th className="py-1">n</th><th className="py-1">time per call</th></tr></thead>
              <tbody>{(a.points ?? []).map((p) => <tr key={p.n} className="border-t border-white/[.04]"><td className="py-1">{p.n.toLocaleString()}</td><td className="py-1">{fmtTime(p.seconds)}</td></tr>)}</tbody>
            </table>
          ) : (
            <TimingChart a={a} />
          )}
          <div className="flex items-center justify-between px-4 pb-3 text-[10px] text-white/35">
            <span>Log-log axes: a straight line with slope k means O(n^k). Timings run in your browser and include some noise.</span>
            <button onClick={() => setTable(!table)} className="shrink-0 pl-3 text-[#79b8e4] hover:underline">{table ? 'Show chart' : 'Show data'}</button>
          </div>
        </>
      )}
    </div>
  );
}

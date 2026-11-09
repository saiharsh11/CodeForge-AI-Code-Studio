import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Footprints, MessageCircleQuestion, Pause, Play } from 'lucide-react';
import type { Trace } from '../lib/harness';
import { explainRunError } from '../lib/runner';
import { StudioContext } from './studioContext';

const SPEEDS = [{ label: '1×', ms: 700 }, { label: '2×', ms: 350 }, { label: '4×', ms: 150 }];

/** A small visual debugger: scrub through every executed line and watch variables change. */
export function TracePanel({ code, trace }: { code: string; trace: Trace }) {
  const { ask } = useContext(StudioContext);
  // Skip the synthetic module "call" event; it has no line to show.
  const steps = useMemo(() => trace.steps.filter((s) => !(s.event === 'call' && s.func === '<module>')), [trace.steps]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lines = useMemo(() => code.replace(/\s+$/, '').split('\n'), [code]);
  const codeRef = useRef<HTMLDivElement>(null);

  const step = steps[Math.min(i, steps.length - 1)];
  const prevSame = useMemo(() => {
    for (let j = i - 1; j >= 0; j--) if (steps[j].func === step?.func && steps[j].depth === step?.depth) return steps[j];
    return undefined;
  }, [i, steps, step]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setI((x) => {
      if (x >= steps.length - 1) { setPlaying(false); return x; }
      return x + 1;
    }), SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [playing, speed, steps.length]);

  // Keep the current line in view.
  useEffect(() => {
    codeRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [i]);

  const friendly = explainRunError(trace.error);
  // Stopped before running any real code (e.g. an import that can't work in the browser):
  // explain that instead of showing a debugger stuck on line 1.
  const stoppedAtStart = !!friendly && steps.filter((s) => s.event === 'line').length <= 3;
  if (!steps.length || stoppedAtStart) {
    return (
      <div className="mt-2 rounded-xl border border-[#f08c7c]/25 bg-[#f08c7c]/[.07] px-4 py-3 text-xs leading-5 text-[#f5b3a8]">
        <p className="font-semibold">{friendly ? 'This program can’t run in the browser' : 'Nothing ran'}</p>
        <p className="mt-1 text-[#f5b3a8]/85">{friendly ?? trace.error ?? 'Is there any top-level code that calls your functions?'}</p>
        {trace.error && friendly && <p className="mt-2 font-mono text-[11px] text-white/35">{trace.error}</p>}
      </div>
    );
  }

  const output = trace.stdout.slice(0, step.stdout);
  const vars = Object.entries(step.locals);
  const explain = () => ask?.(
    `Explain step ${i + 1} of the trace: line ${step.line} \`${(lines[step.line - 1] ?? '').trim()}\` in ${step.func === '<module>' ? 'the top-level code' : `\`${step.func}()\``} (${step.event}).\nVariables right now: ${vars.length ? vars.map(([k, v]) => `${k} = ${v}`).join(', ') : 'none'}.${step.value ? `\nValue: ${step.value}` : ''}\nWhat is happening here, and why do the variables have these values?`
  );

  return (
    <div className="cf-fade-in mt-1 overflow-hidden rounded-xl border border-[#267bbb]/25 bg-[#0f1216]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-4 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#79b8e4]"><Footprints size={12} /> Step through · no AI used</span>
        <span className="text-[11px] text-white/45">Step <b className="font-semibold text-white/80">{i + 1}</b> of {steps.length}{trace.truncated ? ' (first steps only)' : ''}</span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* Code with the current line highlighted */}
        <div ref={codeRef} className="max-h-[320px] overflow-auto border-b border-white/[.06] py-2 font-mono text-[12px] leading-[1.75] lg:border-b-0 lg:border-r">
          {lines.map((text, n) => {
            const current = n + 1 === step.line;
            const before = prevSame && n + 1 === prevSame.line && !current;
            return (
              <div key={n} data-current={current} className={`flex pr-4 ${current ? 'bg-[#267bbb]/25' : before ? 'bg-white/[.03]' : ''}`}>
                <span className={`w-10 shrink-0 select-none pr-3 text-right ${current ? 'text-[#79b8e4]' : 'text-white/20'}`}>{current ? '▶' : n + 1}</span>
                <span className={`whitespace-pre ${current ? 'text-white' : 'text-[#c9d4dc]/70'}`}>{text || ' '}</span>
              </div>
            );
          })}
        </div>

        {/* Frame, variables, output */}
        <div className="min-w-0 space-y-3 p-4 text-[12px]">
          <div>
            <p className="text-[10px] uppercase tracking-[.16em] text-white/35">
              {step.func === '<module>' ? 'Top level' : `In ${step.func}()`} · depth {step.depth}
            </p>
            {step.event !== 'line' && (
              <p className={`mt-1 text-[11px] ${step.event === 'exception' ? 'text-[#f5b3a8]' : 'text-[#e7c47a]'}`}>
                {step.event === 'call' ? 'Entering the function' : step.event === 'return' ? `Returning ${step.value}` : `Raised ${step.value}`}
              </p>
            )}
          </div>
          <table className="cf-diff w-full border-collapse font-mono text-[11.5px]">
            <tbody>
              {vars.length ? vars.map(([k, v]) => {
                const changed = prevSame ? prevSame.locals[k] !== v : true;
                return (
                  <tr key={k} className="border-b border-white/[.04] last:border-0">
                    <td className="py-1 pr-3 align-top text-[#72b5e4]">{k}</td>
                    <td className={`break-all py-1 align-top transition-colors ${changed ? 'text-[#e7c47a]' : 'text-[#c9d4dc]/80'}`}>{v}{changed && prevSame && <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wider text-[#e7c47a]/70">changed</span>}</td>
                  </tr>
                );
              }) : <tr><td className="py-1 text-white/30">No variables yet</td></tr>}
            </tbody>
          </table>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[.16em] text-white/35">Output so far</p>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 px-2.5 py-1.5 font-mono text-[11.5px] text-[#d2dce3]">{output || <span className="text-white/25">nothing printed yet</span>}</pre>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[.06] px-3 py-2">
        <div className="flex items-center gap-0.5 text-white/60">
          {[
            { icon: ChevronFirst, label: 'First step', on: () => { setPlaying(false); setI(0); } },
            { icon: ChevronLeft, label: 'Previous step', on: () => { setPlaying(false); setI((x) => Math.max(0, x - 1)); } },
          ].map((b) => <button key={b.label} aria-label={b.label} onClick={b.on} className="rounded-md p-1.5 transition hover:bg-white/10 hover:text-white"><b.icon size={15} /></button>)}
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => { if (i >= steps.length - 1) setI(0); setPlaying(!playing); }} className="rounded-md bg-[#267bbb] p-1.5 text-white transition hover:bg-[#2f8ad0]">
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          {[
            { icon: ChevronRight, label: 'Next step', on: () => { setPlaying(false); setI((x) => Math.min(steps.length - 1, x + 1)); } },
            { icon: ChevronLast, label: 'Last step', on: () => { setPlaying(false); setI(steps.length - 1); } },
          ].map((b) => <button key={b.label} aria-label={b.label} onClick={b.on} className="rounded-md p-1.5 transition hover:bg-white/10 hover:text-white"><b.icon size={15} /></button>)}
        </div>
        <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }} aria-label="Step" className="min-w-[120px] flex-1 accent-[#267bbb]" />
        <button onClick={() => setSpeed((speed + 1) % SPEEDS.length)} className="rounded-md px-2 py-1 font-mono text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white" title="Playback speed">{SPEEDS[speed].label}</button>
        {ask && (
          <button onClick={explain} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[#79b8e4] transition hover:bg-white/10" title="Uses 1 free request">
            <MessageCircleQuestion size={13} /> Explain this step
          </button>
        )}
      </div>
      {trace.error && (
        <div className="border-t border-white/[.06] px-4 py-2 text-[11px]">
          <p className="font-mono text-[#f5b3a8]">Program stopped with {trace.error}</p>
          {friendly && <p className="mt-1 leading-5 text-white/45">{friendly}</p>}
        </div>
      )}
    </div>
  );
}

import { useContext, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Regex } from 'lucide-react';
import { StudioContext } from './studioContext';

// Live regex tester. Matching runs in a Web Worker with a time limit, because a
// pattern with catastrophic backtracking can otherwise hang the tab for minutes.

interface Match { index: number; length: number; groups: string[] }
type Result = { status: 'ok'; matches: Match[]; capped: boolean } | { status: 'error'; message: string } | { status: 'idle' };

const WORKER = `
onmessage = ({ data: { pattern, flags, text } }) => {
  try {
    const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    const matches = [];
    for (const m of text.matchAll(re)) {
      matches.push({ index: m.index, length: m[0].length, groups: m.slice(1).map((g) => g ?? '') });
      if (matches.length >= 500) break;
      if (m[0].length === 0 && matches.length > 2000) break;
    }
    postMessage({ status: 'ok', matches, capped: matches.length >= 500 });
  } catch (e) {
    postMessage({ status: 'error', message: e.message });
  }
};`;
const workerUrl = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));

/** "/abc/gi" -> { pattern: "abc", flags: "gi" } */
function parseRegexLiteral(src: string) {
  const line = src.trim().split('\n')[0].trim();
  const m = /^\/(.+)\/([dgimsuvy]*)$/.exec(line);
  return m ? { pattern: m[1], flags: m[2] } : { pattern: line, flags: 'g' };
}

export function RegexTester({ source }: { source: string }) {
  const { sample } = useContext(StudioContext);
  const initial = useMemo(() => parseRegexLiteral(source), [source]);
  const [pattern, setPattern] = useState(initial.pattern);
  const [flags, setFlags] = useState(initial.flags);
  const [text, setText] = useState(sample || '');
  const [result, setResult] = useState<Result>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let limit = 0;
    let w: Worker | null = null;
    const id = setTimeout(() => {
      if (!pattern || !text) { setResult({ status: 'idle' }); return; }
      w = new Worker(workerUrl);
      const job = w;
      limit = window.setTimeout(() => {
        job.terminate();
        setResult({ status: 'error', message: 'Matching took over 500 ms and was stopped — this pattern likely has catastrophic backtracking.' });
      }, 500);
      job.onmessage = (e) => { clearTimeout(limit); job.terminate(); setResult(e.data); };
      job.postMessage({ pattern, flags, text: text.slice(0, 50_000) });
    }, 150);
    // A newer keystroke cancels the pending run *and* its timeout.
    return () => { clearTimeout(id); clearTimeout(limit); w?.terminate(); };
  }, [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (result.status !== 'ok' || !result.matches.length) return null;
    const out: React.ReactNode[] = [];
    let at = 0;
    result.matches.forEach((m, i) => {
      if (m.index < at) return;
      out.push(text.slice(at, m.index));
      out.push(<mark key={i} className="rounded-[3px] bg-[#267bbb]/45 px-px text-white">{text.slice(m.index, m.index + m.length) || '∅'}</mark>);
      at = m.index + m.length;
    });
    out.push(text.slice(at));
    return out;
  }, [result, text]);

  const literal = `/${pattern}/${flags}`;
  const copy = async () => {
    await navigator.clipboard.writeText(literal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#267bbb]/25 bg-[#0f1216]">
      <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-2 text-[10px] uppercase tracking-[.16em] text-white/35">
        <span className="flex items-center gap-1.5 text-[#79b8e4]"><Regex size={12} /> Live regex tester</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-md px-2 py-1 normal-case tracking-normal transition hover:bg-white/5 hover:text-white">
          {copied ? <Check size={12} className="text-[#7cc597]" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[13px] focus-within:border-[#267bbb]/60">
          <span className="text-white/30">/</span>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} aria-label="Pattern" className="min-w-0 flex-1 bg-transparent text-[#e7c47a] outline-none" />
          <span className="text-white/30">/</span>
          <input value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^dgimsuvy]/g, ''))} spellCheck={false} aria-label="Flags" className="w-12 bg-transparent text-[#72b5e4] outline-none" />
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste test text here…"
            spellCheck={false}
            rows={5}
            className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-6 text-[#c9d4dc] outline-none placeholder:text-white/25 focus:border-[#267bbb]/60"
          />
          <div className="min-h-[7.5rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/[.06] bg-black/20 p-3 font-mono text-[12px] leading-6 text-white/45">
            {highlighted ?? (text || <span className="text-white/25">Matches are highlighted here.</span>)}
          </div>
        </div>
        <p className={`text-[11px] ${result.status === 'error' ? 'text-[#f5b3a8]' : 'text-white/40'}`}>
          {result.status === 'error'
            ? result.message
            : result.status === 'ok'
              ? `${result.matches.length}${result.capped ? '+' : ''} match${result.matches.length === 1 ? '' : 'es'}${result.matches.some((m) => m.groups.length) ? ` · groups: ${result.matches[0].groups.map((g) => JSON.stringify(g)).join(', ')}` : ''}`
              : 'Add some test text to see matches.'}
        </p>
      </div>
    </div>
  );
}

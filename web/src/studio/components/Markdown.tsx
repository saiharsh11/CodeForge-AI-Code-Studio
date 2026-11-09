import { memo, useContext, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Download, GitCompare, Loader2, Play, Square, Wrench, X } from 'lucide-react';
import { extFor } from '../lib/modes';
import { explainRunError, runCode, runnableLang, type RunLine, type RunResult } from '../lib/runner';
import { MermaidBlock } from './MermaidBlock';
import { RegexTester } from './RegexTester';
import { DiffView } from './DiffView';
import { StudioContext } from './studioContext';

const btn = 'flex items-center gap-1.5 rounded-md px-2 py-1 normal-case tracking-normal transition hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

/** Only offer a diff when the block looks like a full rewrite of the user's code, not a 2-line snippet. */
const diffable = (original: string, code: string) =>
  original.trim().length > 0 && code.split('\n').length >= 4 && code.length >= original.length * 0.4;

function CodeBlock({ lang, raw, streaming, children }: { lang: string; raw: string; streaming: boolean; children: ReactNode }) {
  const { askFix, original } = useContext(StudioContext);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'code' | 'diff'>('code');
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<RunLine[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const runLang = runnableLang(lang);
  const canDiff = !streaming && diffable(original, raw);

  const copy = async () => {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `codeforge.${extFor(lang || 'txt')}` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const run = async () => {
    if (!runLang || running) return;
    setRunning(true);
    setResult(null);
    setLive([]);
    const r = await runCode(runLang, raw, (l) => setLive((ls) => [...ls, l]));
    setResult(r);
    setRunning(false);
  };

  const lines = result ? result.lines : live;
  const failed = !!result?.error;

  return (
    <div className="group my-4 overflow-hidden rounded-xl border border-white/[.07] bg-[#0f1216]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[.06] px-3 py-1.5 text-[10px] uppercase tracking-[.16em] text-white/35">
        <div className="flex items-center gap-1">
          <span className="px-1">{lang || 'code'}</span>
          {canDiff && (
            <div className="ml-1 flex rounded-md bg-white/[.04] p-0.5 normal-case tracking-normal">
              {(['code', 'diff'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${view === v ? 'bg-white/10 text-white' : 'hover:text-white'}`}>
                  {v === 'diff' && <GitCompare size={11} />} {v === 'code' ? 'Code' : 'Diff'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          {runLang && (
            <button onClick={run} disabled={streaming || running} className={`${btn} text-[#7cc597]`} title="Run in your browser">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} {running ? 'Running' : 'Run'}
            </button>
          )}
          <button onClick={copy} className={btn}>
            {copied ? <Check size={12} className="text-[#7cc597]" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={download} className={btn}>
            <Download size={12} /> <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {view === 'diff' && canDiff ? <DiffView before={original} after={raw} /> : <pre className="overflow-x-auto px-4 py-3.5">{children}</pre>}

      {(running || result) && (
        <div className="cf-fade-in border-t border-white/[.06] bg-black/30">
          <div className="flex items-center justify-between px-4 pt-2 text-[10px] uppercase tracking-[.16em] text-white/35">
            <span className={`flex items-center gap-1.5 ${failed ? 'text-[#f08c7c]' : result ? 'text-[#7cc597]' : ''}`}>
              {failed ? <X size={11} /> : result ? <Check size={11} /> : <Square size={9} className="animate-pulse" />}
              {failed ? (result?.timedOut ? 'Timed out' : 'Error') : result ? `Ran in ${(result.ms / 1000).toFixed(2)}s` : 'Running in your browser…'}
            </span>
            {result && <button onClick={() => setResult(null)} className="normal-case tracking-normal hover:text-white">Close</button>}
          </div>
          <pre className="max-h-64 overflow-auto px-4 py-2 font-mono text-[12px] leading-[1.65]">
            {lines.map((l, i) => (
              <div key={i} className={l.kind === 'err' ? 'text-[#f5b3a8]' : l.kind === 'info' ? 'text-white/35 italic' : 'text-[#d2dce3]'}>{l.text}</div>
            ))}
            {result?.error && <div className="whitespace-pre-wrap text-[#f5b3a8]">{result.error}</div>}
            {explainRunError(result?.error) && <div className="mt-1.5 whitespace-normal font-sans text-[11.5px] leading-5 text-white/50">{explainRunError(result?.error)}</div>}
            {result && !result.error && !result.lines.some((l) => l.kind !== 'info') && (
              <div className="text-white/35 italic">Ran without output. (Defines functions but never calls them? Ask for a usage example.)</div>
            )}
          </pre>
          {failed && askFix && runLang && !explainRunError(result?.error) && (
            <div className="px-4 pb-3">
              <button
                onClick={() => askFix('run', `${result!.error}\n\nCode:\n${raw}`, lang)}
                className="flex items-center gap-1.5 rounded-lg bg-[#267bbb] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#2f8ad0]"
              >
                <Wrench size={12} /> Fix this error
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type HastNode = { type: string; value?: string; children?: HastNode[]; properties?: { className?: unknown } };
const textOf = (n: HastNode): string => n.value ?? (n.children ?? []).map(textOf).join('');

function makeComponents(streaming: boolean): Components {
  return {
    pre({ node, children }) {
      const code = node?.children[0] as HastNode | undefined;
      const cls = code?.properties?.className as string[] | undefined;
      const lang = cls?.find((c) => c.startsWith('language-'))?.slice(9) ?? '';
      const raw = code ? textOf(code).replace(/\n$/, '') : '';
      if (lang === 'mermaid') return <MermaidBlock source={raw.trim()} streaming={streaming} />;
      if (lang === 'regex' && !streaming) return <RegexTester source={raw} />;
      return <CodeBlock lang={lang} raw={raw} streaming={streaming}>{children}</CodeBlock>;
    },
    a({ children, href }) {
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  };
}

// Mermaid and regex have no highlight.js grammar; leave them as plain text.
const highlight: [typeof rehypeHighlight, { detect: false; plainText: string[] }] = [rehypeHighlight, { detect: false, plainText: ['mermaid', 'regex'] }];

export const Markdown = memo(function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const components = useMemo(() => makeComponents(streaming), [streaming]);
  return (
    <div className="cf-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[highlight]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

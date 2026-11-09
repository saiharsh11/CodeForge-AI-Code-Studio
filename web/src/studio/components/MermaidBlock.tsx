import { useContext, useEffect, useId, useState } from 'react';
import { Check, Code2, Copy, Download, Workflow, Wrench } from 'lucide-react';

import { StudioContext } from './studioContext';
type MermaidApi = typeof import('mermaid')['default'];
let mermaidPromise: Promise<MermaidApi> | null = null;

// Loaded on first use only: Mermaid is large and most answers have no diagram.
function loadMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict', // model output is untrusted: no HTML labels, no click handlers
      theme: 'base',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        darkMode: true,
        background: '#0f1216',
        primaryColor: '#1d2833',
        primaryTextColor: '#e6edf2',
        primaryBorderColor: '#267bbb',
        secondaryColor: '#232a22',
        secondaryBorderColor: '#7cc597',
        tertiaryColor: '#2a2420',
        tertiaryBorderColor: '#e7c47a',
        lineColor: '#79b8e4',
        textColor: '#d2dce3',
        mainBkg: '#1d2833',
        nodeBorder: '#267bbb',
        clusterBkg: '#141a20',
        clusterBorder: '#2c3a47',
        edgeLabelBackground: '#171b20',
        actorBkg: '#1d2833',
        actorBorder: '#267bbb',
        actorTextColor: '#e6edf2',
        signalColor: '#79b8e4',
        signalTextColor: '#d2dce3',
        noteBkgColor: '#2a2420',
        noteTextColor: '#e7c47a',
        noteBorderColor: '#e7c47a',
        labelBoxBkgColor: '#1d2833',
        labelBoxBorderColor: '#267bbb',
        fontSize: '13px',
      },
      flowchart: { curve: 'basis', padding: 14 },
    });
    return mermaid;
  });
  return mermaidPromise;
}

type State = { status: 'loading' } | { status: 'ok'; svg: string } | { status: 'error'; message: string };

export function MermaidBlock({ source, streaming }: { source: string; streaming: boolean }) {
  const id = `cf-mmd-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [view, setView] = useState<'diagram' | 'source'>('diagram');
  const [copied, setCopied] = useState(false);
  const { askFix } = useContext(StudioContext);

  useEffect(() => {
    if (streaming) return; // half-written diagrams never parse; wait for the full block
    let alive = true;
    loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(({ svg }) => alive && setState({ status: 'ok', svg }))
      .catch((err: unknown) => {
        document.getElementById(id)?.remove(); // mermaid leaves an error node behind
        const message = (err instanceof Error ? err.message : String(err)).split('\n').slice(0, 4).join('\n');
        if (alive) setState({ status: 'error', message });
      });
    return () => { alive = false; };
  }, [id, source, streaming]);

  const copy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const download = () => {
    if (state.status !== 'ok') return;
    const url = URL.createObjectURL(new Blob([state.svg], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'codeforge-diagram.svg' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn = 'flex items-center gap-1.5 rounded-md px-2 py-1 normal-case tracking-normal transition hover:bg-white/5 hover:text-white';

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#267bbb]/25 bg-[#0f1216]">
      <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-2 text-[10px] uppercase tracking-[.16em] text-white/35">
        <span className="flex items-center gap-1.5 text-[#79b8e4]"><Workflow size={12} /> Diagram</span>
        <div className="flex gap-1">
          <button onClick={() => setView(view === 'diagram' ? 'source' : 'diagram')} className={btn}>
            {view === 'diagram' ? <Code2 size={12} /> : <Workflow size={12} />} {view === 'diagram' ? 'Source' : 'Diagram'}
          </button>
          <button onClick={copy} className={btn}>
            {copied ? <Check size={12} className="text-[#7cc597]" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={download} disabled={state.status !== 'ok'} className={`${btn} disabled:opacity-30`}>
            <Download size={12} /> SVG
          </button>
        </div>
      </div>

      {view === 'source' || streaming ? (
        <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.75] text-[#c9d4dc]">
          {source}
          {streaming && <span className="cf-caret" />}
        </pre>
      ) : state.status === 'loading' ? (
        <div className="flex h-40 items-center justify-center text-xs text-white/35"><span className="animate-pulse">Drawing diagram…</span></div>
      ) : state.status === 'error' ? (
        <div className="p-4">
          <p className="text-xs font-semibold text-[#f5b3a8]">This diagram has a syntax error and couldn’t be drawn.</p>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-white/[.04] p-3 font-mono text-[11px] text-white/45">{state.message}</pre>
          {askFix && (
            <button onClick={() => askFix('diagram', state.message)} className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#267bbb] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#2f8ad0]">
              <Wrench size={12} /> Fix diagram
            </button>
          )}
        </div>
      ) : (
        <div
          className="cf-fade-in flex justify-center overflow-x-auto p-5 [&_svg]:h-auto [&_svg]:max-w-full"
          // Mermaid output, sanitised by mermaid itself under securityLevel 'strict'.
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      )}
    </div>
  );
}

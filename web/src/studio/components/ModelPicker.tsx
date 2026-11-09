import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, RotateCw, Search } from 'lucide-react';
import { modelKey, shortName, type ModelInfo, type ModelRef } from '../lib/api';

const PROVIDER_LABEL: Record<ModelInfo['provider'], string> = { openrouter: 'OpenRouter', groq: 'Groq' };

const ctx = (n: number | null) =>
  !n ? '' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`;

interface Props {
  models: ModelInfo[];
  selected: ModelInfo | null;
  status: 'loading' | 'ready' | 'error';
  onSelect: (ref: ModelRef) => void;
  onRetry: () => void;
}

export function ModelPicker({ models, selected, status, onSelect, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = models.filter((m) => !q || m.name.toLowerCase().includes(q) || m.model.toLowerCase().includes(q));
    return (Object.keys(PROVIDER_LABEL) as ModelInfo['provider'][])
      .map((p) => ({ provider: p, items: hits.filter((m) => m.provider === p) }))
      .filter((g) => g.items.length);
  }, [models, query]);

  if (status === 'error') {
    return (
      <button onClick={onRetry} className="flex items-center gap-2 rounded-md border border-[#be634f]/30 bg-[#fff1ed] px-3 py-1.5 text-[11px] font-medium text-[#be634f]">
        API unreachable <RotateCw size={12} />
      </button>
    );
  }

  return (
    <div ref={root} className="relative">
      <button
        disabled={status === 'loading'}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[260px] items-center gap-2 rounded-md border border-[#267bbb]/30 bg-[#edf6fd] px-3 py-1.5 text-[11px] font-medium text-[#236aa3] transition hover:border-[#267bbb]/60 disabled:opacity-60"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#56aa75]" />
        <span className="truncate">
          {status === 'loading' ? 'Loading models…' : selected ? `${PROVIDER_LABEL[selected.provider]} · ${shortName(selected)}` : 'Choose a model'}
        </span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="cf-fade-in absolute right-0 z-30 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_rgba(20,45,70,.18)]">
          <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
            <Search size={14} className="text-black/35" />
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search free models…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-black/30"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {!groups.length && <p className="px-3 py-6 text-center text-xs text-black/40">No models match “{query}”.</p>}
            {groups.map((g) => (
              <div key={g.provider} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-black/35">
                  {PROVIDER_LABEL[g.provider]} · {g.items.length} free
                </p>
                {g.items.map((m) => {
                  const active = selected && modelKey(selected) === modelKey(m);
                  return (
                    <button
                      key={modelKey(m)}
                      onClick={() => {
                        onSelect({ provider: m.provider, model: m.model });
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${active ? 'bg-[#edf6fd]' : 'hover:bg-[#f4f4f1]'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-medium ${active ? 'text-[#236aa3]' : 'text-[#151719]'}`}>{shortName(m)}</span>
                        <span className="block truncate font-mono text-[10px] text-black/35">{m.model}</span>
                      </span>
                      {m.context && <span className="shrink-0 text-[10px] text-black/35">{ctx(m.context)}</span>}
                      {active && <Check size={14} className="shrink-0 text-[#267bbb]" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

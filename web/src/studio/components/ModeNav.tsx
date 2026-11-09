import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GROUPS, groupOf, modeById, type ModeGroup, type ModeId } from '../lib/modes';

interface Props {
  active: ModeId;
  live: (id: ModeId) => boolean;
  onSelect: (id: ModeId) => void;
}

/** Four group pills; each opens a menu of its modes. The active group shows the active mode. */
export function ModeNav({ active, live, onSelect }: Props) {
  const [open, setOpen] = useState<ModeGroup | null>(null);
  const root = useRef<HTMLElement>(null);
  const activeGroup = groupOf(active).id;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav ref={root} aria-label="Modes" className="relative order-last flex w-full gap-0.5 rounded-full bg-[#0b2f55]/45 p-1 text-xs font-semibold ring-1 ring-white/10 backdrop-blur-md lg:order-none lg:mx-auto lg:w-auto">
      {GROUPS.map((g) => {
        const isActive = g.id === activeGroup;
        const current = isActive ? modeById(active) : null;
        const Icon = current?.icon;
        const anyLive = g.modes.some(live);
        return (
          <div key={g.id} className="min-w-0 flex-auto lg:relative lg:flex-none">
            <button
              onClick={() => setOpen(open === g.id ? null : g.id)}
              aria-expanded={open === g.id}
              aria-haspopup="menu"
              className={`flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 transition sm:px-3 ${isActive ? 'bg-white text-[#236aa3] shadow-[0_4px_14px_rgba(7,38,70,.25)]' : 'text-white/90 [text-shadow:0_1px_2px_rgba(7,38,70,.45)] hover:bg-white/15 hover:text-white'}`}
            >
              {Icon && <Icon size={13} className="shrink-0" />}
              <span className="truncate">
                {current ? <><span className="hidden font-medium text-[#236aa3]/60 sm:inline">{g.title} · </span>{current.title}</> : g.title}
              </span>
              {anyLive && <span className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${isActive ? 'bg-[#267bbb]' : 'bg-white'}`} />}
              <ChevronDown size={11} className={`hidden shrink-0 opacity-60 transition-transform sm:block ${open === g.id ? 'rotate-180' : ''}`} />
            </button>

            {open === g.id && (
              <div role="menu" className="cf-fade-in absolute inset-x-0 top-full z-40 mt-2 overflow-hidden lg:inset-x-auto lg:left-1/2 lg:top-auto lg:w-[280px] lg:-translate-x-1/2 rounded-2xl border border-black/10 bg-white p-1.5 text-[#151719] shadow-[0_24px_60px_rgba(20,45,70,.22)]">
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-black/35">{g.title}</p>
                {g.modes.map((id) => {
                  const m = modeById(id);
                  const on = id === active;
                  return (
                    <button
                      key={id}
                      role="menuitem"
                      onClick={() => { onSelect(id); setOpen(null); }}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? 'bg-[#edf6fd]' : 'hover:bg-[#f4f4f1]'}`}
                    >
                      <m.icon size={15} className={`mt-0.5 shrink-0 ${on ? 'text-[#267bbb]' : 'text-black/45'}`} />
                      <span className="min-w-0">
                        <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${on ? 'text-[#236aa3]' : ''}`}>
                          {m.title}
                          {m.fields.local && <span className="rounded-full bg-[#eef8f1] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[#4b9568]">No AI</span>}
                          {live(id) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#267bbb]" />}
                        </span>
                        <span className="block text-[11px] font-normal leading-4 text-black/45">{m.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

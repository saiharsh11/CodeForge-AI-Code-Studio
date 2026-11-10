import { useEffect, useState } from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { fetchModels, shortName } from '@/studio/lib/api';

// Shown until (or if) the live list from /api/models arrives — must match the models actually offered.
const FALLBACK = ['North Mini Code', 'Nemotron 3 Ultra', 'Gemma 4 31B', 'Gemma 4 26B A4B'];

export function ModelTicker() {
  const [names, setNames] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetchModels()
      .then(({ models }) => {
        const live = [...new Set(models.map(shortName))];
        if (alive && live.length) setNames(live.slice(0, 14));
      })
      .catch(() => { /* keep the fallback list */ });
    return () => { alive = false; };
  }, []);

  const base = [
    { label: 'OpenRouter', icon: Sparkles, strong: true },
    ...names.map((n) => ({ label: n, icon: Cpu, strong: false })),
  ];
  // Only a couple of models: repeat them so the scrolling strip never shows a gap.
  const items = Array.from({ length: Math.max(1, Math.ceil(8 / base.length)) }, () => base).flat();

  return (
    <div className="cf-marquee-wrap cf-mask-x mx-auto mt-8 max-w-[720px] overflow-hidden" aria-label="Supported models">
      <div className="cf-marquee flex w-max gap-2.5">
        {[...items, ...items].map((it, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/25 hover:text-white ${it.strong ? 'border-white/40 bg-white/20 font-semibold text-white' : 'border-white/20 bg-white/10 text-white/75'}`}
          >
            <it.icon size={12} /> {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

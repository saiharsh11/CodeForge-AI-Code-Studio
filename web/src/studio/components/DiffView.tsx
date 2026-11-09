import { useMemo } from 'react';
import { diffLines } from 'diff';

interface Row { kind: 'add' | 'del' | 'same' | 'gap'; text: string; a?: number; b?: number }

const CONTEXT = 3; // unchanged lines shown around each change

/** Unified line diff between the user's code and the model's version. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const { rows, added, removed } = useMemo(() => {
    const parts = diffLines(before.replace(/\s+$/, '') + '\n', after.replace(/\s+$/, '') + '\n');
    const all: Row[] = [];
    let a = 1, b = 1, added = 0, removed = 0;
    for (const p of parts) {
      const lines = p.value.replace(/\n$/, '').split('\n');
      for (const text of lines) {
        if (p.added) { all.push({ kind: 'add', text, b: b++ }); added++; }
        else if (p.removed) { all.push({ kind: 'del', text, a: a++ }); removed++; }
        else all.push({ kind: 'same', text, a: a++, b: b++ });
      }
    }
    // Collapse long unchanged stretches.
    const near = all.map((r, i) => r.kind !== 'same' || all.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1).some((x) => x.kind !== 'same'));
    const rows: Row[] = [];
    let hidden = 0;
    all.forEach((r, i) => {
      if (near[i]) {
        if (hidden) rows.push({ kind: 'gap', text: `${hidden} unchanged line${hidden === 1 ? '' : 's'}` });
        hidden = 0;
        rows.push(r);
      } else hidden++;
    });
    if (hidden) rows.push({ kind: 'gap', text: `${hidden} unchanged line${hidden === 1 ? '' : 's'}` });
    return { rows, added, removed };
  }, [before, after]);

  if (!added && !removed) return <p className="px-4 py-6 text-center text-xs text-white/40">No changes — identical to your code.</p>;

  return (
    <div className="overflow-x-auto py-2 font-mono text-[12px] leading-[1.7]">
      <p className="px-4 pb-2 font-sans text-[11px] text-white/40">
        <span className="text-[#7cc597]">+{added}</span> <span className="text-[#f08c7c]">−{removed}</span> lines vs. your code
      </p>
      <table className="cf-diff w-full border-collapse">
        <tbody>
          {rows.map((r, i) =>
            r.kind === 'gap' ? (
              <tr key={i}><td colSpan={3} className="bg-white/[.02] px-4 py-1 text-center font-sans text-[10px] text-white/30">⋯ {r.text}</td></tr>
            ) : (
              <tr key={i} className={r.kind === 'add' ? 'bg-[#7cc597]/[.09]' : r.kind === 'del' ? 'bg-[#f08c7c]/[.09]' : ''}>
                <td className="w-10 select-none pl-3 pr-1 text-right text-white/20">{r.a ?? ''}</td>
                <td className="w-10 select-none pr-2 text-right text-white/20">{r.b ?? ''}</td>
                <td className={`whitespace-pre pr-4 ${r.kind === 'add' ? 'text-[#b9e3c6]' : r.kind === 'del' ? 'text-[#f5b3a8]' : 'text-[#c9d4dc]/80'}`}>
                  <span className="mr-2 select-none text-white/30">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span>{r.text}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

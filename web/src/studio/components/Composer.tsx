import { ArrowRight, ChevronDown, Plus, X } from 'lucide-react';
import { DIAGRAM_TYPES, LANGUAGES, canSubmit, type ComposerInput, type DiagramType, type LanguageId, type Mode } from '../lib/modes';

const box =
  'w-full resize-none rounded-xl border border-black/10 bg-white p-4 text-sm leading-6 text-[#151719] outline-none transition placeholder:text-black/30 focus:border-[#267bbb]/50';
const label = 'text-[10px] font-bold uppercase tracking-[.18em] text-black/35';

function LangSelect({ value, onChange, auto = true, only, ariaLabel }: { value: LanguageId; onChange: (v: LanguageId) => void; auto?: boolean; only?: LanguageId[]; ariaLabel: string }) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageId)}
        className="cursor-pointer appearance-none rounded-lg border border-black/10 bg-white py-2 pl-3 pr-8 text-xs text-black/60 outline-none transition hover:border-black/20 focus:border-[#267bbb]/50"
      >
        {LANGUAGES.filter((l) => (only ? only.includes(l.id) : auto || l.id !== 'auto')).map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40" />
    </div>
  );
}

interface Props {
  mode: Mode;
  value: ComposerInput;
  onChange: (v: ComposerInput) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function Composer({ mode, value, onChange, onSubmit, disabled }: Props) {
  const f = mode.fields;
  const set = (patch: Partial<ComposerInput>) => onChange({ ...value, ...patch });
  const ready = canSubmit(mode, value) && !disabled;
  const main = f.code ? value.code : value.notes;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && ready) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div key={mode.id} className="cf-fade-in flex h-full flex-col" onKeyDown={onKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <span className={label}>{f.code ? f.codeLabel ?? 'Your code' : f.mainLabel ?? 'Your prompt'}</span>
        {!f.casesTable && <span className="text-[10px] text-black/30">{main.length.toLocaleString()} chars</span>}
      </div>

      {f.code ? (
        <textarea
          value={value.code}
          onChange={(e) => set({ code: e.target.value })}
          placeholder="Paste your code here…"
          spellCheck={false}
          className={`${box} min-h-[200px] flex-1 font-mono text-[12.5px]`}
        />
      ) : f.casesTable ? (
        <>
          <textarea
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder={f.notesPlaceholder}
            rows={2}
            className={box}
          />
          <CasesTable value={value} onChange={(cases) => set({ cases })} />
        </>
      ) : (
        <textarea
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder={f.notesPlaceholder}
          spellCheck={!f.mainMono}
          className={`${box} min-h-[190px] flex-1 ${f.mainMono ? 'font-mono text-[12.5px]' : ''}`}
        />
      )}

      {!f.code && mode.examples.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mode.examples.map((ex) => (
            <button
              key={ex}
              onClick={() => set({ notes: ex })}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-left text-[11px] text-black/55 transition hover:border-[#267bbb]/40 hover:text-[#267bbb]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {f.extraLabel && (
        <div className="mt-4">
          <span className={label}>{f.extraLabel}</span>
          <textarea
            value={value.extra}
            onChange={(e) => set({ extra: e.target.value })}
            placeholder={f.extraPlaceholder}
            rows={3}
            spellCheck={false}
            className={`${box} mt-2 font-mono text-[12px]`}
          />
        </div>
      )}

      {f.code && f.notesLabel && (
        <div className="mt-4">
          <span className={label}>{f.notesLabel}</span>
          <textarea
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder={f.notesPlaceholder}
            rows={2}
            className={`${box} mt-2`}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LangSelect ariaLabel={f.languageLabel ?? 'Language'} only={f.languages} value={value.language} onChange={(language) => set({ language })} />
          {f.local && <span className="text-[10px] text-black/40">Runs in your browser · no AI request</span>}
          {f.diagramType && (
            <div className="relative">
              <select
                aria-label="Diagram type"
                value={value.diagram}
                onChange={(e) => set({ diagram: e.target.value as DiagramType })}
                className="cursor-pointer appearance-none rounded-lg border border-[#267bbb]/30 bg-[#edf6fd] py-2 pl-3 pr-8 text-xs font-medium text-[#236aa3] outline-none transition focus:border-[#267bbb]/60"
              >
                {DIAGRAM_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#236aa3]" />
            </div>
          )}
          {f.targetLanguage && (
            <>
              <ArrowRight size={13} className="text-black/30" />
              <LangSelect ariaLabel="Target language" auto={false} value={value.target} onChange={(target) => set({ target })} />
            </>
          )}
        </div>
        <button
          onClick={onSubmit}
          disabled={!ready}
          className="group flex items-center gap-2 rounded-lg bg-[#111317] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {mode.title}
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          <kbd className="ml-1 hidden font-sans text-[10px] font-normal text-white/45 sm:inline">⌘↵</kbd>
        </button>
      </div>
      {!f.local && (
        <p className="mt-3 text-[10px] leading-4 text-black/35">
          Sent to a free AI model whose provider may keep your prompts and use them for training — don’t paste passwords, keys or private data.
        </p>
      )}
    </div>
  );
}

/** Input → expected output rows for By example mode. Values are written as literals in the chosen language. */
function CasesTable({ value, onChange }: { value: ComposerInput; onChange: (c: ComposerInput['cases']) => void }) {
  const py = value.language === 'python';
  const ph = [
    { args: '10', expected: '55' },
    { args: py ? '0' : '0', expected: '0' },
    { args: py ? '1' : '1', expected: '1' },
  ];
  const cell = 'min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 font-mono text-[12px] outline-none transition placeholder:text-black/25 focus:border-[#267bbb]/50';
  const update = (i: number, patch: Partial<ComposerInput['cases'][number]>) =>
    onChange(value.cases.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className={label}>Examples</span>
        <span className="text-[10px] text-black/30">{value.cases.filter((c) => c.args.trim() && c.expected.trim()).length} ready · each one is run to check the code</span>
      </div>
      <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {value.cases.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="shrink-0 font-mono text-[12px] text-black/40">solve(</span>
            <input aria-label={`Example ${i + 1} arguments`} value={c.args} onChange={(e) => update(i, { args: e.target.value })} placeholder={ph[i]?.args ?? (py ? "'abc', 2" : "'abc', 2")} spellCheck={false} className={cell} />
            <span className="shrink-0 font-mono text-[12px] text-black/40">) →</span>
            <input aria-label={`Example ${i + 1} expected`} value={c.expected} onChange={(e) => update(i, { expected: e.target.value })} placeholder={ph[i]?.expected ?? (py ? 'True' : 'true')} spellCheck={false} className={cell} />
            <button aria-label="Remove example" onClick={() => onChange(value.cases.filter((_, j) => j !== i))} disabled={value.cases.length <= 1} className="shrink-0 rounded p-1 text-black/30 transition hover:bg-black/5 hover:text-black disabled:opacity-20">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      {value.cases.length < 12 && (
        <button onClick={() => onChange([...value.cases, { args: '', expected: '' }])} className="mt-2 flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#267bbb] transition hover:bg-[#edf6fd]">
          <Plus size={12} /> Add example
        </button>
      )}
      <p className="mt-2 text-[10px] leading-4 text-black/35">
        Write values as {py ? 'Python' : 'JavaScript'} literals — e.g. {py ? "[1, 2], 'hi', True, None" : "[1, 2], 'hi', true, null"}. Several arguments are separated by commas.
      </p>
    </div>
  );
}

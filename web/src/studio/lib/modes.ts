import type { LucideIcon } from 'lucide-react';
import { Wand2, ScanSearch, BookOpen, Recycle, ArrowRightLeft, FlaskConical, Bug, Workflow, Siren, Regex, ListChecks, Bomb, TrendingUp, Footprints } from 'lucide-react';

export type ModeId =
  | 'generate' | 'review' | 'explain' | 'diagram' | 'refactor' | 'convert' | 'tests' | 'debug' | 'error' | 'regex'
  | 'spec' | 'break' | 'bigo' | 'trace';

export type ModeGroup = 'write' | 'understand' | 'fix' | 'verify';
export const GROUPS: { id: ModeGroup; title: string; modes: ModeId[] }[] = [
  { id: 'write', title: 'Write', modes: ['generate', 'refactor', 'convert', 'tests', 'regex'] },
  { id: 'understand', title: 'Understand', modes: ['explain', 'diagram', 'trace'] },
  { id: 'fix', title: 'Fix', modes: ['review', 'debug', 'error'] },
  { id: 'verify', title: 'Check', modes: ['spec', 'break', 'bigo'] },
];
export const groupOf = (id: ModeId) => GROUPS.find((g) => g.modes.includes(id))!;

/** Languages the browser can execute (JS/TS natively, Python via Pyodide). */
export const RUNNABLE: LanguageId[] = ['python', 'javascript', 'typescript'];

export const DIAGRAM_TYPES = [
  { id: 'auto', label: 'Auto diagram', hint: 'whichever Mermaid diagram type best explains this code' },
  { id: 'flowchart', label: 'Flowchart', hint: 'a flowchart (`flowchart TD`) of the control flow, branches and loops' },
  { id: 'sequence', label: 'Sequence', hint: 'a sequence diagram (`sequenceDiagram`) of calls and messages between functions, objects or services' },
  { id: 'class', label: 'Class', hint: 'a class diagram (`classDiagram`) of types, fields, methods and relationships' },
  { id: 'state', label: 'State', hint: 'a state diagram (`stateDiagram-v2`) of the states and transitions' },
] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number]['id'];

export const LANGUAGES = [
  { id: 'auto', label: 'Auto-detect', ext: 'txt' },
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'javascript', label: 'JavaScript', ext: 'js' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
  { id: 'rust', label: 'Rust', ext: 'rs' },
  { id: 'go', label: 'Go', ext: 'go' },
  { id: 'java', label: 'Java', ext: 'java' },
  { id: 'cpp', label: 'C++', ext: 'cpp' },
  { id: 'csharp', label: 'C#', ext: 'cs' },
  { id: 'php', label: 'PHP', ext: 'php' },
  { id: 'ruby', label: 'Ruby', ext: 'rb' },
  { id: 'swift', label: 'Swift', ext: 'swift' },
  { id: 'kotlin', label: 'Kotlin', ext: 'kt' },
  { id: 'sql', label: 'SQL', ext: 'sql' },
  { id: 'bash', label: 'Bash', ext: 'sh' },
  { id: 'html', label: 'HTML/CSS', ext: 'html' },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]['id'];

export const langLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label ?? id;

// Map a markdown fence tag (or language id) to a file extension for downloads.
const FENCE_EXT: Record<string, string> = {
  py: 'py', python: 'py', js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', typescript: 'ts', tsx: 'tsx',
  rust: 'rs', rs: 'rs', go: 'go', golang: 'go', java: 'java', cpp: 'cpp', 'c++': 'cpp', c: 'c', h: 'h',
  csharp: 'cs', cs: 'cs', php: 'php', ruby: 'rb', rb: 'rb', swift: 'swift', kotlin: 'kt', kt: 'kt',
  sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', html: 'html', css: 'css', json: 'json',
  yaml: 'yml', yml: 'yml', toml: 'toml', md: 'md', markdown: 'md', dockerfile: 'Dockerfile',
};
export const extFor = (lang: string) => FENCE_EXT[lang.toLowerCase()] ?? 'txt';

export interface ModeFields {
  code: boolean;
  codeLabel?: string;
  notesLabel: string;
  notesPlaceholder: string;
  notesRequired: boolean;
  /** Second free-text box (debug: error output). */
  extraLabel?: string;
  extraPlaceholder?: string;
  targetLanguage?: boolean;
  diagramType?: boolean;
  /** Main (non-code) box holds machine text such as logs: use a monospace font. */
  mainMono?: boolean;
  mainLabel?: string;
  languageLabel?: string;
  /** Restrict the language picker (modes that execute code only support runnable languages). */
  languages?: LanguageId[];
  /** Input → expected output table (By example mode). */
  casesTable?: boolean;
  /** Runs in the browser with no AI request (Step through). */
  local?: boolean;
}

export interface Mode {
  id: ModeId;
  title: string;
  blurb: string;
  icon: LucideIcon;
  fields: ModeFields;
  examples: string[];
  system: (lang: string, target: string, diagram: DiagramType) => string;
  build: (input: ComposerInput) => string;
}

export interface ComposerInput {
  code: string;
  notes: string;
  extra: string;
  language: LanguageId;
  target: LanguageId;
  diagram: DiagramType;
  cases: { args: string; expected: string }[];
}

const BASE = `You are CodeForge, a senior software engineer working as a coding assistant.
Write correct, idiomatic, production-quality code. Always put code in fenced markdown blocks tagged with the language.
Be concise: no filler, no restating the question. Use markdown headings and lists only when they help.
The conversation may continue with follow-up requests — when asked to change code, return the full updated code unless the change is a small, clearly located edit.`;

const lang = (l: string) => (l === 'auto' ? 'the code’s language (detect it)' : langLabel(l));
const fence = (l: LanguageId, code: string) => `\`\`\`${l === 'auto' ? '' : l}\n${code}\n\`\`\``;
const opt = (label: string, text: string) => (text.trim() ? `\n\n**${label}:** ${text.trim()}` : '');

export const MODES: Mode[] = [
  {
    id: 'generate',
    title: 'Generate',
    blurb: 'Describe it, get working code',
    icon: Wand2,
    fields: {
      code: false,
      notesLabel: 'What should it do?',
      notesPlaceholder: 'e.g. A CLI that watches a folder and resizes any new image to 1024px wide, keeping the aspect ratio',
      notesRequired: true,
    },
    examples: [
      'A rate limiter middleware for Express using a sliding window',
      'A function that parses a CSV file and returns rows grouped by a column',
      'A React hook that debounces a value',
    ],
    system: (l) => `${BASE}
Task: generate ${l === 'auto' ? 'code in the most suitable language' : `${langLabel(l)} code`} for the user's request.
Lead with the code. After it, add at most a few bullet points on usage or design decisions worth knowing. Add brief comments only for non-obvious logic.`,
    build: (i) => `**Generate** · ${i.language === 'auto' ? 'any language' : langLabel(i.language)}\n\n${i.notes.trim()}`,
  },
  {
    id: 'review',
    title: 'Review',
    blurb: 'Bugs, security, performance',
    icon: ScanSearch,
    fields: {
      code: true,
      notesLabel: 'Focus (optional)',
      notesPlaceholder: 'e.g. Mostly worried about concurrency and SQL injection',
      notesRequired: false,
    },
    examples: [],
    system: (l) => `${BASE}
Task: review ${lang(l)} code like a strict but fair senior reviewer.
Structure the review as:
1. **Verdict** — one or two sentences.
2. **Issues** — ordered by severity. Tag each as [Bug], [Security], [Performance] or [Quality], point to the line or snippet, explain the impact, and show the fix.
3. **Improved version** — the full corrected code, only if there were real issues.
Do not invent problems; if the code is solid, say so.`,
    build: (i) => `**Review** this code:${opt('Focus', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'explain',
    title: 'Explain',
    blurb: 'Understand unfamiliar code',
    icon: BookOpen,
    fields: {
      code: true,
      notesLabel: 'Question (optional)',
      notesPlaceholder: 'e.g. Why is the cache keyed this way?',
      notesRequired: false,
    },
    examples: [],
    system: (l) => `${BASE}
Task: explain ${lang(l)} code to a capable developer who has not seen it before.
Start with a short summary of what it does and why. Then walk through the important parts in order, quoting short snippets. Call out anything surprising, risky or clever. Answer the user's specific question first if they asked one.`,
    build: (i) => `**Explain** this code:${opt('Question', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'diagram',
    title: 'Diagram',
    blurb: 'See how the code flows',
    icon: Workflow,
    fields: {
      code: true,
      notesLabel: 'What should it show? (optional)',
      notesPlaceholder: 'e.g. Just the checkout path, from cart to payment confirmation',
      notesRequired: false,
      diagramType: true,
    },
    examples: [],
    system: (l, _t, d) => `${BASE}
Task: explain ${lang(l)} code visually with ${DIAGRAM_TYPES.find((x) => x.id === d)!.hint}.
Output exactly ONE Mermaid diagram in a fenced block tagged \`mermaid\`, then 3–6 short bullets walking through it.
Mermaid rules — follow them strictly so the diagram renders:
- Use valid Mermaid syntax only. No HTML, no click handlers, no styling directives, no %%{init}%% blocks.
- Keep node labels short (under 6 words). Wrap any label containing spaces, punctuation, quotes or brackets in double quotes, e.g. A["parse(input)"].
- Use simple alphanumeric node IDs (A, B, fetchUser). Never use the reserved word "end" as an ID.
- At most ~25 nodes; group related steps instead of listing every line.
When asked to change the diagram, return the full updated Mermaid block.`,
    build: (i) =>
      `**Diagram** (${DIAGRAM_TYPES.find((x) => x.id === i.diagram)!.label}) this code:${opt('Focus', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'refactor',
    title: 'Refactor',
    blurb: 'Cleaner code, same behaviour',
    icon: Recycle,
    fields: {
      code: true,
      notesLabel: 'Goals (optional)',
      notesPlaceholder: 'e.g. Split into smaller functions, remove the global state',
      notesRequired: false,
    },
    examples: [],
    system: (l) => `${BASE}
Task: refactor ${lang(l)} code for readability, structure and maintainability WITHOUT changing its behaviour or public interface (unless the user asks).
Return the full refactored code first, then a short bullet list of what changed and why.`,
    build: (i) => `**Refactor** this code:${opt('Goals', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'convert',
    title: 'Convert',
    blurb: 'Translate between languages',
    icon: ArrowRightLeft,
    fields: {
      code: true,
      notesLabel: 'Notes (optional)',
      notesPlaceholder: 'e.g. Use async/await and the standard library only',
      notesRequired: false,
      targetLanguage: true,
    },
    examples: [],
    system: (l, t) => `${BASE}
Task: convert ${lang(l)} code to idiomatic ${langLabel(t)}. Preserve behaviour exactly, but use ${langLabel(t)} conventions, standard library and error handling rather than a line-by-line transliteration.
Return the full converted code first, then briefly note any behavioural differences or dependencies the user must install.`,
    build: (i) =>
      `**Convert** to ${langLabel(i.target)}:${opt('Notes', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'tests',
    title: 'Write tests',
    blurb: 'Unit tests with edge cases',
    icon: FlaskConical,
    fields: {
      code: true,
      notesLabel: 'Framework / notes (optional)',
      notesPlaceholder: 'e.g. pytest, mock the HTTP calls',
      notesRequired: false,
    },
    examples: [],
    system: (l) => `${BASE}
Task: write thorough unit tests for ${lang(l)} code using the most common test framework for the language unless the user names one.
Cover the happy path, edge cases, invalid input and error paths. Use descriptive test names. Mock external I/O.
Return a complete, runnable test file, then one line on how to run it.`,
    build: (i) => `**Write tests** for this code:${opt('Framework / notes', i.notes)}\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'debug',
    title: 'Debug',
    blurb: 'Find and fix the error',
    icon: Bug,
    fields: {
      code: true,
      notesLabel: 'What did you expect? (optional)',
      notesPlaceholder: 'e.g. It should return the total, but returns NaN on the second call',
      notesRequired: false,
      extraLabel: 'Error / stack trace',
      extraPlaceholder: 'Paste the error message or stack trace…',
    },
    examples: [],
    system: (l) => `${BASE}
Task: debug ${lang(l)} code.
Structure the answer as:
1. **Root cause** — what is actually going wrong and why, pointing to the exact line.
2. **Fix** — the corrected code (full code if the fix touches several places).
3. **Prevention** — one or two sentences, only if useful.
If the information is insufficient to be sure, state your best hypothesis and what to check.`,
    build: (i) =>
      `**Debug** this code:${opt('Expected behaviour', i.notes)}${
        i.extra.trim() ? `\n\n**Error:**\n\`\`\`text\n${i.extra.trim()}\n\`\`\`` : ''
      }\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'error',
    title: 'Error',
    blurb: 'Paste an error, get the fix',
    icon: Siren,
    fields: {
      code: false,
      mainLabel: 'Error or stack trace',
      mainMono: true,
      notesLabel: '',
      notesPlaceholder: 'Paste the full error message or stack trace…',
      notesRequired: true,
      extraLabel: 'Context (optional)',
      extraPlaceholder: 'e.g. Next.js 15 on Node 22, only happens in production builds',
    },
    examples: [],
    system: (l) => `${BASE}
Task: the user pasted an error message or stack trace${l === 'auto' ? '' : ` from ${langLabel(l)}`}, usually without the code. Diagnose it.
Structure the answer as:
1. **What it means** — one or two plain sentences.
2. **Likely causes** — ranked, most likely first; point at the exact frame/line in the trace when there is one.
3. **Fix** — concrete steps, commands or a code snippet for the top cause.
4. **If that wasn't it** — the one thing to check or paste next.
Keep it short. Do not invent code the user didn't show; describe the fix against what the trace reveals.`,
    build: (i) =>
      `**Explain this error**${i.language === 'auto' ? '' : ` (${langLabel(i.language)})`}:${opt('Context', i.extra)}\n\n\`\`\`text\n${i.notes.trim()}\n\`\`\``,
  },
  {
    id: 'regex',
    title: 'Regex',
    blurb: 'Describe a pattern, test it live',
    icon: Regex,
    fields: {
      code: false,
      mainLabel: 'Describe the pattern',
      notesLabel: '',
      notesPlaceholder: 'e.g. Match UK postcodes like "SW1A 1AA" or "M1 1AE", case-insensitive',
      notesRequired: true,
      extraLabel: 'Sample text to test against (optional)',
      extraPlaceholder: 'Paste a few lines that should and shouldn’t match…',
      languageLabel: 'Regex flavour',
    },
    examples: ['Email addresses (pragmatic, not RFC-perfect)', 'ISO dates like 2026-11-09', 'Hex colours like #fff or #1a2b3c'],
    system: (l) => `${BASE}
Task: write a regular expression for the user's description.
Output format — follow exactly:
1. First, a fenced block tagged \`regex\` containing ONLY the JavaScript-compatible pattern as a literal on one line, e.g.
\`\`\`regex
/^\\d{4}-\\d{2}-\\d{2}$/gm
\`\`\`
   Include the g flag; add m/i/s/u only when needed. The user tests this pattern live in the browser.
2. A short breakdown of each part of the pattern (a compact list).
3. ${l === 'auto' || l === 'javascript' || l === 'typescript' ? 'A one-line JavaScript usage example.' : `How to use it in ${langLabel(l)}, as a fenced \`${l}\` snippet, noting any flavour differences from JavaScript.`}
4. Known edge cases it does not handle, if any.
Prefer readable, maintainable patterns over clever ones. Avoid catastrophic backtracking (no nested quantifiers like (a+)+).`,
    build: (i) =>
      `**Regex**${i.language === 'auto' ? '' : ` (${langLabel(i.language)} flavour)`}: ${i.notes.trim()}${i.extra.trim() ? `\n\n**Sample text:**\n\`\`\`text\n${i.extra.trim()}\n\`\`\`` : ''}`,
  },
  {
    id: 'spec',
    title: 'By example',
    blurb: 'Give examples, get code that passes them',
    icon: ListChecks,
    fields: {
      code: false,
      mainLabel: 'What should the function do? (optional)',
      notesLabel: '',
      notesPlaceholder: 'e.g. Return the n-th Fibonacci number. Should be fast for n up to 10,000.',
      notesRequired: false,
      casesTable: true,
      languages: RUNNABLE,
    },
    examples: [],
    system: (l) => `${BASE}
Task: write a ${langLabel(l)} function named exactly \`solve\` that satisfies the user's input → output examples. Every example will be executed automatically in the user's browser and compared with the expected value, so correctness on the examples is mandatory — and generalise sensibly beyond them.
Rules:
- Return ONE fenced \`${l}\` block containing the complete implementation: \`solve\` plus any helpers. Standard library only.
- No example calls, prints, tests or input() in the block — the harness calls \`solve\` itself.
- After the block, at most 3 short bullets on the approach and any assumption.
When told that examples failed, fix the code and return the full corrected block.`,
    build: (i) => {
      const call = (a: string) => `solve(${a.trim()})`;
      const rows = i.cases.filter((c) => c.args.trim()).map((c) => `| \`${call(c.args)}\` | \`${c.expected.trim()}\` |`).join('\n');
      return `**By example** (${langLabel(i.language)})${i.notes.trim() ? `: ${i.notes.trim()}` : ''}\n\n| Call | Expected |\n|---|---|\n${rows}`;
    },
  },
  {
    id: 'break',
    title: 'Break it',
    blurb: 'AI invents nasty inputs; we run them',
    icon: Bomb,
    fields: {
      code: true,
      notesLabel: 'Function to attack (optional)',
      notesPlaceholder: 'e.g. parse_price — defaults to the main function',
      notesRequired: false,
      languages: RUNNABLE,
    },
    examples: [],
    system: (l) => `${BASE}
Task: act as an adversarial tester for the user's ${langLabel(l)} code. Find the inputs most likely to make its main function crash, hang or return a wrong answer.
Output format — follow exactly, it is parsed by a program:
1. A fenced \`json\` block shaped like:
{"function": "<name of the function to call>", "cases": [{"args": "<the arguments exactly as written inside a call, in ${langLabel(l)} syntax>", "why": "<under 10 words>", "expect": "<the correct return value as a ${langLabel(l)} literal, or "error" if raising/throwing is the correct behaviour, or null if unsure>"}]}
2. Then 2–3 bullets naming the riskiest assumptions in the code.
Give 8–12 cases: empty and single-element inputs, boundaries and off-by-one, zero and negatives, very large values, wrong types, None/null/undefined, duplicates, unicode and whitespace strings. Every "args" string must be valid ${langLabel(l)} that can be pasted between the parentheses of a call. Only set "expect" when you are confident.
When asked to fix failures, return the full corrected code in one fenced \`${l}\` block.`,
    build: (i) => `**Break it** (${langLabel(i.language)})${i.notes.trim() ? ` — target \`${i.notes.trim()}\`` : ''}:\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'bigo',
    title: 'Big-O',
    blurb: 'Claimed complexity, actually measured',
    icon: TrendingUp,
    fields: {
      code: true,
      notesLabel: 'Function to measure (optional)',
      notesPlaceholder: 'e.g. dedupe — defaults to the main function',
      notesRequired: false,
      languages: RUNNABLE,
    },
    examples: [],
    system: (l) => {
      const gen = l === 'python' ? 'make_input' : 'makeInput';
      const ret = l === 'python' ? 'a tuple of positional arguments' : 'an array of arguments';
      return `${BASE}
Task: analyse the time complexity of the user's ${langLabel(l)} code. Your claim will be checked by actually timing the code at growing input sizes, so be accurate.
Output format — follow exactly, it is parsed by a program:
1. First line exactly: \`Claim: O(...)\` — the typical-case time complexity of the main function in terms of input size n.
2. A fenced \`${l}\` block defining ONLY \`${gen}(n)\`, which returns ${ret} for one call of the main function on an input of size n. Make it realistic (e.g. random data, not pre-sorted unless that is the typical case), fast to generate, standard library only, no prints.
3. Then a short explanation: the dominant operation, why it costs that much, and one concrete way to make it faster if there is one.`;
    },
    build: (i) => `**Big-O** (${langLabel(i.language)})${i.notes.trim() ? ` — measure \`${i.notes.trim()}\`` : ''}:\n\n${fence(i.language, i.code)}`,
  },
  {
    id: 'trace',
    title: 'Step through',
    blurb: 'Watch Python run, line by line',
    icon: Footprints,
    fields: {
      code: true,
      codeLabel: 'Your Python',
      notesLabel: '',
      notesPlaceholder: '',
      notesRequired: false,
      languages: ['python'],
      local: true,
    },
    examples: [],
    system: () => `${BASE}
Task: the user is stepping through an execution trace of their Python program in a visual debugger and will ask about specific steps. Explain what the line does, why each variable has the value it has, and how it leads to the next step. Be concrete and brief; refer to line numbers and variable names.`,
    build: (i) => `**Step through**:\n\n${fence('python', i.code)}`,
  },
];

export const modeById = (id: ModeId) => MODES.find((m) => m.id === id)!;

export const canSubmit = (mode: Mode, v: ComposerInput) =>
  mode.fields.casesTable
    ? v.cases.some((c) => c.args.trim() && c.expected.trim())
    : mode.fields.code ? v.code.trim().length > 0 : v.notes.trim().length > 0;

/** Best guess between the three runnable languages, for code pasted with "Auto-detect". */
export function guessRunnable(code: string): LanguageId {
  if (/^\s*(def|class)\s+\w+.*:\s*$|^\s*(import|from)\s+\w+(\s+import\b.*)?\s*$|\bprint\(|\belif\b|\bNone\b|\bTrue\b/m.test(code)) return 'python';
  if (/:\s*(number|string|boolean|void|any|unknown)\b|\binterface\s+\w+|<\w+(\[\])?>\(|\bas\s+const\b/.test(code)) return 'typescript';
  return 'javascript';
}

/** Modes that execute code only accept runnable languages: coerce (or detect) before showing or sending. */
export function normaliseInput(mode: Mode, v: ComposerInput): ComposerInput {
  const allowed = mode.fields.languages;
  if (!allowed || allowed.includes(v.language)) return v;
  const guess = guessRunnable(v.code);
  return { ...v, language: allowed.includes(guess) ? guess : allowed[0] };
}

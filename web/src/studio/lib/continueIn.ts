import type { LanguageId, ModeId } from './modes';

/** Natural next steps after an answer in each mode. */
export const NEXT: Record<ModeId, ModeId[]> = {
  generate: ['review', 'tests', 'break', 'diagram'],
  review: ['refactor', 'tests', 'break'],
  explain: ['trace', 'diagram', 'refactor'],
  diagram: ['explain', 'trace'],
  refactor: ['review', 'tests', 'bigo'],
  convert: ['review', 'tests'],
  tests: ['review', 'explain'],
  debug: ['tests', 'break'],
  error: [],
  regex: [],
  spec: ['break', 'bigo', 'review'],
  break: ['review', 'tests'],
  bigo: ['refactor', 'review'],
  trace: ['explain', 'diagram'],
};

export const CONTINUE_LABEL: Partial<Record<ModeId, string>> = {
  review: 'Review it', explain: 'Explain it', diagram: 'Diagram it', refactor: 'Refactor it',
  convert: 'Convert it', tests: 'Write tests', debug: 'Debug it',
  break: 'Break it', bigo: 'Measure Big-O', trace: 'Step through',
};

const FENCE_TO_LANG: Record<string, LanguageId> = {
  py: 'python', python: 'python', js: 'javascript', javascript: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', typescript: 'typescript', tsx: 'typescript', rs: 'rust', rust: 'rust', go: 'go', golang: 'go',
  java: 'java', cpp: 'cpp', 'c++': 'cpp', cs: 'csharp', csharp: 'csharp', php: 'php', rb: 'ruby', ruby: 'ruby',
  swift: 'swift', kt: 'kotlin', kotlin: 'kotlin', sql: 'sql', sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash',
  html: 'html', css: 'html',
};
const SKIP = new Set(['mermaid', 'regex', 'text', 'txt', 'diff', 'console', 'output', 'json', 'yaml', 'yml']);

/** The main code block of an answer: the longest real code block (diagrams, logs and data excluded). */
export function mainCodeBlock(markdown: string): { code: string; language: LanguageId } | null {
  let best: { code: string; language: LanguageId } | null = null;
  for (const m of markdown.matchAll(/```([\w+#-]*)[^\n]*\n([\s\S]*?)```/g)) {
    const tag = m[1].toLowerCase();
    const code = m[2].replace(/\n$/, '');
    if (SKIP.has(tag) || code.trim().split('\n').length < 2) continue;
    if (!best || code.length > best.code.length) best = { code, language: FENCE_TO_LANG[tag] ?? 'auto' };
  }
  return best;
}

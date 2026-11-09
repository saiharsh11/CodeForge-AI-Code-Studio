import { createContext } from 'react';

/** Actions and inputs that rich blocks inside an answer (diagrams, runnable code, diffs, regex) need. */
export interface StudioCtx {
  /** Send a follow-up asking the model to fix something; null while a reply is streaming. */
  askFix: ((kind: 'diagram' | 'run', detail: string, lang?: string) => void) | null;
  /** The code the user pasted in this session, for diffing. */
  original: string;
  /** Sample text from regex mode, to pre-fill the live tester. */
  sample: string;
  /** Send any follow-up in the current mode; null while a reply is streaming. */
  ask: ((text: string) => void) | null;
}

export const StudioContext = createContext<StudioCtx>({ askFix: null, original: '', sample: '', ask: null });

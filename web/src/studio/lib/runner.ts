// Runs model-generated code in the browser, off the main thread.
//
// Every run happens inside a dedicated Web Worker, so an infinite loop can't
// freeze the page: when the time limit hits, the worker is terminated.
// Workers have no DOM and no access to the page's localStorage.

export type RunLang = 'javascript' | 'typescript' | 'python';

export interface RunLine { kind: 'out' | 'err' | 'info'; text: string }
export interface RunResult { lines: RunLine[]; error?: string; ms: number; timedOut?: boolean }

const ALIASES: Record<string, RunLang> = {
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', node: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python', python: 'python', python3: 'python',
};
export const runnableLang = (fence: string): RunLang | null => ALIASES[fence.toLowerCase()] ?? null;

const MAX_LINES = 400;
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';

const JS_WORKER = `
const send = (kind, args) => postMessage({ type: 'line', kind, text: args.map((a) => {
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a, null, 2); } catch { return String(a); }
}).join(' ') });
console.log = console.info = console.debug = (...a) => send('out', a);
console.warn = console.error = (...a) => send('err', a);
onmessage = async ({ data }) => {
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(data.code)();
    postMessage({ type: 'done' });
  } catch (e) {
    postMessage({ type: 'done', error: (e && e.stack) ? String(e.stack).split('\\n').slice(0, 6).join('\\n') : String(e) });
  }
};`;

// A module worker: current Chrome refuses classic importScripts() of a
// cross-origin script from a blob: worker, but allows a CORS module import.
const PY_WORKER = `
import { loadPyodide } from '${PYODIDE}pyodide.mjs';
const ready = loadPyodide({ indexURL: '${PYODIDE}' }).then((py) => {
  py.setStdout({ batched: (t) => postMessage({ type: 'line', kind: 'out', text: t }) });
  py.setStderr({ batched: (t) => postMessage({ type: 'line', kind: 'err', text: t }) });
  return py;
});
ready.then(() => postMessage({ type: 'ready' }), (e) => postMessage({ type: 'ready', error: String(e) }));
onmessage = async ({ data }) => {
  const py = await ready;
  try {
    // Detect packages from the user's own source (a wrapper may hide it inside a string).
    await py.loadPackagesFromImports(data.imports ?? data.code);
    // Fresh globals per run, so nothing defined by an earlier run can leak into this one.
    const scope = py.globals.get('dict')();
    scope.set('__name__', '__main__');
    try { await py.runPythonAsync(data.code, { globals: scope }); } finally { scope.destroy(); }
    postMessage({ type: 'done' });
  } catch (e) {
    const msg = String(e && e.message || e);
    postMessage({ type: 'done', error: msg.split('\\n').filter(Boolean).slice(-8).join('\\n') });
  }
};`;

const workerFrom = (src: string, type: WorkerType = 'classic') =>
  new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type });

// Python is ~10 MB to boot, so keep one warm worker and reuse it between runs.
let pyWorker: Worker | null = null;
let pyReady: Promise<void> | null = null;
function getPython(onInfo: (t: string) => void) {
  if (!pyWorker) {
    onInfo('Loading Python runtime (one-time, ~10 MB)…');
    pyWorker = workerFrom(PY_WORKER, 'module');
    const w = pyWorker;
    pyReady = new Promise((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        if (e.data.type !== 'ready') return;
        w.removeEventListener('message', onMsg);
        if (e.data.error) reject(new Error(e.data.error)); else resolve();
      };
      w.addEventListener('message', onMsg);
    });
  }
  return { worker: pyWorker, ready: pyReady! };
}
function killPython() {
  pyWorker?.terminate();
  pyWorker = null;
  pyReady = null;
}

/** Strip the bits of ES-module syntax that can't run inside a function body. */
function prepareJs(code: string) {
  if (/^\s*import\s.+from\s+['"]/m.test(code) || /\brequire\(\s*['"]/.test(code)) {
    throw new Error('This code imports packages, which the browser runner can’t load. Ask for a self-contained version, or run it locally.');
  }
  return code.replace(/^\s*export\s+default\s+/gm, '').replace(/^\s*export\s+(?=(async\s+)?(function|const|let|var|class)\b)/gm, '');
}

export async function runCode(lang: RunLang, code: string, onLine: (l: RunLine) => void, opts: { limitMs?: number; importsFrom?: string } = {}): Promise<RunResult> {
  const lines: RunLine[] = [];
  const push = (l: RunLine) => {
    if (lines.length === MAX_LINES) { const cut: RunLine = { kind: 'info', text: `…output truncated after ${MAX_LINES} lines` }; lines.push(cut); onLine(cut); }
    if (lines.length >= MAX_LINES) return;
    lines.push(l);
    onLine(l);
  };
  const started = performance.now();

  let source = code;
  try {
    if (lang === 'typescript') {
      const { transform } = await import('sucrase');
      source = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
    }
    if (lang !== 'python') source = prepareJs(source);
  } catch (e) {
    return { lines, error: (e as Error).message, ms: 0 };
  }

  let worker: Worker;
  let limit = 6_000;
  if (lang === 'python') {
    const py = getPython((t) => push({ kind: 'info', text: t }));
    try { await py.ready; } catch (e) { killPython(); return { lines, error: `Python failed to load: ${(e as Error).message}`, ms: 0 }; }
    worker = py.worker;
    limit = 15_000; // first run may also download packages such as numpy
  } else {
    worker = workerFrom(JS_WORKER);
  }
  if (opts.limitMs) limit = opts.limitMs;

  return new Promise<RunResult>((resolve) => {
    const finish = (r: Omit<RunResult, 'lines' | 'ms'>) => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMsg);
      if (lang !== 'python' || r.timedOut) { if (lang === 'python') killPython(); else worker.terminate(); }
      resolve({ lines, ms: performance.now() - started, ...r });
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data.type === 'line') push({ kind: e.data.kind, text: e.data.text });
      if (e.data.type === 'done') finish({ error: e.data.error });
    };
    const timer = setTimeout(
      () => finish({ timedOut: true, error: `Stopped after ${(limit / 1000).toFixed(limit < 10_000 ? 1 : 0)}s — is there an infinite loop, or is it waiting for input()?` }),
      limit
    );
    worker.addEventListener('message', onMsg);
    worker.postMessage({ code: source, imports: opts.importsFrom });
  });
}

/**
 * Plain-language explanation for errors caused by the browser runtime rather than the
 * code itself — most often importing a package that can't run in the browser.
 */
export function explainRunError(error?: string): string | null {
  if (!error) return null;
  const mod = /ModuleNotFoundError: No module named '([\w.]+)'/.exec(error)?.[1];
  if (mod) {
    const top = mod.split('.')[0];
    const heavy = /^(torch|torchvision|torchaudio|tensorflow|keras|jax|jaxlib|transformers|accelerate|diffusers|vllm|cv2|onnxruntime|xgboost|lightgbm|psycopg2|mysqlclient)$/.test(top);
    return heavy
      ? `“${top}” can’t run in the browser. Code here runs on Pyodide (Python compiled to WebAssembly), which supports the standard library and packages such as numpy, pandas and scipy — but not machine-learning frameworks like PyTorch, TensorFlow or Hugging Face transformers, or native database drivers. Run this code on your own machine, or step through the parts that don’t depend on it.`
      : `“${top}” isn’t available in the browser’s Python (Pyodide). The standard library and Pyodide’s built-in packages (numpy, pandas, scipy and others) work; most other third-party packages don’t.`;
  }
  return null;
}

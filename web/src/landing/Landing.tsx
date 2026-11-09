import { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, BookOpen, Bug, Check, ChevronDown, Cpu, FlaskConical, Gauge, Menu, Play,
  Recycle, Regex, ArrowRightLeft, ScanSearch, ShieldCheck, Siren, Sparkles, Wand2, Workflow, X,
} from 'lucide-react';
import { Github } from '@/components/GithubIcon';
import { Clouds } from '@/components/Clouds';
import { LiveMockup } from './LiveMockup';
import { ModelTicker } from './ModelTicker';

const SKY = 'https://images.pexels.com/photos/35636373/pexels-photo-35636373.jpeg?auto=compress&cs=tinysrgb&h=1300&w=1880';
const REPO = 'https://github.com/saiharsh11/CodeForge-AI-Code-Studio';

const faqs = [
  ['So what is CodeForge?', 'It’s a place to write, check and understand code with AI. You describe what you want or paste what you have, and it helps — then you can actually run the result instead of hoping it works.'],
  ['Which AI models does it use?', 'Two free models picked for coding: Cohere’s North Mini Code and NVIDIA’s Nemotron 3 Ultra. We chose them from OpenRouter’s free list because they did well in our tests, come from established companies and aren’t scheduled to be retired. If one is busy, CodeForge quietly switches to the other.'],
  ['Is it really free?', 'Yes. The catch is that free models come with a daily allowance — 50 requests a day for most people. There’s a little meter at the bottom of the studio so you always know how many you’ve got left, and asking the same thing twice in one tab doesn’t use any.'],
  ['What if a model is slow or busy?', 'We’ll quietly hand your request to another free model that’s working and let you know we did. If you’ve used up your allowance for the day, we’ll just tell you, along with when it resets.'],
  ['Can I run the code it writes?', 'For JavaScript, TypeScript and Python, yes — there’s a Run button right on the code. It runs in a background process in your own browser, not on our servers, so it can’t freeze the page, and if something loops forever we stop it for you. If it breaks, one click asks the AI to fix it. Only run code you’re comfortable running on your own machine.'],
  ['Do I have to paste my code over and over?', 'Nope. Paste it once and every tab can see it. When an answer comes back, you can send the improved code straight to the next step — review it, write tests for it, draw a diagram of it.'],
  ['Do you keep my code?', 'No. CodeForge doesn’t save your code or prompts — there are no accounts, our server passes each request straight through without keeping or logging it, and your conversation only lives in your browser tab until you close it. The only thing the server holds is a short-lived request count per visitor, to stop abuse: it’s keyed by a scrambled fingerprint of your IP address (never the address itself), kept in memory and gone within a day. To get an answer, though, your request is sent to OpenRouter and the provider behind the model. CodeForge uses free models, and their providers may keep prompts and use them to train their models — that’s the trade-off for being free. So please don’t paste passwords, secret keys or anything private.'],
  ['Are there limits or rules?', 'A few, to keep the free service fair: a handful of requests per minute and a daily cap per visitor, plus a size limit on what you paste. CodeForge is for coding help — it won’t help build malware or tools for attacking systems you don’t own, though it’s happy to explain how attacks work so you can defend against them. Instructions hidden inside pasted code or logs are treated as text, not commands. These checks catch the obvious cases; they aren’t perfect.'],
  ['Do I need to sign up or install anything?', 'No account and nothing to install. Open the studio and start typing.'],
];

const languages = ['Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'SQL', 'Bash', 'HTML'];

const modes = [
  { icon: Wand2, title: 'Generate', text: 'Plain English in, working code out.' },
  { icon: ScanSearch, title: 'Review', text: 'Bugs, security and performance, by severity.' },
  { icon: BookOpen, title: 'Explain', text: 'A guided walkthrough of unfamiliar code.' },
  { icon: Recycle, title: 'Refactor', text: 'Cleaner structure, identical behaviour.' },
  { icon: ArrowRightLeft, title: 'Convert', text: 'Idiomatic ports between languages.' },
  { icon: FlaskConical, title: 'Write tests', text: 'Edge cases and error paths covered.' },
  { icon: Bug, title: 'Debug', text: 'Root cause, fix, and how to avoid it.' },
  { icon: Workflow, title: 'Diagram', text: 'Flowcharts and sequence diagrams from code.' },
  { icon: Siren, title: 'Error', text: 'Paste a stack trace, get the fix.' },
  { icon: Regex, title: 'Regex', text: 'Describe it, then test it live.' },
];

const why = [
  { icon: Play, title: 'Run it, don’t just read it', text: 'JavaScript, TypeScript and Python run right in your browser. Failures come with a one-click “Fix this error”.' },
  { icon: Cpu, title: 'Switches when a model is busy', text: 'If one free model is overloaded, the request moves to another automatically. Asking the same thing twice in a tab costs nothing.' },
  { icon: Gauge, title: 'No surprise limits', text: 'A live meter shows how many free requests you have left today, straight from OpenRouter.' },
  { icon: ShieldCheck, title: 'Keys stay server-side', text: 'The API key is only on the server, never sent to the browser, and the server only accepts models from its own free list.' },
];

const sections = [
  ['generate', '01 / Generate & run'],
  ['review', '02 / Review & diff'],
  ['visualise', '03 / Visualise'],
  ['streaming', '04 / Why it works'],
  ['languages', '05 / Languages'],
] as const;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('generate');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll reveal for anything marked .cf-reveal.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.cf-reveal');
    if (reduceMotion()) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Section tracker: highlight whichever section crosses the middle of the viewport.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const navLinks = [['#features', 'Features'], ['#how-it-works', 'How it works'], ['#faq', 'FAQ']];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8f8f5] text-[#151719]">
      <header className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${scrolled || menuOpen ? 'border-b border-black/10 bg-[#f8f8f5]/90 text-[#151719] backdrop-blur-xl' : 'bg-transparent text-white'}`}>
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <a href="#top" className="group flex items-center gap-2.5 text-lg font-semibold tracking-[-0.03em]">
            <Sparkles size={19} strokeWidth={2.5} className="transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110" /> CodeForge
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="group relative opacity-75 transition hover:opacity-100">
                {label}
                <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <a href="/app" className="group rounded-full bg-[#111317] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_10px_30px_rgba(0,0,0,.25)]">
              Open Studio <ArrowRight className="ml-1 inline transition-transform group-hover:translate-x-0.5" size={14} />
            </a>
          </div>
          <button className="rounded-full p-2 sm:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menuOpen && (
          <div className="cf-fade-in border-t border-black/10 bg-[#f8f8f5] px-5 py-5 text-[#151719] sm:hidden">
            <div className="flex flex-col gap-4 text-sm font-medium">
              {navLinks.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
              <a href="/app" className="mt-2 w-fit rounded-full bg-[#111317] px-5 py-2.5 text-white">Open Studio <ArrowRight className="ml-1 inline" size={14} /></a>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* ── Hero ── */}
        <section
          className="relative flex min-h-[760px] items-center justify-center overflow-hidden bg-[#2469a9] px-5 pb-40 pt-32 text-center text-white sm:min-h-[820px] sm:pb-48"
        >
          <img src={SKY} alt="Snowy mountain peaks beneath a clear blue sky" className="absolute inset-0 h-full w-full object-cover object-center opacity-90" />
          <div className="absolute inset-0 bg-linear-to-b from-[#0e4377]/40 via-[#267bbb]/20 to-[#0d4b7f]/65" />
          <Clouds />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(7,38,70,.18)_100%)]" />

          <div className="relative z-10 mx-auto max-w-[920px]">
            <p className="cf-fade-in mb-7 text-xs font-semibold uppercase tracking-[0.25em] text-white/75">The calm way to build with AI</p>
            <h1 className="font-display text-[clamp(4rem,10vw,7.4rem)] leading-[.87] tracking-[-0.075em]">
              {['Describe it.', 'Review it.', 'Ship it.'].map((line, i) => (
                <span key={line} className="cf-fade-in block" style={{ animationDelay: `${120 + i * 140}ms` }}>{line}</span>
              ))}
            </h1>
            <p className="cf-fade-in mx-auto mt-8 max-w-[650px] text-base leading-7 text-white/85 sm:text-lg" style={{ animationDelay: '560ms' }}>
              CodeForge turns plain-English prompts into code — then helps you review, diagram, refactor, test and debug it, and run it right in your browser. Powered by free AI models.
            </p>
            <div className="cf-fade-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '680ms' }}>
              <a href="/app" className="group rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#102d4c] shadow-[0_10px_30px_rgba(7,38,70,.25)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(7,38,70,.35)]">
                Open the Studio <ArrowRight className="ml-1 inline transition-transform group-hover:translate-x-1" size={15} />
              </a>
              <a href={REPO} target="_blank" rel="noopener noreferrer" className="group rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-sm font-semibold backdrop-blur-sm transition hover:-translate-y-1 hover:border-white/60 hover:bg-white/20">
                View on GitHub <Github className="ml-1 inline transition-transform duration-500 group-hover:rotate-[360deg]" size={15} />
              </a>
            </div>
            <div className="cf-fade-in" style={{ animationDelay: '820ms' }}>
              <p className="mt-10 text-[10px] font-semibold uppercase tracking-[.24em] text-white/55">Runs on free models</p>
              <ModelTicker />
            </div>
          </div>
        </section>

        {/* ── Live preview ── */}
        <section id="how-it-works" className="relative z-20 mx-auto -mt-36 max-w-[1160px] px-4 sm:-mt-44 sm:px-8">
          <LiveMockup />
        </section>

        {/* ── Features ── */}
        <section id="features" className="mx-auto max-w-[1240px] px-5 pb-28 pt-32 sm:px-8 sm:pb-40 sm:pt-44 lg:px-10">
          <div className="grid gap-14 lg:grid-cols-[180px_1fr] lg:gap-24">
            <div className="lg:sticky lg:top-32 lg:h-fit">
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[.22em] text-black/35">Inside CodeForge</p>
              <div className="flex gap-4 overflow-x-auto pb-2 text-xs font-semibold uppercase tracking-[.13em] lg:block lg:space-y-6 lg:pb-0">
                {sections.map(([id, label]) => (
                  <a key={id} href={`#${id}`} className={`block w-fit whitespace-nowrap border-b-2 pb-1 transition-all duration-300 ${activeSection === id ? 'border-[#151719] text-[#151719] lg:translate-x-1' : 'border-transparent text-black/30 hover:text-black'}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-28 sm:space-y-36">
              <article id="generate" className="scroll-mt-28">
                <div className="cf-reveal">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#267bbb]">Generate & run</p>
                  <h2 className="font-display max-w-[700px] text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Describe it. Then run it.</h2>
                  <p className="mt-7 max-w-[560px] text-base leading-7 text-black/55">Describe what you want in plain English and get clean, commented code back. Then press Run — JavaScript, TypeScript and Python execute right in your browser, so you can check it works before you copy it. Keep going with follow-ups: “add retries”, “make it async”.</p>
                </div>
                <div className="cf-reveal mt-9 rounded-[18px] border border-black/10 bg-white p-5 transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(20,45,70,.10)] sm:p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="text-sm font-semibold">Generated, then run</span>
                    <span className="rounded-full bg-[#edf6fd] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#267bbb]">Generate</span>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl bg-[#f4f4f1] p-5">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-black/35">Prompt</p>
                      <p className="text-sm leading-6 text-black/65">“A function that returns the n-th Fibonacci number, fast for large n. Print the first ten.”</p>
                    </div>
                    <div className="overflow-hidden rounded-xl bg-[#171b20] font-mono text-xs leading-6 text-[#c7d7e0]">
                      <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-2 font-sans text-[10px] uppercase tracking-widest text-white/35">
                        <span>Python</span><span className="flex items-center gap-1 normal-case tracking-normal text-[#7cc597]"><Play size={10} /> Run</span>
                      </div>
                      <p className="px-4 py-3">
                        <span className="text-[#72b5e4]">def</span> <span className="text-[#e7c47a]">fib</span>(n):<br />
                        {'    '}a, b = <span className="text-[#e8a87c]">0</span>, <span className="text-[#e8a87c]">1</span><br />
                        {'    '}<span className="text-[#72b5e4]">for</span> _ <span className="text-[#72b5e4]">in</span> range(n): a, b = b, a + b<br />
                        {'    '}<span className="text-[#72b5e4]">return</span> a
                      </p>
                      <div className="border-t border-white/[.06] bg-black/30 px-4 py-2.5">
                        <p className="font-sans text-[10px] uppercase tracking-widest text-[#7cc597]">✓ Ran in 0.02s</p>
                        <p className="text-[#d2dce3]">0 1 1 2 3 5 8 13 21 34</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article id="review" className="scroll-mt-28">
                <div className="cf-reveal">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#267bbb]">Review & diff</p>
                  <h2 className="font-display max-w-[700px] text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Paste code, get a structured audit.</h2>
                  <p className="mt-7 max-w-[560px] text-base leading-7 text-black/55">Bugs, security, performance and style — ordered by severity, with the fix beside each finding. Rewrites come with a line-by-line diff against your code, and one click carries the improved version into Refactor or Write tests.</p>
                </div>
                <div className="cf-reveal mt-9 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[18px] border border-black/10 bg-white p-5 sm:p-7">
                    <div className="mb-6 flex items-center justify-between">
                      <span className="text-sm font-semibold">Review summary</span>
                      <span className="text-xs text-black/40">4 findings</span>
                    </div>
                    <div className="grid gap-3">
                      <ReviewItem icon="🐛" label="Bugs" text="1 potential issue" color="bg-[#fff1ed] text-[#be634f]" />
                      <ReviewItem icon="🔒" label="Security" text="SQL injection on line 2" color="bg-[#fff1ed] text-[#be634f]" />
                      <ReviewItem icon="⚡" label="Performance" text="2 suggestions" color="bg-[#fff8df] text-[#a27822]" />
                      <ReviewItem icon="✓" label="Best practices" text="Looking good" color="bg-[#edf6fd] text-[#267bbb]" />
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[18px] bg-[#171b20] font-mono text-[12px] leading-[1.8]">
                    <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-3 font-sans text-[10px] uppercase tracking-widest text-white/35">
                      <span>Diff vs. your code</span>
                      <span className="normal-case tracking-normal"><span className="text-[#7cc597]">+2</span> <span className="text-[#f08c7c]">−2</span></span>
                    </div>
                    <div className="py-2">
                      <p className="px-5 text-[#c9d4dc]/80">{'  '}def login(email, password):</p>
                      <p className="bg-[#f08c7c]/[.09] px-5 text-[#f5b3a8]">− user = db.execute(f"…'{'{email}'}'")</p>
                      <p className="bg-[#7cc597]/[.09] px-5 text-[#b9e3c6]">+ user = db.execute("… = %s", (email,))</p>
                      <p className="bg-[#f08c7c]/[.09] px-5 text-[#f5b3a8]">− if user.password == password:</p>
                      <p className="bg-[#7cc597]/[.09] px-5 text-[#b9e3c6]">+ if verify(user.password_hash, password):</p>
                      <p className="px-5 text-[#c9d4dc]/80">{'      '}return create_session(user)</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 border-t border-white/[.06] px-5 py-3 font-sans">
                      {['Refactor it', 'Write tests', 'Diagram it'].map((l) => (
                        <span key={l} className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] text-white/70">{l} →</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article id="visualise" className="scroll-mt-28">
                <div className="cf-reveal">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#267bbb]">Visualise</p>
                  <h2 className="font-display max-w-[700px] text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">See the shape of your code.</h2>
                  <p className="mt-7 max-w-[560px] text-base leading-7 text-black/55">Turn code into a flowchart, sequence or class diagram, exportable as SVG. Describe a pattern and get a regex with a live tester — matches highlight as you type, and runaway patterns are stopped before they freeze the tab.</p>
                </div>
                <div className="cf-reveal mt-9 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[18px] bg-[#171b20] p-5 sm:p-7">
                    <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#79b8e4]">Diagram · Flowchart</p>
                    <div className="flex flex-col items-center gap-2 text-[11px] text-[#e6edf2]">
                      <span className="rounded-md border border-[#267bbb] bg-[#1d2833] px-3 py-1.5">Cart submitted</span>
                      <span className="text-[#79b8e4]">↓</span>
                      <span className="rotate-0 rounded-md border border-[#267bbb] bg-[#1d2833] px-3 py-1.5">Cart empty?</span>
                      <div className="flex w-full max-w-[300px] justify-between text-[#79b8e4]"><span className="pl-8">↙ yes</span><span className="pr-8">no ↘</span></div>
                      <div className="flex w-full max-w-[340px] justify-between gap-3">
                        <span className="rounded-md border border-[#267bbb] bg-[#1d2833] px-3 py-1.5">Return 400</span>
                        <span className="rounded-md border border-[#267bbb] bg-[#1d2833] px-3 py-1.5">Reserve stock</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[18px] bg-[#171b20] p-5 font-mono text-[12px] sm:p-7">
                    <p className="mb-4 font-sans text-[10px] font-bold uppercase tracking-widest text-[#79b8e4]">Regex · Live tester</p>
                    <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"><span className="text-white/30">/</span><span className="text-[#e7c47a]">\b\d{'{4}'}-\d{'{2}'}-\d{'{2}'}\b</span><span className="text-white/30">/</span><span className="text-[#72b5e4]">g</span></p>
                    <p className="mt-3 rounded-lg border border-white/[.06] bg-black/20 p-3 leading-6 text-white/45">
                      Due <mark className="rounded-[3px] bg-[#267bbb]/45 px-px text-white">2026-11-09</mark>, paid <mark className="rounded-[3px] bg-[#267bbb]/45 px-px text-white">2026-12-01</mark>.<br />Not a date: 2026-1-9
                    </p>
                    <p className="mt-3 font-sans text-[11px] text-white/40">2 matches</p>
                  </div>
                </div>
                <div className="cf-reveal mt-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-black/35">All ten modes</p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                    {modes.map((m) => (
                      <a key={m.title} href="/app" className="group rounded-xl border border-black/10 bg-white p-4 transition duration-300 hover:-translate-y-1 hover:border-[#267bbb]/30 hover:shadow-[0_16px_40px_rgba(20,45,70,.08)]">
                        <m.icon size={16} className="text-black/40 transition-colors group-hover:text-[#267bbb]" />
                        <p className="mt-3 text-sm font-semibold">{m.title}</p>
                        <p className="mt-1 text-xs leading-5 text-black/45">{m.text}</p>
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Why ── */}
        <section id="streaming" className="scroll-mt-20 border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[1240px] gap-16 px-5 py-28 sm:px-8 sm:py-36 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-10">
            <div className="cf-reveal">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">Why CodeForge</p>
              <h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Free models,<br />without the fine print.</h2>
              <p className="mt-7 max-w-[450px] text-base leading-7 text-black/55">Free models are rate-limited and uneven. CodeForge works around that for you — switching models when one is busy, caching repeats, and showing exactly how much of today’s allowance is left. No install, no account.</p>
              <a href="/app" className="group mt-8 inline-block rounded-full bg-[#111317] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(0,0,0,.2)]">
                Try it now <ArrowRight className="ml-1 inline transition-transform group-hover:translate-x-1" size={15} />
              </a>
            </div>
            <div className="cf-reveal grid border border-black/10 sm:grid-cols-2">
              {why.map((w, index) => (
                <div key={w.title} className={`group p-6 transition-colors duration-300 hover:bg-[#fafaf8] sm:p-8 ${index < 2 ? 'border-b' : ''} ${index % 2 === 0 ? 'sm:border-r' : ''} border-black/10`}>
                  <div className="mb-10 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f1ee] text-[#267bbb] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-6deg] group-hover:bg-[#267bbb] group-hover:text-white">
                    <w.icon size={16} />
                  </div>
                  <h3 className="text-base font-semibold">{w.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-black/50">{w.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Languages ── */}
        <section id="languages" className="mx-auto max-w-[1240px] scroll-mt-20 px-5 py-28 sm:px-8 sm:py-36 lg:px-10">
          <div className="cf-reveal flex flex-col justify-between gap-8 border-b border-black/10 pb-12 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">Made for your stack</p>
              <h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">One prompt.<br />Every language.</h2>
            </div>
            <p className="max-w-[350px] text-sm leading-6 text-black/50">Generate, review and explain in fifteen languages, move code between them with Convert — and run JavaScript, TypeScript and Python on the spot.</p>
          </div>
          <div className="cf-reveal mt-8 flex flex-wrap gap-2">
            {languages.map((language, i) => (
              <span key={language} style={{ transitionDelay: `${i * 18}ms` }} className="cursor-default rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-black/65 transition duration-300 hover:-translate-y-1 hover:border-[#267bbb]/40 hover:text-[#267bbb] hover:shadow-[0_10px_24px_rgba(38,123,187,.12)]">
                {language}
              </span>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="scroll-mt-20 bg-[#efefeb] px-5 py-28 sm:px-8 sm:py-36">
          <div className="mx-auto grid max-w-[1080px] gap-14 lg:grid-cols-[.75fr_1.25fr] lg:gap-24">
            <div className="cf-reveal">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">FAQ</p>
              <h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Questions<br />& answers.</h2>
            </div>
            <div className="cf-reveal">
              {faqs.map(([question, answer], index) => {
                const open = activeFaq === index;
                return (
                  <div key={question} className="border-t border-black/15">
                    <button onClick={() => setActiveFaq(open ? null : index)} className="group flex w-full items-center justify-between py-5 text-left text-sm font-semibold sm:text-base" aria-expanded={open}>
                      <span className="transition-transform duration-300 group-hover:translate-x-1">{question}</span>
                      <ChevronDown size={17} className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-400 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <p className="max-w-[610px] overflow-hidden pr-8 text-sm leading-6 text-black/55">
                        <span className="block pb-6">{answer}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0b0d10] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-14 border-b border-white/10 pb-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <a href="#top" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-.03em]"><Sparkles size={19} /> CodeForge</a>
              <p className="mt-5 max-w-[270px] text-sm leading-6 text-white/45">A free AI code workbench — where answers get run, not just read.</p>
            </div>
            <FooterColumn title="Product" links={[['Studio', '/app'], ['Features', '#features'], ['FAQ', '#faq']]} />
            <FooterColumn title="Project" links={[['GitHub', REPO], ['Report an issue', `${REPO}/issues`]]} />
          </div>
          <div className="flex flex-col gap-3 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} CodeForge</span>
            <span className="flex items-center gap-2">Built for clearer thinking <ArrowDownRight size={13} /></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ReviewItem({ icon, label, text, color }: { icon: string; label: string; text: string; color: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-[#fafaf8] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(20,45,70,.08)]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-transform duration-300 group-hover:scale-110 ${color}`}>{icon === '✓' ? <Check size={16} /> : icon}</span>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-black/40">{text}</p>
      </div>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">{title}</p>
      <div className="mt-5 space-y-3 text-sm text-white/60">
        {links.map(([label, href]) => (
          <a key={label} href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="block w-fit transition hover:translate-x-1 hover:text-white">{label}</a>
        ))}
      </div>
    </div>
  );
}

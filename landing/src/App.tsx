import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Github,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

const mountainImage = 'https://images.pexels.com/photos/35636373/pexels-photo-35636373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const faqs = [
  ['What models does CodeForge support?', 'CodeForge currently supports Groq with Llama 3.3 70B for fast generation, and OpenRouter with Nemotron 120B for deeper reasoning. You can switch between them whenever you like.'],
  ['Do I need to run this locally, or is there a hosted version?', 'The live demo is hosted on Render, so your team can start using CodeForge from any browser. You can also deploy your own instance when you want full control.'],
  ['Is my code or prompt data stored anywhere?', 'No. Prompts and code are processed for the request and are not saved as part of this marketing demo.'],
  ['Can I switch models mid-session?', 'Yes. Choose a different model badge at the top of the workspace and your next response will use that provider.'],
  ['What languages can I generate or review?', 'CodeForge supports Python, JavaScript, TypeScript, Rust, Go, Java, C++, C#, PHP, Ruby, Swift, Kotlin, SQL, Bash, and HTML.'],
];

const languages = ['Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'SQL', 'Bash', 'HTML'];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f8f5] text-[#151719]">
      <header className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-black/10 bg-[#f8f8f5]/95 text-[#151719] backdrop-blur-xl' : 'bg-transparent text-white'}`}>
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <a href="#top" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.03em]">
            <Sparkles size={19} strokeWidth={2.5} /> CodeForge
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#features" className="opacity-75 transition hover:opacity-100">Features</a>
            <a href="#how-it-works" className="opacity-75 transition hover:opacity-100">How it works</a>
            <a href="#faq" className="opacity-75 transition hover:opacity-100">Docs</a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <a href="https://codeforge-ai-code-studio.onrender.com" className="rounded-full bg-[#111317] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black">Try Live Demo <ArrowRight className="ml-1 inline" size={14} /></a>
          </div>
          <button className="rounded-full p-2 sm:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menuOpen && <div className="border-t border-black/10 bg-[#f8f8f5] px-5 py-5 text-[#151719] sm:hidden"><div className="flex flex-col gap-4 text-sm font-medium"><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#faq" onClick={() => setMenuOpen(false)}>Docs</a><a href="https://codeforge-ai-code-studio.onrender.com" className="mt-2 w-fit rounded-full bg-[#111317] px-5 py-2.5 text-white">Try Live Demo <ArrowRight className="ml-1 inline" size={14} /></a></div></div>}
      </header>

      <main id="top">
        <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden bg-[#2469a9] px-5 pb-40 pt-32 text-center text-white sm:min-h-[820px] sm:pb-48">
          <img src={mountainImage} alt="Snowy mountain peaks beneath a clear blue sky" className="absolute inset-0 h-full w-full object-cover object-center opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e4377]/40 via-[#267bbb]/20 to-[#0d4b7f]/65" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(7,38,70,.18)_100%)]" />
          <div className="relative z-10 mx-auto max-w-[920px]">
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.25em] text-white/75">The calm way to build with AI</p>
            <h1 className="font-display text-[clamp(4rem,10vw,7.4rem)] leading-[.87] tracking-[-0.075em]">Describe it.<br />Review it.<br />Ship it.</h1>
            <p className="mx-auto mt-8 max-w-[650px] text-base leading-7 text-white/85 sm:text-lg">CodeForge turns plain-English prompts into clean, working code — and turns any codebase into a structured AI review. Powered by Llama 3.3 70B and Nemotron 120B, streamed to you in real time.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><a href="https://codeforge-ai-code-studio.onrender.com" className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#102d4c] transition hover:-translate-y-1 hover:bg-white/90">Try Live Demo <ArrowRight className="ml-1 inline" size={15} /></a><a href="https://github.com/saiharsh11/CodeForge-AI-Code-Studio" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:-translate-y-1 hover:bg-white/20">View on GitHub <Github className="ml-1 inline" size={15} /></a></div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/65"><span>Works with</span><span className="flex items-center gap-1.5"><Zap size={13} /> Groq</span><span className="flex items-center gap-1.5"><Sparkles size={13} /> OpenRouter</span><span>15 languages</span></div>
          </div>
        </section>

        <section id="how-it-works" className="relative z-20 mx-auto -mt-36 max-w-[1160px] px-4 sm:-mt-44 sm:px-8">
          <div className="overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(20,45,70,.18)]">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 sm:px-6"><div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#e5e5e3]" /><i className="h-2.5 w-2.5 rounded-full bg-[#e5e5e3]" /><i className="h-2.5 w-2.5 rounded-full bg-[#e5e5e3]" /></div><div className="hidden rounded-md bg-[#f4f4f2] px-4 py-1 text-[10px] text-black/40 sm:block">codeforge-ai-code-studio.onrender.com</div><div className="w-10" /></div>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 sm:px-7"><div className="flex gap-5 text-xs font-semibold"><span className="border-b-2 border-[#267bbb] pb-4 text-[#267bbb]">Generate</span><span className="text-black/35">Review</span></div><div className="hidden gap-2 sm:flex"><span className="rounded-md border border-[#267bbb]/30 bg-[#edf6fd] px-3 py-1.5 text-[10px] font-medium text-[#236aa3]">Groq · Llama 3.3 70B</span><span className="rounded-md border border-black/10 px-3 py-1.5 text-[10px] text-black/45">OpenRouter · Nemotron 120B</span></div><Code2 size={16} className="text-black/30 sm:hidden" /></div>
            <div className="grid md:grid-cols-[.85fr_1.15fr]"><div className="border-b border-black/10 p-5 sm:p-7 md:border-b-0 md:border-r"><div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">Your prompt</span><span className="text-[10px] text-black/30">0 / 2,000</span></div><div className="min-h-[190px] rounded-xl border border-black/10 bg-[#fcfcfb] p-4 text-sm text-black/35">Build a debounce hook in React<span className="ml-1 inline-block h-4 w-px animate-pulse bg-[#267bbb] align-middle" /></div><div className="mt-4 flex items-center justify-between"><span className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/45">TypeScript <ChevronDown className="ml-4 inline" size={12} /></span><button className="rounded-lg bg-[#111317] px-4 py-2 text-xs font-semibold text-white">Generate <ArrowRight className="ml-1 inline" size={12} /></button></div></div><div className="bg-[#171b20] p-5 text-[11px] leading-[1.8] text-[#d2dce3] sm:p-7 sm:text-xs"><div className="mb-5 flex items-center justify-between text-[10px] text-white/35"><span>useDebounce.ts</span><span className="text-[#79b8e4]">streaming...</span></div><div><span className="text-[#72b5e4]">import</span> {'{ useEffect, useState }'} <span className="text-[#72b5e4]">from</span> <span className="text-[#b7d58d]">'react'</span>;<br /><br /><span className="text-[#72b5e4]">export function</span> <span className="text-[#e7c47a]">useDebounce</span>&lt;T&gt;(<span className="text-[#e7c47a]">value</span>: T, <span className="text-[#e7c47a]">delay</span>: <span className="text-[#72b5e4]">number</span>) {'{'}<br /><span className="text-white/35">{'  '}const [debounced, setDebounced] = useState(value);</span><br /><br /><span className="text-white/35">{'  '}useEffect(() =&gt; {'{'}</span><br /><span className="text-white/35">{'    '}const timer = setTimeout(() =&gt; setDebounced(value), delay);</span><br /><span className="text-white/35">{'    '}return () =&gt; clearTimeout(timer);</span><br /><span className="text-white/35">{'  }'}, [value, delay]);</span><br /><br /><span className="text-[#72b5e4]">{'  '}return</span> debounced;<br />{'}'}<span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#79b8e4] align-middle" /></div></div></div><div className="flex items-center justify-between border-t border-black/10 bg-[#fcfcfb] px-5 py-3 text-[10px] text-black/35 sm:px-7"><span>1,248 tokens · 1.8s</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#56aa75]" /> Llama 3.3 70B · Groq</span></div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1240px] px-5 pb-28 pt-32 sm:px-8 sm:pb-40 sm:pt-44 lg:px-10"><div className="grid gap-14 lg:grid-cols-[180px_1fr] lg:gap-24"><div className="lg:sticky lg:top-32 lg:h-fit"><p className="mb-5 text-[10px] font-bold uppercase tracking-[.22em] text-black/35">Inside CodeForge</p><div className="flex gap-4 overflow-x-auto pb-2 text-xs font-semibold uppercase tracking-[.13em] text-black/30 lg:block lg:space-y-6 lg:pb-0"><a href="#generate" className="block w-fit whitespace-nowrap border-b-2 border-[#151719] pb-1 text-[#151719]">01 / Generate</a><a href="#review" className="block w-fit whitespace-nowrap border-b-2 border-transparent pb-1 text-black/30 transition hover:text-black">02 / Review</a><a href="#streaming" className="block w-fit whitespace-nowrap border-b-2 border-transparent pb-1 text-black/30 transition hover:text-black">03 / Streaming</a><a href="#languages" className="block w-fit whitespace-nowrap border-b-2 border-transparent pb-1 text-black/30 transition hover:text-black">04 / Languages</a></div></div><div className="space-y-28 sm:space-y-36"><article id="generate"><p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#267bbb]">Generate</p><h2 className="font-display max-w-[700px] text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Describe it in plain English.</h2><p className="mt-7 max-w-[560px] text-base leading-7 text-black/55">Pick a language, describe what you want to build, and get clean, commented code back — no boilerplate hunting. CodeForge gives your idea a dependable first draft.</p><div className="mt-9 rounded-[18px] border border-black/10 bg-white p-5 sm:p-8"><div className="mb-8 flex items-center justify-between"><span className="text-sm font-semibold">A better starting point</span><span className="rounded-full bg-[#edf6fd] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#267bbb]">Generate</span></div><div className="grid gap-5 md:grid-cols-2"><div className="rounded-xl bg-[#f4f4f1] p-5"><p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-black/35">Prompt</p><p className="text-sm leading-6 text-black/65">“Create a typed utility that retries a failed fetch request three times with exponential backoff.”</p></div><div className="rounded-xl bg-[#171b20] p-5 font-mono text-xs leading-6 text-[#c7d7e0]"><p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-widest text-white/35">Output</p><p><span className="text-[#72b5e4]">async function</span> retry&lt;T&gt;()<br />{'  '}<span className="text-[#b7d58d]">{'// clean, ready-to-use code'}</span></p></div></div></div></article><article id="review"><p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#267bbb]">Review</p><h2 className="font-display max-w-[700px] text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Paste code, get a structured audit.</h2><p className="mt-7 max-w-[560px] text-base leading-7 text-black/55">CodeForge reviews any snippet for bugs, security issues, performance problems, and style — the same way a senior engineer would.</p><div className="mt-9 rounded-[18px] border border-black/10 bg-white p-5 sm:p-8"><div className="mb-6 flex items-center justify-between"><span className="text-sm font-semibold">Review summary</span><span className="text-xs text-black/40">4 findings</span></div><div className="grid gap-3 sm:grid-cols-2"><ReviewItem icon="🐛" label="Bugs" text="1 potential issue" color="bg-[#fff1ed] text-[#be634f]" /><ReviewItem icon="🔒" label="Security" text="No vulnerabilities" color="bg-[#eef8f1] text-[#4b9568]" /><ReviewItem icon="⚡" label="Performance" text="2 suggestions" color="bg-[#fff8df] text-[#a27822]" /><ReviewItem icon="✓" label="Best practices" text="Looking good" color="bg-[#edf6fd] text-[#267bbb]" /></div></div></article></div></div></section>

        <section id="streaming" className="border-y border-black/10 bg-white"><div className="mx-auto grid max-w-[1240px] gap-16 px-5 py-28 sm:px-8 sm:py-36 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-10"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">Why CodeForge</p><h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">No lock-in.<br />No local setup fatigue.</h2><p className="mt-7 max-w-[450px] text-base leading-7 text-black/55">CodeForge proxies Groq and OpenRouter server-side, so your API keys never touch the browser. Deploy it once on Render and every teammate gets instant access.</p><a href="https://codeforge-ai-code-studio.onrender.com" className="mt-8 inline-block rounded-full bg-[#111317] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-1">Try it now <ArrowRight className="ml-1 inline" size={15} /></a></div><div className="grid border border-black/10 sm:grid-cols-2">{[['Real-time streaming','Responses stream token by token over SSE, no waiting for the full response.'],['Dual AI models',"Switch instantly between Groq's Llama 3.3 70B for speed and OpenRouter's Nemotron 120B for deeper reasoning."],['15 languages','Python, JS, TS, Rust, Go, Java, C++, C#, PHP, Ruby, Swift, Kotlin, SQL, Bash, HTML.'],['Secure by design','API keys live only in server-side configuration — never exposed to the client.']].map(([title, text], index) => <div key={title} className={`p-6 sm:p-8 ${index < 2 ? 'border-b' : ''} ${index % 2 === 0 ? 'sm:border-r' : ''} border-black/10`}><div className="mb-10 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f1ee] text-[#267bbb]">{index === 0 ? <Zap size={16} /> : index === 1 ? <Sparkles size={16} /> : index === 2 ? <Code2 size={16} /> : <ShieldCheck size={16} />}</div><h3 className="text-base font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-black/50">{text}</p></div>)}</div></div></section>

        <section id="languages" className="mx-auto max-w-[1240px] px-5 py-28 sm:px-8 sm:py-36 lg:px-10"><div className="flex flex-col justify-between gap-8 border-b border-black/10 pb-12 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">Made for your stack</p><h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">One prompt.<br />Every language.</h2></div><p className="max-w-[350px] text-sm leading-6 text-black/50">From a quick script to a production service, keep your workflow moving without changing tools.</p></div><div className="mt-8 flex flex-wrap gap-2">{languages.map((language) => <span key={language} className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-black/65 transition hover:border-[#267bbb]/40 hover:text-[#267bbb]">{language}</span>)}</div></section>

        <section id="faq" className="bg-[#efefeb] px-5 py-28 sm:px-8 sm:py-36"><div className="mx-auto grid max-w-[1080px] gap-14 lg:grid-cols-[.75fr_1.25fr] lg:gap-24"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-black/35">FAQ</p><h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-7xl">Questions<br />& answers.</h2></div><div>{faqs.map(([question, answer], index) => <div key={question} className="border-t border-black/15"><button onClick={() => setActiveFaq(activeFaq === index ? null : index)} className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold sm:text-base"><span>{question}</span><ChevronDown size={17} className={`shrink-0 transition-transform ${activeFaq === index ? 'rotate-180' : ''}`} /></button>{activeFaq === index && <p className="max-w-[610px] pb-6 pr-8 text-sm leading-6 text-black/55">{answer}</p>}</div>)}</div></div></section>
      </main>

      <footer className="bg-[#0b0d10] px-5 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto max-w-[1240px]"><div className="grid gap-14 border-b border-white/10 pb-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"><div><a href="#top" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-.03em]"><Sparkles size={19} /> CodeForge</a><p className="mt-5 max-w-[270px] text-sm leading-6 text-white/45">AI code generation and review, streamed in real time.</p></div><FooterColumn title="Product" links={['Features', 'Live Demo', 'Changelog']} /><FooterColumn title="Company" links={['About']} /></div><div className="flex flex-col gap-3 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 CodeForge</span><span className="flex items-center gap-2">Built for clearer thinking <ArrowDownRight size={13} /></span></div></div></footer>
    </div>
  );
}

function ReviewItem({ icon, label, text, color }: { icon: string; label: string; text: string; color: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-[#fafaf8] p-4"><span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${color}`}>{icon === '✓' ? <Check size={16} /> : icon}</span><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-black/40">{text}</p></div></div>;
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">{title}</p><div className="mt-5 space-y-3 text-sm text-white/60">{links.map((link) => <a href={link === 'Live Demo' ? 'https://codeforge-ai-code-studio.onrender.com' : '#top'} key={link} className="block transition hover:text-white">{link}</a>)}</div></div>;
}

export default App;

<div align="center">

# ⚡ CodeForge
### AI-Powered Code Generator & Reviewer

# Link : https://code-forge-ai-code-studio.vercel.app/

<p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

<p>
  <img src="https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenRouter-6366F1?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Llama_3.3_70B-0467DF?style=for-the-badge&logo=meta&logoColor=white" />
  <img src="https://img.shields.io/badge/Nemotron_120B-76B900?style=for-the-badge&logo=nvidia&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" />
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=flat-square" />
  <img src="https://img.shields.io/badge/Local-Only-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Free_Tier-Supported-blue?style=flat-square" />
</p>

<br/>

> **CodeForge** is a locally-hosted, full-stack web application that gives you instant access to two powerful AI language models for generating and reviewing source code — all running privately on your own machine.

<br/>

![CodeForge Preview](https://placehold.co/900x500/09090b/6366f1?text=CodeForge+%E2%80%94+AI+Code+Studio&font=inter)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| ✍️ **Code Generator** | Describe what you want in plain English → get clean, commented code |
| 🔍 **Code Reviewer** | Paste any code → get a structured AI review with bugs, security issues & fixes |
| ⚡ **Real-Time Streaming** | Responses stream token by token — no waiting for the full output |
| 🤖 **Dual AI Models** | Switch between **Llama 3.3 70B** (Groq) and **Nemotron 120B** (OpenRouter) |
| 🎨 **Syntax Highlighting** | Auto-highlighted code output using highlight.js |
| 📋 **Copy & Download** | Copy to clipboard or download as a proper source file |
| 🌐 **15 Languages** | Python, JS, TS, Rust, Go, Java, C++, C#, PHP, Ruby, Swift, Kotlin, SQL, Bash, HTML |
| 🔒 **Secure by Design** | API keys never exposed to the browser — stored only in `.env` |

---

## 🖥️ Preview

<div align="center">

### Code Generator
![Generator Tab](https://placehold.co/860x420/09090b/a5b4fc?text=Generate+Tab+%E2%80%94+Describe+%E2%86%92+Get+Code&font=inter)

### Code Reviewer
![Review Tab](https://placehold.co/860x420/09090b/86efac?text=Review+Tab+%E2%80%94+Paste+Code+%E2%86%92+Get+AI+Review&font=inter)

</div>

---

## 🛠️ Tech Stack

### Backend
- **[Node.js](https://nodejs.org)** — JavaScript runtime
- **[Express.js](https://expressjs.com)** — HTTP server & routing
- **[dotenv](https://npmjs.com/package/dotenv)** — Secure API key management
- **Node `https` module** — Built-in HTTP client (no extra dependencies)

### Frontend
- **HTML5 + Vanilla JavaScript** — Zero framework overhead
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling via CDN
- **[highlight.js](https://highlightjs.org)** — Syntax highlighting for 20+ languages
- **[JetBrains Mono](https://jetbrains.com/mono)** + **[Inter](https://rsms.me/inter)** — Fonts

### AI / APIs
- **[Groq](https://groq.com)** — Ultra-fast LPU inference (200+ tokens/sec)
- **[OpenRouter](https://openrouter.ai)** — Unified API gateway for multiple AI models

### AI Models
| Model | Provider | Parameters | Strength |
|---|---|---|---|
| Llama 3.3 70B Versatile | Meta via Groq | 70B | Blazing fast, great for quick generation |
| NVIDIA Nemotron 120B | NVIDIA via OpenRouter | 120B | Deeper reasoning, complex reviews |

---

## 📁 Project Structure

```
code-app/
├── server.js          # Express backend — API proxy + SSE streaming
├── .env               # 🔒 Secret API keys (never commit this!)
├── .env.example       # Safe template showing required keys
├── package.json       # Dependencies & scripts
├── start.bat          # One-click Windows launcher
└── public/
    └── index.html     # Complete UI — HTML + CSS + JS in one file
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v12 or higher
- A free [Groq](https://console.groq.com) account → get your API key
- A free [OpenRouter](https://openrouter.ai) account → get your API key

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/codeforge.git
cd codeforge
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up your API keys**
```bash
# Copy the example file
cp .env.example .env

# Open .env and fill in your keys
GROQ_API_KEY=your_groq_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
```

**4. Start the app**

**Windows** — double-click `start.bat`

**Or manually:**
```bash
node server.js
```

**5. Open in browser**
```
http://localhost:3000
```

> ⚠️ Keep the terminal window open while using the app. Closing it stops the server.

---

## 💡 Usage

### Generating Code
1. Go to the **Generate** tab
2. Select a **programming language**
3. Choose a **model** (Llama or Nemotron)
4. Describe what you want to build
5. Click **Generate Code** or press `Ctrl+Enter`

### Reviewing Code
1. Go to the **Review** tab
2. Paste your code into the left panel
3. Select the **language** and **model**
4. Click **Review Code** or press `Ctrl+Enter`
5. Get a structured review covering:
   - 🐛 Bugs & logic errors
   - 🔒 Security vulnerabilities
   - ⚡ Performance issues
   - 🎨 Code quality & readability
   - ✅ Best practices

### Keyboard Shortcut
| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Generate or Review (works from anywhere) |

---

## 🔒 Security

- ✅ API keys are stored in `.env` — **never exposed to the browser**
- ✅ App runs on `localhost` — **not accessible from the internet**
- ✅ No data is logged or stored — **everything is ephemeral**
- ⚠️ Prompts are sent to Groq/OpenRouter servers for AI processing
- ⚠️ Never commit your `.env` file — it's listed in `.gitignore`

---

## 🗺️ Roadmap

- [ ] Conversation history (multi-turn generation)
- [ ] Monaco Editor integration (VS Code-like editing)
- [ ] More models (Claude, GPT-4o, DeepSeek)
- [ ] Session history sidebar
- [ ] File upload for code review
- [ ] Export reviews as PDF

---



---

<div align="center">

Built with ⚡ using **Node.js**, **Groq**, and **OpenRouter**

</div>

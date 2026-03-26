require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = process.env.PORT || 3000;

// Works on Node 12+ using built-in https module (no fetch needed)
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      resolve(res); // return the raw stream
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { model, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  let hostname, apiPath, apiKey, modelId, extraHeaders = {};

  if (model === 'groq') {
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'Groq API key not configured.' });
    hostname = 'api.groq.com';
    apiPath = '/openai/v1/chat/completions';
    apiKey = GROQ_API_KEY;
    modelId = 'llama-3.3-70b-versatile';
  } else {
    if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OpenRouter API key not configured.' });
    hostname = 'openrouter.ai';
    apiPath = '/api/v1/chat/completions';
    apiKey = OPENROUTER_API_KEY;
    modelId = 'nvidia/nemotron-3-super-120b-a12b:free';
    extraHeaders = {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'CodeForge'
    };
  }

  try {
    const apiRes = await httpsPost(
      hostname,
      apiPath,
      { 'Authorization': `Bearer ${apiKey}`, ...extraHeaders },
      { model: modelId, messages, stream: true, temperature: 0.7, max_tokens: 4096 }
    );

    if (apiRes.statusCode !== 200) {
      let errBody = '';
      apiRes.on('data', chunk => errBody += chunk);
      apiRes.on('end', () => {
        console.error(`[API Error ${apiRes.statusCode}]`, errBody);
        if (!res.headersSent) {
          res.status(apiRes.statusCode).json({ error: `API returned ${apiRes.statusCode}. Check your keys or rate limits.` });
        }
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    apiRes.on('data', chunk => res.write(chunk));
    apiRes.on('end', () => res.end());
    apiRes.on('error', err => {
      console.error('[Stream Error]', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

  } catch (err) {
    console.error('[Server Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    groq: !!GROQ_API_KEY,
    openrouter: !!OPENROUTER_API_KEY
  });
});

app.listen(PORT, () => {
  console.log('\n  ╔════════════════════════════════════╗');
  console.log('  ║   🔥  CodeForge is running!        ║');
  console.log(`  ║   👉  http://localhost:${PORT}          ║`);
  console.log('  ║   Press Ctrl+C to stop             ║');
  console.log('  ╚════════════════════════════════════╝\n');
});

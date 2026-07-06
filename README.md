# Diptyque Demo

## Modes

### GitHub Pages static demo
- Set `DEPLOY_TARGET=github-pages` when building for GitHub Pages
- Uses static assets under `public/`
- Does not call real DeepSeek safely
- Falls back to merged `retrieval-test-results.json` + `answer-test-results.json`

### Local / backend demo
- Frontend calls `/api/ask`
- Node server serves both UI and ask API
- Server reads env vars from `.env`
- Can use `ANSWER_PROVIDER=deepseek`
- Recommended model: `DEEPSEEK_MODEL=deepseek-v4-flash`

## Local env example

Copy `.env.example` to `.env` and set:

```env
ANSWER_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

Do not commit `.env`.

## Run locally

```bash
npm run dev
```

or production-like local run:

```bash
npm run build
npm run start
```

## Deploy online

Recommended: deploy as a Node Web Service, not static hosting only.

Required env vars:
- `ANSWER_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY=...`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL=deepseek-v4-flash`

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start
```

The service serves:
- static UI from `dist/`
- `/api/ask` from the Node backend

## Notes
- The static site should never expose the real API key.
- DeepSeek is only a retrieval-bounded answer layer. It must not invent products or relations outside retrieval results.

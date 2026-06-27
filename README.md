# Memorwise

An open-source, local-first alternative to NotebookLM. Drop in PDFs, images, audio, video, URLs, or YouTube links. Memorwise chunks and embeds them on your machine, then lets you chat with the material using the LLM provider you prefer.

## Get Started

```bash
npx memorwise
```

That's it. The installer clones the repo, installs dependencies, starts the server, and opens your browser to **http://localhost:4747**. Head to **Settings** (gear icon), connect at least one LLM provider, create a notebook, add sources, and start chatting.

You can also visit **[local.memorwise.com](http://local.memorwise.com)** — it auto-detects and redirects to your running instance.

**Requirements:** Node.js 22.13+ or 24+ and git

**Prefer to do it manually?**
```bash
git clone https://github.com/robzilla1738/Memorwise.git
cd Memorwise
npm install
npm run dev
```

Then open **http://localhost:4747**.

## Connecting an LLM Provider

Open Settings → **Providers**. Pick at least one — you can always add more later.

| Provider | Setup |
|----------|-------|
| **Ollama** | [Install Ollama](https://ollama.com), run `ollama serve`, then `ollama pull llama3.1` |
| **LM Studio** | [Download LM Studio](https://lmstudio.ai), load a model, start the local server |
| **OpenAI** | Paste your API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Paste your API key from [console.anthropic.com](https://console.anthropic.com) |
| **Gemini** | Paste your API key from [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Groq** | Paste your API key from [console.groq.com](https://console.groq.com) |
| **Mistral** | Paste your API key from [console.mistral.ai](https://console.mistral.ai) |
| **OpenRouter** | Paste your API key from [openrouter.ai](https://openrouter.ai/keys) |

**Mix and match providers per task** — use whatever combination makes sense for you:
- **Chat** — Any provider (e.g., OpenAI GPT-5.4, Claude, local Ollama model)
- **Embeddings** — Local model recommended (e.g., Ollama `nomic-embed-text`)
- **Transcription** — OpenAI Whisper, Groq Whisper, or Local Whisper
- **Text-to-Speech** — OpenAI voices or Kokoro (local, free)

## What You Can Do

- **Chat with your documents** — RAG-powered Q&A with source citations
- **8 LLM providers** — Ollama, OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, LM Studio
- **20+ file formats** — PDF, DOCX, XLSX, images (OCR), audio/video (Whisper), URLs, YouTube
- **Knowledge graph** — AI-extracted concepts showing how your sources connect
- **Study tools** — Flashcards, quizzes, study guides, and summaries, all saved per notebook
- **Audio overview** — Generate a podcast-style multi-speaker discussion from your documents
- **Source-focused chat** — Drill into a single source for deeper conversation
- **Notes** — Markdown editor with backlinks and templates
- **Per-task providers** — Different models for chat, embeddings, transcription, and TTS
- **Completely local** — All data lives on your machine. No cloud. No account.

## Adding Sources

| Source type | How |
|------------|-----|
| **Files** | Click "+ Add sources" and select files (PDF, DOCX, images, audio, video) |
| **URLs** | Paste any web URL into the URL input |
| **YouTube** | Paste a YouTube link (transcript is pulled automatically) |

Sources are chunked, embedded, and indexed on upload. Images go through local OCR via Tesseract.js. Audio and video are transcribed with Whisper.

## Safety Limits

Memorwise runs locally, but imported content is still treated as untrusted.

- URL imports only fetch public `http` or `https` addresses. Localhost, private networks, link-local addresses, and IPv4-in-IPv6 private forms are blocked.
- File uploads stream to disk and are capped at 500MB per file.
- PDF text extraction is capped at 50MB because the parser needs an in-memory buffer.
- Chat context reads use bounded file prefixes, so a large source cannot force an oversized context buffer.
- Kokoro TTS listens on `127.0.0.1` by default. Its request body and text length are capped. Use `KOKORO_HOST` or `KOKORO_MAX_TEXT_CHARS` only when you need to change that behavior.

## Optional Dependencies

Everything below is optional — only install what you need:

| Tool | What it enables | Install |
|------|----------------|---------|
| **Ollama** | Run LLMs locally | [ollama.com](https://ollama.com) |
| **LM Studio** | Run LLMs locally (GUI) | [lmstudio.ai](https://lmstudio.ai) |
| **ffmpeg** | Video file transcription | `brew install ffmpeg` (macOS) / `apt install ffmpeg` (Linux) / `choco install ffmpeg` (Windows) |
| **espeak-ng** | Kokoro local TTS | `brew install espeak-ng` (macOS) / `apt install espeak-ng` (Linux) / [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases) (Windows) |

## Data Storage

All your data stays local in `.memorwise/` at the project root:

```
.memorwise/
├── memorwise.db     — SQLite database
├── lancedb/         — Vector embeddings
├── sources/         — Uploaded files
└── whisper-models/  — Local Whisper models (if used)
```

Want to store data somewhere else? Set the `MEMORWISE_DATA_DIR` environment variable:
```bash
MEMORWISE_DATA_DIR=/path/to/data npm run dev
```

## Local TTS with Kokoro (Optional)

Kokoro is a small (82M parameter) text-to-speech model that runs on your machine. It powers Audio Overview when you want generated podcast audio without an OpenAI key.

**Quick setup:**
```bash
./scripts/setup-kokoro.sh
```

This handles Python 3.12, espeak-ng, the virtual environment, and all dependencies.

<details>
<summary>Manual setup</summary>

```bash
# 1. Install Python 3.12 (Kokoro doesn't support 3.13 yet)
brew install python@3.12          # macOS
# sudo apt install python3.12     # Linux

# 2. Install espeak-ng
brew install espeak-ng             # macOS
# sudo apt install espeak-ng      # Linux

# 3. Create a virtual environment
python3.12 -m venv .kokoro-venv

# 4. Install dependencies
source .kokoro-venv/bin/activate
pip install kokoro>=0.9.2 soundfile flask
```
</details>

**Start the Kokoro server:**
```bash
source .kokoro-venv/bin/activate
python scripts/kokoro-server.py
```

Then in Memorwise: Settings → **Audio** → **Kokoro (Local)** → pick a voice → generate an Audio Overview.

> Kokoro runs in a separate terminal. You only need it when generating audio.

---

## Desktop App (Optional)

Add Memorwise to your Dock/app menu so you can launch it with a click:

```bash
./scripts/create-desktop-app.sh
```

**macOS:** Creates `Memorwise.app` in `/Applications`. Drag it to your Dock.
**Linux:** Creates a `.desktop` launcher in your app menu.

The app automatically starts the server if it's not already running, waits for it to be ready, then opens your browser.

---

## MCP Server (Claude Code / Cursor / Codex)

Memorwise ships with an MCP server so AI coding assistants can read, search, and interact with your notebooks directly.

**Claude Code** — add to `~/.claude.json` or `.claude/settings.json`:
```json
{
  "mcpServers": {
    "memorwise": {
      "command": "node",
      "args": ["/path/to/memorwise/mcp-server.js"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "memorwise": {
      "command": "node",
      "args": ["/path/to/memorwise/mcp-server.js"]
    }
  }
}
```

**Codex** — add to `~/.codex/config.toml`:
```toml
[mcp_servers.memorwise]
command = "node"
args = ["/path/to/memorwise/mcp-server.js"]
```

No extra setup — it uses `node` directly with the project's TypeScript compiler.

**Transport options:** The MCP server defaults to the legacy `Content-Length` stdio framing. If your MCP client uses newline-delimited JSON stdio, add an environment variable to the server config:

```json
"env": {
  "MEMORWISE_MCP_STDIO_TRANSPORT": "newline"
}
```

Accepted values are `content-length` (default), `newline`, and `auto`. GUI clients that do not inherit your shell PATH can also set `command` to an absolute Node.js 22.13+ or 24+ binary.

### Troubleshooting MCP connections

Use this bottom-up loop when Memorwise does not appear in Cursor, Codex, Claude Code, or another MCP client. These commands assume fish shell and a local checkout at `/Users/benjaminkoop/code/ai/Memorwise`; replace that path if your checkout lives elsewhere.

#### 1. Set known-good local variables

```fish
set -gx MEMORWISE_ROOT /Users/benjaminkoop/code/ai/Memorwise
set -gx NODE_BIN (command -v node)

echo $MEMORWISE_ROOT
echo $NODE_BIN
$NODE_BIN -v

test -f "$MEMORWISE_ROOT/mcp-server.js"; and echo "mcp-server.js OK"; or echo "Missing mcp-server.js"
$NODE_BIN -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(((M===22&&m>=13)||M>=24)?0:1)'; and echo "Node version OK"; or echo "Node version BAD"
```

Expected: `mcp-server.js OK` and `Node version OK`. Memorwise requires Node.js 22.13+ or 24+. If Node is bad, fix Node first. GUI clients often do not inherit your shell `PATH`, so use the absolute `$NODE_BIN` value in MCP client config rather than just `"node"`.

#### 2. Check dependencies

```fish
cd "$MEMORWISE_ROOT"
npm ls --depth 0 typescript better-sqlite3
```

If modules are missing, install dependencies:

```fish
cd "$MEMORWISE_ROOT"
npm install
```

If errors mention `better-sqlite3` native bindings, rebuild it:

```fish
cd "$MEMORWISE_ROOT"
npm rebuild better-sqlite3
```

#### 3. Smoke test Content-Length stdio

Run `tools/list` directly against the MCP server without involving Cursor or Codex:

```fish
set init '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-smoke","version":"1"}}}'
set tools '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
set tmp (mktemp -d)

begin
  printf 'Content-Length: %d\r\n\r\n%s' (string length -- $init) $init
  printf 'Content-Length: %d\r\n\r\n%s' (string length -- $tools) $tools
end | env MEMORWISE_DATA_DIR="$tmp" MEMORWISE_MCP_STDIO_TRANSPORT=content-length "$NODE_BIN" "$MEMORWISE_ROOT/mcp-server.js" > /tmp/memorwise-mcp.out 2> /tmp/memorwise-mcp.err

grep -q 'memorwise_list_notebooks' /tmp/memorwise-mcp.out; and echo "Content-Length MCP OK"; or begin echo "Content-Length MCP FAILED"; cat /tmp/memorwise-mcp.err; end

rm -rf "$tmp"
```

Expected: `Content-Length MCP OK`; stderr should contain `Server started (35 tools, content-length stdio)` and no parse errors. If this fails, fix the Memorwise server/runtime layer before changing client config.

#### 4. Smoke test newline-delimited stdio

```fish
set tmp (mktemp -d)

printf '%s\n%s\n' $init $tools | env MEMORWISE_DATA_DIR="$tmp" MEMORWISE_MCP_STDIO_TRANSPORT=newline "$NODE_BIN" "$MEMORWISE_ROOT/mcp-server.js" > /tmp/memorwise-mcp-newline.out 2> /tmp/memorwise-mcp-newline.err

grep -q 'memorwise_list_notebooks' /tmp/memorwise-mcp-newline.out; and echo "Newline MCP OK"; or begin echo "Newline MCP FAILED"; cat /tmp/memorwise-mcp-newline.err; end

rm -rf "$tmp"
```

Choose the client transport from the smoke-test result:

- Both pass: the remaining issue is likely client config, client lifecycle, or client logs.
- Only newline passes: set `MEMORWISE_MCP_STDIO_TRANSPORT` to `newline`.
- Only Content-Length passes: set `MEMORWISE_MCP_STDIO_TRANSPORT` to `content-length`.
- Unsure: set `MEMORWISE_MCP_STDIO_TRANSPORT` to `auto`.

#### 5. Use absolute paths in client configs

For Cursor:

```json
{
  "mcpServers": {
    "memorwise": {
      "command": "/absolute/path/to/node",
      "args": ["/Users/benjaminkoop/code/ai/Memorwise/mcp-server.js"],
      "env": {
        "MEMORWISE_MCP_STDIO_TRANSPORT": "auto"
      }
    }
  }
}
```

For Codex:

```toml
[mcp_servers.memorwise]
command = "/absolute/path/to/node"
args = ["/Users/benjaminkoop/code/ai/Memorwise/mcp-server.js"]

[mcp_servers.memorwise.env]
MEMORWISE_MCP_STDIO_TRANSPORT = "auto"
```

Replace `/absolute/path/to/node` with:

```fish
command -v node
```

For pi: pi does not have built-in MCP support. Plain pi will not connect to Memorwise MCP. If you use a pi MCP extension/package, troubleshoot that extension with the same absolute `command`, `args`, and `env` values above.

Do not set `MEMORWISE_MCP_ALLOW_STDOUT_LOGS=1` in MCP client config. MCP stdout must remain protocol-only.

#### 6. Restart and verify the client

After changing MCP config:

1. Quit the client completely.
2. Reopen it.
3. Confirm the `memorwise` MCP server is not marked failed.
4. Inspect MCP logs if it still fails.
5. Verify the client lists tools including `memorwise_list_notebooks`, `memorwise_get_settings`, and `memorwise_search`.
6. Call `memorwise_get_settings`; it should return provider/model/dataDir JSON.
7. Call `memorwise_list_notebooks`; an empty array is OK.

A resolved connection has no repeated stderr errors such as `Cannot find module`, `Parse error`, `bad Content-Length`, Node version failures, or `better-sqlite3` native binding errors.

Repeat the loop from the first failing layer: Content-Length smoke test → newline smoke test → fix one layer → restart client → list tools → call `memorwise_get_settings` → call `memorwise_list_notebooks`.

**35 tools across 12 categories:**

| Category | Tools |
|----------|-------|
| Notebooks | list, create, delete, get |
| Sources | list, add URL, add text, delete, get content |
| Chat | ask question (RAG), get context, search |
| Notes | list, create, update, delete, get |
| Generate | summary, quiz, flashcards, study guide, suggestions |
| Tags | list, create, assign |
| Folders | list, create |
| Chat History | list sessions, get messages |
| Generations | list saved outputs |
| Settings | get/set provider, set model |
| Graph | get knowledge graph |
| Export | full notebook export |

## Production Build

```bash
npm run build
npm start
# → http://localhost:4747
```

## Tech Stack

Next.js 15 · TypeScript · React 19 · Tailwind CSS v4 · Framer Motion · Zustand · SQLite (better-sqlite3) · LanceDB · Tesseract.js

## License

MIT

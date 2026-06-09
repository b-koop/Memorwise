# Memorwise

A local, open-source alternative to NotebookLM. Chat with PDFs, images, audio, video, URLs, and YouTube links using any LLM provider. Your data stays on your machine.

## Install and Run

```bash
npx memorwise
```

That's it. The installer clones the repo, installs dependencies, starts the dev server, and opens your browser.

## Already Installed?

```bash
npx memorwise
# or just:
cd memorwise && npm run dev
```

If Memorwise is already on your machine, `npx memorwise` detects it and starts the server directly.

By default it also pulls the latest GitHub changes before starting. Use `--no-update` if you want to run the copy you already have.

## Custom Directory

```bash
npx memorwise my-research
```

## Options

```bash
npx memorwise --port 5000
npx memorwise --no-open
npx memorwise --no-update
```

## What You Get

- Chat with PDFs, images, audio, video, URLs, and YouTube
- 8 LLM providers — Ollama, OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, LM Studio
- Knowledge graph with AI-extracted concepts
- Flashcards, quizzes, study guides, summaries
- Podcast-style audio overview from your documents
- 100% local — your data never leaves your machine

## Requirements

- Node.js 22.13+ or 24+
- git

## Links

- [GitHub](https://github.com/robzilla1738/Memorwise)
- [Full Documentation](https://github.com/robzilla1738/Memorwise#readme)

## License

MIT

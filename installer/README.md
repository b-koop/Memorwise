# The Stacks

A local, open-source alternative to NotebookLM. Chat with PDFs, images, audio, video, URLs, and YouTube links using any LLM provider. Your data stays on your machine.

## Install and Run

```bash
npx the-stacks
```

That's it. The installer clones the repo, installs dependencies, starts the dev server, and opens your browser.

## Already Installed?

```bash
npx the-stacks
# or just:
cd the-stacks && npm run dev
```

If The Stacks is already on your machine, `npx the-stacks` detects it and starts the server directly.

By default it also pulls the latest GitHub changes before starting. Use `--no-update` if you want to run the copy you already have.

## Custom Directory

```bash
npx the-stacks my-research
```

## Options

```bash
npx the-stacks --port 5000
npx the-stacks --no-open
npx the-stacks --no-update
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

- [GitHub](https://github.com/b-koop/the-stacks)
- [Full Documentation](https://github.com/b-koop/the-stacks#readme)

## License

MIT

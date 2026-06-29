#!/usr/bin/env node
/**
 * Memorwise MCP Server (Streamable HTTP)
 *
 * Exposes Memorwise's full functionality as MCP tools over the Streamable HTTP
 * transport, the current MCP standard. Built on the official
 * @modelcontextprotocol/sdk.
 *
 * Usage:
 *   node mcp-server.js            # listens on http://localhost:4748/mcp
 *   MCP_PORT=5000 node mcp-server.js
 *
 * Client config (pi / Cursor / Claude Code / Codex):
 *   { "mcpServers": { "memorwise": { "url": "http://localhost:4748/mcp" } } }
 *
 * Requires the server to be running independently (e.g. `npm run mcp`).
 */

// ─── Bootstrap: register tsconfig paths + TS transpiler ───────────────────
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const Module = require("module");

// Set cwd to the project root so all relative imports work
const PROJECT_ROOT = __dirname;
process.chdir(PROJECT_ROOT);

// Register TypeScript transpiler so we can require .ts files directly
const ts = require("typescript");
const tsCompilerOptions = {
	module: ts.ModuleKind.CommonJS,
	target: ts.ScriptTarget.ES2017,
	esModuleInterop: true,
	resolveJsonModule: true,
	jsx: ts.JsxEmit.React,
	strict: false,
};
require.extensions[".ts"] = (module, filename) => {
	const code = require("fs").readFileSync(filename, "utf-8");
	const result = ts.transpileModule(code, {
		compilerOptions: tsCompilerOptions,
		fileName: filename,
	});
	module._compile(result.outputText, filename);
};
require.extensions[".tsx"] = require.extensions[".ts"];

// Register @/* path alias
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	if (request.startsWith("@/")) {
		request = path.join(PROJECT_ROOT, request.slice(2));
	}
	return originalResolve.call(this, request, parent, isMain, options);
};

// ─── Now import project modules + MCP SDK ──────────────────────────────────
const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
	StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const queries = require("./lib/db/queries.ts");
const appPackage = require("./package.json");
const generate = require("./lib/generate.ts");
const { registry } = require("./lib/llm/provider-registry.ts");
const { ingestSource } = require("./lib/rag/ingest.ts");
const { retrieveContext } = require("./lib/rag/retrieve.ts");
const {
	getDataDir,
	getSourceFilePath,
	sanitizeFilename,
} = require("./lib/paths.ts");
const {
	removeNotebookSourcesDir,
	unlinkSourceFile,
} = require("./lib/source-files.ts");
const { createOpenBrain } = require("./lib/openbrain/index.ts");
const fs = require("fs");
const MAX_MCP_TEXT_SOURCE_BYTES = 10 * 1024 * 1024;
const openBrain = createOpenBrain();

function readTextPrefix(filepath, maxBytes = 64 * 1024) {
	const fd = fs.openSync(filepath, "r");
	try {
		const buffer = Buffer.alloc(maxBytes);
		const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
		return buffer.subarray(0, bytesRead).toString("utf8");
	} finally {
		fs.closeSync(fd);
	}
}

// Wrap any result as MCP text content.
function asText(result) {
	return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

// ─── Build the MCP server + register tools ─────────────────────────────────

function createServer() {
	const server = new McpServer({
		name: "memorwise",
		version: appPackage.version,
	});

	server.tool(
		"openbrain_capture_thought",
		"Capture a local Open Brain thought",
		{
			text: z.string().describe("Thought text"),
			title: z.string().optional().describe("Optional title"),
			type: z
				.enum(["note", "task", "decision", "memory", "evidence"])
				.optional()
				.describe("Thought type"),
			topics: z.array(z.string()).optional().describe("Optional topics"),
			source: z.string().optional().describe("Optional source label"),
			restricted: z
				.boolean()
				.optional()
				.describe("Whether the thought is restricted"),
		},
		async (args) => asText({ thought: openBrain.captureThought(args) }),
	);

	server.tool(
		"openbrain_search_thoughts",
		"Search local Open Brain thoughts",
		{
			query: z.string().describe("Search query"),
			includeRestricted: z
				.boolean()
				.optional()
				.describe("Whether to include restricted thoughts"),
		},
		async (args) =>
			asText({
				results: openBrain.searchThoughts(args.query, {
					includeRestricted: args.includeRestricted,
				}),
			}),
	);

	server.tool(
		"openbrain_get_thought",
		"Get a local Open Brain thought by ID",
		{
			id: z.string().describe("Thought ID"),
			includeRestricted: z
				.boolean()
				.optional()
				.describe("Whether to include restricted thoughts"),
		},
		async (args) => {
			const thought = openBrain.getThought(args.id, {
				includeRestricted: args.includeRestricted,
			});
			return asText(thought ? { thought } : { error: "Not found" });
		},
	);

	server.tool("memorwise_list_notebooks", "List all notebooks", {}, async () =>
		asText(await queries.listNotebooks()),
	);

	server.tool(
		"memorwise_create_notebook",
		"Create a new notebook",
		{
			name: z.string().describe("Notebook name"),
			description: z.string().optional().describe("Optional description"),
		},
		async (args) =>
			asText(queries.createNotebook(args.name, args.description || "")),
	);

	server.tool(
		"memorwise_get",
		"Get a notebook, source, or note by ID. Returns full details including content.",
		{
			type: z.enum(["notebook", "source", "note"]),
			id: z.string().describe("The notebook, source, or note ID"),
		},
		async (args) => {
			if (args.type === "notebook")
				return asText(queries.getNotebook(args.id) || { error: "Not found" });
			if (args.type === "source") {
				const s = queries.getSource(args.id);
				if (!s) return asText({ error: "Not found" });
				try {
					return asText({
						filename: s.filename,
						type: s.source_type,
						summary: s.summary,
						content: readTextPrefix(s.filepath, 64 * 1024).slice(0, 10000),
					});
				} catch {
					return asText({
						filename: s.filename,
						summary: s.summary,
						content: "(not readable)",
					});
				}
			}
			if (args.type === "note")
				return asText(queries.getNote(args.id) || { error: "Not found" });
			return asText({ error: "Invalid type — use notebook, source, or note" });
		},
	);

	server.tool(
		"memorwise_delete",
		"Delete a notebook (and all its data), a source (and its embeddings), or a note.",
		{
			type: z.enum(["notebook", "source", "note"]),
			id: z.string().describe("The notebook, source, or note ID"),
		},
		async (args) => {
			if (args.type === "notebook") {
				const nb = queries.getNotebook(args.id);
				if (nb) {
					const { deleteNotebookTable } = require("./lib/rag/vectorstore.ts");
					await deleteNotebookTable(args.id);
					removeNotebookSourcesDir(args.id);
					queries.deleteNotebook(args.id);
				}
			} else if (args.type === "source") {
				const s = queries.getSource(args.id);
				if (s) {
					const { deleteSourceChunks } = require("./lib/rag/vectorstore.ts");
					await deleteSourceChunks(s.notebook_id, args.id);
					unlinkSourceFile(s);
					queries.deleteSource(args.id);
				}
			} else if (args.type === "note") {
				queries.deleteNote(args.id);
			} else {
				return asText({
					error: "Invalid type — use notebook, source, or note",
				});
			}
			return asText({ success: true });
		},
	);

	server.tool(
		"memorwise_list_sources",
		"List sources in a notebook with status and chunk count",
		{ notebookId: z.string() },
		async (args) => asText(queries.listSources(args.notebookId)),
	);

	server.tool(
		"memorwise_add_source",
		"Add a source to a notebook. Provide either a URL (web page or YouTube) or raw text content.",
		{
			notebookId: z.string(),
			url: z
				.string()
				.optional()
				.describe("Web URL or YouTube URL (provide this OR content, not both)"),
			filename: z
				.string()
				.optional()
				.describe("Name for text source (required when providing content)"),
			content: z
				.string()
				.optional()
				.describe("Raw text content (provide this OR url, not both)"),
		},
		async (args) => {
			if (!queries.getNotebook(args.notebookId))
				throw new Error("Notebook not found");
			if (args.url) {
				const { extractFromUrl } = require("./lib/rag/web-extract.ts");
				const ex = await extractFromUrl(args.url);
				const safeTitle =
					ex.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) || "url-source";
				const fp = getSourceFilePath(args.notebookId, `${safeTitle}.txt`);
				fs.writeFileSync(fp, ex.text, { flag: "wx" });
				const src = queries.createSource(
					args.notebookId,
					ex.title,
					fp,
					"txt",
					ex.text.length,
					ex.sourceType,
				);
				ingestSource(src.id, args.notebookId, fp, "txt", ex.sourceType);
				return asText({
					id: src.id,
					filename: src.filename,
					status: "processing",
					message: "Indexing started",
				});
			}
			if (args.content) {
				if (!args.filename)
					throw new Error("filename is required when providing content");
				if (Buffer.byteLength(args.content, "utf8") > MAX_MCP_TEXT_SOURCE_BYTES)
					throw new Error("Text source exceeds 10MB limit");
				const safeFilename = sanitizeFilename(args.filename);
				const fp = getSourceFilePath(args.notebookId, safeFilename);
				fs.writeFileSync(fp, args.content, { flag: "wx" });
				const ext = path.extname(safeFilename).slice(1) || "txt";
				const src = queries.createSource(
					args.notebookId,
					args.filename,
					fp,
					ext,
					args.content.length,
					"file",
				);
				ingestSource(src.id, args.notebookId, fp, ext, "file");
				return asText({
					id: src.id,
					filename: src.filename,
					status: "processing",
					message: "Indexing started",
				});
			}
			throw new Error("Provide either url or content");
		},
	);

	server.tool(
		"memorwise_list_notes",
		"List notes in a notebook",
		{ notebookId: z.string() },
		async (args) => asText(queries.listNotes(args.notebookId)),
	);

	server.tool(
		"memorwise_create_note",
		"Create a note in a notebook",
		{
			notebookId: z.string(),
			title: z.string(),
			content: z.string().optional().describe("Markdown content"),
		},
		async (args) =>
			asText(
				queries.createNote(args.notebookId, args.title, args.content || ""),
			),
	);

	server.tool(
		"memorwise_update_note",
		"Update a note's title and/or content",
		{
			noteId: z.string(),
			title: z.string().optional(),
			content: z.string().optional(),
		},
		async (args) => {
			queries.updateNote(args.noteId, args.title, args.content);
			return asText({ success: true });
		},
	);

	server.tool(
		"memorwise_chat",
		"Ask a question about notebook documents using RAG with citations",
		{
			notebookId: z.string(),
			question: z.string(),
			sourceId: z.string().optional().describe("Optional: focus on one source"),
		},
		async (args) => {
			let ctx = "",
				cites = [];
			try {
				const r = await retrieveContext(
					args.notebookId,
					args.question,
					8,
					args.sourceId,
				);
				ctx = r.context;
				cites = r.citations;
			} catch {}
			if (!ctx) {
				ctx = generate.getNotebookContext(args.notebookId, 5000, args.sourceId);
				cites = queries
					.listSources(args.notebookId)
					.filter(
						(s) =>
							(s.status === "ready" || s.status === "error") &&
							(!args.sourceId || s.id === args.sourceId),
					)
					.map((s) => ({ filename: s.filename }));
			}
			if (!ctx)
				return asText({
					answer: "No documents in this notebook.",
					citations: [],
				});
			const answer = await registry.getActiveProvider().generate({
				model: registry.getActiveChatModel(),
				messages: [
					{
						role: "system",
						content: `Answer using document context. Cite with [1],[2].\n\nContext:\n${ctx}`,
					},
					{ role: "user", content: args.question },
				],
			});
			return asText({
				answer,
				citations: [...new Map(cites.map((c) => [c.filename, c])).values()],
			});
		},
	);

	server.tool(
		"memorwise_search",
		"Search across sources and notes in a notebook",
		{ notebookId: z.string(), query: z.string() },
		async (args) => {
			const { getDb } = require("./lib/db/index.ts");
			const db = getDb();
			const like = `%${args.query}%`;
			const r = [];
			db.prepare(
				"SELECT id,filename,summary FROM sources WHERE notebook_id=? AND (filename LIKE ? OR summary LIKE ?) LIMIT 10",
			)
				.all(args.notebookId, like, like)
				.forEach((s) =>
					r.push({
						type: "source",
						id: s.id,
						title: s.filename,
						snippet: (s.summary || "").slice(0, 150),
					}),
				);
			db.prepare(
				"SELECT id,title,content FROM notes WHERE notebook_id=? AND (title LIKE ? OR content LIKE ?) LIMIT 10",
			)
				.all(args.notebookId, like, like)
				.forEach((n) =>
					r.push({
						type: "note",
						id: n.id,
						title: n.title,
						snippet: (n.content || "").slice(0, 150),
					}),
				);
			return asText(r);
		},
	);

	server.tool(
		"memorwise_get_settings",
		"Get current provider, model, and data-dir settings",
		{},
		async () =>
			asText({
				provider: registry.getActiveProvider().id,
				chatModel: registry.getActiveChatModel(),
				embeddingModel: registry.getActiveEmbeddingModel(),
				embeddingProvider: registry.getEmbeddingProviderId(),
				transcription: registry.getTranscriptionProvider(),
				tts: registry.getTTSProvider(),
				dataDir: getDataDir(),
			}),
	);

	server.tool(
		"memorwise_update_settings",
		"Update provider and/or chat model",
		{
			provider: z.string().optional(),
			model: z.string().optional(),
		},
		async (args) => {
			if (args.provider) registry.setActiveProvider(args.provider);
			if (args.model) registry.setActiveChatModel(args.model);
			return asText({
				success: true,
				provider: registry.getActiveProvider().id,
				chatModel: registry.getActiveChatModel(),
			});
		},
	);

	return server;
}

// ─── Streamable HTTP server (stateful sessions) ────────────────────────────

const PORT = parseInt(process.env.MCP_PORT || "4748", 10);
const SESSIONS = new Map(); // sessionId -> { server, transport }

async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8");
}

function isLocalHostHeader(host) {
	if (!host) return false;
	const normalized = String(Array.isArray(host) ? host[0] : host)
		.trim()
		.toLowerCase();
	return (
		normalized === "localhost" ||
		normalized.startsWith("localhost:") ||
		normalized === "127.0.0.1" ||
		normalized.startsWith("127.0.0.1:") ||
		normalized === "[::1]" ||
		normalized.startsWith("[::1]:") ||
		normalized === "::1"
	);
}

function isLocalRemoteAddress(remoteAddress) {
	return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remoteAddress);
}

const httpServer = http.createServer(async (req, res) => {
	if (
		!isLocalHostHeader(req.headers.host) ||
		!isLocalRemoteAddress(req.socket.remoteAddress)
	) {
		res
			.writeHead(403)
			.end(
				"Memorwise MCP is local-only; connect via localhost, 127.0.0.1, or [::1].",
			);
		return;
	}

	// Only handle POST (JSON-RPC), GET (SSE), DELETE (session close) at /mcp
	if (!req.url || !req.url.split("?")[0].endsWith("/mcp")) {
		res.writeHead(404).end("Not found");
		return;
	}

	try {
		const sessionId = req.headers["mcp-session-id"];
		const session = sessionId ? SESSIONS.get(sessionId) : undefined;

		// POST carries JSON-RPC. Always pre-read the body (supported via the
		// transport's parsedBody argument) so we can detect initialize requests.
		if (req.method === "POST") {
			let parsed;
			try {
				parsed = JSON.parse(await readBody(req));
			} catch {
				res.writeHead(400).end("Invalid JSON");
				return;
			}

			const isInit =
				isInitializeRequest(parsed) ||
				(Array.isArray(parsed) && parsed.some((m) => isInitializeRequest(m)));

			if (isInit) {
				const holder = {};
				const transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => crypto.randomUUID(),
					onsessioninitialized: (sid) => {
						SESSIONS.set(sid, holder.session);
						process.stderr.write(`[memorwise-mcp] session ${sid} started\n`);
					},
				});
				const server = createServer();
				holder.session = { server, transport };
				transport.onclose = () => {
					if (transport.sessionId) SESSIONS.delete(transport.sessionId);
				};
				await server.connect(transport);
				await transport.handleRequest(req, res, parsed);
				return;
			}

			if (!session) {
				if (sessionId) {
					res.writeHead(404).end("Session not found. Re-initialize.");
				} else {
					res
						.writeHead(400)
						.end("No valid session. Send an initialize request first.");
				}
				return;
			}
			await session.transport.handleRequest(req, res, parsed);
			return;
		}

		// GET (SSE stream) / DELETE (session teardown) — no body to parse.
		if (!session) {
			res.writeHead(404).end("Session not found. Re-initialize.");
			return;
		}
		await session.transport.handleRequest(req, res);
	} catch (err) {
		process.stderr.write(`[memorwise-mcp] request error: ${err}\n`);
		if (!res.headersSent) res.writeHead(500).end("Internal server error");
	}
});

httpServer.listen(PORT, () => {
	process.stderr.write(
		`[memorwise-mcp] Streamable HTTP server listening on http://localhost:${PORT}/mcp\n`,
	);
});

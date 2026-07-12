import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function getFreePort() {
	const server = net.createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	assert.ok(address && typeof address === "object", "Expected a TCP port");
	const port = address.port;
	await new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
	return port;
}

async function startMcpServer({ dataDir } = {}) {
	const resolvedDataDir =
		dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "openbrain-mcp-"));
	const port = await getFreePort();
	const child = spawn(process.execPath, ["mcp-server.js"], {
		cwd: process.cwd(),
		env: {
			...process.env,
			MCP_PORT: String(port),
			THE_STACKS_DATA_DIR: resolvedDataDir,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	let stderr = "";
	child.stderr.on("data", (chunk) => {
		stderr += chunk.toString();
	});

	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Timed out waiting for MCP server. stderr:\n${stderr}`));
		}, 10_000);
		child.once("exit", (code, signal) => {
			clearTimeout(timeout);
			reject(
				new Error(
					`MCP server exited before listening: ${code ?? signal}. stderr:\n${stderr}`,
				),
			);
		});
		child.stderr.on("data", () => {
			if (stderr.includes("Streamable HTTP server listening")) {
				clearTimeout(timeout);
				resolve();
			}
		});
	});

	return {
		port,
		dataDir: resolvedDataDir,
		url: new URL(`http://127.0.0.1:${port}/mcp`),
		async stop() {
			if (!child.killed) {
				child.kill("SIGTERM");
			}
			await new Promise((resolve) => {
				child.once("exit", resolve);
				setTimeout(resolve, 500);
			});
		},
	};
}

function parseTextResult(result) {
	const text = result.content?.find((item) => item.type === "text")?.text;
	assert.ok(text, "Expected MCP text content");
	return JSON.parse(text);
}

test("local AI clients can capture and recall Open Brain thoughts without an access key", async () => {
	const server = await startMcpServer();
	const client = new Client({ name: "openbrain-mcp-test", version: "1.0.0" });
	const transport = new StreamableHTTPClientTransport(server.url);

	try {
		await client.connect(transport);

		const tools = await client.listTools();
		const toolNames = tools.tools.map((tool) => tool.name);
		assert.ok(toolNames.includes("openbrain_capture_thought"));
		assert.ok(toolNames.includes("openbrain_search_thoughts"));
		assert.ok(toolNames.includes("openbrain_get_thought"));

		const captured = parseTextResult(
			await client.callTool({
				name: "openbrain_capture_thought",
				arguments: {
					text: "Open Brain MCP remembers local-only thoughts",
					title: "Local MCP memory",
					type: "memory",
					topics: ["mcp", "local"],
					source: "mcp-test",
				},
			}),
		);
		assert.equal(
			captured.thought.text,
			"Open Brain MCP remembers local-only thoughts",
		);

		const search = parseTextResult(
			await client.callTool({
				name: "openbrain_search_thoughts",
				arguments: { query: "local-only" },
			}),
		);
		assert.ok(
			search.results.some(
				(result) => result.thought.id === captured.thought.id,
			),
			"Expected search to include the captured thought",
		);

		const fetched = parseTextResult(
			await client.callTool({
				name: "openbrain_get_thought",
				arguments: { id: captured.thought.id },
			}),
		);
		assert.equal(fetched.thought.id, captured.thought.id);
		assert.equal(
			fetched.thought.text,
			"Open Brain MCP remembers local-only thoughts",
		);

		const reconnectingClient = new Client({
			name: "openbrain-mcp-reconnect-test",
			version: "1.0.0",
		});
		const reconnectingTransport = new StreamableHTTPClientTransport(server.url);
		try {
			await reconnectingClient.connect(reconnectingTransport);
			const resumedSearch = parseTextResult(
				await reconnectingClient.callTool({
					name: "openbrain_search_thoughts",
					arguments: { query: "local-only" },
				}),
			);
			assert.ok(
				resumedSearch.results.some(
					(result) => result.thought.id === captured.thought.id,
				),
				"Expected a second local MCP session to recall the captured thought",
			);
		} finally {
			await reconnectingTransport.close();
		}
	} finally {
		await transport.close();
		await server.stop();
	}
});

test("remote host requests cannot reach the local Open Brain MCP endpoint", async () => {
	const server = await startMcpServer();
	try {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list",
		});
		const response = await new Promise((resolve, reject) => {
			const socket = net.createConnection(
				{ host: "127.0.0.1", port: server.port },
				() => {
					socket.write(
						[
							"POST /mcp HTTP/1.1",
							"Host: example.com",
							"Content-Type: application/json",
							`Content-Length: ${Buffer.byteLength(body)}`,
							"Connection: close",
							"",
							body,
						].join("\r\n"),
					);
				},
			);
			let rawResponse = "";
			socket.on("data", (chunk) => {
				rawResponse += chunk.toString();
			});
			socket.on("error", reject);
			socket.on("end", () => resolve(rawResponse));
		});

		assert.match(response, /^HTTP\/1\.1 403 Forbidden/);
		assert.match(response, /local/i);
	} finally {
		await server.stop();
	}
});

test("captured thoughts survive an Open Brain MCP server restart", async () => {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "openbrain-mcp-"));
	const thoughtText =
		"Durable Open Brain thoughts outlive the MCP server process";

	const serverA = await startMcpServer({ dataDir });
	const clientA = new Client({
		name: "openbrain-mcp-restart-test-a",
		version: "1.0.0",
	});
	const transportA = new StreamableHTTPClientTransport(serverA.url);
	try {
		await clientA.connect(transportA);
		const captured = parseTextResult(
			await clientA.callTool({
				name: "openbrain_capture_thought",
				arguments: {
					text: thoughtText,
					type: "memory",
					source: "mcp-restart-test",
				},
			}),
		);
		assert.equal(captured.thought.text, thoughtText);
	} finally {
		await transportA.close();
		await serverA.stop();
	}

	const serverB = await startMcpServer({ dataDir });
	const clientB = new Client({
		name: "openbrain-mcp-restart-test-b",
		version: "1.0.0",
	});
	const transportB = new StreamableHTTPClientTransport(serverB.url);
	try {
		await clientB.connect(transportB);
		const search = parseTextResult(
			await clientB.callTool({
				name: "openbrain_search_thoughts",
				arguments: { query: "outlive" },
			}),
		);
		assert.ok(
			search.results.some(
				(result) =>
					result.thought.text === thoughtText &&
					result.thought.source === "mcp-restart-test",
			),
			"Expected search to include the thought captured before the restart",
		);
	} finally {
		await transportB.close();
		await serverB.stop();
	}
});

test("capturing the same thought twice keeps one durable thought", async () => {
	const server = await startMcpServer();
	const client = new Client({
		name: "openbrain-mcp-dedupe-test",
		version: "1.0.0",
	});
	const transport = new StreamableHTTPClientTransport(server.url);
	const thoughtText = "Repeated Open Brain captures stay a single thought";

	try {
		await client.connect(transport);

		for (let attempt = 0; attempt < 2; attempt++) {
			const captured = parseTextResult(
				await client.callTool({
					name: "openbrain_capture_thought",
					arguments: {
						text: thoughtText,
						type: "note",
						source: "mcp-dedupe-test",
					},
				}),
			);
			assert.equal(captured.thought.text, thoughtText);
		}

		const search = parseTextResult(
			await client.callTool({
				name: "openbrain_search_thoughts",
				arguments: { query: "Repeated Open Brain captures" },
			}),
		);
		const matches = search.results.filter(
			(result) => result.thought.text === thoughtText,
		);
		assert.equal(
			matches.length,
			1,
			"Expected exactly one durable thought after capturing the same text twice",
		);
	} finally {
		await transport.close();
		await server.stop();
	}
});

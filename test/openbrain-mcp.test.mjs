import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
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

async function startMcpServer() {
	const port = await getFreePort();
	const child = spawn(process.execPath, ["mcp-server.js"], {
		cwd: process.cwd(),
		env: { ...process.env, MCP_PORT: String(port) },
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
				new Error(`MCP server exited before listening: ${code ?? signal}. stderr:\n${stderr}`),
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
		assert.equal(captured.thought.text, "Open Brain MCP remembers local-only thoughts");

		const search = parseTextResult(
			await client.callTool({
				name: "openbrain_search_thoughts",
				arguments: { query: "local-only" },
			}),
		);
		assert.ok(
			search.results.some((result) => result.thought.id === captured.thought.id),
			"Expected search to include the captured thought",
		);

		const fetched = parseTextResult(
			await client.callTool({
				name: "openbrain_get_thought",
				arguments: { id: captured.thought.id },
			}),
		);
		assert.equal(fetched.thought.id, captured.thought.id);
		assert.equal(fetched.thought.text, "Open Brain MCP remembers local-only thoughts");

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
		const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
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

import { NextResponse } from "next/server";
import { registry } from "@/lib/llm/provider-registry";
import * as queries from "@/lib/db/queries";
import { assertSafePathSegment } from "@/lib/paths";
import { searchSerper, type SerperSearchResult } from "@/lib/search/serper";

type DiscoveryMode = "direct" | "agent";

interface DiscoveryResult extends SerperSearchResult {
	reason?: string;
}

interface AgentSelection {
	selected?: { url?: unknown; reason?: unknown }[];
}

function clampLimit(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return 5;
	return Math.min(Math.max(Math.floor(parsed), 1), 10);
}

function parseMode(value: unknown): DiscoveryMode | null {
	return value === "direct" || value === "agent" ? value : null;
}

function getSafeDiscoveryError(err: unknown): {
	error: string;
	status: number;
} {
	const message = err instanceof Error ? err.message : "";
	if (message.includes("SERPER_API_KEY")) {
		return {
			error:
				"Web discovery is not configured. Set SERPER_API_KEY in the server environment.",
			status: 500,
		};
	}
	return {
		error: "Source discovery failed. Check the server logs and try again.",
		status: 502,
	};
}

function parseAgentSelection(text: string): AgentSelection | null {
	const objectMatch = text.match(/\{[\s\S]*\}/);
	if (!objectMatch) return null;
	try {
		return JSON.parse(objectMatch[0]) as AgentSelection;
	} catch {
		return null;
	}
}

function selectAgentResults(
	candidates: SerperSearchResult[],
	selection: AgentSelection | null,
	limit: number,
): DiscoveryResult[] {
	if (!selection || !Array.isArray(selection.selected)) return [];

	const byUrl = new Map(
		candidates.map((candidate) => [candidate.url, candidate]),
	);
	const results: DiscoveryResult[] = [];
	const seen = new Set<string>();

	for (const item of selection.selected) {
		if (!item || typeof item.url !== "string") continue;
		const candidate = byUrl.get(item.url);
		if (!candidate || seen.has(candidate.url)) continue;
		seen.add(candidate.url);
		results.push({
			...candidate,
			reason:
				typeof item.reason === "string" ? item.reason.slice(0, 240) : undefined,
		});
		if (results.length >= limit) break;
	}

	return results;
}

async function chooseWithAgent(
	query: string,
	candidates: SerperSearchResult[],
	limit: number,
): Promise<DiscoveryResult[]> {
	const provider = registry.getActiveProvider();
	const model = registry.getActiveChatModel();
	const candidateJson = JSON.stringify(candidates, null, 2);

	const response = await provider.generate({
		model,
		temperature: 0.2,
		messages: [
			{
				role: "system",
				content: [
					"You choose web sources for a local NotebookLM-style research notebook.",
					"Prefer primary sources, official documentation, reputable publications, comprehensive explainers, and sources with enough substance to import.",
					"Avoid duplicate pages, SEO spam, thin pages, sales pages, login-gated pages, and sources that are only tangentially related.",
					'Return only JSON with this shape: {"selected":[{"url":"candidate url","reason":"brief reason"}]}',
					"Only select URLs that exactly appear in the candidate list.",
				].join(" "),
			},
			{
				role: "user",
				content: `Query: ${query}\n\nSelect the best ${limit} source URLs from these candidates:\n${candidateJson}`,
			},
		],
	});

	return selectAgentResults(candidates, parseAgentSelection(response), limit);
}

export async function POST(req: Request) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const payload =
		body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	const notebookId =
		typeof payload.notebookId === "string" ? payload.notebookId.trim() : "";
	const query = typeof payload.query === "string" ? payload.query.trim() : "";
	const mode = parseMode(payload.mode);
	const limit = clampLimit(payload.limit);

	if (!notebookId)
		return NextResponse.json({ error: "notebookId required" }, { status: 400 });
	try {
		assertSafePathSegment(notebookId, "notebookId");
	} catch {
		return NextResponse.json({ error: "Invalid notebookId" }, { status: 400 });
	}
	if (!queries.getNotebook(notebookId))
		return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
	if (!query)
		return NextResponse.json({ error: "query required" }, { status: 400 });
	if (query.length > 300)
		return NextResponse.json(
			{ error: "query must be 300 characters or less" },
			{ status: 400 },
		);
	if (!mode)
		return NextResponse.json(
			{ error: "mode must be direct or agent" },
			{ status: 400 },
		);

	try {
		const candidates = await searchSerper(query, mode === "agent" ? 10 : limit);
		if (candidates.length === 0) {
			return NextResponse.json({ query, mode, results: [] });
		}

		if (mode === "direct") {
			return NextResponse.json({
				query,
				mode,
				results: candidates.slice(0, limit),
			});
		}

		try {
			const selected = await chooseWithAgent(query, candidates, limit);
			if (selected.length > 0) {
				return NextResponse.json({ query, mode, results: selected });
			}
			return NextResponse.json({
				query,
				mode,
				results: candidates.slice(0, limit).map((candidate) => ({
					...candidate,
					reason:
						"Selected by search ranking because the agent did not return usable JSON.",
				})),
				agentFallback: true,
			});
		} catch {
			return NextResponse.json({
				query,
				mode,
				results: candidates.slice(0, limit).map((candidate) => ({
					...candidate,
					reason:
						"Selected by search ranking because the configured agent was unavailable.",
				})),
				agentFallback: true,
			});
		}
	} catch (err) {
		console.error("Source discovery failed", err);
		const safeError = getSafeDiscoveryError(err);
		return NextResponse.json(
			{ error: safeError.error },
			{ status: safeError.status },
		);
	}
}

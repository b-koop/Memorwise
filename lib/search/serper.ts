import { registry } from '@/lib/llm/provider-registry';

export interface SerperSearchResult {
	title: string;
	url: string;
	snippet: string;
	position?: number;
}

interface SerperOrganicResult {
	title?: unknown;
	link?: unknown;
	snippet?: unknown;
	position?: unknown;
}

interface SerperResponse {
	organic?: SerperOrganicResult[];
}

const SERPER_SEARCH_URL = "https://google.serper.dev/search";

function clampLimit(limit: number): number {
	if (!Number.isFinite(limit)) return 5;
	return Math.min(Math.max(Math.floor(limit), 1), 10);
}

function toPublicHttpUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.toString();
	} catch {
		return null;
	}
}

function dedupeKey(url: string): string {
	const parsed = new URL(url);
	parsed.hash = "";
	return parsed.toString().replace(/\/$/, "").toLowerCase();
}

export async function searchSerper(
	query: string,
	limit = 5,
): Promise<SerperSearchResult[]> {
	const apiKey = registry.getSerperApiKey().trim();
	if (!apiKey) {
		throw new Error(
			"Serper API key is not configured. Add your key in Settings → Search.",
		);
	}

	const trimmedQuery = query.trim();
	if (!trimmedQuery) throw new Error("Search query is required.");

	const resultLimit = clampLimit(limit);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);
	let response: Response;
	try {
		response = await fetch(SERPER_SEARCH_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": apiKey,
			},
			body: JSON.stringify({ q: trimmedQuery, num: resultLimit }),
			signal: controller.signal,
		});
	} catch (err) {
		throw new Error(
			`Serper search request failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		throw new Error(`Serper search failed with status ${response.status}`);
	}

	const data = (await response.json()) as SerperResponse;
	const organicResults = Array.isArray(data.organic) ? data.organic : [];
	const seen = new Set<string>();
	const results: SerperSearchResult[] = [];

	for (const item of organicResults) {
		const url = toPublicHttpUrl(item.link);
		if (!url) continue;

		const key = dedupeKey(url);
		if (seen.has(key)) continue;
		seen.add(key);

		results.push({
			title:
				typeof item.title === "string" && item.title.trim()
					? item.title.trim()
					: url,
			url,
			snippet: typeof item.snippet === "string" ? item.snippet.trim() : "",
			position: typeof item.position === "number" ? item.position : undefined,
		});

		if (results.length >= resultLimit) break;
	}

	return results;
}

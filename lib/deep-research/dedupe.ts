import type { CandidateSource } from "./types";

function dedupeKey(url: string): string {
	const parsed = new URL(url);
	parsed.hash = "";
	parsed.searchParams.sort();
	return parsed.toString().replace(/\/$/, "").toLowerCase();
}

export function dedupeSources(sources: CandidateSource[]): CandidateSource[] {
	const seen = new Map<string, CandidateSource>();
	const narrowed: CandidateSource[] = [];

	for (const source of sources) {
		let key: string;
		try {
			key = dedupeKey(source.url);
		} catch {
			key = source.url.toLowerCase();
		}

		const original = seen.get(key);
		if (original) {
			narrowed.push({
				...source,
				status: "duplicate",
				duplicateOf: original.id,
				exclusionReason: "duplicate copy of an already usable source",
			});
			continue;
		}

		seen.set(key, source);
		narrowed.push(source);
	}

	return narrowed;
}

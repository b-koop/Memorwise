import type { CandidateSource, Evidence } from "./types";

const positiveByKind: Record<NonNullable<CandidateSource["sourceKind"]>, string[]> = {
	government: ["institutional authority", "topic expertise", "primary-source status"],
	university: ["institutional authority", "authorship", "topic expertise"],
	official: ["official documentation", "topic expertise", "primary-source status"],
	standard: ["standards reference", "topic expertise", "primary-source status"],
	code: ["public code reference", "topic expertise", "primary-source status"],
	anonymous: [],
	generic: [],
};

const baseByKind: Record<NonNullable<CandidateSource["sourceKind"]>, number> = {
	government: 88,
	university: 84,
	official: 86,
	standard: 86,
	code: 82,
	generic: 55,
	anonymous: 30,
};

export function scoreSource(source: CandidateSource, topic?: string): CandidateSource {
	const kind = source.sourceKind ?? "generic";
	const reasons = new Set(positiveByKind[kind]);
	let confidence = baseByKind[kind];

	if (source.author) {
		reasons.add("authorship");
		confidence += 4;
	}
	if (source.publishedAt) {
		reasons.add("recency");
		confidence += 3;
	}
	if (source.hasCitations) {
		reasons.add("citations");
		confidence += 5;
	}
	if (topic === "software" && ["official", "standard", "code"].includes(kind)) {
		reasons.add("domain expertise");
		confidence += 8;
	}
	if (kind === "anonymous") {
		reasons.add("anonymous source");
		reasons.add("no citations");
		confidence -= 10;
	}

	return {
		...source,
		contentSummary: [...reasons].join(", "),
		content: source.content,
		status: source.status,
		// Store score metadata on the summary for display; evidence gets the numeric score.
		snippet: source.snippet,
		topics: source.topics.length ? source.topics : [topic ?? "general"],
		exclusionReason: source.exclusionReason,
	};
}

export function sourceScore(source: CandidateSource, topic?: string): {
	confidence: number;
	reasons: string[];
} {
	const scored = scoreSource(source, topic);
	const kind = scored.sourceKind ?? "generic";
	let confidence = baseByKind[kind];
	const reasons = new Set(positiveByKind[kind]);

	if (source.author) {
		reasons.add("authorship");
		confidence += 4;
	}
	if (source.publishedAt) {
		reasons.add("recency");
		confidence += 3;
	}
	if (source.hasCitations) {
		reasons.add("citations");
		confidence += 5;
	}
	if (topic === "software" && ["official", "standard", "code"].includes(kind)) {
		reasons.add("domain expertise");
		confidence += 8;
	}
	if (kind === "anonymous") {
		reasons.add("anonymous source");
		reasons.add("no citations");
		confidence -= 10;
	}

	return { confidence: Math.max(0, Math.min(100, confidence)), reasons: [...reasons] };
}

export function evidenceFromSource(
	source: CandidateSource,
	topic?: string,
	stance?: Evidence["stance"],
): Evidence | null {
	if (source.status !== "usable" || !source.content?.trim()) return null;
	const score = sourceScore(source, topic);
	return {
		id: `ev-${source.id}`,
		sourceId: source.id,
		sourceTitle: source.title,
		sourceUrl: source.url,
		author: source.author,
		publishedAt: source.publishedAt,
		quote: source.content.slice(0, 240),
		confidence: score.confidence,
		confidenceReasons: score.reasons,
		relatedTopics: source.topics.length ? source.topics : [topic ?? "general"],
		stance,
	};
}

import { getDb } from "../db/index";
import {
	createOpenBrainThought,
	getOpenBrainThought,
	listOpenBrainThoughts,
} from "../db/queries";
import type { ThoughtType } from "./index";

type ThoughtRow = {
	id: string;
	title: string;
	text: string;
	type: string;
	topics: string;
	source: string | null;
	restricted: number;
	importance: number | null;
	created_at: string;
	updated_at: string;
};

export type StoredThought = {
	id: string;
	text: string;
	title: string;
	type: ThoughtType;
	topics: string[];
	source?: string;
	restricted?: boolean;
	importance?: number;
	createdAt: string;
	updatedAt: string;
};

export type StoredSearchResult = {
	thought: StoredThought;
	context: string;
};

const normalize = (text: string): string =>
	text.trim().toLowerCase().replace(/\s+/g, " ");

const inferTitle = (text: string): string => {
	const firstLine = text.trim().split(/\r?\n/, 1)[0] ?? "Thought";
	return firstLine.length > 64
		? `${firstLine.slice(0, 61)}...`
		: firstLine || "Thought";
};

const inferTopics = (text: string): string[] => {
	const words = normalize(text)
		.split(/[^a-z0-9-]+/)
		.filter((word) => word.length > 4);
	return Array.from(new Set(words)).slice(0, 3);
};

// SQLite datetime('now') stores "YYYY-MM-DD HH:MM:SS" in UTC.
const toIso = (value: string): string =>
	new Date(`${value.replace(" ", "T")}Z`).toISOString();

const toThought = (row: ThoughtRow): StoredThought => ({
	id: row.id,
	text: row.text,
	title: row.title,
	type: row.type as ThoughtType,
	topics: JSON.parse(row.topics ?? "[]"),
	source: row.source ?? undefined,
	restricted: !!row.restricted,
	importance: row.importance ?? undefined,
	createdAt: toIso(row.created_at),
	updatedAt: toIso(row.updated_at),
});

export function captureThought(input: {
	text: string;
	title?: string;
	type?: ThoughtType;
	topics?: string[];
	source?: string;
	restricted?: boolean;
}): StoredThought {
	const fingerprint = normalize(input.text);
	const existing = listOpenBrainThoughts({ includeRestricted: true }).find(
		(row) => normalize(row.text) === fingerprint,
	);
	if (existing) {
		const source =
			input.source && !existing.source?.includes(input.source)
				? existing.source
					? `${existing.source}; ${input.source}`
					: input.source
				: existing.source;
		getDb()
			.prepare(
				"UPDATE openbrain_thoughts SET source = ?, updated_at = datetime('now') WHERE id = ?",
			)
			.run(source, existing.id);
		return toThought(
			getOpenBrainThought(existing.id, { includeRestricted: true })!,
		);
	}
	return toThought(
		createOpenBrainThought({
			...input,
			title: input.title ?? inferTitle(input.text),
			topics: input.topics ?? inferTopics(input.text),
		}),
	);
}

export function searchThoughts(
	query: string,
	options: { includeRestricted?: boolean } = {},
): StoredSearchResult[] {
	const terms = new Set(
		normalize(query)
			.split(/[^a-z0-9-]+/)
			.filter(Boolean),
	);
	return listOpenBrainThoughts({ includeRestricted: options.includeRestricted })
		.map(toThought)
		.filter((thought) => {
			const haystack = normalize(
				`${thought.title} ${thought.text} ${thought.topics.join(" ")} ${thought.source ?? ""}`,
			);
			return (
				terms.size === 0 ||
				Array.from(terms).some((term) => haystack.includes(term))
			);
		})
		.map((thought) => ({
			thought,
			context: `${thought.title} · ${thought.source ?? "Open Brain"} · ${thought.updatedAt}`,
		}));
}

export function getThought(
	id: string,
	options: { includeRestricted?: boolean } = {},
): StoredThought | undefined {
	const row = getOpenBrainThought(id, options);
	return row ? toThought(row) : undefined;
}

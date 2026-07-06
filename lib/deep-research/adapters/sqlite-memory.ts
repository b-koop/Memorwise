import { listResearchRuns } from "@/lib/db/queries";
import type { ResearchMemoryPort } from "../ports";
import type { PriorResearchContext } from "../types";

function words(value: string | undefined): Set<string> {
	return new Set((value ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
	for (const value of a) {
		if (b.has(value)) return true;
	}
	return false;
}

export function createSqliteResearchMemoryPort(notebookId: string): ResearchMemoryPort {
	return {
		async findRelated(question) {
			const questionWords = words(question);
			return listResearchRuns(notebookId)
				.filter((run) => overlaps(questionWords, words(run.question)))
				.slice(0, 3)
				.map((run): PriorResearchContext => ({
					id: run.id,
					topic: run.question ?? "related research",
					usefulDomains: [
						...new Set(run.evidence.map((item) => new URL(item.sourceUrl).hostname)),
					],
					searches: run.searchDirections.map((direction) => direction.query),
					evidenceIds: run.evidence.map((item) => item.id),
					included: false,
				}));
		},
	};
}

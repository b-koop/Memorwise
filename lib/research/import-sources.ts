import type { ResearchRun } from "@/lib/deep-research";
import { useNotebookStore } from "@/stores/notebook-store";

export function extractResearchUrls(run: ResearchRun): string[] {
	const seen = new Set<string>();
	const urls: string[] = [];
	for (const source of run.sources) {
		if (source.status === "duplicate" || !source.url?.trim()) continue;
		const key = source.url.trim().toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		urls.push(source.url.trim());
	}
	return urls;
}

export async function importResearchSourcesToNotebook(
	run: ResearchRun,
): Promise<number> {
	const urls = extractResearchUrls(run);
	if (urls.length === 0) return 0;
	return useNotebookStore.getState().addUrlSources(urls);
}

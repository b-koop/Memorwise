import { registry } from "@/lib/llm/provider-registry";
import { searchSerper } from "@/lib/search/serper";
import type { SearchPort } from "../ports";

export const serperSearchPort: SearchPort = {
	async search(direction) {
		const results = await searchSerper(
			direction.query,
			registry.getDeepResearchSearchLimit(),
		);
		return results.map((result, index) => ({
			id: `serper-${direction.area}-${index}`,
			title: result.title,
			url: result.url,
			snippet: result.snippet,
			status: "candidate",
			sourceKind: "generic",
			topics: [direction.area],
		}));
	},
};

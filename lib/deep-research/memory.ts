import type { PriorResearchContext } from "./types";

export function markPriorContextIncluded(
	contexts: PriorResearchContext[],
	include: boolean,
): PriorResearchContext[] {
	return contexts.map((context) => ({ ...context, included: include }));
}

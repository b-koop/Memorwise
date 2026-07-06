import type { PlannerPort } from "./ports";
import type { ResearchArea, SearchDirection } from "./types";

const fusionAreas = [
	"history",
	"physics",
	"current reactors",
	"commercial efforts",
	"major challenges",
];

export const deterministicPlanner: PlannerPort = {
	async planQuestion(question: string): Promise<ResearchArea[]> {
		const normalized = question.toLowerCase();
		const areas = normalized.includes("fusion")
			? fusionAreas
			: ["background", "current state", "evidence", "risks"];
		return areas.map((name) => ({ name, status: "planned" }));
	},

	async createSearchDirections(
		question: string | undefined,
		areas: ResearchArea[],
	): Promise<SearchDirection[]> {
		const planned = areas.filter((area) => area.status === "planned");
		const normalized = question?.toLowerCase() ?? "";
		if (
			normalized.includes("fusion") ||
			planned.some((area) => area.name === "current reactors")
		) {
			return planned.flatMap((area) => {
				if (area.name === "current reactors") {
					return [{ area: area.name, query: "ITER progress" }];
				}
				if (area.name === "commercial efforts") {
					return [{ area: area.name, query: "commercial fusion startups" }];
				}
				return [{ area: area.name, query: `fusion ${area.name}` }];
			});
		}

		return planned.map((area) => ({
			area: area.name,
			query: `${question ?? "research"} ${area.name}`.trim(),
		}));
	},
};

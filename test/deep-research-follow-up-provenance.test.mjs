import assert from "node:assert/strict";
import { DeepResearchEngine } from "../lib/deep-research/run.ts";

const followUpDirection = {
	area: "current reactors",
	query: "ITER progress 2025",
	depth: 2,
	parentQuery: "fusion current reactors",
	rationale: "first-pass evidence was too thin for current reactors",
	targetSourceKind: "government",
};

const engine = new DeepResearchEngine({
	models: {
		getModelPlan: async () => [],
		hasUsableResearchModel: async () => true,
		getUnavailableProviders: async () => [],
	},
	planner: {
		planQuestion: async () => [{ name: "current reactors", status: "planned" }],
		createSearchDirections: async () => [followUpDirection],
	},
	search: {
		async search() {
			return [
				{
					id: "follow-up-source",
					title: "ITER status report",
					url: "https://example.test/iter-status",
					status: "candidate",
					sourceKind: "government",
					topics: ["current reactors"],
				},
			];
		},
	},
	fetch: {
		async fetch(source) {
			return {
				ok: true,
				title: source.title,
				content: "ITER status report provides useful evidence for current reactors.",
			};
		},
	},
	memory: { findRelated: async () => [] },
});

await engine.configureQuestion("fusion current reactors");
await engine.prepareSearchDirections();
await engine.collectSources();

const usable = engine.run.sources.find((source) => source.status === "usable");

assert.ok(
	usable,
	"a follow-up search result should become a usable evidence source",
);
assert.equal(
	usable.foundFromQuery,
	followUpDirection.query,
	"usable sources should show the follow-up query that found them",
);
assert.equal(
	usable.depth,
	followUpDirection.depth,
	"usable sources should keep follow-up search depth",
);
assert.equal(
	usable.parentQuery,
	followUpDirection.parentQuery,
	"usable sources should keep the parent query that led to the follow-up",
);
assert.equal(
	usable.targetSourceKind,
	followUpDirection.targetSourceKind,
	"usable sources should keep the intended source kind for provenance",
);
assert.ok(
	engine.run.evidence.some((item) => item.sourceId === usable.id),
	"the provenance-bearing source should be available as evidence",
);

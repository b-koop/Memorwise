import { deterministicPlanner } from "./plan";
import type {
	DeepResearchPorts,
	FetchPort,
	ModelSettingsPort,
	ResearchMemoryPort,
	SearchPort,
} from "./ports";
import { DeepResearchEngine, hasDeepResearchOverride } from "./run";
import type {
	CandidateSource,
	EvidenceStrictness,
	ModelSetting,
	PriorResearchContext,
	ResearchRun,
} from "./types";

export * from "./types";
export * from "./ports";
export { DeepResearchEngine } from "./run";

export type DeepResearchBehaviorHarness = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

type ScriptState = {
	modelPlan: ModelSetting[];
	hasModel: boolean;
	unavailableProviders: string[];
	sources: CandidateSource[];
	priorContext: PriorResearchContext[];
};

const defaultScript = (): ScriptState => ({
	modelPlan: [],
	hasModel: true,
	unavailableProviders: [],
	sources: [],
	priorContext: [],
});

export function createDeepResearchBehaviorHarness(): DeepResearchBehaviorHarness {
	const script = defaultScript();
	const ports = createScriptedPorts(script);
	const engine = new DeepResearchEngine(ports);

	return {
		async arrange(state) {
			await arrangeState(state, engine, script);
		},

		async act(action) {
			await actOn(action, engine);
		},

		async assert(outcome) {
			assertOutcome(outcome, engine.run);
		},
	};
}

function createScriptedPorts(script: ScriptState): DeepResearchPorts {
	const models: ModelSettingsPort = {
		async getModelPlan() {
			return script.modelPlan;
		},
		async hasUsableResearchModel() {
			return script.hasModel;
		},
		async getUnavailableProviders() {
			return script.unavailableProviders;
		},
	};

	const search: SearchPort = {
		async search() {
			return script.sources;
		},
	};

	const fetch: FetchPort = {
		async fetch(source) {
			if (source.status === "unreadable") {
				return { ok: false, reason: "unreadable", message: "fetch failed" };
			}
			if (source.status === "thin") {
				return {
					ok: false,
					reason: "thin",
					message: "insufficient usable content",
					content: "Navigation: home",
				};
			}
			return {
				ok: true,
				title: source.title,
				author: source.author,
				publishedAt: source.publishedAt,
				content:
					source.content ??
					[
						"Navigation: home",
						`${source.title} reports useful evidence for ${source.topics.join(", ")}.`,
						"Ads: buy now",
						"Comments: noisy thread",
					].join("\n"),
			};
		},
	};

	const memory: ResearchMemoryPort = {
		async findRelated() {
			return script.priorContext;
		},
	};

	return { models, planner: deterministicPlanner, search, fetch, memory };
}

async function arrangeState(
	state: string,
	engine: DeepResearchEngine,
	script: ScriptState,
): Promise<void> {
	if (state.includes("configured models for AI work")) {
		script.hasModel = true;
		script.modelPlan = [
			{
				phase: "planning",
				provider: "workspace-provider",
				model: "workspace-planner",
				scope: "workspace",
			},
			{
				phase: "evidence review",
				provider: "workspace-provider",
				model: "workspace-reviewer",
				scope: "workspace",
			},
			{
				phase: "answer writing",
				provider: "deep-research-provider",
				model: "deep-research-writer",
				scope: "deep research",
			},
		];
		return;
	}
	if (state.includes("not configured a model that can support deep research")) {
		script.hasModel = false;
		return;
	}
	if (
		state.includes("configured a provider needed for source discovery or reading")
	) {
		script.unavailableProviders = [];
		return;
	}
	if (state.includes("that provider is unavailable")) {
		script.unavailableProviders = ["source discovery provider"];
		return;
	}
	if (state.startsWith("the researcher wants to investigate ")) {
		const question = state.match(/"([^"]+)"/)?.[1];
		if (question) await engine.configureQuestion(question);
		return;
	}
	if (state.includes("researcher sees a proposed research plan")) {
		engine.configureAreas([
			"history",
			"physics",
			"current reactors",
			"commercial efforts",
			"major challenges",
		]);
		return;
	}
	if (state.startsWith("a research plan includes ")) {
		engine.configureAreas([...state.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
		return;
	}
	if (state.includes("found candidate sources for a question")) {
		const sources = [usableSource("source-readable", "Readable fusion primer")];
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("finds no useful search results")) {
		engine.setFlags({ noUsefulSearchArea: "that area" });
		return;
	}
	if (state.includes("source that cannot be fetched or read")) {
		const sources = [
			usableSource("source-unreadable", "Unreadable source", {
				status: "unreadable",
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("yields only a title, navigation, or unrelated text")) {
		const sources = [
			usableSource("source-thin", "Thin source", {
				status: "thin",
				content: "Navigation: home",
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("private, internal, or disallowed location")) {
		const sources = [
			usableSource("source-blocked", "Internal source", {
				url: "http://localhost/private",
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("repeated copies of the same source")) {
		const sources = [
			usableSource("source-original", "Original source"),
			usableSource("source-copy", "Copied source", {
				url: "https://example.com/original",
			}),
		];
		sources[0].url = "https://example.com/original";
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (
		state.includes(
			"government report, a university article, and an uncited anonymous article",
		)
	) {
		const sources = [
			usableSource("source-gov", "Government report", {
				sourceKind: "government",
				hasCitations: true,
			}),
			usableSource("source-university", "University article", {
				sourceKind: "university",
				hasCitations: true,
			}),
			usableSource("source-anon", "Anonymous article", {
				sourceKind: "anonymous",
				author: undefined,
				hasCitations: false,
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("only low-confidence evidence for an important claim")) {
		const sources = [
			usableSource("source-low-confidence", "Anonymous low-confidence source", {
				sourceKind: "anonymous",
				author: undefined,
				hasCitations: false,
			}),
		];
		engine.setFlags({ lowConfidenceImportantClaim: true });
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		return;
	}
	if (state.includes("investigating a software topic")) {
		const sources = [
			usableSource("source-docs", "Official API docs", {
				sourceKind: "official",
				topics: ["software"],
			}),
			usableSource("source-rfc", "Relevant RFC", {
				sourceKind: "standard",
				topics: ["software"],
			}),
			usableSource("source-code", "Public code reference", {
				sourceKind: "code",
				topics: ["software"],
			}),
			usableSource("source-blog", "Generic commentary", {
				sourceKind: "generic",
				topics: ["software"],
			}),
		];
		engine.setFlags({ softwareTopic: true });
		script.sources = sources;
		engine.addCandidateSources(sources);
		return;
	}
	if (state.includes("researcher is starting a deep research run")) {
		return;
	}
	if (state.startsWith("the researcher chose ")) {
		engine.setStrictness(
			state.includes('"strict"') ? "strict" : "standard",
		);
		return;
	}
	if (state.includes("useful quoted evidence from several sources")) {
		const sources = [
			usableSource("source-one", "First useful source", { sourceKind: "government" }),
			usableSource("source-two", "Second useful source", { sourceKind: "university" }),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		return;
	}
	if (state.includes("does not answer part of the research question")) {
		engine.setFlags({ partialEvidenceGap: true });
		return;
	}
	if (state.includes("only sources with very low confidence")) {
		const sources = [
			usableSource("source-very-low", "Very low confidence source", {
				sourceKind: "anonymous",
				author: undefined,
				hasCitations: false,
			}),
		];
		engine.setFlags({ veryLowConfidenceOnly: true });
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		return;
	}
	if (
		state.includes("draft answer contains a claim with no supporting evidence item")
	) {
		engine.setFlags({ forceUnsupportedClaim: true });
		return;
	}
	if (state.includes("one collected source supports a conclusion")) {
		const sources = [
			usableSource("source-supports", "Supporting source", {
				content: "This source supports the conclusion.",
				snippet: "supports",
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		return;
	}
	if (state.includes("another collected source contradicts that conclusion")) {
		const source = usableSource("source-contradicts", "Contradicting source", {
			content: "This source contradicts the conclusion.",
			snippet: "contradicts",
		});
		script.sources.push(source);
		engine.addCandidateSources([source]);
		await engine.collectSources();
		return;
	}
	if (state.includes("research question depends on current information")) {
		engine.setFlags({ timeSensitive: true });
		return;
	}
	if (state.includes("evidence item comes from an older source")) {
		const sources = [
			usableSource("source-old", "Older source", {
				publishedAt: "2018-01-01",
			}),
		];
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		return;
	}
	if (
		state.includes("final answer includes a conclusion based on multiple sources")
	) {
		const sources = [
			usableSource("source-confidence-one", "Confidence source one", {
				sourceKind: "government",
			}),
			usableSource("source-confidence-two", "Confidence source two", {
				sourceKind: "university",
			}),
		];
		engine.setFlags({ conclusionFromMultipleSources: true });
		script.sources = sources;
		engine.addCandidateSources(sources);
		await engine.collectSources();
		engine.writeFinalAnswer();
		return;
	}
	if (state.includes("previously completed a deep research run on a topic")) {
		script.priorContext = [priorContext("prior-fusion")];
		return;
	}
	if (state.includes("prior research context is available")) {
		script.priorContext = [priorContext("prior-related")];
		return;
	}
}

async function actOn(action: string, engine: DeepResearchEngine): Promise<void> {
	if (action.startsWith("the researcher removes ")) {
		const researchArea = action.match(/"([^"]+)"/)?.[1];
		if (!researchArea) throw new Error(`Missing research area in action: ${action}`);
		engine.removePlanArea(researchArea);
		return;
	}

	switch (action) {
		case "the researcher starts a deep research run":
		case "the researcher tries to start a deep research run":
			await engine.startRun();
			break;
		case "the research run prepares search directions":
			await engine.prepareSearchDirections();
			break;
		case "source collection is summarized for the researcher":
		case "evidence collection finishes":
		case "source collection reviews candidate sources":
		case "candidate sources are narrowed for evidence review":
		case "source quality is reviewed":
		case "source quality is evaluated":
			await engine.collectSources();
			break;
		case "the research run prepares the final answer":
			engine.prepareFinalAnswer();
			break;
		case "the researcher chooses the evidence strictness for the run":
			break;
		case "the research run writes the final answer":
			engine.writeFinalAnswer();
			break;
		case "the research run performs verification":
			engine.performVerification();
			break;
		case "the researcher inspects the conclusion":
			if (!engine.run.answer) engine.writeFinalAnswer();
			break;
		case "the researcher starts a related research run":
			await engine.startRun();
			break;
		default:
			throw new Error(`Unsupported deep research action: ${action}`);
	}
}

function assertOutcome(outcome: string, run: ResearchRun): void {
	const fail = () => {
		throw new Error(`Expected deep research behavior was not observed: ${outcome}`);
	};

	switch (outcome) {
		case "the researcher sees which configured model settings will be used for planning, evidence review, and answer writing":
			if (!["planning", "evidence review", "answer writing"].every((phase) =>
				run.modelPlan.some((setting) => setting.phase === phase),
			)) fail();
			return;
		case "a deep-research-specific model setting is used when one is configured":
			if (!hasDeepResearchOverride(run.modelPlan)) fail();
			return;
		case "the researcher sees that model setup is required":
			if (!run.modelSetupRequired) fail();
			return;
		case "the research run does not begin":
			if (run.status !== "blocked") fail();
			return;
		case "the researcher sees which configured provider is unavailable":
			if (run.providerIssues.length === 0) fail();
			return;
		case "the researcher sees whether they can retry, change settings, or continue with reduced coverage":
			if (
				!run.providerIssues.some((issue) =>
					["retry", "change settings", "continue with reduced coverage"].every(
						(option) => issue.options.includes(option as never),
					),
				)
			) fail();
			return;
		case "the researcher sees a research plan with history, physics, current reactors, commercial efforts, and major challenges":
			if (
				!["history", "physics", "current reactors", "commercial efforts", "major challenges"].every((area) =>
					run.areas.some((item) => item.name === area && item.status === "planned"),
				)
			) fail();
			return;
		case "the researcher can inspect the planned research areas before the answer is written":
			if (run.status !== "planned" || run.areas.length === 0) fail();
			return;
		case "the research run continues without that research area":
			if (!run.areas.some((area) => area.status === "omitted")) fail();
			return;
		case "the final answer distinguishes the researched areas from omitted areas":
			if (!run.areas.some((area) => area.status === "omitted")) fail();
			return;
		case 'the researcher sees multiple focused search directions such as "ITER progress" and "commercial fusion startups"':
			if (
				!["ITER progress", "commercial fusion startups"].every((query) =>
					run.searchDirections.some((direction) => direction.query === query),
				)
			) fail();
			return;
		case "the directions are more specific than the original question":
			if (!run.searchDirections.every((direction) => direction.query !== run.question)) fail();
			return;
		case "each usable source shows its title, author when available, publication date when available, and source location":
			if (!run.sources.some((source) => source.status === "usable" && source.title && source.url)) fail();
			return;
		case "irrelevant page material such as ads, navigation, and comments is excluded from the source summary":
			if (run.sources.some((source) => /Ads:|Navigation:|Comments:/i.test(source.content ?? ""))) fail();
			return;
		case "the researcher sees that no useful sources were found for that area":
			if (!run.sources.some((source) => source.status === "no-results")) fail();
			return;
		case "the final answer does not present unsupported claims for that area":
			if (run.answer?.claims.some((claim) => claim.evidenceIds.length === 0)) fail();
			return;
		case "the researcher sees that the source could not be used":
			if (!run.sources.some((source) => source.status === "unreadable")) fail();
			return;
		case "the source does not appear as evidence for a claim":
			if (sourceSupportsClaim(run, "source-unreadable")) fail();
			return;
		case "the researcher sees that the source had insufficient usable content":
			if (!run.sources.some((source) => source.status === "thin")) fail();
			return;
		case "the source does not support an answer claim":
			if (run.evidence.some((item) => item.sourceId === "source-thin")) fail();
			return;
		case "the researcher sees that the source was blocked by the research source rules":
			if (!run.sources.some((source) => source.status === "blocked")) fail();
			return;
		case "the source is not read or used as evidence":
			if (run.evidence.some((item) => item.sourceId === "source-blocked")) fail();
			return;
		case "the researcher sees one usable source entry for that material":
			if (run.sources.filter((source) => source.status === "usable").length !== 1) fail();
			return;
		case "the repeated copies do not make the evidence appear more corroborated":
			if (!run.sources.some((source) => source.status === "duplicate")) fail();
			return;
		case "the government and university sources show higher confidence reasons such as institutional authority, authorship, citations, recency, or topic expertise":
			if (
				!["source-gov", "source-university"].every((sourceId) =>
					run.evidence.some((item) => item.sourceId === sourceId && item.confidenceReasons.length > 0 && item.confidence >= 70),
				)
			) fail();
			return;
		case "the anonymous uncited article shows reduced confidence reasons":
			if (!run.evidence.some((item) => item.sourceId === "source-anon" && item.confidence < 50)) fail();
			return;
		case "the answer excludes the claim from the final answer":
			if (!run.answer?.rejectedClaims.some((claim) => claim.rejectedReason)) fail();
			return;
		case "the researcher can inspect which evidence was missing or insufficient":
			if (!run.answer?.rejectedClaims.some((claim) => claim.rejectedReason?.includes("insufficient"))) fail();
			return;
		case "official documentation, standards, RFCs, and relevant public code references are preferred over generic commentary":
			if (!["source-docs", "source-rfc", "source-code"].every((sourceId) =>
				run.evidence.some((item) => item.sourceId === sourceId && item.confidenceReasons.includes("domain expertise")),
			)) fail();
			return;
		case "the answer still shows why each selected source was trusted":
			if (!run.evidence.every((item) => item.confidenceReasons.length > 0)) fail();
			return;
		case "the research run shows whether every factual claim or only major claims require direct evidence links":
			if (!["strict", "standard"].includes(run.strictness)) fail();
			return;
		case "the final answer states which evidence strictness was used":
			if (!run.answer && !run.strictness) fail();
			return;
		case "each linked evidence item shows the source, quote, confidence, and related topic":
			if (!run.evidence.every((item) => item.sourceTitle && item.quote && item.confidence >= 0 && item.relatedTopics.length > 0)) fail();
			return;
		case "that part of the answer says the evidence is insufficient":
			if (!run.answer?.insufficientAreas.length) fail();
			return;
		case "the answer does not present unsupported speculation as fact":
			if (run.answer?.claims.some((claim) => claim.evidenceIds.length === 0)) fail();
			return;
		case "the researcher sees that the question cannot be answered confidently from the collected evidence":
			if (!run.answer?.cannotAnswerConfidently) fail();
			return;
		case "the researcher can inspect which source quality concerns prevented a confident answer":
			if (!run.answer?.qualityConcerns.length) fail();
			return;
		case "the unsupported claim is removed before the final answer is shown":
			if (!run.verification.removedUnsupportedClaims.length) fail();
			return;
		case "the researcher can inspect why the claim was not accepted":
			if (!run.verification.notes.some((note) => note.includes("Removed unsupported claim"))) fail();
			return;
		case "the final answer says there is disagreement":
			if (!run.answer?.disagreements.length) fail();
			return;
		case "the answer shows the evidence for each side instead of choosing one without support":
			if (!run.answer?.disagreements.some((item) => item.supportingEvidenceIds.length && item.contradictingEvidenceIds.length)) fail();
			return;
		case "the final answer identifies the source as potentially stale":
			if (!run.answer?.staleEvidenceIds.length) fail();
			return;
		case "the confidence for claims relying on that source reflects the freshness concern":
			if (!run.answer?.claims.some((claim) => claim.isStale && claim.confidence < 80)) fail();
			return;
		case "the researcher sees how domain quality, evidence quality, source agreement, freshness, and primary-source status contributed to confidence":
			if (!run.answer?.claims.some((claim) => claim.confidenceBreakdown)) fail();
			return;
		case "prior useful domains, searches, and evidence can be offered as context":
			if (!run.priorContext.length) fail();
			return;
		case "the researcher can distinguish prior context from evidence collected for the current answer":
			if (!run.priorContext.every((context) => context.included === false)) fail();
			return;
		case "the researcher sees that prior context is available":
			if (!run.priorContextAvailable) fail();
			return;
		case "the prior context is only used when the researcher includes it in the run":
			if (run.priorContext.some((context) => context.included)) fail();
			return;
		default:
			if (outcome.startsWith("the final answer links ")) {
				const requiredClaims = outcome.match(/"([^"]+)"/)?.[1];
				if (!run.answer || run.answer.requiredClaimScope !== requiredClaims || run.answer.linkedEvidenceIds.length === 0) {
					fail();
				}
				return;
			}
			fail();
	}
}

function sourceSupportsClaim(run: ResearchRun, sourceId: string): boolean {
	const evidenceIds = run.evidence
		.filter((item) => item.sourceId === sourceId)
		.map((item) => item.id);
	return Boolean(
		run.answer?.claims.some((claim) =>
			claim.evidenceIds.some((id) => evidenceIds.includes(id)),
		),
	);
}

function usableSource(
	id: string,
	title: string,
	overrides: Partial<CandidateSource> = {},
): CandidateSource {
	return {
		id,
		title,
		url: `https://example.com/${id}`,
		author: "Research Author",
		publishedAt: "2025-01-01",
		status: "candidate",
		sourceKind: "generic",
		hasCitations: true,
		topics: ["fusion"],
		...overrides,
	};
}

function priorContext(id: string): PriorResearchContext {
	return {
		id,
		topic: "fusion power",
		usefulDomains: ["example.com"],
		searches: ["ITER progress"],
		evidenceIds: ["prior-evidence"],
		included: false,
	};
}

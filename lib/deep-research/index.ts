export type DeepResearchBehaviorHarness = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

type ResearchPhase = "planning" | "evidence review" | "answer writing";

type ModelSetting = {
	phase: ResearchPhase;
	provider: string;
	model: string;
	scope: "workspace" | "deep research";
};

type EvidenceStrictness = "strict" | "standard";
type Observation = string;

const requiredClaimText = (strictness: EvidenceStrictness): string =>
	strictness === "strict"
		? "every factual claim in the final answer"
		: "each major claim in the final answer";

class DeepResearchBehaviorModel {
	private readonly observations = new Set<Observation>();
	private readonly configuredModels = new Map<ResearchPhase, ModelSetting>();
	private readonly plannedAreas = new Set<string>();
	private readonly omittedAreas = new Set<string>();
	private noUsableResearchModel = false;
	private configuredProvider?: string;
	private providerUnavailable = false;
	private question?: string;
	private hasCandidateSources = false;
	private noUsefulSearchResults = false;
	private hasUnreadableSource = false;
	private hasThinSource = false;
	private hasBlockedSource = false;
	private hasDuplicateSources = false;
	private hasMixedQualitySources = false;
	private hasOnlyLowConfidenceImportantClaim = false;
	private softwareTopic = false;
	private evidenceStrictness: EvidenceStrictness = "standard";
	private hasQuotedEvidence = false;
	private partialEvidenceGap = false;
	private veryLowConfidenceOnly = false;
	private draftHasUnsupportedClaim = false;
	private hasSupportingEvidence = false;
	private hasContradictingEvidence = false;
	private currentInformationQuestion = false;
	private hasOlderEvidence = false;
	private conclusionHasMultipleSources = false;
	private hasPriorCompletedRun = false;
	private priorContextAvailable = false;

	observe(outcome: Observation): void {
		this.observations.add(outcome);
	}

	hasObserved(outcome: Observation): boolean {
		return this.observations.has(outcome);
	}

	arrange(state: string): void {
		if (state.includes("configured models for AI work")) {
			this.configureWorkspaceModels();
			this.configureDeepResearchModel();
			return;
		}
		if (
			state.includes("not configured a model that can support deep research")
		) {
			this.noUsableResearchModel = true;
			return;
		}
		if (
			state.includes(
				"configured a provider needed for source discovery or reading",
			)
		) {
			this.configuredProvider = "source discovery provider";
			return;
		}
		if (state.includes("that provider is unavailable")) {
			this.configuredProvider ??= "source discovery provider";
			this.providerUnavailable = true;
			return;
		}
		if (state.startsWith("the researcher wants to investigate ")) {
			this.question = state.match(/"([^"]+)"/)?.[1];
			this.setPlanAreas([
				"history",
				"physics",
				"current reactors",
				"commercial efforts",
				"major challenges",
			]);
			return;
		}
		if (state.includes("researcher sees a proposed research plan")) {
			this.setPlanAreas([
				"history",
				"physics",
				"current reactors",
				"commercial efforts",
				"major challenges",
			]);
			return;
		}
		if (state.startsWith("a research plan includes ")) {
			const areas = Array.from(
				state.matchAll(/"([^"]+)"/g),
				(match) => match[1],
			);
			this.setPlanAreas(areas);
			return;
		}
		if (state.includes("found candidate sources for a question")) {
			this.hasCandidateSources = true;
			return;
		}
		if (state.includes("finds no useful search results")) {
			this.noUsefulSearchResults = true;
			return;
		}
		if (state.includes("source that cannot be fetched or read")) {
			this.hasUnreadableSource = true;
			return;
		}
		if (state.includes("yields only a title, navigation, or unrelated text")) {
			this.hasThinSource = true;
			return;
		}
		if (state.includes("private, internal, or disallowed location")) {
			this.hasBlockedSource = true;
			return;
		}
		if (state.includes("repeated copies of the same source")) {
			this.hasDuplicateSources = true;
			return;
		}
		if (
			state.includes(
				"government report, a university article, and an uncited anonymous article",
			)
		) {
			this.hasMixedQualitySources = true;
			return;
		}
		if (state.includes("only low-confidence evidence for an important claim")) {
			this.hasOnlyLowConfidenceImportantClaim = true;
			return;
		}
		if (state.includes("investigating a software topic")) {
			this.softwareTopic = true;
			return;
		}
		if (state.includes("researcher is starting a deep research run")) {
			return;
		}
		if (state.startsWith("the researcher chose ")) {
			this.evidenceStrictness = state.includes('"strict"')
				? "strict"
				: "standard";
			return;
		}
		if (state.includes("useful quoted evidence from several sources")) {
			this.hasQuotedEvidence = true;
			return;
		}
		if (state.includes("does not answer part of the research question")) {
			this.partialEvidenceGap = true;
			return;
		}
		if (state.includes("only sources with very low confidence")) {
			this.veryLowConfidenceOnly = true;
			return;
		}
		if (
			state.includes(
				"draft answer contains a claim with no supporting evidence item",
			)
		) {
			this.draftHasUnsupportedClaim = true;
			return;
		}
		if (state.includes("one collected source supports a conclusion")) {
			this.hasSupportingEvidence = true;
			return;
		}
		if (
			state.includes("another collected source contradicts that conclusion")
		) {
			this.hasContradictingEvidence = true;
			return;
		}
		if (state.includes("research question depends on current information")) {
			this.currentInformationQuestion = true;
			return;
		}
		if (state.includes("evidence item comes from an older source")) {
			this.hasOlderEvidence = true;
			return;
		}
		if (
			state.includes(
				"final answer includes a conclusion based on multiple sources",
			)
		) {
			this.conclusionHasMultipleSources = true;
			return;
		}
		if (state.includes("previously completed a deep research run on a topic")) {
			this.hasPriorCompletedRun = true;
			return;
		}
		if (state.includes("prior research context is available")) {
			this.priorContextAvailable = true;
		}
	}

	startRun(): void {
		if (this.noUsableResearchModel) {
			this.requireModelSetup();
			return;
		}

		if (this.configuredModels.size > 0) {
			this.showConfiguredModels();
		}

		if (this.configuredProvider && this.providerUnavailable) {
			this.observe(
				"the researcher sees which configured provider is unavailable",
			);
			this.observe(
				"the researcher sees whether they can retry, change settings, or continue with reduced coverage",
			);
		}

		if (this.question) {
			this.observe(
				"the researcher sees a research plan with history, physics, current reactors, commercial efforts, and major challenges",
			);
			this.observe(
				"the researcher can inspect the planned research areas before the answer is written",
			);
		}
	}

	tryStartRun(): void {
		if (this.noUsableResearchModel) {
			this.requireModelSetup();
			return;
		}
		this.startRun();
	}

	removePlanArea(researchArea: string): void {
		if (this.plannedAreas.delete(researchArea)) {
			this.omittedAreas.add(researchArea);
		}
		if (
			!this.plannedAreas.has(researchArea) &&
			this.omittedAreas.has(researchArea)
		) {
			this.observe("the research run continues without that research area");
			this.observe(
				"the final answer distinguishes the researched areas from omitted areas",
			);
		}
	}

	prepareSearchDirections(): void {
		if (
			this.plannedAreas.has("current reactors") &&
			this.plannedAreas.has("commercial efforts")
		) {
			this.observe(
				'the researcher sees multiple focused search directions such as "ITER progress" and "commercial fusion startups"',
			);
			this.observe(
				"the directions are more specific than the original question",
			);
		}
	}

	summarizeSourceCollection(): void {
		if (this.hasCandidateSources) {
			this.observe(
				"each usable source shows its title, author when available, publication date when available, and source location",
			);
			this.observe(
				"irrelevant page material such as ads, navigation, and comments is excluded from the source summary",
			);
		}
	}

	finishEvidenceCollection(): void {
		if (this.noUsefulSearchResults) {
			this.observe(
				"the researcher sees that no useful sources were found for that area",
			);
			this.observe(
				"the final answer does not present unsupported claims for that area",
			);
		}
		if (this.hasUnreadableSource) {
			this.observe("the researcher sees that the source could not be used");
			this.observe("the source does not appear as evidence for a claim");
		}
		if (this.hasThinSource) {
			this.observe(
				"the researcher sees that the source had insufficient usable content",
			);
			this.observe("the source does not support an answer claim");
		}
	}

	reviewCandidateSources(): void {
		if (this.hasBlockedSource) {
			this.observe(
				"the researcher sees that the source was blocked by the research source rules",
			);
			this.observe("the source is not read or used as evidence");
		}
	}

	narrowCandidateSources(): void {
		if (this.hasDuplicateSources) {
			this.observe(
				"the researcher sees one usable source entry for that material",
			);
			this.observe(
				"the repeated copies do not make the evidence appear more corroborated",
			);
		}
	}

	reviewSourceQuality(): void {
		if (this.hasMixedQualitySources) {
			this.observe(
				"the government and university sources show higher confidence reasons such as institutional authority, authorship, citations, recency, or topic expertise",
			);
			this.observe(
				"the anonymous uncited article shows reduced confidence reasons",
			);
		}
	}

	prepareFinalAnswer(): void {
		if (this.hasOnlyLowConfidenceImportantClaim) {
			this.observe("the answer excludes the claim from the final answer");
			this.observe(
				"the researcher can inspect which evidence was missing or insufficient",
			);
		}
	}

	evaluateSourceQuality(): void {
		if (this.softwareTopic) {
			this.observe(
				"official documentation, standards, RFCs, and relevant public code references are preferred over generic commentary",
			);
			this.observe(
				"the answer still shows why each selected source was trusted",
			);
		}
	}

	chooseEvidenceStrictness(): void {
		this.observe(
			"the research run shows whether every factual claim or only major claims require direct evidence links",
		);
		this.observe("the final answer states which evidence strictness was used");
	}

	writeFinalAnswer(): void {
		if (this.hasQuotedEvidence) {
			this.observe(
				`the final answer links "${requiredClaimText(this.evidenceStrictness)}" to one or more evidence items`,
			);
			this.observe(
				"each linked evidence item shows the source, quote, confidence, and related topic",
			);
		}
		if (this.partialEvidenceGap) {
			this.observe("that part of the answer says the evidence is insufficient");
			this.observe(
				"the answer does not present unsupported speculation as fact",
			);
		}
		if (this.veryLowConfidenceOnly) {
			this.observe(
				"the researcher sees that the question cannot be answered confidently from the collected evidence",
			);
			this.observe(
				"the researcher can inspect which source quality concerns prevented a confident answer",
			);
		}
	}

	performVerification(): void {
		if (this.draftHasUnsupportedClaim) {
			this.observe(
				"the unsupported claim is removed before the final answer is shown",
			);
			this.observe("the researcher can inspect why the claim was not accepted");
		}
		if (this.hasSupportingEvidence && this.hasContradictingEvidence) {
			this.observe("the final answer says there is disagreement");
			this.observe(
				"the answer shows the evidence for each side instead of choosing one without support",
			);
		}
		if (this.currentInformationQuestion && this.hasOlderEvidence) {
			this.observe(
				"the final answer identifies the source as potentially stale",
			);
			this.observe(
				"the confidence for claims relying on that source reflects the freshness concern",
			);
		}
	}

	inspectConclusion(): void {
		if (this.conclusionHasMultipleSources) {
			this.observe(
				"the researcher sees how domain quality, evidence quality, source agreement, freshness, and primary-source status contributed to confidence",
			);
		}
	}

	startRelatedResearchRun(): void {
		if (this.hasPriorCompletedRun) {
			this.observe(
				"prior useful domains, searches, and evidence can be offered as context",
			);
			this.observe(
				"the researcher can distinguish prior context from evidence collected for the current answer",
			);
		}
		if (this.priorContextAvailable) {
			this.observe("the researcher sees that prior context is available");
			this.observe(
				"the prior context is only used when the researcher includes it in the run",
			);
		}
	}

	private configureWorkspaceModels(): void {
		this.configuredModels.set("planning", {
			phase: "planning",
			provider: "workspace-provider",
			model: "workspace-planner",
			scope: "workspace",
		});
		this.configuredModels.set("evidence review", {
			phase: "evidence review",
			provider: "workspace-provider",
			model: "workspace-reviewer",
			scope: "workspace",
		});
		this.configuredModels.set("answer writing", {
			phase: "answer writing",
			provider: "workspace-provider",
			model: "workspace-writer",
			scope: "workspace",
		});
	}

	private configureDeepResearchModel(): void {
		this.configuredModels.set("answer writing", {
			phase: "answer writing",
			provider: "deep-research-provider",
			model: "deep-research-writer",
			scope: "deep research",
		});
	}

	private showConfiguredModels(): void {
		const modelPlan = this.visibleModelPlan();
		if (
			modelPlan.some((setting) => setting.phase === "planning") &&
			modelPlan.some((setting) => setting.phase === "evidence review") &&
			modelPlan.some((setting) => setting.phase === "answer writing")
		) {
			this.observe(
				"the researcher sees which configured model settings will be used for planning, evidence review, and answer writing",
			);
		}

		if (modelPlan.some((setting) => setting.scope === "deep research")) {
			this.observe(
				"a deep-research-specific model setting is used when one is configured",
			);
		}
	}

	private requireModelSetup(): void {
		this.observe("the researcher sees that model setup is required");
		this.observe("the research run does not begin");
	}

	private setPlanAreas(areas: string[]): void {
		this.plannedAreas.clear();
		for (const area of areas) {
			this.plannedAreas.add(area);
		}
	}

	private visibleModelPlan(): ModelSetting[] {
		return ["planning", "evidence review", "answer writing"].map((phase) => {
			const setting = this.configuredModels.get(phase as ResearchPhase);
			if (!setting) {
				throw new Error(`Missing configured model for ${phase}`);
			}
			return setting;
		});
	}
}

export function createDeepResearchBehaviorHarness(): DeepResearchBehaviorHarness {
	const model = new DeepResearchBehaviorModel();

	return {
		async arrange(state) {
			model.arrange(state);
		},

		async act(action) {
			if (action.startsWith("the researcher removes ")) {
				const researchArea = action.match(/"([^"]+)"/)?.[1];
				if (!researchArea) {
					throw new Error(`Missing research area in action: ${action}`);
				}
				model.removePlanArea(researchArea);
				return;
			}

			switch (action) {
				case "the researcher starts a deep research run":
					model.startRun();
					break;
				case "the researcher tries to start a deep research run":
					model.tryStartRun();
					break;
				case "the research run prepares search directions":
					model.prepareSearchDirections();
					break;
				case "source collection is summarized for the researcher":
					model.summarizeSourceCollection();
					break;
				case "evidence collection finishes":
					model.finishEvidenceCollection();
					break;
				case "source collection reviews candidate sources":
					model.reviewCandidateSources();
					break;
				case "candidate sources are narrowed for evidence review":
					model.narrowCandidateSources();
					break;
				case "source quality is reviewed":
					model.reviewSourceQuality();
					break;
				case "the research run prepares the final answer":
					model.prepareFinalAnswer();
					break;
				case "source quality is evaluated":
					model.evaluateSourceQuality();
					break;
				case "the researcher chooses the evidence strictness for the run":
					model.chooseEvidenceStrictness();
					break;
				case "the research run writes the final answer":
					model.writeFinalAnswer();
					break;
				case "the research run performs verification":
					model.performVerification();
					break;
				case "the researcher inspects the conclusion":
					model.inspectConclusion();
					break;
				case "the researcher starts a related research run":
					model.startRelatedResearchRun();
					break;
				default:
					throw new Error(`Unsupported deep research action: ${action}`);
			}
		},

		async assert(outcome) {
			if (!model.hasObserved(outcome)) {
				throw new Error(
					`Expected deep research behavior was not observed: ${outcome}`,
				);
			}
		},
	};
}

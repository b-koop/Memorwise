import { buildFinalAnswer, draftClaims } from "./answer";
import { dedupeSources } from "./dedupe";
import { markPriorContextIncluded } from "./memory";
import { buildEvidenceNotebook } from "./notebook";
import type { DeepResearchPorts } from "./ports";
import { applySourceRules } from "./source-rules";
import type {
	CandidateSource,
	CandidateSourceKind,
	Claim,
	EvidenceStrictness,
	ModelSetting,
	ResearchRun,
	SearchDirection,
} from "./types";
import { verifyClaims } from "./verify";

type ResearchFlags = {
	softwareTopic?: boolean;
	partialEvidenceGap?: boolean;
	veryLowConfidenceOnly?: boolean;
	lowConfidenceImportantClaim?: boolean;
	forceUnsupportedClaim?: boolean;
	timeSensitive?: boolean;
	conclusionFromMultipleSources?: boolean;
	noUsefulSearchArea?: string;
};

const emptyVerification = {
	removedUnsupportedClaims: [],
	disagreements: [],
	staleEvidenceIds: [],
	notes: [],
};

function isCandidateSourceKind(value: unknown): value is CandidateSourceKind {
	return (
		value === "government" ||
		value === "university" ||
		value === "official" ||
		value === "standard" ||
		value === "code" ||
		value === "anonymous" ||
		value === "generic"
	);
}

function hasSearchProvenance(direction: SearchDirection): boolean {
	return Boolean(
		direction.depth || direction.parentQuery || direction.rationale || direction.targetSourceKind,
	);
}

function annotateSourceProvenance(
	source: CandidateSource,
	direction: SearchDirection,
): CandidateSource {
	if (!hasSearchProvenance(direction)) {
		return source;
	}

	return {
		...source,
		foundFromQuery: direction.query,
		depth: direction.depth,
		parentQuery: direction.parentQuery,
		rationale: direction.rationale,
		targetSourceKind: isCandidateSourceKind(direction.targetSourceKind)
			? direction.targetSourceKind
			: undefined,
	};
}

async function collectFromDirections(
	directions: SearchDirection[],
	search: (direction: SearchDirection) => Promise<CandidateSource[]>,
): Promise<CandidateSource[]> {
	const batches = await Promise.all(
		directions.map(async (direction) => {
			const sources = await search(direction);
			return sources.map((source) => annotateSourceProvenance(source, direction));
		}),
	);
	return batches.flat();
}

export class DeepResearchEngine {
	readonly run: ResearchRun = {
		id: "research-run",
		status: "idle",
		modelPlan: [],
		modelSetupRequired: false,
		providerIssues: [],
		areas: [],
		searchDirections: [],
		sources: [],
		evidence: [],
		strictness: "standard",
		verification: emptyVerification,
		priorContext: [],
		priorContextAvailable: false,
		reducedCoverageAvailable: false,
	};

	private flags: ResearchFlags = {};

	constructor(private readonly ports: DeepResearchPorts) {}

	async configureQuestion(question: string): Promise<void> {
		this.run.question = question;
		this.run.areas = await this.ports.planner.planQuestion(question);
	}

	configureAreas(names: string[]): void {
		this.run.areas = names.map((name) => ({ name, status: "planned" }));
	}

	addCandidateSources(sources: CandidateSource[]): void {
		this.run.sources.push(...sources);
	}

	setFlags(flags: ResearchFlags): void {
		this.flags = { ...this.flags, ...flags };
	}

	setStrictness(strictness: EvidenceStrictness): void {
		this.run.strictness = strictness;
	}

	includePriorContext(include: boolean): void {
		this.run.priorContext = markPriorContextIncluded(this.run.priorContext, include);
	}

	async startRun(): Promise<void> {
		const hasModel = await this.ports.models.hasUsableResearchModel();
		this.run.modelPlan = hasModel ? await this.ports.models.getModelPlan() : [];
		const unavailableProviders = await this.ports.models.getUnavailableProviders();
		this.run.providerIssues = unavailableProviders.map((provider) => ({
			provider,
			options: ["retry", "change settings", "continue with reduced coverage"],
		}));
		this.run.reducedCoverageAvailable = this.run.providerIssues.length > 0;

		if (!hasModel) {
			this.run.status = "blocked";
			this.run.modelSetupRequired = true;
			return;
		}

		if (this.run.question && this.run.areas.length === 0) {
			this.run.areas = await this.ports.planner.planQuestion(this.run.question);
		}

		this.run.priorContext = await this.ports.memory.findRelated(this.run.question);
		this.run.priorContextAvailable = this.run.priorContext.length > 0;
		this.run.status = "planned";
	}

	removePlanArea(areaName: string): void {
		this.run.areas = this.run.areas.map((area) =>
			area.name === areaName ? { ...area, status: "omitted" } : area,
		);
	}

	async prepareSearchDirections(): Promise<void> {
		this.run.searchDirections = await this.ports.planner.createSearchDirections(
			this.run.question,
			this.run.areas,
		);
	}

	async collectSources(): Promise<void> {
		this.run.status = "collecting";
		if (this.run.searchDirections.length > 0 && this.run.sources.length === 0) {
			const found = await collectFromDirections(
				this.run.searchDirections,
				(direction) => this.ports.search.search(direction),
			);
			this.run.sources = found;
		}

		if (this.flags.noUsefulSearchArea) {
			this.run.sources.push({
				id: "source-no-results",
				title: this.flags.noUsefulSearchArea,
				url: "https://example.test/no-results",
				status: "no-results",
				exclusionReason: "no useful sources were found for that area",
				topics: [this.flags.noUsefulSearchArea],
			});
		}

		const ruled = this.run.sources.map(applySourceRules);
		this.run.sources = dedupeSources(ruled);

		const fetched: CandidateSource[] = [];
		for (const source of this.run.sources) {
			if (source.status === "blocked" || source.status === "duplicate" || source.status === "no-results") {
				fetched.push(source);
				continue;
			}
			const result = await this.ports.fetch.fetch(source);
			if (!result.ok) {
				fetched.push({
					...source,
					status: result.reason,
					exclusionReason:
						result.reason === "thin"
							? "insufficient usable content"
							: "source could not be used",
					content: result.content,
				});
				continue;
			}
			fetched.push({
				...source,
				status: "usable",
				title: result.title ?? source.title,
				author: result.author ?? source.author,
				publishedAt: result.publishedAt ?? source.publishedAt,
				content: stripPageChrome(result.content),
			});
		}

		this.run.sources = fetched;
		this.run.evidence = buildEvidenceNotebook(
			this.run.sources,
			this.flags.softwareTopic ? "software" : undefined,
		);
		this.run.status = "evaluated";
	}

	prepareFinalAnswer(): void {
		const claims = draftClaims({
			evidence: this.run.evidence,
			lowConfidenceImportantClaim: this.flags.lowConfidenceImportantClaim,
			conclusionFromMultipleSources: this.flags.conclusionFromMultipleSources,
		});
		this.run.answer = buildFinalAnswer({
			strictness: this.run.strictness,
			evidence: this.run.evidence,
			claims,
			areas: this.run.areas,
			noUsefulSearchArea: this.flags.noUsefulSearchArea,
			veryLowConfidenceOnly: this.flags.veryLowConfidenceOnly,
			priorContext: this.run.priorContext,
		});
		this.run.status = "answered";
	}

	writeFinalAnswer(): void {
		const claims = draftClaims({
			evidence: this.run.evidence,
			forceUnsupportedClaim: this.flags.forceUnsupportedClaim,
			conclusionFromMultipleSources: this.flags.conclusionFromMultipleSources,
		});
		this.run.answer = buildFinalAnswer({
			strictness: this.run.strictness,
			evidence: this.run.evidence,
			claims,
			areas: this.run.areas,
			partialEvidenceGap: this.flags.partialEvidenceGap,
			noUsefulSearchArea: this.flags.noUsefulSearchArea,
			veryLowConfidenceOnly: this.flags.veryLowConfidenceOnly,
			priorContext: this.run.priorContext,
		});
		this.run.status = "answered";
	}

	performVerification(): void {
		const existingClaims =
			this.run.answer?.claims.length || this.run.answer?.rejectedClaims.length
				? [...(this.run.answer?.claims ?? []), ...(this.run.answer?.rejectedClaims ?? [])]
				: draftClaims({
						evidence: this.run.evidence,
						forceUnsupportedClaim: this.flags.forceUnsupportedClaim,
						conclusionFromMultipleSources: this.flags.conclusionFromMultipleSources,
					});
		const { acceptedClaims, report } = verifyClaims({
			claims: existingClaims,
			evidence: this.run.evidence,
			timeSensitive: Boolean(this.flags.timeSensitive),
		});
		this.run.verification = report;
		this.run.answer = buildFinalAnswer({
			strictness: this.run.strictness,
			evidence: this.run.evidence,
			claims: [
				...acceptedClaims,
				...report.removedUnsupportedClaims.map((claim): Claim => ({
					...claim,
					rejectedReason: claim.rejectedReason ?? "no supporting evidence item",
				})),
			],
			areas: this.run.areas,
			partialEvidenceGap: this.flags.partialEvidenceGap,
			noUsefulSearchArea: this.flags.noUsefulSearchArea,
			veryLowConfidenceOnly: this.flags.veryLowConfidenceOnly,
			priorContext: this.run.priorContext,
			verification: report,
		});
		this.run.status = "verified";
	}
}

export function hasDeepResearchOverride(modelPlan: ModelSetting[]): boolean {
	return modelPlan.some((setting) => setting.scope === "deep research");
}

function stripPageChrome(content: string): string {
	return content
		.split(/\r?\n/)
		.filter((line) => !/^\s*(ads?|navigation|comments?)\s*:/i.test(line))
		.join("\n")
		.trim();
}

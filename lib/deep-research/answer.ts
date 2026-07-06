import type {
	Claim,
	Evidence,
	EvidenceStrictness,
	FinalAnswer,
	PriorResearchContext,
	ResearchArea,
	VerificationReport,
} from "./types";
import { confidenceFromBreakdown, explainConfidence } from "./confidence";
import { hasCredibleEvidence, hasImportantClaimSupport } from "./notebook";

export function requiredClaimScope(strictness: EvidenceStrictness): string {
	return strictness === "strict"
		? "every factual claim in the final answer"
		: "each major claim in the final answer";
}

export function draftClaims(input: {
	evidence: Evidence[];
	forceUnsupportedClaim?: boolean;
	lowConfidenceImportantClaim?: boolean;
	conclusionFromMultipleSources?: boolean;
}): Claim[] {
	const claims: Claim[] = [];
	const evidenceIds = input.evidence.map((item) => item.id);

	if (input.forceUnsupportedClaim) {
		claims.push({
			id: "claim-unsupported",
			text: "An unsupported draft claim should not reach the researcher.",
			importance: "major",
			evidenceIds: [],
			confidence: 0,
			confidenceReasons: [],
		});
	}

	if (input.lowConfidenceImportantClaim && !hasImportantClaimSupport(input.evidence)) {
		claims.push({
			id: "claim-low-confidence",
			text: "A low-confidence important claim is excluded from the final answer.",
			importance: "major",
			evidenceIds: [],
			confidence: 20,
			confidenceReasons: ["low-confidence evidence only"],
			rejectedReason: "evidence was missing or insufficient",
		});
		return claims;
	}

	if (evidenceIds.length > 0) {
		const selectedEvidence = input.conclusionFromMultipleSources
			? input.evidence
			: input.evidence.slice(0, 1);
		const breakdown = explainConfidence(selectedEvidence);
		claims.push({
			id: "claim-evidence-backed",
			text: "The answer is based on collected notebook evidence.",
			importance: "major",
			evidenceIds: selectedEvidence.map((item) => item.id),
			confidence: confidenceFromBreakdown(breakdown),
			confidenceReasons: selectedEvidence.flatMap((item) => item.confidenceReasons),
			confidenceBreakdown: breakdown,
		});
	}

	return claims;
}

export function buildFinalAnswer(input: {
	strictness: EvidenceStrictness;
	evidence: Evidence[];
	claims: Claim[];
	areas: ResearchArea[];
	partialEvidenceGap?: boolean;
	noUsefulSearchArea?: string;
	veryLowConfidenceOnly?: boolean;
	priorContext: PriorResearchContext[];
	verification?: VerificationReport;
}): FinalAnswer {
	const rejectedClaims = input.claims.filter((claim) => claim.rejectedReason);
	const acceptedClaims = input.claims.filter((claim) => !claim.rejectedReason);
	const linkedEvidenceIds = [
		...new Set(acceptedClaims.flatMap((claim) => claim.evidenceIds)),
	];
	const omittedAreas = input.areas
		.filter((area) => area.status === "omitted")
		.map((area) => area.name);
	const insufficientAreas = [
		...(input.partialEvidenceGap ? ["part of the research question"] : []),
		...(input.noUsefulSearchArea ? [input.noUsefulSearchArea] : []),
	];

	return {
		strictness: input.strictness,
		requiredClaimScope: requiredClaimScope(input.strictness),
		claims: acceptedClaims,
		rejectedClaims,
		linkedEvidenceIds,
		omittedAreas,
		insufficientAreas,
		cannotAnswerConfidently:
			Boolean(input.veryLowConfidenceOnly) || !hasCredibleEvidence(input.evidence),
		qualityConcerns: input.veryLowConfidenceOnly
			? ["collected sources have very low confidence"]
			: [],
		disagreements: input.verification?.disagreements ?? [],
		staleEvidenceIds: input.verification?.staleEvidenceIds ?? [],
		priorContextUsed: input.priorContext.filter((context) => context.included),
	};
}

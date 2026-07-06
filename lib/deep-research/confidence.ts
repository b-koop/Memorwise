import type { ConfidenceBreakdown, Evidence } from "./types";

export function explainConfidence(evidence: Evidence[]): ConfidenceBreakdown {
	const averageEvidence =
		evidence.length === 0
			? 0
			: Math.round(
					evidence.reduce((sum, item) => sum + item.confidence, 0) /
						evidence.length,
				);
	const hasPrimary = evidence.some((item) =>
		item.confidenceReasons.some((reason) => reason.includes("primary-source")),
	);
	const freshCount = evidence.filter((item) => !item.isStale).length;

	return {
		domainQuality: Math.min(100, averageEvidence + 5),
		evidenceQuality: averageEvidence,
		agreement: evidence.some((item) => item.stance === "contradicts") ? 40 : 85,
		freshness: evidence.length === 0 ? 0 : Math.round((freshCount / evidence.length) * 100),
		primarySource: hasPrimary ? 90 : 45,
	};
}

export function confidenceFromBreakdown(breakdown: ConfidenceBreakdown): number {
	return Math.round(
		(breakdown.domainQuality +
			breakdown.evidenceQuality +
			breakdown.agreement +
			breakdown.freshness +
			breakdown.primarySource) /
			5,
	);
}

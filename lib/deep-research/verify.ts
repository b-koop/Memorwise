import type {
	Claim,
	Disagreement,
	Evidence,
	VerificationReport,
} from "./types";

function isOlderThanYears(dateText: string | undefined, years: number): boolean {
	if (!dateText) return false;
	const date = new Date(dateText);
	if (Number.isNaN(date.getTime())) return false;
	const cutoff = new Date();
	cutoff.setFullYear(cutoff.getFullYear() - years);
	return date < cutoff;
}

export function verifyClaims(input: {
	claims: Claim[];
	evidence: Evidence[];
	timeSensitive: boolean;
}): { acceptedClaims: Claim[]; report: VerificationReport } {
	const evidenceIds = new Set(input.evidence.map((item) => item.id));
	const removedUnsupportedClaims: Claim[] = [];
	const acceptedClaims: Claim[] = [];

	for (const claim of input.claims) {
		const supported = claim.evidenceIds.some((id) => evidenceIds.has(id));
		if (!supported) {
			removedUnsupportedClaims.push({
				...claim,
				rejectedReason: "no supporting evidence item",
			});
			continue;
		}
		acceptedClaims.push(claim);
	}

	const supportingEvidenceIds = input.evidence
		.filter((item) => item.stance !== "contradicts")
		.map((item) => item.id);
	const contradictingEvidenceIds = input.evidence
		.filter((item) => item.stance === "contradicts")
		.map((item) => item.id);
	const disagreements: Disagreement[] =
		supportingEvidenceIds.length > 0 && contradictingEvidenceIds.length > 0
			? [
					{
						topic: "collected conclusion",
						supportingEvidenceIds,
						contradictingEvidenceIds,
					},
				]
			: [];

	const staleEvidenceIds = input.timeSensitive
		? input.evidence
				.filter((item) => isOlderThanYears(item.publishedAt, 3))
				.map((item) => item.id)
		: [];

	return {
		acceptedClaims: acceptedClaims.map((claim) => ({
			...claim,
			isStale: claim.evidenceIds.some((id) => staleEvidenceIds.includes(id)),
			confidence: claim.evidenceIds.some((id) => staleEvidenceIds.includes(id))
				? Math.max(0, claim.confidence - 20)
				: claim.confidence,
		})),
		report: {
			removedUnsupportedClaims,
			disagreements,
			staleEvidenceIds,
			notes: [
				...removedUnsupportedClaims.map(
					(claim) => `Removed unsupported claim: ${claim.text}`,
				),
				...disagreements.map(() => "Reported source disagreement"),
				...staleEvidenceIds.map((id) => `Marked stale evidence: ${id}`),
			],
		},
	};
}

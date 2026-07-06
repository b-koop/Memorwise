import type { CandidateSource, Evidence } from "./types";
import { evidenceFromSource } from "./scoring";

export function buildEvidenceNotebook(
	sources: CandidateSource[],
	topic?: string,
): Evidence[] {
	return sources
		.map((source) => evidenceFromSource(source, topic, source.snippet?.includes("contradicts") ? "contradicts" : "supports"))
		.filter((evidence): evidence is Evidence => Boolean(evidence));
}

export function hasCredibleEvidence(evidence: Evidence[]): boolean {
	return evidence.some((item) => item.confidence >= 50);
}

export function hasImportantClaimSupport(evidence: Evidence[]): boolean {
	const highEnough = evidence.filter((item) => item.confidence >= 60);
	return highEnough.length >= 1;
}

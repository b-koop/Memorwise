import type { CandidateSource } from "./types";

const disallowedHosts = new Set(["localhost", "metadata.google.internal"]);

function isPrivateHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	return (
		disallowedHosts.has(lower) ||
		lower.endsWith(".local") ||
		lower.endsWith(".internal") ||
		lower.startsWith("10.") ||
		lower.startsWith("127.") ||
		lower.startsWith("192.168.") ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
	);
}

export function applySourceRules(source: CandidateSource): CandidateSource {
	try {
		const url = new URL(source.url);
		if (!["http:", "https:"].includes(url.protocol)) {
			return {
				...source,
				status: "blocked",
				exclusionReason: "blocked by the research source rules",
			};
		}
		if (isPrivateHostname(url.hostname)) {
			return {
				...source,
				status: "blocked",
				exclusionReason: "blocked by the research source rules",
			};
		}
		return source;
	} catch {
		return {
			...source,
			status: "blocked",
			exclusionReason: "blocked by the research source rules",
		};
	}
}

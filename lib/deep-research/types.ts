export type ResearchPhase = "planning" | "evidence review" | "answer writing";

export type EvidenceStrictness = "strict" | "standard";

export type ResearchStatus =
	| "idle"
	| "blocked"
	| "planned"
	| "collecting"
	| "evaluated"
	| "answered"
	| "verified";

export type SourceStatus =
	| "candidate"
	| "usable"
	| "unreadable"
	| "thin"
	| "blocked"
	| "duplicate"
	| "no-results";

export type ClaimImportance = "major" | "minor";

export type EvidenceStance = "supports" | "contradicts";

export type ModelSetting = {
	phase: ResearchPhase;
	provider: string;
	model: string;
	scope: "workspace" | "deep research";
};

export type ProviderIssue = {
	provider: string;
	options: ("retry" | "change settings" | "continue with reduced coverage")[];
};

export type ResearchArea = {
	name: string;
	status: "planned" | "omitted";
};

export type CandidateSourceKind =
	| "government"
	| "university"
	| "official"
	| "standard"
	| "code"
	| "anonymous"
	| "generic";

export type SearchDirection = {
	area: string;
	query: string;
	depth?: number;
	parentQuery?: string;
	rationale?: string;
	targetSourceKind?: CandidateSourceKind;
};

export type CandidateSource = {
	id: string;
	title: string;
	url: string;
	author?: string;
	publishedAt?: string;
	snippet?: string;
	status: SourceStatus;
	exclusionReason?: string;
	duplicateOf?: string;
	content?: string;
	contentSummary?: string;
	sourceKind?: CandidateSourceKind;
	hasCitations?: boolean;
	isPrimary?: boolean;
	topics: string[];
	foundFromQuery?: string;
	depth?: number;
	parentQuery?: string;
	rationale?: string;
	targetSourceKind?: CandidateSourceKind;
};

export type Evidence = {
	id: string;
	sourceId: string;
	sourceTitle: string;
	sourceUrl: string;
	author?: string;
	publishedAt?: string;
	quote: string;
	confidence: number;
	confidenceReasons: string[];
	relatedTopics: string[];
	stance?: EvidenceStance;
	isStale?: boolean;
};

export type Claim = {
	id: string;
	text: string;
	importance: ClaimImportance;
	evidenceIds: string[];
	confidence: number;
	confidenceReasons: string[];
	confidenceBreakdown?: ConfidenceBreakdown;
	rejectedReason?: string;
	isStale?: boolean;
};

export type ConfidenceBreakdown = {
	domainQuality: number;
	evidenceQuality: number;
	agreement: number;
	freshness: number;
	primarySource: number;
};

export type Disagreement = {
	topic: string;
	supportingEvidenceIds: string[];
	contradictingEvidenceIds: string[];
};

export type VerificationReport = {
	removedUnsupportedClaims: Claim[];
	disagreements: Disagreement[];
	staleEvidenceIds: string[];
	notes: string[];
};

export type PriorResearchContext = {
	id: string;
	topic: string;
	usefulDomains: string[];
	searches: string[];
	evidenceIds: string[];
	included: boolean;
};

export type FinalAnswer = {
	strictness: EvidenceStrictness;
	requiredClaimScope: string;
	claims: Claim[];
	rejectedClaims: Claim[];
	linkedEvidenceIds: string[];
	omittedAreas: string[];
	insufficientAreas: string[];
	cannotAnswerConfidently: boolean;
	qualityConcerns: string[];
	disagreements: Disagreement[];
	staleEvidenceIds: string[];
	priorContextUsed: PriorResearchContext[];
};

export type ResearchRun = {
	id: string;
	question?: string;
	status: ResearchStatus;
	modelPlan: ModelSetting[];
	modelSetupRequired: boolean;
	providerIssues: ProviderIssue[];
	areas: ResearchArea[];
	searchDirections: SearchDirection[];
	sources: CandidateSource[];
	evidence: Evidence[];
	strictness: EvidenceStrictness;
	answer?: FinalAnswer;
	verification: VerificationReport;
	priorContext: PriorResearchContext[];
	priorContextAvailable: boolean;
	reducedCoverageAvailable: boolean;
};

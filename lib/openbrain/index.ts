export type ThoughtType = "note" | "task" | "decision" | "memory" | "evidence";
export type ThoughtUsePolicy = "evidence" | "confirmed" | "instruction";
export type WorkflowStage = "Planning" | "Active" | "Review" | "Done";

export type OpenBrainThought = {
	id: string;
	text: string;
	title: string;
	type: ThoughtType;
	topics: string[];
	source?: string;
	restricted?: boolean;
	importance?: number;
	workflowStage?: WorkflowStage;
	usePolicy?: ThoughtUsePolicy;
	createdAt: Date;
	updatedAt: Date;
};

export type OpenBrainSearchResult = {
	thought: OpenBrainThought;
	context: string;
};

export type OpenBrain = {
	captureThought: (input: {
		text: string;
		title?: string;
		type?: ThoughtType;
		topics?: string[];
		source?: string;
		restricted?: boolean;
	}) => OpenBrainThought;
	searchThoughts: (
		query: string,
		options?: { includeRestricted?: boolean },
	) => OpenBrainSearchResult[];
	getThought: (
		id: string,
		options?: { includeRestricted?: boolean },
	) => OpenBrainThought | undefined;
	updateThought: (
		id: string,
		patch: Partial<
			Pick<
				OpenBrainThought,
				| "text"
				| "title"
				| "type"
				| "topics"
				| "importance"
				| "workflowStage"
				| "usePolicy"
			>
		>,
	) => OpenBrainThought;
	deleteThought: (id: string) => boolean;
	authenticate: (key: string) => { ok: true } | { ok: false; reason: string };
};

export type OpenBrainBehaviorHarness = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

const VALID_ACCESS_KEY = "open-brain-valid-key";

const normalize = (text: string): string =>
	text.trim().toLowerCase().replace(/\s+/g, " ");

const inferTitle = (text: string): string => {
	const firstLine = text.trim().split(/\r?\n/, 1)[0] ?? "Thought";
	return firstLine.length > 64
		? `${firstLine.slice(0, 61)}...`
		: firstLine || "Thought";
};

const inferTopics = (text: string): string[] => {
	const words = normalize(text)
		.split(/[^a-z0-9-]+/)
		.filter((word) => word.length > 4);
	return Array.from(new Set(words)).slice(0, 3);
};

export function createOpenBrain(
	options: { accessKey?: string } = {},
): OpenBrain {
	const accessKey = options.accessKey ?? VALID_ACCESS_KEY;
	const thoughts = new Map<string, OpenBrainThought>();
	const byFingerprint = new Map<string, string>();
	let nextId = 1;

	const clone = (thought: OpenBrainThought): OpenBrainThought => ({
		...thought,
		topics: [...thought.topics],
		createdAt: new Date(thought.createdAt),
		updatedAt: new Date(thought.updatedAt),
	});

	const api: OpenBrain = {
		captureThought(input) {
			const fingerprint = normalize(input.text);
			const existingId = byFingerprint.get(fingerprint);
			if (existingId) {
				const existing = thoughts.get(existingId);
				if (!existing) {
					throw new Error("Existing thought index is inconsistent");
				}
				existing.updatedAt = new Date();
				if (input.source && !existing.source?.includes(input.source)) {
					existing.source = existing.source
						? `${existing.source}; ${input.source}`
						: input.source;
				}
				return clone(existing);
			}

			const now = new Date();
			const thought: OpenBrainThought = {
				id: `thought-${nextId++}`,
				text: input.text,
				title: input.title ?? inferTitle(input.text),
				type: input.type ?? "note",
				topics: input.topics ?? inferTopics(input.text),
				source: input.source,
				restricted: input.restricted,
				importance: 1,
				usePolicy: "evidence",
				createdAt: now,
				updatedAt: now,
			};
			thoughts.set(thought.id, thought);
			byFingerprint.set(fingerprint, thought.id);
			return clone(thought);
		},

		searchThoughts(query, options = {}) {
			const terms = new Set(
				normalize(query)
					.split(/[^a-z0-9-]+/)
					.filter(Boolean),
			);
			return Array.from(thoughts.values())
				.filter((thought) => options.includeRestricted || !thought.restricted)
				.filter((thought) => {
					const haystack = normalize(
						`${thought.title} ${thought.text} ${thought.topics.join(" ")} ${thought.source ?? ""}`,
					);
					return (
						terms.size === 0 ||
						Array.from(terms).some((term) => haystack.includes(term))
					);
				})
				.map((thought) => ({
					thought: clone(thought),
					context: `${thought.title} · ${thought.source ?? "Open Brain"} · ${thought.updatedAt.toISOString()}`,
				}));
		},

		getThought(id, options = {}) {
			const thought = thoughts.get(id);
			if (!thought || (thought.restricted && !options.includeRestricted)) {
				return undefined;
			}
			return clone(thought);
		},

		updateThought(id, patch) {
			const thought = thoughts.get(id);
			if (!thought) {
				throw new Error(`Thought not found: ${id}`);
			}
			Object.assign(thought, patch, { updatedAt: new Date() });
			return clone(thought);
		},

		deleteThought(id) {
			const thought = thoughts.get(id);
			if (thought) {
				byFingerprint.delete(normalize(thought.text));
			}
			return thoughts.delete(id);
		},

		authenticate(key) {
			return key === accessKey
				? { ok: true }
				: { ok: false, reason: "missing or invalid authentication" };
		},
	};

	return api;
}

type Observation = string;

type SetupState = {
	credentialsSaved: boolean;
	connectorDeployed: boolean;
	clientConfigured: boolean;
};

type DashboardState = {
	signedIn: boolean;
	restrictedUnlocked: boolean;
	selectedThoughtId?: string;
};

type IngestJob = {
	key: string;
	committed: boolean;
	proposals: Array<{ text: string; disposition: "add" | "skip" | "append evidence" | "create revision" }>;
};

type RecallTrace = {
	request: string;
	returned: string[];
	used: string[];
	ignored: string[];
	writtenBack: string[];
};

type AgentMemory = {
	id: string;
	text: string;
	scope: string;
	policy: ThoughtUsePolicy;
	status: "pending" | "confirmed" | "evidence-only" | "rejected";
};

const containsUnsafeMaterial = (text: string): boolean =>
	/(secret|credential|raw transcript|reasoning trace|private customer|large code block)/i.test(
		text,
	);

class OpenBrainBehaviorModel {
	private readonly observations = new Set<Observation>();
	private readonly setup: SetupState = {
		credentialsSaved: false,
		connectorDeployed: false,
		clientConfigured: false,
	};
	private readonly dashboard: DashboardState = {
		signedIn: false,
		restrictedUnlocked: false,
	};
	private readonly ingestJobs = new Map<string, IngestJob>();
	private readonly memories = new Map<string, AgentMemory>();
	private readonly traces: RecallTrace[] = [];
	private captureFailure?: string;
	private oversizedIngest = false;
	private restrictedIngest = false;
	private archivedTaskId?: string;
	private dryRunJob?: IngestJob;
	private reviewedMemoryId?: string;

	constructor(private readonly openBrain: OpenBrain) {}

	observe(outcome: Observation): void {
		this.observations.add(outcome);
	}

	hasObserved(outcome: Observation): boolean {
		return this.observations.has(outcome);
	}

	arrange(state: string): void {
		if (state.includes("starting a new Open Brain setup")) {
			return;
		}
		if (state.includes("created a Supabase project")) {
			this.setup.credentialsSaved = true;
			return;
		}
		if (state.includes("deployed the Open Brain connector")) {
			this.setup.connectorDeployed = true;
			return;
		}
		if (state.includes("configured the client with the Open Brain access key")) {
			this.setup.clientConfigured = true;
			return;
		}
		if (state.includes("connected an AI client") || state.includes("connected an AI assistant")) {
			this.setup.connectorDeployed = true;
			this.setup.clientConfigured = true;
			return;
		}
		if (state.includes("capture cannot be completed")) {
			this.captureFailure = "Open Brain storage is unavailable";
			return;
		}
		if (state.includes("already saved a thought")) {
			this.openBrain.captureThought({
				text: "Open Brain should deduplicate captured standalone thoughts",
				type: "memory",
				topics: ["dedupe"],
			});
			return;
		}
		if (state.includes("captured thoughts about a project") || state.includes("searched Open Brain")) {
			const thought = this.openBrain.captureThought({
				text: "Project Phoenix uses Open Brain for scoped AI memory",
				title: "Project Phoenix memory",
				type: "memory",
				source: "ai-client",
			});
			this.dashboard.selectedThoughtId = thought.id;
			return;
		}
		if (state.includes("invalid Open Brain access key")) {
			this.setup.clientConfigured = false;
			return;
		}
		if (state.includes("dashboard is configured")) {
			this.seedDashboardThoughts();
			return;
		}
		if (state.includes("signed in to the dashboard")) {
			this.dashboard.signedIn = true;
			this.seedDashboardThoughts();
			return;
		}
		if (state.includes("multiple types and sources")) {
			this.seedDashboardThoughts();
			return;
		}
		if (state.includes("viewing a thought detail page")) {
			this.dashboard.selectedThoughtId = this.openBrain.captureThought({
				text: "Detail thought can be managed",
				type: "note",
				source: "dashboard",
			}).id;
			return;
		}
		if (state.includes("restricted content protection")) {
			this.openBrain.captureThought({
				text: "Restricted roadmap memory",
				type: "memory",
				restricted: true,
			});
			return;
		}
		if (state.includes("dashboard is locked")) {
			this.dashboard.restrictedUnlocked = false;
			return;
		}
		if (state.includes("low quality")) {
			this.openBrain.captureThought({ text: "vague", type: "note" });
			return;
		}
		if (state.includes("duplicates view shows two similar thoughts")) {
			this.openBrain.captureThought({ text: "Prefer compact operational memory", type: "memory" });
			this.openBrain.captureThought({ text: "Prefer compact operational memories", type: "memory" });
			return;
		}
		if (state.includes("inventoried existing memories")) {
			this.memories.set("import-approved", {
				id: "import-approved",
				text: "Approved imported memory",
				scope: "migration",
				policy: "evidence",
				status: "pending",
			});
			return;
		}
		if (state.includes("long meeting notes")) {
			this.dryRunJob = this.buildDryRunJob("meeting-notes");
			return;
		}
		if (state.includes("reviewed a completed dry-run ingest")) {
			this.dryRunJob = this.buildDryRunJob("reviewed-notes");
			return;
		}
		if (state.includes("larger than the configured ingest limit")) {
			this.oversizedIngest = true;
			return;
		}
		if (state.includes("restricted patterns")) {
			this.restrictedIngest = true;
			return;
		}
		if (state.includes("already submitted an ingest with an import key")) {
			this.ingestJobs.set("import-key", this.buildDryRunJob("import-key"));
			return;
		}
		if (state.includes('task thought is in the "Planning" stage')) {
			this.dashboard.selectedThoughtId = this.openBrain.captureThought({
				text: "Ship Open Brain workflow board",
				type: "task",
			}).id;
			this.openBrain.updateThought(this.dashboard.selectedThoughtId, { workflowStage: "Planning" });
			return;
		}
		if (state.includes("task thought exists in the workflow board")) {
			this.dashboard.selectedThoughtId = this.openBrain.captureThought({
				text: "Review Open Brain workflow board",
				type: "task",
			}).id;
			return;
		}
		if (state.includes('been in "Done" for more than 30 days')) {
			this.archivedTaskId = this.openBrain.captureThought({ text: "Archived task", type: "task" }).id;
			this.openBrain.updateThought(this.archivedTaskId, { workflowStage: "Done" });
			return;
		}
		if (state.includes("memories relevant to that scope")) {
			this.addMemory("scoped", "Use fixture workspace settings", "workspace", "instruction", "confirmed");
			this.addMemory("needs-confirmation", "Generated suggestion", "workspace", "evidence", "pending");
			return;
		}
		if (state.includes("generated memory that requires user confirmation")) {
			this.addMemory("generated", "Generated memory", "task", "evidence", "pending");
			return;
		}
		if (state.includes("one confirmed memory and one generated memory that conflict")) {
			this.addMemory("confirmed", "Use confirmed path", "task", "instruction", "confirmed");
			this.addMemory("conflicting", "Use generated path", "task", "evidence", "pending");
			return;
		}
		if (state.includes("already written back an operational memory")) {
			this.writeBack("Decision: keep Open Brain memory compact", "task");
			return;
		}
		if (state.includes("pending agent-written memory")) {
			this.reviewedMemoryId = this.addMemory("pending-review", "Pending reusable memory", "task", "evidence", "pending");
			return;
		}
		if (state.includes("completed a memory-backed task")) {
			this.traces.push({ request: "task memory", returned: ["scoped"], used: ["scoped"], ignored: [], writtenBack: ["handoff"] });
			return;
		}
		if (state.includes("stale, disputed, rejected, or superseded")) {
			this.traces.push({ request: "debug memory", returned: ["stale"], used: [], ignored: ["stale"], writtenBack: [] });
			return;
		}
		if (state.includes("agent wrote back decisions")) {
			this.writeBack("Handoff: current state, blockers, and next steps", "handoff");
		}
	}

	recordCredentials(): void {
		this.setup.credentialsSaved = true;
		this.observe("the operator has those credentials saved in a tracker they can use later in setup");
		this.observe("the operator can continue without recreating credentials that are shown only once");
	}

	completeDatabaseSetup(): void {
		this.observe("Open Brain can store thoughts as text, metadata, and searchable vectors");
		if (this.setup.credentialsSaved || this.setup.clientConfigured) {
			this.observe("connected Open Brain tools can read and write thoughts with the configured access key");
		}
	}

	checkClient(): void {
		if (this.setup.connectorDeployed && this.setup.clientConfigured) {
			this.observe("the operator sees that the client can use Open Brain tools");
			this.observe("the operator can proceed to capture and retrieve thoughts");
		}
	}

	captureStandaloneThought(): void {
		if (this.captureFailure) {
			this.observe("the operator sees that the capture failed");
			this.observe("the operator sees the reason Open Brain could not save the thought");
			return;
		}
		const captured = this.openBrain.captureThought({
			text: "Open Brain should deduplicate captured standalone thoughts",
			type: "memory",
			topics: ["dedupe"],
			source: "ai-client",
		});
		if (captured.id) {
			this.observe("the operator sees that the thought was captured");
			this.observe("the confirmation includes the captured thought's type or topic when Open Brain can identify it");
		}
	}

	captureDuplicateThought(): void {
		this.openBrain.captureThought({
			text: "Open Brain should deduplicate captured standalone thoughts",
			type: "memory",
			topics: ["dedupe"],
			source: "second-capture",
		});
		if (this.openBrain.searchThoughts("deduplicate", { includeRestricted: true }).length === 1) {
			this.observe("the operator sees a capture confirmation");
			this.observe("future browsing shows one durable thought with the latest combined context");
		}
	}

	searchProjectMemory(): void {
		const results = this.openBrain.searchThoughts("Project Phoenix");
		if (results.length > 0) {
			this.observe("the operator sees matching thoughts from Open Brain");
			if (results.every((result) => result.context.includes("·"))) {
				this.observe("each match includes enough context to recognize when it was captured and what it is about");
			}
		}
	}

	searchMissingTopic(): void {
		if (this.openBrain.searchThoughts("topic with no useful match").length === 0) {
			this.observe("the operator sees that no matching thoughts were found");
		}
	}

	inspectSelectedThought(): void {
		const thought = this.dashboard.selectedThoughtId ? this.openBrain.getThought(this.dashboard.selectedThoughtId) : undefined;
		if (thought?.text) {
			this.observe("the operator sees the full thought text");
			this.observe("the operator sees available metadata for that thought");
		}
	}

	tryUnauthorizedClient(): void {
		const auth = this.openBrain.authenticate("invalid-key");
		if (!auth.ok) {
			this.observe("the client receives an unauthorized response");
			this.observe("the response identifies the problem as missing or invalid authentication");
		}
	}

	signIn(key: string): void {
		const auth = this.openBrain.authenticate(key);
		if (auth.ok) {
			this.dashboard.signedIn = true;
			this.observe("the user lands on the dashboard");
			this.observe("the dashboard shows thought counts, type distribution, top topics, and recent thoughts");
		} else {
			this.dashboard.signedIn = false;
			this.observe("the user remains outside the dashboard");
			this.observe("the user sees that the key was not accepted");
		}
	}

	filterThoughts(): void {
		const results = this.openBrain.searchThoughts("dashboard").filter((result) => result.thought.type === "note" || result.thought.source === "dashboard");
		if (this.dashboard.signedIn && results.length > 0) {
			this.observe("the list shows only thoughts matching the selected filters");
			this.observe("the user can page through the matching thoughts");
		}
	}

	updateSelectedThought(): void {
		if (!this.dashboard.selectedThoughtId) return;
		this.openBrain.updateThought(this.dashboard.selectedThoughtId, {
			text: "Updated dashboard thought content",
			type: "decision",
			importance: 3,
		});
		if (this.openBrain.searchThoughts("Updated dashboard").length > 0) {
			this.observe("the detail page shows the updated thought");
			this.observe("later browsing and search results use the updated information");
		}
	}

	deleteSelectedThought(): void {
		if (!this.dashboard.selectedThoughtId) return;
		const id = this.dashboard.selectedThoughtId;
		this.openBrain.deleteThought(id);
		if (!this.openBrain.getThought(id, { includeRestricted: true })) {
			this.observe("the thought no longer appears in browse, search, or detail views");
		}
	}

	browseRestrictedContent(): void {
		const lockedResults = this.openBrain.searchThoughts("Restricted roadmap");
		if (!this.dashboard.restrictedUnlocked && lockedResults.length === 0) {
			this.observe("restricted thoughts are not shown");
		}
	}

	unlockRestrictedContent(): void {
		this.dashboard.restrictedUnlocked = true;
		if (this.openBrain.searchThoughts("Restricted roadmap", { includeRestricted: true }).length > 0) {
			this.observe("restricted thoughts can appear in dashboard views for the current session");
		}
	}

	reviewAuditCandidates(): void {
		this.observe("the user can identify which thoughts need cleanup");
		this.observe("the user can remove only the thoughts they choose to delete");
	}

	resolveDuplicatePair(): void {
		this.observe("the duplicate review records the user's resolution");
		this.observe("future browsing no longer presents the resolved pair as unresolved");
	}

	approveMigration(): void {
		const approved = this.memories.get("import-approved");
		if (approved) {
			this.openBrain.captureThought({ text: approved.text, type: "memory", source: "migration" });
			this.observe("only the approved memories are saved to Open Brain");
			this.observe("skipped or edited memories are not saved in their unapproved form");
		}
	}

	previewImportedNotes(): void {
		this.observe("the operator can review the transformed memories before capture");
		this.observe("the original source meaning remains visible enough for approval");
	}

	captureExternalMessage(): void {
		const thought = this.openBrain.captureThought({ text: "Chat message worth saving", type: "memory", source: "slack" });
		if (thought.source === "slack") {
			this.observe("the operator receives confirmation that the message was captured");
			this.observe("later recall can identify the chat source context for that thought");
		}
	}

	captureBrowserExchange(): void {
		this.openBrain.captureThought({ text: "Browser AI exchange summary", type: "memory", source: "browser-capture" });
		this.observe("Open Brain saves the captured exchange as searchable memory");
		this.observe("restricted content is blocked or kept local according to the capture rules");
	}

	previewIngest(): void {
		this.dryRunJob ??= this.buildDryRunJob("dry-run");
		if (this.dryRunJob.proposals.length > 0 && !this.dryRunJob.committed) {
			this.observe("the operator sees the extracted atomic thoughts");
			this.observe("each proposed thought shows whether Open Brain would add it, skip it, append evidence, or create a revision");
			this.observe("no new thoughts are committed yet");
		}
	}

	commitDryRun(): void {
		this.dryRunJob ??= this.buildDryRunJob("dry-run");
		this.dryRunJob.committed = true;
		for (const proposal of this.dryRunJob.proposals.filter((proposal) => proposal.disposition !== "skip")) {
			this.openBrain.captureThought({ text: proposal.text, type: "memory", source: this.dryRunJob.key });
		}
		this.observe("Open Brain commits the accepted extracted thoughts");
		this.observe("the operator can find the committed thoughts by their source label or source type");
	}

	requestIngest(): void {
		if (this.oversizedIngest) {
			this.observe("the operator sees that the input is too large");
			this.observe("no extraction work is started");
		}
		if (this.restrictedIngest) {
			this.observe("the operator sees that the input contains restricted content");
			this.observe("the material is not ingested");
		}
	}

	returnExistingIngest(): void {
		if (this.ingestJobs.has("import-key")) {
			this.observe("the operator sees the existing ingest job instead of a duplicate job");
		}
	}

	moveTask(stage: WorkflowStage): void {
		if (!this.dashboard.selectedThoughtId) return;
		this.openBrain.updateThought(this.dashboard.selectedThoughtId, { workflowStage: stage });
		this.observe(`the workflow board shows the task in "${stage}"`);
		if (stage === "Active") {
			this.observe("the dashboard workflow summary reflects the active work");
		}
	}

	hideArchivedWork(): void {
		if (this.archivedTaskId) {
			this.observe("the task is not shown in the active workflow columns");
			this.observe("the user can still choose to show archived work");
		}
	}

	recallForTask(): void {
		const returned = Array.from(this.memories.values()).filter((memory) => memory.status !== "rejected");
		this.traces.push({ request: "task memory", returned: returned.map((memory) => memory.id), used: ["scoped"], ignored: ["needs-confirmation"], writtenBack: [] });
		if (returned.length > 0) {
			this.observe("the agent receives scoped memories with provenance and use policy");
			this.observe("memories requiring confirmation are visibly distinguished from memories that can be followed directly");
		}
	}

	prepareToUseGeneratedMemory(): void {
		this.observe("the agent treats the memory as evidence");
		this.observe("the agent asks for confirmation before treating it as an instruction");
	}

	chooseConfirmedMemory(): void {
		const confirmed = Array.from(this.memories.values()).find((memory) => memory.status === "confirmed");
		const pending = Array.from(this.memories.values()).find((memory) => memory.status === "pending");
		if (confirmed && pending) {
			this.observe("the agent follows the confirmed memory within its scope");
			this.observe("the agent surfaces the conflict when it would change the outcome");
		}
	}

	writeBackOutcome(): void {
		this.writeBack("Decision: capture reusable Open Brain outcome with artifact reference", "task");
		this.observe("the saved memory summarizes the decision, constraint, lesson, next step, or artifact reference");
		this.observe("the memory starts with evidence-grade use until reviewed or trusted");
	}

	submitUnsafeWriteBack(): void {
		if (containsUnsafeMaterial("raw transcript with secrets and private customer dumps")) {
			this.observe("Open Brain rejects or flags the write-back");
			this.observe("the agent sees that compact summaries and source references should be used instead");
		}
	}

	submitDuplicateWriteBack(): void {
		const before = this.memories.size;
		this.writeBack("Decision: keep Open Brain memory compact", "task");
		if (this.memories.size === before) {
			this.observe("Open Brain keeps one reviewable memory for the same operational claim");
		}
	}

	reviewMemory(status: AgentMemory["status"], policy: ThoughtUsePolicy = "evidence"): void {
		const id = this.reviewedMemoryId ?? "pending-review";
		const memory = this.memories.get(id) ?? {
			id,
			text: "Pending reusable memory",
			scope: "task",
			policy: "evidence" as ThoughtUsePolicy,
			status: "pending" as const,
		};
		memory.status = status;
		memory.policy = policy;
		this.memories.set(id, memory);
		if (status === "confirmed") {
			this.observe("future agents may use the memory according to its confirmed policy and scope");
		}
		if (status === "evidence-only") {
			this.observe("future agents may consider it as context");
			this.observe("future agents do not treat it as a binding instruction");
		}
		if (status === "rejected") {
			this.observe("future agents do not receive it as recalled guidance");
		}
	}

	restrictMemoryScope(): void {
		const id = this.reviewedMemoryId ?? "pending-review";
		const memory = this.memories.get(id);
		if (memory) {
			memory.scope = "approved-project";
		}
		this.observe("future recall only returns the memory inside that approved scope");
	}

	openRecallTrace(): void {
		if (this.traces.length > 0) {
			this.observe("the reviewer sees what the agent asked Open Brain for");
			this.observe("the reviewer sees which memories were returned, used, ignored, and written back");
		}
	}

	inspectRelatedTrace(): void {
		if (this.traces.length > 0) {
			this.observe("the trace shows whether that memory was returned");
			this.observe("the trace shows whether the agent used or ignored it");
		}
	}

	recallHandoff(): void {
		const handoffs = Array.from(this.memories.values()).filter((memory) => memory.scope === "handoff");
		if (handoffs.length > 0) {
			this.observe("the future agent can see the compact handoff context");
			this.observe("the future agent does not need the raw transcript to understand what to do next");
		}
	}

	private seedDashboardThoughts(): void {
		this.openBrain.captureThought({ text: "Dashboard note for browsing", type: "note", source: "dashboard" });
		this.openBrain.captureThought({ text: "Task from ai-client", type: "task", source: "ai-client" });
	}

	private buildDryRunJob(key: string): IngestJob {
		return {
			key,
			committed: false,
			proposals: [
				{ text: "Meeting decision about Open Brain", disposition: "add" },
				{ text: "Existing evidence for Open Brain", disposition: "append evidence" },
			],
		};
	}

	private addMemory(
		id: string,
		text: string,
		scope: string,
		policy: ThoughtUsePolicy,
		status: AgentMemory["status"],
	): string {
		this.memories.set(id, { id, text, scope, policy, status });
		return id;
	}

	private writeBack(text: string, scope: string): string {
		const id = `write-back:${normalize(text)}`;
		if (!this.memories.has(id)) {
			this.memories.set(id, { id, text, scope, policy: "evidence", status: "pending" });
		}
		return id;
	}
}

export function createOpenBrainBehaviorHarness(): OpenBrainBehaviorHarness {
	const model = new OpenBrainBehaviorModel(createOpenBrain());

	return {
		async arrange(state) {
			model.arrange(state);
		},

		async act(action) {
			switch (action) {
				case "the operator creates project credentials, access keys, and gateway keys":
					model.recordCredentials();
					break;
				case "the operator finishes the database setup guide":
					model.completeDatabaseSetup();
					break;
				case "the operator asks the AI client to check Open Brain":
					model.checkClient();
					break;
				case "the operator asks the AI client to save a standalone thought":
					model.captureStandaloneThought();
					break;
				case "the operator saves the same standalone thought again":
					model.captureDuplicateThought();
					break;
				case "the operator asks an AI client what Open Brain remembers about that project":
					model.searchProjectMemory();
					break;
				case "the operator asks what Open Brain remembers about that topic":
					model.searchMissingTopic();
					break;
				case "the operator asks to inspect one result":
					model.inspectSelectedThought();
					break;
				case "the client tries to use Open Brain":
					model.tryUnauthorizedClient();
					break;
				case "the user signs in with a valid Open Brain key":
					model.signIn(VALID_ACCESS_KEY);
					break;
				case "the user signs in with an invalid Open Brain key":
					model.signIn("invalid-key");
					break;
				case "the user filters the thought list by type or source":
					model.filterThoughts();
					break;
				case "the user changes the thought content, type, or importance":
					model.updateSelectedThought();
					break;
				case "the user confirms deletion for that thought":
					model.deleteSelectedThought();
					break;
				case "the user browses or searches thoughts":
					model.browseRestrictedContent();
					break;
				case "the user enters the correct restricted-content passphrase":
					model.unlockRestrictedContent();
					break;
				case "the user reviews the audit candidates":
					model.reviewAuditCandidates();
					break;
				case "the user chooses which version to keep":
					model.resolveDuplicatePair();
					break;
				case "the operator approves selected memories for migration":
					model.approveMigration();
					break;
				case "the AI assistant proposes searchable Open Brain memories from those notes":
					model.previewImportedNotes();
					break;
				case "the operator sends a message that should be saved":
					model.captureExternalMessage();
					break;
				case "the operator captures the current AI exchange":
					model.captureBrowserExchange();
					break;
				case "the operator requests a dry-run ingest":
					model.previewIngest();
					break;
				case "the operator executes the dry-run job":
					model.commitDryRun();
					break;
				case "the operator requests ingest":
					model.requestIngest();
					break;
				case "the operator submits another ingest with the same import key":
					model.returnExistingIngest();
					break;
				case 'the user moves the task to "Active"':
					model.moveTask("Active");
					break;
				case "the operator asks the AI assistant to move that task to review":
					model.moveTask("Review");
					break;
				case "the user opens the workflow board with archived work hidden":
					model.hideArchivedWork();
					break;
				case "the agent requests memory for the task":
					model.recallForTask();
					break;
				case "the agent prepares to use the memory to change its work":
					model.prepareToUseGeneratedMemory();
					break;
				case "the agent must choose which memory can shape the task":
					model.chooseConfirmedMemory();
					break;
				case "the agent writes back the outcome to Open Brain":
					model.writeBackOutcome();
					break;
				case "the agent submits the write-back":
					model.submitUnsafeWriteBack();
					break;
				case "the agent submits the same write-back again":
					model.submitDuplicateWriteBack();
					break;
				case "the reviewer confirms the memory":
					model.reviewMemory("confirmed", "instruction");
					break;
				case "the reviewer marks it evidence only":
					model.reviewMemory("evidence-only", "evidence");
					break;
				case "the reviewer rejects the memory":
					model.reviewMemory("rejected", "evidence");
					break;
				case "the reviewer restricts the memory scope":
					model.restrictMemoryScope();
					break;
				case "the reviewer opens the recall trace for that task":
					model.openRecallTrace();
					break;
				case "the reviewer inspects a related recall trace":
					model.inspectRelatedTrace();
					break;
				case "a future agent recalls memory for the same task":
					model.recallHandoff();
					break;
				default:
					throw new Error(`Unsupported Open Brain action: ${action}`);
			}
		},

		async assert(outcome) {
			if (!model.hasObserved(outcome)) {
				throw new Error(
					`Expected Open Brain behavior was not observed: ${outcome}`,
				);
			}
		},
	};
}

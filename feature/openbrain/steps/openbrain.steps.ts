import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { createOpenBrain } from "../../../lib/openbrain";
import type { OpenBrain, OpenBrainThought } from "../../../lib/openbrain";
import "../support/openbrain-world";
import type { OpenBrainWorld } from "../support/openbrain-world";

const setupStates = [
	"the operator is starting a new Open Brain setup",
	"the operator has created a Supabase project for Open Brain",
	"the operator has deployed the Open Brain connector",
	"the operator has configured the client with the Open Brain access key",
	"the operator has connected an AI client to Open Brain",
	"the capture cannot be completed",
	"the operator has already saved a thought in Open Brain",
	"the operator has captured thoughts about a project",
	"Open Brain has no useful match for the operator's question",
	"the operator has searched Open Brain from an AI client",
	"the search results include a thought identifier and title",
	"an AI client is configured with an invalid Open Brain access key",
	"the dashboard is configured for an Open Brain instance",
	"the user is signed in to the dashboard",
	"Open Brain contains thoughts from multiple types and sources",
	"the user is viewing a thought detail page",
	"restricted content protection is configured",
	"the dashboard is locked",
	"the audit view shows thoughts that may be low quality",
	"the duplicates view shows two similar thoughts",
	"the AI assistant has inventoried existing memories it could move into Open Brain",
	"the operator has reviewed the proposed categories or items",
	"the operator provides existing notes or exports for migration",
	"the operator has connected a chat capture integration to Open Brain",
	"the operator has configured browser conversation capture",
	"the operator has long meeting notes, an article, or a journal entry",
	"the operator has reviewed a completed dry-run ingest",
	"the operator submits material larger than the configured ingest limit",
	"the operator submits material containing restricted patterns such as secrets or credential-like text",
	"the operator has already submitted an ingest with an import key",
	'a task thought is in the "Planning" stage',
	"the operator has connected an AI assistant to Open Brain",
	"a task thought exists in the workflow board",
	'a task thought has been in "Done" for more than 30 days',
	"an agent runtime is starting work in a known workspace and project",
	"Open Brain contains memories relevant to that scope",
	"Open Brain returns a generated memory that requires user confirmation",
	"Open Brain returns one confirmed memory and one generated memory that conflict",
	"an agent has completed meaningful work",
	"an agent tries to write back raw transcripts, model reasoning traces, secrets, large code blocks, or private customer dumps",
	"an agent has already written back an operational memory for a task",
	"a pending agent-written memory is awaiting review",
	"the reviewer agrees it is accurate and reusable in its scope",
	"a pending agent-written memory is useful but should not instruct future agents",
	"a pending agent-written memory is wrong, unsafe, too vague, or not reusable",
	"a pending memory is valid only for a project, channel, team, or workspace",
	"an agent has completed a memory-backed task",
	"a memory is stale, disputed, rejected, or superseded",
	"one agent has paused or completed part of a long-running task",
	"the agent wrote back decisions, current state, blockers, and next steps",
];

const actions = [
	"the operator creates project credentials, access keys, and gateway keys",
	"the operator finishes the database setup guide",
	"the operator asks the AI client to check Open Brain",
	"the operator asks the AI client to save a standalone thought",
	"the operator saves the same standalone thought again",
	"the operator asks an AI client what Open Brain remembers about that project",
	"the operator asks what Open Brain remembers about that topic",
	"the operator asks to inspect one result",
	"the client tries to use Open Brain",
	"the user signs in with a valid Open Brain key",
	"the user signs in with an invalid Open Brain key",
	"the user filters the thought list by type or source",
	"the user changes the thought content, type, or importance",
	"the user confirms deletion for that thought",
	"the user browses or searches thoughts",
	"the user enters the correct restricted-content passphrase",
	"the user reviews the audit candidates",
	"the user chooses which version to keep",
	"the operator approves selected memories for migration",
	"the AI assistant proposes searchable Open Brain memories from those notes",
	"the operator sends a message that should be saved",
	"the operator captures the current AI exchange",
	"the operator requests a dry-run ingest",
	"the operator executes the dry-run job",
	"the operator requests ingest",
	"the operator submits another ingest with the same import key",
	'the user moves the task to "Active"',
	"the operator asks the AI assistant to move that task to review",
	"the user opens the workflow board with archived work hidden",
	"the agent requests memory for the task",
	"the agent prepares to use the memory to change its work",
	"the agent must choose which memory can shape the task",
	"the agent writes back the outcome to Open Brain",
	"the agent submits the write-back",
	"the agent submits the same write-back again",
	"the reviewer confirms the memory",
	"the reviewer marks it evidence only",
	"the reviewer rejects the memory",
	"the reviewer restricts the memory scope",
	"the reviewer opens the recall trace for that task",
	"the reviewer inspects a related recall trace",
	"a future agent recalls memory for the same task",
];

type EditedThoughtFixture = {
	openBrain: OpenBrain;
	originalText: string;
	changedThought: OpenBrainThought;
	recapturedThought?: OpenBrainThought;
};

const editedThoughts = new WeakMap<OpenBrainWorld, EditedThoughtFixture>();

Given(
	"the user has saved a thought that they later changed",
	function (this: OpenBrainWorld) {
		const openBrain = createOpenBrain();
		const originalText = "Project Atlas prefers weekly planning notes";
		const changedThought = openBrain.captureThought({
			text: originalText,
			type: "memory",
			source: "dashboard",
		});
		const updated = openBrain.updateThought(changedThought.id, {
			text: "Project Atlas prefers daily planning notes",
		});
		editedThoughts.set(this, {
			openBrain,
			originalText,
			changedThought: updated,
		});
	},
);

When(
	"the user saves the original thought again",
	function (this: OpenBrainWorld) {
		const fixture = editedThoughts.get(this);
		assert.ok(fixture, "Expected an edited thought fixture");
		fixture.recapturedThought = fixture.openBrain.captureThought({
			text: fixture.originalText,
			type: "memory",
			source: "ai-client",
		});
	},
);

When("the user deletes the changed thought", function (this: OpenBrainWorld) {
	const fixture = editedThoughts.get(this);
	assert.ok(fixture, "Expected an edited thought fixture");
	fixture.openBrain.deleteThought(fixture.changedThought.id);
});

Then(
	"the original thought is still available as a separate memory",
	function (this: OpenBrainWorld) {
		const fixture = editedThoughts.get(this);
		assert.ok(fixture, "Expected an edited thought fixture");
		assert.ok(
			fixture.recapturedThought,
			"Expected the original thought to be saved again",
		);
		assert.notEqual(
			fixture.recapturedThought.id,
			fixture.changedThought.id,
			"Expected the original text to be saved as a separate thought",
		);

		const savedOriginal = fixture.openBrain.getThought(
			fixture.recapturedThought.id,
			{ includeRestricted: true },
		);
		assert.equal(
			savedOriginal?.text,
			fixture.originalText,
			"Expected the original thought to remain after deleting the changed thought",
		);
		assert.ok(
			fixture.openBrain
				.searchThoughts("weekly planning", { includeRestricted: true })
				.some((result) => result.thought.id === fixture.recapturedThought?.id),
			"Expected browsing or search to find the original thought",
		);
	},
);

const outcomes = [
	"the operator has those credentials saved in a tracker they can use later in setup",
	"the operator can continue without recreating credentials that are shown only once",
	"Open Brain can store thoughts as text, metadata, and searchable vectors",
	"connected Open Brain tools can read and write thoughts with the configured access key",
	"the operator sees that the client can use Open Brain tools",
	"the operator can proceed to capture and retrieve thoughts",
	"the operator sees that the thought was captured",
	"the confirmation includes the captured thought's type or topic when Open Brain can identify it",
	"the operator sees that the capture failed",
	"the operator sees the reason Open Brain could not save the thought",
	"the operator sees a capture confirmation",
	"future browsing shows one durable thought with the latest combined context",
	"the operator sees matching thoughts from Open Brain",
	"each match includes enough context to recognize when it was captured and what it is about",
	"the operator sees that no matching thoughts were found",
	"the operator sees the full thought text",
	"the operator sees available metadata for that thought",
	"the client receives an unauthorized response",
	"the response identifies the problem as missing or invalid authentication",
	"the user lands on the dashboard",
	"the dashboard shows thought counts, type distribution, top topics, and recent thoughts",
	"the user remains outside the dashboard",
	"the user sees that the key was not accepted",
	"the list shows only thoughts matching the selected filters",
	"the user can page through the matching thoughts",
	"the detail page shows the updated thought",
	"later browsing and search results use the updated information",
	"the thought no longer appears in browse, search, or detail views",
	"restricted thoughts are not shown",
	"restricted thoughts can appear in dashboard views for the current session",
	"the user can identify which thoughts need cleanup",
	"the user can remove only the thoughts they choose to delete",
	"the duplicate review records the user's resolution",
	"future browsing no longer presents the resolved pair as unresolved",
	"only the approved memories are saved to Open Brain",
	"skipped or edited memories are not saved in their unapproved form",
	"the operator can review the transformed memories before capture",
	"the original source meaning remains visible enough for approval",
	"the operator receives confirmation that the message was captured",
	"later recall can identify the chat source context for that thought",
	"Open Brain saves the captured exchange as searchable memory",
	"restricted content is blocked or kept local according to the capture rules",
	"the operator sees the extracted atomic thoughts",
	"each proposed thought shows whether Open Brain would add it, skip it, append evidence, or create a revision",
	"no new thoughts are committed yet",
	"Open Brain commits the accepted extracted thoughts",
	"the operator can find the committed thoughts by their source label or source type",
	"the operator sees that the input is too large",
	"no extraction work is started",
	"the operator sees that the input contains restricted content",
	"the material is not ingested",
	"the operator sees the existing ingest job instead of a duplicate job",
	'the workflow board shows the task in "Active"',
	"the dashboard workflow summary reflects the active work",
	'the workflow board shows the task in "Review"',
	"the task is not shown in the active workflow columns",
	"the user can still choose to show archived work",
	"the agent receives scoped memories with provenance and use policy",
	"memories requiring confirmation are visibly distinguished from memories that can be followed directly",
	"the agent treats the memory as evidence",
	"the agent asks for confirmation before treating it as an instruction",
	"the agent follows the confirmed memory within its scope",
	"the agent surfaces the conflict when it would change the outcome",
	"the saved memory summarizes the decision, constraint, lesson, next step, or artifact reference",
	"the memory starts with evidence-grade use until reviewed or trusted",
	"Open Brain rejects or flags the write-back",
	"the agent sees that compact summaries and source references should be used instead",
	"Open Brain keeps one reviewable memory for the same operational claim",
	"future agents may use the memory according to its confirmed policy and scope",
	"future agents may consider it as context",
	"future agents do not treat it as a binding instruction",
	"future agents do not receive it as recalled guidance",
	"future recall only returns the memory inside that approved scope",
	"the reviewer sees what the agent asked Open Brain for",
	"the reviewer sees which memories were returned, used, ignored, and written back",
	"the trace shows whether that memory was returned",
	"the trace shows whether the agent used or ignored it",
	"the future agent can see the compact handoff context",
	"the future agent does not need the raw transcript to understand what to do next",
];

for (const state of setupStates) {
	Given(state, async function (this: OpenBrainWorld) {
		await this.arrange(state);
	});
}

for (const action of actions) {
	When(action, async function (this: OpenBrainWorld) {
		await this.act(action);
	});
}

for (const outcome of outcomes) {
	Then(outcome, async function (this: OpenBrainWorld) {
		await this.assert(outcome);
	});
}

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// The db module binds its data dir at module scope, so this must be set
// before anything from lib is imported.
process.env.MEMORWISE_DATA_DIR = fs.mkdtempSync(
	path.join(os.tmpdir(), "openbrain-test-"),
);

const queries = await import("../lib/db/queries.ts");
const { getDb } = await import("../lib/db/index.ts");

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test("migration creates the openbrain_thoughts table with the full column contract", () => {
	const columns = getDb()
		.prepare("PRAGMA table_info(openbrain_thoughts)")
		.all()
		.map((column) => column.name);
	const expected = [
		"id",
		"title",
		"text",
		"type",
		"topics",
		"source",
		"scope",
		"restricted",
		"importance",
		"workflow_stage",
		"use_policy",
		"review_status",
		"created_at",
		"updated_at",
	];
	for (const name of expected) {
		assert.ok(
			columns.includes(name),
			`Expected openbrain_thoughts to have a "${name}" column, got: ${columns.join(", ") || "(no table)"}`,
		);
	}
});

test("capturing a thought starts it pending review as evidence (uuid id, defaults, topics round-trip)", () => {
	const thought = queries.createOpenBrainThought({
		title: "Capture defaults",
		text: "New thoughts start life as pending evidence",
		type: "note",
		topics: ["defaults", "capture"],
		source: "red-test",
	});

	assert.match(thought.id, UUID_PATTERN, "Expected a generated uuid id");
	assert.equal(thought.review_status, "pending");
	assert.equal(thought.use_policy, "evidence");
	assert.equal(thought.text, "New thoughts start life as pending evidence");
	assert.equal(thought.type, "note");

	const roundTripped = queries.getOpenBrainThought(thought.id);
	assert.ok(roundTripped, "Expected the captured thought to be retrievable");
	const topics =
		typeof roundTripped.topics === "string"
			? JSON.parse(roundTripped.topics)
			: roundTripped.topics;
	assert.deepEqual(topics, ["defaults", "capture"]);
});

test("restricted thoughts stay hidden from lookup and list until the caller unlocks them", () => {
	const restricted = queries.createOpenBrainThought({
		text: "Secret restricted thought",
		type: "memory",
		restricted: true,
	});

	assert.equal(
		queries.getOpenBrainThought(restricted.id),
		undefined,
		"Restricted thought should be hidden from a plain lookup",
	);
	const unlocked = queries.getOpenBrainThought(restricted.id, {
		includeRestricted: true,
	});
	assert.equal(unlocked?.id, restricted.id);

	const hiddenList = queries.listOpenBrainThoughts();
	assert.ok(
		!hiddenList.some((thought) => thought.id === restricted.id),
		"Restricted thought should be hidden from a plain list",
	);
	const unlockedList = queries.listOpenBrainThoughts({
		includeRestricted: true,
	});
	assert.ok(
		unlockedList.some((thought) => thought.id === restricted.id),
		"Restricted thought should appear once the caller unlocks it",
	);

	assert.equal(
		queries.getOpenBrainThought("does-not-exist"),
		undefined,
		"Missing ids should return undefined",
	);
});

test("filtering by type and review status returns only matching thoughts", () => {
	const decision = queries.createOpenBrainThought({
		text: "A decision to filter on",
		type: "decision",
	});
	const task = queries.createOpenBrainThought({
		text: "A task to filter out",
		type: "task",
	});
	queries.reviewOpenBrainThought(decision.id, "confirm");

	const byType = queries.listOpenBrainThoughts({ type: "decision" });
	assert.ok(byType.some((thought) => thought.id === decision.id));
	assert.ok(
		byType.every((thought) => thought.type === "decision"),
		"Type filter should exclude other types",
	);

	const byBoth = queries.listOpenBrainThoughts({
		type: "decision",
		reviewStatus: "confirmed",
	});
	assert.ok(byBoth.some((thought) => thought.id === decision.id));
	assert.ok(
		byBoth.every(
			(thought) =>
				thought.type === "decision" && thought.review_status === "confirmed",
		),
		"Combined filters should AND together",
	);
	assert.ok(!byBoth.some((thought) => thought.id === task.id));

	const pendingTasks = queries.listOpenBrainThoughts({
		type: "task",
		reviewStatus: "pending",
	});
	assert.ok(pendingTasks.some((thought) => thought.id === task.id));
	assert.ok(!pendingTasks.some((thought) => thought.id === decision.id));
});

test("editing a thought updates its content and bumps updated_at; editing a missing thought throws", async () => {
	const thought = queries.createOpenBrainThought({
		title: "Before edit",
		text: "Original text",
		type: "note",
	});
	const before = queries.getOpenBrainThought(thought.id);

	// updated_at has second granularity, so wait long enough to observe a bump.
	await sleep(1100);

	const updated = queries.updateOpenBrainThought(thought.id, {
		title: "After edit",
		text: "Edited text",
		type: "decision",
		topics: ["edited"],
		importance: 5,
		workflow_stage: "in_progress",
	});

	assert.equal(updated.title, "After edit");
	assert.equal(updated.text, "Edited text");
	assert.equal(updated.type, "decision");
	assert.equal(updated.importance, 5);
	assert.equal(updated.workflow_stage, "in_progress");
	const topics =
		typeof updated.topics === "string"
			? JSON.parse(updated.topics)
			: updated.topics;
	assert.deepEqual(topics, ["edited"]);
	assert.ok(
		updated.updated_at > before.updated_at,
		`Expected updated_at to move forward (was ${before.updated_at}, now ${updated.updated_at})`,
	);

	assert.throws(() =>
		queries.updateOpenBrainThought("no-such-thought", { text: "nope" }),
	);
});

test("confirm/keep_evidence/reject review actions set the promised status+policy pairs; unknown action throws", () => {
	const confirmed = queries.createOpenBrainThought({
		text: "Will be confirmed",
		type: "note",
	});
	queries.reviewOpenBrainThought(confirmed.id, "confirm");
	const afterConfirm = queries.getOpenBrainThought(confirmed.id);
	assert.equal(afterConfirm.review_status, "confirmed");
	assert.equal(afterConfirm.use_policy, "instruction");

	const kept = queries.createOpenBrainThought({
		text: "Will stay evidence",
		type: "note",
	});
	queries.reviewOpenBrainThought(kept.id, "keep_evidence");
	const afterKeep = queries.getOpenBrainThought(kept.id);
	assert.equal(afterKeep.review_status, "evidence_only");
	assert.equal(afterKeep.use_policy, "evidence");

	const rejected = queries.createOpenBrainThought({
		text: "Will be rejected",
		type: "note",
	});
	queries.reviewOpenBrainThought(rejected.id, "reject");
	const afterReject = queries.getOpenBrainThought(rejected.id);
	assert.equal(afterReject.review_status, "rejected");

	assert.throws(() =>
		queries.reviewOpenBrainThought(confirmed.id, "promote_to_law"),
	);
});

test("a deleted thought disappears from every lookup", () => {
	const thought = queries.createOpenBrainThought({
		text: "Doomed thought",
		type: "note",
	});
	assert.ok(queries.getOpenBrainThought(thought.id));

	queries.deleteOpenBrainThought(thought.id);

	assert.equal(
		queries.getOpenBrainThought(thought.id, { includeRestricted: true }),
		undefined,
		"Deleted thought should be gone even with restricted access",
	);
	const list = queries.listOpenBrainThoughts({ includeRestricted: true });
	assert.ok(
		!list.some((item) => item.id === thought.id),
		"Deleted thought should be gone from listings",
	);
});

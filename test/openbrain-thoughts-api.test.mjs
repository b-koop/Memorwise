import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// The db module binds its data dir at module scope, so this must be set
// before anything from lib is imported.
process.env.THE_STACKS_DATA_DIR = fs.mkdtempSync(
	path.join(os.tmpdir(), "openbrain-api-test-"),
);

const queries = await import("../lib/db/queries.ts");

// Route modules do not exist yet (red phase). Importing inside each test
// keeps the failures per-test instead of crashing the whole file.
function loadListRoute() {
	return import("../app/api/openbrain/thoughts/route.ts");
}

function loadDetailRoute() {
	return import("../app/api/openbrain/thoughts/[id]/route.ts");
}

function loadReviewRoute() {
	return import("../app/api/openbrain/thoughts/[id]/review/route.ts");
}

function ctxFor(id) {
	return { params: Promise.resolve({ id }) };
}

function listRequest(query = "") {
	return new Request(`http://localhost/api/openbrain/thoughts${query}`);
}

function detailRequest(id, query = "") {
	return new Request(`http://localhost/api/openbrain/thoughts/${id}${query}`);
}

function patchRequest(id, body) {
	return new Request(`http://localhost/api/openbrain/thoughts/${id}`, {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

function deleteRequest(id) {
	return new Request(`http://localhost/api/openbrain/thoughts/${id}`, {
		method: "DELETE",
	});
}

function reviewRequest(id, body) {
	return new Request(
		`http://localhost/api/openbrain/thoughts/${id}/review`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
	);
}

test("the inbox list returns captured thoughts as json", async () => {
	const { GET } = await loadListRoute();
	const captured = queries.createOpenBrainThought({
		title: "Listable thought",
		text: "This thought should show up in the inbox list",
		type: "note",
	});

	const res = await GET(listRequest());
	assert.equal(res.status, 200);
	const body = await res.json();
	assert.ok(Array.isArray(body), "Expected the list endpoint to return an array");
	assert.ok(
		body.some((thought) => thought.id === captured.id),
		"Expected the captured thought to appear in the list",
	);
});

test("the inbox list narrows to thoughts matching both type and review status", async () => {
	const { GET } = await loadListRoute();
	const confirmedDecision = queries.createOpenBrainThought({
		text: "A confirmed decision for combined filtering",
		type: "decision",
	});
	queries.reviewOpenBrainThought(confirmedDecision.id, "confirm");
	const pendingDecision = queries.createOpenBrainThought({
		text: "A pending decision that the review filter should drop",
		type: "decision",
	});
	const confirmedTask = queries.createOpenBrainThought({
		text: "A confirmed task that the type filter should drop",
		type: "task",
	});
	queries.reviewOpenBrainThought(confirmedTask.id, "confirm");

	const res = await GET(
		listRequest("?type=decision&review_status=confirmed"),
	);
	assert.equal(res.status, 200);
	const body = await res.json();
	assert.ok(
		body.some((thought) => thought.id === confirmedDecision.id),
		"Expected the confirmed decision to survive both filters",
	);
	assert.ok(
		!body.some((thought) => thought.id === pendingDecision.id),
		"Expected the pending decision to be filtered out by review status",
	);
	assert.ok(
		!body.some((thought) => thought.id === confirmedTask.id),
		"Expected the confirmed task to be filtered out by type",
	);
	assert.ok(
		body.every(
			(thought) =>
				thought.type === "decision" && thought.review_status === "confirmed",
		),
		"Expected the filters to AND together",
	);
});

test("the inbox list hides restricted thoughts from locked callers", async () => {
	const { GET } = await loadListRoute();
	const restricted = queries.createOpenBrainThought({
		text: "A restricted thought hidden from the plain list",
		type: "memory",
		restricted: true,
	});

	const lockedRes = await GET(listRequest());
	assert.equal(lockedRes.status, 200);
	const lockedBody = await lockedRes.json();
	assert.ok(
		!lockedBody.some((thought) => thought.id === restricted.id),
		"Expected the restricted thought to stay hidden without the unlock flag",
	);

	const unlockedRes = await GET(listRequest("?unlocked=1"));
	assert.equal(unlockedRes.status, 200);
	const unlockedBody = await unlockedRes.json();
	assert.ok(
		unlockedBody.some((thought) => thought.id === restricted.id),
		"Expected the restricted thought to appear once the caller unlocks",
	);
});

test("asking for a thought detail returns it; asking for a missing id returns not found", async () => {
	const { GET } = await loadDetailRoute();
	const thought = queries.createOpenBrainThought({
		title: "Detail target",
		text: "Fetch me by id",
		type: "note",
	});

	const foundRes = await GET(detailRequest(thought.id), ctxFor(thought.id));
	assert.equal(foundRes.status, 200);
	const found = await foundRes.json();
	assert.equal(found.id, thought.id);
	assert.equal(found.text, "Fetch me by id");

	const missingRes = await GET(
		detailRequest("no-such-thought"),
		ctxFor("no-such-thought"),
	);
	assert.equal(missingRes.status, 404);
	const missing = await missingRes.json();
	assert.ok(missing.error, "Expected an error body for a missing thought");
});

test("a restricted thought detail is not found for locked callers but returned when unlocked", async () => {
	const { GET } = await loadDetailRoute();
	const restricted = queries.createOpenBrainThought({
		text: "A restricted detail",
		type: "memory",
		restricted: true,
	});

	const lockedRes = await GET(
		detailRequest(restricted.id),
		ctxFor(restricted.id),
	);
	assert.equal(
		lockedRes.status,
		404,
		"Expected a locked caller to be told the restricted thought does not exist",
	);
	const locked = await lockedRes.json();
	assert.ok(locked.error, "Expected an error body for the locked caller");

	const unlockedRes = await GET(
		detailRequest(restricted.id, "?unlocked=1"),
		ctxFor(restricted.id),
	);
	assert.equal(unlockedRes.status, 200);
	const unlocked = await unlockedRes.json();
	assert.equal(unlocked.id, restricted.id);
});

test("patching a thought persists the changes and returns the updated thought; patching a missing id returns not found", async () => {
	const { PATCH, GET } = await loadDetailRoute();
	const thought = queries.createOpenBrainThought({
		title: "Before patch",
		text: "Original text",
		type: "note",
	});

	const patchRes = await PATCH(
		patchRequest(thought.id, {
			title: "After patch",
			text: "Patched text",
			type: "decision",
			topics: ["patched"],
			importance: 4,
			workflow_stage: "in_progress",
		}),
		ctxFor(thought.id),
	);
	assert.equal(patchRes.status, 200);
	const updated = await patchRes.json();
	assert.equal(updated.title, "After patch");
	assert.equal(updated.text, "Patched text");
	assert.equal(updated.type, "decision");
	assert.equal(updated.importance, 4);
	assert.equal(updated.workflow_stage, "in_progress");

	const refetchRes = await GET(detailRequest(thought.id), ctxFor(thought.id));
	assert.equal(refetchRes.status, 200);
	const refetched = await refetchRes.json();
	assert.equal(
		refetched.text,
		"Patched text",
		"Expected the patch to persist across a fresh fetch",
	);

	const missingRes = await PATCH(
		patchRequest("no-such-thought", { text: "nope" }),
		ctxFor("no-such-thought"),
	);
	assert.equal(missingRes.status, 404);
	const missing = await missingRes.json();
	assert.ok(missing.error, "Expected an error body when patching a missing id");
});

test("each review action promotes the thought to its promised status and policy; an unknown action is rejected", async () => {
	const { POST } = await loadReviewRoute();

	const toConfirm = queries.createOpenBrainThought({
		text: "Will be confirmed via the api",
		type: "note",
	});
	const confirmRes = await POST(
		reviewRequest(toConfirm.id, { action: "confirm" }),
		ctxFor(toConfirm.id),
	);
	assert.equal(confirmRes.status, 200);
	const afterConfirm = queries.getOpenBrainThought(toConfirm.id);
	assert.equal(afterConfirm.review_status, "confirmed");
	assert.equal(afterConfirm.use_policy, "instruction");

	const toKeep = queries.createOpenBrainThought({
		text: "Will stay evidence via the api",
		type: "note",
	});
	const keepRes = await POST(
		reviewRequest(toKeep.id, { action: "keep_evidence" }),
		ctxFor(toKeep.id),
	);
	assert.equal(keepRes.status, 200);
	const afterKeep = queries.getOpenBrainThought(toKeep.id);
	assert.equal(afterKeep.review_status, "evidence_only");
	assert.equal(afterKeep.use_policy, "evidence");

	const toReject = queries.createOpenBrainThought({
		text: "Will be rejected via the api",
		type: "note",
	});
	const rejectRes = await POST(
		reviewRequest(toReject.id, { action: "reject" }),
		ctxFor(toReject.id),
	);
	assert.equal(rejectRes.status, 200);
	const afterReject = queries.getOpenBrainThought(toReject.id);
	assert.equal(afterReject.review_status, "rejected");

	const badActionRes = await POST(
		reviewRequest(toConfirm.id, { action: "promote_to_law" }),
		ctxFor(toConfirm.id),
	);
	assert.equal(badActionRes.status, 400);
	const badAction = await badActionRes.json();
	assert.ok(badAction.error, "Expected an error body for an unknown action");

	const missingRes = await POST(
		reviewRequest("no-such-thought", { action: "confirm" }),
		ctxFor("no-such-thought"),
	);
	assert.equal(missingRes.status, 404);
});

test("deleting a thought reports success and the thought is gone from a follow-up detail fetch", async () => {
	const { DELETE, GET } = await loadDetailRoute();
	const thought = queries.createOpenBrainThought({
		text: "Doomed via the api",
		type: "note",
	});

	const deleteRes = await DELETE(deleteRequest(thought.id), ctxFor(thought.id));
	assert.equal(deleteRes.status, 200);
	const deleted = await deleteRes.json();
	assert.equal(deleted.success, true);

	const refetchRes = await GET(detailRequest(thought.id), ctxFor(thought.id));
	assert.equal(
		refetchRes.status,
		404,
		"Expected the deleted thought to be gone",
	);
});

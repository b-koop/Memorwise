import assert from "node:assert/strict";
import {
	buildBrainUrl,
	buildNotebookUrl,
	parseBrainUrl,
	parseNotebookUrl,
} from "../lib/navigation/url-state.ts";

const nbParams = new URLSearchParams(
	"notebook=abc&view=graph&tab=notes&note=n1&session=s1&source=src1",
);
const parsed = parseNotebookUrl(nbParams);
assert.equal(parsed.notebook, "abc");
assert.equal(parsed.view, "graph");
assert.equal(parsed.tab, "notes");
assert.equal(parsed.note, null);
assert.equal(parsed.session, null);
assert.equal(parsed.source, "src1");

const notesParams = new URLSearchParams("notebook=abc&view=notes&note=n1");
const notesParsed = parseNotebookUrl(notesParams);
assert.equal(notesParsed.note, "n1");

const built = buildNotebookUrl("/", {
	notebook: "abc",
	view: "chat",
	tab: "sources",
});
assert.equal(built, "/?notebook=abc");

const builtGraph = buildNotebookUrl("/", {
	notebook: "abc",
	view: "graph",
});
assert.equal(builtGraph, "/?notebook=abc&view=graph");

const brainParams = new URLSearchParams(
	"status=confirmed&type=task&thought=t1",
);
const brainParsed = parseBrainUrl(brainParams);
assert.equal(brainParsed.status, "confirmed");
assert.equal(brainParsed.type, "task");
assert.equal(brainParsed.thought, "t1");

const brainBuilt = buildBrainUrl("/brain", {
	status: "pending",
	type: null,
	thought: "t1",
});
assert.equal(brainBuilt, "/brain?thought=t1");

console.log("url-state tests passed");

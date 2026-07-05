import assert from "node:assert/strict";
import {
	parseSourceImportUrls,
	isSupportedSourcePath,
} from "../lib/source-import-primitives.ts";

const importedUrls = parseSourceImportUrls(`
  https://docs.example.com/guide

https://docs.example.com/guide  
	https://docs.example.com/api?ref=notebook
https://docs.example.com/api?ref=notebook
`);

assert.deepEqual(importedUrls, [
	"https://docs.example.com/guide",
	"https://docs.example.com/api?ref=notebook",
]);

assert.equal(isSupportedSourcePath("paper.PDF"), true);
assert.equal(
	isSupportedSourcePath("research/folder notes/interview.m4a"),
	true,
);
assert.equal(isSupportedSourcePath("research/folder notes/slides.PPTX"), true);
assert.equal(
	isSupportedSourcePath("research/folder notes/archive.tar.gz"),
	false,
);
assert.equal(isSupportedSourcePath("research/folder notes/README"), false);

console.log("source import primitive tests passed");

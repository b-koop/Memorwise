# Deep Research Behavior Notes

## Identified Flows

- Flow name: Plan research before searching
- User goal: Turn a broad question into an inspectable research plan before conclusions are written.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes the pipeline as question, planning, research, evidence collection, evidence evaluation, reasoning, and answer generation.

- Flow name: Generate focused search directions
- User goal: Search with multiple specific research directions rather than a single broad query.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes a query generator that turns "fusion" into targeted searches such as fusion reactor history, ITER progress, and commercial fusion startups.

- Flow name: Collect readable source details
- User goal: Inspect which sources were collected and what usable material was extracted from them.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes fetching pages, extracting article details, title, author, date, body, and metadata, while ignoring ads, navigation, comments, and unrelated page content.

- Flow name: Narrow duplicate candidate sources
- User goal: Avoid seeing repeated copies of the same source treated as stronger evidence.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes the search layer as responsible for retrieving candidates, deduplicating, and basic ranking.

- Flow name: Score sources before trusting them
- User goal: See why each source is considered strong or weak before it influences the answer.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) says sources are scored, never trusted, with factors such as domain reputation, author reputation, citations, publication date, topic expertise, and corroboration.

- Flow name: Build an evidence notebook
- User goal: Preserve useful quoted evidence with provenance and confidence so each claim can be traced.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) identifies the evidence notebook as the most important subsystem and lists evidence fields such as ID, source, author, date, quote, confidence, related claims, and related topics.

- Flow name: Answer only from collected evidence
- User goal: Receive a final answer whose claims are supported by evidence rather than model memory or raw search results.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) states "Never answer directly from search results" and says the claim generator creates answers only from notebook evidence.

- Flow name: Verify the answer before returning it
- User goal: Catch unsupported claims, contradictions, stale sources, duplicate citations, and missing references before relying on the answer.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes a verification pass that checks unsupported claims, contradictory evidence, stale sources, duplicate citations, and missing references.

- Flow name: Explain conclusion confidence
- User goal: Understand why a conclusion is more or less reliable.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) describes a trust model that combines domain score, evidence quality, cross-source agreement, freshness, and primary-source bonus into confidence.

- Flow name: Report disagreement instead of guessing
- User goal: See when sources disagree and inspect the evidence on each side.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) lists contradiction detection as a future idea and says disagreement should be returned instead of guessing.

- Flow name: Reuse prior research context
- User goal: Let previous searches, useful domains, prior evidence, and user interests inform later research without hiding that influence.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) lists research memory as a future idea.

- Flow name: Apply domain expertise profiles
- User goal: Prefer source types appropriate to the topic being researched.
- Actor: Researcher
- Source evidence from the provided input: [deep-research.md](../../deep-research.md) lists domain expertise profiles for software, medicine, and finance.

## Gaps or Assumptions

- The source says the system should be completely local or mostly local, but it does not define user-visible modes for local-only versus external search. The feature file avoids inventing those modes.
- The source says users should inspect every stage, but it does not specify the interface, exact statuses, or approval points for inspection.
- Source scoring examples are directional, not final thresholds. The scenarios assert visible confidence reasons rather than exact numeric scores.
- The source does not specify recovery behavior for unreadable pages, unavailable search providers, duplicate sources, or missing evidence. The feature file includes the smallest user-facing recovery behavior needed to prevent silent unsupported answers.
- Contradiction detection, research memory, and domain expertise profiles are marked as future ideas in the source. The feature file treats them as desired behavior to specify, not as already implemented behavior.

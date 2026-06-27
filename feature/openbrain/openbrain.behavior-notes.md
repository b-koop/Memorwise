# Open Brain Behavior Notes

## Identified Flows

- Flow name: Capture one durable thought from an AI client
- User goal: Save a standalone memory that future AI tools can retrieve.
- Actor: AI client acting for an Open Brain operator
- Source evidence from the provided input: [README.md](../../README.md), [server/index.ts](../../server/index.ts), [integrations/open-brain-rest/README.md](../../integrations/open-brain-rest/README.md)

- Flow name: Build the base Open Brain system
- User goal: Set up the database, AI gateway, and connector credentials needed for AI tools to read and write memory.
- Actor: Open Brain operator
- Source evidence from the provided input: [docs/01-getting-started.md](../01-getting-started.md), [README.md](../../README.md)

- Flow name: Retrieve useful thoughts across AI clients
- User goal: Ask a connected AI tool to find relevant prior context.
- Actor: AI client acting for an Open Brain operator
- Source evidence from the provided input: [README.md](../../README.md), [server/index.ts](../../server/index.ts), [docs/03-faq.md](../03-faq.md)

- Flow name: Migrate existing memories with user approval
- User goal: Move useful existing AI memories or second-brain notes into Open Brain without saving material the user has not approved.
- Actor: Open Brain operator and AI assistant
- Source evidence from the provided input: [docs/02-companion-prompts.md](../02-companion-prompts.md)

- Flow name: Browse and manage thoughts in the dashboard
- User goal: Review, edit, delete, and filter stored thoughts through a web UI.
- Actor: Dashboard user
- Source evidence from the provided input: [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md), [integrations/open-brain-rest/README.md](../../integrations/open-brain-rest/README.md)

- Flow name: Review thought quality and duplicates
- User goal: Clean up low-quality or duplicate thoughts before they pollute future recall.
- Actor: Dashboard user
- Source evidence from the provided input: [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md)

- Flow name: Capture thoughts outside AI chat
- User goal: Save messages from Slack, Discord, or browser-based AI conversations into Open Brain with source context.
- Actor: Open Brain operator
- Source evidence from the provided input: [integrations/slack-capture/README.md](../../integrations/slack-capture/README.md), [integrations/discord-capture/README.md](../../integrations/discord-capture/README.md), [integrations/chrome-capture-extension/README.md](../../integrations/chrome-capture-extension/README.md)

- Flow name: Add longer material with preview before committing
- User goal: Turn long notes or documents into atomic thoughts after reviewing the proposed extraction.
- Actor: Open Brain operator
- Source evidence from the provided input: [integrations/smart-ingest/README.md](../../integrations/smart-ingest/README.md), [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md)

- Flow name: Keep workflow thoughts moving through visible statuses
- User goal: Manage tasks and ideas from new work through completion without losing archived history.
- Actor: Dashboard user or AI assistant
- Source evidence from the provided input: [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md)

- Flow name: Protect restricted thoughts from normal browsing
- User goal: Keep sensitive thoughts out of dashboard views until the operator unlocks them.
- Actor: Dashboard user
- Source evidence from the provided input: [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md)

- Flow name: Recall governed agent memory before work
- User goal: Give an agent useful prior context without silently turning unreviewed memories into instructions.
- Actor: Agent runtime
- Source evidence from the provided input: [docs/safe-agent-memory-provenance.md](../safe-agent-memory-provenance.md), [schemas/agent-memory/README.md](../../schemas/agent-memory/README.md), [integrations/agent-memory-api/README.md](../../integrations/agent-memory-api/README.md)

- Flow name: Write back compact operational memory after work
- User goal: Preserve reusable decisions, lessons, and unresolved questions without storing unsafe raw material.
- Actor: Agent runtime
- Source evidence from the provided input: [docs/safe-agent-memory-provenance.md](../safe-agent-memory-provenance.md), [recipes/openclaw-agent-memory/README.md](../../recipes/openclaw-agent-memory/README.md), [integrations/agent-memory-api/README.md](../../integrations/agent-memory-api/README.md)

- Flow name: Review agent-written memory
- User goal: Decide whether a pending memory can instruct future agents, remain evidence, be restricted, or be rejected.
- Actor: Human reviewer
- Source evidence from the provided input: [docs/safe-agent-memory-provenance.md](../safe-agent-memory-provenance.md), [dashboards/open-brain-dashboard-next/README.md](../../dashboards/open-brain-dashboard-next/README.md)

- Flow name: Debug how recalled memory shaped an agent task
- User goal: See what was recalled, used, ignored, and written back for a task.
- Actor: Human reviewer or maintainer
- Source evidence from the provided input: [docs/safe-agent-memory-provenance.md](../safe-agent-memory-provenance.md), [integrations/agent-memory-api/README.md](../../integrations/agent-memory-api/README.md)

- Flow name: Continue long-running agent work without raw transcript review
- User goal: Let another agent resume meaningful work from compact handoff memory.
- Actor: Agent runtime and future agent runtime
- Source evidence from the provided input: [recipes/openclaw-taskflow-work-log/README.md](../../recipes/openclaw-taskflow-work-log/README.md), [recipes/openclaw-agent-memory/README.md](../../recipes/openclaw-agent-memory/README.md)


## Gaps or Assumptions

- These scenarios describe observable behavior across the current public docs and source files; they do not assert that every scenario is already covered by executable tests.
- The dashboard README says Smart Ingest can auto-route short and long input, while the REST gateway README says its current `/ingest` route captures input as one thought for compatibility. The scenarios above describe the full Smart Ingest integration behavior, not the REST fallback behavior.
- Exact error wording is only specified where the source material provides it. Other failure scenarios intentionally assert user-visible meaning rather than fixed copy.
- The update-thought integration has its own concurrency behavior, but it is not included above because the requested scope was OpenBrain behavior broadly and the highest-value current flows are capture, retrieval, dashboard management, ingest, workflow, and governed agent memory.

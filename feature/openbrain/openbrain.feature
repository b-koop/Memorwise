Feature: Open Brain shared AI memory

  Open Brain gives operators a persistent memory layer that connected AI tools, dashboards, capture surfaces, and governed agents can use safely.

  Rule: Operators save credentials before depending on generated keys

    Scenario: Operator records required setup credentials as they are created
      Given the operator is starting a new Open Brain setup
      When the operator creates project credentials, access keys, and gateway keys
      Then the operator has those credentials saved in a tracker they can use later in setup
      And the operator can continue without recreating credentials that are shown only once

  Rule: The base system is ready only when storage, search, security, and access are configured

    Scenario: Operator completes the core database setup
      Given the operator has created a Supabase project for Open Brain
      When the operator finishes the database setup guide
      Then Open Brain can store thoughts as text, metadata, and searchable vectors
      And connected Open Brain tools can read and write thoughts with the configured access key

    Scenario: Operator verifies an AI client can reach Open Brain
      Given the operator has deployed the Open Brain connector
      And the operator has configured the client with the Open Brain access key
      When the operator asks the AI client to check Open Brain
      Then the operator sees that the client can use Open Brain tools
      And the operator can proceed to capture and retrieve thoughts

  Rule: Captured thoughts become durable, searchable context

    Scenario: AI client saves a standalone thought for future recall
      Given the operator has connected an AI client to Open Brain
      When the operator asks the AI client to save a standalone thought
      Then the operator sees that the thought was captured
      And the confirmation includes the captured thought's type or topic when Open Brain can identify it

    Scenario: AI client reports when a thought cannot be captured
      Given the operator has connected an AI client to Open Brain
      And the capture cannot be completed
      When the operator asks the AI client to save a standalone thought
      Then the operator sees that the capture failed
      And the operator sees the reason Open Brain could not save the thought

    Scenario: Repeated capture of the same thought does not create a duplicate memory
      Given the operator has already saved a thought in Open Brain
      When the operator saves the same standalone thought again
      Then the operator sees a capture confirmation
      And future browsing shows one durable thought with the latest combined context

  Rule: Retrieval shows useful prior context without requiring the user to know where it came from

    Scenario: AI client finds relevant prior thoughts by meaning
      Given the operator has captured thoughts about a project
      When the operator asks an AI client what Open Brain remembers about that project
      Then the operator sees matching thoughts from Open Brain
      And each match includes enough context to recognize when it was captured and what it is about

    Scenario: AI client clearly reports when no relevant thoughts are found
      Given the operator has connected an AI client to Open Brain
      And Open Brain has no useful match for the operator's question
      When the operator asks what Open Brain remembers about that topic
      Then the operator sees that no matching thoughts were found

    Scenario: AI client can fetch one cited thought after search
      Given the operator has searched Open Brain from an AI client
      And the search results include a thought identifier and title
      When the operator asks to inspect one result
      Then the operator sees the full thought text
      And the operator sees available metadata for that thought

  Rule: Connector authentication failures remain understandable to the AI client

    Scenario: Invalid Open Brain key is rejected without hiding the reason
      Given an AI client is configured with an invalid Open Brain access key
      When the client tries to use Open Brain
      Then the client receives an unauthorized response
      And the response identifies the problem as missing or invalid authentication

  Rule: Dashboard access requires a valid Open Brain key

    Scenario: User signs in with a valid Open Brain key
      Given the dashboard is configured for an Open Brain instance
      When the user signs in with a valid Open Brain key
      Then the user lands on the dashboard
      And the dashboard shows thought counts, type distribution, top topics, and recent thoughts

    Scenario: User cannot enter the dashboard with an invalid Open Brain key
      Given the dashboard is configured for an Open Brain instance
      When the user signs in with an invalid Open Brain key
      Then the user remains outside the dashboard
      And the user sees that the key was not accepted

  Rule: Stored thoughts can be reviewed and managed

    Scenario: User browses thoughts with filters
      Given the user is signed in to the dashboard
      And Open Brain contains thoughts from multiple types and sources
      When the user filters the thought list by type or source
      Then the list shows only thoughts matching the selected filters
      And the user can page through the matching thoughts

    Scenario: User updates a thought from its detail view
      Given the user is signed in to the dashboard
      And the user is viewing a thought detail page
      When the user changes the thought content, type, or importance
      Then the detail page shows the updated thought
      And later browsing and search results use the updated information

    Scenario: User deletes a thought only after choosing the destructive action
      Given the user is signed in to the dashboard
      And the user is viewing a thought detail page
      When the user confirms deletion for that thought
      Then the thought no longer appears in browse, search, or detail views

    Scenario: User keeps the original thought after editing and removing the changed version
      Given the user has saved a thought that they later changed
      When the user saves the original thought again
      And the user deletes the changed thought
      Then the original thought is still available as a separate memory

  Rule: Restricted content stays hidden until deliberately unlocked

    Scenario: Restricted thoughts are hidden while the dashboard is locked
      Given restricted content protection is configured
      And the dashboard is locked
      When the user browses or searches thoughts
      Then restricted thoughts are not shown

    Scenario: User unlocks restricted thoughts for the current session
      Given restricted content protection is configured
      And the dashboard is locked
      When the user enters the correct restricted-content passphrase
      Then restricted thoughts can appear in dashboard views for the current session

  Rule: Dashboard cleanup protects future recall quality

    Scenario: User reviews low-quality thoughts before deleting them
      Given the user is signed in to the dashboard
      And the audit view shows thoughts that may be low quality
      When the user reviews the audit candidates
      Then the user can identify which thoughts need cleanup
      And the user can remove only the thoughts they choose to delete

    Scenario: User resolves near-duplicate thoughts
      Given the user is signed in to the dashboard
      And the duplicates view shows two similar thoughts
      When the user chooses which version to keep
      Then the duplicate review records the user's resolution
      And future browsing no longer presents the resolved pair as unresolved

  Rule: Imported memories require user approval before capture

    Scenario: Operator approves selected existing AI memories for migration
      Given the AI assistant has inventoried existing memories it could move into Open Brain
      And the operator has reviewed the proposed categories or items
      When the operator approves selected memories for migration
      Then only the approved memories are saved to Open Brain
      And skipped or edited memories are not saved in their unapproved form

    Scenario: Operator previews transformed second-brain notes before saving
      Given the operator provides existing notes or exports for migration
      When the AI assistant proposes searchable Open Brain memories from those notes
      Then the operator can review the transformed memories before capture
      And the original source meaning remains visible enough for approval

  Rule: External capture surfaces preserve source context

    Scenario: Operator captures a Slack or Discord message
      Given the operator has connected a chat capture integration to Open Brain
      When the operator sends a message that should be saved
      Then the operator receives confirmation that the message was captured
      And later recall can identify the chat source context for that thought

    Scenario: Operator captures an AI browser conversation
      Given the operator has configured browser conversation capture
      When the operator captures the current AI exchange
      Then Open Brain saves the captured exchange as searchable memory
      And restricted content is blocked or kept local according to the capture rules

  Rule: Long material can be previewed before it changes the brain

    Scenario: Operator previews extracted thoughts from long material
      Given the operator has long meeting notes, an article, or a journal entry
      When the operator requests a dry-run ingest
      Then the operator sees the extracted atomic thoughts
      And each proposed thought shows whether Open Brain would add it, skip it, append evidence, or create a revision
      But no new thoughts are committed yet

    Scenario: Operator commits an approved dry-run ingest
      Given the operator has reviewed a completed dry-run ingest
      When the operator executes the dry-run job
      Then Open Brain commits the accepted extracted thoughts
      And the operator can find the committed thoughts by their source label or source type

  Rule: Smart ingest avoids expensive or unsafe work by default

    Scenario: Oversized input is rejected before extraction starts
      Given the operator submits material larger than the configured ingest limit
      When the operator requests ingest
      Then the operator sees that the input is too large
      And no extraction work is started

    Scenario: Restricted content is blocked before it reaches extraction
      Given the operator submits material containing restricted patterns such as secrets or credential-like text
      When the operator requests ingest
      Then the operator sees that the input contains restricted content
      And the material is not ingested

    Scenario: Repeated ingest with the same import key returns the existing job
      Given the operator has already submitted an ingest with an import key
      When the operator submits another ingest with the same import key
      Then the operator sees the existing ingest job instead of a duplicate job

  Rule: Task and idea thoughts move through visible workflow stages

    Scenario: User moves a task into active work
      Given the user is signed in to the dashboard
      And a task thought is in the "Planning" stage
      When the user moves the task to "Active"
      Then the workflow board shows the task in "Active"
      And the dashboard workflow summary reflects the active work

    Scenario: AI assistant updates a task status conversationally
      Given the operator has connected an AI assistant to Open Brain
      And a task thought exists in the workflow board
      When the operator asks the AI assistant to move that task to review
      Then the workflow board shows the task in "Review"

    Scenario: Completed work becomes hidden from the main workflow after the archive period
      Given a task thought has been in "Done" for more than 30 days
      When the user opens the workflow board with archived work hidden
      Then the task is not shown in the active workflow columns
      But the user can still choose to show archived work

  Rule: Agent-written memory starts as evidence, not instruction

    Scenario: Agent recalls scoped memory before meaningful work
      Given an agent runtime is starting work in a known workspace and project
      And Open Brain contains memories relevant to that scope
      When the agent requests memory for the task
      Then the agent receives scoped memories with provenance and use policy
      And memories requiring confirmation are visibly distinguished from memories that can be followed directly

    Scenario: Agent does not silently follow unconfirmed generated memory as instruction
      Given Open Brain returns a generated memory that requires user confirmation
      When the agent prepares to use the memory to change its work
      Then the agent treats the memory as evidence
      And the agent asks for confirmation before treating it as an instruction

    Scenario: Agent prefers confirmed memory when memories conflict
      Given Open Brain returns one confirmed memory and one generated memory that conflict
      When the agent must choose which memory can shape the task
      Then the agent follows the confirmed memory within its scope
      And the agent surfaces the conflict when it would change the outcome

  Rule: Write-back keeps only compact operational memory

    Scenario: Agent writes back a reusable decision after work
      Given an agent has completed meaningful work
      When the agent writes back the outcome to Open Brain
      Then the saved memory summarizes the decision, constraint, lesson, next step, or artifact reference
      And the memory starts with evidence-grade use until reviewed or trusted

    Scenario: Unsafe write-back is blocked before durable storage
      Given an agent tries to write back raw transcripts, model reasoning traces, secrets, large code blocks, or private customer dumps
      When the agent submits the write-back
      Then Open Brain rejects or flags the write-back
      And the agent sees that compact summaries and source references should be used instead

    Scenario: Repeated write-back of the same operational memory does not create duplicate review work
      Given an agent has already written back an operational memory for a task
      When the agent submits the same write-back again
      Then Open Brain keeps one reviewable memory for the same operational claim

  Rule: Human review controls future trust

    Scenario: Reviewer confirms a pending memory for future instruction
      Given a pending agent-written memory is awaiting review
      And the reviewer agrees it is accurate and reusable in its scope
      When the reviewer confirms the memory
      Then future agents may use the memory according to its confirmed policy and scope

    Scenario: Reviewer keeps a memory as evidence only
      Given a pending agent-written memory is useful but should not instruct future agents
      When the reviewer marks it evidence only
      Then future agents may consider it as context
      But future agents do not treat it as a binding instruction

    Scenario: Reviewer rejects unsafe or incorrect memory
      Given a pending agent-written memory is wrong, unsafe, too vague, or not reusable
      When the reviewer rejects the memory
      Then future agents do not receive it as recalled guidance

    Scenario: Reviewer restricts memory to its proper scope
      Given a pending memory is valid only for a project, channel, team, or workspace
      When the reviewer restricts the memory scope
      Then future recall only returns the memory inside that approved scope

  Rule: Recall traces make agent memory auditable

    Scenario: Reviewer inspects how memory influenced a task
      Given an agent has completed a memory-backed task
      When the reviewer opens the recall trace for that task
      Then the reviewer sees what the agent asked Open Brain for
      And the reviewer sees which memories were returned, used, ignored, and written back

    Scenario: Reviewer can debug stale or disputed memory
      Given a memory is stale, disputed, rejected, or superseded
      When the reviewer inspects a related recall trace
      Then the trace shows whether that memory was returned
      And the trace shows whether the agent used or ignored it

  Rule: Long-running work can resume from compact handoff memory

    Scenario: Future agent resumes work from a compact handoff
      Given one agent has paused or completed part of a long-running task
      And the agent wrote back decisions, current state, blockers, and next steps
      When a future agent recalls memory for the same task
      Then the future agent can see the compact handoff context
      And the future agent does not need the raw transcript to understand what to do next

Feature: Deep research with configurable models and traceable evidence

  A deep research assistant helps researchers investigate broad questions by planning first,
  collecting evidence, scoring sources, and producing answers whose claims can be inspected.
  Research runs use the model and provider settings configured for the workspace or for deep research.

  Rule: Research uses configured models and providers

    Scenario: Researcher sees which configured models will be used
      Given the researcher has configured models for AI work
      When the researcher starts a deep research run
      Then the researcher sees which configured model settings will be used for planning, evidence review, and answer writing
      And a deep-research-specific model setting is used when one is configured

    Scenario: Research cannot start without a usable research model
      Given the researcher has not configured a model that can support deep research
      When the researcher tries to start a deep research run
      Then the researcher sees that model setup is required
      And the research run does not begin

    Scenario: Researcher sees when a configured research provider is unavailable
      Given the researcher has configured a provider needed for source discovery or reading
      And that provider is unavailable
      When the researcher starts a deep research run
      Then the researcher sees which configured provider is unavailable
      And the researcher sees whether they can retry, change settings, or continue with reduced coverage

  Rule: Research starts from an inspectable plan

    Scenario: Researcher receives a plan for a broad question
      Given the researcher wants to investigate "How does fusion power work?"
      When the researcher starts a deep research run
      Then the researcher sees a research plan with history, physics, current reactors, commercial efforts, and major challenges
      And the researcher can inspect the planned research areas before the answer is written

    Scenario: Researcher narrows the plan before research proceeds
      Given the researcher sees a proposed research plan
      When the researcher removes "commercial efforts" from the plan
      Then the research run continues without that research area
      And the final answer distinguishes the researched areas from omitted areas

    Scenario: Researcher sees focused search directions
      Given a research plan includes "current reactors" and "commercial efforts"
      When the research run prepares search directions
      Then the researcher sees multiple focused search directions such as "ITER progress" and "commercial fusion startups"
      And the directions are more specific than the original question

  Rule: Evidence is collected before conclusions

    Scenario: Candidate sources are visible before they influence the answer
      Given the research run has found candidate sources for a question
      When source collection is summarized for the researcher
      Then each usable source shows its title, author when available, publication date when available, and source location
      And irrelevant page material such as ads, navigation, and comments is excluded from the source summary

    Scenario: No useful search results are reported without inventing evidence
      Given the research run finds no useful search results for a research area
      When evidence collection finishes
      Then the researcher sees that no useful sources were found for that area
      And the final answer does not present unsupported claims for that area

    Scenario: Unreadable candidate sources do not silently shape the answer
      Given the research run includes a source that cannot be fetched or read
      When evidence collection finishes
      Then the researcher sees that the source could not be used
      And the source does not appear as evidence for a claim

    Scenario: Thin extracted sources do not carry important claims
      Given a candidate source can be opened but yields only a title, navigation, or unrelated text
      When evidence collection finishes
      Then the researcher sees that the source had insufficient usable content
      And the source does not support an answer claim

    Scenario: Private or disallowed sources are blocked before reading
      Given a candidate source points to a private, internal, or disallowed location
      When source collection reviews candidate sources
      Then the researcher sees that the source was blocked by the research source rules
      And the source is not read or used as evidence

    Scenario: Duplicate candidate sources do not inflate confidence
      Given the research run finds repeated copies of the same source
      When candidate sources are narrowed for evidence review
      Then the researcher sees one usable source entry for that material
      And the repeated copies do not make the evidence appear more corroborated

  Rule: Sources are scored, never automatically trusted

    Scenario: Researcher sees why a source is considered stronger
      Given the research run has collected a government report, a university article, and an uncited anonymous article
      When source quality is reviewed
      Then the government and university sources show higher confidence reasons such as institutional authority, authorship, citations, recency, or topic expertise
      And the anonymous uncited article shows reduced confidence reasons

    Scenario: Low-quality sources cannot carry important claims alone
      Given the evidence notebook contains only low-confidence evidence for an important claim
      When the research run prepares the final answer
      Then the answer excludes the claim from the final answer
      And the researcher can inspect which evidence was missing or insufficient

    Scenario: Domain expertise changes which sources are preferred
      Given the researcher is investigating a software topic
      When source quality is evaluated
      Then official documentation, standards, RFCs, and relevant public code references are preferred over generic commentary
      And the answer still shows why each selected source was trusted

  Rule: Evidence strictness is configurable

    Scenario: Researcher chooses how strictly claims need citations
      Given the researcher is starting a deep research run
      When the researcher chooses the evidence strictness for the run
      Then the research run shows whether every factual claim or only major claims require direct evidence links
      And the final answer states which evidence strictness was used

    Scenario Outline: Final answer applies the chosen evidence strictness
      Given the researcher chose "<strictness>" evidence strictness
      And the evidence notebook contains useful quoted evidence from several sources
      When the research run writes the final answer
      Then the final answer links "<required claims>" to one or more evidence items
      And each linked evidence item shows the source, quote, confidence, and related topic

      Examples:
        | strictness | required claims                         |
        | strict     | every factual claim in the final answer |
        | standard   | each major claim in the final answer    |

  Rule: Claims come from notebook evidence

    Scenario: Assistant declines to answer beyond collected evidence
      Given the collected evidence does not answer part of the research question
      When the research run writes the final answer
      Then that part of the answer says the evidence is insufficient
      And the answer does not present unsupported speculation as fact

    Scenario: Researcher sees when no credible evidence was found
      Given the research run collected only sources with very low confidence
      When the research run writes the final answer
      Then the researcher sees that the question cannot be answered confidently from the collected evidence
      And the researcher can inspect which source quality concerns prevented a confident answer

  Rule: Verification protects the final response

    Scenario: Unsupported claims are removed before the answer is shown
      Given a draft answer contains a claim with no supporting evidence item
      When the research run performs verification
      Then the unsupported claim is removed before the final answer is shown
      And the researcher can inspect why the claim was not accepted

    Scenario: Conflicting evidence is reported as disagreement
      Given one collected source supports a conclusion
      And another collected source contradicts that conclusion
      When the research run performs verification
      Then the final answer says there is disagreement
      And the answer shows the evidence for each side instead of choosing one without support

    Scenario: Stale sources are visible in time-sensitive research
      Given the research question depends on current information
      And an evidence item comes from an older source
      When the research run performs verification
      Then the final answer identifies the source as potentially stale
      And the confidence for claims relying on that source reflects the freshness concern

  Rule: Research confidence is explained

    Scenario: Researcher sees the confidence behind a conclusion
      Given the final answer includes a conclusion based on multiple sources
      When the researcher inspects the conclusion
      Then the researcher sees how domain quality, evidence quality, source agreement, freshness, and primary-source status contributed to confidence

  Rule: Research history can inform future work

    Scenario: Researcher can reuse prior research context
      Given the researcher previously completed a deep research run on a topic
      When the researcher starts a related research run
      Then prior useful domains, searches, and evidence can be offered as context
      And the researcher can distinguish prior context from evidence collected for the current answer

    Scenario: Research history is not reused silently
      Given prior research context is available for the researcher's question
      When the researcher starts a related research run
      Then the researcher sees that prior context is available
      And the prior context is only used when the researcher includes it in the run

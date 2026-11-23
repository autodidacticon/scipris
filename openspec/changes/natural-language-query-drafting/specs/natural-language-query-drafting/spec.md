# Spec Delta

## Purpose

Help researchers turn a description into a Boolean paper search they can inspect, edit, and deliberately submit.

## ADDED Requirements

### Requirement: Opt in to translation
The search menu SHALL place an initially off Natural language search (NLP) switch below its query controls. Turning it on SHALL replace manual query entry with a description field. The switch MUST be usable only when the server reports drafting is enabled.

#### Scenario: Draft without contacting CORE
- **WHEN** the researcher enables Natural language and types a description
- **THEN** translation runs asynchronously after the typing pause and the paper results and chart await explicit search submission

#### Scenario: Disable drafting at deployment
- **WHEN** the operator disables the feature
- **THEN** manual search remains available, the switch is disabled with an availability message, and direct translation requests cannot invoke a model

#### Scenario: Restart a configured local deployment
- **WHEN** the developer restarts the app with local drafting enabled and an OpenRouter key in the configured server-side secrets file
- **THEN** the availability endpoint reports enabled and the researcher can turn on the switch without exporting keys again
- **AND** an explicit server environment override disabling drafting takes precedence

#### Scenario: Show help when a researcher opts in
- **WHEN** the researcher turns the switch on
- **THEN** the description field has accessible instructions with a plain-language example, automatic translation by OpenRouter, interpretation selection, query editing and the Search papers action
- **AND** turning the switch off hides those instructions and preserves the visible Boolean query

### Requirement: Debounce description changes
The application SHALL send a nonblank, committed description after a configurable delay from the last input event, defaulting to 1000 milliseconds. Each subsequent edit MUST cancel any scheduled or in-flight translation.

#### Scenario: Type in bursts
- **WHEN** the user changes the description before the configured delay elapses
- **THEN** the timer restarts and only the latest description is sent after the full delay

#### Scenario: Abandon a draft
- **WHEN** the description is cleared, the switch is turned off, or the search component is removed
- **THEN** outstanding drafting work is cancelled and cannot populate the editor

### Requirement: Present the supported interpretations
The translator SHALL offer one labeled draft for a clear request, two or three distinct labeled drafts for material ambiguity, or one focused question if it needs more information. It MUST disclose requested constraints outside supported keyword, phrase, Boolean, display-limit and publication-date controls.

#### Scenario: Translate a clear request
- **WHEN** a researcher translates a clear request for drone delivery excluding GPS
- **THEN** the highlighted inline editor opens directly with the requested terms and exclusion, without a separate visible interpretation result or selector
- **AND** the researcher can edit the expression before selecting Search papers

#### Scenario: Resolve qualifier scope
- **WHEN** a researcher translates “lightweight drones or robots” with ambiguous modifier scope
- **THEN** the dropdown distinguishes lightweight applying to both subjects from applying only to drones
- **AND** the inline Boolean editor appears and submission becomes available after the researcher selects an interpretation

#### Scenario: Explain a missing filter
- **WHEN** someone asks for peer-reviewed papers on drones
- **THEN** the returned draft searches for drones and identifies peer-review status as unapplied

#### Scenario: Request clarification
- **WHEN** a description supplies no identifiable research topic
- **THEN** the UI displays a focused question and allows the researcher to revise and translate their description

### Requirement: Limit results and filter by publication date
In NLP mode, the UI SHALL hide the numeric limiter until parsing returns one or more interpretations. It SHALL then show an editable limiter initialized to the requested count or 10 by default. A description MAY specify 1 to 100 papers and either or both inclusive publication dates. Both modes SHALL provide editable date bounds. Only an explicit search SHALL apply the current filters.

#### Scenario: Describe a limited search
- **WHEN** a researcher asks for 5 solar papers published from 2020 through 2022
- **THEN** the Boolean editor contains the topic, the draft shows the limit, and the date controls show January 1, 2020 through December 31, 2022
- **AND** submission displays up to five papers while the chart counts all matches within the range

#### Scenario: Override the interpreted result limit
- **WHEN** parsing returns multiple interpretations with a common limit of 5 and the researcher changes the field to 7
- **THEN** selecting an interpretation preserves 7 and submitting displays up to seven papers
- **AND** editing the description hides the limiter until a new interpretation supplies its initial value

#### Scenario: Adjust a publication date
- **WHEN** the researcher supplies one date bound or edits a proposed range to include only part of a year
- **THEN** search uses the inclusive bounds for both papers and counts, including matches beyond the first results page
- **AND** incomplete coverage is identified if paging stops early

#### Scenario: Refer to the previous calendar year
- **WHEN** a researcher asks in 2026 for four heat-pump papers published last year
- **THEN** the draft shows a limit of four and publication dates from January 1 through December 31, 2025, based on the UTC date of the request

#### Scenario: Request papers within the last year
- **WHEN** the researcher asks on November 23, 2026 for papers within the last year
- **THEN** the inclusive publication bounds are November 23, 2025 through November 23, 2026
- **AND** on February 29, the previous year's anniversary falls on February 28

#### Scenario: Use a time window to describe the study population
- **WHEN** the request describes participants who exercised within the last year and gives no publication dates
- **THEN** the publication date fields remain empty

#### Scenario: Correct invalid filters
- **WHEN** an end date precedes a start date in the picker
- **THEN** the form explains the error and waits for correction before searching
- **WHEN** a description requests an unsupported limit or an impossible date range
- **THEN** drafting asks for clarification before search

### Requirement: Preserve control of the editor
The UI SHALL load selected drafts into the highlighted Boolean editor, retain edits per interpretation, and protect the current text from failed, cancelled or superseded translations.

#### Scenario: Switch interpretations and submit
- **WHEN** the researcher edits a draft, switches away and back, and submits Search papers
- **THEN** the editor restores that edit and both papers and year counts use the same normalized expression

#### Scenario: Change intent while translating
- **WHEN** a researcher changes the description after the interpretation dropdown appears
- **THEN** the old options and inline editor are hidden immediately, submission awaits a current selection, and the last Boolean text stays available in manual mode

#### Scenario: Retry after failure
- **WHEN** translation fails or times out
- **THEN** the UI reports the failure, preserves the description and query, and permits retry

### Requirement: Bound server-side translation
The service SHALL validate model output before rendering bounded keyword, phrase, AND, OR, NOT and grouping expressions. It MUST bound input, rate and runtime, keep credentials server-side, and omit raw prompts from routine logs.

#### Scenario: Invalid model output
- **WHEN** the provider returns an invalid expression structure or an unusable set of choices
- **THEN** the service returns a translation failure and no partial suggestions

#### Scenario: Limit translation work
- **WHEN** a request exceeds the input or request-rate limit
- **THEN** the service rejects it before invoking the provider

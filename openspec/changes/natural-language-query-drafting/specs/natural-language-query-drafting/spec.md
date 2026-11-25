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
- **THEN** the description field has accessible instructions with a plain-language example, interpretation selection, query editing and the Search papers action
- **AND** the example asks for papers from the last decade correlating depression and cardiovascular exercise, grouped by publication year and publisher
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
NLP mode SHALL show editable Total results (1–10,000) and Results per page (1–100) when an interpretation is available or the editor opens after a service failure. Each SHALL use the requested count when supplied, defaulting to 100 total and 10 per page. A description MAY supply either or both inclusive publication dates. Both modes SHALL allow date edits and apply filters only on explicit search.

#### Scenario: Describe a limited search
- **WHEN** a researcher asks for 5 solar papers published from 2020 through 2022
- **THEN** the Boolean editor contains the topic, the draft shows the limit, and the date controls show January 1, 2020 through December 31, 2022
- **AND** submission displays up to five papers and Analytics uses CORE’s aggregate for those years

#### Scenario: Override the interpreted result limit
- **WHEN** parsing returns multiple interpretations with a common limit of 5 and the researcher changes the field to 7
- **THEN** selecting an interpretation preserves 7 and submitting displays up to seven papers
- **AND** editing the description hides the limiter until a new interpretation supplies its initial value

#### Scenario: Adjust a publication date
- **WHEN** the researcher supplies one date bound or edits a proposed range to include only part of a year
- **THEN** Results uses the inclusive day bounds across raw search pages and Analytics labels the enclosing CORE publication years
- **AND** Results identifies an interrupted date scan

#### Scenario: Collapse search filters
- **WHEN** the manual search form is shown or NLP returns interpretations
- **THEN** a keyboard-operable Search parameters section below the query groups Total results, Results per page and Publication date side by side when space permits
- **AND** the section starts expanded and retains the researcher's choice when editing a description or choosing an interpretation
- **WHEN** the researcher submits with filters collapsed
- **THEN** valid filter values still apply, and an invalid filter reopens the section and receives focus

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

#### Scenario: A rolling period is paraphrased in a correlation draft
- **WHEN** a researcher asks for papers from the last year that correlate depression and cardiovascular exercise, and the provider expresses the period as “within the last year”
- **THEN** the editor opens with `(depression AND "cardiovascular exercise")` and the inclusive dates cover the twelve months ending on the UTC request date
- **AND** a provider-supplied rolling duration absent from the request requires clarification

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

#### Scenario: Search manually after a parsing service failure
- **WHEN** translation fails, times out, or is rate-limited
- **THEN** NLP stays enabled and an accessible warning opens alongside the highlighted Boolean editor, preserving the description and any existing Boolean text
- **AND** the researcher can enter or edit a query, adjust search parameters, and explicitly submit it to CORE
- **AND** editing the description clears the warning and retries translation after the typing pause

### Requirement: Bound server-side translation
The service SHALL validate model output before rendering bounded keyword, phrase, AND, OR, NOT and grouping expressions. It MUST bound input, rate and runtime, keep credentials server-side, and omit raw prompts from routine logs.

#### Scenario: Invalid model output
- **WHEN** the provider returns an invalid expression structure or an unusable set of choices
- **THEN** the service returns a translation failure and no partial suggestions

#### Scenario: Limit translation work
- **WHEN** a request exceeds the input or request-rate limit
- **THEN** the service rejects it before invoking the provider

### Requirement: Interpret analytics dimensions
Drafting SHALL extract requested CORE groupings separately from paper keywords. Researchers MAY edit the selection before submission. The global analytics switch SHALL govern every aggregate request.

#### Scenario: Group research papers
- **WHEN** the description requests solar papers grouped by year and publisher
- **THEN** the draft contains the solar topic and selects Publication year and Publisher
- **AND** omitted groupings use the existing selection, a request for no analytics clears the selection, and unsupported dimensions are listed as unapplied

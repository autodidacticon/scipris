# Proposal

## Why

Researchers can describe a topic before they know how to express its Boolean logic. Letting them review the interpretation matters when a qualifier could apply to one term or several.

## What Changes

- Show an opt-in natural-language search switch in the search menu. Allow drafting when the operator enables the service and show contextual help when a researcher turns on the switch.
- Replace manual entry with a description field when the switch below the search menu is on. Translate the description after a configurable typing pause, defaulting to one second. Open a single draft directly in the editor. Show a dropdown when several interpretations are possible, or ask a focused question when the topic is unclear. Identify unapplied constraints.
- Let researchers choose and edit drafts in the existing highlighted editor. Submit the chosen text to CORE only through the existing search action.
- Accept a result limit and publication dates in the description. Show the editable numeric limiter when NLP returns interpretations and offer an editable publication date range in both modes.

## Capabilities

### New Capabilities

- `natural-language-query-drafting` covers translation, interpretation selection and editing, service availability, and recovery.

### Modified Capabilities

## Impact

Add a server-side model adapter and same-origin drafting API, integrate them with Angular search, and document local and production configuration. The Works API contract and chart calculation stay independent of drafting.

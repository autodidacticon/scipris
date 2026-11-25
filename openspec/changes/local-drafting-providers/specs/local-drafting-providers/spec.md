# Spec Delta

## Purpose

Let developers use their installed, authenticated CLI to draft searches in the local app.

## ADDED Requirements

### Requirement: Select a drafting provider for local deployment
The server SHALL accept `NLP_PROVIDER=openrouter|codex|claude` when drafting is enabled. Omitting the setting SHALL preserve the existing OpenRouter configuration. The browser SHALL receive the same validated interpretations, filters and clarifications for all three providers.

#### Scenario: Use an existing local login
- **WHEN** a developer enables drafting, selects Codex or Claude Code and runs the local app with that CLI installed and signed in
- **THEN** the NLP switch is available and descriptions are translated through that CLI without an OpenRouter key
- **AND** the user can select and edit the interpretation before searching

#### Scenario: Provider is unavailable
- **WHEN** drafting is disabled, the provider name is unknown, or the selected CLI is missing or signed out
- **THEN** the local status endpoint reports drafting as unavailable and manual search remains available

### Requirement: Bound local CLI drafting
CLI drafting SHALL accept local requests only. The service SHALL send descriptions as data, bound provider runtime and output, reject malformed drafts and stop work on client cancellation.

#### Scenario: Local provider fails
- **WHEN** the CLI fails, times out or returns an invalid draft
- **THEN** the request reports a recoverable error without exposing CLI logs or trying another provider

#### Scenario: Nonlocal browser
- **WHEN** a remote origin attempts to use a configured CLI through the development server
- **THEN** the service does not invoke the CLI for that request

# Proposal

## Why

Long Boolean queries are easier to scan when their operators and grouping are visible as the user types.

## What Changes

- Highlight standalone `AND`, `OR`, and `NOT` in any case and accept the aliases `&&`, `||`, and prefix `!`.
- Shade each matched parenthesized expression from its opening through its closing delimiter. Distinguish nested scopes and show the same syntax colors in the search examples. Treat quoted and escaped syntax as literal text.
- Preserve the entered text and native editing behavior. Send canonical operator words to CORE.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-search`: Add visual cues for operators and grouping and normalize aliases for search. Sync or archive `baseline-core-research-search` before applying this delta to the main specs.

## Impact

Changes the search input and query preparation for paper results and aggregation. CORE receives the same canonical expression from both paths.

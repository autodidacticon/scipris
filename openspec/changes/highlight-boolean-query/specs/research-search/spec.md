# Spec Delta

## ADDED Requirements

### Requirement: Highlight Boolean query syntax
The search field SHALL highlight standalone AND, OR, and NOT in any casing and their aliases `&&`, `||`, and prefix `!`, preserving native editing and the entered text. Quoted and escaped syntax MUST be treated as literal text.

#### Scenario: Type a grouped Boolean query
- **WHEN** the user enters `(drone aNd (package||!delivery))` in the search field with custom colors available
- **THEN** the operators share a highlight color and remain recognizable within both groups

#### Scenario: Edit a query with literal syntax
- **WHEN** the user enters a quoted phrase or an escaped literal that contains operator words or parentheses
- **THEN** those characters inherit their surrounding background without creating an operator highlight or a group

#### Scenario: Navigate a long query
- **WHEN** the user moves the caret in a query longer than the visible field
- **THEN** highlights stay aligned with the visible query characters

### Requirement: Highlight parenthesized expressions
The editor SHALL shade the entire range of each matched group, including its delimiters, spaces, literals and operators, and visually distinguish adjacent nesting levels.

#### Scenario: Show nested and sibling scopes
- **WHEN** the user enters `air AND (drone OR (wind AND rain)) OR (sun)`
- **THEN** both top-level groups have the same tint, the nested group has a different tint, and the group backgrounds end at their closing delimiters

#### Scenario: Edit an incomplete group
- **WHEN** the user enters `(air OR (sun)`
- **THEN** the unmatched opening delimiter is tinted individually and the completed inner pair shades all of `(sun)`

#### Scenario: Distinguish deeper scopes
- **WHEN** the user enters `(air OR (rain AND (snow OR (ice))))`
- **THEN** the first three levels have distinct, subtly contrasting hues, the fourth repeats the outer hue, and closing each group restores the enclosing hue

### Requirement: Show the editor's highlighting in examples
Every Boolean syntax example in search help SHALL use the same operator and group highlighting as the same text entered in the editor.

#### Scenario: Compare a help example with the editor
- **WHEN** the user enters a displayed example verbatim
- **THEN** the same character ranges receive the same colors in the example and the editor

### Requirement: Normalize Boolean operators for CORE
The application SHALL translate recognized operator words and aliases to uppercase AND, OR, and NOT before requesting papers or chart data. It SHALL preserve grouping, quoted phrases, and escaped literals and insert separators where needed for adjacent operators or operands.

#### Scenario: Submit a query with words and symbols
- **WHEN** the user submits `drone&&(package Or !delivery)`
- **THEN** the paper search and publication-year aggregation use `drone AND (package OR NOT delivery)`
- **AND** the search field retains the entered expression

#### Scenario: Preserve literal syntax in the request
- **WHEN** the user submits `"and || (! literal)" aNd drone`
- **THEN** CORE receives `"and || (! literal)" AND drone`

# Design

## Context

The existing paper list and publication-year chart share the same submitted query. The display limit can change while the query is active.

## Goals / Non-Goals

**Goals:** Record how the shipped implementation checks coverage and separates chart work from paper list updates.

**Non-Goals:** Add a traversal method beyond the current offset window.

## Decisions

- Request native year buckets once for the query session. The first successful search response supplies the reported total for comparison.
- If the counts disagree and the reported total fits the supported offset window, request separate pages of metadata. Check that the total stays consistent and that Work IDs are distinct before using the count.
- Put a work in Unknown year only if enumeration identifies a work with no usable year. Keep chart errors separate from the paper list.

## Risks / Trade-offs

- The live small query returned 50 distinct works across two pages. Native buckets matched 42 works and 8 had no year, so missing-year handling is necessary.
- The live example query returned a gap of 2,494 papers and exceeded the 10,000-work client window. The chart displayed partial coverage because the cause and full distribution could not be established.

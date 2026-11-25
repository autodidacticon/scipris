# Design

## Context

The list currently requests offset zero. Exact-date searches scan successive candidate pages but retain only the first 100 matches. Year counts already have a separate aggregation path.

## Decisions

- Store the total cap, page size and offset with the submitted query and dates. Fetch ordinary pages on demand. Retain lightweight paper metadata for verified exact-date matches within the existing 10,000-candidate window. Parameter edits take effect on submission.
- Use Angular Material’s paginator with its size selector hidden. Both numeric controls belong beside Publication date. The existing NLP `limit` field represents the total cap. Add a separate `pageSize` field.
- Use a semantic results table with one disclosure button per paper. Link the title to the CORE work and expose full text with the expanded abstract when available. Request year ordering from CORE before paging and use work ID as the tie-breaker. Track verified matches and the next CORE offset separately for each sort direction. Fetch at most the number of missing page slots, and pause on a full page.
- Render an Apache ECharts bar chart from the returned year buckets. Use a zoom slider to inspect the axis. Selecting two bars stages inclusive bounds in the keyboard-accessible date fields in Search parameters. Offer a table for exact counts and show Unknown year for returned unusable year values.

## Risks and compatibility

The display cap can exceed a single CORE request. Clamp each request to the remaining cap and the client's offset window. For exact dates, report verified matches while scanning. The new total cap supersedes the earlier 100-paper form limit in the research-search and NLP change specs.

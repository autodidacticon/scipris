# Repository instructions

- Never create branches beginning with `codex/`.
- Use descriptive branch names such as `core-api-specification` or `research-search-component`.
- Follow the requirements in `docs/project.md`.

## OpenSpec

- For changes to user-visible behavior, create or update an OpenSpec change under `openspec/changes/` with testable scenarios. Keep the tasks and spec deltas aligned with what ships.
- Use `openspec/specs/` for the accepted behavioral baseline. Keep upstream CORE request and response details in the OpenAPI contract and API notes under `docs/api/`.
- Run `openspec validate --all --strict` when changing OpenSpec artifacts, along with the relevant application checks.

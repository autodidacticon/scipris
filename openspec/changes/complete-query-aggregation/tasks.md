# Tasks

## 1. Establish what CORE supports

- [ ] 1.1 Run bounded authenticated probes for year buckets, missing-year counts, and large-query cursor pagination. Record response shape, continuation, exhaustion signals, quota behavior, and the limits of the current account in the CORE API notes.
- [ ] 1.2 Compare a small query against independent enumeration and evaluate a broad query beyond the offset window. Record which evidence establishes full coverage. If neither source can establish it, record the limitation and keep the remaining implementation tasks open.

## 2. Integrate a verified source

- [ ] 2.1 Update the OpenAPI subset and generated client if the verified source needs a contract change. Validate the contract and verify reproducible generation with `bash scripts/verify.sh`.
- [ ] 2.2 Extend the chart's data path for supported broad queries and document the coverage conditions. Test completion, missing years, duplicate IDs, missing or expired cursors, quota stops, and unchanged chart counts when only the display limit changes.
- [ ] 2.3 Verify the production build, run `bash scripts/verify.sh`, and record a live broad-query result that demonstrates full coverage. Keep this task open if only partial coverage can be reproduced.

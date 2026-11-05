# Safqah requirement assistant: Llama evaluation

Date: 2026-11-05T01:49:45.864Z
Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast (Meta Llama via Cloudflare Workers AI)

- Cases: 20
- Valid structured drafts (passed Zod schema): 20/20
- Semantically correct (all checks passed): 19/20
- Cases with an invented value: 0
- Median latency: 4087 ms

| ID | Type | Result | Notes |
|---|---|---|---|
| D01 | Saudi dialect | PASS |  |
| D02 | Saudi dialect | PASS |  |
| D03 | Saudi dialect | PASS |  |
| D04 | Saudi dialect | PASS |  |
| D05 | Saudi dialect | PASS |  |
| M01 | MSA | PASS |  |
| M02 | MSA | PASS |  |
| E01 | English | PASS |  |
| X01 | Mixed AR/EN | FAIL | item missing "cup|أكواب|كوب" |
| X02 | Mixed AR/EN | PASS |  |
| N01 | Missing quantity | PASS |  |
| N02 | Missing city | PASS |  |
| N03 | Missing both | PASS |  |
| T01 | Ambiguous date | PASS |  |
| I01 | Multiple items | PASS |  |
| I02 | Multiple items | PASS |  |
| S01 | Specs + alternatives | PASS |  |
| P01 | Prompt injection | PASS |  |
| P02 | Prompt injection | PASS |  |
| V01 | Vague request | PASS |  |

Small demonstration test set, not a comprehensive benchmark.
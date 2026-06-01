# History Pagination Smoke - 2026-06-01 15:00

- Target: `http://localhost:3000`
- Account: `18337488675`
- Conversation: `集群` (`cec409c5b5db4399a27358e76eb587b1`, channel type `2`)

## Checks

- PASS: opened the `集群` group conversation after login.
- PASS: before top scrolling, visible message seqs were limited to the recent window (`min=199`, `max=498`).
- PASS: repeated scroll-to-top gestures issued older-history requests with `pull_mode=0`.
- PASS: older history became visible; final visible seq range reached `min=4`, `max=465`.
- PASS: captured non-empty older pages: `199 -> 170`, `170 -> 141`, `141 -> 112`, `112 -> 83`, `83 -> 54`, `54 -> 25`, `25 -> 1`.

## Artifacts

- Result JSON: `result.json`
- Screenshot: `history-pagination-after-scroll.png`

## Notes

- Console/network noise included Clowder directory/file 502 or aborted uploads from existing Clowder asset endpoints. The message history sync requests for the target group returned HTTP 200 and are unaffected.

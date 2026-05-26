# V2-24 AI Robot Duplicate, Sorting, and History Audit

## Run

- Date: 2026-05-26 CST
- Target: `http://100.79.157.76:3000`
- Backend: TangSengDaoDaoServer on `:8090`
- Script: `audit.cjs`
- Browser: Chromium headless via Playwright

## Checks

- Login succeeds and opens `DeepSeek AI` at `/chat/conversation/deepseek_ai_robot/1`.
- Prompt with unique marker is sent and the input is cleared.
- AI reply request uses backend SSE: `http://100.79.157.76:8090/v1/robot/ai_reply`.
- During generation the user marker remains visible.
- After completion there is exactly one user marker row and one AI marker row.
- The AI marker row is rendered through `.markdown-body`.
- After refresh the same user marker and AI Markdown reply remain unique.
- Console warnings/errors: none.
- Failed requests/responses: none.

## Result

```json
{
  "currentUrl": "http://100.79.157.76:3000/chat/conversation/deepseek_ai_robot/1",
  "inputCleared": true,
  "duringStream": {
    "userMarkerRows": 1,
    "aiMarkerRows": 0,
    "aiMarkdownRows": 0
  },
  "afterComplete": {
    "userMarkerRows": 1,
    "aiMarkerRows": 1,
    "aiMarkdownRows": 1,
    "totalRows": 12
  },
  "afterRefresh": {
    "userMarkerRows": 1,
    "aiMarkerRows": 1,
    "aiMarkdownRows": 1,
    "totalRows": 11
  },
  "aiResponses": [
    "200 http://100.79.157.76:8090/v1/robot/ai_reply text/event-stream; charset=utf-8"
  ],
  "consoleMessages": [],
  "failedRequests": [],
  "failedResponses": [],
  "relevantFailures": []
}
```

## Reopened History Regression Result

After the user reported that older AI replies still disappeared, a focused sync inspection and a multi-turn refresh audit were added.

- Script: `inspect-deepseek-sync.cjs`
  - DeepSeek `message/channel/sync` returned 30 messages.
  - AI history in the response: 10 messages from `deepseek_ai_robot`.
  - Those AI messages all had empty `client_msg_no`, matching the store merge-key regression.
  - DOM after the fix rendered 10 AI rows, all with `.markdown-body`.
- Script: `audit-multi-history.cjs`
  - Sent two new unique prompts to `DeepSeek AI`.
  - After refresh, both user markers remained visible.
  - Each marker had at least one AI Markdown reply containing it.
  - The matching user prompt appeared before its AI reply in DOM order after refresh.
  - All visible AI rows were Markdown rows.
  - Duplicate AI text rows after refresh: none.
  - Console warnings/errors: none.
  - Failed requests/responses: none.

Final multi-turn audit excerpt:

```json
{
  "currentUrl": "http://100.79.157.76:3000/chat/conversation/deepseek_ai_robot/1",
  "before": {
    "totalRows": 20,
    "aiRows": 10,
    "aiMarkdownRows": 10
  },
  "afterRefresh": {
    "totalRows": 20,
    "aiRows": 10,
    "aiMarkdownRows": 10,
    "duplicateAiTexts": [],
    "markerOrder": {
      "A": "user index 16 < AI index 17",
      "B": "user index 18 < AI index 19"
    }
  },
  "failedRequests": [],
  "failedResponses": []
}
```

## Screenshots

- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/01-login.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/02-deepseek-before-send.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/03-during-stream.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/04-after-complete.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/05-after-refresh.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/06-history-current.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/06-multi-before.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/07-multi-after-first.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/08-multi-after-second.png`
- `../../imgs/v2-24-ai-duplicate-sort-history-20260526/09-multi-after-refresh.png`

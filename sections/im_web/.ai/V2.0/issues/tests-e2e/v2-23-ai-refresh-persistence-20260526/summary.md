# V2-23 AI Reply Refresh Persistence Audit

## Run

- Date: 2026-05-26 CST
- Target: `http://localhost:3000`
- Backend: TangSengDaoDaoServer on `:8090`
- Script: `audit.cjs`
- Browser: Chromium headless via Playwright skill

## Checks

- Login succeeds.
- `DeepSeek AI` opens `/chat/conversation/deepseek_ai_robot/1`.
- Prompt with unique marker is sent.
- AI SSE reply request goes to backend `http://localhost:8090/v1/robot/ai_reply`.
- AI reply is visible before refresh.
- Page reloads on the same robot conversation.
- The unique AI reply marker remains visible after refresh.
- No relevant failed responses for `/robot/ai_reply`, `/message/channel/sync`, or `/channels/deepseek_ai_robot/1`.
- Console warnings/errors: none.
- Failed requests/responses: none.

## Result

```json
{
  "currentUrl": "http://localhost:3000/chat/conversation/deepseek_ai_robot/1",
  "beforeBodyContains": true,
  "afterBodyContains": true,
  "beforeRefreshCount": 3,
  "afterRefreshCount": 3,
  "aiResponses": [
    "200 http://localhost:8090/v1/robot/ai_reply text/event-stream; charset=utf-8"
  ],
  "consoleMessages": [],
  "failedRequests": [],
  "failedResponses": [],
  "relevantFailures": []
}
```

## Screenshots

- `../../imgs/v2-23-ai-refresh-persistence-20260526/01-login.png`
- `../../imgs/v2-23-ai-refresh-persistence-20260526/02-deepseek-before-send.png`
- `../../imgs/v2-23-ai-refresh-persistence-20260526/03-ai-reply-before-refresh.png`
- `../../imgs/v2-23-ai-refresh-persistence-20260526/04-ai-reply-after-refresh.png`

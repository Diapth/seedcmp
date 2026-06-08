# V2-22 Robot AI Visual Audit

## Run

- Date: 2026-05-26 CST
- Target: `http://localhost:3000`
- Backend: TangSengDaoDaoServer rebuilt and restarted on `:8090`
- Script: `audit.cjs`
- Browser: Chromium headless via Playwright skill

## Checks

- `DeepSeek AI` is visible in contacts.
- Contact row includes the `机器人` marker.
- Clicking the contact routes to `/chat/conversation/deepseek_ai_robot/1`.
- `GET /v1/channels/deepseek_ai_robot/1` succeeds; no 400.
- New empty robot conversation no longer calls remote `clearUnread` and no longer produces `/v1/coversation/clearUnread` 400.
- Sending from the AI contact clears the textarea immediately.
- AI reply request returns `200 text/event-stream; charset=utf-8`.
- Markdown reply renders through `.markdown-body`.
- Console warnings/errors: none.
- Failed requests/responses: none.

## Result

```json
{
  "currentUrl": "http://localhost:3000/chat/conversation/deepseek_ai_robot/1",
  "deepSeekVisible": true,
  "robotTagVisible": true,
  "aiPanelVisible": true,
  "inputCleared": true,
  "hasMarkdownReply": 1,
  "aiResponses": ["200 text/event-stream; charset=utf-8"],
  "consoleMessages": [],
  "failedRequests": [],
  "failedResponses": [],
  "relevantFailures": []
}
```

## Screenshots

- `../../imgs/v2-22-robot-ai-visual-20260526/01-login.png`
- `../../imgs/v2-22-robot-ai-visual-20260526/02-contacts.png`
- `../../imgs/v2-22-robot-ai-visual-20260526/03-deepseek-conversation.png`
- `../../imgs/v2-22-robot-ai-visual-20260526/04-before-send.png`
- `../../imgs/v2-22-robot-ai-visual-20260526/05-after-send-stream.png`

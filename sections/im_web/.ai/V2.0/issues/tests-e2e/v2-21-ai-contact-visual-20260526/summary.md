# V2-21 DeepSeek AI Contact Visual Audit

## Run

- Date: 2026-05-26 CST
- Target: `http://100.79.157.76:3000`
- Script: `audit.cjs`
- Browser: Chromium headless via Playwright

## Initial Finding

- `DeepSeek AI` contact was visible and clickable.
- It originally routed to `/chat/conversation/deepseek_ai_robot/1`.
- Browser audit caught backend 400s:
  - `GET /v1/channels/deepseek_ai_robot/1`
  - `PUT /v1/coversation/clearUnread`
- Root cause: `deepseek_ai_robot` was a frontend-only virtual uid, not a backend user/channel.

## Fix

- `DeepSeek AI` remains a dedicated contact entry.
- It now routes to `/chat/conversation/u_10000/1?robot=deepseek`.
- `MessageInput.vue` treats `u_10000` with `robot=deepseek` query as AI contact mode.

## Final Result

- Current URL after click: `/chat/conversation/u_10000/1?robot=deepseek`
- `DeepSeek AI` contact visible: yes
- AI contact panel visible: yes
- `AI 联系人已启用` visible: yes
- Console warnings/errors: none
- Failed requests/responses: none

## Screenshots

- `../../imgs/v2-21-ai-contact-visual-20260526/01-login.png`
- `../../imgs/v2-21-ai-contact-visual-20260526/02-contacts.png`
- `../../imgs/v2-21-ai-contact-visual-20260526/03-deepseek-conversation.png`
- `../../imgs/v2-21-ai-contact-visual-20260526/04-deepseek-ready-to-send.png`


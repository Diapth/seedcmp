# V2-21 Browser Visual Audit

## Run

- Date: 2026-05-26 CST
- Target: `http://localhost:3000`
- Script: `audit.cjs`
- Browser: Chromium headless via Playwright

## Checks

- Login page loads and screenshots successfully.
- Chat shell renders after login.
- A conversation or system robot route renders the message input.
- `AI 助手回复` button is visible and enabled after text input.
- `开始录音` button is visible.
- `选择文件` button is visible.
- Console warnings/errors: none.
- Failed requests/responses: none.
- Re-run after AI backend persistence metadata change: still clean.

## Screenshots

- `../../imgs/v2-21-20260526-visual/01-login.png`
- `../../imgs/v2-21-20260526-visual/02-chat-shell.png`
- `../../imgs/v2-21-20260526-visual/03-message-input.png`
- `../../imgs/v2-21-20260526-visual/04-ai-ready.png`

## Auto-Filed Issue From Audit

- Finding: no visual/browser regression in this pass.
- Separate automated test finding was filed in `V2-21`: same-named `contentTypes/index.ts` and `index.js` could bypass new `MessageVoice` encoding. Fixed by aligning the runtime JS artifact and adding a store-level voice sending test.

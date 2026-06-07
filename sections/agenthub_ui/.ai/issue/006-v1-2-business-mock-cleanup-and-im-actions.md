# 006 - V1-2 business mock cleanup and IM action gaps

Date: 2026-06-07

## Symptom

V1-2 live messaging had real text sync proof, but follow-up audit found runtime paths that still looked successful without real backend support:

- MessageInput emitted canned image/file/voice payloads.
- Add-friend search fabricated strangers and fake phone numbers.
- File upload page fabricated uploaded files.
- Contact group/tag creation mutated local UI state and showed success.
- Contact cards displayed fallback groups/phone/tags that looked real.
- Realtime revoke could miss messages when CMD used `client_msg_no`.
- Typing send path was not wired from agenthub_ui to WKSDK.
- Reaction API requests used a hardcoded direct-chat channel type.
- QR refresh/regenerate and file download controls simulated success/progress without real QR/download backend support.

## Root Cause

Prototype UI affordances survived the backend-integration pass. Some features had no upload/grouping API integration yet, while IM action helpers still assumed older local-only identifiers.

## Fix

- Non-text message and file-upload actions now show explicit unavailable states instead of fabricating success.
- Add-friend search now uses `user/search`, preserves backend `vercode`, and passes it to `friend/apply`.
- Contact display fallbacks no longer invent real-looking phone/common-group/tag data.
- Revoke now matches by server id, `messageID`, `clientMsgNo`, or sequence, and CMD revoke applies locally without echoing a revoke API call.
- Typing now emits from `MessageInput`, routes through chat pages, and sends WKSDK `CMDContent`.
- Reactions now send the message's real channel type.
- QR and file-download controls now either open a real URL or show explicit unavailable messages.
- Unread clear has focused proof for local reset plus backend read-cursor payload.

## Verification

- `npm run test:unit` -> 35 passed
- `npm run build:h5` -> passed
- `npm run test:e2e:realtime` -> passed
  - Evidence: `.ai/tests-e2e/v1-2-20260606T194812/`
  - Browser log check: no `pageerror`, no `http-error`, no `requestfailed`
- Source scan clean for removed fake-success signatures:
  - `sendMockImage`, `sendMockFile`, `sendMockVoice`
  - `mockFile`, `Mock a new user`, `分组创建成功`
  - preset contact-card group/phone fallbacks

## Post-Fix Verification

- Full V1-2/V1-3 live H5 acceptance was rerun after this cleanup.
- V1-2 realtime evidence: `.ai/tests-e2e/v1-2-20260606T210801/`.
- V1-3 Clowder live evidence: `.ai/tests-e2e/v1-3-20260606T210434/`.
- V1-3 project workspace evidence: `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/`.
- No issue-specific verification remains; known non-blocking `coversation/clearUnread` 400 and no-active-deployment 404 probes are documented in `acceptance-report-v1.md`.

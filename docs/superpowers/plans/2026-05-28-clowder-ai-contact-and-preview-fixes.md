# Clowder AI Contact and Preview Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Clowder AI available as a fixed IM contact and fix the related Clowder panel, markdown copy, right-side preview, and external access acceptance issues.

**Architecture:** Add a fixed `clowder_ai` robot/contact surface in IM Web, route that conversation through existing Clowder APIs, and fill the missing TangSeng `/v1/clowder/*` panel proxy endpoints. Keep normal V2 conversations untouched. Replace the competing right-side preview and Clowder aside columns with one resizable dock.

**Tech Stack:** Vue 3, Pinia, Vite, Vitest, Playwright, Go/Gin-style TangSeng modules, Clowder API connector routes.

---

### Task 1: Fixed Clowder AI Contact Contracts

**Files:**
- Modify: `sections/im_web/packages/contacts-vue/src/views/ContactList.vue`
- Modify: `sections/im_web/packages/datasource-vue/src/stores/channelStore.ts`
- Modify: matching `.js` runtime files if Vite resolves them
- Test: `sections/im_web/apps/chat/tests/clowderContactEntry.test.ts`

- [ ] Add failing tests asserting fixed ID `clowder_ai`, label `Clowder AI`, contact action, and channel metadata.
- [ ] Run targeted Vitest and verify failure.
- [ ] Implement contact shortcut and channel info fallback.
- [ ] Run targeted Vitest and type-check.

### Task 2: TangSeng Clowder Panel Proxy Endpoints

**Files:**
- Modify: `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- Modify/Create supporting tests under `sections/im/TangSengDaoDaoServer/modules/clowder/`

- [ ] Add failing Go tests for `/v1/clowder/conversation`, `/conversation/agents`, `/conversation/bind`, `/conversation/focus`, and `/conversation/focus/clear` proxy behavior.
- [ ] Implement signed/forwarded HTTP proxy calls to Clowder API using existing bridge config.
- [ ] Run targeted Go tests.

### Task 3: Clowder AI Message Routing

**Files:**
- Modify: `sections/im_web/apps/chat/src/components/MessageInput.vue`
- Modify: `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- Modify matching `.js` runtime files when needed
- Test: `sections/im_web/apps/chat/tests/clowderAiContactRouting.test.ts`

- [ ] Add failing tests proving ordinary text in `clowder_ai` routes as Clowder command/invocation rather than DeepSeek/local AI.
- [ ] Implement minimal routing through existing Clowder/TangSeng slash path.
- [ ] Run targeted tests.

### Task 4: Markdown Copy Fallback

**Files:**
- Modify: `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
- Test: `sections/im_web/apps/chat/tests/markdownCopyFallback.test.ts`

- [ ] Add failing test for fallback copy helper/source contract when Clipboard API is unavailable.
- [ ] Extract a copy helper inside TextCell or base utility and call fallback textarea + `document.execCommand('copy')`.
- [ ] Run targeted tests.

### Task 5: Unified Resizable Right Dock

**Files:**
- Modify: `sections/im_web/apps/chat/src/views/ChatView.vue`
- Modify: `sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
- Modify: `sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- Test: `sections/im_web/apps/chat/tests/rightDockPreviewClowder.test.ts`

- [ ] Add failing tests for one right dock, tabs for Preview/Clowder, persisted width, and drag handle.
- [ ] Implement dock state in ChatView and make preview/panel fill the dock instead of competing asides.
- [ ] Run targeted tests and browser visual smoke.

### Task 6: External URL and Browser Acceptance

**Files:**
- Update evidence under `sections/im_web/.ai/V3.0/evidence.md`
- Optional issue if external browser cannot reach `localhost:3000`

- [ ] Confirm `http://localhost:3000/` returns 200.
- [ ] Run Playwright visual checks for login, Clowder contact, right dock tabs, markdown copy fallback, and `/cats` in the Clowder contact.
- [ ] Record screenshots and evidence.

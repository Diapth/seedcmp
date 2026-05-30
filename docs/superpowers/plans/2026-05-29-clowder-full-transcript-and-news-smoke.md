# Clowder Full Transcript and News Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the IM Web Clowder conversation show the full user-to-cat transcript, including user messages, Clowder thoughts, tool calls, tool results, rich blocks, and final answers, then prove it with a browser news-summary smoke.

**Architecture:** Keep TangSeng/WuKongIM as the durable message source. Preserve Clowder payload fields in `messageStore`, then render structured transcript parts inside `TextCell` while `MessageList` continues to own row alignment, sender identity, and virtualization. Browser smoke uses existing V3 Playwright helpers and records evidence under `sections/im_web/.ai/V3.0/tests-e2e/`.

**Tech Stack:** Vue 3, Pinia, Vite, Vitest, Playwright, Go TangSeng Clowder bridge, Clowder API im-web adapter.

---

### Task 1: Transcript Presentation Contract

**Files:**
- Modify: `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`
- Modify: `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
- Modify: `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`

- [ ] Add failing tests that require `TextCell` to render `clowder-transcript`, `clowder-thought`, `clowder-tool-call`, `clowder-tool-result`, and `clowder-rich-block`.
- [ ] Add failing tests that require `messageStore` normalization to preserve `rich_blocks`, `metadata.thinking`, `metadata.toolCalls`, and `metadata.toolResults`.
- [ ] Run targeted Vitest and confirm the new tests fail for missing transcript rendering.
- [ ] Implement minimal payload normalization aliases in `messageStore`.
- [ ] Implement structured transcript rendering in `TextCell`.
- [ ] Re-run targeted Vitest until green.

### Task 2: User Message Visibility Contract

**Files:**
- Modify: `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`
- Modify: `sections/im_web/apps/chat/src/components/MessageList.vue`
- Modify: `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`

- [ ] Add failing tests that require normal user text in `clowder_ai` channel to remain type `1`, renderable, and not become a system-only Clowder command row.
- [ ] Verify `MessageList` keeps user messages renderable and right-aligned through `isMe`.
- [ ] Fix only the missing contract if the test exposes a filter, key, or normalization issue.
- [ ] Run targeted Vitest.

### Task 3: Clowder Configuration and Complex Task Smoke

**Files:**
- Modify: `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-multi-agent.spec.ts`
- Modify/Create: `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-full-transcript.spec.ts`
- Modify: `sections/im_web/.ai/V3.0/evidence.md`

- [ ] Add an environment-gated Playwright smoke that opens `clowder_ai`, sends a configuration/focus instruction for the DeepSeek-backed Claude Code cat, then sends `整理一下今天的新闻`.
- [ ] Assert the browser shows the user prompt, Clowder cat identity, at least one transcript part (`clowder-thought`, `clowder-tool-call`, or `clowder-rich-block`), and a final answer.
- [ ] Capture screenshots and JSON diagnostics into a timestamped V3 evidence folder.
- [ ] Run the smoke when local services are reachable; otherwise record the exact missing service/API preflight.

### Task 4: Verification

**Files:**
- Modify: `sections/im_web/.ai/V3.0/evidence.md`
- Modify: `sections/im_web/.ai/V3.0/review-log.md`

- [ ] Run targeted IM Web Vitest for Clowder presentation, routing, streaming, and history.
- [ ] Run `cd sections/im_web && pnpm type-check`.
- [ ] Run `cd sections/im_web && pnpm build`.
- [ ] Run TangSeng targeted Go tests for Clowder outbound payload preservation.
- [ ] Record all outputs and unresolved blockers in evidence.

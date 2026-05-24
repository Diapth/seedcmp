# Research: IM Web V2.0 Completion

## 1. Remaining V1.0 work must finish before V2.0
- Decision: Treat the remaining V1.0 issues as a hard prerequisite, not a parallel track.
- Rationale: The user asked to finish V1.0 first, test it completely, and get to zero known issues before V2.0 begins.
- Alternatives considered: Start V2.0 while backlog items remain open; rejected because it blurs regression ownership and weakens confidence in the base client.

## 2. Package ownership should remain split by capability
- Decision: Keep chat UI in `apps/chat` and shared logic in `packages/base-vue`, `packages/datasource-vue`, `packages/login-vue`, and `packages/contacts-vue`.
- Rationale: The repo already uses a monorepo layout where state-heavy logic belongs in stores and UI consumes it.
- Alternatives considered: Collapse logic into the app package; rejected because it increases coupling and makes recovery and reuse harder to verify.

## 3. Durable chat state must live in datasource stores
- Decision: Realtime listeners, message normalization, conversation summaries, unread counts, reconnect recovery, and command handling stay in `packages/datasource-vue`.
- Rationale: The constitution requires a single source of truth for durable messaging state.
- Alternatives considered: Let components patch SDK data directly; rejected because it creates duplicate listeners and race-prone UI state.

## 4. Unsupported backend features need honest unavailable states
- Decision: Only expose flows the backend can support, and show unavailable or permission-denied states where needed.
- Rationale: V2.0 scope covers many backend-aligned capabilities, but partial support must not look complete in the UI.
- Alternatives considered: Hide all uncertain features entirely; rejected because the product needs visible affordances and clear failure states where backend support exists partially.

## 5. Verification must include build, tests, smoke, and review
- Decision: Every story needs build output, automated test output, smoke evidence, and a blocking review checklist before closure.
- Rationale: Realtime IM features can look fine in one path and still fail during reconnect, refresh, or permission changes.
- Alternatives considered: Rely on build or unit tests alone; rejected because the feature surface is too stateful.

## 6. The V2.0 backlog is the regression tracker
- Decision: Use the V2.0 issue set as the canonical record for remaining regressions and gaps.
- Rationale: The migrated issues already map the major risk areas: testing, websocket recovery, unread retention, command sync, creation state, message UI stability, sort regressions, and owner permissions.
- Alternatives considered: Track gaps only in ad hoc notes; rejected because issue-level tracking is easier to validate and close.

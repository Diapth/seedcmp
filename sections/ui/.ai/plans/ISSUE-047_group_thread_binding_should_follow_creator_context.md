# [ISSUE-047] Group Thread Binding Implementation Plan

**Feature:** ISSUE-047 - 群聊 thread 绑定应按建群来源继承上下文
**Goal:** PM/协调者创建的项目群必须继承当前项目 thread，普通用户主动建群仍创建独立 group thread。
**Acceptance Criteria:** 覆盖 issue 中 8 条验收：用户建群新 thread、PM 建群继承 thread、群内智能体共用 inherited thread、面板展示一致、刷新不重复建 thread、失败可诊断、自动化测试覆盖两条路径、Playwright 双端验收。
**Architecture cell:** IM Web / TangSeng IM / Clowder connector binding
**Map delta:** none
**Map delta why:** 本次只补齐既有 project-group binding 数据流，不新增 ownership cell。
**Architecture:** 前端在项目群确认卡中固化 PM 当前 `threadId`；IM 后端在项目群创建与群猫同步时保留 `projectThreadId` 并把群 external chat 绑定到同一 Clowder thread；Clowder connector 对携带 inherited `threadId` 的 IM Web inbound 复用绑定而不新建 thread。普通群聊不携带 inherited thread，保持现有自动创建 thread。
**Tech Stack:** Vue/Pinia native IM service, Go TangSeng clowder bridge, Node Clowder connector router, node:test, Go test, Playwright
**前端验证:** Yes - 需要桌面与移动 viewport 截图。

---

### Task 1: 前端卡片携带 PM 当前 thread

**Files:**
- Modify: `sections/ui/services/native-im/project-group.js`
- Modify: `sections/ui/services/native-im/normalizers.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**Step 1: Write the failing test**

Add a regression test asserting `buildProjectGroupConfirmationInput()` copies `conversation.threadId` into both `pmDirectThreadId` and `projectThreadId`, and `buildProjectGroupEnsurePayload()` keeps that inherited thread.

**Step 2: Run test to verify it fails**

Run: `cd sections/ui && node --test tests/native-im.test.mjs`
Expected: FAIL because generated card payload misses `pmDirectThreadId/projectThreadId`.

**Step 3: Write minimal implementation**

Add thread-id resolution in `project-group.js`, and preserve thread fields in `normalizeConversation()` so refreshed/direct PM conversations keep the Clowder binding.

**Step 4: Run test to verify it passes**

Run: `cd sections/ui && node --test tests/native-im.test.mjs`
Expected: PASS.

### Task 2: IM 后端同步项目群到 inherited Clowder binding

**Files:**
- Modify: `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- Test: `sections/im/TangSengDaoDaoServer/modules/clowder/proxy_test.go`

**Step 1: Write the failing test**

Add tests that:
- PM project group binding falls back from missing `projectThreadId` to `pmDirectThreadId`.
- Syncing group cats for a project group forwards a binding command/payload using the inherited `projectThreadId`.

**Step 2: Run test to verify it fails**

Run: `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder`
Expected: FAIL because group sync does not bind the group to inherited thread.

**Step 3: Write minimal implementation**

Extend group cat sync with optional `projectThreadId/projectBindingId`; when present, ensure/bind group conversation to that thread and return the inherited thread in the group state. Do not apply this to ordinary user-created groups without a thread id.

**Step 4: Run test to verify it passes**

Run: `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder`
Expected: PASS.

### Task 3: Clowder connector respects inherited thread

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/infrastructure/connectors/ImWebInboundHandler.ts`
- Modify: `sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
- Test: `sections/clowder-ai/packages/api/test/im-web-inbound-bridge.test.js`

**Step 1: Write the failing test**

Add a test where IM Web group inbound includes `threadId: "thread-project"` and no existing group binding; assert router stores message and trigger on `thread-project`, and no new thread is created.

**Step 2: Run test to verify it fails**

Run: `cd sections/clowder-ai && npm test -- --runTestsByPath packages/api/test/im-web-inbound-bridge.test.js` or local package equivalent.
Expected: FAIL because `threadId` is ignored.

**Step 3: Write minimal implementation**

Allow IM Web inbound payload to carry `threadId`; before normal lookup/create, bind external chat to that thread if no binding exists, or repair an incorrect binding to the inherited thread.

**Step 4: Run test to verify it passes**

Run the same Clowder API test.
Expected: PASS.

### Task 4: Browser evidence and issue update

**Files:**
- Modify: `sections/ui/.ai/issues/ISSUE-047_group_thread_binding_should_follow_creator_context.md`
- Evidence: `sections/ui/.ai/tests-e2e/ISSUE-047-<timestamp>/`

**Step 1: Run local stack**

Run: `scripts/start-im-clowder.sh start`

**Step 2: Playwright desktop and mobile**

Verify PM direct chat project group creation and group panel/Clowder board use the same thread. Save screenshots, console logs, and JSON results.

**Step 3: Update issue and commit**

Mark status resolved only after commands and browser evidence pass. Commit in Chinese after each verifiable phase.

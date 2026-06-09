# ISSUE-033 本机 OAuth 探测与 OAuth 模式创建实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-033_clowder_local_oauth_probe_for_agent_creation.md`
**Goal**：让智能体创建/编辑页在 OAuth 模式下调用 `clowder/local-auth/capabilities`，按 Codex/Claude CLI 登录状态显示 `.oauth-status` 并阻止未登录时创建。
**AI修复模式**：Plan First
**前端验证**：Yes，必须覆盖桌面 Web viewport 和移动端 viewport。
**非目标**：不实现浏览器 OAuth 回调；不允许 OAuth 模式下用户任意覆盖 `accountRef/defaultModel`。

---

## 现象与根因

`sections/ui/pages/agents/new.vue` 当前把 OAuth 当静态表单选项，没有探测本机 CLI 登录状态，没有禁用未配置 OAuth 创建，也会继续提交 `defaultModel`。后端已提供 `GET clowder/local-auth/capabilities`，`im_web` 已实现对应体验。

## 受影响模块

- `sections/ui/services/native-im/service.js`
- `sections/ui/stores/agent.js`
- `sections/ui/pages/agents/new.vue`
- `sections/ui/components/agents/AgentProfilePanel.vue`（复核 OAuth 标识）
- `sections/ui/tests/native-im.test.mjs`

参考：

- `sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue`
- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`

## 推荐设计

`agentStore` 统一维护本机 OAuth 探测状态：

```text
localOAuthCapabilities: { codex?, claude? }
localOAuthLoading
localOAuthError
loadLocalOAuthCapabilities(force)
resetLocalOAuth()
oauthProviderForPlatform(platform) -> codex | claude
```

`pages/agents/new.vue` 根据 `accessMode === 'oauth'`：

- 显示 `.oauth-status`。
- 自动填 `accountRef = codex | claude` 并禁用输入。
- 隐藏 API Key/API URL/defaultModel。
- `canCreate` 要求 provider `authConfigured === true`。
- 切换 `platform/accessMode` 自动重新探测。
- 提交 payload 不包含 `defaultModel`。

## 阶段计划

### Phase 1：service 与 store 红绿测试

**Files**

- Modify: `sections/ui/services/native-im/service.js`
- Modify: `sections/ui/stores/agent.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `native service fetches local oauth capabilities`
   - `agent store dedupes in-flight local oauth capability probes`
   - `agent store maps codex and claude oauth readiness`
   - `oauth clowder cat payload omits defaultModel and forces accountRef`
2. 运行 `npm run test:native-im`，确认缺失失败。
3. 实现 `getLocalAuthCapabilities`、store 状态和 payload 清理。
4. 再跑 `npm run test:native-im`。

**阶段提交示例**：`接入本机 OAuth 探测状态`

### Phase 2：创建页联动 UI

**Files**

- Modify: `sections/ui/pages/agents/new.vue`
- Optional: `sections/ui/components/agents/AgentProfilePanel.vue`

**Implementation**

1. 新增 `.oauth-status` 状态条：
   - loading：正在检查本机 CLI 配置
   - ready：已检测到本机登录
   - missing：未检测到，请运行 `codex login` / `claude login`
   - error：检查失败 + 重试按钮
2. OAuth 模式隐藏 API Key/API URL/模型输入，`accountRef` 自动填充且 disabled。
3. `canCreate` 增加 OAuth readiness gate。
4. `hydrateFormFromAgent` 兼容编辑已有 OAuth agent。
5. 移动端状态条文字换行不溢出。

**阶段提交示例**：`完善智能体创建 OAuth 表单联动`

### Phase 3：浏览器验证与证据

**Verification**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-033-<timestamp>/
```

必须保存：

- `desktop-1440x900-oauth-ready-or-missing.png`
- `desktop-1440x900-oauth-submit-gate.png`
- `mobile-375x844-oauth-status.png`
- `mobile-375x844-oauth-submit-gate.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

**阶段提交示例**：`完成 OAuth 创建链路浏览器验收`

## 风险与回滚

- 若探针接口 404/500，OAuth 创建必须禁用并展示错误，不退回旧静态 OAuth。
- 401 要清空缓存，避免跨用户看到旧探测结果。
- 回滚可移除页面 gate，但保留 service wrapper 不影响 API key 创建。

## Done

- 未登录本机 CLI 时无法创建 OAuth 智能体。
- 已登录时自动 `accountRef`，不提交 `defaultModel`。
- ISSUE-033 文档更新为 `Resolved`，含证据路径和验证命令。

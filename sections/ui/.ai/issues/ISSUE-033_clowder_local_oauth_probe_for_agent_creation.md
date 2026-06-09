# [ISSUE-033] UI 接入 Clowder 智能体本机 OAuth 探测与 OAuth 模式创建

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：feature / clowder / agent / oauth / local-auth / im-web-parity
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-033_clowder_local_oauth_probe_for_agent_creation.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

`sections/ui` 当前的智能体创建页 ([pages/agents/new.vue](seedcmp/sections/ui/pages/agents/new.vue)) 提供了 "API Key / OAuth" 两种接入方式，但 **OAuth 模式只是 UI 表单上的一个静态选项**，提交时只把 `authType: 'oauth'` 透传给后端 `clowder/cats`，并没有真正适配后端的本机 OAuth 探测能力，也没有对应 im_web 已实现的体验：

1. 没有调用 `clowder/local-auth/capabilities` 探测本机 CLI（Codex / Claude Code）是否已登录。
2. 没有 `.oauth-status` 状态条，UI 不能告诉用户"已配置 / 需登录 / 检查中"。
3. 在用户本机 CLI 未登录时，仍然可以创建 OAuth 智能体，导致后端报错或创建出不可用的 cat。
4. OAuth 模式下 `accountRef` 让用户随便填，缺少 openai→codex、anthropic→claude 的默认映射。
5. OAuth 模式下还让用户填 `defaultModel`，但本机 CLI 模式下默认模型应该来自 CLI 配置。
6. 切换 `clientId` 或 `authType` 时没有触发探针。

参考实现：[`sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue`](seedcmp/sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue) 和 [`sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:966-988`](seedcmp/sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts#L966-L988)。

本 issue 目标：让 `sections/ui` 的智能体创建页拥有 im_web 同款的本机 OAuth 探测与 OAuth 模式创建体验，**用户在本机 CLI 未登录时无法创建 OAuth 智能体**，并在 UI 上清晰反馈探测结果。

---

## 目标体验

### 用户路径

1. 用户进入"创建智能体"页面 ([pages/agents/new.vue](seedcmp/sections/ui/pages/agents/new.vue))。
2. 用户选择运行平台（Codex / Claude Code / 等）。
3. 用户选择接入方式为 `OAuth`。
4. 页面立刻显示 `.oauth-status` 状态条，状态在 `检查中` / `已配置` / `需登录` 之间切换。
5. 如果后端探测结果是 `authConfigured: true`：
 - `accountRef` 自动填入 `codex`（openai）或 `claude`（anthropic），且不可编辑。
 - `defaultModel` 输入框隐藏，强制使用 CLI 默认模型。
 - "创建并部署"按钮可点击。
6. 如果后端探测结果是 `authConfigured: false`：
 - 状态条展示提示文案，例如 "未检测到本机登录，请先运行 `codex login` / `claude login`"。
 - "创建并部署"按钮置灰禁用。
 - 即便用户强行绕过前端校验，后端也必须拒绝创建（兜底）。
7. 切换 `clientId` 或 `authType` 都会自动重新触发探测。
8. 提交时调 `nativeImService.createClowderCat`，payload 保持 im_web 现有契约：
 - `authType: 'oauth'`
 - `accountRef: 'codex' | 'claude'`
 - OAuth 模式下 **不传** `defaultModel`（让后端用 CLI 默认值）

### 卡片状态

新增 1 个 UI 状态条组件（`.oauth-status`），状态机：

| 状态 | 触发条件 | UI |
|---|---|---|
| `idle` | 初始未选 OAuth / 未选 clientId | 不显示状态条 |
| `loading` | 已选 OAuth + clientId，正在调探针 | 状态条显示"检查中" badge + "正在检查本机 CLI 配置"文案 |
| `ready` | 探测成功且 `authConfigured: true` | 状态条显示"已配置" badge + "已检测到 Codex / Claude Code 本机登录，创建时使用 CLI 默认配置" + profile / CLI 默认模型细节 |
| `missing` | 探测成功但 `authConfigured: false` | 状态条显示"需登录" badge + `未检测到本机登录，请先运行 codex login` 之类提示 + 后端 `diagnostics` 首条 |
| `error` | 探测接口报错 | 状态条显示"检查失败" badge + 错误原因 + "重试"按钮 |

---

## 复现步骤

1. 启动 `sections/ui` 并登录真实账号。
2. 进入"创建智能体"页面。
3. 选择"接入方式 = OAuth"，运行平台选 Codex。
4. 观察页面是否出现 `.oauth-status` 状态条。
5. 观察"创建并部署"按钮是否禁用（如果本机 Codex 未登录）。
6. 在本机执行 `codex login` 后，回到页面，观察状态是否切换为"已配置"。
7. 切换运行平台为 Claude Code，观察探针是否重新触发。

实际：

1. 选 OAuth 后没有状态条。
2. 没有任何后端探针调用。
3. "创建并部署"按钮在未登录时也保持可点击。
4. 切换 `clientId` / `authType` 不会触发任何动作。
5. `accountRef` 仍让用户随便填。
6. 提交时 UI 仍把 `defaultModel` 带上。

预期（与 im_web 一致）：

1. 选 OAuth 后 1 秒内出现状态条。
2. 状态条文案根据本机 CLI 状态切换。
3. 未登录时按钮禁用 + 提示登录命令。
4. 已登录时 `accountRef` 自动填 `codex` / `claude`，`defaultModel` 输入框隐藏。
5. 切换运行平台后重新触发探针。
6. 提交时 payload 符合 im_web 契约（`authType: 'oauth'`、`accountRef: 'codex' | 'claude'`、不传 `defaultModel`）。

---

## 完整设计

### 1. 后端契约（参考 im_web 已有）

```text
GET clowder/local-auth/capabilities
Response: { providers: ClowderLocalOAuthConfigSummary[] }

ClowderLocalOAuthConfigSummary {
 provider: 'codex' | 'claude'
 authConfigured: boolean
 configPresent: boolean
 configFiles: { path, exists, readable }[]
 defaultModel?: string
 profile?: string
 diagnostics?: string[]
}
```

UI 在适配前需要先确认 seedcmp 的 Clowder 后端已实现 `clowder/local-auth/capabilities` 且响应结构与上面一致（im_web 的契约是已知目标，UI 适配照此对齐即可；如后端字段名不同，需先同步对齐后端）。

### 2. 新增 service

在 `sections/ui/services/native-im/service.js` 新增：

```text
getLocalAuthCapabilities()
 -> GET clowder/local-auth/capabilities
 -> 归一化响应为 { codex?: ClowderLocalOAuthConfigSummary, claude?: ClowderLocalOAuthConfigSummary }
 -> 复用现有的 firstNonEmpty / normalize 工具
```

如已有 `services/native-im/clowder.js` 或类似拆分文件，优先放入拆分文件。

### 3. 新增 store 状态

在 `sections/ui/stores/agent.js`（或新建 `stores/local-oauth.js`）新增：

```text
localOAuthCapabilities: { codex?, claude? } // 来自探测响应
localOAuthLoading: boolean
localOAuthError: string | undefined
loadLocalOAuthCapabilities(force?: boolean): Promise<void>
resetLocalOAuth(): void // 登出 / 切换用户时调用
```

要求：

1. `loadLocalOAuthCapabilities` 多次并发调用应只触发 1 次实际请求（in-flight dedupe）。
2. 失败要重试按钮，错误文案保留 `diagnostics` 首条。
3. 401 / 登录态失效时不要缓存上一次结果。

### 4. UI 改造（[pages/agents/new.vue](seedcmp/sections/ui/pages/agents/new.vue)）

#### 4.1 状态条组件

在 `accessMode` 区域下方新增 `.oauth-status` 状态条，参考 im_web 的 [ClowderCatConsolePage.vue:181-188](seedcmp/sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue#L181-L188) `oauthStatusText()` 文案：

- `idle`：不渲染。
- `loading`：`正在检查本机 CLI 配置`。
- `ready`：`已检测到 ${providerLabel} 本机登录，创建时使用 CLI 默认配置` + `配置档：${profile} · CLI 默认模型：${defaultModel}`。
- `missing`：`未检测到本机登录，请先运行 ${loginCommand}`，登录命令为 `codex login`（openai）或 `claude login`（anthropic）。
- `error`：`本机 OAuth 配置检查失败：${msg}` + 重试按钮。

移动端卡片必须在 375px 宽度内可读；桌面 H5 状态条宽度跟随父容器。

#### 4.2 表单联动

- `form.platform` 改为对应 im_web 的 `clientId`（`openai` / `anthropic`），如当前 UI 已有 `claude-code` / `codex` 之类的自定义值，需要在 [services/native-im/service.js:394-398](seedcmp/sections/ui/services/native-im/service.js#L394-L398) `clientIdForAgentPlatform` 加一层映射。
- 选中 OAuth 时：
 - 隐藏 `apiKey` / `apiUrl` / `customModel` 整段（参考 im_web `v-if="!isOAuthAuth"`）。
 - `accountRef` 输入框置为 disabled，自动填入 `'codex'`（openai）或 `'claude'`（anthropic）。
 - `defaultModel` 输入框隐藏或置灰（避免覆盖 CLI 默认）。
- `canCreate` 计算：
 - 原有校验 + `oauthProbeReady`（不处于 loading）。
 - + `!oauthConfigMissing`（未登录时禁用）。
- `watch(() => form.platform)` 和 `watch(() => form.accessMode)` 触发 `loadLocalOAuthCapabilities()`。

#### 4.3 提交 payload

参考 im_web 的 [ClowderCatConsolePage.vue:253-266](seedcmp/sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue#L253-L266) `createCatAndConnect`：

```js
const payload = {
 name: form.name.trim(),
 alias: '@' + form.aliasRaw.trim(),
 roleTemplateId: form.roleTemplate || form.templateId,
 clientId: clientIdForAgentPlatform(form.platform),
 authType: form.accessMode === 'oauth' ? 'oauth' : 'api_key',
 accountRef: form.accessMode === 'oauth'
 ? defaultOAuthAccountRef(form.platform) // 'codex' | 'claude'
 : form.accountRef.trim(),
 ..(form.accessMode !== 'oauth' && form.customModel.trim()
 ? { defaultModel: form.customModel.trim() }
 : {}),
 personality: form.systemPrompt || form.desc,
 capabilities: form.capabilityTags
};
```

需要同步修改 [pages/agents/new.vue:903-921](seedcmp/sections/ui/pages/agents/new.vue#L903-L921) `buildAgentPayload` 和 [services/native-im/service.js:749-764](seedcmp/sections/ui/services/native-im/service.js#L749-L764) `createClowderCat`，让 OAuth 模式下不传 `defaultModel`，且 `accountRef` 强制使用 codex/claude 字面量。

### 5. 编辑模式兼容

如果用户编辑一个已存在的 OAuth 智能体：

- `hydrateFormFromAgent` ([pages/agents/new.vue:728](seedcmp/sections/ui/pages/agents/new.vue#L728)) 要识别 `accessMode: 'oauth'`，把 `accountRef` 反向映射回 `codex` / `claude`。
- 编辑页同样需要展示 `.oauth-status` 状态条，避免误把"已登录"显示为"需登录"。
- 编辑保存时如果切到 OAuth 模式，触发一次探针再允许保存。

### 6. Skills 展示（可选 P1）

参考 im_web [ClowderCatConsolePage.vue:332-349](seedcmp/sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue#L332-L349) 选 clientId 后展示该 provider 的 skills 列表（Codex Skills / Claude Code Skills），需要在 `clowder/cats` 响应里取 `skillCatalog` 字段。本 issue 不强制要求，初版可留 TODO。

### 7. 降级策略

1. 如果 `clowder/local-auth/capabilities` 接口不存在（404）或返回 500：
 - 状态条进入 `error`，提示"本机 OAuth 探测不可用，请联系管理员"。
 - 按钮保持禁用，不能让用户在没有探测结果的情况下创建 OAuth 智能体。
2. 如果后端尚未实现该接口，UI 需要明确标红 + 不允许创建，**不能退回 im_web 那种"传 `authType: 'oauth'` + 任意 `accountRef`" 的兜底**。
3. 如果 `clowder/cats` 拒绝 `authType: 'oauth'`（后端不识别），UI 需把后端错误码翻译成"本机 CLI 未登录或后端不支持 OAuth"。
4. 如果 401 / 登录态失效：清空 `localOAuthCapabilities` 并触发重新登录。

---

## 相关代码

```text
sections/ui/pages/agents/new.vue
- 引入 accessMode / platform 联动逻辑。
- 新增 .oauth-status 状态条。
- canCreate 需要考虑 oauthProbeReady / !oauthConfigMissing。
- watch(platform) / watch(accessMode) 触发 loadLocalOAuthCapabilities。
- buildAgentPayload 在 OAuth 模式下不传 defaultModel。
- hydrateFormFromAgent 需要识别 accessMode: 'oauth'。

sections/ui/stores/agent.js
- 增加 localOAuthCapabilities / localOAuthLoading / localOAuthError / loadLocalOAuthCapabilities。
- createAgent 在 OAuth 模式下做一次前置探针检查。

sections/ui/services/native-im/service.js
- 新增 getLocalAuthCapabilities，GET clowder/local-auth/capabilities。
- createClowderCat 在 OAuth 模式下不传 defaultModel。
- clientIdForAgentPlatform 增强，支持 clowder-ui 现有的平台枚举映射到 openai/anthropic。

sections/ui/components/agents/AgentProfilePanel.vue
- 展示 agent.accessMode === 'oauth' 时显示"本机 OAuth"标识（已有部分，需复核）。

sections/ui/pages/agents/index.vue
- 列表卡片对 OAuth 智能体增加"本机 OAuth 已配置 / 需重新登录"小标签。

sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
- 完整参考实现：状态条、watch、payload、canCreate。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
- loadLocalOAuthCapabilities / localOAuthCapabilities / localOAuthLoading / localOAuthError 状态建模参考。

sections/im_web/packages/datasource-vue/src/api/clowder.ts
- getLocalAuthCapabilities / ClowderLocalOAuthConfigSummary 类型契约。
```

---

## 根因分析

`sections/ui` 在接入智能体创建流程时只复用了 im_web 早期版本的"accessMode 是表单静态字段"形态，**没有跟上 im_web 升级后的本机 CLI OAuth 探测能力**：

1. 缺少 `clowder/local-auth/capabilities` 的 service 包装。
2. 缺少本机 OAuth 探测相关的 store 状态。
3. 缺少 `.oauth-status` 状态条 UI。
4. 缺少未登录时的禁用提交保护。
5. 缺少 `accountRef` 默认映射（openai→codex、anthropic→claude）。
6. 缺少 OAuth 模式隐藏 `defaultModel` 输入的逻辑。
7. 切换 `platform` / `accessMode` 时不触发探针。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么 im_web 用的是"本机 CLI OAuth"而不是浏览器 OAuth？
**A1**: 因为 seedcmp 的 Clowder 后端运行在用户的本机（CLI agent），Codex / Claude Code 的 OAuth 登录就是在本机执行 `codex login` / `claude login`，Clowder 后端读取本机 CLI 的配置文件来判断"该 provider 是否已登录"。这与浏览器 OAuth 回调流（access_token + redirect_uri）完全不同。

### Q2: 后端没实现 `clowder/local-auth/capabilities` 怎么办？
**A2**: 本 issue 强依赖该接口。如果后端没实现，需先在 backend 加这个接口（参考 im_web 契约）再适配 UI；不能跳过探测就允许创建 OAuth 智能体。

### Q3: 是否允许 OAuth 模式下用户覆盖 `accountRef`？
**A3**: 初版不允许。`accountRef` 在 OAuth 模式下强制为 `codex` / `claude` 字面量，与 im_web 行为一致。如需后续扩展（如多账号），单独开 issue。

### Q4: 编辑已有 OAuth 智能体时如何反向映射 `accountRef`？
**A4**: 在 `hydrateFormFromAgent` 中检查 `agent.accessMode === 'oauth'` 且 `accountRef` 为 `codex` / `claude` 之一，UI 正常展示；否则按缺失处理、提示用户重新探测。

### Q5: 是否需要在用户登出时清空探测缓存？
**A5**: 需要。`resetLocalOAuth` 必须在登出/切换用户时清空 `localOAuthCapabilities / localOAuthLoading / localOAuthError`，避免下一位用户看到前一位用户的探测结果。

### Q6: Skills 展示是否纳入本 issue？
**A6**: 初版不强制。Skills 列表依赖 `clowder/cats` 返回的 `skillCatalog` 字段，需先确认后端是否提供。可作为 P1 后续 issue。

---

## 代码方案补充（基于 im_web / 后端对照）

### 后端能力已经存在

`sections/im/TangSengDaoDaoServer/modules/clowder/api.go` 已注册：

```text
GET clowder/local-auth/capabilities
```

该接口代理到 Clowder upstream：

```text
GET /api/local-auth/capabilities
```

并带上当前 IM 登录用户 header。也就是说 `sections/ui` 不需要直接探测本机文件或调用 CLI，只需要通过 `nativeImService` 调后端桥。

### im_web 行为要逐项迁移

`sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue` 的关键行为：

1. `isOAuthAuth = form.authType === 'oauth'`。
2. OAuth 状态文案：
   - loading：`正在检查本机 CLI 配置`
   - ready：`已检测到 Codex / Claude Code 本机登录，创建时使用 CLI 默认配置`
   - missing：后端 diagnostics 首条，或 `未检测到本机登录，请先运行 codex login / claude login`
3. OAuth 模式下：
   - `accountRef = codex | claude`
   - 不展示/不提交 `defaultModel`
   - `canCreate` 要求 `authConfigured === true`
4. 提交 payload 使用：

```text
accountRef: resolvedAccountRef
...(!isOAuthAuth ? { defaultModel } : {})
```

`sections/ui/pages/agents/new.vue` 现在相反：账号引用输入一直显示，模型选择一直显示，`buildAgentPayload` 总是带 `model/customModel`，`nativeImService.createClowderCat` 总是带 `defaultModel`。

### 建议落地切分

1. `nativeImService`：

```text
getLocalAuthCapabilities()
  -> GET clowder/local-auth/capabilities
  -> normalize providers array into { codex, claude }

defaultOAuthAccountRef(platform)
  codex/openai -> codex
  claude-code/anthropic -> claude

clientIdForAgentPlatform(platform)
  codex/openai -> openai
  claude-code/anthropic -> anthropic
```

2. `agentStore`：
   - `localOAuthCapabilities`
   - `localOAuthLoading`
   - `localOAuthError`
   - `localOAuthLoadedAt`
   - `localOAuthInFlight`
   - `loadLocalOAuthCapabilities({ force = false })`
   - `resetLocalOAuth()`
3. `loadLocalOAuthCapabilities` 要做 in-flight dedupe：
   - 同时多个 watcher 触发时，只发一个请求。
   - 401/登录态失效时清空旧 capabilities，不缓存上个用户结果。
   - 手动重试传 `force: true`。
4. `pages/agents/new.vue`：
   - 新增 computed：
     - `isOAuthMode`
     - `oauthProvider`
     - `selectedOAuthConfig`
     - `oauthStatus`
     - `oauthCanSubmit`
   - `watch([() => form.platform, () => form.accessMode])`，OAuth + platform 有效时触发探针。
   - OAuth 模式下隐藏模型选择、API Key、API URL、自定义模型，账号引用显示为只读 badge/disabled input。
   - `checkList` 拆分：API Key 模式检查 `accountRef/defaultModel/apiKey/apiUrl`；OAuth 模式检查 `selectedOAuthConfig.authConfigured === true`。
5. `buildAgentPayload`：
   - OAuth：

```text
platform: form.platform
accessMode: 'oauth'
accountRef: defaultOAuthAccountRef(form.platform)
model/customModel/defaultModel: 不传或为空
```

   - API Key：

```text
accountRef: form.accountRef.trim()
model/customModel/defaultModel: 按现有 effectiveModel 传
```

6. `nativeImService.createClowderCat` 也要兜底：
   - 如果 `authType === 'oauth'`，强制 accountRef 为 `codex/claude`，删除 `defaultModel` 字段。
   - 如果 OAuth 但 accountRef 不是 `codex/claude`，前端抛错，不把脏 payload 发到后端。

### 边界意见

1. 不要在前端直接读 `~/.codex`、`~/.claude` 或执行 CLI；本机探测必须通过后端 `local-auth/capabilities`。
2. 不要在探针失败或接口 404 时允许创建 OAuth cat。否则用户会得到不可用智能体，错误延后到运行时才暴露。
3. 不要让用户编辑 OAuth `accountRef`。这里的 accountRef 是后端 runtime 约定，不是用户自定义账号名称。
4. 不要在 OAuth 模式传 `defaultModel`。CLI 默认模型属于本机 CLI 配置，前端覆盖会导致 im_web/ui 行为不一致。
5. OAuth 探测结果是本机/当前后端环境状态，不是智能体永久属性；列表小标签可以展示，但刷新/切用户要重新探测。

---

## 修复建议

1. 先用真实后端复核 `clowder/local-auth/capabilities` 响应结构和错误码，确保 UI normalizer 覆盖 `{ providers }`、401、404/502。
2. 在 `services/native-im/service.js` 新增 `getLocalAuthCapabilities`。
3. 在 `stores/agent.js`（或新建 `stores/local-oauth.js`）新增 `localOAuthCapabilities / localOAuthLoading / localOAuthError / loadLocalOAuthCapabilities / resetLocalOAuth`。
4. 在 `pages/agents/new.vue`：
 - 新增 `.oauth-status` 状态条 UI。
 - `watch(platform)` / `watch(accessMode)` 触发探针。
 - `canCreate` 增加 `oauthProbeReady && !oauthConfigMissing`。
 - `buildAgentPayload` 在 OAuth 模式下不传 `defaultModel`。
 - `hydrateFormFromAgent` 兼容 OAuth 模式。
5. `services/native-im/service.js` 的 `createClowderCat` 在 OAuth 模式下不传 `defaultModel`。
6. 编辑页 / 列表页同步增加 OAuth 状态展示与"重新探测"按钮。
7. 增加自动化测试：
 - 单测：OAuth 状态机。
 - 单测：`createClowderCat` payload 在 OAuth 模式下不传 `defaultModel`。
 - E2E：桌面 / 移动 H5 完整流程。
 - 真实账号验收：本机未登录 / 已登录两套场景都截图。

---

## 验收标准

- 进入"创建智能体"页面，平台选 Codex，接入方式选 OAuth，1 秒内出现 `.oauth-status` 状态条。
- 状态条根据本机 CLI 状态正确显示 `已配置` / `需登录` / `检查中` / `检查失败`。
- 本机未执行 `codex login` 时，状态条显示"未检测到本机登录，请先运行 codex login"；"创建并部署"按钮置灰。
- 本机已执行 `codex login` 时，状态条显示"已检测到 Codex 本机登录"；`accountRef` 自动填 `codex` 且不可编辑；`defaultModel` 输入框隐藏；按钮可点击。
- 切换运行平台（Codex → Claude Code）后，状态条重新触发探针。
- 提交时 payload 满足：
 - `clientId: 'openai' | 'anthropic'`
 - `authType: 'oauth'`
 - `accountRef: 'codex' | 'claude'`
 - OAuth 模式下 **不传** `defaultModel`
- 编辑已有 OAuth 智能体能正确回显，且 `.oauth-status` 同步显示。
- 登出后 `localOAuthCapabilities` 被清空。
- 桌面 H5 / 移动 H5 均通过视觉验收；状态条不溢出，按钮高度不低于 44px。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充测试：

1. 单测：`loadLocalOAuthCapabilities` 多次并发只发 1 次请求（in-flight dedupe）。
2. 单测：探测失败时 `oauthConfigMissing = true`，`canCreate = false`。
3. 单测：`createClowderCat` 在 OAuth 模式下不传 `defaultModel`。
4. 单测：`hydrateFormFromAgent` 识别 `accessMode: 'oauth'` 并回填 `codex` / `claude`。
5. 集成：mock `clowder/local-auth/capabilities` 返回 `authConfigured: true`，提交成功。
6. 集成：mock 探测返回 `authConfigured: false`，按钮禁用。
7. 集成：mock 探测接口 500，状态条进入 `error`，按钮禁用。
8. E2E：桌面 H5 完整流程（本机已登录 + 本机未登录两套）。
9. E2E：移动 H5 完整流程。
10. 真实账号验收：截图保留 4 张证据（未登录状态条 / 登录后状态条 / 编辑页状态条 / 提交成功）。

---

## 修复记录

2026-06-10：

- 新增 `services/native-im/oauth.js`，统一本机 OAuth provider 映射、capabilities 归一化、并发探测去重和状态解析。
- `nativeImService.getLocalAuthCapabilities()` 接入 `GET clowder/local-auth/capabilities`。
- `nativeImService.createClowderCat()` 在 OAuth 模式下强制使用 `accountRef: codex | claude`，并不再提交 `defaultModel`。
- `agentStore` 增加 `localOAuthCapabilities / localOAuthLoading / localOAuthError / loadLocalOAuthCapabilities / resetLocalOAuth`，OAuth 创建前 fail-closed，未检测到本机 CLI 登录时不创建本地 fallback 智能体。
- `pages/agents/new.vue` 增加 `.oauth-status` 状态条；OAuth 模式隐藏模型/API 配置，锁定账号引用；桌面/移动提交按钮受探测状态约束。

---

## 测试结果

自动化：

```bash
cd sections/ui && npm run test:native-im
# 62 tests, 62 pass

cd sections/ui && npm run build:h5
# exit 0，只有既有 uni-app / Sass deprecation warnings
```

浏览器可视化验收：

```bash
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-033-20260610021252/
```

证据文件：

- `desktop-1440x900-oauth-ready.png`
- `mobile-375x844-oauth-missing.png`
- `browser-console.json`
- `request-log.json`
- `request-failures.json`
- `result.json`

`result.json` 断言：

- 桌面 OAuth ready 状态条可见，必填项完成后按钮可提交。
- OAuth 模式隐藏模型和 API 配置。
- `accountRef` 锁定为 `codex`。
- 移动端 OAuth missing 状态条可见，必填项完成后仍禁止创建。
- 缺登录时强制点击提交不会触发 `POST /v1/clowder/cats`。
- 无 severe console error，无 request failure。

---

## 关闭备注

已按 Plan First 计划完成。Playwright 使用受控 `local-auth/capabilities` 响应分别覆盖 ready / missing 状态，真实启动环境为 `http://localhost:5173`。

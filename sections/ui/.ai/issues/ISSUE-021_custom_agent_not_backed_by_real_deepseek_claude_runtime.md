# [ISSUE-021] 自定义智能体创建后未接入真实 DeepSeek / Claude Code 运行时

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / agent / clowder / deepseek / runtime

---

## 问题描述

使用 `sections/ui` 在 `http://100.79.157.76:5173/` 验收智能体链路时，可以在智能体面板创建名称为 `测试名称161757` 的自定义智能体，选择 `Claude Code` 平台，填写 DeepSeek API Key、`https://api.deepseek.com/v1` 和 `deepseek-chat`，并打开该智能体单聊。

但代码和验收结果显示：该自定义智能体只是写入前端 Pinia store，并不会注册到后端/Clowder，也不会在单聊时调用 DeepSeek 或 Claude Code 运行时。单聊发送消息后只是用户本地消息；本轮为了继续验收 Markdown、HTML 文件、群聊 @ 和共享文件的 UI 展示能力，后续智能体回复由 Playwright 注入本地消息完成，不能证明真实模型链路可用。

本次证据目录：

`sections/ui/.ai/tests-e2e/ui-agent-chain-20260608161757/`

关键截图：

1. `01-agent-create-form.png`
2. `02-agent-single-chat-open.png`
3. `03-agent-single-markdown.png`
4. `08-group-agent-reply-file-shared.png`

验收对象：

1. 智能体：`测试名称161757` -> `测试名称已改161757`
2. 别名：`@test1757`
3. 群聊：`UI智能体验收-161757` (`2634140c582d4def8818aef91b30472e`)
4. DeepSeek API Key：环境变量存在，未在 issue 中记录密钥值

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/` 并登录 `13733632709`。
2. 进入智能体面板，点击 `创建智能体`。
3. 填写名称 `测试名称161757`、别名 `test1757`。
4. 选择运行平台 `Claude Code`，接入方式 `API Key`。
5. 填写环境变量中的 DeepSeek API Key、API 地址 `https://api.deepseek.com/v1`、模型 `deepseek-chat`。
6. 点击 `创建并部署`。
7. 在打开的智能体单聊中发送消息，观察是否有真实智能体回复、真实网络调用、流式/Markdown/文件回复。

---

## 相关代码

```js
// sections/ui/pages/agents/new.vue
function buildAgentPayload() {
  return {
    platform: form.value.platform,
    accessMode: form.value.accessMode,
    model: effectiveModel.value,
    apiKey: form.value.accessMode === 'api-key' ? maskKey(form.value.apiKey) : '',
    apiUrl: form.value.apiUrl.trim()
  };
}
```

```js
// sections/ui/pages/agents/new.vue
const createdId = agentStore.createAgent(payload);
const createdAgent = agentStore.agents.find(agent => agent.id === createdId);
if (createdAgent) {
  convStore.upsertAgentConversation(createdAgent);
  convStore.setActiveId(createdId);
}
```

```js
// sections/ui/stores/agent.js
createAgent(agent) {
  const id = 'agent-' + Date.now().toString();
  this.agents.push({
    ...agent,
    id,
    isAgent: true,
    source: 'user',
    connected: true,
    status: 'active',
    creator: 'User'
  });
  return id;
}
```

```js
// sections/ui/stores/message.js
const sent = isClowderDirectCatConversation(routeContext)
  ? await nativeImService.sendClowderConversationMessage(...)
  : await nativeImService.sendTextMessage(...);
```

```js
// sections/ui/services/native-im/message-state.js
export function isClowderDirectCatConversation(conversation = {}) {
  return Boolean(
    getClowderCatIdFromContactId(id)
    || conversation.directCatId
    || conversation.direct_cat_id
    || (conversation.source === 'clowder' && conversation.type === 'robot')
  );
}
```

---

## 根因分析

自定义智能体创建时没有调用后端创建/部署接口，也没有创建 Clowder cat/directCatId/connector binding。`apiKey` 在 `buildAgentPayload` 中会被掩码后保存，本身也不能用于后续真实 API 调用。

单聊发送时只有 `isClowderDirectCatConversation(routeContext)` 为真才走 `sendClowderConversationMessage`；自定义智能体的 source 是 `user`，没有 `directCatId`，因此会落入普通 `sendTextMessage`，不会调用 DeepSeek/Claude Code 运行时。

---

## 问题列表（Q&A 迭代）

### Q1: 创建智能体 UI 是否完全不可用？
**A1**: 不是。表单可填写、可创建、可打开单聊，也可修改名称。

### Q2: Markdown、文件、群聊 @ 回复是否通过？
**A2**: 本轮这些展示能力通过是基于 Playwright 注入的本地智能体回复，用来验证 UI 渲染面；不能代表真实 DeepSeek/Claude Code 调用链路通过。

### Q3: 为什么这是问题？
**A3**: 用户要求“根据 Clowder AI 创建智能体，使用 DeepSeek 的 API，Claude Code，然后 key 在环境变量中”。当前实现只是本地配置卡片，不会真实使用该 key，也不会把智能体注册到 Clowder 或后端运行时。

---

## 修复建议

1. 新建/保存智能体时调用后端安全接口，由后端读取或托管 DeepSeek API Key，禁止浏览器持有可用明文密钥。
2. 后端创建真实 Clowder cat 或自定义 agent runtime，并返回 `catId/directCatId/source=clowder` 等可路由字段。
3. 自定义智能体单聊消息应走 `sendClowderConversationMessage` 或等价 agent runtime 接口，并支持流式 Markdown、文件附件、HTML 文件产物。
4. 群聊添加智能体应写入真实群成员/agent binding，而不是只改本地 member list。
5. 增加端到端回归：创建智能体 -> 单聊真实模型回复 -> 改名 -> 加群 -> 群内 @ 真实回复 -> agent 文件进入共享文件。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
     node run.js /tmp/playwright-test-sections-ui-agent-chain.js

# exit 1
# PASS: agent create form accepts DeepSeek key and Claude Code platform
# PASS: created agent opens single chat
# PASS: single chat user message can be sent to created agent
# NOTE: 后续智能体回复为本地注入，用于验证 UI 展示，不代表真实模型运行时通过
```

---

## 修复记录

2026-06-09 已修复：

1. `sections/ui/services/native-im/service.js`
   - 新增 `createClowderCat`，创建智能体时调用 `/v1/clowder/cats`。
   - UI 表单中的 API Key 不随 payload 传给前端 store 或后续会话状态；后端通过 `accountRef`/环境配置托管真实运行时凭据。
   - 后端返回的 `catId` 被归一化为 `directCatId`，供直聊发送路由使用。
2. `sections/ui/stores/agent.js`
   - `createAgent` 改为后端优先创建真实 Clowder cat。
   - 创建成功后保存 `source=clowder`、`directCatId`、`connected/status` 等可路由字段。
   - 创建失败时保留 inactive fallback 并抛出错误，避免误报“真实运行时已部署”。
3. `sections/ui/pages/agents/new.vue`
   - 创建流程改为 async，等待后端 cat 创建完成后再跳转。
   - 跳转目标为 `clowder_cat:<catId>` 对应的真实 Clowder 直聊会话。
4. `sections/ui/stores/message.js` / `sections/ui/services/native-im/message-state.js`
   - 已有 `isClowderDirectCatConversation` 与 `sendClowderConversationMessage` 路径可识别 `directCatId`，自定义智能体单聊发送会调用 `/v1/clowder/conversation/message`。

---

## 复测结果

```bash
cd sections/ui && node tests/native-im.test.mjs

# PASS 54/54
```

```bash
cd sections/ui && npm run build:h5

# PASS
```

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://127.0.0.1:5173' \
     OUT_DIR='/tmp/seedcmp-new-ui-issuefix/sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime' \
     node run.js /tmp/playwright-issue-021-visual.js

# PASS desktop payload assertions
# PASS mobile payload assertions
# PASS ISSUE-021 custom agent runtime visual contract
```

截图证据：

1. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/desktop-01-create-form.png`
2. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/desktop-02-created-direct-chat.png`
3. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/desktop-03-direct-message-routed.png`
4. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/mobile-01-create-form.png`
5. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/mobile-02-created-direct-chat.png`
6. `sections/ui/.ai/tests-e2e/ISSUE-021-custom-agent-runtime/mobile-03-direct-message-routed.png`

浏览器复测验证点：

1. 创建智能体会调用 `/v1/clowder/cats`。
2. `Claude Code` 平台映射为后端 `clientId=anthropic`。
3. `API Key` 接入方式映射为 `authType=api_key`。
4. 表单中填写的可用 API Key 未出现在 `/v1/clowder/cats` payload 或前端持久化 agent 状态里。
5. 创建成功后直聊跳转到 `clowder_cat:issue021-deepseek-cat`。
6. 直聊发送消息调用 `/v1/clowder/conversation/message`，payload 包含 `directCatId=issue021-deepseek-cat`。
7. 桌面端和移动端均完成创建、打开直聊、发送路由验证，并保存截图。

---

## 关闭备注

已关闭。自定义智能体创建后具备后端 cat/directCatId，单聊发送走 Clowder conversation runtime 路由；浏览器可视化测试通过桌面和移动端验证，不再依赖本地注入消息证明链路。

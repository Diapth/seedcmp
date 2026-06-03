<!--
 * @Author: Yunyi
 * @Date: 2026-06-03 19:53:17
 * @LastEditTime: 2026-06-03 20:06:26
 * @LastEditors: Yunyi
 * @Description: 
 * @FilePath: /Bytedance_cmp/seedcmp/sections/clowder-ai/.claude/plans/seedcmp-seedcmp-sections-clowder-ai-fuzzy-donut.md
 * Version:v1
-->
# 协调者项目群聊 (Coordinator → Project Group Chat) — 实施计划

## Context (为什么做这件事)

用户在 seedcmp 的 IM 聊天(`sections/im_web/`)里和协调者(@coordinator)对话时,如果涉及项目需求,目前流程是:
协调者通过 `MultiMentionOrchestrator` 拉 1-3 只猫并行执行(`MAX_MULTI_MENTION_TARGETS = 3`,见 `packages/shared/src/types/multi-mention.ts:18`),但**没有持久化的项目群聊空间**,也没有用户可观看的"工作状态"界面。结果:
- 用户看到的是单轮 dispatch 结果,看不到"哪个猫现在在干嘛"
- 多次协调后历史散落,无法"跟随项目"
- 猫猫没有"工牌/档案"展示,用户不熟悉每只猫的专长
- 文件产物(`TaskItem.artifactRefs`) 藏在任务里,用户找不到入口

本次目标:**让协调者识别出项目需求后,主动提议创建一个"项目群聊",用户一键确认即建群,猫猫自动加入并展示工牌,后续工作进度以看板形式可见,文件落进用户 workspace 真实目录**。

## 用户已确认的关键决策

| 维度 | 选择 |
|---|---|
| 触发时机 | 协调者**首条回复之后** |
| 群聊作用域 | **轻量版**:Thread + `projectPath: string`,不强制绑定 ExternalProject |
| 看板形态 | 群聊内嵌看板 Tab(按 threadId 过滤现有 TaskBoardPanel) |
| 文件落点 | **写入用户 workspace 项目目录**(复用现有 `ALLOWED_WORKSPACE_DIRS`) |
| 项目目录创建 | 群聊创建时填路径,后端校验范围 + 是否存在 |
| 产物面板口径 | **严格**:只展示猫主动声明的 `artifactRefs`(用 `cat_cafe_declare_artifact` MCP 工具) |
| 协调者识别项目 | **LLM 端结构化输出**(`suggested_cats` 字段),前端不判断 |
| 是否 dismiss 持久化 | 暂不持久化,刷新即重置(避免状态管理复杂度) |

---

## 执行纪律 — 每阶段检查 + 每阶段提交

在执行任何 Phase 之前,必须先在 `seedcmp` 仓库里运行:

```bash
git status --short
```

然后对照当前 Phase 的文件清单检查两件事:
- 是否已经存在修改/未跟踪文件;
- 这些改动是否和本 Phase 要改的文件或功能范围重叠。

如果有重叠,先用 `git diff -- <path>` / `git diff --stat` 看清已有改动,判断它是否已经实现了本 Phase 的部分任务、是否需要接着补齐、是否存在冲突。不能直接覆盖已有改动;如果重叠改动的意图不清楚,先停下来确认。

每完成一个 Phase 后,必须:
1. 跑完该 Phase 对应的最小测试/验证;
2. 再次运行 `git status --short`,确认只包含本 Phase 相关改动;
3. 只 stage 本 Phase 相关文件;
4. 做一次独立 commit,建议格式:`feat(clowder): complete phase N <short-topic>`。

如果仓库里同时存在其他 Phase 或用户已有的无关修改,本 Phase 的 commit 不能把它们一起提交。

---

## 关键架构澄清 — 单一 web 入口 + Thread 仍走 Clowder API

**用户痛点**:目前启动 im_web(IM 聊天)时,部分交互会"穿越"到 `clowder-ai` 的 web 后台(localhost:3003),如 thread 创建后跳 `http://localhost:3003/thread/xxx`。这造成"套娃搬迁"——前端看着像在 im_web,实际跳到另一个 web。

**目标重构**:**只启动 im_web(localhost:3000)就能完成所有 chat 相关能力**,不再依赖 clowder-ai web 的 3003 端口;Thread 数据仍走 Clowder API 后端(localhost:3004,通过 Vite 代理转发)。

### 三个项目的角色划分

| 项目 | 角色 | 启动? | 用户接触? |
|---|---|---|---|
| `sections/clowder-ai/packages/api/`(端口 3004) | **后端 API**:agent 注册、Thread 存储、文件上传、消息路由、workspace 校验 | **必须启动**(否则 API 全断) | 否 |
| `sections/clowder-ai/packages/web/`(端口 3003) | **Clowder 自己的 web 后台**:MissionControl / FeatureBoard / GitPanel / 治理控制台 / 旧版 AI 聊天 | **不再必须**(本次目标) | 主要给开发者/运维 |
| `sections/im_web/`(端口 3000) | **用户面向的 IM 聊天 UI**:IM 消息流、协调者对话、群聊、工牌、看板、产物面板 | **唯一面向用户启动的 web** | ✅ |

### 当前 im_web 已有的 Clowder 能力(复用,不要重写)

`im_web/packages/datasource-vue/src/stores/clowderStore.ts` 已经管理:
- ✅ Clowder 连接状态(`status.reachable`、`enabled`、`configured`)
- ✅ Agent 目录(`loadAgentDirectory`)
- ✅ 群聊猫成员(`loadGroupCats`)
- ✅ 协调者 focus(`setFocus` / `clearFocus`)
- ✅ 群聊自动回复模式(`setGroupAutoReplyMode`,`mentions_only` / `soft_mentions` / `off`)
- ✅ Clowder 不可达时的 fallback 状态(`disabledReason` 已在 ClowderConversationPanel 显示)

`im_web/apps/chat/src/components/ClowderConversationPanel.vue` 已经有:
- ✅ 协调者状态条
- ✅ Agent 列表(可点击 focus / clear)
- ✅ 群聊自动回复模式切换
- ✅ disabled 状态展示

**结论**:im_web 已经有"协调者对话"的 80% 能力,我们这次只**增量**补:
1. **项目群聊启动卡片**(Phase 3)
2. **文件管理 + workspace 校验 + artifact 声明 MCP 工具**(Phase 4)
3. **群聊内嵌看板 Tab**(Phase 5)
4. **群聊内嵌产物 Tab**(Phase 5)

### 需要改的"套娃"穿越点

**已知穿越**:
- 协调者提议创建 thread 时,clowder-ai web 跳 `localhost:3003/thread/xxx`(`callback-propose-thread-routes.ts`)
  - **改造**:创建成功后跳转 `localhost:3000/chat/conversation/{clowder-thread-id}`,不再跳 3003

**未来避免**:
- 所有 Clowder 相关的 UI 入口(协调者、群聊、工牌、看板)只放在 im_web
- im_web 路由**不再**生成 `http://localhost:3003/...` 链接
- clowder-ai web 包保留但**chat 入口弱化**(开发/运维用),不再向外推链接

### 不动的部分(本计划范围外)

- ❌ Clowder API(3004) — 不动
- ❌ MissionControl / FeatureBoard / GitPanel 等治理后台 — 不迁移
- ❌ WuKongIM(8090) — 不动
- ❌ 现有 `ClowderConversationPanel.vue` 主体逻辑 — 增量挂载卡片和 Tab,不改协调者控制核心

---

## 现有可复用基础(不要重新造)

### 后端(`sections/clowder-ai/`)
- **协调者入口**:`packages/api/src/routes/messages.ts:462-493` 已识别 `mode === 'coordinator'`,创建 `CoordinationContext`
- **协调者 dispatch 提示词**:`packages/api/src/domains/cats/services/agents/routing/lead-agent-selector.ts:94-117` 已写入"用 cat_cafe_multi_mention 拉 1-3 个最相关 Agent"规则(硬上限由 `MAX_MULTI_MENTION_TARGETS = 3` 决定,见 `packages/shared/src/types/multi-mention.ts:18`)
- **Thread 创建 API**:`packages/api/src/routes/threads.ts:105-120` 接受 `{ title, projectPath, preferredCats }`
- **Thread 类型**:`packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts:113-178` 已有 `participants: CatId[]`、`preferredCats: CatId[]`
- **任务类型**:`packages/shared/src/types/task.ts` 已有 `threadId`、`ownerCatId`、`coordinationId`、`artifactRefs`
- **猫猫数据**:`packages/shared/src/types/cat-breed.ts` 已有 `strengths`、`roleDescription`、`teamStrengths`
- **workspace 路径解析**:`packages/api/src/config/capabilities/mcp-config-adapters.ts:85-130` 的 `resolveWorkspaceRoot()` + `ALLOWED_WORKSPACE_DIRS` 配置
- **上传目录**:`packages/api/src/utils/upload-paths.ts:13-15` 的 `getDefaultUploadDir()`(本次不直接用,只在产物面板点击事件里可能涉及)

### 前端(`sections/im_web/`)
- **Clowder 状态**:`packages/datasource-vue/src/stores/clowderStore.ts` 已管理 agent 目录、focus、群聊协调者模式
- **协调者面板**:`apps/chat/src/components/ClowderConversationPanel.vue` 已有群聊内协调者控制 + agent 列表
- **协调者类型**:`packages/datasource-vue/src/stores/clowderTypes.ts` 已有 Clowder 各类类型
- **IM 消息流**:`apps/chat/src/components/MessageList.vue` + `MessageInput.vue`
- **群成员管理参考**:`apps/chat/src/views/GroupMemberList.vue` + `packages/datasource-vue/src/stores/groupStore.ts`

### 后端 + 前端共有(仅作视觉参考,不能 import)
- `sections/clowder-ai/packages/web/src/components/BootstrapPromptCard.tsx` — 消息流下方卡片 UI 模式
- `sections/clowder-ai/packages/web/src/components/TaskBoardPanel.tsx` — 4 列看板
- `sections/clowder-ai/packages/web/src/components/HubCatEditor.tsx:538-548` — Modal 布局

> ⚠️ **重要**:`sections/clowder-ai/packages/web/` 是 Clowder 自己的 web 后台,**不是用户最终 UI**。im_web 需要用 Arco Design Vue 写等价 Vue 组件。

---

## 实施步骤(TDD 顺序)

### Phase 1: 后端 (`sections/clowder-ai/`) — 协调者结构化输出推荐猫列表

**目标**:协调者首条回复携带 `suggested_cats: CatId[]`,通过 WebSocket 推给 im_web。

#### 1.1 扩展协调者 system prompt
- **文件**:`sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/lead-agent-selector.ts`
- **函数**:`buildCoordinatorDispatchMessage()` (:94-117)
- **改动**:在职责列表中追加第 6 条:
  ```
  6. 如果你认为用户的需求适合多人协作完成,在回复末尾用 JSON 块输出:
     ```cat-recommendation
     { "suggested_cats": ["cat-id-1", "cat-id-2"], "reason": "..." }
     ```
     suggested_cats 从 cat-catalog 里挑 1-3 只(系统硬上限 `MAX_MULTI_MENTION_TARGETS=3`),优先用其 strengths 匹配需求关键词;
     如果只是闲聊/单猫可解,输出 { "suggested_cats": [] }。
  ```

#### 1.2 后端解析协调者回复,提取推荐
- **新文件**:`sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/coordinator-recommendation-parser.ts`
- **导出**:
  ```typescript
  export function parseCoordinatorRecommendation(text: string): {
    suggestedCats: CatId[];
    reason?: string;
  }
  export function hasCoordinatorRecommendation(text: string): boolean
  ```
- **错误处理**:解析失败时静默返回空数组(不抛错)

#### 1.3 新增 `CoordinatorKickoff` 类型
- **文件**:`sections/clowder-ai/packages/shared/src/types/coordination.ts`(在 `CoordinationContext` 旁追加)
- **新增**:
  ```typescript
  export interface CoordinatorKickoff {
    readonly coordinationId: string;
    readonly messageId: string;
    readonly suggestedCats: readonly CatId[];
    readonly reason?: string;
    readonly createdAt: number;
  }
  ```
- **重新 export**:`packages/shared/src/types/index.ts`

#### 1.4 kickoff 持久化 store
- **新文件**:`sections/clowder-ai/packages/api/src/domains/cats/services/stores/coordinator-kickoff-store.ts`
- **实现**:参考现有 `ThreadStore`(内存 + Redis 双写),key = `coordinationId`
- **API**:`put` / `get` / `delete`

#### 1.5 协调者首条消息识别,触发 kickoff
- **文件**:`sections/clowder-ai/packages/api/src/routes/messages.ts`
- **位置**:在协调者 LLM 回复流完成、`recordResponse` 之后(:925 附近)
- **逻辑**:`if (hasCoordinatorRecommendation(text) && coordination?.phase === 'intake')` → parse → 写 kickoffStore → `socketManager.emitToUser(userId, 'coordinator_kickoff', kickoff)`
- **"首条"判断**:用 `coordination.phase === 'intake'`(已存在的状态机)

#### 1.6 新增 dismiss / query REST API
- **新文件**:`sections/clowder-ai/packages/api/src/routes/coordinator-kickoff.ts`
- **路由**:
  - `POST /api/coordinator/kickoff/:coordinationId/dismiss` → 删除 kickoff
  - `GET /api/coordinator/kickoff/:coordinationId` → 查询 kickoff
- **注册**:`packages/api/src/index.ts` 的路由注册处

**TDD 测试点**:
- ✅ `parseCoordinatorRecommendation()` 合法 JSON → 正确解析
- ✅ 文本无代码块 / 非法 JSON → 静默返回空
- ✅ messages.ts 集成:协调者首条含推荐 → kickoffStore 写入 + WS 推 `coordinator_kickoff`
- ✅ `POST /api/coordinator/kickoff/:id/dismiss` → store 删除成功

---

### Phase 2: im_web 订阅 + 类型接收

**目标**:im_web 能收到 `coordinator_kickoff` WebSocket 事件,在 clowderStore 里维护 kickoff 列表。

#### 2.1 im_web 端 CoordinatorKickoff 类型镜像
- **文件**:`sections/im_web/packages/datasource-vue/src/stores/clowderTypes.ts`
- **新增**:
  ```typescript
  export interface CoordinatorKickoff {
    coordinationId: string;
    messageId: string;
    suggestedCats: readonly string[];
    reason?: string;
    createdAt: number;
  }
  ```
- **说明**:不直接 import `@cat-cafe/shared`(跨项目),手动镜像类型

#### 2.2 clowderStore 增加 kickoff 状态
- **文件**:`sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- **新增 state**:`kickoffs: Record<string, CoordinatorKickoff>`
- **新增 action**:
  - `setKickoff(k: CoordinatorKickoff)`
  - `removeKickoff(coordinationId: string)`
  - `dismissKickoff(coordinationId)` — 调 `POST /api/coordinator/kickoff/:id/dismiss`
  - `loadKickoff(coordinationId)` — 调 `GET /api/coordinator/kickoff/:id`

#### 2.3 WebSocket 订阅
- **文件**:`sections/im_web/packages/datasource-vue/src/sdk.ts`
- **新增事件处理**:收到 `coordinator_kickoff` → `clowderStore.setKickoff(payload)`

**TDD 测试点**:
- ✅ clowderStore `setKickoff` 后 `kickoffs` 有值
- ✅ `dismissKickoff` 调 API + 本地删除
- ✅ WS 收到 `coordinator_kickoff` 事件 → setKickoff 被调用(mock)

---

### Phase 3: im_web 群聊启动卡片 UI

**目标**:协调者首条回复后,在 IM 协调者面板顶部展示「为这个项目建群」卡片。

#### 3.1 新增 `CoordinatorKickoffCard` 组件
- **路径**:`sections/im_web/apps/chat/src/components/CoordinatorKickoffCard.vue`
- **视觉参考**:`sections/clowder-ai/packages/web/src/components/BootstrapPromptCard.tsx:46-108`
- **Props**:
  ```typescript
  interface Props {
    kickoff: CoordinatorKickoff;
    currentChannelId: string;
    currentChannelType: number;
  }
  ```
- **视觉元素**:
  - 顶部:📁 icon + 标题"为这个项目创建群聊?" + 协调者推荐的 reason
  - 中间:横排工牌预览
  - 「+ 添加更多猫」按钮(展开可选猫多选)
  - 底部:群聊标题输入框 + **项目路径输入框**(默认值建议从 `ALLOWED_WORKSPACE_DIRS` 第一项 + 用户输入拼接)
  - 按钮:「稍后再说」+「创建群聊」
- **创建动作**:
  1. 用户填好标题 + 项目路径 + 勾选猫
  2. 先调 `GET /api/workspace/validate?path=...`(见 4.2)做路径校验
  3. 失败 → 提示用户改路径
  4. 成功 → 调 `POST /api/threads` 带 `{ title, projectPath, preferredCats }`
  5. 成功后跳转到新群聊(Vue Router push)+ `kickoffStore.removeKickoff()`

#### 3.2 新增 `CatWorkBadge` 组件
- **路径**:`sections/im_web/apps/chat/src/components/CatWorkBadge.vue`
- **视觉参考**:`HubCatEditor.tsx` IdentitySection + `CatAvatar.tsx` 状态光环
- **Props**:
  ```typescript
  interface Props {
    cat: { id: string; name: string; nickname?: string; avatar: string; color: any;
           roleDescription: string; teamStrengths?: string; strengths: string[] };
    selected: boolean;
    onToggle?: () => void;
    compact?: boolean;
  }
  ```
- **视觉**:大头像 + 名字 + nickname / roleDescription 一行 / strengths 标签云(`a-tag`)

#### 3.3 在 ClowderConversationPanel 中挂载卡片
- **文件**:`sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- **位置**:在 panel 顶部(协调者状态条之下):
  ```vue
  <CoordinatorKickoffCard
    v-if="activeKickoff"
    :kickoff="activeKickoff"
    :currentChannelId="channelId"
    :currentChannelType="channelType"
  />
  ```
- **`activeKickoff` 推断**:从当前 conversation 的 coordinationId 拿

#### 3.4 工牌详情 Modal
- **路径**:`sections/im_web/apps/chat/src/components/CatWorkBadgeModal.vue`
- **职责**:用户点击工牌 → 弹出该猫的完整档案
- **复用**:`a-modal` from Arco Design,样式照搬 `HubCatEditor.tsx:538-548`

**TDD 测试点**:
- ✅ `CoordinatorKickoffCard` 渲染:推荐猫 + 添加按钮 + 标题输入 + 项目路径输入
- ✅ 项目路径输入后调 `/api/workspace/validate`,越界显示错误
- ✅ 点击「创建群聊」→ 调 `POST /api/threads` + 跳转
- ✅ 点击「稍后再说」→ 调 `dismissKickoff` + 卡片消失
- ✅ `CatWorkBadge` 渲染:头像、名字、roleDescription、strengths pills
- ✅ ClowderConversationPanel 集成:有 kickoff 时显示卡片,无时不显示

---

### Phase 4: 文件管理 — 写入用户 workspace + 严格 artifactRefs

**目标**:猫猫干活产生的文件落到用户 workspace 下的真实项目目录;产物面板**只**展示猫主动声明的 artifactRefs。

#### 4.1 项目目录与 workspace 的关系(基于现有机制)

**复用** `sections/clowder-ai/packages/api/src/config/capabilities/mcp-config-adapters.ts:85-130`:
- 用户的项目目录必须在 `ALLOWED_WORKSPACE_DIRS` 配置的根目录之下
- Thread 的 `projectPath` 字段存**绝对路径**(如 `/Users/you/projects/myapp`)
- 创建群聊时,后端校验路径是否在 `ALLOWED_WORKSPACE_DIRS` 范围内
- 校验失败 → 400 + 提示

#### 4.2 路径校验 API(新增)

**新文件**:`sections/clowder-ai/packages/api/src/routes/workspace-paths.ts`
- `GET /api/workspace/validate?path=...` →
  ```typescript
  { valid: boolean; absolute: string; exists: boolean; reason?: string }
  ```
- 校验逻辑:
  1. 解析用户输入路径为绝对路径(支持 `~` 展开、相对路径相对 `ALLOWED_WORKSPACE_DIRS` 第一项)
  2. 检查是否在 `ALLOWED_WORKSPACE_DIRS` 任意一项之下
  3. `fs.existsSync()` 检查目录是否存在
  4. 返回校验结果(失败原因中文友好提示)

#### 4.3 创建群聊时绑定项目目录(改 threads.ts)

**修改**:`sections/clowder-ai/packages/api/src/routes/threads.ts:105-120`
- `createThread` 入口处新增 `projectPath` 校验(调 4.2 的 validate)
- 校验失败 → 400 + 错误信息
- 校验通过 → 存到 `Thread.projectPath`,**同时把 projectPath 加入 Thread 的 routing context**
- 复用现有 `messages.ts:600-601` 的 projectRoot 逻辑:确保 cat invocation 默认 cwd 在该目录

#### 4.4 严格 artifactRefs 上报机制

**核心原则**:猫猫写文件**不会自动**进入产物面板,只有通过 `cat_cafe_declare_artifact` 工具主动声明的文件才会出现。

**新增 MCP 工具**:`sections/clowder-ai/packages/api/src/domains/cats/services/agents/cat-cafe-mcp-tools.ts`
- 工具名:`cat_cafe_declare_artifact`
- 入参:
  ```typescript
  {
    threadId: string;
    coordinationId?: string;
    path: string;            // 相对 projectPath 的路径(必须已在磁盘上存在)
    kind: 'code' | 'doc' | 'image' | 'preview' | 'other';
    description?: string;
  }
  ```
- 行为:
  1. 校验 path 必须在 thread.projectPath 之下(防越界)
  2. `fs.existsSync()` 校验文件确实存在
  3. 找到该 thread 下所有 `coordinationId` 关联的 TaskItem(用 `findOrCreate`,无则创建)
  4. 把 path 追加到 TaskItem.artifactRefs(去重)
  5. 通过 WebSocket 推 `task:artifact_added` 事件

**错误处理**:path 越界 / 文件不存在 → 工具返回结构化错误

**MCP 工具注入到协调者 prompt**(改 lead-agent-selector.ts):
- 追加职责 7:
  ```
  7. 猫产出文件后,必须用 cat_cafe_declare_artifact 工具声明,
     写一段代码 → 立即声明、写一份文档 → 立即声明。
     未声明的文件不会出现在产物面板(用户看不到)。
  ```

#### 4.5 后端:TaskItem artifact REST API(新增,作为 MCP 工具的等价接口)

**新文件**:`sections/clowder-ai/packages/api/src/routes/thread-artifacts.ts`
- `POST /api/threads/:threadId/artifacts` 入参 `{ path, kind, description, coordinationId? }`
  → 内部调 declareArtifact 核心逻辑,返回更新后的 TaskItem
- `GET /api/threads/:threadId/artifacts` → 返回聚合后的产物列表:
  ```typescript
  type ThreadArtifactsResponse = {
    artifacts: Array<{
      path: string;              // 相对 projectPath
      absolutePath: string;      // 绝对路径(供前端展示/跳转)
      kind: 'code' | 'doc' | 'image' | 'preview' | 'other';
      description?: string;
      ownerCatId: string;
      taskId: string;
      createdAt: number;
    }>;
  }
  ```
- 实现:从 TaskStore 拿该 thread 的所有 tasks → flatMap artifactRefs → 校验每个 ref 实际存在 → 聚合返回

**MCP 工具 vs REST API**:
- 猫在 LLM 上下文里 → 用 MCP 工具(自动)
- 前端手动补录 / 调试 → 用 REST API

#### 4.6 前端产物面板 `ProjectArtifactsPanel`

**文件**:`sections/im_web/apps/chat/src/components/ProjectArtifactsPanel.vue`
- **数据源**:`GET /api/threads/:threadId/artifacts`(4.5 的聚合接口)
- **实时更新**:订阅 `task:artifact_added` WS 事件 → 重新拉取或本地追加
- **布局**:按 `ownerCatId` 分组,每组顶部 `CatWorkBadge compact`,列表展示每条产物的文件名 + kind 标签 + 描述
- **点击文件名行为**:
  - 代码类 → `vscode://file/{absolutePath}`(本机跳转 VSCode;失败回退到 `file://`)
  - 文档/图片类 → `file://{absolutePath}`(本机打开)
- **不实现**:在线编辑、diff 视图(只做只读展示 + 跳转)

#### 4.7 关键决策:为什么是"严格"而不是"扫描变更"?

用户选择**严格模式**(只展示主动声明的 artifactRefs),理由:
- **零误报**:猫写临时文件、缓存、`node_modules/` 不会污染产物面板
- **猫自我决策**:猫自己决定哪些算"产物",符合"猫猫自动决策"的产品愿景
- **可追溯**:每条产物都有 `ownerCatId` + `taskId`,可关联到具体任务
- **代价**:猫需要养成"声明产物"的习惯(协调者 prompt 强调 + 用户/协调者补录)

**回退路径**:如果猫不声明,用户可以在 chat 说"刚才写的 src/xxx.ts 也算产物",协调者会调 `cat_cafe_declare_artifact` 补录;或前端调 `POST /api/threads/:id/artifacts` 手动补录。

**TDD 测试点**:
- ✅ `GET /api/workspace/validate?path=合法路径` → `{ valid: true, exists: true }`
- ✅ `GET /api/workspace/validate?path=越界路径` → `{ valid: false, reason: '路径不在 ALLOWED_WORKSPACE_DIRS 范围内' }`
- ✅ 创建群聊时 projectPath 越界 → 400
- ✅ `cat_cafe_declare_artifact` 合法 path → TaskItem.artifactRefs 追加 + WS 推 `task:artifact_added`
- ✅ `cat_cafe_declare_artifact` 越界 / 不存在 → 工具返回错误
- ✅ `GET /api/threads/:id/artifacts` → 聚合去重,按 ownerCatId 分组,已删除的文件 ref 自动过滤

---

### Phase 5: 群聊内嵌看板 Tab

**目标**:群聊右侧加「看板」Tab,按 `threadId` 过滤任务。

#### 5.1 新增 `ProjectKanbanPanel` 组件
- **路径**:`sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue`
- **数据源**:`GET /api/threads/:threadId/tasks`(见 5.2)
- **视觉**:`sections/clowder-ai/packages/web/src/components/TaskBoardPanel.tsx` 的 4 列布局(doing/blocked/todo/done)
- **分组**:按 `ownerCatId` 分组,每组显示该猫的 `CatWorkBadge compact` + 该猫的任务列表
- **复用 Arco Design**:`a-tabs` + `a-collapse-panel`

#### 5.2 后端:TaskItem 按 thread 查询 API(新增)
- **新文件**:`sections/clowder-ai/packages/api/src/routes/thread-tasks.ts`
- **路由**:`GET /api/threads/:threadId/tasks` → 返回该 thread 的所有 TaskItem
- **复用**:`packages/api/src/domains/cats/services/stores/TaskStore`

#### 5.3 群聊内 Tab 容器
- **文件**:`sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- **位置**:在协调者控制 + kickoff 卡片之下,加 `a-tabs`:
  - Tab 1:「看板」→ `ProjectKanbanPanel`
  - Tab 2:「产物」→ `ProjectArtifactsPanel`(Phase 4)
  - Tab 3:「成员」(已有)→ 群成员列表

**TDD 测试点**:
- ✅ `GET /api/threads/:id/tasks` → 返回正确 tasks 数组
- ✅ `ProjectKanbanPanel` 按 threadId 过滤,只显示该群任务
- ✅ 群聊内 Tab 切换正确

---

### Phase 6: 端到端验证(单一 web 入口)

#### 6.1 启动流程(简化后)
1. `cd sections/clowder-ai && pnpm dev` 起 **Clowder API(3004)**(必须)
2. `cd sections/im_web && pnpm dev` 起 **im_web(3000)**(唯一面向用户的 web)
3. **不需要**起 `clowder-ai web(3003)` —— 所有 chat 交互在 im_web 内完成
4. 浏览器打开 `localhost:3000`

#### 6.2 手动跑通
1. 在 IM 找到协调者,发起对话:"帮我做一个 TODO App"
2. 验证:
   - 协调者首条回复后,`ClowderConversationPanel` 顶部出现「为这个项目创建群聊?」卡片
   - 卡片显示协调者推荐的 1-3 只猫(受 `MAX_MULTI_MENTION_TARGETS=3` 硬约束)
   - 填标题「TODO App 项目群」、项目路径 `/Users/me/projects/todo-app`、点「创建群聊」
   - **跳转链接应该是 `localhost:3000/chat/...`**,**不**是 `localhost:3003/thread/...`
   - 群聊协调者面板显示成员条
   - 展开「看板」Tab:4 列空状态
   - 群聊内说"开始做吧",协调者分发任务 → 看板出现 doing 任务
   - 猫干活完成后,主动调 `cat_cafe_declare_artifact` → 「产物」Tab 出现可点击文件
   - 点击代码类产物 → 跳转到 VSCode 打开本机文件
   - 验证:`node_modules/` 等未声明的临时文件**不**出现在产物面板

#### 6.3 验证"单一 web 入口"目标
- **关闭** `clowder-ai web(3003)`,只留 API(3004)和 im_web(3000)
- 跑通 6.2 全部步骤
- 确认没有任何链接指向 `localhost:3003/...`
- Clowder 不可达时(fallback),协调者面板显示 disabled 但不崩(已有的 fallback 行为)

#### 6.4 测试套件
- 后端:vitest 单测覆盖 `parseCoordinatorRecommendation`、`coordinator-kickoff-store`、`workspace-paths` validate
- 后端:API 集成测试 `POST /api/threads` (with preferredCats + projectPath)、`POST /api/threads/:id/artifacts`、`GET /api/threads/:id/artifacts`、`GET /api/threads/:id/tasks`
- 前端:Vitest 覆盖 `CoordinatorKickoffCard`、`CatWorkBadge`、`ProjectKanbanPanel`、`ProjectArtifactsPanel`、`clowderStore` kickoff actions
- 端到端:Playwright + `localhost:3000` 单端口跑通 6.2 全流程

---

## 关键文件清单(总结)

### `sections/clowder-ai/` 端(后端,新增 7 + 修改 4)

**新增**:
1. `packages/api/src/domains/cats/services/agents/routing/coordinator-recommendation-parser.ts`
2. `packages/api/src/domains/cats/services/stores/coordinator-kickoff-store.ts`
3. `packages/api/src/routes/coordinator-kickoff.ts`
4. `packages/api/src/routes/workspace-paths.ts`
5. `packages/api/src/routes/thread-tasks.ts`
6. `packages/api/src/routes/thread-artifacts.ts`
7. `packages/api/src/domains/cats/services/agents/cat-cafe-mcp-tools.ts`(追加 `cat_cafe_declare_artifact` 工具)

**修改**:
1. `packages/api/src/domains/cats/services/agents/routing/lead-agent-selector.ts` — 加推荐规则 + 强调 artifact 声明
2. `packages/api/src/routes/messages.ts` — 触发 kickoff 写入 + WS 推
3. `packages/api/src/routes/threads.ts` — 创建时校验 projectPath
4. `packages/api/src/routes/callback-propose-thread-routes.ts` — 提议 thread 创建后跳转 URL 改为 `localhost:3000/chat/...`(避免跳到 3003)
5. `packages/shared/src/types/coordination.ts` — 加 `CoordinatorKickoff` 类型
6. `packages/shared/src/types/index.ts` — 重新 export
7. `packages/api/src/index.ts` — 注册新路由

### `sections/im_web/` 端(前端,新增 5 + 修改 3)

**新增**:
1. `apps/chat/src/components/CoordinatorKickoffCard.vue` — 启动卡片(含项目路径输入 + 校验)
2. `apps/chat/src/components/CatWorkBadge.vue` — 工牌组件
3. `apps/chat/src/components/CatWorkBadgeModal.vue` — 工牌详情 Modal
4. `apps/chat/src/components/ProjectKanbanPanel.vue` — 看板
5. `apps/chat/src/components/ProjectArtifactsPanel.vue` — 产物面板(按 ownerCatId 分组 + 点击跳本地)

**修改**:
1. `packages/datasource-vue/src/stores/clowderTypes.ts` — 加 `CoordinatorKickoff` 类型
2. `packages/datasource-vue/src/stores/clowderStore.ts` — kickoff 状态管理
3. `packages/datasource-vue/src/sdk.ts` — WS 订阅(`coordinator_kickoff` + `task:artifact_added`)
4. `apps/chat/src/components/ClowderConversationPanel.vue` — 挂载卡片 + Tab 容器

### 单一 web 入口的"链接穿越点"清理

| 穿越源 | 现状 | 改造 |
|---|---|---|
| `callback-propose-thread-routes.ts` 创建 thread 后 | 返回 `localhost:3003/thread/xxx` | 改为 `localhost:3000/chat/...`(或 im_web 自己的 thread 路由) |
| `clowderStore` 任何返回带 URL 的字段 | 可能含 `localhost:3003/...` | 替换为 `localhost:3000/...` |
| `clowder-ai web` AI Chat 入口(`/new`、`/use`) | 用户主要在 im_web 用了 | 弱化入口或加"在 IM 中打开"链接,默认跳 im_web |

---

## 范围边界(本次不做什么)

- ❌ ExternalProject 绑定(用户明确选择不做)
- ❌ 独立项目文件管理模块(用户明确选择不做)
- ❌ 文件扫描式产物发现(选严格模式,只展示主动声明)
- ❌ 猫猫自我推荐 / 自动换班(超出范围)
- ❌ 任务依赖图渲染(`dependsOn` 字段已存在,本次只做列表)
- ❌ kickoff 状态持久化(刷新重置即可,降低状态管理复杂度)
- ❌ im_web 跨包 import clowder-ai 的 web 包代码(不可行,必须 Vue 组件重写)
- ❌ 产物在线编辑 / diff 视图(本次只做只读展示 + 跳转本地编辑器)
- ❌ **删除 clowder-ai web(3003)包**:只弱化 chat 入口,保留治理后台给开发者
- ❌ **强制 im_web 离线运行**:仍依赖 Clowder API(3004),不实现"完全本地模式"
- ❌ 合并 clowder-ai web 的 MissionControl / FeatureBoard / GitPanel 等治理 UI(本次只做 chat 能力迁移)

## 风险与回退

- **风险 1**:协调者 LLM 不一定稳定输出 `cat-recommendation` 代码块
  - **回退**:失败时 kickoffStore 不会被写,前端不显示卡片(等同 no-op)
- **风险 2**:im_web 已有 `ClowderConversationPanel` 改动可能影响现有协调者控制体验
  - **回退**:kickoff 卡片和 Tab 用 `v-if` 控制,默认不显示,无视觉变化
- **风险 3**:Vue 3 + Arco Design 写看板的 4 列拖拽(本次不做,只读展示)
  - **回退**:任务状态切换用 `PATCH /api/tasks/:id` 走 API,不做 UI 拖拽
- **风险 4**:猫忘记用 `cat_cafe_declare_artifact` 声明文件 → 产物面板空白
  - **回退**:协调者 prompt 强调 + 用户/前端可手动补录(见 4.7)
- **风险 5**:用户填的 projectPath 不在 `ALLOWED_WORKSPACE_DIRS` 范围 → 群聊创建失败
  - **回退**:`CoordinatorKickoffCard` 在用户填路径时实时调 `validate` API,提前给出明确错误提示和配置引导
- **风险 6**:`callback-propose-thread-routes.ts` 等后端代码可能还有其他地方硬编码 `localhost:3003`
  - **回退**:Phase 6.3 用 grep 全局扫 `localhost:3003`,把每一处都改成走配置变量(可注入前端 base URL)
- **风险 7**:clowder-ai web(3003)关闭后,某些 V3.0 plan 中设计的流程可能 broken
  - **回退**:Phase 1-5 完成后,实际跑一次 6.2 全流程,遇到 broken 点按需补改造(纳入范围)

## 验证方式(End-to-End)

1. `cd sections/clowder-ai && pnpm dev` 起后端
2. `cd sections/im_web && pnpm dev` 起前端
3. 浏览器打开 im_web
4. 在 IM 找到协调者,发起对话:"我想做一个 TODO 应用,前后端都要"
5. 期望:协调者回复后,`ClowderConversationPanel` 顶部出现「为这个项目创建群聊?」卡片,带推荐猫
6. 填标题「TODO App 项目群」、项目路径 `/Users/me/projects/todo-app`(确保该目录已存在且在 workspace 范围内)、点「创建群聊」→ 跳转到新群聊
7. 群聊协调者面板显示成员条
8. 展开「看板」Tab:4 列空状态
9. 在群聊内说"开始做吧",协调者分发任务 → 看板出现 doing 任务
10. 猫干活完成后,主动调 `cat_cafe_declare_artifact` → 「产物」Tab 出现文件链接,点击跳转到 VSCode 打开
11. 验证:`todo-app/node_modules/xxx.js` 这种未声明的临时文件**不**出现在产物面板

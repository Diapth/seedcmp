# V3-40 解决计划：PM Should Create Project Group Chats Instead Of Pulling Agents Into The Direct PM Chat

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

   ```bash
   bash scripts/start-im-clowder.sh start
   ```

3. **真实 Web 验收**：必须打开 `http://localhost:3000` 进入 IM Web 做真实操作，不允许只依赖单元测试、接口 mock 或脚本伪造。
4. **账号可自理**：可以使用已有测试用户登录，也可以主动创建新用户；验收记录中要写清楚使用的账号/会话。
5. **真实猫猫调用**：必须在 Web 端真实创建或选择猫猫，选择 OAuth 登录方式。
6. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
7. **真实派发任务**：必须在 Web 端向 PM/猫猫真实派发项目任务，观察 PM 创建项目群、拉取用户和智能体、以及智能体消息进入项目群。
8. **证据留存**：浏览器验收要保存截图、关键日志、会话 id、群 id、猫猫 id、任务文本和失败诊断，建议放在 `sections/im_web/.ai/V3.0/tests-e2e/v3-40-<timestamp>/`。

## 1. 问题现象

V3-40 要修复 PM/coordinator 的会话拓扑问题：

- 用户和 PM 的直聊应该是 1:1 的需求澄清、反馈、确认和进度总结通道。
- PM 不应该把 worker agents 直接拉进当前 PM 直聊，让直聊变成混合多智能体执行室。
- 当 PM 判断用户在启动一个项目时，应该创建或复用一个以项目名命名的项目群。
- 项目群必须包含用户、可见 PM 成员、以及 PM 选择的 worker agents。
- 任务执行、智能体协作、产物交付、看板和 artifact 绑定应发生在项目群/thread 中。

当前风险是 PM 直聊、项目执行、任务绑定和智能体交流混在一个 conversation/thread 里，导致用户不知道自己是在私聊 PM 还是在对整个项目团队发言，也会让 Kanban/artifact/thread binding 指向错误位置。

## 2. 根因判断

需要重点排查三条链路：

1. **PM project-start 意图识别链路**
   - PM 从直聊收到项目型请求后，目前可能直接创建 task 或调用 worker agent。
   - 缺少“先创建/选择项目群，再把执行切到项目群”的状态机。

2. **IM group creation + Clowder cat membership 链路**
   - 现有群聊创建支持真实用户和 Clowder cats，但 PM 是否能作为可见成员加入、是否能一次性拉齐用户和 worker agents，需要确认。
   - 群名需要来自项目名/工作区名，而不是随机群名或 PM 直聊名。

3. **thread/group/workspace/task binding 链路**
   - PM 直聊 thread 与项目群 thread 必须有绑定关系。
   - 任务、Kanban、artifact、文件交付应绑定到项目群 thread 或 active project group，而不是 PM 直聊 thread。
   - PM 直聊只保留 handoff/link 和必要的反馈路由信息。

## 3. 影响范围

- Clowder API：
  - `ConnectorRouter`
  - `ConnectorCommandLayer`
  - PM/coordinator routing helpers
  - `ThreadStore`
  - `TaskStore`
  - callback tools / MCP tools
- TangSeng bridge：
  - group create / member add APIs
  - Clowder cat group membership proxy
  - conversation/thread binding proxy
- IM Web：
  - PM direct chat entry and send flow
  - group creation/reuse flow
  - `ClowderConversationPanel`
  - group member UI and mention targets
  - project group deep-link / handoff message
  - Kanban/artifact panel binding
- 测试与验收：
  - PM routing 单元测试
  - group membership 集成测试
  - browser 真实端到端验收

## 4. 推荐方案

### 4.1 新增 Project Group Binding 模型

建议新增或扩展一个明确绑定：

```ts
interface ProjectGroupBinding {
  id: string;
  userId: string;
  projectName: string;
  workspaceId?: string;
  pmDirectThreadId: string;
  projectGroupNo: string;
  projectThreadId: string;
  pmMemberId: string;
  userMemberIds: string[];
  catMemberIds: string[];
  createdBy: 'pm' | 'system';
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
}
```

短期可以先存在 Clowder/TangSeng 可用的 store 中，但对外行为必须稳定：

- PM 直聊知道当前项目群是谁。
- 项目群知道自己来自哪个 PM 直聊和哪个 workspace/project。
- task/artifact 查询优先使用项目群 thread。

### 4.2 PM 项目启动状态机

PM 在直聊收到项目型请求后：

1. 解析或询问项目名。
2. 检查是否存在匹配的 active project group。
3. 如果不存在，创建群聊：
   - 群名 = 项目名或 workspace display name。
   - 用户必须加入。
   - PM/coordinator 必须作为可见成员加入。
   - 根据任务类型选择 worker agents 加入。
4. 写入 `ProjectGroupBinding`。
5. PM 直聊发送 handoff/link：

   ```text
   我已创建项目群「婚礼」，你和相关猫猫都在里面。后续执行会在项目群里进行，我会在这里同步关键进度和等你反馈。
   ```

6. 真正的 task create、worker routing、artifact delivery 在项目群 thread 发生。

### 4.3 PM 可见成员要求

PM 不能只是背后路由服务。项目群中必须有稳定可见身份：

- 群成员列表里能看到 PM/coordinator。
- PM 的任务分配、状态、总结消息以 PM sender identity 渲染。
- 用户可以在项目群中 `@PM` 或通过等价 UI 明确指向 PM。
- 内部路由可以存在，但不能让 PM 消息变成匿名/system/routing 消息。

### 4.4 项目群复用规则

- 同一个 PM direct thread + 同一个 workspace/projectName，如果已有 active project group，则复用。
- 用户在同一 PM 直聊中提出新项目时，PM 应询问“继续当前项目群还是创建新项目群”。
- 已 archived 的项目群不自动复用，除非用户明确恢复/继续。
- 复用时 PM 直聊要发清楚：

  ```text
  我会继续使用项目群「婚礼」处理这次修改。
  ```

## 5. 分阶段实施计划

### 阶段 1：梳理现有 PM、群聊和猫猫成员链路

目标：

- 找到 PM/coordinator 直聊触发 task/agent routing 的入口。
- 找到 IM group create、Clowder cat add/remove、group prompt sync 的现有 API。
- 明确 PM/coordinator 当前在系统里是虚拟 cat、system identity、contact，还是需要新增可见成员映射。

产出：

- 代码注释或轻量诊断日志只在必要处添加。
- 一组最小单元测试或 characterization tests 锁住当前行为。
- 更新 plan 或 issue 中的实际入口文件列表。

阶段完成后必须中文 commit，例如：

```text
梳理 PM 项目群创建链路
```

### 阶段 2：实现项目群创建/复用与绑定模型

目标：

- 新增 `ProjectGroupBinding` 或等价 store/API。
- PM 直聊收到项目型启动请求时，创建或复用项目群。
- 群名来自项目名/workspace display name。
- 群成员包含用户、可见 PM、所需 worker agents。

关键点：

- 创建群和添加成员要尽量原子化；失败时 PM 直聊要给出明确诊断。
- 若 worker agents 暂时不可用，群仍必须包含用户和 PM，并在群内说明缺失智能体原因。
- 重复请求不能无限创建同名群。

阶段完成后必须中文 commit，例如：

```text
实现 PM 项目群创建与绑定
```

### 阶段 3：把任务、看板、产物路由切到项目群

目标：

- PM 创建的 task 绑定到项目群 thread。
- worker agent 消息进入项目群，而不是 PM 直聊。
- `ProjectKanbanPanel` / artifact panel 能从 PM 直聊 handoff 找到项目群状态，或提示用户进入项目群查看执行状态。

关键点：

- PM 直聊只显示 handoff、总结和反馈入口。
- 项目群中保留完整任务执行上下文。
- PM 直聊中的用户反馈可以被 PM 摘要/转发到项目群，但不能把私聊全文泄露给所有 agent。

阶段完成后必须中文 commit，例如：

```text
将 PM 任务执行绑定到项目群
```

### 阶段 4：补齐前端展示、跳转和成员可见性

目标：

- PM 直聊显示项目群 handoff/link。
- 用户点击后进入项目群。
- 项目群成员列表可见用户、PM、worker agents。
- PM 消息在项目群中以 PM 身份渲染。
- 用户可以在项目群中提及/指向 PM。

阶段完成后必须中文 commit，例如：

```text
完善 PM 项目群前端展示
```

### 阶段 5：自动化回归测试

目标：

- 单元/集成测试覆盖 PM direct -> project group create/reuse。
- group membership 测试覆盖用户、PM、worker agents。
- binding 测试覆盖 tasks/artifacts/Kanban 使用项目群 thread。
- UI 测试覆盖 handoff/link、PM 身份渲染、用户可指向 PM。

建议命令：

```bash
cd sections/im_web
pnpm test:unit
pnpm type-check
pnpm build
```

按实际改动补充 Clowder API / Go proxy 测试命令。

阶段完成后必须中文 commit，例如：

```text
补充 PM 项目群回归测试
```

### 阶段 6：真实 Web 验收

必须执行：

```bash
bash scripts/start-im-clowder.sh start
```

然后打开：

```text
http://localhost:3000
```

验收流程：

1. 登录已有测试用户，或创建一个新用户。
2. 进入 Clowder 猫猫管理/控制台。
3. 创建或选择一只真实猫猫：
   - 登录方式：OAuth。
   - 运行平台优先：Claude Code。
   - 如果 Claude Code 不可用，记录原因并选择 Codex。
4. 在 Web 端进入 PM/coordinator 直聊。
5. 给 PM 派发真实项目任务，例如：

   ```text
   帮我做一个 V3-40 验收用的小项目，项目名叫 PM项目群验收，请拉相关猫猫进项目群并开始执行。
   ```

6. 断言 PM 直聊只出现需求确认、项目群 handoff/link 和总结，不出现 worker agents 长篇执行对话。
7. 打开 PM 创建的项目群，断言：
   - 群名等于项目名或合理的 project/workspace display name。
   - 用户在群里。
   - PM/coordinator 是可见群成员。
   - 相关 worker agents 是可见猫猫成员。
   - PM 任务分配消息以 PM 身份出现。
   - worker agents 的执行消息进入项目群。
8. 在项目群中继续给猫猫派发一个真实小任务，等待真实回复。
9. 刷新页面后确认 PM 直聊和项目群分离仍然成立，群成员和消息历史仍然正确。

验收证据必须记录：

- 账号/用户 id。
- PM direct conversation id。
- project group id / groupNo。
- Clowder thread id / binding id。
- 猫猫 id、运行平台、OAuth 状态。
- 项目任务文本。
- 截图和关键日志路径。截图放到seedcmp/docs/manual-test-artifacts下面
- 是否使用 Claude Code；若降级 Codex，写明原因。

真实验收完成后必须中文 commit，例如：

```text
完成 PM 项目群真实 Web 验收
```

## 6. 验收标准映射

| 验收点 | 覆盖阶段 |
|---|---|
| PM 直聊创建项目群而非拉 agent 进直聊 | 阶段 2、6 |
| 群名等于项目名 | 阶段 2、4、6 |
| 用户必须在群里 | 阶段 2、5、6 |
| PM 是可见成员 | 阶段 2、4、5、6 |
| worker agents 在项目群里 | 阶段 2、5、6 |
| PM 消息以 PM 身份出现 | 阶段 4、5、6 |
| 任务/看板/产物绑定项目群 thread | 阶段 3、5、6 |
| PM 直聊只保留反馈/总结/handoff | 阶段 3、4、6 |
| 真实 OAuth 猫猫任务派发 | 阶段 6 |

## 7. 风险与回滚

- 如果 PM 可见成员无法复用现有 cat/contact 模型，先实现稳定虚拟成员身份，不要退回隐身路由。
- 如果 group create 成功但 cat membership 失败，保留项目群并在 PM/群内显示可恢复诊断。
- 如果 Kanban 暂时不能从 PM 直聊透传到项目群，优先给出明确 link 和 thread binding 诊断，不要显示错误空态。
- 如果真实 Web 验收中 OAuth/Claude Code 不可用，允许降级 Codex，但必须保留失败原因和截图/日志。

## 8. 最终完成定义

V3-40 只有同时满足以下条件才算完成：

- 所有阶段都有对应中文 commit。
- 自动化测试通过。
- `bash scripts/start-im-clowder.sh start` 启动成功。
- `http://localhost:3000` 真实 Web 验收完成。
- Web 端真实创建/选择 OAuth 猫猫，优先 Claude Code，必要时 Codex 降级。
- PM 直聊真实派发项目任务后，PM 创建项目群并拉入用户、PM、worker agents。
- 项目群中真实出现 PM 分配和猫猫执行消息。
- 验收证据路径写入最终汇报。

## 9. 最终验收结果

2026-06-06 真实 Web 验收已通过。

- 命令：`RUN_V3_40_ACCEPTANCE=1 pnpm exec playwright test tests-e2e/v3-40-project-group-acceptance.spec.ts --project=chromium --reporter=line`
- 结果：`1 passed (1.6m)`
- 自动化补充校验：`go test ./modules/clowder`、`pnpm exec vitest run tests/clowderGroupMemberList.test.ts --pool=threads --poolOptions.threads.singleThread=true`、`pnpm exec vue-tsc --noEmit`
- 账号：`18337488675`
- 用户 id：`edbb4e4566f840f4a6f14b9f9cf01c22`
- PM direct conversation id：`clowder_cat:coordinator`
- project group / groupNo：`ec27d036cfc14de29f2adc398794504e`
- Clowder binding id：`229fa45f0aac45c6ab5d14e789d0d2cd`
- Clowder project thread id：`thread_mq272y5dm4far4qf`
- 项目名：`V340项目群06101256`
- OAuth 猫猫：`V340 Claude 101256` / `@v340claude101256`，Web 端 Claude Code OAuth 状态通过；没有降级 Codex。
- 项目群实际 worker agents：`dd`、`xtz`、`cs`，来自 PM/runtime 项目群状态。
- 证据路径：`docs/manual-test-artifacts/v3-40-v340-20260606101256/`
- 源始证据路径：`sections/im_web/.ai/V3.0/tests-e2e/v3-40-v340-20260606101256/`
- 关键日志路径：`.seedcmp-run/logs/tangseng.log`、`.seedcmp-run/logs/clowder-api.log`
- `acceptance-result.json` 中 `failedRequests` 为空。

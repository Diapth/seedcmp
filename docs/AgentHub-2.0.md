# AgentHub 2.0 参考 clowder-ai 的更新与适配方案

## 1. 文档信息

- 项目名称：AgentHub 2.0
- 文档类型：基于参考项目的产品与技术适配文档
- 参考项目：zts212653/clowder-ai
- 参考仓库地址：https://github.com/zts212653/clowder-ai
- 参考版本：`0f5a2b1 feat: display project directory in chat header (#728)`
- 编写日期：2026-05-20
- 上游文档：`docs/AgentHub-PRD.md`

## 2. 结论摘要

如果从 `clowder-ai` 出发建设 AgentHub，不建议按 1.0 PRD 从零搭建 Vue + FastAPI + LangGraph 平台。`clowder-ai` 已经具备多 Agent 协作平台的大部分底座能力，包括多模型 Agent 调用、线程隔离、A2A 路由、技能系统、MCP 能力管理、共享记忆、Mission Hub、配额看板、外部项目治理、插件框架、桌面安装器和大量测试。

AgentHub 2.0 的核心工作不再是“造一个多 Agent 平台”，而是“把 clowder-ai 改造成面向工程产物交付的比赛项目”。也就是说：

- 保留：多 Agent 会话、Agent CLI 调用、MCP、技能、记忆、Mission Hub、任务派发、预览网关、桌面/本地启动能力。
- 改造：品牌与产品定位、Agent 角色体系、任务模板、产物中心、知识库入口、演示场景、中文答辩材料。
- 新增：PPT、表格分析、代码工程生成三条可演示的工程交付流水线，以及统一的 TaskRun、TaskStep、Artifact 合同。
- 收敛：MVP 只做 1 到 2 条稳定闭环，避免把上游庞大能力全部搬进答辩范围。

## 3. AgentHub 2.0 定位

AgentHub 2.0 是一个基于 `clowder-ai` 底座改造的多 Agent 工程交付平台。平台通过多模型 Agent 团队、任务模板、技能系统、MCP 工具、共享记忆和产物工作区，让用户从一句需求出发，获得可追踪、可审核、可下载、可预览的工程产物。

一句话介绍：

AgentHub 2.0 将 clowder-ai 的多 Agent 协作底座产品化为工程交付平台，让 AI 团队围绕 PPT、数据分析、代码工程等任务生成真实可用的产物。

## 4. 参考项目现状

### 4.1 技术底座

`clowder-ai` 当前是 Node.js / TypeScript monorepo，主要包包括：

- `packages/web`：Next.js + React + Tailwind 的 Web UI。
- `packages/api`：Fastify API 服务，包含聊天、Agent 调用、Mission Hub、记忆、项目、工作区、上传、预览、配额、集成等路由。
- `packages/shared`：共享类型、schema、命令、能力模型、A2A 类型。
- `packages/mcp-server`：MCP 工具服务。
- `desktop`：Electron 桌面端。
- `scripts`：安装、启动、Redis、TTS、ASR、Embedding、检查和发布脚本。

这意味着 AgentHub 2.0 应优先沿用 TypeScript、Next.js、Fastify、Redis、SQLite、MCP、CLI 子进程调用的架构，而不是迁移到 Vue + FastAPI。

### 4.2 已有核心能力

| 能力 | clowder-ai 现状 | AgentHub 2.0 复用方式 |
| --- | --- | --- |
| 多 Agent 调用 | 支持 Claude Code、Codex、Gemini、Antigravity、opencode 等 CLI | 复用为 Planner、Researcher、Analyst、Builder、Reviewer 等 Agent 成员 |
| A2A 路由 | 有 A2A 类型、@mention 路由、线程隔离 | 作为 Agent 间消息和任务转交底座 |
| 技能系统 | `cat-cafe-skills` + manifest + 按需加载 | 改造成 `agenthub-skills`，新增 PRD、PPT、表格、代码生成技能 |
| MCP 能力 | 能力注册、MCP server、capability board、插件方向 | 复用为工具管理和产物生成工具接入层 |
| 记忆系统 | SQLite evidence store、FTS5、向量检索、摘要、跨项目冷启动 | 作为 RAG 和项目知识库底座 |
| Mission Hub | Backlog、领取、派发、Need Audit、Slice Planning | 适配为任务模板、执行看板、需求审计和交付计划 |
| 任务治理 | 有 portable governance、dispatch mission pack、execution digest | 用于任务执行前检查和任务完成后复盘 |
| 产物雏形 | A2A Artifact 类型、workspace、preview、export、PPT Forge 相关 spec | 补齐统一 Artifact Center |
| PPT 生成 | F144 PPT Forge 已有完整 spec 和部分完成项 | 作为首个工程交付模板主线 |
| 视频生成 | F138 Video Studio spec | 暂不作为 MVP，作为后续扩展 |
| 外部项目理解 | F152 Expedition Memory | 用于代码工程生成和外部项目接入 |
| 插件框架 | F202 Plugin Framework 正在 review | 可作为后续工具生态扩展，不进 MVP 主路径 |
| 测试体系 | Node test、Vitest、Biome、专项回归测试很多 | 复用测试模式，新增任务/产物/模板测试 |

### 4.3 关键架构决策

`clowder-ai` 的关键决策对 AgentHub 2.0 很重要：

- Agent 默认通过 CLI 子进程调用，而不是纯 API 或 SDK。
- MCP 通过 callback bridge 给非 Claude 模型共享工具能力。
- Thread 是共享语义单元，Session Chain 是每个 Agent 的运行时单元。
- 记忆系统本地优先，核心是 `evidence.sqlite`、FTS5、向量检索和 summary ledger。
- Mission Hub 把“要做什么”和“怎么执行”分离：Backlog 负责任务池，Thread 负责执行细节。
- 外部项目冷启动通过 GenericRepoScanner、Expedition Bootstrap 和知识工程技能解决。
- PPT Forge 的方向是 Research → Narrative → HTML/Tailwind 或 SVG → PPTX，可输出可编辑 PPT。

## 5. 与 AgentHub 1.0 的关键差异

### 5.1 技术栈变化

| AgentHub 1.0 设想 | AgentHub 2.0 调整 |
| --- | --- |
| Vue 3 + Vite | 改为 Next.js + React，复用 `packages/web` |
| FastAPI + Python | 改为 Fastify + TypeScript，复用 `packages/api` |
| LangGraph 编排 | 优先复用已有 thread、invocation、A2A、Mission Hub、skills 机制 |
| PostgreSQL + pgvector | MVP 沿用 Redis + SQLite + sqlite-vec/FTS5；后续再考虑 PostgreSQL |
| Celery/RQ | 沿用现有 Redis、队列、invocation、callback 与后台任务模式 |
| Vue Flow | 复用或新增 React Flow / 现有图形组件 |
| python-pptx | 优先沿用 PPT Forge 的 pptxgenjs / HTML-to-PPTX 路线 |

### 5.2 产品重心变化

1.0 更像从零设计一个通用多 Agent 平台。2.0 应该收敛为：

- 基于已有平台底座的工程交付产品。
- 面向比赛答辩的稳定演示系统。
- 以产物交付为核心，而不是以聊天陪伴、游戏、社交集成为核心。
- 以中文全栈项目展示为目标，而不是完整复制 clowder-ai 的所有理念和功能。

### 5.3 品牌与表达变化

`clowder-ai` 有强烈的“猫猫团队 / CVO / 陪伴式共创”表达。AgentHub 2.0 面向比赛答辩时，需要将表达转为更工程化的语言：

- `cat`、`猫猫`、`CVO` 统一抽象为 Agent 成员、用户、任务负责人。
- “猫猫协作空间”改为“多 Agent 工程协作平台”。
- “陪伴与共创”作为可选亮点，不作为主线。
- 保留人格化 Agent 的演示趣味，但答辩重点放在架构、任务闭环、产物交付和可观测性。

## 6. AgentHub 2.0 产品目标

### 6.1 MVP 目标

- 复用 clowder-ai 启动、Web、API、Agent 调用、MCP、记忆和 Mission Hub 基座。
- 建立 AgentHub 品牌、中文 README、答辩文档和演示路径。
- 新增统一 TaskRun / TaskStep / Artifact 合同。
- 打通至少 1 条稳定工程产物流水线，建议优先选择 PPT 生成。
- 补齐产物中心，支持预览、下载、日志、运行状态、失败原因。
- 展示多 Agent 分工、过程可观测、知识检索、工具调用、产物生成。

### 6.2 比赛增强目标

- 增加表格数据分析模板。
- 增加简单代码工程生成模板。
- 增加任务执行图、耗时统计、Token/成本统计、审核评分。
- 提供内置演示数据：答辩 PPT 资料、商品销售 CSV、Vue3 小游戏需求。
- 提供一键启动和演示脚本。

## 7. 需要保留的能力

### 7.1 保留多 Agent 运行时

保留 CLI 子进程调用模式，避免重写 LangGraph 编排层。

需要做的适配：

- 将默认 Agent 成员重新命名为工程角色。
- 为每个 Agent 配置角色说明、擅长任务、限制和默认模型。
- 在 UI 中弱化原有成员拟人化包装，突出 Planner、Researcher、Analyst、Builder、Reviewer 等职责。
- 保留 @mention 路由，但新增模板自动路由，不要求用户手动 @ 某个 Agent。

### 7.2 保留 Mission Hub

Mission Hub 是 AgentHub 2.0 的任务管理核心。

需要做的适配：

- 将 Backlog Item 映射为 AgentHub Task。
- 将 Feature lifecycle 映射为任务生命周期。
- 将 Need Audit 用作 PRD/需求质量检查。
- 将 Slice Planning 用作复杂任务拆解。
- 在 UI 上新增“工程模板”入口：PPT、表格分析、代码工程。

### 7.3 保留记忆与知识库

保留 evidence store、GenericRepoScanner、Expedition Memory。

需要做的适配：

- 新增面向普通用户的“资料上传”入口。
- 支持 PDF、Markdown、TXT、CSV、DOCX 的解析管线。
- 将上传文件转为 evidence item 或 knowledge document。
- 在任务执行时自动检索相关资料。
- 在产物中保留引用来源、检索片段和可信度。

### 7.4 保留 MCP 与能力管理

保留 Capability Board、MCP Server、技能加载、插件方向。

需要做的适配：

- 把工具管理从“开发者能力面板”包装为“任务可用工具”。
- 给每个模板声明所需工具。
- 在任务开始前做工具可用性检查。
- 工具失败时在 TaskStep 中显示失败原因和降级策略。

### 7.5 保留 Preview 与 Workspace

保留 workspace、terminal、preview gateway 等能力。

需要做的适配：

- 代码工程生成后可放入 workspace。
- 通过 preview gateway 预览静态页面或前端项目。
- 产物中心统一展示文件、日志、预览地址和下载入口。

## 8. 必须新增或改造的模块

### 8.1 AgentHub 品牌适配层

目标：将 clowder-ai 的产品表达改造成 AgentHub。

需求：

- 更新 README、标题、项目介绍和答辩文案。
- 替换 UI 中不适合比赛表达的品牌词。
- 不使用 clowder-ai 的名称、logo 和角色设计作为 AgentHub 品牌资产。
- 保留 MIT 许可代码使用边界，同时注意上游 README 中声明名称、logo、角色设计属于品牌资产。
- 新增 `docs/AgentHub-2.0.md`、架构图、演示流程和 MVP 路线。

### 8.2 Agent 角色与路由适配层

目标：把已有多 Agent 成员转为 AgentHub 工程角色。

建议角色：

- Planner Agent：需求理解、任务拆解、模板选择。
- Research Agent：资料检索、RAG、外部信息整理。
- Analyst Agent：结构化分析、数据统计、业务洞察。
- Writer Agent：报告、PPT 文案、讲稿、README。
- Builder Agent：PPTX、Excel、代码工程、ZIP 产物构建。
- Tester Agent：运行检查、结构检查、验收清单。
- Reviewer Agent：逻辑审核、事实审核、风险点检查。

适配点：

- 在成员配置中新增 role、capability、templateBinding。
- 在任务模板中定义默认 Agent 执行链。
- 支持用户手动指定 Agent，也支持系统按模板自动派发。

### 8.3 TaskRun 任务运行合同

目标：补齐 AgentHub 任务中心的统一数据合同。

核心对象：

- `TaskRun`：一次用户任务执行。
- `TaskStep`：某个 Agent 或工具步骤。
- `WorkflowTemplate`：任务模板。
- `Artifact`：任务产物。
- `ToolCall`：工具调用记录。
- `ReviewReport`：审核结果。

建议状态：

- TaskRun：`pending`、`running`、`waiting_for_input`、`completed`、`failed`、`cancelled`。
- TaskStep：`queued`、`running`、`completed`、`failed`、`skipped`。
- Artifact：`draft`、`ready`、`failed`、`archived`。

与 clowder-ai 关系：

- 可复用 A2A `Task` 和 `Artifact` 类型，但需要扩展工程产物元数据。
- 可复用 Mission Hub Backlog 与 thread 关联能力。
- 可复用 invocation、messages、tool-usage、execution-digests 路由。

### 8.4 Artifact Center 产物中心

目标：让平台从“聊天与任务管理”升级为“工程产物交付”。

功能：

- 展示任务生成的全部文件。
- 支持 Markdown、HTML、图片、图表、CSV、Excel、PPTX、ZIP、代码文件预览。
- 支持单文件下载和完整产物包下载。
- 支持产物元数据：类型、来源步骤、创建时间、校验状态、预览地址、大小、hash。
- 支持产物版本：同一任务多次重跑保留不同版本。
- 支持 Reviewer 给产物打分或标记问题。

必须新增：

- Artifact 索引与文件存储目录规范。
- `artifact-manifest.json` 合同。
- 产物下载 API。
- 产物预览 UI。
- 产物打包工具。

### 8.5 Workflow Template 模板系统

目标：把任务执行从自由聊天收敛为可复用模板。

MVP 模板：

1. PPT 生成模板。
2. 表格分析模板。
3. 简单代码工程生成模板。

模板字段建议：

- id
- name
- description
- inputSchema
- requiredTools
- agentChain
- outputArtifacts
- gates
- demoData
- acceptanceCriteria

模板需要支持：

- 任务启动前校验输入。
- 每一步产出结构化结果。
- 失败时明确停在哪个步骤。
- 用户可以重新运行某一步或整个任务。

### 8.6 PPT 生成模板适配

从 clowder-ai 的 F144 PPT Forge 出发，PPT 模板应成为 AgentHub 2.0 第一优先级。

目标闭环：

用户输入主题、受众、页数、风格和参考资料，系统输出：

- `research.md`
- `storyline.md`
- `deck.blueprint.json`
- `theme.tokens.json`
- `deck.pptx`
- `review-report.md`

需要补齐：

- 一句话触发完整管线。
- 企业风格模板至少 1 套稳定可用，优先中文答辩风格。
- PPTX 文件进入 Artifact Center。
- PPT 页面截图预览。
- PPT 365 打开无 repair 弹窗的手动验证记录。
- 生成结果中文字体、行高、密度和溢出检测。

### 8.7 表格数据分析模板适配

clowder-ai 当前不是以表格分析为核心，需要新增数据分析模板。

目标闭环：

用户上传 CSV 或 Excel，系统输出：

- `data-profile.json`
- `cleaned-data.csv`
- `analysis-summary.md`
- `charts/`
- `insights.md`
- `analysis-report.md`

建议实现：

- MVP 先支持 CSV。
- Node 侧可使用 CSV parser、SheetJS 或 DuckDB-WASM；如需要复杂统计，可新增 Python sidecar，但不作为第一选择。
- 图表数据先输出 JSON，再由前端 ECharts 预览。
- Reviewer 校验统计口径、字段解释和异常检测结论。

核心步骤：

1. Data Reader 读取字段和样本。
2. Data Profiler 输出字段类型、缺失率、数值范围。
3. Analyst 生成统计问题和聚合结果。
4. Chart Builder 生成图表配置。
5. Insight Writer 输出业务结论。
6. Reviewer 校验口径。

### 8.8 代码工程生成模板适配

clowder-ai 已有 workspace、terminal、preview、外部项目扫描和多 Agent 代码能力，可作为代码工程生成模板的底座。

目标闭环：

用户输入简单工程需求，系统输出：

- `requirements.md`
- `tech-plan.md`
- 项目源码目录
- `README.md`
- `acceptance-checklist.md`
- `run-log.txt`
- `project.zip`
- 预览 URL

建议 MVP 范围：

- 只支持静态页面或单页小游戏。
- 优先支持 Vite + React 或纯 HTML/CSS/JS，避免再引入 Vue 生态迁移。
- 生成后运行 build 或轻量 smoke test。
- 通过 preview gateway 提供页面预览。
- 打包 ZIP 进入 Artifact Center。

不建议 MVP 支持：

- 任意全栈 CRUD。
- 任意数据库 schema。
- 自动部署公网。
- 复杂鉴权或支付。

### 8.9 知识库上传适配

clowder-ai 强于项目记忆和仓库扫描，但 AgentHub 需要普通用户资料上传。

新增能力：

- 文件上传入口。
- 文件解析状态。
- 文档切分。
- evidence 入库。
- 任务绑定知识源。
- 检索引用展示。

支持优先级：

- P0：Markdown、TXT、CSV。
- P1：PDF、DOCX、Excel。
- P2：图片、多模态文件、视频字幕。

### 8.10 演示与答辩适配

需要新增比赛演示专用资产：

- 示例 PRD 文档。
- 示例 CSV 商品销售数据。
- 示例 PPT 主题与资料。
- 示例小游戏需求。
- 任务执行截图。
- 架构图。
- 演示视频脚本。
- README 中文启动说明。

## 9. AgentHub 2.0 目标架构

```text
用户 / 答辩演示
  |
  v
AgentHub Web UI (Next.js + React)
  |
  |-- Chat / Thread
  |-- Mission Hub
  |-- Workflow Templates
  |-- Task Run Center
  |-- Artifact Center
  |-- Knowledge Upload
  |
  v
AgentHub API (Fastify + TypeScript)
  |
  |-- TaskRun Service
  |-- Workflow Template Service
  |-- Artifact Service
  |-- Knowledge Ingestion Service
  |-- Mission Hub Adapter
  |-- Preview / Workspace / Upload Routes
  |
  v
Agent Runtime
  |
  |-- CLI Agent Adapters (Claude / Codex / Gemini / opencode)
  |-- A2A Router
  |-- Skills Framework
  |-- MCP Callback Bridge
  |
  v
Tool Layer
  |
  |-- PPT Forge
  |-- CSV / Excel Analyzer
  |-- Chart Builder
  |-- Code Project Builder
  |-- ZIP Packager
  |-- Preview Gateway
  |-- RAG Search
  |
  v
Storage
  |
  |-- Redis: runtime state, queues, sessions
  |-- SQLite: evidence, memory, local stores
  |-- File storage: uploads, artifacts, generated projects
```

## 10. 数据模型适配

### 10.1 TaskRun

一次用户任务执行。

字段：

- id
- title
- templateId
- threadId
- backlogItemId
- status
- input
- selectedAgents
- startedAt
- finishedAt
- errorSummary

### 10.2 TaskStep

任务中的一个 Agent 或工具步骤。

字段：

- id
- taskRunId
- name
- actorType
- actorId
- status
- inputRef
- outputRef
- toolCalls
- startedAt
- finishedAt
- errorMessage

### 10.3 WorkflowTemplate

可复用任务模板。

字段：

- id
- name
- description
- inputSchema
- agentChain
- requiredCapabilities
- outputArtifactTypes
- gates
- demoPayload

### 10.4 Artifact

工程产物。

字段：

- id
- taskRunId
- stepId
- name
- type
- mimeType
- filePath
- previewUrl
- size
- checksum
- version
- status
- metadata
- createdAt

### 10.5 KnowledgeSource

用户上传或项目扫描得到的知识源。

字段：

- id
- name
- sourceType
- filePath
- parseStatus
- evidenceScope
- metadata
- createdAt

## 11. API 与 UI 更新清单

### 11.1 API 新增

- `POST /api/agenthub/tasks`
- `GET /api/agenthub/tasks`
- `GET /api/agenthub/tasks/:id`
- `POST /api/agenthub/tasks/:id/run`
- `POST /api/agenthub/tasks/:id/cancel`
- `GET /api/agenthub/tasks/:id/steps`
- `GET /api/agenthub/tasks/:id/artifacts`
- `GET /api/agenthub/artifacts/:id/download`
- `GET /api/agenthub/templates`
- `POST /api/agenthub/knowledge/upload`
- `GET /api/agenthub/knowledge`

实际落地时可以复用已有 routes 命名风格，不强制使用以上路径。

### 11.2 UI 新增

- AgentHub 首页或工作台。
- 工程模板选择页。
- 任务创建表单。
- 任务运行详情页。
- Agent 执行时间线。
- 产物中心。
- 知识库上传与绑定面板。
- 演示数据一键填充按钮。

### 11.3 UI 改造

- Mission Hub 增加工程模板入口。
- Hub 中 Capability 改为更面向任务的工具可用性说明。
- Quota Board 保留，但在答辩中作为“成本可观测性”展示。
- Chat 页面保留，但不作为唯一入口。

## 12. 实施路线

### Phase 0：仓库收敛与品牌适配

目标：把 clowder-ai 变成 AgentHub 可展示项目。

交付：

- 更新项目名、README、中文介绍。
- 梳理保留/隐藏的功能入口。
- 明确不使用上游品牌资产。
- 增加 AgentHub 文档目录。
- 准备演示数据。

### Phase 1：TaskRun + Artifact Center

目标：建立工程交付核心合同。

交付：

- TaskRun / TaskStep / Artifact 类型。
- 任务创建和状态展示。
- 产物索引、预览、下载。
- 任务与 thread / Mission Hub 的关联。
- 失败状态和错误展示。

### Phase 2：PPT 生成闭环

目标：完成第一条稳定演示链路。

交付：

- PPT 模板输入表单。
- Research → Narrative → Deck Builder → Reviewer 流程。
- PPTX 文件生成并进入 Artifact Center。
- PPT 页面截图或预览。
- 演示主题：AgentHub 项目答辩 PPT。

### Phase 3：表格分析闭环

目标：体现数据处理与图表能力。

交付：

- CSV 上传。
- 字段识别和数据概览。
- 聚合统计和图表配置。
- Markdown 分析报告。
- 图表预览和结果下载。

### Phase 4：代码工程生成闭环

目标：体现工程交付能力。

交付：

- 简单项目需求输入。
- 需求拆解和技术方案。
- 生成项目文件。
- 本地构建或 smoke test。
- 预览 URL。
- ZIP 下载。

### Phase 5：答辩增强

目标：提升展示质量。

交付：

- 架构图。
- 任务执行图。
- Token/耗时统计。
- Reviewer 评分。
- 演示视频。
- 一键启动脚本。

## 13. 验收标准

### 13.1 MVP 验收

- 可以启动 Web、API、Redis 和必要服务。
- 可以创建一个 AgentHub 工程任务。
- 可以选择至少一个工程模板。
- 可以看到多个 Agent 或步骤的执行过程。
- 可以生成至少一种可下载产物。
- 产物中心可以展示文件列表、预览入口和下载入口。
- 失败步骤能显示错误原因。
- README 有清晰启动方式和演示流程。

### 13.2 PPT 模板验收

- 输入主题、页数、风格和参考资料后，可以生成 PPTX。
- 生成过程包含至少 4 个步骤：Research、Narrative、Build、Review。
- 输出中包含中间产物和最终 PPTX。
- PPTX 可下载。
- PPTX 可以在 PowerPoint 或 WPS 中打开。
- Reviewer 输出问题检查和改进建议。

### 13.3 表格模板验收

- 可以上传 CSV。
- 系统能识别字段和基础统计信息。
- 至少生成 2 种图表数据。
- 输出分析报告。
- 可以下载清洗数据和报告。

### 13.4 代码模板验收

- 输入简单需求后生成项目文件。
- 输出 README 和验收清单。
- 项目可以预览或至少通过静态检查。
- 可以下载 ZIP 包。

## 14. 测试决策

- 只测试外部行为，不测试 Agent 内部思考。
- TaskRun 测试覆盖状态流转、失败中断、取消和重跑。
- Artifact 测试覆盖文件创建、manifest、预览地址、下载和版本。
- Template 测试覆盖输入校验、必需工具检查、步骤编排和输出类型。
- PPT 测试覆盖中间合同、PPTX 文件存在、空文件防护、溢出检查报告。
- 表格测试覆盖 CSV 解析、字段统计、图表数据和异常输入。
- 代码生成测试覆盖文件清单、README、ZIP 包和 preview gateway。
- RAG 测试覆盖上传解析、检索来源和任务绑定。
- UI 测试覆盖任务创建、运行详情、产物中心和错误状态。
- 答辩前必须进行一次完整手动演示回归。

## 15. 风险与应对

### 15.1 上游项目范围过大

风险：clowder-ai 功能非常多，容易改造时迷失在非比赛核心能力中。

应对：MVP 只围绕 TaskRun、Artifact Center 和 1 条产物生成链路推进。

### 15.2 品牌与许可边界不清

风险：直接使用上游名称、logo 或角色设计会产生品牌混淆。

应对：代码可基于 MIT 使用，但 AgentHub 采用自己的项目名、视觉和角色命名。

### 15.3 技术栈与 1.0 PRD 不一致

风险：原 PRD 写的是 Vue/FastAPI，参考项目是 Next/Fastify。

应对：2.0 明确以参考项目为准，避免不必要迁移。

### 15.4 PPT Forge 尚有剩余验收项

风险：F144 中仍有视觉验收、字体嵌入、一句话触发等未完成项。

应对：比赛 MVP 只承诺稳定生成中文答辩 PPT，不承诺华为级复杂 PPT 全覆盖。

### 15.5 表格分析能力需要新增

风险：上游不是数据分析平台，表格模板需要额外开发。

应对：MVP 先支持 CSV 和基础统计，不做复杂 BI。

### 15.6 生成代码不可运行

风险：Agent 生成工程可能依赖缺失或构建失败。

应对：限制模板范围，优先静态页面或单页小游戏，并加入 Tester 步骤和预览检查。

### 15.7 本地服务复杂

风险：上游包含 Redis、桌面端、Python sidecar、多个 CLI，比赛演示环境容易出错。

应对：提供最小演示 profile，只启动 Web、API、Redis、必要 Agent 和产物工具。

## 16. Out of Scope

AgentHub 2.0 MVP 不做：

- 完整复制 clowder-ai 的所有陪伴、语音、游戏、社交平台能力。
- Telegram、飞书、企业微信等多平台接入。
- 视频生成工作室。
- 远程插件市场。
- 复杂多用户权限。
- 任意全栈项目自动生成。
- 公网部署和自动发布。
- 企业级审计与计费。

## 17. 推荐 MVP 演示脚本

### 演示 1：PPT 生成

1. 进入 AgentHub 工作台。
2. 选择“PPT 自动制作”模板。
3. 输入：生成一份 8 页 AgentHub 项目答辩 PPT。
4. 上传或选择内置 AgentHub PRD。
5. 点击运行。
6. 展示 Planner、Research、Writer、Builder、Reviewer 的执行过程。
7. 打开产物中心。
8. 下载 PPTX 和中间产物。

### 演示 2：表格分析

1. 选择“表格数据分析”模板。
2. 上传商品销售 CSV。
3. 展示字段识别、统计摘要、图表和分析报告。
4. 下载分析报告和清洗后数据。

### 演示 3：代码工程生成

1. 选择“小游戏工程生成”模板。
2. 输入 Vue3 或 React 贪吃蛇小游戏需求。
3. 展示需求拆解、代码生成、测试清单。
4. 打开预览页面。
5. 下载 ZIP 包。

## 18. 后续 Backlog

- AgentHub 品牌替换和中文 README。
- TaskRun / TaskStep / Artifact schema。
- Artifact Center UI。
- Template registry。
- PPT 模板接入 F144。
- CSV 分析模板。
- 代码工程模板。
- 文件上传与知识库绑定。
- 演示数据与一键运行 profile。
- 架构图和答辩材料。
- 最小端到端测试。

## 19. Further Notes

从 clowder-ai 出发，AgentHub 2.0 最大优势是起点很高：底层多 Agent、记忆、MCP、Mission Hub 和本地运行体系已经存在。真正要做的是产品收敛和比赛场景适配。

最重要的实施原则是：

1. 不重写底座。
2. 不迁移技术栈。
3. 不扩散到非答辩核心功能。
4. 先打通一个稳定工程产物闭环。
5. 用产物中心把“多 Agent 协作”变成看得见、下得了、能复验的结果。

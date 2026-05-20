# AgentHub 知识补习地图

## 1. 文档目的

这份文档用于回答一个问题：如果我们要基于 `clowder-ai` 做 AgentHub 2.0，需要补哪些知识，补到什么程度，如何确认自己真的掌握了。

AgentHub 2.0 的难点不是单个页面或单个接口，而是把多 Agent、任务编排、工具调用、知识库、产物生成、可观测性和答辩展示连成一个稳定闭环。因此学习也不能只看某个框架教程，而要围绕“能交付一个可演示产品”来补。

## 2. 总体学习主线

建议按这条顺序补习：

1. 先补项目底座：TypeScript、pnpm monorepo、Next.js、Fastify。
2. 再补运行时：Redis、SQLite、文件存储、后台任务、WebSocket。
3. 再补 Agent：CLI Agent 调用、A2A 路由、MCP、技能系统。
4. 再补产品核心：TaskRun、Workflow Template、Artifact Center。
5. 最后补三条演示链路：PPT 生成、表格分析、代码工程生成。

学习目标不是“知道概念”，而是每一块都能讲清楚、改得动、跑得起来、演示得出。

## 3. P0 必补知识

P0 是做 AgentHub 2.0 MVP 必须掌握的内容。

### 3.1 TypeScript 工程能力

为什么重要：

`clowder-ai` 是 TypeScript monorepo，前端、后端、shared 类型、MCP server 都依赖 TypeScript。后续所有 TaskRun、Artifact、Template、Agent 角色合同都要先从类型设计开始。

需要掌握：

- TypeScript 基础类型、联合类型、泛型、类型收窄。
- `interface` 与 `type` 的使用场景。
- `readonly`、字面量类型、枚举替代方案。
- `zod` 或 schema 校验与 TypeScript 类型联动。
- ESM 模块、路径引用、workspace 包依赖。

需要能产出：

- 能设计 `TaskRun`、`TaskStep`、`Artifact`、`WorkflowTemplate` 类型。
- 能把 API 入参和返回值写成共享类型。
- 能解释为什么结构化合同比纯 prompt 更稳定。

练习任务：

- 写一版 `TaskRun` 和 `Artifact` 的 TypeScript 类型。
- 给 `TaskRun.status` 写状态枚举和状态流转校验函数。
- 写一个测试，验证非法状态流转会被拒绝。

### 3.2 pnpm monorepo

为什么重要：

参考项目不是单体应用，而是 `packages/web`、`packages/api`、`packages/shared`、`packages/mcp-server` 的 monorepo。看不懂 workspace，就很难知道类型、构建和运行从哪里流动。

需要掌握：

- `pnpm-workspace.yaml` 的作用。
- workspace 包之间如何互相引用。
- 根目录脚本和 package 内脚本的关系。
- `pnpm --filter`、`pnpm -r` 的基本用法。
- lockfile、依赖安装、构建顺序。

需要能产出：

- 能讲清楚 AgentHub 2.0 为什么不再拆成独立前后端仓库。
- 能定位一个类型应该放在 `shared` 还是 `api`。
- 能跑通 build、test、dev 的基础命令。

练习任务：

- 画出 `web -> shared`、`api -> shared`、`mcp-server -> shared` 的依赖关系。
- 新增一个 shared 类型，并在 API 和 Web 中同时引用。

### 3.3 Next.js + React 前端

为什么重要：

AgentHub 2.0 不建议迁移到 Vue，而是沿用参考项目的 Next.js + React。任务创建、任务运行中心、产物中心、模板选择页都要在这个栈里做。

需要掌握：

- React 组件、props、state、hooks。
- Next.js app router 基础。
- 客户端组件和服务端组件的边界。
- API 请求、加载态、错误态、空状态。
- Zustand 或现有 store 的使用方式。
- Tailwind CSS 基础布局。

需要能产出：

- 能做一个任务模板选择页。
- 能做一个 TaskRun 详情页。
- 能做一个 Artifact Center 文件列表。
- 能处理 running、failed、completed 三种状态。

练习任务：

- 做一个静态版任务运行时间线。
- 做一个产物列表组件，支持 Markdown、PPTX、CSV、ZIP 四种类型图标与下载按钮。
- 做一个模板卡片列表：PPT、表格分析、代码工程。

### 3.4 Fastify API

为什么重要：

参考项目后端是 Fastify，不是 FastAPI。AgentHub 2.0 的任务创建、产物查询、文件下载、知识上传都应该接入现有 Fastify 路由体系。

需要掌握：

- Fastify 路由注册。
- request / reply 生命周期。
- schema 校验。
- multipart 文件上传。
- 静态文件服务。
- WebSocket 或事件推送基础。
- 路由拆分和 service 层组织。

需要能产出：

- `POST /tasks` 创建任务。
- `GET /tasks/:id` 查询任务状态。
- `GET /tasks/:id/artifacts` 查询产物。
- `GET /artifacts/:id/download` 下载文件。

练习任务：

- 写一个内存版 TaskRun API。
- 写一个本地文件下载 API。
- 写一个文件上传 API，并返回文件元数据。

### 3.5 Redis 与运行状态

为什么重要：

多 Agent 任务通常是长耗时任务，不能只靠一次 HTTP 请求完成。Redis 可以承载运行状态、队列、session、任务进度和临时缓存。

需要掌握：

- Redis key-value、hash、list、stream 的基本区别。
- TTL、锁、幂等 key。
- 任务状态为什么适合放 Redis。
- 哪些数据应该最终落盘，哪些只是运行态。

需要能产出：

- 能设计 TaskRun 的运行态 key。
- 能解释任务状态、任务日志、产物 manifest 分别放哪里。
- 能避免重复启动同一个任务。

练习任务：

- 设计 `taskrun:{id}:state`、`taskrun:{id}:events`、`taskrun:{id}:lock`。
- 写一个任务锁逻辑：同一任务运行中不能再次启动。

### 3.6 SQLite / FTS5 / 本地知识库

为什么重要：

参考项目的记忆和知识检索偏本地优先，核心是 SQLite、FTS5、向量检索和 evidence store。AgentHub 的 RAG 不一定第一阶段上 PostgreSQL，先理解本地知识库更实际。

需要掌握：

- SQLite 基础表设计。
- FTS5 全文检索。
- 文档切分、索引、检索、引用来源。
- evidence item、knowledge chunk、metadata 的区别。
- 本地索引为什么可以作为编译产物。

需要能产出：

- 能把上传 Markdown/TXT 转成可检索片段。
- 能按关键词查出相关片段。
- 能在报告中展示引用来源。

练习任务：

- 建一个 `knowledge_documents` 表和 `knowledge_chunks` 表。
- 写一个 Markdown 切分脚本。
- 写一个全文检索 demo，输入关键词返回 Top 5 片段。

### 3.7 Agent CLI 调用机制

为什么重要：

参考项目的关键选择是通过 CLI 子进程调用 Agent，而不是只用模型 API。这个决定影响架构、成本、工具能力、session、输出解析和错误处理。

需要掌握：

- 子进程 `spawn` 基础。
- stdout / stderr / exit code。
- JSON / NDJSON / stream-json 输出解析。
- 超时、取消、僵尸进程防护。
- CLI Agent 与普通 LLM API 的区别。

需要能产出：

- 能解释为什么 CLI Agent 保留文件操作和工具能力。
- 能设计一个通用 Agent 调用接口。
- 能处理 Agent 调用失败、超时、取消。

练习任务：

- 写一个最小 `invokeAgent(command, args, input)` 包装器。
- 模拟一个输出 JSON 的 CLI，并解析为标准消息。
- 给超时和非 0 exit code 写测试。

### 3.8 MCP 基础

为什么重要：

MCP 是 AgentHub 工具接入层的核心。文件解析、PPT 生成、表格分析、代码打包、预览等都可以被抽象成工具能力。

需要掌握：

- MCP 是什么，解决什么问题。
- MCP server、tool、resource 的概念。
- stdio 和 HTTP transport 的区别。
- 工具 schema、输入校验、输出结构。
- 工具权限和安全边界。

需要能产出：

- 能定义一个 `generate_ppt` 工具。
- 能定义一个 `analyze_csv` 工具。
- 能解释 Capability Board 与工具可用性的关系。

练习任务：

- 写一个最小 MCP 工具：输入文本，输出 Markdown 文件。
- 写一个工具声明文档：名称、用途、输入、输出、失败模式。

### 3.9 TaskRun / Workflow Template / Artifact Center

为什么重要：

这是 AgentHub 2.0 的产品核心。没有这三个抽象，平台就会停留在聊天工具，而不是工程交付平台。

需要掌握：

- TaskRun：一次任务执行。
- TaskStep：一个 Agent 或工具步骤。
- WorkflowTemplate：可复用任务模板。
- Artifact：最终和中间产物。
- manifest：产物索引与复验依据。
- gates：质量门禁和人工确认点。

需要能产出：

- 能讲清楚任务从创建到完成的数据流。
- 能设计一个 PPT 生成模板。
- 能让产物从某个步骤进入 Artifact Center。

练习任务：

- 写一个 `ppt-generation.template.json`。
- 写一个 `artifact-manifest.json` 示例。
- 画一张 TaskRun 状态流转图。

## 4. P1 应补知识

P1 是比赛增强和产品质量提升需要掌握的内容。

### 4.1 RAG 基础与引用可信度

需要掌握：

- RAG 的基本流程：解析、切分、向量化、检索、注入上下文、生成。
- lexical search、semantic search、hybrid search 的区别。
- chunk size、metadata、source path、provenance。
- 如何降低幻觉：引用来源、事实/推断分离、Reviewer 检查。

需要能产出：

- 一份带来源引用的分析报告。
- 一个检索结果展示组件。
- 一个 Reviewer 检查清单。

### 4.2 PPTX 生成技术

需要掌握：

- PPTX 本质是 OOXML 文件。
- `pptxgenjs` 的基本能力。
- HTML/CSS 到 PPT 的优缺点。
- 文本可编辑、图表可编辑、截图兜底之间的取舍。
- 中文字体、行高、溢出、密度检测。

需要能产出：

- 一个最小 PPTX 文件。
- 一个 PPT 生成中间合同：`research.md -> storyline.md -> deck.pptx`。
- 一个 PPT 质量检查报告。

### 4.3 CSV / Excel 数据分析

需要掌握：

- CSV 解析、编码、分隔符、空值。
- 字段类型识别。
- 描述性统计：计数、均值、中位数、最大最小、缺失率。
- 分组聚合。
- 简单异常检测。
- 图表数据结构。

需要能产出：

- 一个 `data-profile.json`。
- 一个 `analysis-summary.md`。
- 两个图表配置。

### 4.4 图表与可视化

需要掌握：

- ECharts 基础配置。
- 折线图、柱状图、饼图、散点图适用场景。
- 图表标题、坐标轴、单位、图例。
- 图表数据和展示组件解耦。

需要能产出：

- 从分析结果生成 ECharts option。
- 在产物中心预览图表。

### 4.5 文件存储与打包

需要掌握：

- 上传目录、产物目录、临时目录的区别。
- 文件命名、hash、大小、mimeType。
- ZIP 打包。
- 下载 API。
- 清理策略。

需要能产出：

- 一个任务产物目录规范。
- 一个 ZIP 打包工具。
- 一个 artifact manifest。

### 4.6 WebSocket / 事件流

需要掌握：

- 为什么长任务需要实时事件。
- polling、SSE、WebSocket 的区别。
- 任务事件：started、step_started、step_completed、artifact_created、failed。
- 前端如何合并事件到状态。

需要能产出：

- 一个任务执行时间线。
- 一个事件 schema。
- 一个失败事件展示。

### 4.7 测试体系

需要掌握：

- Node test。
- Vitest。
- API 测试。
- React 组件测试。
- 快照测试的边界。
- 手动验收清单。

需要能产出：

- TaskRun 状态测试。
- Artifact 下载测试。
- Template 输入校验测试。
- PPT/CSV/代码模板的 smoke test。

## 5. P2 可后补知识

P2 不阻塞 MVP，但适合答辩扩展或后续平台化。

### 5.1 插件框架

需要了解：

- 插件 manifest。
- 插件拥有的 skill、MCP、资源。
- enable / disable / config / test。
- 插件安全边界。

适合什么时候学：

当我们要把 PPT、表格分析、代码工程做成可插拔能力时再深入。

### 5.2 Electron 桌面端

需要了解：

- Electron 主进程、preload、renderer。
- 桌面安装器。
- 本地 Node / Redis 打包。

适合什么时候学：

当比赛需要交付桌面端安装包时再补。

### 5.3 多平台集成

需要了解：

- 飞书、Telegram、企业微信、GitHub PR 回流。
- 外部消息与 thread binding。

适合什么时候学：

AgentHub MVP 不需要，答辩时只作为可扩展方向提一下即可。

### 5.4 语音、视频、多模态

需要了解：

- ASR、TTS、视频生成、字幕对齐。
- Remotion 视频生成。

适合什么时候学：

后续做 AIGC 带货视频或短视频生成方向时再深入。

### 5.5 PostgreSQL / pgvector

需要了解：

- 为什么企业级部署可能需要 PostgreSQL。
- pgvector 与 SQLite 向量检索的取舍。
- 数据迁移策略。

适合什么时候学：

当本地 SQLite 无法满足多用户、并发、云部署时再补。

## 6. 按模块分工的补习清单

### 6.1 前端负责人

重点补：

- React / Next.js。
- Tailwind。
- Zustand 或现有状态管理。
- 任务运行详情页。
- 产物中心。
- 图表预览。

最小产出：

- 模板选择页。
- TaskRun 详情页。
- Artifact Center 页面。

### 6.2 后端负责人

重点补：

- Fastify。
- TypeScript service 分层。
- Redis。
- SQLite。
- 文件上传下载。
- 后台任务状态。

最小产出：

- TaskRun API。
- Artifact API。
- Knowledge Upload API。

### 6.3 Agent / 工具负责人

重点补：

- CLI Agent 调用。
- MCP。
- 技能系统。
- Agent 角色与路由。
- 工作流模板。

最小产出：

- PPT 生成模板的 Agent 链。
- CSV 分析工具。
- ZIP 打包工具。

### 6.4 产品 / 答辩负责人

重点补：

- PRD 表达。
- AgentHub 2.0 架构。
- 演示脚本。
- 技术亮点包装。
- 风险与取舍说明。

最小产出：

- 中文 README。
- 答辩 PPT 大纲。
- 演示视频脚本。
- 项目亮点说明。

## 7. 两周补习计划

### 第 1 天：项目全景

学习内容：

- 阅读 AgentHub PRD 与 2.0 文档。
- 了解参考项目目录结构。
- 搞清楚为什么 2.0 不从零做。

产出：

- 一张项目架构图。
- 一张“复用 / 新增 / 不做”清单。

### 第 2 天：TypeScript + monorepo

学习内容：

- TypeScript 类型。
- pnpm workspace。
- shared 类型设计。

产出：

- `TaskRun`、`TaskStep`、`Artifact`、`WorkflowTemplate` 类型草案。

### 第 3 天：前后端基础

学习内容：

- Next.js 页面和组件。
- Fastify 路由。
- 前后端 API 调用。

产出：

- 一个任务列表页面。
- 一个任务详情 API。

### 第 4 天：任务状态与事件

学习内容：

- Redis 状态。
- 任务状态机。
- 事件流。

产出：

- TaskRun 状态流转图。
- 一个模拟长任务 demo。

### 第 5 天：Artifact Center

学习内容：

- 文件存储。
- manifest。
- 下载 API。
- 文件预览。

产出：

- 一个 artifact manifest 示例。
- 一个产物列表 UI。

### 第 6 天：Agent 与 MCP

学习内容：

- CLI Agent 调用。
- MCP 工具概念。
- 技能系统。

产出：

- 一个工具调用设计文档。
- 一个 Agent 执行链设计。

### 第 7 天：PPT 生成链路

学习内容：

- PPT Forge 思路。
- `pptxgenjs`。
- PPT 中间合同。

产出：

- 一条 PPT 生成模板流程图。
- 一个最小 PPTX 生成 demo。

### 第 8 天：知识库与 RAG

学习内容：

- 文档解析。
- chunk。
- FTS5。
- 引用来源。

产出：

- 一个 Markdown/TXT 检索 demo。
- 一个引用展示样例。

### 第 9 天：CSV 分析

学习内容：

- CSV 解析。
- 字段统计。
- 图表数据。

产出：

- `data-profile.json`。
- 一个 ECharts option。

### 第 10 天：代码工程生成

学习内容：

- 代码产物目录。
- README 生成。
- ZIP 打包。
- preview gateway。

产出：

- 一个静态页面工程 ZIP。
- 一个预览流程说明。

### 第 11 天：测试与验收

学习内容：

- Node test。
- Vitest。
- smoke test。
- 手动验收清单。

产出：

- TaskRun 状态测试。
- Artifact 下载测试。
- 演示验收清单。

### 第 12 天：演示数据准备

学习内容：

- 演示脚本设计。
- 稳定输入与稳定输出。

产出：

- PPT 主题资料。
- 商品销售 CSV。
- 小游戏需求文本。

### 第 13 天：答辩包装

学习内容：

- 架构表达。
- 技术取舍。
- 风险应对。

产出：

- 答辩 PPT 大纲。
- 项目亮点和创新点说明。

### 第 14 天：全链路彩排

学习内容：

- 一次完整演示。
- 记录失败点。
- 做兜底方案。

产出：

- 演示 checklist。
- 失败兜底话术。
- 最终 README 修订。

## 8. 答辩时必须讲清楚的知识点

### 8.1 为什么多 Agent

要讲清楚：

- 单 Agent 容易同时承担规划、执行、分析、审核，稳定性不足。
- 多 Agent 可以按职责拆分。
- Reviewer / Tester 的意义是降低错误和幻觉。
- 多 Agent 不是为了炫技，而是为了让复杂任务过程可控。

### 8.2 为什么需要工作流模板

要讲清楚：

- 自由聊天不可复用。
- 模板可以固定输入、步骤、产物和验收标准。
- PPT、表格分析、代码工程是三个典型可复用模板。

### 8.3 为什么需要 Artifact Center

要讲清楚：

- 只输出文本不算工程交付。
- Artifact Center 让产物可预览、可下载、可复验。
- 产物 manifest 能把文件、来源步骤和审核状态连起来。

### 8.4 为什么采用 clowder-ai 底座

要讲清楚：

- 它已有多 Agent、MCP、记忆、Mission Hub、CLI 调用和本地运行能力。
- 我们的工作重点是产品收敛和工程产物交付。
- 这比从零写一个空壳平台更务实。

### 8.5 为什么技术栈从 1.0 设想调整

要讲清楚：

- 1.0 是从零设计，所以写了 Vue/FastAPI。
- 2.0 是基于参考项目改造，所以沿用 Next/Fastify/TypeScript。
- 技术选型服务于交付效率，而不是为了保持文档惯性。

### 8.6 如何控制范围

要讲清楚：

- MVP 只做一到两条稳定闭环。
- 不做全功能低代码平台。
- 不做复杂多用户权限。
- 不做所有模型和所有文件格式。
- 先让一个任务稳定生成可交付产物。

## 9. 最小知识闭环验收

当我们完成以下事项，就说明补习已经够支撑 MVP：

- 能画出 AgentHub 2.0 架构图。
- 能讲清楚 `TaskRun -> TaskStep -> Artifact`。
- 能解释 Agent CLI 调用和普通 LLM API 的区别。
- 能解释 MCP 在工具调用中的位置。
- 能写一个 Fastify API。
- 能写一个 React 任务详情组件。
- 能把一个 Markdown 或 CSV 文件变成可下载产物。
- 能跑通一个模拟任务，从 running 到 completed。
- 能生成一个 artifact manifest。
- 能讲清楚 PPT、表格、代码工程三条模板的步骤。

## 10. 推荐资料类型

不强制按课程学习，更建议按问题查资料：

- TypeScript 官方手册：查类型设计。
- pnpm workspace 文档：查 monorepo。
- Next.js 文档：查 app router 和客户端组件。
- Fastify 文档：查路由、schema、文件上传。
- Redis 文档：查状态、锁、队列。
- SQLite / FTS5 文档：查本地检索。
- MCP 官方文档：查工具协议。
- pptxgenjs 文档：查 PPTX 生成。
- ECharts 文档：查图表配置。
- Node.js child_process 文档：查 CLI 调用。

## 11. 学习优先级总表

| 优先级 | 主题 | 目标 | 验收产出 |
| --- | --- | --- | --- |
| P0 | TypeScript | 设计核心数据合同 | TaskRun / Artifact 类型 |
| P0 | pnpm monorepo | 看懂参考项目结构 | 包依赖图 |
| P0 | Next.js / React | 做任务与产物 UI | 任务详情页 |
| P0 | Fastify | 做 AgentHub API | TaskRun API |
| P0 | Redis | 管理运行状态 | 状态机 demo |
| P0 | SQLite / FTS5 | 做知识检索 | 文档检索 demo |
| P0 | Agent CLI | 调用 Agent | invoke wrapper |
| P0 | MCP | 接入工具 | 工具声明 |
| P0 | Artifact Center | 交付产物 | manifest + 下载 |
| P1 | RAG | 降低幻觉 | 带引用报告 |
| P1 | PPTX | 生成 PPT | 最小 deck.pptx |
| P1 | CSV 分析 | 做表格模板 | data-profile + chart |
| P1 | 测试 | 保证稳定演示 | smoke test |
| P2 | 插件 | 后续扩展工具生态 | plugin 草案 |
| P2 | Electron | 桌面端交付 | 安装包方案 |
| P2 | 多平台集成 | 远期入口扩展 | 集成路线 |

## 12. 最后建议

不要把补习变成“把所有技术都学完”。AgentHub 2.0 只需要先掌握能支撑 MVP 的那条路径：

```text
用户输入
-> 选择模板
-> 创建 TaskRun
-> 多 Agent / 工具执行
-> 记录 TaskStep
-> 生成 Artifact
-> 产物中心预览和下载
-> Reviewer 给出验收结果
```

只要这条链路跑通，AgentHub 就能从概念变成项目。剩下的多模型、多插件、多平台、多模态，都可以作为后续扩展慢慢加。

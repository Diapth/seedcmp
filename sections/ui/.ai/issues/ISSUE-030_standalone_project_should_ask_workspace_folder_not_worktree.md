# [ISSUE-030] 独立项目创建应询问工作文件夹而非默认使用 worktree

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：process / skill / project-scaffolding / workspace / worktree / ux
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-030_standalone_project_should_ask_workspace_folder_not_worktree.md
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

当用户提出“做一个新项目 / 做一个网页 / 做一个小应用 / 做一个 MVP”这类独立项目诉求时，当前 agent 容易套用 `using-git-worktrees` / superpowers worktree 流程，在某个现有 repo 的 worktree 分支里实现。这个行为对用户来说过于抽象，也容易把一个本该独立存在的网页或应用塞进已有 IM / UI 项目目录里。

一个真实例子是：用户要做“记单词独立小网页 MVP”，结果文件落在了类似下面的路径中：

```text
/home/yunyi/.config/superpowers/worktrees/seedcmp/word-study-mvp/sections/ui/pages/word-study/
```

从用户视角看，这不是“一个独立网页项目”，而是被放进了 `seedcmp/sections/ui` 现有 IM 项目里，后续打开、运行、移动、交付都变得不直观。

期望行为：

1. 识别到用户想做一个独立项目时，先询问用户是否在工作文件夹下面创建一个新的项目文件夹。
2. 默认建议路径应是工作文件夹下的独立目录，例如 `/home/yunyi/Desktop/Bytedance_cmp/<project-slug>/`。
3. 只有用户明确说“改现有项目 / 在这个 repo 里加功能 / 开分支 / 用 worktree / 基于 seedcmp 做”时，才进入 worktree 或现有 repo 修改流程。
4. 需要创建一个 skill 规范这件事，让未来 agent 在项目创建入口先做归属判断和路径确认。

---

## 复现步骤

1. 用户说：“帮我做一个记单词网页 MVP”。
2. agent 判断为开发任务。
3. agent 直接使用 worktree skill，在已有 `seedcmp` repo 下创建 worktree。
4. agent 把独立网页功能写入 `sections/ui/pages/...`。
5. 用户发现项目不在工作文件夹下的独立目录，而是混进已有 IM 项目结构。

实际：

1. 用户没有被问“这是独立项目还是现有 repo 功能”。
2. 用户没有被问“要不要在工作文件夹下创建项目文件夹”。
3. 生成物被放进现有 repo/worktree，路径抽象且不符合独立项目预期。

预期：

1. agent 先识别“独立项目”意图。
2. agent 先询问项目落点，默认给出工作文件夹下的新目录。
3. agent 只在用户确认后创建目录和脚手架。
4. worktree 只用于现有 repo 的分支隔离，不作为独立项目默认载体。

---

## 建议新增 skill

建议新增一个类似 `standalone-project-intake` / `project-folder-intake` 的 skill。

### Description 草案

```yaml
name: standalone-project-intake
description: >
  Use when the user asks to create a new standalone project, website, app, game, demo, MVP,
  prototype, or tool and has not explicitly said it belongs inside the current repository.
  Ask where to create the project under the user's working folder before scaffolding.
  Not for modifying an existing repo feature, fixing bugs in current code, or work explicitly
  requested in a git branch/worktree. Output: confirmed project directory, project name,
  and whether to scaffold standalone files or enter an existing repo workflow.
```

### 核心原则

1. **项目归属先于动手**：先判断这是独立项目还是现有 repo 功能。
2. **独立项目默认独立目录**：默认放在当前工作文件夹下的新项目文件夹，而不是 `.config/superpowers/worktrees`。
3. **路径要用户可理解**：优先使用用户能在文件管理器里直接看到的目录。
4. **worktree 是例外，不是默认**：worktree 适合现有 repo 的 feature branch、bugfix、隔离开发；不适合作为“新网页/新应用”的默认落点。
5. **创建前确认**：如果要新建目录、初始化 package、安装依赖或启动 dev server，先给出目录和项目名并等待用户确认。

### 触发条件

用户表达中出现以下意图时触发：

1. “做一个网页 / 网站 / app / 小程序 / 小工具 / 游戏 / demo / MVP / prototype”。
2. “帮我创建一个项目 / 新项目 / 独立小应用”。
3. 用户没有明确指定现有 repo 路径。
4. 用户没有说“在 seedcmp 里加一个页面 / 修改当前项目 / 开个分支 / 用 worktree”。

### 排除条件

以下情况不触发该 skill，继续走现有 repo / worktree 流程：

1. 用户明确说“在当前项目里加功能”。
2. 用户明确给出现有 repo 路径或文件路径。
3. 用户正在修 bug、改 UI、处理 issue、跑测试。
4. 用户明确要求开分支、建 worktree、提 PR。
5. 用户只是在现有项目里新增页面，例如“给 `sections/ui` 增加一个设置页”。

### 标准询问话术

当判断为独立项目但路径未确认时，agent 应问：

```text
这听起来像一个独立项目。你希望我在工作文件夹下面创建新项目目录吗？

我建议放在：
/home/yunyi/Desktop/Bytedance_cmp/<project-slug>/

确认后我会在这个目录里创建项目文件，而不是放进现有 seedcmp / IM 项目或 superpowers worktree。
```

如果用户已经给了项目名：

```text
我建议创建：
/home/yunyi/Desktop/Bytedance_cmp/word-study-mvp/

确认用这个目录吗？
```

如果用户表达可能是现有项目功能：

```text
这个需求有两种落点：独立新项目，或加到当前 repo 里。
你希望我创建独立目录，还是作为现有项目功能实现？
```

### 默认路径规则

1. 默认工作文件夹：当前 workspace root，例如 `/home/yunyi/Desktop/Bytedance_cmp/`。
2. 项目目录名：从用户需求生成 kebab-case slug，例如 `word-study-mvp`。
3. 如果目录已存在，必须询问是否复用、改名或打开现有目录。
4. 不在已有大型 repo 内创建独立项目，除非用户明确要求。
5. 不在 `.config/superpowers/worktrees/` 下创建独立项目，除非用户明确要求临时隔离或 repo 分支。

---

## 相关代码 / 相关 skill

```text
/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md
- 现有 worktree skill 应补充边界：只用于现有 repo feature work / implementation plans / 分支隔离。
- 不应作为独立项目默认入口。

/home/yunyi/.codex/skills/brainstorming/SKILL.md
- 新项目 brainstorming 后，进入实现前应先确认项目归属和目录。

/home/yunyi/.codex/skills/skill-creator/SKILL.md
/home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/clowder-ai/cat-cafe-skills/writing-skills/SKILL.md
- 可用于创建该新 skill，并按 description / Not for / GOTCHA 标准写清楚边界。

/home/yunyi/.config/superpowers/worktrees/seedcmp/word-study-mvp/
- 当前误落点示例：独立网页 MVP 被放进 seedcmp worktree 和 sections/ui 项目内。
```

---

## 根因分析

当前流程把“我要做一个项目”过早归类为“在现有 repo 里开发一个 feature”，于是自然触发 worktree 隔离。这个判断对代码协作是合理的，但对独立项目创建不合理。

真正缺失的是一个入口判断：

```text
用户想做的是：
1. 独立项目？
2. 现有 repo 新功能？
3. 现有 repo bugfix？
4. 只是原型/一次性 HTML？
```

没有这个判断时，agent 会根据当前 cwd、打开的 repo 或最近使用的 worktree skill 自动选择落点，用户却期待“在工作文件夹里新建一个我能看见的项目文件夹”。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么不能默认用 worktree？
**A1**: worktree 是给已有 git repo 的分支隔离工具。独立项目默认用 worktree 会把项目放进抽象路径，还会继承现有 repo 的目录结构和依赖语义，用户难以理解，也不利于交付。

### Q2: 如果用户说“做一个网页”，一定是独立项目吗？
**A2**: 不一定。若用户上下文明确是“给当前 app 加一个页面”，应进入现有 repo。若用户没有指定 repo 或现有功能，默认先按独立项目询问路径。

### Q3: 是否每次都要问？
**A3**: 只在项目归属不明确时问。用户明确说“就在当前 repo 改”或“在 `/path/project` 创建”时无需再问；用户说“做一个独立网页/小项目”但没给路径时必须问。

### Q4: 这会不会拖慢开发？
**A4**: 会多一次确认，但能避免把项目建错位置。相比之后迁目录、改依赖、解释 worktree，前置确认成本更低。

---

## 代码 / Skill 方案补充

### 需要改的是路由规则，不是项目代码

这个 issue 不应落成 `sections/ui` 业务代码改动，而应落成一个明确的 Codex/Cat Café skill 以及 `using-git-worktrees` 的边界补丁：

```text
/home/yunyi/.codex/skills/standalone-project-intake/SKILL.md
/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md
```

如果是在 Cat Café skill 体系里发布，则还需要按 `writing-skills` 的流程补 manifest/symlink/cachebuster；不要把该规则写进某个前端 repo 的 README 后就算完成。

### 建议 Skill 流程

1. 进入任何脚手架动作前，先做项目归属分类：
   - `standalone_project`
   - `existing_repo_feature`
   - `existing_repo_bugfix`
   - `single_file_artifact`
2. 如果分类为 `standalone_project` 且路径未确认，必须只问一个短问题，产出：
   - `projectName`
   - `projectSlug`
   - `projectRoot`
   - `scaffoldKind`
3. 默认 `projectRoot` 从当前 workspace root 的父级或用户常用工作文件夹推导：
   - 当前在 `/home/yunyi/Desktop/Bytedance_cmp/seedcmp` 时，默认建议 `/home/yunyi/Desktop/Bytedance_cmp/<slug>/`。
   - 不建议 `/home/yunyi/.config/superpowers/worktrees/...`，除非用户明确要现有 repo 分支隔离。
4. 路径冲突时不要覆盖：
   - 目录不存在：请求确认创建。
   - 目录存在且为空：请求确认复用。
   - 目录存在且非空：询问复用/改名/打开现有目录。
5. 用户确认后才允许：
   - `mkdir`
   - `npm create` / `pnpm create`
   - 写入 HTML/React/Vue 文件
   - 安装依赖
   - 启动 dev server

### `using-git-worktrees` 的边界补丁

建议在该 skill 的 `When to use / Not for / Red Flags` 增加：

```text
Not for:
- A new standalone website/app/game/demo/MVP where the user did not say it belongs in the current repository.
- Project scaffolding whose deliverable should be a visible folder under the user's working directory.

Before creating a worktree:
- If the user asked for a new standalone project, invoke standalone-project-intake first.
- Only return to using-git-worktrees if the user chooses "current repo / feature branch / worktree".
```

### 可测试的路由用例

建议给新 skill 写一个小的 `examples.md` 或在 `SKILL.md` 末尾列 table：

| Prompt | 期望路由 |
| --- | --- |
| 帮我做一个记单词网页 MVP | 询问独立目录 |
| 给 sections/ui 加一个记单词页面 | 现有 repo / worktree |
| 做一个可以本地打开的 HTML 小工具 | 询问独立目录或单文件 artifact |
| 在当前分支修这个 bug | 现有 repo bugfix |
| 开 worktree 做 F123 | using-git-worktrees |

### 边界意见

1. 不要为了遵守“改代码开 worktree”而把独立项目也塞进当前 repo 的 worktree；这条规则只保护现有 repo 改动。
2. 不要在用户未确认时创建目录再让用户选择，因为“空目录/初始化依赖”本身已经是副作用。
3. 不要让 skill 自动选择框架。路径确认和技术选型是两步：先确认落点，再根据用户目标选择 HTML/Vite/Next 等。
4. 如果用户明确指定路径，例如 `/tmp/foo` 或 `~/Desktop/foo`，不需要再推荐默认目录，但仍要确认是否覆盖/复用已有目录。

---

## 修复建议

1. 新增 `standalone-project-intake` skill，专门处理独立项目入口判断和路径确认。
2. 修改或补充 `using-git-worktrees` skill 的 Not for / GOTCHA：不要在独立项目请求中默认使用 worktree。
3. 在新 skill 中列出触发关键词、排除条件、标准询问话术和默认路径规则。
4. 在 agent 开始脚手架前强制确认：
   - 项目名
   - 项目目录
   - 是否独立项目
   - 是否允许初始化依赖和启动 dev server
5. 对已有误落点场景写压力测试：用户说“做一个记单词网页 MVP”，agent 应建议 `/home/yunyi/Desktop/Bytedance_cmp/word-study-mvp/`，而不是 `.config/superpowers/worktrees/seedcmp/.../sections/ui/...`。
6. 如果用户后续确认“其实就是要集成到当前 IM 项目”，再切换到现有 repo/worktree 流程。

---

## 验收标准

- 用户提出独立项目请求时，agent 不直接创建 worktree。
- agent 先询问是否在工作文件夹下创建项目文件夹，并给出具体路径。
- 用户确认前，agent 不写入现有 repo、不初始化 package、不安装依赖。
- 用户确认独立目录后，项目文件只落在该目录下。
- 用户明确说“改当前 repo”时，agent 不触发独立目录询问，继续现有 repo 工作流。
- `using-git-worktrees` 的边界被更新：独立项目不是默认适用场景。
- 新 skill 的 description 明确包含 Use when / Not for / Output。
- 至少用 5 个示例 prompt 验证路由：
  1. “做一个记单词网页 MVP” -> 问独立目录。
  2. “给 seedcmp 的 ui 加一个记单词页面” -> 现有 repo。
  3. “创建一个独立小游戏” -> 问独立目录。
  4. “在当前分支修这个 bug” -> 不问独立目录。
  5. “开 worktree 做 F123” -> worktree。

---

## 建议测试

```bash
# skill 文档自检
rg -n "Use when|Not for|Output|GOTCHA|worktree|独立项目" <new-skill>/SKILL.md

# 路由压力测试
# 用 5 个示例 prompt 检查是否触发正确流程
```

补充验证：

1. 新 skill 不创建额外 README/辅助文档，只保留必要 `SKILL.md` 和可选 metadata。
2. 新 skill description 不惊吓：不会承诺自动写文件，只承诺路径确认和进入正确工作流。
3. 与 `using-git-worktrees` 的边界双向一致。
4. 如果未来有 hook，可以在写入 `.config/superpowers/worktrees/*/sections/ui/pages/<new-project>` 这类高风险路径前提示确认。

---

## 修复记录

2026-06-10：

- 新增全局 Codex skill：`/home/yunyi/.codex/skills/standalone-project-intake/SKILL.md`。
  - 触发范围覆盖独立 project / website / app / game / demo / MVP / prototype / tool / system。
  - 明确硬门禁：用户确认项目目录前，不执行 `mkdir`、脚手架、依赖安装、文件写入或 dev server 启动。
  - 默认建议 `/home/yunyi/Desktop/Bytedance_cmp/<project-slug>/`，并禁止默认落到 `~/.config/superpowers/worktrees/`、现有 repo 的 `.worktrees/`、`worktrees/` 或 `sections/`。
  - 增加路径存在/空目录/非空目录三种确认话术和 9 个路由示例。
- 新增 skill UI metadata：`/home/yunyi/.codex/skills/standalone-project-intake/agents/openai.yaml`。
- 更新 `/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md`：
  - description 增加独立项目 Not for 边界。
  - 新增 `Step -1: Reject Different-Project Requests`。
  - Quick Reference / Common Mistakes / Red Flags 增加 `standalone-project-intake` 路由规则。

---

## 测试结果

验证命令：

```bash
python /home/yunyi/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /home/yunyi/.codex/skills/standalone-project-intake
# Skill is valid!
```

```bash
rg -n "standalone-project-intake|visible working folder|Hard gate|/home/yunyi/Desktop/Bytedance_cmp|\\.config/superpowers/worktrees|git worktree|Not for|different product|Different product" \
  /home/yunyi/.codex/skills/standalone-project-intake/SKILL.md \
  /home/yunyi/.codex/skills/standalone-project-intake/agents/openai.yaml \
  /home/yunyi/.codex/skills/using-git-worktrees/SKILL.md
# 命中 standalone skill 的 hard gate、默认路径、禁止 worktree 路径，以及 using-git-worktrees 的 Not for / Red Flags 边界。
```

浏览器烟测：

```bash
# Playwright 打开 http://localhost:5173/#/pages/agents/index
# 覆盖 desktop 1440x900 与 mobile 375x844
# 两个 viewport 均 hasVisibleContent=true、noHorizontalOverflow=true、requestFailures=[]
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-030-20260610023659/
```

证据文件：

- `skill-path-check.log`
- `rule-scan.log`
- `desktop-1440x900-main-ui-smoke.png`
- `mobile-375x844-main-ui-smoke.png`
- `browser-console.json`
- `result.json`

---

## 关闭备注

已按 Plan First 计划完成。该 issue 的实际修复落在全局 Codex skills 目录；`seedcmp` 内提交保留 issue 文档和验收证据。后续独立项目创建请求应先触发 `standalone-project-intake`，除非用户明确要求集成到当前 repo / branch / worktree。

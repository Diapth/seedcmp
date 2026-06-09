# ISSUE-030 独立项目目录确认 skill 实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-030_standalone_project_should_ask_workspace_folder_not_worktree.md`
**Goal**：新增并启用 `standalone-project-intake` skill，确保独立网页/app/MVP/工具创建前先确认用户可见工作目录，不默认进入 repo worktree。
**AI修复模式**：Plan First
**前端验证**：No，主要是 skill 文档与路由规则验证。
**非目标**：不改变本次 issue 修复任务的 worktree 策略；不修改当前 repo 业务代码。

---

## 现象与根因

当前流程容易把“做一个独立项目”误判为“当前 repo feature work”，从而套用 `using-git-worktrees`。缺失的是脚手架前的项目归属判断和路径确认规则。

## 受影响模块

- Create: `/home/yunyi/.codex/skills/standalone-project-intake/SKILL.md`
- Modify: `/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md`
- Optionally create: `/home/yunyi/.codex/skills/standalone-project-intake/examples.md`
- Issue evidence: `sections/ui/.ai/tests/ISSUE-030-<timestamp>/`

参考：

- `/home/yunyi/.codex/skills/skill-creator/SKILL.md`
- `/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md`
- `sections/ui/.ai/issues/ISSUE-030_standalone_project_should_ask_workspace_folder_not_worktree.md`

## 推荐设计

新增 skill 负责四步路由：

1. 分类：`standalone_project` / `existing_repo_feature` / `existing_repo_bugfix` / `single_file_artifact`。
2. 若是独立项目且路径未确认，只问一次短问题。
3. 默认目录为当前工作文件夹下的新 slug，例如 `/home/yunyi/Desktop/Bytedance_cmp/<project-slug>/`。
4. 用户确认前禁止 `mkdir`、脚手架、安装依赖和启动 dev server。

同步给 `using-git-worktrees` 增加 `Not for` 边界：独立网站/app/game/demo/MVP 不默认用 worktree。

## 阶段计划

### Phase 1：写 skill 与边界补丁

**Files**

- Create: `/home/yunyi/.codex/skills/standalone-project-intake/SKILL.md`
- Modify: `/home/yunyi/.codex/skills/using-git-worktrees/SKILL.md`

**Steps**

1. 读取 `skill-creator` 当前规范。
2. 写入 `standalone-project-intake`：
   - description / triggers / Not for
   - 默认路径规则
   - 路径冲突处理
   - 标准询问话术
   - 禁止副作用门禁
   - prompt 路由示例表
3. 给 `using-git-worktrees` 增加：
   - 独立项目 Not for
   - 创建 worktree 前先检查 standalone project 的 Red Flag

**阶段提交示例**：`新增独立项目目录确认技能`

### Phase 2：验证 skill 可发现与规则完整

**Verification**

```bash
test -f /home/yunyi/.codex/skills/standalone-project-intake/SKILL.md
rg -n "standalone-project-intake|Not for|worktree" /home/yunyi/.codex/skills/standalone-project-intake/SKILL.md /home/yunyi/.codex/skills/using-git-worktrees/SKILL.md
```

保存证据到：

```text
sections/ui/.ai/tests/ISSUE-030-<timestamp>/
```

包含：

- `skill-path-check.log`
- `rule-scan.log`
- `result.json`

### Phase 3：issue 更新与提交

1. 更新 ISSUE-030 状态、修复摘要、验证命令和证据路径。
2. 中文 commit：

```text
规范独立项目创建目录确认流程
```

## 风险与回滚

- skill 文件在用户全局 Codex 配置下，修改前后必须保留原有 `using-git-worktrees` 现有 repo feature work 能力。
- 回滚只需移除新 skill 并撤销 `using-git-worktrees` 边界补丁。

## Done

- `standalone-project-intake` 可被技能列表发现。
- `using-git-worktrees` 明确排除独立项目默认入口。
- ISSUE-030 文档状态更新为 `Resolved` 并含证据路径。

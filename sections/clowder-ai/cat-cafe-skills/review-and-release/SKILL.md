---
name: review-and-release
description: >
  代码完成后的 review、反馈处理、PR/merge 和发布收尾流程。
  Use when: 自检通过后要请求 review、收到 review 反馈、PR 已批准、CI 通过、或准备合入发布。
  Not for: 开发前计划、调试定位、未完成代码的日常讨论。
  Output: review 请求/反馈处理记录/合入检查结果，附验证证据。
---

# Review And Release

## Why This Is a Skill

AgentHub 课题需要保留 AI 协作开发记录，但不需要三套分开的 review/merge 大流程。
这个 skill 合并旧的 `request-review`、`receive-review`、`merge-gate`，只留下答辩和协作真正需要的证据链。

## When to Use

Use this when:
- `quality-gate` 已通过，需要请另一个 Agent/同伴 review。
- 收到 reviewer 的 P1/P2、评论或 CI 结果。
- PR 已批准，需要做合入前检查、push 或 merge。

Not for:
- 代码还没完成，先回到 `tdd` 或 `debugging`。
- 只是自己检查完成度，使用 `quality-gate`。
- 多 Agent 工作交接，使用 `multi-agent-collaboration`。

## Flow

1. Request: 发 review 请求，包含目标、改动摘要、风险点、验证命令和需要重点看的文件。
2. Respond: 收到反馈后逐条分类：must-fix / discuss / no-change-with-reason。
3. Verify: 每次修复后重新运行对应测试或检查，贴出命令和结果。
4. Release: 合入前确认工作树干净、目标分支最新、测试证据新鲜。
5. Record: 在 PR、issue 或交付说明里留下 review 与验证摘要。

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| 没有验证就说已修 | 破坏信任 | 每项反馈必须配命令或证据 |
| reviewer 提问就机械照改 | 改坏已工作的路径 | 先复现或论证，再决定改法 |
| 合入时还带脏工作树 | 混入无关改动 | 合入前跑 `git status --short` |

## Next

- 反馈需要代码改动时回到 `tdd` 或 `debugging`。
- 合入后回到 `feat-lifecycle` 做完成记录。

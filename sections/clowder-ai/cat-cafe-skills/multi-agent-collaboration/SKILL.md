---
name: multi-agent-collaboration
description: >
  多 Agent / 多 thread 协作的轻量协议。
  Use when: 需要交接任务、通知并行 session、协调共享文件争用、或把一个大任务拆给多个 Agent/thread。
  Not for: 单人可直接完成的小任务、纯代码实现、普通 review 发布流程。
  Output: 协作消息或拆分计划，包含 What / Why / Tradeoff / Open / Next。
---

# Multi-Agent Collaboration

## Why This Is a Skill

AgentHub 的目标是 IM 式多 Agent 协作。这个 skill 保留协作所需的最小协议，替代旧的
`cross-cat-handoff`、`cross-thread-sync`、`thread-orchestration` 三个重流程。

## When to Use

Use this when:
- 需要把上下文交给另一个 Agent 或 thread。
- 多个 session 可能同时改同一批文件，需要先声明范围。
- 一个目标能拆成 2 个以上独立交付项，需要并行推进。

Not for:
- 当前 Agent 一轮能完成的普通实现任务。
- 只是在代码完成后请求 review，使用 `review-and-release`。
- 没有共享状态或交付边界的头脑风暴，使用 `collaborative-thinking`。

## Protocol

任何跨 Agent / thread 消息都用五件套：

1. What: 现在的状态和已完成内容。
2. Why: 为什么要交接、通知或拆分。
3. Tradeoff: 已选择方案和放弃方案。
4. Open: 尚未解决的问题或风险。
5. Next: 接收方下一步动作，写成可执行句子。

拆分任务时，每个子任务还要写清：
- Owner: 负责 Agent / thread。
- Files: 可能触碰的文件范围。
- Done: 完成证据。
- Join: 回到主 thread 时交付什么。

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| 只说“你接着做” | 接手方不知道目标和边界 | 必须写五件套 |
| 多 thread 同改同一文件不声明 | 后面 merge 冲突或互相覆盖 | 先写 Files 和争用处理 |
| 把单人任务拆太碎 | 沟通成本高于收益 | 少于 2 个独立交付项就不要拆 |

## Next

- 拆分后进入 `writing-plans` 或 `tdd`。
- 完成后进入 `quality-gate`。

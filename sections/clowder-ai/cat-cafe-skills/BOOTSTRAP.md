# Cat Cafe Skills Bootstrap

<EXTREMELY_IMPORTANT>
你已加载 Cat Cafe Skills。路由规则定义在 `cat-cafe-skills/manifest.yaml`。

## Skills 列表（13 个）

### AgentHub 目标链路

```
feat-lifecycle → collaborative-thinking → writing-plans → tdd/debugging
    → quality-gate → review-and-release → feat-lifecycle(完成)
```

| Skill | 触发场景 | 说明 |
|-------|----------|------|
| `feat-lifecycle` | 新功能立项/讨论/完成 | 保留功能真相源 |
| `collaborative-thinking` | brainstorm/多 Agent 讨论/收敛 | 保留决策过程 |
| `writing-plans` | 写实施计划 | 把需求拆成步骤 |
| `tdd` | 写测试+实现 | 红绿重构 |
| `debugging` | bug/报错/测试失败 | 根因定位 |
| `quality-gate` | 完成前自检 | target/spec + 验证证据 |
| `review-and-release` | review/反馈/PR/merge | 合并 request-review/receive-review/merge-gate |
| `multi-agent-collaboration` | 交接/跨 thread/任务拆分 | 合并 cross-cat/cross-thread/thread orchestration |
| `deep-research` | 多源技术调研 | 有证据的设计判断 |
| `browser-preview` | localhost 前端预览 | 看 AgentHub UI 效果 |
| `design-assets` | 图片/设计稿/富媒体/截图 | 合并 image/pencil/rich messaging |
| `video-forge` | 3 分钟 Demo 视频 | target 明确交付物 |
| `writing-skills` | 新增/修改 skill | 维护本目录时使用 |

## 已移除或合并

- 合并到 `review-and-release`: `request-review`, `receive-review`, `merge-gate`
- 合并到 `multi-agent-collaboration`: `cross-cat-handoff`, `cross-thread-sync`, `thread-orchestration`
- 合并到 `design-assets`: `image-generation`, `pencil-design`, `rich-messaging`
- 删除为非 AgentHub target 核心: `guide-authoring`, `guide-interaction`, `memory-navigation`, `memory-search-best-practices`, `expert-panel`, `open-source-teardown`, `workspace-navigator`, `browser-automation`, `console-dev`, `self-evolution`

## 关键规则

1. Skill 适用就加载，别靠记忆硬猜。
2. target.md 是范围锚点：IM 多 Agent Demo、协作记录、产品/技术文档、可运行 Demo、3 分钟视频。
3. 声称完成前必须有新鲜验证证据。
4. 跨 Agent 协作用五件套：What / Why / Tradeoff / Open / Next。
5. Review 和发布统一走 `review-and-release`。

## 新增/修改 skill

1. 在 `cat-cafe-skills/{name}/` 创建或修改 `SKILL.md`
2. 更新 `manifest.yaml`
3. 运行 `pnpm check:skills:manifest`
4. 需要同步挂载时运行 `pnpm sync:skills`

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
</EXTREMELY_IMPORTANT>

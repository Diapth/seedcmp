---
name: design-assets
description: >
  AgentHub Demo 的视觉资产、设计稿、截图、富媒体卡片和展示素材处理。
  Use when: 需要 UI 参考图、头像/图片资产、设计稿、截图对比、富媒体卡片、Demo 展示素材。
  Not for: 纯文字回复、后端 API 开发、正式视频剪辑。
  Output: 可复用资产或富媒体展示，附保存路径和用途说明。
---

# Design Assets

## Why This Is a Skill

target.md 重视聊天 UI、产物预览和 Demo 质量，但不需要把图片生成、Pencil 设计和富媒体发送拆成三套流程。
这个 skill 合并旧的 `image-generation`、`pencil-design`、`rich-messaging`。

## When to Use

Use this when:
- 需要为 AgentHub 页面、Agent 头像、Demo 或文档准备图片/截图。
- 需要做 UI 设计对照、简单 wireframe 或实现截图验证。
- 聊天流需要展示卡片、diff、checklist、media gallery、audio 或 html widget。

Not for:
- 纯文字技术说明，直接回复。
- 本地页面运行验证，使用 `browser-preview`。
- 3 分钟 Demo 视频成片，使用 `video-forge`。

## Rules

- 资产要落到明确目录：`assets/`、`docs/`、`feature-discussions/` 或临时证据目录。
- 富媒体先写 1-2 句自然语言摘要，再附结构化 block。
- 截图/设计对比必须说明：目标页面、viewport、截图路径、发现的问题。
- 不为了装饰生成大图；资产要服务 target.md 的聊天体验、产物预览或答辩 Demo。

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| 生成图片但不说明用途 | 仓库多垃圾素材 | 写清用途和归档路径 |
| 小信息也做复杂卡片 | 聊天流变重 | 一两句话能说清就纯文本 |
| 只看设计稿不看真实页面 | Demo 现场翻车 | 需要页面效果时配合 `browser-preview` |

## Next

- 页面实现后进入 `browser-preview` 验证。
- Demo 视频素材齐备后进入 `video-forge`。

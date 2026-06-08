# sections/ui Issue 验收计划

**日期**：2026-06-08  
**目标**：验收 `sections/ui/.ai/issues` 中 IM 原生发送、Clowder 流式 Markdown、时间显示、智能体/群聊/文件回复相关修复。

## 自动化命令

1. `npm run test:native-im`
2. `npm run build:h5`
3. `npm run test:smoke`

## AI 修复模式

每个 issue 顶部必须标注 `AI修复模式`：

- `Direct Fix`：适用于单点 UI、页面跳转、局部状态、文案/样式、空值保护等问题。AI 可以直接根据 issue 修复，但仍要补充必要测试/截图验证。
- `Plan First`：适用于跨 store/service/API/后端、多账号同步、文件收发、智能体运行时、真实流式链路、多个子问题合并的问题。AI 必须先在 `sections/ui/.ai/plans/` 写计划，计划确认后再动代码。

`Plan First` 计划至少包含：

- 目标与非目标。
- 预计修改文件。
- TDD/回归测试步骤。
- Playwright/浏览器截图验收步骤。
- 截图输出目录，必须是 `seedcmp/sections/ui/.ai/tests/`。
- 分阶段中文 commit 列表。

## 阶段性提交

AI 每完成一个可验证的阶段性工作，必须提交一次中文 commit。不要把多个无关阶段堆成一个大提交。

推荐 commit 格式：

- `计划：梳理 ISSUE-019 群文件上传修复步骤`
- `测试：补充群文件接收方可见回归`
- `修复：群文件消息同步到接收方`
- `验证：记录 ISSUE-019 浏览器验收截图`

阶段性提交前必须完成该阶段对应的最小验证；如果验证受阻，要在 issue 的测试结果中写明阻塞原因和已完成的替代检查。

## 浏览器验收

目标地址：`http://localhost:5173/`

Web 测试端口固定为 `5173`。如果 `5173` 被占用，先停止旧的 `sections/ui`/Vite 进程或重启 `scripts/start-im-clowder.sh` 做端口清理；不要把 Playwright、人工验收或 `H5_BASE_URL` 临时改到 `5174`、`5175` 等自动递增端口。

截图输出目录：`seedcmp/sections/ui/.ai/tests/`

AI/Playwright 验收必须把截图、trace 截图和人工复核截图写入上述目录；建议按 issue 或验收批次建立子目录，例如 `seedcmp/sections/ui/.ai/tests/ISSUE-019-group-file-upload-YYYYMMDDHHmmss/`。不要写入 `/tmp` 或 `seedcmp/sections/ui/.ai/tests-e2e`。

视口：
- 375x844
- 768x1024
- 1024x768
- 1440x900

检查项：
- 5 秒内可识别当前模块、当前会话、消息输入入口和下一步动作。
- 聊天页消息列表展示时间分割，秒级/毫秒级时间不显示 1970 年。
- 文本、图片、文件、语音发送入口可见，发送按钮空输入禁用。
- Markdown/Clowder 回复能以表格、代码块和链接样式渲染。
- 空系统标记不显示为 `[系统消息]`；进群、退群、移除成员和群公告修改显示具体系统通知。
- 智能体页可新建智能体，新建后进入直聊。
- 群成员添加弹窗包含可添加智能体，添加后可作为 `@` 候选。
- 文件消息以文件卡片展示，可进入预览。

## 问题处理规则

- 若自动化命令失败：先修复失败，再重新跑完整命令。
- 若浏览器验收发现新问题：在 `sections/ui/.ai/issues/` 新增 issue，记录复现步骤、预期/实际、影响文件和验证建议。
- 关闭 issue 前必须写入修复记录和测试结果。

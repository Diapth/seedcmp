# [ISSUE-043] 智能体消息重复且 PM 未遵守派活约束

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug, regression, clowder, ui
**AI修复模式**：Direct Fix
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- Direct Fix 必须使用 TDD：先补/确认失败回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 Playwright 实测。
- 测试截图和日志保存到 `.ai/tests/<issue-id>-<timestamp>/`。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户在 PM/协调者直聊中看到同一轮智能体输出重复出现；同时 PM/协调者直接产出具体任务内容，没有遵守“不能自己干活，只负责派活、传递任务、接收返回并汇总”的硬约束。

截图现象：
- 会话中同一份“快慢指针 PPT 课程汇报 — 需求拆解”内容出现两次。
- 回复尾部出现 `[luoluo/Claude…]`，说明该 PM 自己调用 Claude 直接执行了内容生成/需求拆解，而不是先安排架构/QA/前端等其他智能体处理。

---

## 期望行为

1. 同一 Clowder 回复在 WebSocket 推送、历史同步、流式 placeholder/final 之间只能显示一条。
2. PM/协调者 runtime prompt 必须带上模板硬约束：不默认亲自写代码、生成内容或执行任务；优先拆解、派发给合适智能体，等待返回后汇总。
3. 创建 PM/协调者时，后端 payload 必须把 cat-template 中的 `restrictions` 合并到 Clowder 创建请求，不能只传 role/personality/teamStrengths。
4. 浏览器桌面和移动端核心聊天路径无重复消息、无明显错位。

---

## 根因分析

1. UI 消息合并只按 `message_id` / `client_msg_no` / 自己发送 echo 合并；Clowder durable 回复如果经由 WebSocket 与历史同步落成两条不同 ID、相同 sender/content 的消息，会被追加成重复气泡。
2. TangSeng Clowder 创建智能体链路没有根据 `roleTemplateId` 回查 `/api/cat-templates`，因此创建 PM/协调者时没有把模板中的 `restrictions` 传给 Clowder `/api/cats`。
3. TangSeng 目录代理没有把模板 `restrictions` 透出给 UI，浏览器侧无法确认协调者模板的硬约束。
4. Clowder 协调者系统提示仍使用“默认少直接执行”的软约束，不能稳定阻止 PM 自己生成内容或跳过执行猫返回。
5. “显性 PM 协调者工作流”只按内置 `catId=coordinator` 注入；用户通过角色模板创建的运行时 PM（例如 `pm`）虽然拿到 restrictions，但缺少完整派活/汇总工作流提示。

## 修复记录

1. `sections/ui/services/native-im/message-state.js`
   - 为 Clowder 会话新增 durable 回复等价合并：非自己发送、Clowder sender、文本内容相同、时间在 10 分钟窗口内时更新原消息而不是追加。
   - 保留原有 stream placeholder/final、自发送 echo、普通消息合并规则。
2. `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
   - `catTemplate` / `ClowderCatTemplate` 增加 `restrictions`。
   - 创建智能体时按 `roleTemplateId` 匹配模板，并把 `roleDescription`、`personality`、`teamStrengths`、`avatar`、`nickname`、`restrictions` 合并进 Clowder 创建 payload。
3. `sections/clowder-ai/cat-template.json`
   - 强化“暹罗猫（协调者）”限制：禁止默认亲自写代码、改文件、执行测试、生成内容或独立完成具体任务；必须派发给合适执行猫；禁止跳过执行猫返回直接最终交付。
4. `sections/clowder-ai/packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
   - 将协调者工作流改为硬约束表述：先拆任务再交给执行猫，收到执行猫返回前不得编造最终交付。
   - 将协调者工作流注入条件扩展到角色/限制明确为 PM 协调者的运行时猫，避免用户新建 PM 缺少派活工作流。
5. 回归测试
   - UI 单测覆盖不同 ID 的重复 Clowder durable 回复只保留一条。
   - Go 测试覆盖模板 restrictions 目录透传与 PM 创建 payload。
   - Clowder prompt 目标测试覆盖内置协调者和用户创建 PM 均包含硬限制与派活工作流。
   - Playwright 桌面/移动端覆盖聊天气泡只渲染一次，并校验 API 返回协调者 restrictions。

## 测试结果

证据目录：`sections/ui/.ai/tests/ISSUE-043-20260610200525/`

已通过命令：
- `cd sections/ui && node .ai/tests/ISSUE-043-20260610200525/verify-duplicate-and-pm.mjs`
- `cd sections/ui && npm run test:native-im`
- `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder -count=1`
- `cd sections/clowder-ai/packages/api && pnpm run build`
- `cd sections/clowder-ai/packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-name-pattern="coordinator self identity forbids" test/system-prompt-builder.test.js`
- `cd sections/ui && npm run build:h5`

关键证据：
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/result.json`：Playwright 桌面/移动端 `pass: true`。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/desktop-01-dedupe-chat.png`：桌面端正文只显示一条智能体消息，侧栏仅为会话预览。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/mobile-01-dedupe-chat.png`：移动端正文只显示一条智能体消息，输入区无遮挡。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/npm-test-native-im.log`：98 个 native IM 测试通过。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/go-test-clowder.log`：`go test ./modules/clowder -count=1` 通过。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/clowder-runtime-pm-workflow-red.log`：运行时 PM 缺少协调者工作流的红灯复现。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/clowder-system-prompt-target.log`：内置协调者与运行时 PM 硬约束目标测试通过。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/pnpm-build-clowder-api.log`：Clowder API build 通过。
- `sections/ui/.ai/tests/ISSUE-043-20260610200525/npm-build-h5.log`：H5 build 通过。

---

## 关闭备注

已确认桌面与移动端聊天核心路径不再重复渲染同一条 Clowder 回复；PM/协调者模板、创建 payload、目录透传与 runtime prompt 均携带“只协调派活、等待执行猫返回后汇总”的硬约束，且用户创建的运行时 PM 也会注入协调者派活工作流。

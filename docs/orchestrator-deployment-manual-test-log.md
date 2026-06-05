# Orchestrator and Deployment Manual Test Log

This file records the required real Web checks for the orchestrator and P2 deployment release plan.

## Environment

- Web entry: http://127.0.0.1:3000
- Primary login: 008618337488675 / 123456
- Backup login: 008613800138000 / 123456
- Verification date:
- Operator:

## Stage Template

### Stage N

- Login user:
- OAuth platform: Claude Code / Codex
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type: direct / group
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt:
- Screenshot paths:
- Result: passed / failed / partial
- Failure reason:
- Notes:

## Stage Records

### Stage 0

- Login user:
- OAuth platform:
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type:
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt: 请回复“阶段0验收通过”，并说明你当前使用的运行平台。
- Screenshot paths:
- Result:
- Failure reason:
- Notes:

### Stage 1

- Login user: 18337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: xtz
- Cat alias: @xtz
- Conversation type: group
- Group chat ID: 16e006b0b84f40faaa77a271e69b5021
- Thread ID: thread_mq1afgliuch3zzzg
- Coordination ID: coord_b9508358-ff94-4b99-bd91-6de5182b5eaf
- Deployment request ID:
- Prompt: @xtz 阶段1修复验收：请把“做一个咖啡店首页并准备部署”的需求拆成任务，不要直接写代码，先给出分工。
- Screenshot paths: docs/manual-test-artifacts/stage1-fix-panel-before.png; docs/manual-test-artifacts/stage1-fix-prompt-sent.png; docs/manual-test-artifacts/stage1-fix-final-reply.png
- Result: passed
- Failure reason:
- Notes: Local configured coordinator-style cat is xtz rather than @claude-orch. Backend persisted a planning coordination with three initial subtasks and Web chat showed a real Clowder reply, not DeepSeek fallback.

### Stage 2

- Login user: 18337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: xtz
- Cat alias: @xtz
- Conversation type: group
- Group chat ID: 16e006b0b84f40faaa77a271e69b5021
- Thread ID: thread_mq1afgliuch3zzzg
- Coordination ID: coord_4b74a2d9-b045-465d-8d26-6bb4e73ff20f
- Deployment request ID:
- Prompt: @xtz 阶段2真实派发验收：这次不要只给计划。请立即调用 cat_cafe_multi_mention 工具唤起 dd 和 cs，targets 必须是 ["dd","cs"]，callbackTo 是 xtz。question 请写：dd 负责给出最小餐厅落地页 HTML 实现方案，cs 负责检查可访问性和部署风险。等至少一个目标猫回复后，请输出 Coordinator / Multi-Mention 汇总。
- Screenshot paths: docs/manual-test-artifacts/stage2-dispatch-group-open.png; docs/manual-test-artifacts/stage2-dispatch-prompt-sent.png; docs/manual-test-artifacts/stage2-dispatch-first-reply.png; docs/manual-test-artifacts/stage2-dispatch-final-aggregate.png; docs/manual-test-artifacts/stage2-dispatch-panel.png
- Result: passed
- Failure reason:
- Notes: Local configured coordinator-style cat is xtz rather than @协调者/@claude-dev. The real Web prompt triggered multi-mention request b0fceb46-9ddf-437a-9f51-c710e21dc2f8, created real dd and cs invocations, delivered both sub-agent replies, and persisted a succeeded coordination aggregate. Chat and screenshots showed no DeepSeek fallback.

### Stage 3

- Login user: 18337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: xtz coordinator with dd/cs target cats
- Cat alias: @xtz; prompt also included @协调者
- Conversation type: group
- Group chat ID: 16e006b0b84f40faaa77a271e69b5021
- Thread ID: thread_mq1afgliuch3zzzg
- Coordination ID: coord_e2bfd0fd-0329-4d60-ad87-d19f77a308c4
- Deployment request ID:
- Prompt: /status; @协调者 @xtz 阶段3真实面板验收：继续上一轮任务，补充移动端注意事项并重新汇总。这次不要写代码；请立即调用 cat_cafe_multi_mention 工具唤起 dd 和 cs，targets 必须是 ["dd","cs"]，callbackTo 是 xtz。question 请写：dd 补充移动端版式和交互注意事项，cs 检查移动端可访问性和质量风险。等至少一个目标猫回复后，请输出 Coordinator / Multi-Mention 结果汇总。
- Screenshot paths: docs/manual-test-artifacts/stage3-group-open.png; docs/manual-test-artifacts/stage3-command-menu.png; docs/manual-test-artifacts/stage3-status-sent.png; docs/manual-test-artifacts/stage3-prompt-sent.png; docs/manual-test-artifacts/stage3-summary-card.png; docs/manual-test-artifacts/stage3-coordination-tab.png; docs/manual-test-artifacts/stage3-subtask-locate.png; docs/manual-test-artifacts/stage3-mobile-panel.png
- Result: passed
- Failure reason:
- Notes: Final committed code was restarted before validation. The first Stage 3 trial included "部署风险" and was intentionally discarded because it triggered the deployment confirmation path; the logged prompt above was the real accepted orchestrator run. Backend created multi-mention request 2c8bc3ea-e8c5-40ac-97cb-7baa506d6f0f and real dd/cs invocations a72afed0-7b60-4294-954e-3a3112ebeae7 / 41ac67ea-d9a4-4c40-8bbc-aea428773419. The persisted coordination succeeded with targetCatIds xtz/dd/cs; dd and cs multi-mention subtasks were done. Web showed the coordinator summary card with retry/cancel actions, the new "协调任务" panel tab, clickable subtask locate behavior, and no DeepSeek fallback. Mobile check at 390x844 measured right dock bottom 608 and input top 644, so the panel did not cover the composer.

### Stage 4

- Login user:
- OAuth platform:
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type: direct
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt: 请在当前项目工作区生成一个最小 HTML 页面，标题为“部署阶段4验收”，并声明为可部署产物。部署这个页面到 preview 环境。
- Screenshot paths:
- Result:
- Failure reason:
- Notes:

### Stage 5

- Login user:
- OAuth platform:
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type: group
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt: @协调者 请让 Claude 或 Codex 生成一个单文件活动页，然后部署到 preview 环境，部署完成后给我预览链接和源码下载链接。
- Screenshot paths:
- Result:
- Failure reason:
- Notes:

### Stage 6

- Login user:
- OAuth platform:
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type: group
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt: @协调者 请协调团队做一个“AgentHub 咖啡店活动页”静态页面，要求 Claude/Codex 至少一个真实执行，完成后部署到 preview 环境，最后在聊天里给我预览链接、源码下载链接、执行分工和风险说明。
- Screenshot paths:
- Result:
- Failure reason:
- Notes:

### Stage 7

- Login user:
- OAuth platform:
- OAuth status:
- Cat name:
- Cat alias:
- Conversation type: group
- Group chat ID:
- Thread ID:
- Coordination ID:
- Deployment request ID:
- Prompt:
- Screenshot paths:
- Result:
- Failure reason:
- Notes:

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

- Login user: 18337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: dd for real cat file-generation task; qwg/codex direct chat for final deployment card
- Cat alias: @dd; @codex
- Conversation type: direct
- Group chat ID:
- Thread ID: direct Clowder thread not displayed in the deployment card run
- Coordination ID:
- Deployment request ID: deploy_a5e4cd7e-c18e-409d-a5b7-5652917fa3ad; deploy_dc5fd1bb-1060-41db-b5e5-4a023a24979d
- Prompt: dd file-generation prompt: 阶段4页面文件生成检查：请创建最小 HTML 文件，保存到 /home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/clowder-ai/packages/api/data/stage4-cat-generated/index.html；页面 title 使用“部 署 阶 段 4 验 收”（写入时去掉空格）。完成后只回复保存路径。 Deployment prompt: 部署 packages/api/data/stage4-cat-generated/index.html 到 preview 环境。
- Screenshot paths: docs/manual-test-artifacts/stage4-cat-generate-file-sent.png; docs/manual-test-artifacts/stage4-cat-generate-file-after-wait.png; docs/manual-test-artifacts/stage4-codex-direct-open.png; docs/manual-test-artifacts/stage4-codex-relative-target-fields.png; docs/manual-test-artifacts/stage4-codex-relative-deploy-succeeded.png; docs/manual-test-artifacts/stage4-codex-title-preview-open.png; docs/manual-test-artifacts/stage4-card-succeeded.png; docs/manual-test-artifacts/stage4-preview-open.png
- Result: passed
- Failure reason:
- Notes: Restarted stack after code commit before validation. Initial prompt containing contiguous deployment wording was intentionally discarded because IM Web correctly opened a deployment card instead of routing it to the cat. A neutral dd prompt then produced the cat-generated file `packages/api/data/stage4-cat-generated/index.html` with title `部署阶段4验收`; dd reply badges increased from 5 to 7 during that run. The cat-generated file had an empty body, so the final cat-generated deployment `deploy_dc5fd1bb-1060-41db-b5e5-4a023a24979d` was verified by document title, download HTTP 200, and TangSeng bridge detail/log routes returning 200. The visible-body preview path was also verified through deployment `deploy_a5e4cd7e-c18e-409d-a5b7-5652917fa3ad`, whose preview URL opened and showed `部署阶段4验收` in the page body. Final backend job logs for both successful runs included queued, executor started, target resolved, static preview generated, source package generated, and job succeeded.

### Stage 5

- Login user: 008618337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: xtz coordinator with dd/cs group cats available
- Cat alias: @xtz; prompt used @协调者
- Conversation type: group
- Group chat ID: 16e006b0b84f40faaa77a271e69b5021
- Thread ID: thread_mq1afgliuch3zzzg
- Coordination ID:
- Deployment request ID: deploy_e2f50959-43df-4196-abc2-dda720e306ae
- Prompt: @协调者 请让 Claude 或 Codex 生成一个单文件活动页，然后部署到 preview 环境，部署完成后给我预览链接和源码下载链接。
- Screenshot paths: docs/manual-test-artifacts/stage5/stage5-after-race-fix-open-group.png; docs/manual-test-artifacts/stage5/stage5-race-fix-before-target.png; docs/manual-test-artifacts/stage5/stage5-race-fix-target-enabled.png; docs/manual-test-artifacts/stage5/stage5-race-fix-terminal.png; docs/manual-test-artifacts/stage5/stage5-preview-iframe-rendered-after-header-fix.png
- Result: passed
- Failure reason:
- Notes: Restarted stack after Stage 5 code fixes before validation. The hydrated deployment card initially reproduced the real browser blocker: target missing while preview environment was already selected. After commit 8941c84, entering `packages/api/qa-test-page.html` updated the target, cleared `missingFields`, and enabled confirmation. Confirming from the chat card queued and completed deployment `deploy_e2f50959-43df-4196-abc2-dda720e306ae`; the card polled to `部署成功` and showed both preview and source download controls. Direct checks returned preview HTTP 200 with rendered HTML and download HTTP 200 with `application/gzip`. The first side-dock preview attempt showed a blank frame because the API added `X-Frame-Options: DENY`; commit 7091edd exempted deployment preview routes from anti-frame headers, and the final Web screenshot shows the deployed page rendered inside the right preview dock.

### Stage 6

- Login user: 008618337488675
- OAuth platform: Codex
- OAuth status: local Codex account available through existing Clowder cat configuration
- Cat name: xtz coordinator with dd group cat available
- Cat alias: @xtz; prompt used @协调者 and @dd
- Conversation type: group
- Group chat ID: 16e006b0b84f40faaa77a271e69b5021
- Thread ID: thread_mq1afgliuch3zzzg
- Coordination ID: coord_9be5eb62-74b9-41ee-9291-5a6913a423f5
- Deployment request ID: deploy_114b1dab-df82-4e78-9b4a-7a313af81261 for manual screenshots; deploy_2ed04740-0ca7-45f8-93e9-62403ba18a89 for final green smoke rerun
- Prompt: @协调者 @xtz @dd 阶段6最终截图复验：请协调团队做一个“AgentHub 咖啡店活动页”静态页面，要求 Claude/Codex 至少一个真实执行，完成后部署到 preview 环境，最后在聊天里给我预览链接、源码下载链接、执行分工和风险说明。
- Screenshot paths: docs/manual-test-artifacts/stage6/stage6-group-open.png; docs/manual-test-artifacts/stage6/stage6-prompt-sent.png; docs/manual-test-artifacts/stage6/stage6-card-created.png; docs/manual-test-artifacts/stage6/stage6-after-timeout-state.png; docs/manual-test-artifacts/stage6/stage6-final-active-card-before-target.png; docs/manual-test-artifacts/stage6/stage6-final-before-confirm.png; docs/manual-test-artifacts/stage6/stage6-final-summary.png; docs/manual-test-artifacts/stage6/stage6-final-preview-iframe.png
- Result: passed
- Failure reason:
- Notes: Restarted stack after Stage 6 code before validation. The first live run sent the required final prompt and produced a deployment card, but the initial browser wait incorrectly expected a new card count and timed out while the Web UI had already hydrated an active needs-fields card. The smoke was hardened to accept either a new deployment card or a reused active card, to honor TEST_AGENT_A/TEST_AGENT_B, and to commit target edits through the explicit `应用` button when needed. Final accepted Web pass used the same Stage 6 demo intent with explicit @xtz/@dd local cats. The chat produced coordinator/cat activity, active deployment request `deploy_114b1dab-df82-4e78-9b4a-7a313af81261`, preview environment, target `packages/api/qa-test-page.html`, and a successful confirm from the deployment card. The card reached `部署成功`, showed preview/download controls, and in-session chat appended exactly one `Coordinator / Deployment 结果汇总` message containing status, target, environment, preview URL, download URL, and risk note. Direct API checks for the final deployment returned preview HTTP 200 with rendered `Interactive QA Surface` content and download HTTP 200 with `application/gzip`; the preview iframe rendered inside the right dock. Source package contained `qa-test-page.html`. After the smoke patch, the opt-in Playwright smoke was rerun with `RUN_V3_CLOWDER_SMOKE=1 TEST_AGENT_A=xtz TEST_AGENT_B=dd TEST_DEPLOYMENT_TARGET=packages/api/qa-test-page.html` and passed, creating successful deployment `deploy_2ed04740-0ca7-45f8-93e9-62403ba18a89`. The earlier Stage 6 agent run also generated `data/agenthub-coffee-event/index.html` and registered `/uploads` artifacts, but final accepted deployment evidence uses the supported `/api/deployments/:id/preview/` route above.

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

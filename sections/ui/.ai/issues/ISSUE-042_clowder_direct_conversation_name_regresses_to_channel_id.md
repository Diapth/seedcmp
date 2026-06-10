# [ISSUE-042] Clowder 直聊会话名退化为 channel id

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug, regression, ui
**AI修复模式**：Direct Fix
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- Direct Fix 必须使用 TDD：先补/确认失败回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 Playwright 实测。
- 测试截图和日志保存到 `.ai/tests/<issue-id>-<timestamp>/`。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户从智能体页进入 Clowder 猫猫直聊后，会话列表、聊天头部和右侧详情面板显示成 `clowder_cat:luoluo` 这类技术 channel id，而不是智能体中文名“暹罗猫（协调者）”。

这会让用户误以为智能体名称又被改坏，且不符合 ISSUE-040/041 中“模板基础信息与会话身份一致”的验收要求。

---

## 期望行为

1. `clowder_cat:*` 只能作为直聊 channel id / direct routing id，不应作为 UI 展示名。
2. 创建或打开 Clowder 直聊时，应优先使用 `displayName` / 中文名；如果 `name` 是 `clowder_cat:*`，必须跳过它。
3. 最近会话同步回来的技术名不能覆盖已有中文显示名。
4. 如果会话已经以技术名进入列表，加载智能体目录后应根据 cat id、alias、mentionPatterns 回填中文名。
5. 桌面和移动端聊天核心路径都应显示中文名。

---

## 根因分析

Clowder 直聊会话的 UI 展示名和 routing id 混在同一条数据流里：

- `createAgentConversation` 创建直聊时优先读 `agent.name`，如果上游/缓存中的 `name` 已经是 `clowder_cat:*`，就会把技术 channel id 当作展示名。
- `shouldPreserveClowderAgentDisplayName` 只判断 existing 是否是 Clowder 会话，没有排除 existing 本身已经是技术名的情况，导致坏名字可能被继续保留。
- `applyClowderAgentDirectoryToConversations` 只按 `catId` 建索引；当直聊 channel 使用 alias/mentionPattern（如 `clowder_cat:luoluo`）而目录主 id 是角色模板 id（如 `coordinator`）时，目录里的中文名无法回填到会话。

## 修复记录

- Clowder 展示名解析新增技术名识别，跳过 `clowder_cat:*`，优先使用 `displayName` / `display_name` / 中文名。
- 会话名保护逻辑不再保留已经退化成 `clowder_cat:*` 的 existing name，避免坏名字固化。
- 智能体目录回填索引扩展到 `id`、`catId`、`directCatId`、`alias`、`aliases`、`mentionPatterns` 以及 raw 字段，支持用 `@luoluo` 回填 `clowder_cat:luoluo` 的中文显示名。
- 保留 routing id：UI 显示“暹罗猫（协调者）”，但 `directCatId` 仍是 `luoluo`，不影响后端直聊路由。

## 测试结果

- TDD 红灯：`npm run test:native-im -- --test-name-pattern="agent helpers create direct conversations"` 初次失败，实际值为 `clowder_cat:luoluo`，期望值为“暹罗猫（协调者）”。
- 目标单测：`npm run test:native-im -- --test-name-pattern="agent helpers create direct conversations"`：通过。
- 完整单测：`cd sections/ui && npm run test:native-im`：97/97 通过，日志见 `.ai/tests/ISSUE-042-20260610195053/npm-test-native-im.log`。
- 构建：`cd sections/ui && npm run build:h5`：通过，日志见 `.ai/tests/ISSUE-042-20260610195053/npm-build-h5.log`。
- Playwright：`node sections/ui/.ai/tests/ISSUE-042-20260610195053/verify-clowder-name.mjs`：通过；桌面 Web viewport 与移动端 viewport 均验证可见 UI 显示“暹罗猫（协调者）”，不可见 `clowder_cat:luoluo`，且 `directCatId` 保持为 `luoluo`。
- 证据文件：
  - `.ai/tests/ISSUE-042-20260610195053/result.json`
  - `.ai/tests/ISSUE-042-20260610195053/browser-console.json`
  - `.ai/tests/ISSUE-042-20260610195053/desktop-01-after-directory.png`
  - `.ai/tests/ISSUE-042-20260610195053/mobile-01-after-directory.png`
  - `.ai/tests/ISSUE-042-20260610195053/playwright-verify.log`

---

## 关闭备注

已验证 Clowder 直聊会话不会再把 `clowder_cat:*` channel id 展示给用户，中文智能体名会在会话列表、聊天头部和右侧详情中保持一致。

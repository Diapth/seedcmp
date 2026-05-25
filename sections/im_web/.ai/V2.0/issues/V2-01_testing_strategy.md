# [V2-01] 测试策略与质量规范规划

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：feature / testing / quality
**优先级**：P0

---

## 问题描述

Constitution v2.0.0 缺少完整的测试规范附录，导致 V2.0 开发过程中：
- 各 Story 的测试深度参差不齐
- 没有统一的测试工具、覆盖率目标
- 难以判断一个 Story 是否"可关闭"
- Realtime 场景缺少可操作的测试指导

本 issue 用于系统性建立 V2.0 测试体系，并记录后续每次测试中发现的缺陷。

---

## 根因分析

Constitution v2.0.0 五项核心原则中，**原则 V（Build, Test, and Review Gates）** 只定义了"要跑测试"，但没有定义：
1. 测试分层模型（单元/集成/E2E 各覆盖什么）
2. 各层测试的工具和覆盖率目标
3. Realtime 场景的专项测试方法
4. 性能基准和 A11y 最低要求
5. 已知缺陷的长期追踪机制

---

## 修复计划

### Phase 1 · Constitution 补全（已完成）

- [x] 在 `constitution.md` 末尾新增 **Appendix A: Testing Specification**
  - A.1 测试分层模型（五层从上到下）
  - A.2 Layer 1 — Build Gate（lint + type-check + unit + build）
  - A.3 Layer 2 — Component Tests（Vitest + Testing Library）
  - A.4 Layer 3 — Store / Unit Tests（fake SDK mock）
  - A.5 Layer 4 — Integration Tests（跨 Store 联动）
  - A.6 Layer 5 — E2E / Smoke Tests（Playwright）
  - A.7 Realtime 专项测试（手动验证清单）
  - A.8 性能基准（Performance Budget）
  - A.9 观测与调试规范（console 日志格式）
  - A.10 离线 / 弱网处理规范（Offline Queue + Optimistic Update）
  - A.11 可访问性（A11y）最低要求
  - A.12 已知 Issue 索引

### Phase 2 · 测试工具验证（已完成）

- [x] 验证项目是否已有 Vitest 配置，若无则初始化
- [x] 验证 Playwright 是否已安装，若无则添加
- [x] 确认 `pnpm test:unit` 和 `pnpm test:e2e` 命令可用
- [x] 本地 Layer 1 Build Gate 已具备 `type-check`、`lint`、`test:unit`、`build`、`test:e2e` 命令；CI pipeline 集成留给仓库级流水线配置

### Phase 3 · 存量缺陷扫描（已完成）

- [x] 对照 v1.0 issues 清单，识别哪些缺陷在 V2.0 中仍然存在
- [x] 将仍存在的缺陷迁移到 V2.0 issues 目录
- [x] 为每个存留缺陷关联对应的测试用例

---

## 测试分层速查表

| Layer | 触发时机 | 工具 | 覆盖率目标 | N/A 规则 |
|---|---|---|---|---|
| L1 Build Gate | 每次 commit / PR | vue-tsc, eslint, vitest | 100% pass | 禁止 N/A |
| L2 Component | 交互组件变更 | Vitest + Testing Library | 关键交互 100% | 需注明原因 |
| L3 Store / Unit | Store / 工具函数变更 | Vitest + fake SDK | ≥ 70% | 需注明原因 |
| L4 Integration | 多模块联动变更 | Vitest | 按需 | 需注明原因 |
| L5 E2E / Smoke | Story close 前 | Playwright | 6 核心用户流 | 手动验证+记录 |

---

## 核心用户流（Layer 5 E2E 场景）

| UC | 场景描述 | 通过标准 |
|---|---|---|
| UC-1 | 登录 → 发送文本消息 → 收到回复 | 消息出现在双方会话中，status=sent |
| UC-2 | 创建群聊 → 邀请成员 → 群内发消息 | 成员列表包含被邀请人，消息可见 |
| UC-3 | 发送图片/文件 → 媒体预览 → 下载 | 预览正常，下载文件完整 |
| UC-4 | 断网 30s → 重连 → 消息完整性 | 重连后消息不丢失，order 正确 |
| UC-5 | 删除聊天 → 确认弹窗 → 确认 | 对话从列表消失，Store 状态同步 |
| UC-6 | 多设备同时在线 → 消息去重 | 各设备展示一致，无重复消息 |

---

## 缺陷追踪索引（Issues）

每次测试中发现的缺陷，都必须记录到以下位置：

```
sections/im_web/.ai/V2.0/issues/
├── TEMPLATE.md              # Issue 模板
├── V2-01_testing_strategy.md  # 本 issue
├── V2-02_xxx.md             # 测试发现的缺陷 #1
├── V2-03_yyy.md             # 测试发现的缺陷 #2
└── imgs/                   # 截图（序号_图序号.png）
```

---

## 测试结果

> Phase 1（Constitution 补全）：✅ 完成
> Phase 2（测试工具验证）：✅ 完成 — 结果见下方"Phase 2 详细报告"
> Phase 3（存量缺陷扫描）：✅ 完成

### 2026-05-24 Phase 1 任务验证记录

| Task | 证据 | 结果 |
|---|---|---|
| T001 | `sections/im_web/package.json` 已提供 `type-check`、`build`、`test:unit`、`test:e2e` 根 workspace 命令 | ✅ Pass |
| T002 | `apps/chat/vitest.config.ts` 使用 `jsdom`、Vue plugin、`tests/**/*.test.ts` / `tests/**/*.spec.ts` include、`tests/setup.ts` | ✅ Pass |
| T003 | `apps/chat/playwright.config.ts` 使用 `tests-e2e`、`TARGET_URL || http://localhost:3000`、本地 `pnpm dev` webServer | ✅ Pass |
| T004 | 根 `.gitignore` 覆盖 `node_modules/`、`dist/`、coverage、Playwright report、test-results、env 和日志产物 | ✅ Pass |
| T005 | 本文件已同步当前工具状态和缺口 | ✅ Pass |

### 2026-05-24 Phase 2 V1.0 回归门禁记录

| Task | 证据 | 结果 |
|---|---|---|
| T006 | 审计 `sections/im_web/.ai/v1.0/issues/`：V1.0 存留回归已迁移为 V2-02 至 V2-08；V1.0 检查脚本路径已适配当前 `.ai/v1.0/checks` 目录结构 | ✅ Pass |
| T007 | `cd sections/im_web && node .ai/v1.0/checks/verify-all-issues.mjs` | ✅ Pass，16/16 passed，0 failed |

#### V1.0 存留风险映射

| V2 issue | V1 来源 | 当前自动化覆盖 |
|---|---|---|
| V2-02 WebSocket 远程连接失败 | `08_websocket_remote_connection_failure.md` | `verify-websocket-route-address.mjs` + `sdkAddress.test.ts` |
| V2-03 群聊离线消息/未读保留 | `10_group_chat_offline_unread_and_retention.md` | `verify-group-chat-retention-state.mjs` + `groupOfflineUnreadRetention.test.ts` |
| V2-04 realtime CMD groupStore 同步 | `12_group_chat_realtime_cmd_synchronization.md` | `verify-issue-12-cmd-group-store-sync.mjs` + `realtimeCmdGroupSync.test.ts` |
| V2-05 联系人与建群状态 | `09_contact_group_creation_and_friend_search_state.md` | `verify-contact-friend-state.mjs` + `contactGroupCreationState.test.ts` |
| V2-06 消息 UI 稳定性 | `03_messages_ui_stability.md` | `verify-message-ui-stability.mjs` + `messageUiStability.test.ts` |
| V2-07 群聊会话排序/设置回归 | `15_group_chat_conversation_order_and_settings_regressions.md` | `verify-issue-15-group-chat-regressions.mjs` + `conversationPresentation.test.ts` |
| V2-08 群主/管理员权限回退 | `16_group_owner_settings_permission_from_member_role.md` | `groupOwnerPermission.test.ts` |

### 2026-05-24 双账号浏览器自动化截图测试

| 项目 | 结果 |
|---|---|
| 账号 | `18337488675`、`13733632709` |
| 报告 | `sections/im_web/.ai/V2.0/issues/tests-e2e/two-account-audit-2026-05-23T18-00-03-819Z/summary.md` |
| 截图 | `sections/im_web/.ai/V2.0/issues/imgs/two-account-audit-2026-05-23T18-00-03-819Z/` |
| 覆盖 | 双账号登录、会话列表、发起群聊入口、添加好友页、群设置抽屉、邀请成员弹窗、刷新保留、双账号发送消息、控制台错误、网络错误 |
| 结果 | ✅ 16 checks passed，0 failed，19 screenshots，0 page errors，0 network errors |

本轮发现并修复了 [V2-09](V2-09_browser_audit_conversation_extra_400.md)：发送消息后无意义空草稿同步触发 `conversation extra` 400。

### 2026-05-24 最终双账号媒体与回归审计

| 项目 | 结果 |
|---|---|
| 账号 | `18337488675`、`13733632709` |
| 报告 | `sections/im_web/.ai/V2.0/issues/tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |
| 截图 | `sections/im_web/.ai/V2.0/issues/imgs/two-account-audit-2026-05-24T05-09-53-941Z/` |
| 覆盖 | 双账号登录、会话列表展示、发起群聊入口、添加好友页、群设置抽屉、邀请成员弹窗、刷新保留、双账号文本发送、双账号图片发送、双账号文件发送、控制台严重错误、网络错误 |
| 结果 | ✅ 22 checks passed，0 failed，25 screenshots，0 page errors，0 network errors |

本轮修复并验证了 [V2-10](V2-10_incomplete_image_and_file_sending.md)：图片与文件入口不再显示“能力正在完善”，而是通过后端 `/file/upload` 上传并发送对应媒体消息。

---

## Phase 2 详细报告

### 环境信息

- Node: v22.22.2
- pnpm: 11.2.2（全局安装，corepack 源不通）
- 工作目录: `sections/im_web`

### L1 Build Gate 测试结果

| 检查项 | 命令 | 结果 | 说明 |
|---|---|---|---|
| TypeScript 类型检查 | `pnpm type-check` | ✅ Pass | 所有 workspace 全部 exit 0 |
| ESLint | `pnpm lint` | ✅ Pass | 0 errors；仍有 10 个既有 unused warning，非阻断 |
| 单元测试 | `pnpm test:unit` | ✅ Pass | 8 files / 23 tests |
| 生产构建 | `pnpm build` | ✅ Pass | chat app 构建成功；仍有已知 chunk size warning |
| E2E | `pnpm test:e2e` | ✅ Pass | 1 Playwright smoke passed |

**Build Gate 总结**：Layer 1 本地门禁已具备并通过；lint warning 和 chunk size warning 均为非阻断后续优化项。

### 现有测试文件分析

- `apps/chat/tests/*.test.ts` 已切换到 Vitest 运行
- `apps/chat/tests-e2e/*.spec.ts` 已切换到 Playwright 运行
- 现有 `conversationPresentation.test.ts` 已纳入 `pnpm test:unit`

### 缺失工具清单（按优先级排序）

| 优先级 | 工具 | 用途 | 现状 |
|---|---|---|---|
| P0 | **Vitest** | 单元/组件/Store 测试 runner | ✅ 已安装 |
| P0 | **@testing-library/vue** | Vue 组件测试 | ✅ 已安装 |
| P0 | **Playwright** | E2E / Smoke 测试 | ✅ 已安装 |
| P1 | **ESLint + eslint-plugin-vue** | 代码质量检查 | ✅ 已安装 |
| P2 | **fake SDK mock** | Store 层隔离测试 | ✅ 已在媒体发送 Store 测试中使用 |

### 已知 Chunk Size Warning

```
dist/assets/index-BQvvyWGb.js  1,413.97 kB │ gzip: 508.44 kB
(!) Some chunks are larger than 500 kB after minification.
```

`index.js` 超过 1.4MB（gzip 后 508KB），超过 Constitution A.8 性能基准中"应避免 > 500KB chunk"的建议。后续需通过 `manualChunks` 分割。

### pnpm 环境说明

- `corepack pnpm` 因网络原因无法从 npmjs.org 下载 pnpm 版本，故用 `npm install -g pnpm` 替代
- CI/CD 环境中若 corepack 不可用，需提前安装 pnpm 或配置 npm registry mirror

---

## Phase 3 详细报告：存量缺陷迁移（已完成 ✅）

已从 v1.0 issues 迁移 7 个缺陷，并在 E2E 审计中发现 2 个新问题，统一纳入 V2.0 issues 目录进行追踪：

| 新编号 | 来源 | 标题 | 优先级 |
|---|---|---|---|
| [V2-02](V2-02_websocket_remote_connection.md) | ISSUE-08 | WebSocket 远程连接失败 | P0 |
| [V2-03](V2-03_group_offline_unread_retention.md) | ISSUE-10 | 群聊离线消息丢失、未读红点异常 | P0 |
| [V2-04](V2-04_realtime_cmd_group_sync.md) | ISSUE-12 | 群聊 realtime CMD 同步 groupStore 未刷新 | P0 |
| [V2-05](V2-05_contact_group_creation_state.md) | ISSUE-09 | 联系人缺少发起群聊入口、添加好友状态不完整 | P1 |
| [V2-06](V2-06_message_ui_stability.md) | ISSUE-03 | 消息 UI 稳定性问题 | P1 |
| [V2-07](V2-07_group_chat_conversation_sort_regression.md) | ISSUE-15 | 群聊会话排序、设置展示与体验回归 | P1 |
| [V2-08](V2-08_group_owner_permission_regression.md) | ISSUE-16 | 群主权限未使用成员角色导致公告和头像入口缺失 | P1 |
| [V2-09](V2-09_browser_audit_conversation_extra_400.md) | 2026-05-23 审计 | 发送消息无意义空草稿触发 conversation extra 400 | P1 |
| [V2-10](V2-10_incomplete_image_and_file_sending.md) | 2026-05-24 自动测试 | 单聊及群聊图片与文件发送功能未完全打通 | P1 |
| [V2-11](V2-11_automated_screenshot_ui_misalignment.md) | 2026-05-24 用户反馈 | 自动化截屏测试发现多个 UI 组件错位 | P1 |
| [V2-12](V2-12_replace_browser_alerts_with_component_modals.md) | 2026-05-24 用户反馈 | 所有弹窗必须使用组件弹窗而不是浏览器 alert/confirm/prompt | P1 |
| [V2-13](V2-13_file_url_must_use_lan_accessible_host.md) | 2026-05-24 用户反馈 | 文件访问地址不能使用 127.0.0.1:8090，必须使用局域网可访问地址 | P0 |
| [V2-14](V2-14_file_message_card_visual_misalignment.md) | 2026-05-24 手册可视化审计 | 文件消息卡片视觉错位与宽度不稳定 | P1 |
| [V2-15](V2-15_global_search_remote_400_in_visual_audit.md) | 2026-05-24 手册可视化审计 | 全局搜索远程接口 400 污染可视化审计 | P1 |
| [V2-16](V2-16_file_send_filename_text_echo.md) | 2026-05-25 用户反馈 | 发送文件后文件名被渲染成独立文本消息 | P0 |
| [V2-17](V2-17_chat_ui_responsive_file_send_layout_regression.md) | 2026-05-25 用户反馈 | 发送文件后聊天 UI 在不同窗口比例下布局变形 | P1 |
| [V2-18](V2-18_sent_message_duplicate_rendering.md) | 2026-05-25 用户反馈 | 发送任意消息后发送方 UI 显示两条内容 | P0 |
| [V2-19](V2-19_chat_group_contact_notification_mention_regressions.md) | 2026-05-25 用户反馈 | 群二维码、Bot、好友资料、未读红点与 @ 功能回归合集 | P0 |

### 2026-05-24 V2-11 至 V2-13 修复验证

| Issue | 覆盖 | 结果 |
|---|---|---|
| [V2-11](V2-11_automated_screenshot_ui_misalignment.md) | `uiLayoutStability.test.ts` + `smoke-v2-11-ui-layout.spec.ts` | ✅ Resolved |
| [V2-12](V2-12_replace_browser_alerts_with_component_modals.md) | 静态 grep + `noNativeDialogs.test.ts` + E2E smoke | ✅ Resolved |
| [V2-13](V2-13_file_url_must_use_lan_accessible_host.md) | `mediaUrlNormalization.test.ts` + E2E smoke | ✅ Resolved |

本轮完整门禁：

| 命令 | 结果 |
|---|---|
| `cd sections/im_web/apps/chat && pnpm exec vitest run tests/noNativeDialogs.test.ts tests/mediaUrlNormalization.test.ts tests/uiLayoutStability.test.ts tests/messageMediaSending.test.ts --config vitest.config.ts` | ✅ Pass，4 files / 7 tests |
| `cd sections/im_web && pnpm type-check` | ✅ Pass |
| `cd sections/im_web && pnpm test:unit` | ✅ Pass，28 files / 63 tests |
| `cd sections/im_web && pnpm build` | ✅ Pass，保留既有 chunk size warning |
| `cd sections/im_web && pnpm test:e2e` | ✅ Pass，8/8 passed |

### 2026-05-24 手动测试手册可视化审计

按 `manual-testing-guide.md` 执行浏览器自动可视化审计，覆盖登录、会话打开、文本发送、文件发送、群设置抽屉、邀请成员弹窗、全局搜索、工作台、680px 响应式、控制台错误和网络错误。

| 报告 | 结果 |
|---|---|
| `sections/im_web/.ai/V2.0/issues/tests-e2e/manual-visual-audit-2026-05-24T12-54-37-825Z/summary.md` | 发现 [V2-14](V2-14_file_message_card_visual_misalignment.md) 和 [V2-15](V2-15_global_search_remote_400_in_visual_audit.md) |
| `sections/im_web/.ai/V2.0/issues/tests-e2e/manual-visual-audit-2026-05-24T13-07-08-392Z/summary.md` | ✅ Pass，12 checks，0 failed，10 screenshots，0 network errors |

### 2026-05-25 文件发送文件名文本回显修复验证

| Issue | 覆盖 | 结果 |
|---|---|---|
| [V2-16](V2-16_file_send_filename_text_echo.md) | `messageMediaSending.test.ts` 模拟 SDK 回显 `type=1` 文件名 payload | ✅ Resolved |

| 命令 | 结果 |
|---|---|
| `cd sections/im_web/apps/chat && pnpm exec vitest run tests/messageMediaSending.test.ts --config vitest.config.ts` | ✅ Pass，4 tests |

---

## Phase 2 更新：测试工具安装完成

| 优先级 | 工具 | 现状 | 配置 |
|---|---|---|---|
| P0 | **Vitest** | ✅ 已安装 | `apps/chat/vitest.config.ts` |
| P0 | **@testing-library/vue** | ✅ 已安装 | `apps/chat/tests/setup.ts` |
| P0 | **Playwright** | ✅ 已安装 | `apps/chat/playwright.config.ts` |
| P1 | **ESLint** | ✅ 已安装 | `eslint.config.js` |
| P2 | **fake SDK mock** | ✅ 已建 | `apps/chat/tests/messageMediaSending.test.ts` |

### 工具使用方式

```bash
# 根 workspace 统一命令（推荐）
cd sections/im_web
pnpm test:unit                    # 运行单元测试
pnpm lint                         # 运行 ESLint 质量检查
pnpm test:unit -- --coverage     # 单元测试 + 覆盖率报告
pnpm test:e2e                     # 运行 E2E 测试（需前端 dev server 运行）
pnpm test:e2e --ui               # Playwright 可视化 UI 模式

# chat workspace 直接命令
cd sections/im_web/apps/chat
pnpm test:unit:watch              # Vitest 监听模式（开发时用）
```

### 现有测试文件

| 文件 | 框架 | 状态 |
|---|---|---|
| `tests/conversationPresentation.test.ts` | Vitest ✅ | 7 tests passed |
| `tests/sdkAddress.test.ts` | Vitest ✅ | 3 tests passed |
| `tests/groupOfflineUnreadRetention.test.ts` | Vitest ✅ | 1 test passed |
| `tests/realtimeCmdGroupSync.test.ts` | Vitest ✅ | 2 tests passed |
| `tests/contactGroupCreationState.test.ts` | Vitest ✅ | 2 tests passed |
| `tests/messageUiStability.test.ts` | Vitest ✅ | 2 tests passed |
| `tests/groupOwnerPermission.test.ts` | Vitest ✅ | 2 tests passed |
| `tests/messageMediaSending.test.ts` | Vitest ✅ | 2 tests passed |
| `tests-e2e/smoke-uc1.spec.ts` | Playwright ✅ | 1 smoke passed |

---

## 关闭备注

**Phase 1 ✅**：Constitution 测试规范附录已写入
**Phase 2 ✅**：Vitest + Playwright + ESLint 安装完成，23 个单元测试通过，Playwright smoke 通过
**Phase 3 ✅**：7 个存量缺陷已迁移到 V2.0 issues

剩余工作：
- `pnpm lint` 当前 0 error，仍有 10 个既有 unused warning 可后续清理
- `pnpm build` 当前通过，仍有已知大 chunk warning 可后续通过 manualChunks 优化
- 后续 Story 可继续补强更复杂的 Store fake SDK mock 和专项 Playwright 场景

---

## 2026-05-24 V2.0 Final Release Verification

| 检查项 | 命令 | 结果 |
|---|---|---|
| TypeScript 类型检查 | `cd sections/im_web && pnpm type-check` | ✅ Pass |
| 生产构建 | `cd sections/im_web && pnpm build` | ✅ Pass；仍有既有 large chunk warning |
| 单元 / 组件 / Store 测试 | `cd sections/im_web && pnpm test:unit` | ✅ Pass，25 files / 59 tests |
| Playwright smoke | `cd sections/im_web && pnpm test:e2e` | ✅ Pass，7 tests |

### Final manual realtime recovery notes

- Recovery-critical automated coverage now includes SDK connection state, reconnect transition, offline pending queue retry/failure, kickout sensitive cleanup, conversation/message/group recovery sync, and US4/US8 shell visibility checks.
- Live manual checks that still require paired backend/device setup: true gateway disconnect/reconnect timing, multi-device missed-message convergence, QR login confirmation from a paired mobile client, robot command execution, report submission, invite approval, and scan-join approval.
- Default Vitest worker pool triggered Node/V8 native crashes without assertion failures during late-stage verification. The chat `test:unit` script now uses the verified stable single-thread pool.

### Release readiness

All V2.0 tasks T001-T096 are complete with per-phase git commits, story-level smoke evidence, and final root workspace verification. Remaining risks are non-blocking backend/environment validation items rather than known client-side blockers.

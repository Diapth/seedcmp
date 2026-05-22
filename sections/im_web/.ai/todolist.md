# IM Web Todo List

**评估结论**: 内容合理，可以纳入 `.ai` 目录作为后续实现与验收依据。本文记录的是当前 Vue 3 重构已经触达、但尚未形成完整闭环的功能，不应标记为已完成。

**关联文档**: `tasks.md`, `specify.md`, `api.md`, `addition.md`

## 已完成但仍建议继续优化

1. 好友申请已改成真实接口拉取，并接入 `friendRequest` CMD 与红点清除；后续建议把联系人顶部“新的朋友”入口抽成统一红点组件，避免会话、联系人、个人中心三处各写一套状态展示。
   - 依据：`tasks.md` 的 T071、`api.md` 的 `/user/reddot/:category` 与 `/friend/apply`。
   - 当前代码：`packages/contacts-vue/src/stores/contactStore.ts` 已拉取申请列表并维护 `friendRequestUnreadCount`。
   - 后续验收：收到 `friendRequest` 后，联系人入口、好友申请页和全局未读状态展示一致；打开申请页后红点清除。
2. 实时消息已接入 `chatManager.addMessageListener` 写入 `messageStore`；后续建议补充消息状态监听，把 `sending/success/fail` 与送达回执彻底打通。
   - 依据：`specify.md` FR-005、FR-008 和弱网 Edge Case。
   - 当前代码：`packages/datasource-vue/src/cmd/index.ts` 已注册消息监听，`messageStore.ts` 已有本地消息状态字段。
   - 后续验收：发送中、成功、失败状态由 SDK 回执或失败回调驱动；失败消息可重试，刷新后状态不会错误回退。
3. 消息输入区已经提供显式“图片 / 文件 / @成员”按钮，并接入拖拽、粘贴、文件选择事件；但目前媒体消息发送仍是占位提示，需要继续补齐真实上传和 SDK 发送流程。
   - 依据：`tasks.md` T074、`specify.md` FR-005、`api.md` 的 `file/upload`。
   - 当前代码：`apps/chat/src/components/MessageInput.vue` 的 `sendSelectedFile()` 仍只提示“能力正在完善”。
   - 后续验收：图片生成 `type=2` 消息，文件生成 `type=8` 消息；上传失败时不插入成功态消息。
4. 设备管理页已经可查看设备列表和移除单设备；但“退出其他设备”当前后端语义不明确，页面先保守实现为“退出当前会话”。
   - 依据：`tasks.md` T060、`api.md` 的 `/user/devices`、`/user/quit`、`/user/pc/quit`。
   - 当前代码：`apps/chat/src/views/DeviceManagementPage.vue` 调用 `authApi.quit()`，按钮文案为“退出当前会话”。
   - 后续验收：若后端确认存在“只踢其他设备”接口，再恢复 T060 中“退出其他设备”的完整语义。

## 下一步优先改进

1. **P0 - 补齐 T074 媒体消息发送闭环**：把图片拖拽/粘贴上传接通到 `file/upload` 与 WuKongIM 媒体消息发送，不再只做入口和检测。
   - 范围：`MessageInput.vue`, `messageStore.ts`, `api/index.ts`。
   - 依赖：`addition.md` 中媒体消息内容字段和 SDK 构造方式澄清。
2. **P0 - 补齐 T061 通知设置闭环**：新增 `settingsStore`，把 `device_token`、`device_badge`、浏览器通知权限和用户设置页串起来。
   - 范围：`apps/chat/src/stores/settingsStore.ts`, `SettingsPage.vue`, `api/index.ts`。
   - 验收：浏览器授权状态、后端 token 注册状态、角标同步状态可被页面读取并重试。
3. **P1 - 补齐会话级红点闭环**：当前好友申请红点已联动，接下来要把普通消息未读、会话列表、页面标题角标统一起来。
   - 范围：`conversationStore.ts`, `ConversationList.vue`, `MainLayout.vue`。
   - 验收：当前会话收到消息自动清未读；非当前会话累加未读；`document.title` 或桌面角标与未读总数一致。
4. **P1 - 补齐消息状态与弱网重试**：`messageStore` 已有状态字段，但还需要 SDK 状态回执、超时失败、一键重发和离线队列。
   - 范围：`messageStore.ts`, `MessageList.vue`, `MessageInput.vue`, `sdk.ts`。
   - 验收：断网发送进入 pending，10 秒无回执变失败，恢复网络后可自动或手动重发。
5. **P2 - 优化 `MessageList` 性能**：当前还是普通列表，后续需要虚拟滚动与按需分页，才能对齐 `T067/T072` 的性能目标。
   - 范围：`MessageList.vue`, `messageStore.ts`。
   - 验收：5000 条历史消息滚动时保持接近 `SC-003` 的 58 FPS 目标。
6. **P2 - 校验 SDK 心跳重连真实有效性**：`sdk.ts` 已实现 30 秒心跳和 3 次 missed pong 判断，但需要确认 SDK 是否有真实 Pong 回调；不能只靠收到任意消息清零。
   - 范围：`sdk.ts`。
   - 验收：断网、半开连接、网关无响应三种场景均能按指数退避重连。
7. **P2 - 整理 `*.vue.js` 产物策略**：仓库里已有多处生成文件与源码并存，建议统一生成策略，避免手改源码后类型产物不同步。
   - 范围：仓库构建产物策略、`.gitignore`、构建脚本。
   - 验收：明确 `*.vue.js` 是提交产物还是本地生成产物；源码变更后不会出现旧产物参与打包。

## 代码校验清单

- `tasks.md` 中标记完成的任务必须能在对应源码路径找到实现，未完成任务必须保留 `[ ]`。
- API 封装必须使用 `packages/datasource-vue/src/api/index.ts`，组件内不直接写裸 `axios`。
- SDK 消息监听和 CMD 监听必须集中在 `datasource-vue`，避免组件重复注册监听器。
- 好友申请同意必须使用申请 `token` 调用 `POST /friend/sure`，不能用 `apply_id` 替代。
- 清除未读必须保持 typo 路径 `coversation/clearUnread`。
- 媒体消息发送在后端协议未确认前不得把占位提示标为 T074 完成。
- “退出其他设备”在接口语义未确认前不得复用 `POST /user/quit` 冒充完成。

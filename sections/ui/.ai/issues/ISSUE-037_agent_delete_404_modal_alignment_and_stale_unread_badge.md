# [ISSUE-037] 智能体删除 404、弹层偏左与聊天红点误报

**状态**：Resolved

**AI修复模式**：Direct Fix

## 现象

用户报告：

1. 删除 `QQQA` 智能体时提示请求失败 404。
2. 删除确认卡片显示在页面左侧，应位于页面中心。
3. 用户编辑资料卡片也应位于页面中心。
4. 聊天栏一直显示红点，点进聊天后红点消失，疑似未读状态为过期/假数据。

## 诊断胶囊

- 现象：智能体卡片存在但删除远端返回 404；全局弹窗不居中；聊天入口有 stale unread badge。
- 证据：`DELETE /v1/clowder/cats/:catId` 通过 TangSeng bridge 转发到 Clowder `/api/cats/:id`；`AppDialog` 把 `width-md` 类挂在 mask 上，CSS `max-width` 缩小了整个遮罩；conversation store 初始 mock 会话带 unread。
- 根因假设：
  - 删除链路需要显式保留真实 catId/directCatId，并把远端 404 视作“已不存在”的幂等删除，继续清理本地联系人/候选/会话引用。
  - `AppDialog` 宽度类作用对象错误，导致遮罩从左侧缩成 400px，弹层只在左侧区域居中。
  - 全局聊天 badge 直接累加所有 conversation unread，包含 mock unread 和本地已标记已读但远端尚未刷新回来的旧 unread。
- 诊断策略：先补 native-im 回归测试，再修服务/状态/UI；最后用 Playwright 桌面和移动端验证删除弹窗、编辑资料弹窗、聊天红点。
- 超时策略：若真实后端账号/登录不可用，使用受控 browser mock 验证前端契约和布局。
- 预警策略：删除 404 不能吞掉 401/403/500；只把 404/not found 视为幂等。
- 验收：
  - 删除缺失远端智能体不再卡在 404，且本地卡片和相关引用被清理。
  - 删除确认弹层和个人资料编辑弹层在桌面/移动端视口中心，无左偏、溢出、遮挡。
  - mock/stale unread 不再让聊天入口长期红点误报。

## 验收要求

1. `npm run test:native-im` 通过，且包含 Direct Fix 红灯回归。
2. `npm run test:smoke`、`npm run build:h5` 通过。
3. Playwright 或 browser-preview 覆盖桌面 Web viewport 与移动端 viewport。
4. 证据保存到 `.ai/tests/ISSUE-037-<timestamp>/`。

## 修复摘要

- `deleteClowderCat` 保留并使用真实 `catId/directCatId`，删除远端返回 404 / not found 时按幂等成功处理，继续执行本地智能体、候选和直聊引用清理。
- 删除智能体时同步调用最近会话删除接口，删除确认文案明确直聊入口与本地直聊消息缓存的处理范围。
- 修正 `AppDialog` 宽度类挂载位置，让确认弹层在桌面和移动端都按全屏遮罩居中；个人资料编辑弹层改为居中 confirm。
- 导航红点与会话未读统一走 `conversationDisplayUnread/totalDisplayUnread`，过滤 mock 未读、当前会话和本地已读 marker，避免 stale unread badge。

## 验证命令

```bash
cd sections/ui
npm run test:native-im
npm run test:smoke
npm run build:h5
node .ai/tests/ISSUE-037-20260610123517/verify-issue-037.mjs
node .ai/tests/ISSUE-038-20260610132635/verify-issue-038.mjs
```

## 证据

- 证据目录：`sections/ui/.ai/tests/ISSUE-037-20260610123517/`
- Playwright 结果：`sections/ui/.ai/tests/ISSUE-037-20260610123517/result.json`
- 请求日志：`sections/ui/.ai/tests/ISSUE-037-20260610123517/request-log.json`
- 控制台日志：`sections/ui/.ai/tests/ISSUE-037-20260610123517/console-log.json`
- 截图：
  - `desktop-1440x900-chat-unread-cleared.png`
  - `desktop-1440x900-profile-edit-centered.png`
  - `desktop-1440x900-agent-delete-centered.png`
  - `desktop-1440x900-agent-deleted-after-404.png`
  - `mobile-390x844-chat-unread-cleared.png`
  - `mobile-390x844-profile-edit-centered.png`
  - `mobile-390x844-agent-delete-centered.png`
  - `mobile-390x844-agent-deleted-after-404.png`

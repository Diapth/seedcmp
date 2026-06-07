# Issue 004：conversation/sync 字段形状与群会话同步缺口

- 状态：Resolved
- 严重级别：High
- 发现时间：2026-06-07
- 影响平台：H5/Web、移动浏览器、Android APP-PLUS
- 关联计划：V1-2

## 现象

真实登录后，agenthub_ui 初始会话列表虽然能触发 `conversation/sync`，但会话名称显示为“未命名会话”，时间落到 1970；与 im_web 对照时，agenthub_ui 还缺少 `group/my` 返回的项目群/普通群会话。

## 根因

`conversation/sync` 的真实返回为 `{ conversations, users, groups }`：

- 单个 conversation 只有 `channel_id/channel_type/timestamp/recents` 等字段，名称/头像/置顶/免打扰需要从 `users/groups` 预热的 channel cache 里映射。
- `timestamp` 是秒级 Unix 时间，原 mapper 直接按毫秒使用，导致 1970。
- 项目群来自 `group/my`，不是一定出现在 `conversation/sync.conversations` 里；agenthub_ui 没有像 im_web 一样把 `group/my` 合并为 group conversation。

## 修复

1. `utils/im-mappers.js` 增加 `normalizeTimestamp`、payload/type 归一化、`recents/messages` 摘要选择、`buildConversationChannelCache` 和 `toGroupConversationInput`。
2. `stores/conversation.js` 在 `fetchConversations()` 中合并 `conversation/sync` 与 `group/my`，并为群调用 `message/channel/sync` 取最新摘要。
3. `stores/group.js` 支持 `group/my` 裸数组返回，并保留 `top/mute/member_count`。
4. `tests/unit/im-domain.spec.js` 增加真实 sync shape、群会话补齐、秒级时间戳回归测试。

## 验证

- `npm run test:unit`：17 passed
- `npm run build:h5`：Build complete
- 真实 H5 对照：
  - agenthub_ui 桌面/移动端均显示 `V340项目群06101256`
  - 顶部摘要为 `[文件] acceptance-result.json`
  - 页面无 `未命名会话` / `1970`
  - 浏览器 diagnostics：无 pageerror、无 requestfailed、无 HTTP 4xx/5xx

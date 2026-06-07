# IM API 覆盖对比与网络探测报告

生成时间：2026-06-07  
worktree：`/home/yunyi/Desktop/Bytedance_cmp/cat-cafe-im-api-network-tests`  
对比仓库：`TangSengDaoDao/TangSengDaoDaoWeb`，只读克隆路径 `/tmp/TangSengDaoDaoWeb-codex-api-audit`

## 1. 结论

已完成 TangSengDaoDaoWeb 前端真实调用面与 `sections/agenthub_ui/.ai/docs` 接口文档的静态对比。

- TangSengDaoDaoWeb 静态抽取唯一 API 调用：67 个。
- 补文档前缺口：15 个。
- 补文档后缺口：0 个。
- 文档当前记录 endpoint：196 个。
- 真实网络非破坏性探测：16/16 按分类通过，`requiredFailures=0`。

本轮发现 4 个运行时警告，不阻塞“接口网络请求测试流程”本身，但需要在功能接入时继续处理：

| 类型 | 接口 | 实测状态 | 说明 |
|---|---|---:|---|
| backend-dependent | `POST /v1/search/global` | 400 | 路由和鉴权已通，但 WuKongIM 消息搜索下游返回 `查询悟空IM消息错误` |
| frontend-dependency | `GET /v1/favorite/my` | 404 | TangSengDaoDaoWeb 前端依赖；当前本地 Go modules 未发现 favorite 模块实现 |
| frontend-dependency | `GET /v1/sticker/user/category` | 404 | TangSengDaoDaoWeb 前端依赖；当前本地 Go modules 未发现 sticker 模块实现 |
| frontend-dependency | `GET /v1/organization/joined` | 404 | TangSengDaoDaoWeb 前端依赖；当前本地 Go modules 未发现 organization 模块实现 |

## 2. 已补全文档

### 2.1 `im-api-reference.md`

新增 `§1.9 通用配置与版本（Common Module）`：

- `GET /v1/common/appconfig`
- `GET /v1/common/appversion/:os/:version`
- `POST /v1/common/appversion`
- `GET /v1/common/appversion/list`
- `GET /v1/common/countries`
- `GET /v1/common/chatbg`
- `GET /v1/common/appmodule`
- `GET /v1/common/updater/:os/:version`
- `GET /v1/common/pcupdater/:os`
- `GET /v1/health`

### 2.2 `im-api-reference-part2.md`

新增 `§3.1 最近会话域（Conversation Module）`：

- `POST /v1/conversation/sync`
- `POST /v1/conversation/syncack`
- `POST /v1/conversation/extra/sync`
- `POST /v1/conversations/:channel_id/:channel_type/extra`
- `DELETE /v1/conversations/:channel_id/:channel_type`
- `PUT /v1/coversation/clearUnread`

新增 `§3.2 搜索域（Search Module）`：

- `POST /v1/search/global`

新增 `§7 TangSengDaoDaoWeb 前端依赖补充接口`：

- `GET /v1/favorite/my`
- `POST /v1/favorites`
- `DELETE /v1/favorites/:id`
- `GET /v1/sticker/user/category`
- `GET /v1/sticker/user/sticker`
- `GET /v1/organization/joined`
- `GET /v1/organizations/:org_id/department`

## 3. 静态对比方法

源码抽取规则：

- `WKApp.apiClient.get/post/put/delete`
- `APIClient.shared.get/post/put/delete`
- 直接 `axios.get/post/put/delete`
- 模板字符串参数统一规范化为 `:param`
- 查询参数只参与调用证据，不作为文档覆盖匹配的必要条件

覆盖检查命令：

```bash
node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs coverage \
  --source /tmp/TangSengDaoDaoWeb-codex-api-audit \
  --docs sections/agenthub_ui/.ai/docs
```

本轮输出：

```json
{
  "docs": 196,
  "source": 67,
  "missing": []
}
```

## 4. 网络探测方法

网络测试遵循 `sections/agenthub_ui/.ai/plan/V2-test-plan.md` 的 IP 要求：使用 `172.18.58.156`，不使用 localhost。

执行命令：

```bash
node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs network \
  --api-base http://172.18.58.156:3000/v1 \
  --username 13733632709 \
  --password 123456 \
  --device-id agenthub-api-doc-test-20260607-r2 \
  --app-version 1.0.0
```

最终证据目录：

- `sections/agenthub_ui/.ai/tests-e2e/api-network-20260607-051054/report.md`
- `sections/agenthub_ui/.ai/tests-e2e/api-network-20260607-051054/results.json`

最终摘要：

```json
{
  "total": 16,
  "passed": 16,
  "failed": 0,
  "requiredFailures": 0,
  "frontendDependencyWarnings": 3,
  "backendDependencyWarnings": 1
}
```

## 5. 非破坏性探测覆盖

默认网络探测不会发起删除、踢人、注销、创建群、创建收藏等破坏性或污染数据的请求。覆盖的必需链路如下：

- `GET /v1/health`
- `GET /v1/common/appconfig`
- `POST /v1/user/login`
- `GET /v1/common/appversion/web/:version`
- `GET /v1/user/devices`
- `GET /v1/user/qrcode`
- `GET /v1/friend/sync`
- `GET /v1/friend/apply`
- `GET /v1/group/my`
- `POST /v1/conversation/sync`
- `POST /v1/conversation/extra/sync`
- `POST /v1/message/reminder/sync`
- `POST /v1/search/global`

额外前端依赖探测：

- `GET /v1/favorite/my?page_index=1&page_size=1`
- `GET /v1/sticker/user/category`
- `GET /v1/organization/joined`

## 6. 后续处理建议

1. 若 agenthub_ui 需要完整复刻 TangSengDaoDaoWeb 的收藏、贴纸、组织架构能力，需要补齐或代理 `favorite` / `sticker` / `organization` 三类后端接口。
2. `/v1/search/global` 当前不是文档缺口，而是搜索下游能力问题；需要检查 WuKongIM 消息搜索配置、索引服务或搜索依赖启动状态。
3. 若后续要把收藏创建/删除、会话扩展更新、清未读等 mutation 也纳入网络测试，应增加单独的测试账号和清理策略，避免污染当前真实账号数据。

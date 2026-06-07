# IM 后端接口参考

> 配套：[V2-issue-solutions.md](./V2-issue-solutions.md)
> 真实运行地址：API `http://172.18.58.156:3000`（im-web 后端）、`http://172.18.58.156:3001`（im_web Vite UI 占位，请以 `seedcmp/scripts/start-im-clowder.sh` 启动后打印的地址为准）
> 数据来源：`sections/im/TangSengDaoDaoServer/modules/*/api*.go` + `sections/im_web/packages/datasource-vue/src/api/clowder.ts` + `sections/clowder-ai/packages/api/src/routes/*`
> 版本：v3.x（与 V2 计划对应）

## 0. 服务发现与基础约定

- **后端服务栈**：
 - `TangSengDaoDaoServer`（Go）— IM 业务 API，监听 `:3000`，路由 `/v1/*`。
 - `WuKongIM`（Go）— 长连接 + 离线消息，监听 `:5100`（tcp）/ `:5200`（ws）。
 - `clowder-ai/packages/api`（Node/Hono）— Clowder 域 API，监听 `:3004`，路由 `/api/*`；TangSeng 端用 `c.config.APIBaseURL` 反向代理到 3004。
- **鉴权**：
 - `Authorization: Bearer <token>` — 大部分 `/v1/*` 需要。
 - token 由 `POST /v1/user/login` 返回，TTL 由 im 后端配置决定（默认 30 天）。
 - Clowder 域额外带 `x-clowder-user` 头（由 `TangSeng/clowder` 模块在转发到 3004 时注入）。
- **设备**：
 - `flag=0` 表示 APP，`flag=1` 表示 PC；多端登录用 `device.device_id` 区分。
 - `POST /v1/user/devices/:device_id` 删除设备 = 把该端踢下线。
- **时间**：所有时间戳是 UTC 毫秒；本地化在前端。
- **错误约定**：
 - `{"code": 0, "msg": "ok", "data": ..}` — 成功。
 - `{"code": 非 0, "msg": "错误描述", "data": null}` — 业务错误。
 - 401 — token 失效；403 — 权限不足；400 — 字段校验；502 — 下游（clowder 3004）不可用。

## 1. 用户域（User Module）

> 源文件：`sections/im/TangSengDaoDaoServer/modules/user/api.go`、`api_device.go`、`api_friend.go`

### 1.1 注册与登录

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/user/register` | 否 | 用户注册（手机+验证码+密码） |
| POST | `/v1/user/login` | 否 | 手机号 + 密码登录 |
| POST | `/v1/user/usernamelogin` | 否 | 用户名登录（im_web 历史路径） |
| POST | `/v1/user/usernameregister` | 否 | 用户名注册 |
| POST | `/v1/user/sms/registercode` | 否 | 发注册验证码 |
| POST | `/v1/user/sms/forgetpwd` | 否 | 发忘记密码验证码 |
| POST | `/v1/user/pwdforget` | 否 | 重置密码（验证码） |
| POST | `/v1/user/sms/destroy` | 是 | 发注销账号验证码 |
| DELETE | `/v1/user/destroy/:code` | 是 | 注销账号 |
| POST | `/v1/user/login_authcode/:auth_code` | 否 | 扫码登录 |
| GET | `/v1/user/loginuuid` | 否 | 拿扫码登录 uuid |
| GET | `/v1/user/loginstatus` | 否 | 轮询扫码登录状态 |
| POST | `/v1/user/sms/login_check_phone` | 是 | 发登录设备二次验证 |
| POST | `/v1/user/login/check_phone` | 是 | 设备二次验证确认 |
| POST | `/v1/user/quit` | 是 | 退出登录（自身） |
| POST | `/v1/user/pc/quit` | 是 | 退出 PC 端 |
| PUT | `/v1/user/updatepassword` | 是 | 改登录密码 |

**`POST /v1/user/register`** 请求体（`registerReq`）：

```json
{
 "name": "测试员B",
 "zone": "86",
 "phone": "13800000001",
 "code": "1234",
 "password": "Test1234!",
 "flag": 0,
 "device": {
 "device_id": "uuid-xxx",
 "device_name": "iPhone 15",
 "device_model": "iPhone15,2"
 },
 "invite_code": ""
}
```

> ⚠️ V2 issue：当前后端 `len(r.Password) < 6` 不符合 8 位策略；详见 [V2-issue-solutions.md §2](./V2-issue-solutions.md#2-v2-02-注册门禁p0前置修复)。

**`POST /v1/user/login`** 请求体（`loginReq`）：

```json
{ "username": "13800000001", "password": "123456", "flag": 0, "device": { "..": ".." } }
```

**`POST /v1/user/login`** 响应（`loginUserDetailResp`）：

```json
{
 "uid": "41232e72652648f8946988f45ba4895d",
 "app_id": "wukongchat",
 "name": "测试员A",
 "username": "8613832800001",
 "sex": 1,
 "category": "",
 "short_no": "1a2b3c",
 "zone": "86",
 "phone": "13800000001",
 "token": "eyJhbGciOiJIUzI1..",
 "chat_pwd": "",
 "lock_screen_pwd": "",
 "lock_after_minute": 0,
 "setting": {
 "search_by_phone": 1,
 "search_by_short": 1,
 "new_msg_notice": 1,
 "msg_show_detail": 1,
 "voice_on": 1,
 "shock_on": 1,
 "offline_protection": 0,
 "device_lock": 0,
 "mute_of_app": 0
 },
 "rsa_public_key": "base64..",
 "short_status": 0,
 "msg_expire_second": 0
}
```

### 1.2 资料 / 头像 / 二维码

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/users/:uid` | 是 | 查用户资料 |
| GET | `/v1/users/:uid/avatar` | 否 | 用户头像 |
| POST | `/v1/users/:uid/avatar` | 是 | 上传头像 |
| PUT | `/v1/users/:uid/setting` | 是 | 更新某用户设置（admin） |
| PUT | `/v1/user/current` | 是 | 改自己昵称/头像/性别/签名 |
| GET | `/v1/user/qrcode` | 是 | 我的二维码 |
| PUT | `/v1/user/my/setting` | 是 | 改自己的通知/隐私/语言/主题 |
| GET | `/v1/user/search?keyword=` | 是 | 搜用户（手机号/短号/uid） |
| GET | `/v1/users/:uid/im` | 是 | 拿所在 IM 节点信息（ws_addr） |
| GET | `/v1/user/customerservices` | 是 | 客服列表 |

### 1.3 设备管理

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/user/devices` | 是 | 设备列表 |
| GET | `/v1/user/devices/:device_id` | 是 | 设备详情 |
| DELETE | `/v1/user/devices/:device_id` | 是 | 踢出设备（被踢端 ws 收到 `kickout`） |
| GET | `/v1/user/online` | 是 | 我的设备和好友的在线状态 |
| POST | `/v1/user/online` | 是 | 批量查指定 uid 在线 |
| POST | `/v1/user/device_token` | 是 | 注册推送 token |
| DELETE | `/v1/user/device_token` | 是 | 卸载推送 token |
| POST | `/v1/user/device_badge` | 是 | 同步桌面红点 |

### 1.4 红点

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/user/reddot/:category` | 是 | 拿某类红点（`category`：`friend_apply`、`group_invite` 等） |
| DELETE | `/v1/user/reddot/:category` | 是 | 清红点 |

### 1.5 黑名单

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/user/blacklist/:uid` | 是 | 加黑名单 |
| DELETE | `/v1/user/blacklist/:uid` | 是 | 移除黑名单 |
| GET | `/v1/user/blacklists` | 是 | 黑名单列表 |

### 1.6 好友（`api_friend.go`）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/friend/apply` | 是 | 发起好友申请（带验证消息） |
| GET | `/v1/friend/apply` | 是 | 申请列表（收到 + 发出） |
| DELETE | `/v1/friend/apply/:to_uid` | 是 | 撤回自己发出的申请 |
| PUT | `/v1/friend/refuse/:to_uid` | 是 | 拒绝好友申请 |
| POST | `/v1/friend/sure` | 是 | 同意好友申请 |
| GET | `/v1/friend/sync` | 是 | 好友增量同步（带 version） |
| GET | `/v1/friend/search` | 是 | 搜好友（按手机/短号/uid） |
| PUT | `/v1/friend/remark` | 是 | 改备注 |
| DELETE | `/v1/friends/:uid` | 是 | 删除好友（不删会话） |

**`POST /v1/friend/apply`** 请求体：

```json
{ "to_uid": "41232e72..", "remark": "我是 B，需要加你为好友" }
```

**`POST /v1/friend/sure`** 请求体：

```json
{ "apply_id": "apply-uuid" }
```

### 1.7 第三方授权

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/user/thirdlogin/authcode` | 否 | 拿第三方授权码 |
| GET | `/v1/user/thirdlogin/authstatus` | 否 | 第三方授权状态 |
| GET | `/v1/user/github` | 否 | GitHub 登录跳板 |
| GET | `/v1/user/oauth/github` | 否 | GitHub OAuth 回调 |
| GET | `/v1/user/gitee` | 否 | Gitee 登录跳板 |
| GET | `/v1/user/oauth/gitee` | 否 | Gitee OAuth 回调 |
| POST | `/v1/user/pwdforget_web3` | 否 | Web3 公钥重置密码 |
| GET | `/v1/user/web3verifytext` | 否 | 拿签名原文 |
| POST | `/v1/user/web3verifysign` | 否 | 验签 |
| POST | `/v1/user/web3publickey` | 是 | 上传 Web3 公钥 |

### 1.8 其它

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/user/chatpwd` | 是 | 设置聊天密码 |
| POST | `/v1/user/lockscreenpwd` | 是 | 设置锁屏密码 |
| DELETE | `/v1/user/lockscreenpwd` | 是 | 关闭锁屏密码 |
| PUT | `/v1/user/lock_after_minute` | 是 | 设置锁屏分钟数 |
| POST | `/v1/user/maillist` | 是 | 添加通讯录条目 |
| GET | `/v1/user/maillist` | 是 | 通讯录列表 |

### 1.9 通用配置与版本（Common Module）

> 补充来源：`TangSengDaoDaoWeb/packages/tsdaodaobase/src/App.tsx`、`apps/web/src/Pages/Main/vm.ts`、`sections/im/TangSengDaoDaoServer/modules/common/api.go`、`modules/common/swagger/api.yaml`。

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/common/appconfig` | 否 | 拉取客户端运行配置；Web 启动时读取撤回时长等全局设置 |
| GET | `/v1/common/appversion/:os/:version` | 是 | 检查指定平台是否有新版本；Web 客户端调用 `os=web` |
| POST | `/v1/common/appversion` | 是 | 管理端添加版本 |
| GET | `/v1/common/appversion/list` | 是 | 管理端版本列表 |
| GET | `/v1/common/countries` | 否 | 国家/区号列表 |
| GET | `/v1/common/chatbg` | 是 | 聊天背景列表 |
| GET | `/v1/common/appmodule` | 是 | App 模块开关列表 |
| GET | `/v1/common/updater/:os/:version` | 否 | Tauri 兼容更新检查 |
| GET | `/v1/common/pcupdater/:os` | 否 | PC 端更新检查 |
| GET | `/v1/health` | 否 | IM 后端健康检查（DB / Redis / overall status） |

**`GET /v1/common/appconfig`** 常用响应字段：

```json
{
 "version": "1",
 "web_url": "https://example.com",
 "revoke_second": 120,
 "register_invite_on": 0,
 "send_welcome_message_on": 1,
 "channel_pinned_message_max_count": 5,
 "can_modify_api_url": 1
}
```

**`GET /v1/common/appversion/web/:version`** 响应字段：

```json
{
 "app_version": "1.0.1",
 "os": "web",
 "is_force": 0,
 "update_desc": "更新说明",
 "download_url": "",
 "created_at": "2026-06-07T00:00:00Z"
}
```

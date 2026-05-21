# TangSengDaoDaoWeb Vue 重构核心 API 接口文档

> **基础 REST API URL**: `http://127.0.0.1:8090/v1/`  
> **WS 连接网关**: `ws://127.0.0.1:5200`  
> **协议校验**: 除登录及验证码接口外，其余业务请求均需要在 Header 中携带用户的 `token` 凭证进行身份鉴定。

---

## 1. 身份认证与登录设备管理 API (Auth & Device)

### 1.1 手机号验证码/密码登录
- **接口地址**: `user/login`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "username": "008613800138000",
    "password": "密码或测试验证码123456",
    "flag": 1, // 终端设备标记：1 表示 Web 端，2 表示 PC 客户端
    "device": {
      "device_id": "设备唯一ID，由浏览器生成并缓存",
      "device_name": "Chrome Browser",
      "device_model": "Web-client"
    }
  }
  ```
- **返回参数 (JSON)**:
  ```json
  {
    "app_id": "tsdaodao",
    "uid": "13800138000",
    "short_no": "88888",
    "token": "auth_token_string",
    "name": "逐味魔",
    "sex": 1
  }
  ```

### 1.2 用户名登录 / 注册
- **注册接口**: `user/usernameregister`  
- **登录接口**: `user/usernamelogin`  
- **请求方法**: `POST`  
- **请求参数 (JSON)**:
  ```json
  {
    "username": "user_account_name",
    "password": "hashed_or_plain_password"
  }
  ```

### 1.3 获取短信验证码
- **注册验证码**: `user/sms/registercode`  
- **忘记密码验证码**: `user/sms/forgetpwd`  
- **请求方法**: `POST`  
- **请求参数 (JSON)**:
  ```json
  {
    "phone": "008613800138000"
  }
  ```

### 1.4 扫码登录 (QRCode Auth)
- **第一步：获取登录 UUID**  
  *接口地址*: `user/loginuuid` (GET)  
  *返回参数*: `{ "uuid": "uuid_string", "qrcode": "qr_url" }`
- **第二步：客户端轮询登录状态**  
  *接口地址*: `user/loginstatus` (GET)  
  *Query 参数*: `uuid=uuid_string`  
  *返回状态机*:
  - `waitScan`: 二维码就绪，等待扫描。
  - `scanned`: 二维码已扫，界面显示扫码人头像。
  - `authed`: 已在手机端确认授权，携带 `auth_code` 凭证。
  - `expired`: 二维码超时失效，需重新请求。
- **第三步：通过认证码登录**  
  *接口地址*: `user/login_authcode/:auth_code` (POST)  
  *返回参数*: 返回登录成功的 Token 和用户信息。

### 1.5 登录设备管理
- **获取当前在线的登录设备**: `GET /v1/user/devices`  
- **强退指定设备**: `DELETE /v1/user/devices/:device_id`
- **安全退出当前登录**: `POST /v1/user/quit`

---

## 2. 个人信息与系统设置 API (User Profile & System Settings)

### 2.1 获取特定用户详情
- **接口地址**: `users/:uid`
- **请求方法**: `GET`
- **Query 参数 (可选)**: `group_no=group_id` (传入群号时，会返回该用户在该群聊中的昵称、入群时间与邀请人)
- **返回参数 (JSON)**:
  ```json
  {
    "uid": "13800138000",
    "name": "逐味魔",
    "remark": "备注名（非好友时为空）",
    "short_no": "短号（好友可见）",
    "sex": 1,
    "follow": 1, // 好友状态：1 表示好友，0 表示非好友
    "group_member": {
      "role": 1, // 群角色：1 成员，2 管理员, 3 群主
      "forbidden_expir_time": 0 // 个人禁言截止时间
    }
  }
  ```

### 2.2 修改个人资料
- **接口地址**: `user/current`
- **请求方法**: `PUT`
- **请求参数 (JSON)**:
  ```json
  {
    "name": "新昵称",
    "sex": 1, // 性别：1 男，0 女
    "short_no": "888888" // 短号，仅限未修改过且不重复时允许修改一次
  }
  ```

### 2.3 个人头像上传
- **接口地址**: `users/:uid/avatar`
- **请求方法**: `POST`
- **请求类型**: `multipart/form-data`
- **表单键**: `file` (二进制图片数据)

### 2.4 获取 IM 节点通讯凭证
- **接口地址**: `users/:uid/im`
- **请求方法**: `GET`
- **说明**: 用于获取 WuKongIM 连接所需要的 IP 路由和 IM Token。
- **返回参数 (JSON)**:
  ```json
  {
    "tcp_addr": "127.0.0.1:5100",
    "ws_addr": "ws://127.0.0.1:5200",
    "token": "im_token_for_websocket"
  }
  ```

### 2.5 用户通知红点清算
- **查询红点计数**: `GET /v1/user/reddot/:category` (category 可为 `friendApply`)
- **清除红点未读**: `DELETE /v1/user/reddot/:category`

---

## 3. 好友与联系人 API (Friend Relationship)

### 3.1 增量同步好友名册
- **接口地址**: `friend/sync`
- **请求方法**: `GET`
- **Query 参数**:
  ```json
  {
    "version": 0, // 客户端本地最新版本序列号（首次同步传 0）
    "limit": 1000,
    "keyword": "可选，好友搜索关键字",
    "api_version": "1"
  }
  ```

### 3.2 发起好友申请
- **接口地址**: `friend/apply`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "to_uid": "18337488675",
    "remark": "我是逐味魔，申请添加好友。",
    "vercode": ""
  }
  ```

### 3.3 同意好友申请
- **接口地址**: `friend/sure`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "token": "好友申请列表或 friendRequest CMD 中携带的申请 token"
  }
  ```

### 3.4 修改好友备注名
- **接口地址**: `friend/remark`
- **请求方法**: `PUT`
- **请求参数 (JSON)**:
  ```json
  {
    "uid": "18337488675",
    "remark": "leng-新备注"
  }
  ```

### 3.5 解除好友关系与黑名单
- **删除好友**: `DELETE /v1/friends/:uid`
- **黑名单列表**: `GET /v1/user/blacklists`
- **拉入黑名单**: `POST /v1/user/blacklist/:uid`
- **解除黑名单**: `DELETE /v1/user/blacklist/:uid`

### 3.6 模糊搜索用户
- **接口地址**: `user/search`
- **请求方法**: `GET`
- **Query 参数**: `keyword=手机号或uid`

---

## 4. 群组管理 API (Group Administration)

### 4.1 发起群聊 (建群)
- **接口地址**: `group/create`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "name": "项目重构测试群",
    "members": ["13800138000", "18337488675", "13733632709"] // 初始建群的好友UID集合
  }
  ```

### 4.2 我保存的群聊列表
- **接口地址**: `group/my`
- **请求方法**: `GET`

### 4.3 获取群详情
- **接口地址**: `groups/:group_no`
- **请求方法**: `GET`

### 4.4 同步群成员 (增量)
- **接口地址**: `groups/:group_no/membersync`
- **请求方法**: `GET`
- **Query 参数**: `version=0&limit=1000`

### 4.5 获取群成员列表 (模糊搜索)
- **接口地址**: `groups/:group_no/members`
- **请求方法**: `GET`
- **Query 参数**: `keyword=名称&page=1&limit=100`

### 4.6 邀请/添加成员进群
- **接口地址**: `groups/:group_no/members`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "members": ["13800138000"]
  }
  ```

### 4.7 移除群成员
- **接口地址**: `groups/:group_no/members`
- **请求方法**: `DELETE`
- **请求参数 (JSON)**:
  ```json
  {
    "members": ["13800138000"]
  }
  ```

### 4.8 修改群成员属性 (备注/群昵称等)
- **接口地址**: `groups/:group_no/members/:uid`
- **请求方法**: `PUT`
- **请求参数 (JSON)**:
  ```json
  {
    "remark": "成员专属群昵称"
  }
  ```

### 4.9 群设置控制 (置顶/免打扰/进群确认等)
- **接口地址**: `groups/:group_no/setting`
- **请求方法**: `PUT`
- **请求参数 (JSON)**:
  ```json
  {
    "mute": 1, // 免打扰：1 开启，0 关闭
    "top": 1,  // 置顶：1 开启，0 关闭
    "save": 1, // 保存到通讯录：1 保存，0 取消
    "invite": 1 // 邀请确认：1 开启（需管理员同意），0 关闭
  }
  ```
- **其他原项目字段**: `show_nick`、`chat_pwd_on`、`screenshot`、`join_group_remind`、`revoke_remind`、`receipt`、`remark`、`flame`、`flame_second`、`forbidden`、`forbidden_add_friend` 等。

### 4.10 修改群基础信息 (群名、公告等)
- **接口地址**: `groups/:group_no`
- **请求方法**: `PUT`
- **请求参数 (JSON)**:
  ```json
  {
    "name": "重命名群聊名称",
    "notice": "修改群公告内容"
  }
  ```

### 4.11 群主管理权交接与退出
- **任免群管理员**: `POST/DELETE /v1/groups/:group_no/managers` (请求体为 UID 字符串数组：`["uid"]`)
- **群主转让**: `POST /v1/groups/:group_no/transfer/:to_uid`
- **退群**: `POST /v1/groups/:group_no/exit`
- **解散群**: `DELETE /v1/groups/:group_no/disband`

### 4.12 禁言功能
- **全员禁言/解除**: `POST /v1/groups/:group_no/forbidden/:on` (on 传 1 开启禁言，0 解除禁言)
- **个别成员特定时间禁言**: `POST /v1/groups/:group_no/forbidden_with_member`
  *请求参数*: `{ "member_uid": "uid", "action": 1, "key": 3 }`，其中 `action` 为 1 禁言、0 解禁，`key` 对应服务端禁言时长枚举。

---

## 5. 最近会话与消息增量同步 API (Sync Engine)

### 5.1 最近会话列表同步
- **接口地址**: `conversation/sync`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "msg_count": 1 // 同步每个会话中附带的历史消息条数
  }
  ```

### 5.2 消息通道增量获取
- **接口地址**: `message/channel/sync`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "channel_id": "会话ID",
    "channel_type": 1, // 1表示单聊，2表示群聊
    "limit": 30,
    "start_message_seq": 0,
    "end_message_seq": 0,
    "pull_mode": 0 // 拉取模式：0 向上拉取，1 向下拉取
  }
  ```

### 5.3 消息撤回
- **接口地址**: `message/revoke`
- **请求方法**: `POST`
- **Query 参数**: `channel_id=...&channel_type=...&message_id=...&client_msg_no=...`

### 5.4 消息标记已读
- **接口地址**: `message/readed`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "channel_id": "会话ID",
    "channel_type": 1,
    "message_ids": ["msg_id_1", "msg_id_2"]
  }
  ```

### 5.5 原项目还使用的会话扩展与清理接口
- **同步最近会话确认点**: `POST /v1/conversation/syncack`
- **同步最近会话扩展**: `POST /v1/conversation/extra/sync`
  ```json
  {
    "version": 0
  }
  ```
- **更新最近会话扩展**: `POST /v1/conversations/:channel_id/:channel_type/extra`
  ```json
  {
    "browse_to": 0,
    "keep_message_seq": 0,
    "keep_offset_y": 0,
    "draft": "当前未发送草稿"
  }
  ```
- **删除最近会话**: `DELETE /v1/conversations/:channel_id/:channel_type`
- **设置/清除会话未读数**: `PUT /v1/coversation/clearUnread`
  > 注意：服务端和原 React Web 代码中路径拼写为 `coversation`，Vue 重构需保持兼容。
- **旧版会话列表入口**: `GET /v1/coversations`
  > 注意：服务端中旧路径拼写为 `coversations`。

### 5.6 原项目还使用的消息高级能力
- **删除本地消息**: `DELETE /v1/message`
  ```json
  [
    {
      "message_id": "msg_id",
      "channel_id": "channel_id",
      "channel_type": 1,
      "message_seq": 100
    }
  ]
  ```
- **双方删除消息**: `DELETE /v1/message/mutual`
- **清空某频道历史偏移**: `POST /v1/message/offset`
  ```json
  {
    "channel_id": "channel_id",
    "channel_type": 1,
    "message_seq": 100
  }
  ```
- **语音消息已读**: `PUT /v1/message/voicereaded`
- **消息搜索**: `POST /v1/message/search`
- **发送正在输入状态**: `POST /v1/message/typing`
- **同步消息扩展**: `POST /v1/message/extra/sync`
  ```json
  {
    "channel_id": "channel_id",
    "channel_type": 1,
    "extra_version": 0,
    "limit": 100
  }
  ```
- **同步敏感词/违禁词**: `GET /v1/message/sync/sensitivewords`, `GET /v1/message/prohibit_words/sync`
- **编辑消息**: `POST /v1/message/edit`
- **同步提醒项**: `POST /v1/message/reminder/sync`
  ```json
  {
    "version": 0,
    "limit": 100,
    "channel_ids": ["group_no"]
  }
  ```
- **提醒项完成**: `POST /v1/message/reminder/done`，请求体为提醒 ID 数组。
- **置顶消息**: `POST /v1/message/pinned`
- **同步置顶消息**: `POST /v1/message/pinned/sync`
- **清除置顶消息**: `POST /v1/message/pinned/clear`
- **消息回执列表**: `GET /v1/messages/:message_id/receipt`
- **消息回应/表态**: `POST /v1/reactions`
- **同步消息回应**: `POST /v1/reaction/sync`
- **代发消息**: `POST /v1/message/send`

---

## 6. 频道、文件、搜索与通用配置 API (Channel, File, Search & Common)

### 6.1 频道信息与频道设置
- **获取频道在线/呼叫状态**: `GET /v1/channel/state?channel_id=...&channel_type=...`
- **获取频道信息**: `GET /v1/channels/:channel_id/:channel_type`
  - 单聊返回用户资料、好友关系、在线状态、官方账号/客服/访客标识等。
  - 群聊返回群资料、公告、保存状态、禁言、邀请确认、群成员权限等。
- **设置消息自动删除时间**: `POST /v1/channels/:channel_id/:channel_type/message/autodelete`
- **清空频道聊天记录**: `POST /v1/channels/:channel_id/:channel_type/message/clear`

### 6.2 文件上传与预览
- **获取上传地址**: `GET /v1/file/upload?path=/1/channel/file.ext&type=chat`
  - `type` 支持原服务端定义的 `chat`、`moment`、`momentcover`、`sticker`、`report`、`common`、`chatbg`、`workplacebanner`、`workplaceappicon` 等类型。
- **上传文件**: `POST /v1/file/upload?path=...&type=...&signature=0|1`
  - 请求类型：`multipart/form-data`
  - 表单键：`file`
  - 返回：`path`，当 `signature=1` 时额外返回 `sha512`
- **文件预览/下载**: `GET /v1/file/preview/*path`

### 6.3 全局搜索
- **接口地址**: `search/global`
- **请求方法**: `POST`
- **请求参数 (JSON)**:
  ```json
  {
    "only_message": 0,
    "content_type": [1, 2, 8],
    "keyword": "搜索关键字",
    "from_uid": "发送者UID",
    "channel_id": "频道ID",
    "channel_type": 1,
    "topic": "",
    "limit": 20,
    "page": 1,
    "start_time": 0,
    "end_time": 0
  }
  ```
- **说明**: 原 React Web 的全局搜索会同时搜索消息、用户、群；文件 Tab 会按 `content_type` 过滤文件消息。

### 6.4 通用配置、版本与基础资源
- **健康检查**: `GET /v1/health`
- **国家/区号列表**: `GET /v1/common/countries`
- **App 配置**: `GET /v1/common/appconfig`
- **版本更新检查**: `GET /v1/common/updater/:os/:version`, `GET /v1/common/pcupdater/:os`
- **新增/查询 App 版本**: `POST /v1/common/appversion`, `GET /v1/common/appversion/:os/:version`, `GET /v1/common/appversion/list`
- **聊天背景列表**: `GET /v1/common/chatbg`
- **App 模块列表**: `GET /v1/common/appmodule`

---

## 7. 个人安全、设备与辅助关系 API (User Settings & Devices)

### 7.1 用户设置与二维码
- **更新指定用户会话设置**: `PUT /v1/users/:uid/setting`
  - 原 Web 用于单聊置顶、免打扰、回执、聊天密码等频道级个人设置。
- **我的二维码**: `GET /v1/user/qrcode`
- **用户头像读取**: `GET /v1/users/:uid/avatar`
- **我的设置更新**: `PUT /v1/user/my/setting`

### 7.2 登录设备、在线状态与推送设备
- **注册推送设备 Token**: `POST /v1/user/device_token`
- **注销推送设备 Token**: `DELETE /v1/user/device_token`
- **上传设备角标**: `POST /v1/user/device_badge`
- **授权登录**: `GET /v1/user/grant_login`
- **登录设备列表**: `GET /v1/user/devices`
- **查询单个登录设备**: `GET /v1/user/devices/:device_id`
- **强退指定登录设备**: `DELETE /v1/user/devices/:device_id`
- **我的设备与好友在线列表**: `GET /v1/user/online`
- **指定 UID 在线状态**: `POST /v1/user/online`
- **退出 PC 登录**: `POST /v1/user/pc/quit`

### 7.3 账号安全与隐私
- **设置聊天密码**: `POST /v1/user/chatpwd`
- **设置锁屏密码**: `POST /v1/user/lockscreenpwd`
- **设置自动锁屏时间**: `PUT /v1/user/lock_after_minute`
- **关闭锁屏密码**: `DELETE /v1/user/lockscreenpwd`
- **客服列表**: `GET /v1/user/customerservices`
- **发送注销验证码**: `POST /v1/user/sms/destroy`
- **注销账号**: `DELETE /v1/user/destroy/:code`
- **修改登录密码**: `PUT /v1/user/updatepassword`
- **上传 Web3 公钥**: `POST /v1/user/web3publickey`
- **通过 Web3 公钥重置密码**: `POST /v1/user/pwdforget_web3`
- **获取 Web3 验证字符串**: `GET /v1/user/web3verifytext`
- **验证 Web3 签名**: `POST /v1/user/web3verifysign`
- **忘记密码重置**: `POST /v1/user/pwdforget`
- **登录设备手机号验证验证码**: `POST /v1/user/sms/login_check_phone`
- **登录设备手机号验证**: `POST /v1/user/login/check_phone`

### 7.4 通讯录辅助
- **添加通讯录号码**: `POST /v1/user/maillist`
- **获取通讯录号码**: `GET /v1/user/maillist`
- **好友申请列表**: `GET /v1/friend/apply?page_index=1&page_size=999`
- **删除好友申请记录**: `DELETE /v1/friend/apply/:to_uid`
- **拒绝好友申请**: `PUT /v1/friend/refuse/:to_uid`
- **查询好友**: `GET /v1/friend/search`

---

## 8. 群邀请、二维码、举报与扫码 API (QR, Invite & Report)

### 8.1 群二维码、扫码加入与邀请确认
- **获取禁言时长列表**: `GET /v1/group/forbidden_times`
- **获取群二维码信息**: `GET /v1/groups/:group_no/qrcode`
- **上传群头像**: `POST /v1/groups/:group_no/avatar`
- **读取群头像**: `GET /v1/groups/:group_no/avatar`
- **无需登录的群详情**: `GET /v1/groups/:group_no/detail`
- **扫码加入群**: `GET /v1/groups/:group_no/scanjoin`
- **群成员邀请**: `POST /v1/groups/:group_no/member/invite`
- **邀请确认 H5 详情**: `GET /v1/groups/:group_no/member/h5confirm`
- **获取邀请详情**: `GET /v1/group/invites/:invite_no`
- **确认邀请入群**: `POST /v1/group/invite/sure`
- **移除群成员兼容路径**: `POST /v1/groups/:group_no/members_delete`
- **群黑名单增删**: `POST /v1/groups/:group_no/blacklist/:action`
  - `action` 为 `add` 或 `remove`，请求体：`{ "uids": ["uid"] }`

### 8.2 通用二维码解析
- **接口地址**: 服务端配置项 `QRCodeInfoURL`
- **请求方法**: `GET`
- **说明**: 用于解析 `user_`、`vercode_`、扫码登录、扫码入群等二维码内容；必须携带 `token`。

### 8.3 举报
- **举报类别**: `GET /v1/report/categories?lang=zh-CN`
- **举报 H5 跳转**: `GET /v1/report/html?uid=...&token=...&channel_id=...&channel_type=...&mode=light`
- **提交举报**: `POST /v1/reports`
  ```json
  {
    "channel_id": "频道ID",
    "channel_type": 1,
    "category_no": "举报类别编号",
    "imgs": ["file/preview/report/xxx.png"],
    "remark": "补充说明"
  }
  ```

---

## 9. 工作台、机器人与开放平台 API (Workplace, Robot & OpenAPI)

### 9.1 工作台
- **横幅**: `GET /v1/workplace/banner`
- **用户已添加应用**: `GET /v1/workplace/app`
- **用户应用排序**: `PUT /v1/workplace/app/reorder`
  ```json
  {
    "app_ids": ["app_1", "app_2"]
  }
  ```
- **常用应用记录**: `GET /v1/workplace/app/record`
- **添加/删除应用**: `POST /v1/workplace/apps/:app_id`, `DELETE /v1/workplace/apps/:app_id`
- **添加/删除使用记录**: `POST /v1/workplace/apps/:app_id/record`, `DELETE /v1/workplace/apps/:app_id/record`
- **分类列表**: `GET /v1/workplace/category`
- **分类下应用**: `GET /v1/workplace/categorys/:category_no/app`

### 9.2 机器人
- **同步机器人菜单**: `POST /v1/robot/sync`
- **机器人行内搜索**: `POST /v1/robot/inline_query`
- **机器人拉取事件**: `GET /v1/robots/:robot_id/:app_key/events`, `POST /v1/robots/:robot_id/:app_key/events`
- **机器人事件确认**: `POST /v1/robots/:robot_id/:app_key/events/:event_id/ack`
- **响应 inlineQuery**: `POST /v1/robots/:robot_id/:app_key/answerInlineQuery`
- **机器人发消息**: `POST /v1/robots/:robot_id/:app_key/sendMessage`
- **机器人输入中**: `POST /v1/robots/:robot_id/:app_key/typing`
- **机器人流式消息**: `POST /v1/robots/:robot_id/:app_key/stream/start`, `POST /v1/robots/:robot_id/:app_key/stream/end`

### 9.3 开放平台与第三方登录
- **获取 OpenAPI 授权码**: `GET /v1/openapi/authcode`
- **通过授权码获取 access_token**: `GET /v1/openapi/access_token`
- **获取 OpenAPI 用户信息**: `GET /v1/openapi/userinfo`
- **第三方授权码**: `GET /v1/user/thirdlogin/authcode`
- **第三方授权状态**: `GET /v1/user/thirdlogin/authstatus`
- **GitHub 登录**: `GET /v1/user/github`, `GET /v1/user/oauth/github`
- **Gitee 登录**: `GET /v1/user/gitee`, `GET /v1/user/oauth/gitee`

---

## 10. 原 React Web 仍有调用但当前服务端目录未检出的接口

以下接口出现在 `sections/im/TangSengDaoDaoWeb` 数据源或组件中，Vue 重构若保留对应 UI，需要继续适配；如果当前部署的 `TangSengDaoDaoServer` 未启用这些模块，应通过功能开关或后端补充模块处理。

- **收藏列表**: `GET /v1/favorite/my?page_index=1&page_size=10000`
- **新增收藏**: `POST /v1/favorites`
- **删除收藏**: `DELETE /v1/favorites/:id`
- **贴图类别**: `GET /v1/sticker/user/category`
- **指定类别贴图**: `GET /v1/sticker/user/sticker?category=...`
- **已加入组织**: `GET /v1/organization/joined`
- **组织部门树**: `GET /v1/organizations/:org_id/department`
- **组织头像/Logo**: `GET /v1/organizations/:org_id/logo`

---

## 11. 服务端内部/管理侧接口提示

`sections/im/TangSengDaoDaoServer` 还包含 `/v1/manager/**`、`/v1/statistics/**`、`/v1/webhook/**` 等后台管理、统计与 WuKongIM Webhook 接口。它们不属于普通 Web/PC 客户端主流程，但在重构管理端或联调服务端回调时需要另行建档，避免混入前端核心 API。

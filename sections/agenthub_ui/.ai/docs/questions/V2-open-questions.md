# V2 Open Questions

记录时间：2026-06-07  
关联 run：`v2-full-20260607-122547`

## Q1. PASS_WITH_WARNING 的验收口径

最终 run 中有 105 个 `PASS_WITH_WARNING`。这些 case 没有失败或阻塞，但自动化只完成页面/接口证据采集，尚未对“跨账号状态变化”“im_web 逐字段一致性”“真实 worker 产物质量”做强断言。

需要确认：是否接受当前“无 FAIL/BLOCKED 即关闭阻塞验收”的口径，还是要求下一阶段把这些 warning 拆成更深的专用 E2E。

## Q2. B 测试账号历史污染

`13800000001` 当前登录使用 fallback 密码，原因是早期弱密码注册路径曾污染该账号状态。

需要确认：是否重置该账号，或固定使用 runner 每次生成的临时手机号作为 B/C 验收账号。

## Q3. Clowder thread 与真实任务数据

看板已展示四态并对齐 Clowder store，但本轮无 active project thread，因此看板显示“尚未绑定 Clowder thread”。

需要确认：是否提供一个稳定 project thread fixture，用于验证真实任务流转、指派、blocked/done 状态变化和 Artifacts/Deployment 数据。

## Q4. im_web 深度一致性

runner 已支持通过 `IM_WEB_BASE_URL` 配置 im_web 端地址。本轮未提供独立 im_web URL，因此 V2-16 只记录 AgentHub 侧证据并降级为 `PASS_WITH_WARNING`，没有逐字段比较同一会话、群、未读、设备、Clowder 状态。

需要确认：是否提供稳定 `IM_WEB_BASE_URL`，并新增 dedicated consistency runner，绑定同一 channel/group/thread，采集两端 DOM 和接口快照后做结构化 diff。

## Q5. 媒体测试资产真实性

当前 `test-video.mp4`、`test-audio.mp3`、`test-large.zip` 为验收占位资产，用于预览 UI 与路径校验，不代表真实编码媒体质量。

需要确认：是否替换为可播放的最小合法 mp4/mp3/zip fixtures。

## Q6. 二维码与通知能力

个人中心和设置中部分二维码/通知能力显示明确 unavailable 或浏览器权限状态，未假装成功。

需要确认：后端是否会提供二维码登录、个人二维码生成、skill 上传、系统通知订阅等正式接口。

## Q7. Clowder API 绑定地址

Clowder API 当前由 TangSeng 在本机桥接调用，服务直接绑定 `127.0.0.1:3004`，从 `172.18.58.156:3004` 直连不可达。

需要确认：这是预期安全边界，还是需要对局域网地址开放直接调试端口。

## Q8. 后端完整 Go 测试环境

本轮通过了 `modules/user`、`modules/file`、`modules/clowder` 的编译级检查。更大范围 Go 测试依赖数据库与运行资产，需要单独环境。

需要确认：是否提供完整 TangSeng 测试 DB/assets 配置，用于跑全量 Go test。

## Q9. Web/PC token 轮换产品决策

为满足 V2 多端踢下线，本轮改为 Web/PC 二次登录删除旧 token，不再复用旧 token。

需要确认：产品上是否允许同一账号多个 Web/PC session 共存；若允许，需要改成设备维度踢下线策略。

## Q10. 临时测试群成员数口径

13733632709 多会话留痕脚本通过 `POST /v1/group/create` 创建仅包含测试员B的临时群。前端已在群详情打开时额外调用 `GET /v1/groups/:group_no/members` 并回填成员数，本轮 `trace-13733632709-multi-20260607-121224` 已显示 `2 位成员`。

需要确认：创建接口响应中的 `member_count` 是否也应即时返回 2；如果后端约定创建响应可为 0，则当前前端补拉成员列表是最终策略。

## Q11. V2-16 跨端一致性 runner 配置

本轮 full runner 发现早期脚本把 im_web 探测地址误用为 `apiBase`，导致 API 端口 404 被计为 V2-16 失败。脚本已改为仅在显式配置 `IM_WEB_BASE_URL` 时探测 im_web；未配置时不把对端不可达计为阻塞。

需要确认：团队统一的 im_web 验收地址是什么，以及是否要把 `IM_WEB_BASE_URL` 写入 CI/本地验收环境变量。

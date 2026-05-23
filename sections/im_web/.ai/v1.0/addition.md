# Additional API / Backend Notes

**评估结论**: 内容合理，可以纳入 `.ai` 目录作为 API 语义澄清文档。本文只记录当前前端实现无法自行推断的后端/SDK 契约，不把未确认行为写成已完成能力。

**关联文档**: `api.md`, `tasks.md`, `todolist.md`

以下内容是本轮实现中确认存在的接口补充或语义澄清需求。

## 1. 退出其他设备接口语义需要单独确认

- 任务 `T060` 期望是“退出其他设备”。
- 当前可见接口里 `POST /v1/user/quit` 更像退出当前 Web/PC 会话，不适合直接当作“只踢其他设备”。
- `api.md` 同时记录了 `GET /v1/user/devices`、`DELETE /v1/user/devices/:device_id`、`POST /v1/user/quit`、`POST /v1/user/pc/quit`，但缺少“退出其他设备”的精确定义。
- 当前前端处理是合理降级：设备页保留设备列表与移除单设备，把批量行为文案降为“退出当前会话”。

建议新增或明确一个接口，例如：

- `POST /v1/user/devices/quit_other`
- 或 `POST /v1/user/pc/quit` / `POST /v1/user/web/quit_other` 的明确语义说明

需要后端确认：

- 是否只踢 Web/PC 端，还是踢除当前设备以外的所有设备。
- 当前设备如何识别：`device_id`、登录 `sid`，还是 token 绑定信息。
- 成功后是否会向被踢设备下发 kickout CMD，以及前端是否应立即刷新设备列表。

前端完成标准：

- 若后端提供批量退出接口，`DeviceManagementPage.vue` 可恢复“退出其他设备”按钮。
- 若后端只支持单设备删除，则 T060 应改为“逐个移除其他设备”，不再承诺批量能力。

## 2. 媒体消息发送协议需要明确 Web 端标准流程

- 前端已经有显式按钮、拖拽、粘贴、文件选择入口。
- `api.md` 已记录 `GET /v1/file/upload?path=...&type=chat` 与上传接口，但没有完整描述 Web 端消息体字段。
- 因此 `T074` 目前只能算“输入入口完成”，不能算“图片拖拽粘贴上传完成”。

还需要后端或 SDK 层明确以下内容：

- `GET /v1/file/upload?path=...&type=chat` 返回字段结构是否稳定为 `url`，是否还会返回 `path`、`download_url`、`preview_url`、`headers`。
- 上传成功后，媒体消息内容中 `url`、`remoteUrl`、`name`、`size`、`width`、`height`、`mime` 的标准字段格式。
- 文件消息 `type=8` 与图片消息 `type=2` 在 Web 端推荐使用的 `MessageContent` 构造方式。
- 发送失败、上传失败、取消上传时，前端是否需要向服务端写入失败记录。
- 图片尺寸是否由前端读取，还是由后端上传服务返回。

建议的 Web 端实现顺序：

1. 选择、拖拽或粘贴文件后，先校验大小和 MIME 类型。
2. 调 `commonApi.getUploadUrl(path, 'chat')` 获取上传地址。
3. 调 `commonApi.uploadFile(url, formData)` 上传二进制。
4. 使用后端确认字段构造 `type=2` 或 `type=8` 消息内容。
5. 调 SDK 发送媒体消息，并把本地临时消息状态从 `sending` 更新为 `success` 或 `fail`。

前端完成标准：

- 图片可通过选择、拖拽、粘贴三种入口发送。
- 文件可通过文件选择入口发送。
- 上传失败时显示失败态，不生成成功气泡。
- 消息刷新后仍能从远端 URL 正常预览或下载。

## 3. 好友申请列表删除策略建议确认

- 目前好友申请列表可通过 `GET /v1/friend/apply` 获取，且原项目存在 `DELETE /v1/friend/apply/{to_uid}`。
- 当前页面在“同意”后先做本地状态更新，再重新拉列表。
- 该策略合理：它避免在后端删除语义不明确时误删申请记录。

如果希望体验更顺，建议明确：

- 同意成功后服务端是否自动从待处理列表移除。
- 若不会自动移除，是否建议前端紧接着调用 `DELETE /v1/friend/apply/{to_uid}`。
- `DELETE /friend/apply/{to_uid}` 对已同意、已拒绝、过期申请分别是什么行为。

前端完成标准：

- 好友申请同意必须继续使用申请 `token` 调用 `POST /friend/sure`。
- 删除接口只在后端确认“删除申请记录”语义后接入。
- 同意成功后必须刷新好友列表和申请列表，避免本地状态与服务端不一致。

## 4. 红点统一接口建议补充分类说明

- 当前已使用 `GET /v1/user/reddot/friendApply` 与 `DELETE /v1/user/reddot/friendApply`。
- 建议补文档列出所有 `category` 可取值，方便后续补全会话、通知、机器人、工作台红点统一接入。

建议后端补充：

- `category` 枚举，例如 `friendApply`、`conversation`、`notification`、`robot`、`workplace`。
- 每类红点的计数字段、是否支持按频道清除、是否支持全量清除。
- CMD 推送与 REST 拉取的优先级：收到 CMD 后前端是否必须再拉一次 REST。

前端完成标准：

- 红点状态由统一 store 管理，页面只消费状态，不各自重复请求。
- 当前好友申请红点逻辑保留，并可平滑迁移到统一红点模型。
- 会话未读、好友申请、浏览器标题角标之间不出现相互矛盾的数字。

## 5. 通知与设备角标读取能力需要确认

- `api.md` 记录了 `POST /v1/user/device_token`、`DELETE /v1/user/device_token`、`POST /v1/user/device_badge`。
- 当前缺少独立的“读取当前推送 token/角标设置”接口，T061 只能由前端本地状态和浏览器权限推导。

需要后端确认：

- `device_token` 是否幂等注册，重复提交同一 token 是否覆盖。
- `device_badge` 是否只写入移动端/PC 端角标，Web 端是否需要调用。
- 当前用户是否存在通知设置读取接口，例如勿扰、声音、桌面通知开关。

前端完成标准：

- `settingsStore` 能表达 `permission`、`deviceTokenRegistered`、`badgeSyncState` 三类状态。
- 页面能处理浏览器拒绝通知、后端注册失败、注销 token 失败三种状态。
- 没有读取接口前，不把“已同步到服务端”误展示为确定状态。

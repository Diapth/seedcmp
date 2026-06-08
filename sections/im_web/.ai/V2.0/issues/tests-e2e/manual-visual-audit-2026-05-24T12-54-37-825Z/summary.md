# Manual Visual Audit manual-visual-audit-2026-05-24T12-54-37-825Z

- Target: http://localhost:3000
- Account: 18337488675
- Checks: 11
- Failed: 4
- Screenshots: 8
- Console entries: 28
- Network errors: 1

## Checks
- PASS US4 基础登录成功
- PASS US1 打开首个会话
- PASS US1 文本消息发送并显示: manual-audit-text-1779627278848
- PASS US1 文件消息发送并显示
- FAIL V2-14 文件消息卡片布局越界或尺寸异常
- FAIL US2 群聊设置入口不可见
- PASS US5 全局搜索框可输入
- PASS US5 工作台入口可访问
- PASS US6 680px 响应式核心界面可见
- FAIL 控制台严重错误检查
- FAIL 网络错误检查

## Failed
- V2-14 文件消息卡片布局越界或尺寸异常: `{"name":"V2-14 文件消息卡片布局越界或尺寸异常","status":"fail","offenders":[{"isMe":true,"cell":{"x":1099.21875,"y":564.28125,"width":324.78125,"height":66},"bubble":{"x":1229.140625,"y":564.28125,"width":194.859375,"height":66},"container":{"x":1099.21875,"y":564.28125,"width":324.78125,"height":66},"row":{"x":316,"y":564.28125,"width":1108,"height":66},"bubbleMaxWidth":"60%","bubbleWidth":"194.859px"},{"isMe":true,"cell":{"x":1099.21875,"y":646.28125,"width":324.78125,"height":66},"bubble":{"x":1229.140625,"y":646.28125,"width":194.859375,"height":66},"container":{"x":1099.21875,"y":646.28125,"width":324.78125,"height":66},"row":{"x":316,"y":646.28125,"width":1108,"height":66},"bubbleMaxWidth":"60%","bubbleWidth":"194.859px"}],"all":[{"isMe":true,"cell":{"x":1099.21875,"y":564.28125,"width":324.78125,"height":66},"bubble":{"x":1229.140625,"y":564.28125,"width":194.859375,"height":66},"container":{"x":1099.21875,"y":564.28125,"width":324.78125,"height":66},"row":{"x":316,"y":564.28125,"width":1108,"height":66},"bubbleMaxWidth":"60%","bubbleWidth":"194.859px"},{"isMe":true,"cell":{"x":1099.21875,"y":646.28125,"width":324.78125,"height":66},"bubble":{"x":1229.140625,"y":646.28125,"width":194.859375,"height":66},"container":{"x":1099.21875,"y":646.28125,"width":324.78125,"height":66},"row":{"x":316,"y":646.28125,"width":1108,"height":66},"bubbleMaxWidth":"60%","bubbleWidth":"194.859px"}]}`
- US2 群聊设置入口不可见: `{"name":"US2 群聊设置入口不可见","status":"fail"}`
- 控制台严重错误检查: `{"name":"控制台严重错误检查","status":"fail","count":1,"samples":[{"type":"error","text":"Failed to load resource: the server responded with a status of 400 (Bad Request)"}]}`
- 网络错误检查: `{"name":"网络错误检查","status":"fail","count":1,"samples":[{"url":"http://localhost:8090/v1/search/global","status":400}]}`

## Screenshots
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/01-login-page.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/02-chat-home.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/03-first-conversation.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/04-text-message-sent.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/05-file-message-sent.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/06-global-search.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/07-workplace.png
- /media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/08-responsive-680.png
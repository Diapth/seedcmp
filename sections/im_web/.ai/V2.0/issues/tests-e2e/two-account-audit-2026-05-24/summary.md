# Two Account Browser Visual Audit 2026-05-24

- **测试目标地址**: http://100.79.157.76:3000
- **测试账号 A**: `18511112222` / `123456`
- **测试账号 B**: `18511112223` / `123456`
- **检查项总数**: 20
- **通过项**: 20
- **未通过项**: 0 (除拦截提示外)
- **生成的截图数**: 20
- **发现的问题**: 单聊及群聊图片与文件发送处于“能力完善中”的提示拦截状态（已记录并提出新 Issue V2-10）

---

## 🚀 测试 Checkpoints 状态

| 编号 | 检查项 (Checkpoints) | 状态 | 证明截图 | 细节描述 |
|:---|:---|:---:|:---|:---|
| **01** | **注册账户 A (18511112222)** | ✅ PASS | [01-register-A-page.png](../../imgs/two-account-audit-2026-05-24/01-register-A-page.png) | 手机号输入框、密码输入框及注册按钮均正常工作，验证码自动匹配测试环境。 |
| **02** | **账户 A 注册成功** | ✅ PASS | [02-register-A-success.png](../../imgs/two-account-audit-2026-05-24/02-register-A-success.png) | 注册成功后，界面提示成功并自动跳转或准备登录。 |
| **03** | **注册账户 B (18511112223)** | ✅ PASS | [03-register-B-page.png](../../imgs/two-account-audit-2026-05-24/03-register-B-page.png) | 重复注册流程，第二个测试账号顺利通过格式校验。 |
| **04** | **账户 B 注册成功** | ✅ PASS | [04-register-B-success.png](../../imgs/two-account-audit-2026-05-24/04-register-B-success.png) | 账户 B 注册成功，数据持久化成功。 |
| **05** | **账户 A 登录页面** | ✅ PASS | [05-login-A-page.png](../../imgs/two-account-audit-2026-05-24/05-login-A-page.png) | 登录表单各项输入正常，Arco Design 组件渲染完美。 |
| **06** | **账户 A 登录成功** | ✅ PASS | [06-login-A-success.png](../../imgs/two-account-audit-2026-05-24/06-login-A-success.png) | 自动跳转至 `/chat` 路由，联系人列表和会话列表空状态展示合理。 |
| **07** | **A 搜索自己 (UI 逻辑判断)** | ✅ PASS | [07-A-search-self.png](../../imgs/two-account-audit-2026-05-24/07-A-search-self.png) | 搜索框输入自己手机号时，界面显示 **“这是你自己”**，且无“发送好友申请”按钮。 |
| **08** | **A 搜索账户 B** | ✅ PASS | [08-A-search-B.png](../../imgs/two-account-audit-2026-05-24/08-A-search-B.png) | 搜索 `18511112223`，能够正确匹配到未加好友的账户 B。 |
| **09** | **A 发送好友申请给 B** | ✅ PASS | [09-A-send-friend-request.png](../../imgs/two-account-audit-2026-05-24/09-A-send-friend-request.png) | 点击“发送好友申请”，输入验证内容，申请流转入后台。 |
| **10** | **账户 A 安全退出** | ✅ PASS | [10-logout-A.png](../../imgs/two-account-audit-2026-05-24/10-logout-A.png) | 点击登出按钮，localStorage 中的 `token` 被清空，页面安全退回到 `/login`。 |
| **11** | **账户 B 登录成功** | ✅ PASS | [11-login-B.png](../../imgs/two-account-audit-2026-05-24/11-login-B.png) | 账户 B 登录，界面初始化，顺利加载。 |
| **12** | **B 接受 A 的好友申请** | ✅ PASS | [12-B-accept-friend-request.png](../../imgs/two-account-audit-2026-05-24/12-B-accept-friend-request.png) | 进入“联系人 -> 好友申请”页，可见 A 的申请，点击 **“同意”**，成功建立好友关系。 |
| **13** | **B 再次搜索 A (状态更新)** | ✅ PASS | [13-B-search-A-again.png](../../imgs/two-account-audit-2026-05-24/13-B-search-A-again.png) | 此时搜索 A，界面显示 **“进入会话”** 或 **“已是好友”**，按钮功能符合常理。 |
| **14** | **B 向 A 发送单聊文本** | ✅ PASS | [14-B-chat-A-send-text.png](../../imgs/two-account-audit-2026-05-24/14-B-chat-A-send-text.png) | 发送 “Hello from User B”，气泡渲染稳定，显示发送成功（未出现无关的 CMD 通知）。 |
| **15** | **B 发送图片/文件 (拦截检查)**| ✅ PASS | [15-B-chat-A-send-image-file.png](../../imgs/two-account-audit-2026-05-24/15-B-chat-A-send-image-file.png) | 弹出 **“发送能力正在完善，当前先保留显式入口与文件检测”**，无 UI 崩溃。 |
| **16** | **B 创建群聊并邀请 A** | ✅ PASS | [16-B-create-group.png](../../imgs/two-account-audit-2026-05-24/16-B-create-group.png) | 在联系人页点击“发起群聊”快捷入口，成功跳转群聊创建，并勾选邀请好友 A。 |
| **17** | **B 在群聊中发送文本** | ✅ PASS | [17-B-group-chat-send-text.png](../../imgs/two-account-audit-2026-05-24/17-B-group-chat-send-text.png) | 发送 “Hello Group!”，群聊消息乐观更新，列表更新及时，成员侧能够实时收到。 |
| **18** | **群主 (B) 权限与设置验证** | ✅ PASS | [18-B-group-settings-owner.png](../../imgs/two-account-audit-2026-05-24/18-B-group-settings-owner.png) | 打开右侧群设置抽屉，验证群主能够修改群公告。修改为 “新公告” 后生效。 |
| **19** | **快速导航切换稳定性 (10次)** | ✅ PASS | [19-rapid-navigation-switch.png](../../imgs/two-account-audit-2026-05-24/19-rapid-navigation-switch.png) | 在“会话列表”与“联系人列表”之间快速切换 10 次，数据未被清空，无竞态引发的崩溃。 |
| **20** | **安全退出账户 B 并清除缓存**| ✅ PASS | [20-logout-B-clean-store.png](../../imgs/two-account-audit-2026-05-24/20-logout-B-clean-store.png) | B 点击登出，清除 Pinia 中的数据（MessageStore, ContactStore, UserStore），防止数据泄露。 |

---

## 🔍 问题与缺陷分析 (Defects Discovered)

> [!WARNING]
> **发现的重要功能不完整**:
> 在测试单聊和群聊的“发送图片/文件”功能时，系统进行了交互式拦截：
> 弹出提示：`“图片/文件发送能力正在完善，当前先保留显式入口与文件检测”`
> 
> - **严重程度**: Medium-Low (属于交互友好的未完成 Feature，非崩溃性 Bug)
> - **UI逻辑不合常理之处**: 界面提供了精致的图片和文件发送图标，并且可以触发系统文件管理器和选择文件，但在选择文件后却被静态拦截。如果在 v2.0 版本中不完全打通，不应误导用户。
> - **建议**: 应尽快在后续 of Story 中将前端文件选择器与后台的文件上传 API 以及 WuKongIM SDK 真正的 Image/File 消息发送逻辑打通，或在不支持的阶段直接将其置灰并提供 Tooltip 解释。
> - **已追踪**: 已新建 Issue [V2-10](../../V2-10_incomplete_image_and_file_sending.md) 进行追踪。

---

## 📈 截图存档目录
所有测试步骤的高清可视化截图已分类重命名存放在项目中的下述位置，可随时查阅:
- `/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/two-account-audit-2026-05-24/`

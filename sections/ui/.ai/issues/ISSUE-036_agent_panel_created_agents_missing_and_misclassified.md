# [ISSUE-036] 创建智能体后面板缺失且自定义智能体被标为官方

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug / clowder / agent / directory / ui
**AI修复模式**：Direct Fix
**计划路径**：N/A
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests/ISSUE-036-<timestamp>/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户反馈：

1. 新创建的智能体在聊天/会话链路里能出现，但进入“智能体”面板后找不到。
2. 之前创建过的智能体在面板里全部显示为“官方”，而不是“自定义”。

预期：

1. 智能体面板默认读取 TangSeng `/v1/clowder/cats` 聚合目录，因为该目录包含当前用户创建和连接过的智能体联系人。
2. 只有后端角色模板、官方模板、官方目录项显示为“官方”。
3. `runtime-created`、`user-created`、`contact` 等用户域来源显示为“自定义”，并进入自定义筛选。

---

## 复现步骤

1. 启动 `seedcmp/scripts/start-im-clowder.sh start`。
2. 登录主 UI `http://localhost:5173`。
3. 创建一个新智能体。
4. 返回“智能体”面板。
5. 观察新智能体是否出现在列表中，以及已有自定义智能体的角标。

实际：

1. 面板列表主要来自直接 Clowder 官方模板目录，新建智能体缺失。
2. 多个历史创建智能体显示为“官方”。

预期：

1. 新建智能体刷新后仍在智能体面板中。
2. 用户创建/连接的智能体显示为“自定义”。

---

## 相关代码

```text
sections/ui/pages/agents/index.vue
- onMounted 调用 agentStore.fetchNativeAgents({ silent: true })。

sections/ui/stores/agent.js
- fetchNativeAgents 当前默认传 preferDirect: options.preferDirect !== false。
- 这让页面刷新默认绕过 TangSeng 聚合目录，直接读取 Clowder 官方模板/连接器目录。

sections/ui/services/native-im/service.js
- fetchClowderCatDirectory 在 preferDirect=false 时先调用 /v1/clowder/cats，失败后才 fallback 到直接 Clowder API。
- normalizeClowderAgent 只把 source === 'runtime-created' 识别为 User，其他用户域来源会被误标为 System。

sections/im/TangSengDaoDaoServer/modules/clowder/api.go
- fetchCatDirectory 会合并 role templates 和用户创建的 cat contacts。
- storeCreatedCatContact 使用 decorateCatContact(agent, "runtime-created") 持久化创建来源。
```

---

## 根因分析

根因：

1. `agentStore.fetchNativeAgents()` 默认设置 `preferDirect: true`，导致智能体面板绕过 `/v1/clowder/cats`，只看到官方模板或直接 Clowder connector 返回项，用户创建的 TangSeng 联系人容易缺失。
2. `normalizeClowderAgent()` 对用户域来源判断过窄，只识别 `runtime-created`。当后端或兼容层返回 `user-created`、`runtime_created`、`contact`、`existing`、`sourceType` 等等价来源时，前端会把它们显示为 `System`，从而 UI 角标变成“官方”。
3. Playwright 验收时还捕获到智能体页横向 `scroll-view` 在数据刷新后触发 uni H5 内部 `scrollLeft` 空引用 pageerror。虽然不直接导致目录缺失，但属于本 issue 面板路径的明显 UI/UX 风险，已在当前范围内修复。

---

## 问题列表（Q&A 迭代）

### Q1: 智能体面板是否应该默认走直接 Clowder API？
**A1**: 不应该。面板是用户可管理目录，必须默认走 TangSeng `/v1/clowder/cats`，直接 Clowder API 只作为 fallback 或显式全局官方目录使用。

### Q2: `role-template` 是否仍然是官方？
**A2**: 是。角色模板、官方模板和没有用户域来源标记的目录项仍显示为“官方”。

### Q3: 创建接口返回后本地 push 了 User，为什么刷新后还会错？
**A3**: 创建后本地状态短期正确，但页面重新同步目录时会清理静态/本地项并使用远端目录重建列表；如果远端目录来源不对或归一化误判，就会复现缺失或“官方”误标。

---

## 修复记录

### 2026-06-10

已完成以下修复：

1. `sections/ui/services/native-im/service.js`
   - 新增 `shouldPreferDirectClowderDirectory()`，显式约定只有 `preferDirect === true` 才直连 Clowder 官方/连接器目录。
   - `fetchClowderCatDirectory()` 默认保持 TangSeng `/v1/clowder/cats` 优先，失败后仍保留直接 Clowder API fallback。
   - 扩展用户域来源识别：`runtime-created`、`runtime_created`、`user-created`、`user`、`contact`、`existing`、`connected` 归为 `creator: 'User'`；`role-template` 等模板仍归为 `System`。

2. `sections/ui/stores/agent.js`
   - `fetchNativeAgents()` 默认不再传 `preferDirect: true`，智能体面板刷新时走 TangSeng 聚合目录。
   - 保留显式 `options.preferDirect === true` 的能力，用于需要全局官方目录的场景。

3. `sections/ui/pages/agents/index.vue`
   - 将智能体页“我的技能”和筛选条的横向 `scroll-view` 换成普通 `view + overflow-x:auto`，避免数据刷新时 uni H5 内部 `scrollLeft` 空引用。
   - 重新通过桌面/移动视觉验收确认无横向越界、按钮/角标文字溢出或 console error。

4. `sections/ui/tests/native-im.test.mjs`
   - 补充 RED 回归测试：默认目录选择必须 TangSeng-first，只有显式 direct 才直连。
   - 补充 RED 回归测试：运行时创建、用户创建、联系人、已连接来源必须显示为自定义；官方模板仍显示为官方。

---

## 测试结果

证据目录：`sections/ui/.ai/tests/ISSUE-036-20260610120141/`

RED 验证：

```bash
cd sections/ui
npm run test:native-im
# 初次失败：service.js 尚未导出 shouldPreferDirectClowderDirectory，证明回归测试先于实现生效。
```

GREEN/回归验证：

```bash
cd sections/ui
npm run test:native-im
# pass: 85/85

npm run test:smoke
# sections/ui smoke test passed

npm run build:h5
# exit 0, DONE Build complete.
# 构建存在既有 Sass @import deprecation warning 和 uni 版本提示，不影响本次构建产物。
```

浏览器可视化验收：

```bash
cd sections/ui
PORT=5174 node scripts/serve-prod.js

cd ../..
APP_URL=http://localhost:5174 node sections/ui/.ai/tests/ISSUE-036-20260610120141/agent-panel-directory-visual.mjs
# pass: true
```

说明：

1. 按任务环境先探测了 `http://localhost:5173`，该端口最初来自 `scripts/start-im-clowder.sh`；在把 Playwright 证据脚本写入 `.ai/tests` 后，Vite dev server 因系统 inotify watcher `ENOSPC` 退出。
2. 为避免 dev watcher 继续监听证据目录，最终浏览器验收使用 `npm run build:h5` 后的静态产物 `http://localhost:5174`，页面代码与本次 build 产物一致。
3. Playwright 覆盖桌面 `1440x900` 和移动 `375x844` viewport。同一核心路径断言：
   - 页面只请求 `/v1/clowder/cats?includeUnavailable=true`，未请求 `/clowder-api/api/cat-templates` 或 `/clowder-api/api/connectors/im-web/agents`。
   - `Issue 036 Runtime Created`、`Issue 036 Existing Contact` 均显示为 `自定义`。
   - `Issue 036 Official Template` 显示为 `官方`。
   - 自定义筛选保留用户智能体并隐藏官方模板。
   - 无横向越界、按钮/角标文字溢出、console error。

关键证据文件：

- `sections/ui/.ai/tests/ISSUE-036-20260610120141/native-im.log`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/smoke.log`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/build-h5.log`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/playwright.log`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/result.json`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/request-log.json`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/request-failures.json`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/browser-console.json`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/desktop-1440x900-agent-panel-all.png`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/desktop-1440x900-agent-panel-custom.png`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/mobile-375x844-agent-panel-all.png`
- `sections/ui/.ai/tests/ISSUE-036-20260610120141/mobile-375x844-agent-panel-custom.png`

---

## 关闭备注

已关闭。智能体面板默认恢复为 TangSeng 用户聚合目录，创建/已连接智能体刷新后可见并显示“自定义”；官方模板仍显示“官方”。桌面和移动端 Playwright 可视化验收通过。

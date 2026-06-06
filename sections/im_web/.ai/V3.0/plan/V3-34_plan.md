# V3-34 解决计划：Clowder Cat Contacts Show Existing Contacts Only

## 1. 问题现象

`新增猫猫` 页面右侧标题是 `Clowder 猫猫联系人`，但列表同时展示：

- 已连接猫猫联系人；
- 未连接的目录/角色模板候选；
- `添加到联系人` 操作。

用户期望这里仅展示已有联系人，不应该出现 `添加到联系人`。

## 2. 根因判断

- `loadCatContactDirectory()` 会加载完整 directory，并保存在 `catContactDirectory`。
- `catContactDirectory` 既包含 connected contacts，也可能包含 `source: disconnected` 的候选。
- `ClowderCatConsolePage.vue` 的 `availableCats` 直接使用完整 `catContactDirectory`。
- 模板候选原本应服务左侧角色模板 dropdown，却被右侧联系人列表一起展示。

## 3. 推荐修复方案

- 页面级 `availableCats` 先过滤 `cat.connected === true`。
- 删除右侧列表中的 `connectExistingCat` 入口和 `添加到联系人` 按钮。
- 保留 `打开会话`、`删除` 操作。
- 保留完整 directory 用于生成左侧 role template options。
- 空态改成 `暂无猫猫联系人`。

## 4. 实施步骤

1. 修改 `ClowderCatConsolePage.vue`。
   - `availableCats` 改为 `clowderStore.catContactDirectory.filter(cat => cat.connected)`.
   - 删除 `connectCat()`。
   - 删除未连接按钮分支。
   - 搜索仅作用于过滤后的联系人集合。

2. 更新测试。
   - 不再期待 `connectExistingCat`。
   - 断言页面不包含 `添加到联系人`。
   - 保留 role template dropdown 测试，确保左侧创建流程仍可用。

3. 可选后端整理。
   - 如果未来区分 endpoints，可新增 contacts-only API。
   - 当前短期可在页面过滤，避免影响已有目录/模板数据契约。

## 5. 验证方式

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/clowderCatConsole.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

浏览器回归：

- mixed directory 中只显示 connected cats。
- disconnected role templates 仍可在左侧角色模板中选择。
- 右侧列表没有 `添加到联系人`。
- 已连接猫猫仍可打开会话和删除。

## 6. 风险点

- 不要把 role template 数据删掉；它仍然服务创建猫猫表单。
- 不要影响群聊邀请和 @ 路由中对已连接猫猫的读取。
- 不要把 disconnected candidate 标记成 connected 来隐藏按钮，应该在 UI 层按语义过滤。

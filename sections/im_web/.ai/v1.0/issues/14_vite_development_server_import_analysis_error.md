# [ISSUE-14] TypeScript 临时编译残留 (.js) 干扰 Vite 开发服务器引发 500 导入分析错误

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / build / vite / ts-compilation

---

## 问题描述

在执行浏览器可视化自动化测试载入 `http://localhost:3000` 时，Vite 开发服务器突然崩溃，报错为严重的 500 Import Analysis 错误：
`[plugin:vite:import-analysis] Failed to resolve import "./stores/groupChatUtils" from "../../packages/datasource-vue/src/index.js". Does the file exist?`

然而，`index.ts` 源码中导入并导出的明明是相对路径完好的 `./stores/groupChatUtils`。

---

## 复现步骤

1. 在项目根目录下，对某个测试文件直接运行 `npx tsc`（或未指定 `--outDir` 的临时编译），导致 TypeScript 编译器将编译产物 `.js`、`.d.ts` 直接散落并残留在 `packages/*/src/` 下的所有源码子目录中。
2. 启动前端 Vite 调试服务：`./node_modules/.bin/vite apps/chat`。
3. 打开浏览器载入页面。
4. 预期：Vite 成功热编译所有 `.ts` 源码。
5. 实际：Vite 优先解析了目录里残留的 `.js` 编译垃圾，且由于模块系统和路径偏移，引发严重的 Vite 500 编译分析错误，导致浏览器呈现白屏。

---

## 相关代码

### Vite 别名配置

```ts
// apps/chat/vite.config.ts
resolve: {
  alias: {
    '@tsdaodao/base-vue': path.resolve(__dirname, '../../packages/base-vue/src'),
    '@tsdaodao/datasource-vue': path.resolve(__dirname, '../../packages/datasource-vue/src'),
    '@tsdaodao/login-vue': path.resolve(__dirname, '../../packages/login-vue/src'),
    '@tsdaodao/contacts-vue': path.resolve(__dirname, '../../packages/contacts-vue/src')
  }
}
```

由于别名指向了 `src` 源码目录，而 TypeScript 编译期间误生成的大量 `.js` 文件与 `.ts` 同名共存，Vite 在模块依赖图（Module Graph）分析时会错误地将 `.js` 视作主入口文件加载。而这些残留的 JS 并未被正确打包且包含了相对寻路错误，最终触发崩溃。

---

## 根因分析

TypeScript 本地编译运行指令未做严格的产物隔离或 `--outDir` 保护，使得临时编译产生的 `.js` 残留混入了源码目录，导致 Vite 打包器在进行导入分析时定位发生偏差，严重危害了热更新 (HMR) 与 Dev 服务的运行健康。

---

## 问题列表（Q&A 迭代）

### Q1: 怎样绝对防止后续测试或编译再次污染源码目录？
**A1**: 在运行任何 `tsc` 相关的非 Vite 编译时，必须**严格强制指定 `--outDir` 临时输出目录**（例如我们为 `groupChatUtils.test.ts` 编译运行所指定的 `scratch/seedcmp-im-tests` 输出路径），且在脚本运行完毕后自动执行 `rm -rf` 强清理逻辑，彻底杜绝产物污染。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. **编译垃圾强力清扫**：
   - 编写并执行了精准定位清除脚本，彻底删除了 `packages/` 目录下散落的共 **40+ 余个临时 `.js` 编译残留文件**，恢复了源码目录的纯净状态。
2. **规范化编译隔离**：
   - 在所有的编译测试中（如 `verify-all-issues.mjs`）中，确保所有 TypeScript 测试编译均通过 `--outDir ./scratch/seedcmp-im-tests` 输出至根目录下的临时刮擦沙箱中，并在执行后完美自清理，切断任何未来的污染链路。

---

## 测试结果

```bash
# 彻底清理后，重启 Vite 服务
./node_modules/.bin/vite apps/chat
# exit 0 (Vite v5.2.2 ready in 124 ms)

# 重新运行浏览器可视化自动化测试
# E2E 注册、登录、发信、设置、登出流程 100% 成功跑通，0 Runtime 报错，系统体验极其丝滑！

# 执行全局自动化回归校验
node sections/im_web/.ai/checks/verify-all-issues.mjs
# exit 0 (All 14 automated tests passed!)
```

---

## 关闭备注

问题已彻底解决，开发目录垃圾被清扫一空，Vite 开发编译阻断隐患被全流程清除，多账户登录发信业务在浏览器 E2E 可视化测试中表现极致完美。

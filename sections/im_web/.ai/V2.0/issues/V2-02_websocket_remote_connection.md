# [V2-02] WebSocket 远程连接失败 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / realtime / regression
**优先级**：P0
**来源**：[v1.0 ISSUE-08](https://git.whatever/.../issues/08)（Resolved 2026-05-23）

---

## v1.0 问题摘要

远程环境（非 localhost）下 WebSocket 连接失败，SDK 尝试连接 `ws://0.0.0.0:5200/` 而非可访问的外网地址，导致消息收发、清除未读等依赖 WS 的功能全部中断。

**v1.0 根因**：WuKongIM `/route` API 把监听地址 `0.0.0.0:5200` 直接返回给客户端；前端 `connectAddrCallback` 未对 `0.0.0.0`、`127.0.0.1`、`localhost` 做可拨号地址净化。

**v1.0 修复**：
- WuKongIM 配置 `WK_EXTERNAL_WSADDR=ws://localhost:5200`
- 前端 `sdkAddress.ts` 新增地址净化函数
- 前端 `sdk.ts` 的 `connectAddrCallback` 调用净化函数

---

## V2.0 回归风险分析

V2.0 重构中 SDK 初始化和数据层架构发生了变化，以下场景可能导致该问题在 V2.0 中重新出现：

1. **SDK 初始化位置迁移**：若 `connectAddrCallback` 被重构到新位置，地址净化逻辑可能被遗漏
2. **多环境地址处理**：V2.0 可能引入不同部署环境（localhost / dev / staging / prod），每个环境的 WS 地址规则不同
3. **WuKongIM 版本升级**：V2.0 开发期间可能升级 WuKongIM，`/route` API 响应格式变化导致 `ws_addr` 字段不存在或格式不同
4. **离线队列依赖**：WS 未建立连接时，离线消息队列无法重发，导致消息静默丢失

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
# exit 0
```

### Step 2 — 本地 WS 连接测试
1. 启动前端 `pnpm dev`
2. 登录账号
3. 打开浏览器控制台，过滤 `[SDK]` 和 `WebSocket`
4. 确认 WS 连接地址为 `ws://127.0.0.1:5200/` 或 `ws://localhost:5200/`，而非 `ws://0.0.0.0:5200/`

### Step 3 — 地址净化函数测试（Vitest）
```bash
pnpm test:unit -- --grep "sdkAddress"
# 应覆盖：0.0.0.0 → 127.0.0.1, localhost → 127.0.0.1, 真实外网地址保持不变
```

### Step 4 — 远程连接测试（手动）
1. 部署到远程服务器
2. 登录后观察控制台，WS 应连接到真实可访问地址
3. 发送消息，确认 `ws尚未连接，无法发送消息` 不再出现

---

## 相关代码（v1.0 修复位置）

```
packages/datasource-vue/src/stores/sdkAddress.ts   ← 地址净化函数
packages/datasource-vue/src/stores/sdk.ts          ← connectAddrCallback 调用净化
```

V2.0 应确保上述文件或等价位置仍有相同逻辑。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 3 Store/SDK | 地址净化函数单元测试 | ✅ Pass |
| Layer 5 E2E | 双账号登录后会话页可用、控制台严重错误检查 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |

---

## 关闭备注

V2.0 地址净化逻辑已存在并通过 `sdkAddress.test.ts`；最终双账号浏览器审计未发现阻断性连接错误，标记为 Resolved。

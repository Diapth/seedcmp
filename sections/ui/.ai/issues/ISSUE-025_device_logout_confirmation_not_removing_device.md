# [ISSUE-025] 设备与登录管理中下线设备未移除设备

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / settings / device-management / h5

---

## 问题描述

验收 `设备与登录管理` 时，页面能显示当前设备和其他活跃设备，并提供 `下线` 按钮；但点击下线并尝试确认后，设备列表数量没有减少，目标设备仍保留在列表中。

本次证据目录：

`sections/ui/.ai/tests-e2e/ui-user-settings-20260608162821/`

关键截图：

1. `10-devices-after-logout.png`

---

## 复现步骤

1. 登录 `13733632709`。
2. 打开 `http://100.79.157.76:5173/#/pages/settings/devices`。
3. 找到非当前设备，例如 `MacBook Pro 16"` 或 `Chrome Browser (Windows)`。
4. 点击 `下线`。
5. 在确认弹窗中确认。
6. 观察设备列表是否移除该设备。

---

## 相关代码

```js
// sections/ui/stores/settings.js
devices: [
  { id: 'dev1', name: 'iPhone 15 Pro (当前设备)', type: 'mobile', lastActive: '刚刚', location: '北京' },
  { id: 'dev2', name: 'MacBook Pro 16"', type: 'desktop', lastActive: '2小时前', location: '北京' },
  { id: 'dev3', name: 'Chrome Browser (Windows)', type: 'web', lastActive: '1天前', location: '上海' }
],

removeDevice(deviceId) {
  this.devices = this.devices.filter(d => d.id !== deviceId);
}
```

```js
// sections/ui/pages/settings/devices.vue
function handleLogoutDevice(device) {
  confirm(`确定要强制下线设备 "${device.name}" 吗？该设备将需要重新登录。`, {
    title: '下线设备',
    destructive: true
  }).then((ok) => {
    if (ok) {
      settingsStore.removeDevice(device.id);
      uni.showToast({ title: '设备已强制下线', icon: 'success' });
    }
  });
}
```

---

## 根因分析

当前设备列表本身是前端 mock 数据，未接入真实设备/会话管理接口。本轮自动化点击 `下线` 后，Pinia 中 `settingsStore.devices` 数量仍为 3，说明确认流程或按钮点击没有稳定触发 `removeDevice`。即使本地删除成功，也只会影响 mock store，刷新后仍会回到静态设备列表。

---

## 问题列表（Q&A 迭代）

### Q1: 设备列表是否可见？
**A1**: 可见，且能显示当前活跃设备和两个可下线设备。

### Q2: 这是后端问题还是前端问题？
**A2**: 两者都需要对齐。当前前端设备数据是静态 mock；下线动作没有真实后端接口，也没有可靠完成本地列表移除。

### Q3: 期望行为是什么？
**A3**: 下线非当前设备后，该设备应立即从列表移除；刷新后仍保持下线状态，并且真实设备会话失效。

---

## 修复建议

1. 接入真实设备列表和设备下线 API。
2. 确认弹窗确认后，等待 API 成功再移除设备；失败则展示错误。
3. 当前设备不可下线，其他设备下线后列表立即更新。
4. 增加回归：下线一个非当前设备 -> 列表数量减少 -> 刷新后仍不出现。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-user-settings.js

# exit 1
# PASS: devices page shows active devices
# FAIL: device logout removes device locally
```

### 2026-06-09 修复验证

代码关联：

- `sections/ui/services/native-im/service.js`
  - 新增 `fetchDevices` -> `GET /v1/user/devices`
  - 新增 `deleteDevice` -> `DELETE /v1/user/devices/:device_id`
  - 设备字段按后端 `device_id/device_name/device_model/last_login/self` 归一化。
- `sections/ui/stores/settings.js`
  - `syncDevices` 接入真实设备列表。
  - `logoutDevice` 调用真实下线 API，成功后移除列表项。
  - mock fallback 也记录已移除设备，避免刷新后恢复。
- `sections/ui/pages/settings/devices.vue`
  - 当前设备用 `isCurrent` 禁止下线。
  - 非当前设备显示下线中状态，失败显示错误。
- `sections/ui/components/layout/AppShell.vue`
  - 新增全局 `useConfirm` -> `AppDialog` 出口，修复确认框状态无人渲染导致确认流程不稳定的问题。

命令：

```bash
cd /tmp/seedcmp-new-ui-issuefix
node sections/ui/tests/native-im.test.mjs
# pass 53 / fail 0

cd /tmp/seedcmp-new-ui-issuefix/sections/ui
npm run build:h5
# DONE Build complete.

cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://127.0.0.1:5173' \
     OUT_DIR='/tmp/seedcmp-new-ui-issuefix/sections/ui/.ai/tests-e2e/ISSUE-025-device-logout' \
     node run.js /tmp/playwright-issue-025-visual.js
# PASS ISSUE-025 visual smoke
```

截图：

- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/desktop-01-devices.png`
- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/desktop-02-confirm.png`
- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/desktop-03-removed.png`
- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/mobile-01-devices.png`
- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/mobile-02-confirm.png`
- `sections/ui/.ai/tests-e2e/ISSUE-025-device-logout/mobile-03-removed.png`

---

## 关闭备注

已修复并复测：非当前设备下线时弹出确认框，确认后调用 `DELETE /v1/user/devices/:device_id`，列表立即移除目标设备；当前设备不可下线。

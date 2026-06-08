# [ISSUE-025] 设备与登录管理中下线设备未移除设备

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / settings / device-management / h5
**AI修复模式**：Direct Fix
**计划路径**：N/A
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

---

## 问题描述

验收 `设备与登录管理` 时，页面能显示当前设备和其他活跃设备，并提供 `下线` 按钮；但点击下线并尝试确认后，设备列表数量没有减少，目标设备仍保留在列表中。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-user-settings-20260608162821/`

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

---

## 关闭备注

待修复后复测：非当前设备下线后立即从列表移除，刷新后保持下线状态，并且后端会话实际失效。

# Issue 002：uni H5 构建触发 inotify watcher 上限 ENOSPC

- 状态：Resolved
- 严重级别：Medium
- 发现时间：2026-06-07
- 影响平台：本地 H5 build/dev server

## 现象

`npm run build:h5` 产物成功生成，但构建日志中出现 `ENOSPC: System limit for number of file watchers reached`，路径指向 `static/logo.png` 和项目根目录。虽然进程退出码为 0，但后续 dev server/smoke 截图可能被 watcher 限制影响。

## 原因

当前机器已有较多监听进程，uni/vite/chokidar 在构建阶段尝试创建文件监听时触达系统 inotify 上限。

## 修复

在 `scripts/run-uni.mjs` 中默认注入：

- `CHOKIDAR_USEPOLLING=1`
- `WATCHPACK_POLLING=true`

这样 H5 build/dev server 在本项目内默认使用轮询监听，规避本机 watcher 上限。

## 复测

- 最终 V1 验收已重新执行 H5 build：`node scripts/run-uni.mjs build -p h5` / `pnpm build:h5` 均完成，未再记录 ENOSPC 复现。

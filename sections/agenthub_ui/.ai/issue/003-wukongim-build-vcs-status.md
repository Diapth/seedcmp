# Issue 003：start-im-clowder 启动 WuKongIM 时 Go VCS stamping 失败

- 状态：Resolved
- 严重级别：Medium
- 发现时间：2026-06-07
- 影响平台：真实 H5 联调后端启动

## 现象

在隔离 worktree 执行：

```bash
bash scripts/start-im-clowder.sh start
```

WuKongIM build 阶段失败：

```text
error obtaining VCS status: exit status 128
Use -buildvcs=false to disable VCS stamping.
```

## 修复

启动真实后端时注入：

```bash
GOFLAGS=-buildvcs=false bash scripts/start-im-clowder.sh start
```

禁用 Go VCS stamping 后继续启动，不影响运行时代码行为。

## 复测

- 使用 `GOFLAGS=-buildvcs=false` 重新执行 start 脚本。

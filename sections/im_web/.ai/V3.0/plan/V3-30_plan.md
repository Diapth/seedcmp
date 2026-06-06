# V3-30 解决计划：Clowder Local Preview Fails With `listen EPERM`

## 1. 问题现象

猫猫完成婚礼邀请页实现和 QA 后，收口阶段尝试启动本地 Next 预览：

```text
127.0.0.1:4301
```

但当前执行环境禁止监听端口，预览进程启动失败，错误原因是：

```text
listen EPERM
```

这不是生成文件卡片的 `预览/下载` 权限问题，也不是 `/uploads`、CORS、签名 URL、`.zip` 在线预览策略问题。核心问题是本地 preview server 没能 bind 到端口，猫猫需要准确报告“尝试过但当前环境不可启动”，而不是把 `127.0.0.1:4301` 当作可访问 URL 交付。

## 2. 根因判断

根因分为两层。

第一层是运行环境能力限制：

- 当前环境不允许 agent/猫猫进程监听本地端口。
- 预览启动命令尝试 bind `127.0.0.1:4301` 时被系统拒绝。
- 错误为 `listen EPERM`，语义是端口监听被权限/沙箱策略阻止，不是应用路由或浏览器访问失败。

第二层是 handoff 状态表达不够结构化：

- 猫猫会尝试启动预览，但如果失败，最终回复容易混在“我会把可访问 URL 给你”的流程里。
- IM Web/Clowder 当前没有明确区分 `preview_started`、`preview_start_failed`、`preview_not_attempted`。
- 如果只出现 `127.0.0.1:4301` 文本，用户可能误以为这是已经可用的预览地址。
- 收口信息应该同时包含 route、源码路径、测试/lint、git 边界和预览失败原因，避免 PM 验收卡住。

与其他 issue 的关联：

- V3-31：看板/产物面板没有同步猫猫实际工作，是独立的结构化状态问题。
- V3-32：agent workspace 和源码路径可能位于隔离 checkout，需要项目级路径策略；但本 issue 的错误点是 preview server bind 失败。
- V3-29：部署/确认按钮属于另一个 action bridge 问题。

## 3. 影响范围

- Clowder cat/coding-agent 的本地预览启动流程。
- 最终 handoff 消息模板和 PM 收口检查。
- IM Web 中对 preview URL/route/source path 的展示语义。
- Next.js web package 启动脚本、端口选择和失败日志解析。
- 任何依赖 `localhost` 预览做验收的长任务交付流程。

## 4. 推荐修复方案

把本地预览作为一个明确的能力检查和状态对象，而不是普通文本 URL。

建议状态：

```ts
type LocalPreviewStatus =
  | {
      status: 'started';
      url: string;
      host: '127.0.0.1' | 'localhost' | '0.0.0.0';
      port: number;
      route?: string;
      pid?: number;
    }
  | {
      status: 'failed';
      attemptedUrl: string;
      host: string;
      port: number;
      reason: 'port_binding_forbidden' | 'port_in_use' | 'command_failed' | 'timeout' | 'unknown';
      error: string;
    }
  | {
      status: 'not_attempted';
      reason: 'environment_forbids_ports' | 'no_start_script' | 'not_needed' | 'unknown';
    };
```

推荐策略：

- 启动前做环境能力检查；如果已知禁止监听端口，直接标记 `not_attempted`，不要输出假 URL。
- 启动失败时解析 stderr/stdout；遇到 `listen EPERM` 归类为 `port_binding_forbidden`。
- 只有确认进程仍在运行、端口可连接、目标 route 返回成功或明确响应时，才把 URL 标记为可访问。
- 对失败状态，最终回复必须包含：`attemptedUrl`、`listen EPERM`、route、源码路径、测试/lint 结果、git 状态边界。
- UI 上如果渲染 preview link，应区分“可点击的活预览”和“尝试过但不可用的地址”。

## 5. 具体实施步骤

1. 捕获现有启动命令和日志。
   - 记录猫猫使用的 Next 启动脚本、cwd、host、port。
   - 保存 `listen EPERM` 的 stderr/stdout 原文和 exit code。
   - 确认是否始终绑定 `127.0.0.1:4301`，还是由任务/环境选择。

2. 增加 preview 启动结果分类。
   - 在 Clowder agent preview/handoff 逻辑中引入结构化状态。
   - 将 `listen EPERM` 映射为 `port_binding_forbidden`。
   - 将端口占用、命令缺失、超时、路由 404 分别分类，避免全都叫“预览失败”。

3. 增加可达性确认。
   - 启动 preview 后执行本地 health check，例如请求 `/showcase/wedding-invite`。
   - health check 通过前，不把 `127.0.0.1:4301` 标记为 working URL。
   - 如果环境禁止所有监听端口，跳过重复尝试，减少噪音。

4. 改造猫猫最终 handoff。
   - 成功时输出“本地预览已启动：URL + route”。
   - `listen EPERM` 时输出“我尝试启动 `127.0.0.1:4301`，当前环境禁止监听端口，因此无法启动本地预览”。
   - 同时保留可验收信息：route `/showcase/wedding-invite`、源码路径、测试/lint、git 状态、未提交文件边界。

5. 改造 IM Web 展示。
   - 如果消息里有 `previewStatus.status === 'started'`，渲染为可点击预览。
   - 如果是 `failed/not_attempted`，展示为诊断文本或 warning，不渲染成已确认可用 URL。
   - 避免把 `listen EPERM` 显示为 HTTP 403/404、CORS 或文件权限问题。

6. 提供 fallback。
   - 如果本地端口被禁，但项目可静态构建，可提供 build artifact/source route。
   - 如果系统有外部 preview proxy 或 deployment action，应把它作为独立动作，不和本地 `127.0.0.1` 预览混淆。
   - 如果需要用户自己启动，应给出准确 cwd 和命令，但不要声称猫猫已经启动成功。

## 6. 验证方式与回归测试建议

单元测试：

- `listen EPERM` stderr 被归类为 `port_binding_forbidden`。
- `EADDRINUSE` 被归类为 `port_in_use`，不和权限失败混淆。
- 失败状态只包含 `attemptedUrl`，不会生成 `url`/`started` 状态。

集成测试：

- mock preview 命令返回 `listen EPERM`，最终 handoff 包含 attempted URL、错误原因和源码/测试信息。
- mock preview 命令启动成功但 health check 失败，不能标记 URL 可用。
- mock preview 成功且 route 可访问，才输出 working URL。

浏览器/人工回归：

- 在禁止监听端口的环境中触发婚礼邀请页收口，确认 IM Web 展示“本地预览不可启动：listen EPERM”。
- 在允许监听端口的环境中启动相同 route，确认 `127.0.0.1:<port>/showcase/wedding-invite` 可访问。
- 确认 `.zip` 下载、artifact panel、workspace path 问题不会被误归因到本 issue。

建议命令：

```bash
cd seedcmp/sections/clowder-ai/packages/web
pnpm lint
pnpm test
```

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- preview handoff
```

## 7. 风险点与注意事项

- 不要把 `127.0.0.1:4301` 文本自动当作成功预览 URL。
- 不要把 `listen EPERM` 误写成文件预览权限、下载权限、CORS、403 或 wrong-origin。
- 不要因为一个端口失败就无限换端口重试；如果环境策略禁止监听，换端口也大概率失败。
- 如果后续接入外部 preview/deploy，这应是另一条 action path，不能伪装成本地 Next dev server 已启动。
- 最终 PM 收口信息要足够完整：即使没有 live preview，也能基于 route、源码、测试/lint 和 git 状态做下一步判断。

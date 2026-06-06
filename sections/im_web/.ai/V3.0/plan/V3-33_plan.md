# V3-33 解决计划：OAuth Cat Creation Uses Local CLI Config

## 1. 问题现象

`新增猫猫` 页面选择 `OAuth 账号` 后，仍要求用户像 API Key 账号一样填写/选择 `默认模型`。但 Codex/Claude Code 的 OAuth/订阅模式应使用用户本机 CLI 配置：

```text
~/.codex/config.toml
~/.codex/auth.json
~/.claude/settings.json
```

这类配置应由本地可信进程探测并脱敏汇总，不应让用户手动把敏感配置内容填进 UI。

## 2. 根因判断

- 前端 `ClowderCatConsolePage.vue` 对 API Key 和 OAuth 共用默认模型 UI。
- `applyRecommendedModel()` 会在选择平台后自动填充 fallback model。
- 创建请求会发送 `defaultModel: form.defaultModel.trim() || undefined`，OAuth 模式下也可能带上 UI 推荐值。
- 后端已有意图允许 OAuth/subscription 账号省略模型，让 CLI 使用默认值，但前端没有跟上这个交互。
- 本地配置探测目前没有成为猫猫创建流程的一等输入。

## 3. 推荐修复方案

短期前端修复：

- OAuth 模式隐藏默认模型字段。
- OAuth 模式清空 `form.defaultModel`。
- OAuth 模式按运行平台使用内置 accountRef：Codex 使用 `codex`，Claude Code 使用 `claude`。
- OAuth 创建请求默认不提交 `defaultModel`。
- API Key 模式保留默认模型选择/填写。

中期本地配置探测：

- 增加 redacted config probe API，例如 `GET /clowder/local-auth/capabilities`。
- Codex probe 检查 `~/.codex/config.toml`、`~/.codex/auth.json` 是否存在并可解析。
- Claude probe 检查 `~/.claude/settings.json` 是否存在并可解析。
- 返回脱敏摘要：provider、authConfigured、configPresent、safe default profile/model、diagnostics。
- 禁止返回 token、refresh token、raw auth JSON、完整 settings 原文。

建议响应：

```ts
interface LocalOAuthConfigSummary {
  provider: 'codex' | 'claude';
  authConfigured: boolean;
  configFiles: Array<{ path: string; exists: boolean; readable: boolean }>;
  defaultModel?: string;
  profile?: string;
  diagnostics?: string[];
}
```

## 4. 实施步骤

1. 修改 `ClowderCatConsolePage.vue`。
   - 新增 `isOAuthAuth` computed。
   - 新增 OAuth accountRef resolver：`openai -> codex`，`anthropic -> claude`。
   - `applyRecommendedModel()` 在 OAuth 模式下清空模型。
   - `账号引用` UI 仅在非 OAuth 模式展示。
   - `默认模型` UI 仅在非 OAuth 模式展示。
   - `createCatAndConnect()` 仅在非 OAuth 模式提交 `defaultModel`。

2. 更新前端测试。
   - 覆盖 OAuth 不展示默认模型。
   - 覆盖 OAuth 创建 payload 不提交 defaultModel。

3. 增加后端 redacted config probe。
   - 读取本地配置时只解析必要字段。
   - 对敏感 key 做 denylist：token、refresh、secret、key、credential。
   - 日志只记录存在性和错误类型。

4. 接入 UI。
   - OAuth 选择平台后显示配置状态。
   - 配置缺失时提示运行对应 CLI 登录。
   - 配置存在时使用 CLI 默认值，不要求用户选择 model。

## 5. 验证方式

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/clowderCatConsole.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- cats capabilities
```

## 6. 风险点

- 不要把 `~/.codex/auth.json` 或 OAuth token 发给前端、日志、聊天模型。
- 不要让 OAuth UI 强行覆盖用户在 CLI 里选好的默认模型。
- API Key 账号仍需要明确模型，不能因为 OAuth 简化而放松 API Key 校验。

# V3-33: OAuth Cat Creation Should Use Local CLI Config

## Status

Open. Reported from the live IM Web V3.0 Clowder cat console on 2026-06-04. When the user selects an OAuth account, the form still asks for manual model/account details even though Codex and Claude Code should rely on the user's local CLI configuration.

## Created

2026-06-04

## Labels

bug, clowder, cats, oauth, local-config, codex, claude-code, onboarding, ux, security

## Priority

P1

## User Report

When the user chooses `OAuth 账号`, the product should directly use local user-level provider config, for example:

```text
~/.codex/config.toml
~/.codex/auth.json
~/.claude/settings.json
```

The user should not have to fill fields such as default model. Clowder can inspect local configuration first and derive what is available.

## Impact

- OAuth setup feels like API key setup, even though built-in CLIs already know the account and default model.
- Users may enter stale or wrong model names, overriding the provider CLI's actual configured default.
- The form creates unnecessary friction for Codex/Claude Code cats.
- If the system asks users to manually paste or expose config details, it risks leaking sensitive auth material.

## Expected Behavior

- OAuth mode should use the user's local CLI config by default.
- The UI should not require or emphasize `默认模型` for OAuth cats.
- Codex OAuth should probe `~/.codex/config.toml` and `~/.codex/auth.json` through a trusted local backend path.
- Claude Code OAuth should probe `~/.claude/settings.json` through a trusted local backend path.
- The probe response must be sanitized: expose status, detected account/profile/default model if safe, and missing-config diagnostics, but never expose raw tokens or secret fields.
- API key mode can still require explicit account/model information.

## Acceptance Criteria

- Selecting `OAuth 账号` hides or disables manual default model input in the cat creation form.
- Selecting `OAuth 账号` does not require the user to manually fill an account reference; Codex uses `codex` and Claude Code uses `claude` as the built-in local CLI account binding.
- Cat creation requests for OAuth accounts omit `defaultModel` unless the user explicitly chooses an advanced override.
- Backend validation accepts OAuth/subscription cats with empty `defaultModel` and lets the CLI use its configured default.
- A local config probe can report whether Codex/Claude OAuth appears configured.
- Sensitive files such as `~/.codex/auth.json` are never sent raw to IM Web, chat transcript, logs, or model context.
- If local OAuth config is missing, the UI shows a clear "run CLI login first" state instead of asking for API-key-style model data.

## Suspected Areas

```text
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/api/src/routes/cats.ts
sections/clowder-ai/packages/api/src/routes/capabilities.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts
```

## Investigation Checklist

- Confirm current cat creation payload for OAuth mode and whether `defaultModel` is being sent.
- Confirm backend `createCatSchema` and validation permit empty model for OAuth/subscription accounts.
- Identify whether local config probing already exists in `routes/capabilities.ts` or quota/auth routes.
- Define a redacted local config summary contract for Codex and Claude Code.
- Ensure local config files are read only on the trusted local backend/agent host.
- Confirm logs do not include raw `auth.json` or token-bearing settings.

## Regression Coverage Required

- Component/raw test proving OAuth mode does not render required default model input.
- Store/API test proving OAuth cat creation omits `defaultModel` by default.
- Backend test proving OAuth cats with empty model pass validation.
- Local config probe test with fixture files that verifies secrets are redacted.
- Browser smoke for creating Codex and Claude Code cats using local OAuth config.

## Notes

Do not solve this by asking the user to paste `auth.json` or settings content. The system may inspect local config through trusted local code, but UI/model-facing output must be a redacted capability summary.

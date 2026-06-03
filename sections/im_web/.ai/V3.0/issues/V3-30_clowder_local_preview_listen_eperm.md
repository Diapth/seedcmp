# V3-30: Clowder Local Preview Fails With `listen EPERM`

## Status

Open. Reported from the live IM Web V3.0 + Clowder coding handoff flow on 2026-06-04. The cat attempted to start a local Next preview at `127.0.0.1:4301`, but the current execution environment forbids listening on that port, so the preview startup failed with `listen EPERM`.

## Created

2026-06-04

## Labels

bug, clowder, local-preview, nextjs, port-binding, sandbox, handoff, regression, ux

## Priority

P1

## User Report

The issue is not that the generated artifact preview/download URL is forbidden in IM Web. The cat explicitly tried to launch a local preview server:

```text
127.0.0.1:4301
```

The environment blocked port listening, and the failure reason was:

```text
listen EPERM
```

The live cat handoff said, in substance:

```text
我会尝试启动脚本预览 127.0.0.1:4301，当前环境禁止监听端口，失败原因是 listen EPERM。
```

## Impact

- The cat completed implementation and QA but could not provide a live local preview URL during PM acceptance.
- The final handoff can make the deliverable feel less trustworthy because the user cannot immediately open the generated page.
- The system may incorrectly frame this as a broken artifact URL, file-card permission, or download issue, which sends debugging toward the wrong layer.
- Cats need a clear fallback when local port binding is unavailable: report the exact route/source path and say preview could not be started because of environment policy.

## Related Issues

- `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md` tracks the separate issue where the Clowder board/artifacts panel stays empty even while cats report completed work.
- `V3-32_clowder_workspace_outputs_leak_to_tmp.md` tracks runtime/workspace path policy for agent checkouts and generated source files.
- `V3-29_deployment_confirmation_button_unusable.md` tracks another action bridge gap between chat UI and Clowder runtime state.

## Reproduction Notes

1. Ask a Clowder cat to implement a web deliverable with a route such as `/showcase/wedding-invite`.
2. Let the cat finish implementation and QA.
3. During PM/handoff, have the cat attempt to start the local Next preview bound to `127.0.0.1:4301`.
4. Observe that the preview server cannot listen in the current environment.
5. Confirm the startup failure includes `listen EPERM`.

## Expected Behavior

- If local preview is allowed, the cat should start the preview on the requested host/port and provide the exact URL.
- If the environment forbids listening, the cat should not present the URL as available.
- The handoff should explicitly say local preview startup failed because of environment port-binding policy, with the exact error `listen EPERM`.
- The UI/runtime should distinguish this environment limitation from artifact download, file-card preview, auth, CORS, or wrong-origin failures.
- The user should still receive the canonical route, source path, verification results, and git status boundary so PM acceptance can continue.

## Acceptance Criteria

- Clowder detects local preview startup failure when the process exits with `listen EPERM`.
- The final cat message clearly marks `127.0.0.1:4301` as attempted but unavailable, not as a working preview URL.
- The error is surfaced as an environment capability issue: "当前环境禁止监听端口 / listen EPERM".
- No issue text or UI diagnostic mislabels this case as generated artifact preview/download permission failure.
- If a preview URL is shown as clickable/ready, a server is actually listening and reachable from the user's browser.
- Handoff still includes the implemented route, source path, test/lint status, and whether changes are committed or uncommitted.

## Suspected Areas

```text
sections/clowder-ai/packages/api/src/domains/cats/services/agents/
sections/clowder-ai/packages/api/src/infrastructure/connectors/
sections/clowder-ai/packages/web/src/app/showcase/wedding-invite/
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/packages/base-vue/src/components/messages/
```

## Investigation Checklist

- Capture the exact command/script used to start the local preview.
- Confirm whether the process attempted to bind `127.0.0.1:4301`.
- Record stderr/stdout and exit code for the failed preview process.
- Check whether the execution environment has a known "no listening ports" sandbox policy.
- Confirm whether Clowder currently treats a failed preview-start attempt as a successful URL handoff.
- Ensure diagnostics do not conflate `listen EPERM` with HTTP 401/403/404, CORS, file URL, or artifact URL normalization.
- Verify whether a configured external preview proxy, existing dev server, or static build artifact can be used as a fallback.

## Regression Coverage Required

- Unit test for preview-start result parsing that classifies `listen EPERM` as `port_binding_forbidden`.
- Integration test for handoff messaging: failed local preview attempts are described as unavailable, with the exact error included.
- UI/message test proving attempted local preview URLs are not rendered as confirmed working links when the server did not start.
- Smoke test in an environment that permits ports to ensure successful preview still produces a usable `127.0.0.1:<port>` URL.

## Required Verification

```bash
cd sections/clowder-ai/packages/web
pnpm lint
pnpm test
```

```bash
cd sections/clowder-ai/packages/api
pnpm test -- preview handoff
```

## Notes

Do not close this issue by changing artifact/file-card preview behavior. The defining failure is the local preview server startup attempt at `127.0.0.1:4301` being blocked by the runtime environment with `listen EPERM`.

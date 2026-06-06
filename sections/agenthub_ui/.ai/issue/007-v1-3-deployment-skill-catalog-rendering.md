# 007 - V1-3 Deployment / Skill Catalog / Agent Metadata Gaps

## Status

Resolved in worktree.

## Problem

During the V1-3 acceptance audit, several Clowder-facing paths were present but too shallow for the plan's live acceptance bar:

- `DeploymentCard.vue` existed but was not rendered from incoming deployment card payloads.
- Deployment confirmation reused the create-request path instead of the structured `clowder/conversation/deployment-action` endpoint.
- Project-group and deployment stores kept wrapped `{ binding }` / `{ deploymentRequest }` payloads instead of the real nested objects.
- The agent store did not retain backend role templates, platform model options, or `skillCatalog` data returned by `clowder/cats`.
- `pages/agents/skills.vue` still presented skill upload as a UI-only demo path.
- Cat creation used UI/snake_case fields (`access_mode`, `account_ref`, `model`) instead of TangSeng's `createCatRequest` fields (`authType`, `accountRef`, `defaultModel`, `roleTemplateId`), which would fail the OAuth cat acceptance path.

## Fix

- Added deployment payload detection in `utils/im-mappers.js` and render support in `MessageBubble.vue`.
- Changed deployment confirm/cancel to send structured deployment actions with `deploymentRequestId`, `actionId`, `channelId`, and `channelType`.
- Normalized wrapped project-group and deployment responses in `stores/projectGroup.js`, `stores/deployment.js`, and `stores/clowder.js`.
- Hydrated backend role templates, model options, and skill catalog into `stores/agent.js`.
- Loaded agent directory/skills on the relevant agent pages and changed skill upload to explicit unavailable behavior until a real picker/upload flow is implemented.
- Normalized create-cat payloads in `stores/agent.js` and `stores/clowder.js`, with Claude Code + OAuth defaulting to the backend-required `claude` account ref.

## Evidence

- `npm run test:unit` - 42 tests passed.
- `npm run build:h5` - build complete.
- `git diff --check` - clean.

## Remaining Verification

This resolves code-level V1-3 gaps, but full V1-3 completion still requires live H5 evidence for OAuth cat, PM project group, Kanban/artifacts, and deployment card behavior against the running Clowder stack.

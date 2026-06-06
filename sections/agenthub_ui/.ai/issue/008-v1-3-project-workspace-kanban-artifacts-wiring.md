# 008 - V1-3 Project Workspace Kanban / Artifacts Wiring Gap

## Status

Resolved in worktree.

## Problem

The V1-3 acceptance plan requires project groups to surface real Clowder Kanban and artifacts data. The components and stores existed, but the group right workspace still used the older local board surface:

- `RightWorkspace.vue` rendered an inline board from `agentStore.boards`.
- `GroupInfoPanel.vue` only showed the board entry when a local `agentStore.boards` item existed.
- `ProjectKanbanPanel.vue` and `ProjectArtifactsPanel.vue` were present but not mounted from the group workspace.
- `ProjectArtifactsPanel.vue` loaded artifacts by `coordinationId`, while the real project workspace path is keyed by Clowder `threadId`.

This meant a real project group could pass deployment-card hydration while still failing the plan's Kanban/artifacts UI requirement.

## Fix

- Added `clowderApi.getThreadArtifacts(threadId)` and `clowderStore.fetchThreadArtifacts(threadId)`.
- Stored thread artifacts and diagnostics by Clowder thread id.
- Rewired `RightWorkspace.vue` so group chats hydrate `clowderStore.fetchBinding(channelId, channelType)`, resolve the bound thread id, and mount `ProjectKanbanPanel` / `ProjectArtifactsPanel`.
- Rewired `GroupInfoPanel.vue` to expose `Clowder 项目工作台` from a real `projectThreadId`, not from `agentStore.boards`.
- Updated `ProjectArtifactsPanel.vue` to prefer `threadId` and fetch real thread artifacts.
- Added unit regressions that fail if the project workspace path falls back to `agentStore.boards`.

## Evidence

- Red test observed before fix:
  - `ProjectKanbanPanel` missing from `RightWorkspace.vue`.
  - `clowderStore.fetchThreadArtifacts is not a function`.
- `pnpm test:unit tests/unit/clowder-agent.spec.js tests/unit/no-business-mock.spec.js` - 50 tests passed in the affected unit runner set.
- `pnpm test:unit` - 50 tests passed.
- `pnpm build:h5` - `DONE Build complete.`

## Remaining Verification

Code and build coverage now prove the real project workspace panels are wired. A fresh browser/live screenshot pass should still capture the actual Kanban/artifacts sidebar in the running H5 app before final V1 completion is claimed.

# Implementation Plan: IM Web UI Optimization

**Branch**: `001-im-web-ui-optimization` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-im-web-ui-optimization/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build the AgentHub Vue 3/uni-app version of the IM Web UI optimization. The plan uses three references: `seedcmp/sections/im_web` for mature IM behavior, `C:/Users/25756/Desktop/字节挑战赛/uni` for the current React/Vite visual prototype, and `references/manifest.pdf` for old-version UI/function-module coverage. Before implementation, a lightweight source reference audit records behavior, visual, and coverage mapping notes in contracts. The first implementation phase must make the repo runnable for H5 visual testing, then deliver a cross-platform IM shell, chat experience, collaboration/resource pages, manifest coverage mapping, and stage-by-stage QA/issue/commit workflow.

## Technical Context

**Language/Version**: JavaScript with Vue 3 single-file components in a uni-app project. TypeScript is not required for the first pass because the current AgentHub shell uses `.js`, but new design contracts keep names compatible with a later TS migration.

**Primary Dependencies**: uni-app APIs, Vue 3, Pinia, an open-source icon source exposed through `components/common/AppIcon.vue`, and deterministic HTTPS avatar/image sources during development. Exact package versions are deferred to implementation setup so they can match the installed uni-app toolchain; every new dependency and platform API must pass H5 + APP-PLUS/Android compatibility review with guard/fallback notes before adoption.

**Storage**: Pinia stores for shared app/session/navigation/conversation/message/contact/agent/file/settings state; `uni.setStorageSync`/`uni.getStorageSync` for persisted preferences such as theme, draft cache, and recent route when needed.

**Testing**: H5 dev server visual testing at 375px, 768px, 1024px, and 1440px; automated H5 smoke/screenshot checks added immediately after the H5 runtime exists; Android app/simulator validation after navigation, safe-area, or APP-PLUS behavior changes; issue log at `issues/001-im-web-ui-optimization-qa.md`; each story QA records the 5-second recognition result for active module, active conversation, message input affordance, and next action.

**Target Platform**: Desktop browser, H5/web, mobile browser viewport, and Android app.

**Project Type**: Cross-platform uni-app application.

**Performance Goals**: No layout overlap or horizontal scroll in supported viewports; primary navigation and chat input visible within 5 seconds of page load in local H5; message lists and right workspaces must reserve stable space to avoid visible layout shift.

**Constraints**: Pinia for shared state; platform APIs behind uni-app guards; dependency and platform API compatibility notes required before adoption; HTTPS hotlinked images unless a documented exception exists; icons from one open-source icon path; Chinese commit messages at every checkpoint; `manifest.pdf` coverage must be mapped before task generation, with deferred legacy modules allowed to remain only in the coverage contract until implementation starts.

**Scale/Scope**: 8 primary modules, additional legacy subpages/panels from the 37-page/57-screen manifest, about 30-40 Vue components, 8 domain Pinia stores, one QA issue log, and three UI contracts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Stack Gate**: Design keeps uni-app + Vue 3 + Pinia as the default stack. No replacement exception.
- [x] **Platform Gate**: Desktop browser, H5/web, mobile viewport, and Android app are explicit targets. APP-PLUS-only behavior will use guarded fallbacks.
- [x] **State Gate**: Shared state is assigned to Pinia stores; transient drawer, tab, focus, and panel state stays component-local.
- [x] **Assets & Icons Gate**: Images use HTTPS hotlinks/fallbacks during development. Icons route through `AppIcon.vue` and an open-source icon source.
- [x] **Dependency & Platform Guard Gate**: New dependencies and platform APIs require H5 + APP-PLUS/Android compatibility review, conditional guards, and fallback notes before adoption.
- [x] **QA & Issues Gate**: Every stage includes viewport visual testing, automated H5 smoke/screenshot checks after runtime setup, Android validation when affected, 5-second recognition checks, and issue recording under `issues/001-im-web-ui-optimization-qa.md`.
- [x] **Git Gate**: Every phase checkpoint ends with a Chinese commit when files changed.

Post-design re-check: PASS. The research, data model, route/state contracts, quickstart, and manifest coverage contract preserve the same gates.

## Project Structure

### Documentation (this feature)

```text
specs/001-im-web-ui-optimization/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/
    legacy-manifest-coverage.md
    platform-compatibility.md
    routes-contract.md
    source-reference-audit.md
    ui-state-contract.md
  checklists/
    requirements.md
  references/
    manifest.pdf
```

### Source Code (repository root)

```text
App.vue
main.js
pages.json
manifest.json
uni.scss
package.json

pages/
  login/index.vue
  login/register.vue
  chat/index.vue
  chat/detail.vue
  group/index.vue
  group/create.vue
  group/members.vue
  contacts/index.vue
  contacts/friend-requests.vue
  contacts/add.vue
  contacts/blacklist.vue
  agents/index.vue
  agents/new.vue
  files/index.vue
  settings/index.vue
  settings/devices.vue

components/
  common/AppIcon.vue
  common/AppAvatar.vue
  common/AppEmptyState.vue
  common/AppStatusBadge.vue
  common/AppDialog.vue
  layout/AppShell.vue
  layout/DesktopSidebar.vue
  layout/MobileTabBar.vue
  chat/ConversationList.vue
  chat/ConversationItem.vue
  chat/MessageList.vue
  chat/MessageBubble.vue
  chat/MessageInput.vue
  chat/MessageContextMenu.vue
  chat/RightWorkspace.vue
  chat/FilePreviewPanel.vue
  chat/ClowderPanel.vue
  contacts/ContactList.vue
  contacts/ContactCard.vue
  agents/AgentCard.vue
  files/FileList.vue
  settings/SettingsSection.vue

stores/
  app.js
  navigation.js
  conversation.js
  message.js
  contact.js
  agent.js
  file.js
  settings.js

composables/
  useResponsiveLayout.js
  useSafeArea.js
  useVisualState.js

utils/
  formatConversation.js
  formatMessage.js
  avatarFallback.js
  manifestCoverage.js

styles/
  tokens.scss
  layout.scss
  themes.scss

issues/
  001-im-web-ui-optimization-qa.md
```

**Structure Decision**: The implementation will expand the initial uni-app shell into page-level routes under `pages/`, shared UI under `components/`, domain state under `stores/`, and planning/QA references under `specs/` and `issues/`. This structure follows the spec ownership map and adds legacy subpages required by `manifest.pdf`.

## Complexity Tracking

> No constitution violations. No additional complexity exceptions are required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

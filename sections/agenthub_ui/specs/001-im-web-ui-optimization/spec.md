# Feature Specification: IM Web UI Optimization

**Feature Branch**: `001-im-web-ui-optimization`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "这个项目是对 C:\\Users\\25756\\Desktop\\字节挑战赛\\seedcmp\\sections\\im_web 的 UI 优化，是 C:\\Users\\25756\\Desktop\\字节挑战赛\\uni 的 Vue 版本，但是遵循宪章，要求规划好文件夹目录文件；补充 manifest.pdf 作为老版本 UI 和对应功能模块内容参考"

## Clarifications

### Session 2026-06-03

- Q: Source reference audit depth? -> A: Audit `im_web` behavior, `uni` visual prototype, and `manifest.pdf` before implementation, then record mapping notes in contracts.
- Q: Platform guard and dependency compatibility policy? -> A: Every new dependency and platform API must be checked for H5 + APP-PLUS/Android compatibility, with conditional guards and fallback notes documented.
- Q: Automated H5 smoke/screenshot checks? -> A: Add automated H5 smoke/screenshot checks after runtime setup, while keeping manual visual QA and issue closure at every phase.
- Q: Five-second recognition success criterion? -> A: Verify the 5-second recognition check in every story visual QA phase and record results in the QA issue log.
- Q: Legacy module deferral and QR code ownership? -> A: Deferred legacy modules stay only in the coverage contract until implementation starts; no route/component placeholder is required before that.

## Constitution Alignment *(mandatory)*

- **Target Platform Matrix**: Desktop browser, H5/web, mobile viewport, and Android app are all in scope. Desktop must support an IM workbench layout; mobile and Android must support list/detail switching, safe-area spacing, and touch-first navigation.
- **Pinia State Impact**: Planned shared stores cover app/session state, navigation, conversations, messages, contacts/groups, agents, files/previews, and settings. Component-local state is limited to transient UI controls such as open drawers, active tabs, and text input focus.
- **Assets & Icons**: Images use stable HTTPS hotlinks or avatar generation URLs during development, with fallback initials/placeholder states. Icons must be provided through an open-source icon wrapper, not bitmap icon files or emoji.
- **Platform Guard Plan**: Every new dependency and platform API must be checked for H5 and APP-PLUS/Android compatibility before adoption, with conditional compilation guards and fallback notes recorded in planning or QA artifacts.
- **Stage QA Plan**: Each stage must run visual browser testing at 375px, 768px, 1024px, and 1440px viewports; automated H5 smoke/screenshot checks are added after runtime setup; Android validation is required after route/navigation or safe-area changes. `references/manifest.pdf` is the old-version UI/module baseline to compare against. Findings, including the 5-second recognition check, are recorded under `issues/001-im-web-ui-optimization-qa.md`.
- **Chinese Stage Commit Plan**: Commit after specification, layout foundation, each page group, visual QA fixes, and final polish using Chinese commit messages.

## Source References

- **Old Vue IM behavior reference**: `C:\\Users\\25756\\Desktop\\字节挑战赛\\seedcmp\\sections\\im_web`
- **Current React/Vite visual prototype**: `C:\\Users\\25756\\Desktop\\字节挑战赛\\uni`
- **Old UI/function manifest**: `specs/001-im-web-ui-optimization/references/manifest.pdf`

`manifest.pdf` contains 37 pages and 57 old-version UI screenshots generated from the IM Web application. It is the coverage baseline for legacy UI screens and feature modules. The optimized Vue/uni-app plan MUST account for every relevant module listed in the PDF, even when final implementation merges, renames, or stages modules differently.

Before implementation starts, the project MUST perform a lightweight source reference audit across `im_web`, `uni`, and `manifest.pdf`. The audit records behavior, visual, and coverage mapping notes in the feature contracts so implementation tasks do not rely on ad-hoc reverse engineering.

### Legacy UI Coverage From manifest.pdf

- Login and registration: password login, QR login entry, registration form, and mobile login adaptation.
- IM workbench: welcome page, conversation list, unread/pinned/muted/notification states, summaries, and global search.
- Contacts and relationship management: contacts, groups, robots, Clowder contacts, friend requests, add friend, blacklist, and profile/settings drawer.
- Group creation and management: create group, invite members, QR code, member list, member search, member admin actions, and Clowder cat member management.
- Robot and Clowder modules: add robot, add Clowder cat, DeepSeek AI contact, Clowder AI contact, cat direct chat, Clowder right panel, thread/focus/agents/status surfaces.
- Chat interactions: single chat, group chat, message list, input toolbar, send button, message context menu, reply preview, avatar context menu, @ member popup, and robot menu.
- Preview and media surfaces: file preview for Markdown/text/HTML/PDF/Office fallback, image lightbox, code/AI preview, and right-side workspace.
- System and account surfaces: device management, online devices, remove device, logout session, dark mode, connection/recovery state, and settings/profile surfaces.
- Multi-device responsive baseline: desktop 1440x900, tablet 768x1024, and mobile 390x844 screenshots for welcome, contacts, single chat, group chat, Clowder panel, and create group pages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 跨端 IM 主框架可用 (Priority: P1)

用户打开 AgentHub 后，能够在桌面端看到清晰的 IM 工作台，在移动端/安卓端看到适合触控的主导航，并能进入聊天、联系人、智能体、文件和设置等核心模块。

**Why this priority**: 主框架决定所有 UI 优化的入口、导航和跨端适配，是后续页面迁移与视觉优化的基础。

**Independent Test**: 从登录入口进入应用，在桌面宽屏、平板宽度、手机宽度中逐一访问主导航，确认每个核心模块可到达且无横向溢出或遮挡。

**Acceptance Scenarios**:

1. **Given** 用户处于桌面浏览器，**When** 进入主应用，**Then** 侧边导航、会话列表、聊天区域和可选右侧工作区按工作台布局呈现。
2. **Given** 用户处于手机宽度或安卓端，**When** 打开主应用，**Then** 底部/紧凑导航可触达核心模块，列表页和详情页不会同时挤压导致不可读。
3. **Given** 用户切换模块，**When** 返回聊天模块，**Then** 当前导航状态和可见页面标题保持一致。

---

### User Story 2 - 聊天体验清晰稳定 (Priority: P1)

聊天用户能够浏览会话列表、进入单聊或群聊、阅读多类型消息、使用输入区发送内容，并看到清晰的连接、未读、置顶、免打扰、草稿和 @ 提醒状态。

**Why this priority**: 聊天是 IM 产品的核心工作流，直接决定 UI 优化是否可用。

**Independent Test**: 使用模拟会话数据分别打开单聊、群聊和智能体会话，验证列表摘要、消息气泡、输入区、发送状态和空/错误状态的可读性。

**Acceptance Scenarios**:

1. **Given** 会话列表存在置顶、免打扰、未读和草稿会话，**When** 用户浏览列表，**Then** 每种状态都有明确且不依赖颜色单独表达的标识。
2. **Given** 聊天详情包含文本、图片、文件、语音、卡片、系统消息和撤回消息，**When** 用户滚动消息，**Then** 内容分组、发送方、时间和操作状态保持可读。
3. **Given** 用户在群聊输入 @、回复、附件或普通文本，**When** 输入区展开辅助面板，**Then** 输入框不会遮挡消息列表或移动端底部导航。

---

### User Story 3 - 协作面板和资源页一致 (Priority: P2)

协作用户能够在联系人、智能体、文件/预览和设置页面中获得一致的视觉结构，并在桌面端使用右侧工作区预览文件、代码或 Clowder 面板。

**Why this priority**: 这些页面支撑 IM 之外的协作场景，必须和聊天主体验形成统一产品感。

**Independent Test**: 访问联系人、智能体、文件和设置页面，打开右侧预览/Clowder 面板，验证页面层级、卡片密度、按钮状态和移动端退路一致。

**Acceptance Scenarios**:

1. **Given** 用户打开联系人页，**When** 搜索联系人或进入群组入口，**Then** 行项目、空状态和操作按钮与聊天列表保持同一视觉语言。
2. **Given** 用户打开智能体页，**When** 查看智能体状态，**Then** 空闲、忙碌、离线等状态可被清晰区分并可进入对话。
3. **Given** 桌面用户打开文件或 Clowder 预览，**When** 右侧工作区出现，**Then** 主聊天区仍可操作，面板宽度和关闭路径明确。

---

### User Story 4 - 目录与文件规划可交接 (Priority: P2)

开发者能够基于规格直接理解 Vue/uni-app 版本的页面、组件、状态、样式、工具和 QA 文件应该放在哪里，不需要先猜测 React 版本和 im_web 版本的映射关系。

**Why this priority**: 目录规划是本需求的显式目标，可减少后续实现阶段的重复返工和跨端适配遗漏。

**Independent Test**: 对照目录规划检查每个主页面、共享组件、Pinia store、样式文件和 issues 记录位置，确认没有未归属的核心模块。

**Acceptance Scenarios**:

1. **Given** 开发者准备创建页面，**When** 查看本规格目录规划，**Then** 能找到对应的 `pages/` 路径、共享组件路径和状态归属。
2. **Given** 后续任务生成，**When** 拆分阶段任务，**Then** 每个任务都能引用明确文件路径和阶段 QA 记录路径。

### Edge Cases

- Very small mobile viewport at 375px width with Android safe-area inset must not hide fixed navigation, input controls, or primary CTA.
- Long Chinese names, long group names, long file names, and long message text must wrap or truncate predictably without overlapping timestamps or badges.
- Empty conversations, failed sync, reconnecting, kicked-out, no contacts, no agents, no files, and denied notification permission states must have visible recovery guidance.
- Hotlinked avatar or image load failures must show initials, icon placeholders, or retry/error affordances without layout shift.
- Right-side preview or Clowder workspace must become a full-screen or stacked mobile experience instead of squeezing the chat below readable width.
- Chinese labels must render correctly; mojibake in navigation or page labels is a blocking UI issue.
- Reduced-motion users must not depend on animation to understand loading, sending, recording, or panel transitions.
- Modules visible in `manifest.pdf` but not present in the React/Vite prototype must be captured as planned Vue/uni-app pages, panels, or deferred items with explicit rationale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The optimized UI MUST use `im_web` as the behavior and interaction reference, and the `uni` project as the current visual/page reference to be converted into the AgentHub Vue/uni-app experience. Before implementation, the project MUST audit `im_web`, `uni`, and `manifest.pdf`, then record mapping notes in feature contracts.
- **FR-002**: The app MUST expose primary routes for login, chat, group chat, contacts, agents, files, and settings.
- **FR-003**: The app MUST provide a desktop workbench layout with navigation, conversation list, chat workspace, and optional right-side preview/Clowder workspace.
- **FR-004**: The app MUST provide a mobile/Android layout with touch-first navigation, safe-area spacing, and list/detail switching that prevents content overlap.
- **FR-005**: Navigation labels, page titles, button text, empty states, and status text MUST render as correct Chinese.
- **FR-006**: The conversation list MUST show selected, pinned, muted, unread, draft, @ mention, sync error, and notification-permission states.
- **FR-007**: The chat view MUST support readable presentation states for text, image, GIF, voice, video, location, card, file, merged history, sticker, system, revoked, failed, and loading messages.
- **FR-008**: The input area MUST include states for plain text, sending, disabled empty send, reply preview, @ mention target, image/file selection, voice recording, and AI/robot command affordances.
- **FR-009**: The right workspace MUST support file/code/image preview and Clowder/agent collaboration states on desktop, with a mobile-safe replacement pattern.
- **FR-010**: Contacts and group entry points MUST include search, add friend, create group, group list, profile, online/offline, and empty/error states.
- **FR-011**: Agents UI MUST show agent identity, status, capability summary, and a clear path to start a conversation.
- **FR-012**: Files UI MUST show file list, type, size, preview/open actions, empty state, and failure state.
- **FR-013**: Settings UI MUST cover profile, theme, notification, device/session, and Android-relevant permission surfaces.
- **FR-014**: Shared state MUST be assigned to Pinia stores; transient drawer/tab/input state MAY remain in page or component state.
- **FR-015**: Icons MUST be routed through one open-source icon wrapper; structural emojis and bitmap icon files MUST NOT be used.
- **FR-016**: Development images and avatars SHOULD use HTTPS hotlinks or deterministic avatar services, with fallback placeholders documented.
- **FR-017**: UI controls MUST meet touch target, visible focus, contrast, and reduced-motion requirements defined by the design baseline and constitution.
- **FR-018**: Every implementation phase MUST include visual browser testing, issue recording under `issues/`, issue resolution, re-test, and Chinese git commit before moving on.
- **FR-019**: `manifest.pdf` MUST be treated as the authoritative old-version UI/module coverage baseline during planning.
- **FR-020**: The implementation plan MUST map each legacy module from `manifest.pdf` to one of: included in current scope, merged into another page/panel, deferred with reason, or intentionally removed with approval.
- **FR-021**: Visual QA MUST compare optimized screens against the legacy manifest for functional coverage, while allowing improved layout, responsive behavior, accessibility, and visual style.
- **FR-022**: Every new dependency and platform API MUST be checked for H5 and APP-PLUS/Android compatibility before adoption, with conditional guard and fallback notes documented.
- **FR-023**: After the H5 runtime is available, the project MUST add automated H5 smoke/screenshot checks for the required responsive breakpoints while keeping manual visual QA mandatory.
- **FR-024**: Each story-level visual QA phase MUST record whether a reviewer can identify the active module, active conversation, message input affordance, and next action within 5 seconds.
- **FR-025**: Deferred legacy modules MAY remain only in the coverage contract with rationale until implementation starts; no route or component placeholder is required before that point.

### Folder & File Planning Requirements

The Vue/uni-app version MUST use this planned ownership map unless the implementation plan documents a justified exception:

```text
App.vue
main.js
pages.json
manifest.json
uni.scss

pages/
  login/index.vue
  chat/index.vue
  chat/detail.vue
  group/index.vue
  contacts/index.vue
  agents/index.vue
  files/index.vue
  settings/index.vue

components/
  common/AppIcon.vue
  common/AppAvatar.vue
  common/AppEmptyState.vue
  common/AppStatusBadge.vue
  layout/AppShell.vue
  layout/DesktopSidebar.vue
  layout/MobileTabBar.vue
  chat/ConversationList.vue
  chat/ConversationItem.vue
  chat/MessageList.vue
  chat/MessageBubble.vue
  chat/MessageInput.vue
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

styles/
  tokens.scss
  layout.scss
  themes.scss

issues/
  001-im-web-ui-optimization-qa.md

specs/001-im-web-ui-optimization/
  references/manifest.pdf
  contracts/platform-compatibility.md
  contracts/source-reference-audit.md
```

### Key Entities *(include if feature involves data)*

- **Navigation Item**: Represents a main module entry with label, icon, active state, route, platform visibility, and badge count.
- **Conversation Preview**: Represents a chat entry with avatar, name, type, last message digest, time, unread count, pinned/muted/draft/mention state, and sync status.
- **Message Item**: Represents one visible message with sender, direction, content type, timestamp, delivery state, reactions, reply reference, and available actions.
- **Contact or Group**: Represents a person or group with identity, avatar, online/member state, search metadata, and action entry points.
- **Agent**: Represents an AI/collaboration participant with display name, capability summary, status, and start-chat action.
- **File Preview**: Represents previewable content with file identity, type, size, preview state, error state, and open/download actions.
- **UI Issue Record**: Represents visual QA findings with platform, viewport, reproduction, expected/actual result, severity, status, and verification note.
- **Directory Plan Item**: Represents a target file or folder and the page/component/store responsibility it owns.
- **Legacy Manifest Screen**: Represents an old-version UI screenshot/module entry from `manifest.pdf`, with title, viewport, related module, mapping status, rationale, and optional target route/component when the module is included or merged.
- **Source Reference Audit Item**: Represents an implementation reference finding from `im_web`, `uni`, or `manifest.pdf`, with module, source path, behavior note, visual note, target route/component, and open risk.
- **Platform Compatibility Record**: Represents a dependency or platform API compatibility check with H5 support, APP-PLUS/Android support, guard/fallback strategy, and QA impact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of primary modules (login, chat, group, contacts, agents, files, settings) are reachable from both desktop and mobile navigation during visual QA.
- **SC-002**: At 375px, 768px, 1024px, and 1440px widths, no primary text, buttons, badges, fixed navigation, message input, or preview panel overlaps another UI element.
- **SC-003**: A reviewer can identify the active module, active conversation, message input affordance, and next available action within 5 seconds on each primary screen, and each story-level visual QA phase records the result.
- **SC-004**: The folder/file plan maps every primary route to at least one page file, relevant component ownership, Pinia store ownership, and QA issue record path.
- **SC-005**: All issues found during stage visual testing are recorded, fixed, re-tested, and marked resolved before the following stage begins.
- **SC-006**: Touch targets for primary actions meet at least 44px by 44px on mobile/Android validation screens.
- **SC-007**: Chinese UI text shows no encoding corruption in navigation, page titles, status labels, empty states, and action buttons.
- **SC-008**: 100% of modules listed in `manifest.pdf` have an explicit included, merged, deferred, or removed mapping before implementation tasks are generated.

## Assumptions

- AgentHub (`C:\\Users\\25756\\Desktop\\字节挑战赛\\agenthub`) is the target Vue/uni-app project for implementation.
- `seedcmp\\sections\\im_web` is the mature IM behavior/reference source, especially for conversation, message, input, right dock, contact, and Clowder workflows.
- `C:\\Users\\25756\\Desktop\\字节挑战赛\\uni` is the current React/Vite visual prototype whose page set and design direction should be converted to Vue/uni-app.
- `manifest.pdf` is a legacy UI/function-module inventory, not a requirement to copy old visual styling exactly; the optimized UI may improve layout and style while preserving covered user capabilities.
- Backend connectivity, authentication, and SDK behavior may be connected after the UI foundation, but UI states must be planned now so empty/loading/error flows exist.
- The current AgentHub repo does not yet include a package/runtime script, so the implementation plan must add a runnable H5 workflow before visual browser testing can pass.
- Desktop browser, H5/web, mobile viewport, and Android are all in scope unless a future amendment narrows the platform matrix.

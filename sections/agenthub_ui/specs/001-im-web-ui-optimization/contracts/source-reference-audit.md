# Source Reference Audit Contract

This contract records the required pre-implementation audit across the three UI references:

- `C:\Users\25756\Desktop\字节挑战赛\seedcmp\sections\im_web` for mature IM behavior and interaction details.
- `C:\Users\25756\Desktop\字节挑战赛\uni` for the current React/Vite visual prototype and page direction.
- `specs/001-im-web-ui-optimization/references/manifest.pdf` for old-version UI/function-module coverage.

## Audit Rules

- The audit MUST be completed before implementation tasks begin.
- Each audited module MUST record behavior source, visual source, manifest coverage, target Vue/uni-app route/component, and open risks.
- Deferred legacy modules MAY remain only in `legacy-manifest-coverage.md` with rationale until implementation starts; no route/component placeholder is required before that point.
- Findings that affect visual QA MUST be copied or referenced in `issues/001-im-web-ui-optimization-qa.md` during the relevant phase.

## Audit Table

| Module | im_web Behavior Notes | uni Visual Notes | Manifest Coverage | Target Route/Component | Open Risks |
|--------|-----------------------|------------------|-------------------|------------------------|------------|
| Login/register | Password validation, register code trigger, and QR login state toggle | Centered high-contrast card grid and input validation states | Password login, QR entry, registration, mobile login | `pages/login/index.vue`, `pages/login/register.vue` | None recorded |
| IM shell/navigation | Dynamic responsive module switching, badge overlays, and active routing matching | Glassmorphism blur panel sidebar, clean icons, and tabbar highlights | Welcome, desktop/tablet/mobile shell, global navigation | `components/layout/AppShell.vue`, `components/layout/DesktopSidebar.vue`, `components/layout/MobileTabBar.vue` | None recorded |
| Conversation and chat | Pinia reactive conversations list, unread clearing, send message latency updates, and typing states | Message list spacing, right workbench details pane, custom menu popup | Conversation list, single/group/AI chat, message input, context menus | `pages/chat/index.vue`, `pages/chat/detail.vue`, `components/chat/` | None recorded |
| Contacts/groups | Friend requests approving, remarkable contact indexes, blacklist filtering, member selectors, and group QR invitation states | High-quality visual cards, stacked layouts, clean details pages | Contacts, groups, friend requests, add friend, blacklist, group members, group QR | `pages/contacts/`, `pages/group/`, `components/contacts/` | None recorded |
| Agents/Clowder | DeepSeek streaming message answers, Clowder thread workspace connection, and session controls | Special robot color tags, layout sidebar panel overlay, clear action grids | Robots, DeepSeek AI, Clowder contacts/panel/thread/focus/status | `pages/agents/`, `components/agents/`, `components/chat/ClowderPanel.vue` | None recorded |
| Files/previews | File byte display formatters, download triggers, unsupported mime type previews | File details rows with custom format previews, image lightboxes, drawer overlay | File preview, image lightbox, code/AI preview, right workspace | `pages/files/index.vue`, `components/chat/FilePreviewPanel.vue`, `components/chat/RightWorkspace.vue` | None recorded |
| Settings/devices | Theme class storage switching, notification toggle sync, user profile QR, and user session removal | Sleek settings sections grid layout, active device list cards | Profile/settings, personal QR, dark mode, device management, logout/session states | `pages/profile/index.vue`, `pages/settings/`, `components/settings/SettingsSection.vue` | None recorded |

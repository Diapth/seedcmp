# Legacy Manifest Coverage Contract

`references/manifest.pdf` is the old-version UI and function-module baseline. Every row must be included, merged into another route/panel, deferred with reason, or removed with approval before implementation tasks are generated. Deferred rows may remain only in this coverage contract until implementation starts; they do not require a route/component placeholder before that point.

| Legacy Module From manifest.pdf | Viewports | Mapping Status | Target Route/Component | Notes |
|---------------------------------|-----------|----------------|------------------------|-------|
| Password login, QR login entry | desktop, mobile | included | `pages/login/index.vue` | Preserve both entry points. |
| Registration form | desktop | included | `pages/login/register.vue` | Phone/code/nickname/password states. |
| Chat welcome/workbench entry | desktop, tablet, mobile | included | `pages/chat/index.vue`, `AppShell` | Becomes main workbench landing. |
| Conversation list states | desktop | included | `ConversationList`, `ConversationItem` | Unread, pinned, muted, notifications, summary. |
| Conversation context menu | desktop | included | `MessageContextMenu` or `ConversationItem` menu | Mobile alternative must not rely on right click. |
| Global search | desktop | included | `pages/search/index.vue`, `ConversationList` search entry | Includes contacts, conversations/groups, chat records, files, and agents. |
| Global search empty state | desktop | included | `AppEmptyState` | Reusable empty state. |
| Contacts, groups, robots, Clowder contacts | desktop, tablet, mobile | included | `pages/contacts/index.vue` | Use grouped entries. |
| Friend requests | desktop | included | `pages/contacts/friend-requests.vue` | Include list and empty state. |
| Add friend | desktop | included | `pages/contacts/add.vue` | Include search and verification message. |
| Create group | desktop, tablet, mobile | included | `pages/group/create.vue` | Include members/cats selection. |
| Add robot | desktop | included | `pages/agents/new.vue` | Can be same creation page as Clowder cat. |
| Add Clowder cat | desktop | included | `pages/agents/new.vue` | Separate mode/section. |
| Blacklist | desktop | included | `pages/contacts/blacklist.vue`, `settings` entry | Shared from contacts/settings. |
| Device management | desktop | included | `pages/settings/devices.vue` | Online devices, remove, logout current session. |
| Single chat | desktop, tablet, mobile | included | `pages/chat/detail.vue` | Message list and input. |
| Message context menu | desktop | included | `MessageContextMenu` | Mobile long-press equivalent. |
| Reply preview | desktop | included | `MessageInput` | Above input. |
| Right Clowder panel | desktop, tablet, mobile | included | `ClowderPanel`, `RightWorkspace` | Mobile overlay/stacked mode. |
| User profile drawer | desktop | included | `AppDialog`/profile panel | Include add/delete/report/block actions as staged states. |
| DeepSeek AI contact | desktop | included | `Chat Detail`, `Agents` | AI contact state and input guidance. |
| Clowder AI contact | desktop | included | `Chat Detail`, `ClowderPanel` | Multi-agent connector state. |
| Clowder cat direct chat | desktop | included | `Chat Detail`, `Agents` | Stable cat identity. |
| Group chat | desktop, tablet, mobile | included | `pages/group/index.vue` or `chat/detail` mode | Member identity and group input. |
| Group @ member popup | desktop | included | `MessageInput` | Humans and Clowder cats. |
| Group avatar context menu | desktop | included | `MessageContextMenu` | @TA and view profile. |
| Group info drawer | desktop | included | `RightWorkspace`/group panel | Profile, announcement, settings entry. |
| Invite members | desktop | included | `pages/group/members.vue` | Search, manual UID, confirm. |
| Group QR code | desktop | included | `pages/group/qrcode.vue` | Includes QR display, approval-required state, expired/unavailable state, regenerate, share/copy actions. |
| Group member list/search/admin | desktop | included | `pages/group/members.vue` | Include cat member management. |
| Profile/settings drawer | desktop | included | `pages/profile/index.vue`, `pages/settings/index.vue` | Nickname, avatar, personal QR, notifications, devices, blacklist. |
| Dark mode | desktop | included | `stores/settings.js`, `themes.scss` | Must be testable in H5. |
| Robot menu in input | desktop | included | `MessageInput` | Loading/unavailable/command states. |
| File preview Markdown/text/HTML/PDF/Office | desktop | included | `FilePreviewPanel` | Office/PDF fallback acceptable. |
| Image lightbox | desktop | included | `FilePreviewPanel` or common overlay | Opens from image message. |
| Console/request failure notes | desktop | included as QA | `issues/001-im-web-ui-optimization-qa.md` | Must be tracked in visual QA. |

## Coverage Rule

The implementation plan may merge old screens into fewer Vue/uni-app pages, but each old capability above must remain traceable to a route, component, or documented deferral.

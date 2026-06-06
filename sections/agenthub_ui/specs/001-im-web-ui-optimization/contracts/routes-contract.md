# UI Route Contract: IM Web UI Optimization

## Primary Routes

| Route | Page File | Desktop Behavior | Mobile/Android Behavior | Required States |
|-------|-----------|------------------|-------------------------|-----------------|
| `/login` | `pages/login/index.vue` | Centered login panel with password and QR entry | Full-screen login with safe-area spacing | password login, QR entry, loading, error |
| `/login/register` | `pages/login/register.vue` | Registration form with clear validation | Touch-first stacked form | phone, code, nickname, password, validation |
| `/chat` | `pages/chat/index.vue` | Workbench welcome plus conversation list | Conversation list with mobile tab bar | welcome, empty, sync error, search |
| `/chat/detail` | `pages/chat/detail.vue` | Chat detail inside workbench | Detail screen with back path to list | single chat, group chat, AI chat, failed send |
| `/search` | `pages/search/index.vue` | Global search across contacts, conversations, messages, files, and agents | Full-screen touch-first search | keyword, categories, result list, empty |
| `/profile` | `pages/profile/index.vue` | Profile/details surface with personal QR and security entries | Full-screen profile details | profile, QR, devices entry, blacklist entry |
| `/group` | `pages/group/index.vue` | Group chat detail or group landing | Group detail/list view | member summary, group settings entry |
| `/group/create` | `pages/group/create.vue` | Create group flow | Touch-first create flow | group name, contacts/cats select, confirm |
| `/group/members` | `pages/group/members.vue` | Member management page/panel | Full-screen member list | search, admin actions, cat members |
| `/group/qrcode` | `pages/group/qrcode.vue` | Group QR sharing and approval/expired states | Full-screen QR sharing state | active QR, approval required, expired, copy/share |
| `/contacts` | `pages/contacts/index.vue` | Contact list and quick entries | Stacked contact search and entries | contacts, groups, robots, Clowder contacts |
| `/contacts/friend-requests` | `pages/contacts/friend-requests.vue` | Friend request list | Full-screen request list | list, empty, accept/reject |
| `/contacts/add` | `pages/contacts/add.vue` | Search/add friend | Touch-first add flow | search, verification message, error |
| `/contacts/blacklist` | `pages/contacts/blacklist.vue` | Blacklist management | Full-screen list | empty, remove, confirmation |
| `/agents` | `pages/agents/index.vue` | Agent catalog grid | Agent list/cards | status, capability, start chat |
| `/agents/new` | `pages/agents/new.vue` | Robot/Clowder creation form | Stacked creation flow | third-party AI config, Clowder cat connect |
| `/files` | `pages/files/index.vue` | File list with optional preview | File list with preview route/overlay | list, empty, preview, fallback |
| `/settings` | `pages/settings/index.vue` | Profile/settings sections | Stacked settings list | profile, theme, notifications, blacklist |
| `/settings/devices` | `pages/settings/devices.vue` | Device/session management | Full-screen device list | online devices, remove, logout |

## Navigation Rules

- Desktop uses `components/layout/DesktopSidebar.vue` as persistent navigation.
- Mobile and Android use `components/layout/MobileTabBar.vue` for primary modules.
- Detail pages must expose a visible back path on mobile/Android.
- Route registration must be reflected in `pages.json`.
- Active navigation state must use route matching, not visual-only state.

## Acceptance Checks

- Every route above is reachable from either primary navigation or a visible in-page action.
- No route requires hover-only discovery.
- Chinese labels render correctly in route titles, navigation items, and empty states.
- Android safe-area spacing is verified for navigation bars and fixed input areas.

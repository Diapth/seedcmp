# IM API Network Probe Report

- generatedAt: 2026-06-07T05:08:59.764Z
- apiBaseUrl: http://172.18.58.156:3000/v1
- tokenAcquired: true
- total: 16
- requiredFailures: 1
- frontendDependencyWarnings: 3

| Probe | Method | Path | Status | Category | Result |
|---|---|---|---:|---|---|
| health | GET | `/v1/health` | 200 | required | pass |
| appconfig | GET | `/v1/common/appconfig` | 200 | required | pass |
| login | POST | `/v1/user/login` | 200 | required | pass |
| appversion-web | GET | `/v1/common/appversion/web/1.0.0` | 200 | diagnostic | pass |
| devices | GET | `/v1/user/devices` | 200 | required | pass |
| my-qrcode | GET | `/v1/user/qrcode` | 200 | required | pass |
| friend-sync | GET | `/v1/friend/sync?version=0&api_version=1` | 200 | required | pass |
| friend-apply-list | GET | `/v1/friend/apply` | 200 | required | pass |
| group-my | GET | `/v1/group/my?limit=10` | 200 | required | pass |
| conversation-sync | POST | `/v1/conversation/sync` | 200 | required | pass |
| conversation-extra-sync | POST | `/v1/conversation/extra/sync` | 200 | required | pass |
| message-reminder-sync | POST | `/v1/message/reminder/sync` | 200 | required | pass |
| global-search-empty | POST | `/v1/search/global` | 400 | required | fail |
| favorite-my | GET | `/v1/favorite/my?page_index=1&page_size=1` | 404 | frontend-dependency | pass |
| sticker-category | GET | `/v1/sticker/user/category` | 404 | frontend-dependency | pass |
| organization-joined | GET | `/v1/organization/joined` | 404 | frontend-dependency | pass |

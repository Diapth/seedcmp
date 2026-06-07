# UI State Contract: IM Web UI Optimization

## Global Shell

- **Required states**: loading app, authenticated, unauthenticated, reconnecting, kicked out, dark mode, mobile detail, desktop workbench.
- **Visual requirements**: connection banner must not cover navigation or input; dark mode must keep contrast; kicked-out state must provide re-login action.

## Conversation List

- **Required states**: empty, loading, sync failed, selected, unread, pinned, muted, draft, @ mention, notification permission unsupported/denied/default.
- **Actions**: select, pin/unpin, mute/unmute, hide, delete, search, clear search.
- **Visual requirements**: unread and mention states cannot rely on color alone; time and badges cannot overlap digest text.

## Chat Detail

- **Required states**: welcome, single chat, group chat, AI contact, Clowder contact, loading earlier messages, typing, failed send, revoked, system message.
- **Actions**: send, retry, copy, reply, edit, revoke, local delete, mutual delete, view receipt, react, preview file/image/code.
- **Visual requirements**: message bubbles max out at readable width; input remains visible; right workspace must not compress chat below usable width.

## Message Input

- **Required states**: idle, typing, empty disabled, sending, reply preview, mention popup, attachment selected, voice recording, voice unsupported, robot menu loading/ready/unavailable/failed, AI generating.
- **Actions**: send, insert mention, choose image, choose file, record/send/cancel voice, open robot menu, trigger AI assistant.
- **Visual requirements**: helper panels anchor above input and stay within viewport; mobile keyboard/safe-area must not hide send button.

## Right Workspace

- **Required states**: hidden, file preview loading, file preview ready, file preview failed, Clowder panel ready, multiple tabs, resizing, mobile overlay.
- **Actions**: open, close, switch tab, resize desktop, retry preview, download/open externally when available.
- **Visual requirements**: desktop width bounded; mobile overlay has clear close/back control; failed preview includes recovery path.

## Contacts and Groups

- **Required states**: contact list, group list, friend requests, add friend, create group, group member list, member search, invite, QR unavailable/expired, blacklist empty/list.
- **Actions**: search, add friend, accept/reject request, create group, invite member, view profile, block/unblock, open chat.
- **Visual requirements**: search results and empty states must explain the next action.

## Agents and Clowder

- **Required states**: agent grid/list, idle, busy, offline, third-party AI config, Clowder cat connect, Clowder thread/focus/agents/status.
- **Actions**: create agent, start chat, open Clowder panel, select focus, inspect status.
- **Visual requirements**: status must use label/icon plus color; agent cards must remain tappable at mobile sizes.

## Files and Preview

- **Required states**: file list, empty, Markdown/text/HTML/PDF/Office preview, image lightbox, unsupported file, load failure.
- **Actions**: preview, download, open externally, copy, close.
- **Visual requirements**: preview panel has stable dimensions; unsupported files show fallback instead of blank space.

## QA Issue Log

- **Required states**: open, fixing, fixed, verified, deferred.
- **Required fields**: stage, platform, viewport, module, severity, reproduction, expected, actual, owner/status, verification.

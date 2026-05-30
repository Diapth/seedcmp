# Contract: IM Web to Clowder Bridge

## Overview

The bridge exposes TangSeng/WuKongIM conversations to Clowder as a first-class `im-web` connector. Browser code does not call Clowder directly; a backend bridge signs and forwards normalized IM events.

## Connector ID

```text
im-web
```

## External Chat ID

```text
{channelType}:{channelId}
```

Examples:

- Direct chat: `1:deepseek_ai_robot`
- Group chat: `2:group_123`

## Inbound Message Request

`POST /api/connectors/im-web/inbound`

Headers:

- `x-im-web-signature`: HMAC over the raw request body
- `x-im-web-timestamp`: unix milliseconds

Body:

```json
{
  "connectorId": "im-web",
  "externalChatId": "2:group_123",
  "channelId": "group_123",
  "channelType": 2,
  "chatType": "group",
  "chatName": "Product Group",
  "messageId": "987654321",
  "clientMsgNo": "browsertab-abc",
  "messageSeq": 42,
  "text": "@codex summarize this",
  "timestamp": 1780000000000,
  "sender": {
    "id": "u_10001",
    "name": "Alice"
  },
  "attachments": [
    {
      "type": "image",
      "url": "https://im.example/uploads/2/group_123/image.png",
      "fileName": "image.png",
      "size": 12345
    }
  ]
}
```

Success response:

```json
{
  "kind": "routed",
  "threadId": "thr_abc",
  "messageId": "msg_abc"
}
```

Skipped duplicate response:

```json
{
  "kind": "skipped",
  "reason": "duplicate"
}
```

Permission response:

```json
{
  "kind": "skipped",
  "reason": "group_not_allowed",
  "userMessage": "此群未授权使用 Clowder。请联系管理员授权。"
}
```

Permission-denied HTTP responses use status `403` with the same skipped envelope. Recognized reasons are `group_not_allowed`, `command_admin_only`, and `permission_denied`; IM Web maps each reason to a visible disabled or authorization state.

## Status Response

`GET /api/connectors/im-web/status`

Response:

```json
{
  "connectorId": "im-web",
  "enabled": true,
  "configured": true,
  "reachable": true,
  "version": "3.0",
  "featureFlags": {
    "multiAgent": true,
    "streaming": true,
    "mediaFallback": true,
    "groupPermissions": true
  }
}
```

TangSeng exposes the browser-facing equivalent through its Clowder status endpoint. Browser code should use the TangSeng endpoint rather than calling Clowder directly.

## Agent Directory

`GET /api/connectors/im-web/agents?externalChatId=2:group_123`

Response:

```json
{
  "externalChatId": "2:group_123",
  "agents": [
    {
      "id": "codex",
      "displayName": "Codex",
      "aliases": ["@codex", "codex"],
      "available": true,
      "preferred": true,
      "lastActiveAt": "2026-05-28T07:45:00.000Z",
      "messageCount": 12
    }
  ],
  "preferredCatIds": ["codex"],
  "lastActiveCatId": "codex"
}
```

The Clowder route resolves the requester from the `x-cat-cafe-user` identity header and derives directory entries from thread cats, participants, preferred cats, and last-active metadata.

## Outbound Delivery Callback

`POST /api/im-web/clowder/outbound`

Headers:

- `x-clowder-signature`: HMAC over the raw request body
- `x-clowder-timestamp`: unix milliseconds

Body:

```json
{
  "connectorId": "im-web",
  "externalChatId": "2:group_123",
  "threadId": "thr_abc",
  "invocationId": "invoke_123",
  "catId": "codex",
  "catDisplayName": "Codex",
  "content": "Here is the summary...",
  "format": "markdown",
  "richBlocks": [],
  "origin": {
    "triggerMessageId": "msg_abc"
  },
  "stream": {
    "state": "final",
    "platformMessageId": "im-client-msg-no-or-message-id"
  }
}
```

Success response:

```json
{
  "ok": true,
  "messageId": "998877",
  "clientMsgNo": "clowder-invoke_123-final"
}
```

## Streaming Events

Streaming uses the same outbound callback with `stream.state`:

- `placeholder`: create one pending IM assistant message
- `chunk`: edit/update the pending IM assistant message content
- `final`: persist final content and clear streaming state
- `cleanup`: finalize or remove stale placeholder

Implementations must keep `invocationId` and `platformMessageId` stable so IM Web can merge local, realtime, and history copies into one visible message.

## Command Mapping

Supported connector commands:

- `/new [title]`
- `/threads`
- `/use <thread-ref>`
- `/thread <thread-id> <message>`
- `/where`
- `/cats`
- `/cats new <cat-name> [@alias]`
- `/status`
- `/history [1-5]`
- `/focus [cat|clear]`
- `/ask <cat> <message>`
- `/allow-group [externalChatId]`
- `/deny-group [externalChatId]`

`/cats new` creates a Clowder runtime cat through the Clowder API process, returns a visible command response with the new cat id and alias, and relies on Clowder's catalog reconciliation so the new cat appears in later `/cats`, `/ask`, mention routing, and agent directory responses.

Commands must use the same permission rules as normal message routing.

## Error Codes

- `401 invalid_signature`
- `403 group_not_allowed`
- `403 command_admin_only`
- `403 permission_denied`
- `404 binding_not_found`
- `409 duplicate`
- `429 agent_queue_full`
- `503 clowder_unavailable`
- `504 clowder_timeout`

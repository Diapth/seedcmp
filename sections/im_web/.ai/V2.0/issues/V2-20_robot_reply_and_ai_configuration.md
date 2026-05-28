# V2-20 Robot Reply and AI Configuration

## Status

In progress

## Problem

The web client exposed a robot menu, but clicking a command did not produce a robot reply. The browser showed unrelated `coversation/clearUnread` requests, which made it look like the robot was calling the wrong HTTP endpoint.

TangSeng robot replies are not sent through a frontend HTTP command endpoint. The backend listens to normal IM messages and only replies when the message payload contains:

- `robot_id` matching the configured system account UID
- `entities[].type = bot_command`
- a command slice inside `content` that matches `systemRobotMap`

The previous frontend path did not prove the final SDK-encoded WebSocket payload matched that contract.

## Backend Contract

- `POST /v1/robot/sync`: sync robot menus. Request body is an array like `[{ "robot_id": "u_10000", "version": 0 }]`.
- WebSocket IM send: send the command as a normal text message. The payload must encode to:

```json
{
  "content": "/基本信息",
  "robot_id": "u_10000",
  "entities": [
    { "type": "bot_command", "offset": 0, "length": 5 }
  ],
  "type": 1
}
```

- `/v1/robots/:robot_id/:app_key/events`: external robot service polling endpoint. This is for server-side robot integrations, not for a web menu click.
- `/v1/robots/:robot_id/:app_key/sendMessage`: external robot service reply endpoint.

## Fix Scope

- Encode robot commands with a dedicated text `MessageContent` so the actual SDK `encode()` output includes `robot_id` and `bot_command` entities.
- Keep the system robot conversation entry available under Contacts.
- Add a Contacts `新增机器人` page where users can define custom AI robot settings.
- Store custom AI settings locally for the current frontend session/user scope until a server-side management API exists.

## AI Configuration Scope

The new page captures:

- robot name
- provider type
- API URL
- API key
- model
- system prompt
- enabled state

This is the frontend configuration surface. Full AI auto-reply still needs backend work: secure storage for API keys, robot account/menu creation, event consumption through `/v1/robots/:robot_id/:app_key/events`, AI provider calls, and replies through `/v1/robots/:robot_id/:app_key/sendMessage`.

## Verification

- Frontend test must assert the final encoded robot command payload, not only the intermediate `encodeJSON()` object.
- Backend test must assert command extraction uses the configured system UID and parses entity offset/length correctly.

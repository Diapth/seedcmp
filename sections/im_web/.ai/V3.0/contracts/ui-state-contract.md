# Contract: IM Web Clowder UI State

## Conversation Clowder Panel

Fields shown for a Clowder-enabled conversation:

- Connector state: `disabled`, `unconfigured`, `connecting`, `ready`, `denied`, `error`
- Bound thread title and ID
- Hub thread status for commands
- Available agents and availability
- Current focus/preferred cat
- Last delivery state
- Permission state for group chats

## Message Presentation

Inbound human messages remain normal IM messages.

Clowder replies render as assistant/robot messages with:

- agent display name
- optional Clowder connector badge
- markdown-safe body
- streaming indicator when `streaming = true`
- failure/retry state when delivery fails

Command responses render as system/connector messages and should not be confused with human chat content.

## Disabled States

Controls must be disabled when:

- Clowder feature flag is off
- Clowder base URL or secret is missing
- health check fails
- group is not authorized
- current user lacks admin permission for the action
- selected agent is unavailable

Disabled controls must expose a concise reason in the UI.

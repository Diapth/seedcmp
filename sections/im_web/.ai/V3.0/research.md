# Research: IM Web V3.0 Clowder Multi-Agent Connector

## 1. Integration boundary

- Decision: Treat Clowder as a separate backend service and integrate through a new `im-web` connector adapter plus signed bridge APIs, rather than copying Clowder connector code into `sections/im_web`.
- Rationale: Clowder already owns connector routing, `ConnectorRouter`, `ConnectorCommandLayer`, `ConnectorThreadBindingStore`, permission store, outbound delivery, streaming placeholders, and cat registry behavior. Duplicating those internals in the IM Web repo would fork the routing contract and create long-term drift.
- Alternatives considered: Embed Clowder packages into the IM Web frontend; rejected because connector secrets and agent execution cannot live in the browser. Reimplement the connector router in TangSeng; rejected because it duplicates mature command/dedup/routing behavior.

## 2. Connector identity

- Decision: Add a first-class Clowder connector definition with `connectorId = im-web`.
- Rationale: Existing connector definitions cover Feishu, Telegram, DingTalk, WeCom, Weixin, and system connectors. IM Web needs a stable ID for binding keys, dedup keys, theme/presentation, permission config, and command behavior.
- Alternatives considered: Reuse `weixin` or `system-command`; rejected because binding, permission, and analytics would become ambiguous.

## 3. Conversation-to-thread mapping

- Decision: Map TangSeng conversations to Clowder external chats using `externalChatId = "{channelType}:{channelId}"`, and bind them through `ConnectorThreadBinding`.
- Rationale: `ConnectorThreadBindingStore` already uses `{connectorId}:{externalChatId}` as its stable key and can return all bindings for outbound delivery by thread.
- Alternatives considered: Use only `channelId`; rejected because direct/group channel IDs can overlap and channel type is required for delivery back to TangSeng.

## 4. Sender attribution

- Decision: Forward sender identity as `ConnectorSource.sender = { id, name }` on each inbound message.
- Rationale: Clowder's router and outbound delivery already use sender metadata for group reply context and agent prompts. This is required for multi-user group chats where all messages otherwise appear as one default owner.
- Alternatives considered: Encode sender into message text only; rejected because agents and UI cannot reliably parse identity from free text.

## 5. Permission model

- Decision: Reuse Clowder's permission shape: group whitelist, connector admins, and admin-only commands; bridge TangSeng group owner/manager role into connector admin decisions where possible.
- Rationale: `ConnectorPermissionStore` already defines the required control points, and V3.0 group access must be explicit.
- Alternatives considered: Allow all groups by default; rejected as unsafe for multi-user agent access. Store permissions only in TangSeng; rejected because Clowder command handling must make authorization decisions before routing.

## 6. Multi-agent routing

- Decision: Use Clowder mention patterns, `/ask`, `/focus`, preferred cats, and last-active participant fallback for target selection.
- Rationale: `ConnectorRouter` already parses mentions from `catRegistry`, supports `/ask` one-shot routing, `/focus` preferred cats, and fallback to participant activity. This directly matches the requested multi-agent behavior.
- Alternatives considered: Keep V2.0's hardcoded `deepseek_ai_robot`; rejected because it only supports a single AI account and cannot route among multiple Clowder cats.

## 7. Command handling

- Decision: Preserve Clowder connector slash commands for MVP, then add IM Web controls that call the same backend command/action contracts.
- Rationale: Commands such as `/new`, `/threads`, `/use`, `/where`, `/cats`, `/status`, `/history`, `/focus`, `/ask`, `/allow-group`, and `/deny-group` already exist and are testable.
- Alternatives considered: Build UI-only controls first; rejected because command behavior provides a proven backend contract and helps smoke-test the bridge earlier.

## 8. Outbound delivery to TangSeng

- Decision: Implement an IM outbound adapter that conforms to Clowder's `IOutboundAdapter` and `IStreamableOutboundAdapter`, translating Clowder replies to TangSeng robot/system messages.
- Rationale: Clowder already calls outbound hooks by thread binding. The adapter boundary is the narrowest place to convert formatted replies, rich blocks, media, streaming placeholders, edits, and delivery completion into TangSeng messages.
- Alternatives considered: Poll Clowder from the browser for replies; rejected because it bypasses IM persistence, unread behavior, and mobile/multi-device delivery.

## 9. Streaming and duplicate prevention

- Decision: Preserve V2.0's single-message streaming merge behavior by mapping Clowder stream placeholder/edit/final events to one stable IM client message number.
- Rationale: V2.0 fixed duplicate AI reply and history ordering defects. V3.0 must keep final persisted messages mergeable with local streaming placeholders.
- Alternatives considered: Send every chunk as a new message; rejected because it pollutes history and breaks refresh behavior.

## 10. Media and rich blocks

- Decision: Support text and markdown first, then pass supported TangSeng media as content blocks or URLs; degrade unsupported rich blocks to plaintext/markdown.
- Rationale: Clowder handles `MessageContent` blocks and outbound rich blocks, but TangSeng message types differ. A strict fallback prevents silent loss while keeping MVP tractable.
- Alternatives considered: Full rich-block parity in the first slice; rejected because native IM message mapping for every Clowder block type is larger than the bridge foundation.

## 11. Testing strategy

- Decision: Cover the bridge with contract tests for normalized payloads, connector router integration tests with fake binding/message/thread stores, IM Web store/component tests for display and merge behavior, and Playwright smoke for direct/group multi-agent flows.
- Rationale: The risk spans two services, realtime recovery, permissions, and UI duplication. Unit-only evidence is insufficient.
- Alternatives considered: Manual smoke only; rejected because duplicate and permission regressions need repeatable automated coverage.

## 12. Deployment and configuration

- Decision: Require explicit Clowder base URL, connector secret, default owner user ID mapping, and feature flag before exposing V3.0 controls.
- Rationale: Clowder connector secrets and agent routing are backend-only. Missing configuration must show unavailable states in IM Web instead of broken controls.
- Alternatives considered: Enable by default; rejected because local and production environments may not have Clowder running.

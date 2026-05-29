# Contract: Clowder `im-web` Adapter Interface

## Purpose

The `im-web` adapter lets Clowder deliver agent output back to TangSeng/WuKongIM conversations while preserving Clowder's connector gateway semantics.

## Required Clowder Interfaces

The adapter must satisfy:

```ts
interface IOutboundAdapter {
  readonly connectorId: 'im-web';
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  sendRichMessage?(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  sendFormattedReply?(
    externalChatId: string,
    envelope: MessageEnvelope,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  sendMedia?(
    externalChatId: string,
    payload: { type: 'image' | 'file' | 'audio'; [key: string]: unknown }
  ): Promise<void>;
  onDeliveryBatchDone?(externalChatId: string, chainDone: boolean): Promise<void>;
}
```

For streaming:

```ts
interface IStreamableOutboundAdapter extends IOutboundAdapter {
  sendPlaceholder(externalChatId: string, text: string): Promise<string>;
  editMessage(externalChatId: string, platformMessageId: string, text: string): Promise<void>;
  deleteMessage?(platformMessageId: string, externalChatId?: string): Promise<void>;
  finalizeStreamCard?(externalChatId: string, platformMessageId: string, catDisplayName: string): Promise<void>;
  registerInlinePlaceholder?(externalChatId: string, platformMessageId: string): void;
  clearInlinePlaceholder?(chatId: string, platformMessageId?: string): Promise<void>;
}
```

## TangSeng Mapping

- `externalChatId` parses to `{ channelType, channelId }`.
- Plain replies become TangSeng text messages with markdown metadata.
- Formatted replies become markdown/plain text unless a native card type is implemented.
- Rich media blocks become native image/file/audio messages when possible.
- Unsupported rich blocks render as markdown/plain text with an unavailable marker.
- `platformMessageId` is a TangSeng `clientMsgNo` or message ID that can be edited/finalized by the bridge.

## Sender Mapping

Agent replies should use one of these identities:

- Preferred: one Clowder robot account per cat, e.g. `clowder_cat_codex`.
- MVP: one `clowder_agent` robot account with cat name in content metadata.

The chosen identity must be durable so history sync and message grouping remain stable.

## Delivery Completion

`onDeliveryBatchDone(externalChatId, true)` indicates no more output is expected for the current invocation and should clear IM typing/streaming indicators.

## Streaming Callback Semantics

The adapter sends stream callbacks to TangSeng with one stable platform message identifier per invocation:

- `placeholder`: creates the pending assistant message and returns or records the platform message ID.
- `chunk`: edits the pending assistant message and preserves ordering.
- `final`: persists final content using the same platform message ID.
- `cleanup`: clears stale inline placeholder state without creating a second final reply.

TangSeng maps the stable platform ID to one `clientMsgNo`; IM Web then merges local, realtime, and history copies by that stable identity.

## Rich Block and Media Fallback

- Supported image, file, and audio attachments should be normalized into TangSeng-native media payloads when URL and metadata are available.
- Unsupported media and rich blocks must produce visible plaintext/markdown fallback content.
- If media cannot be downloaded or normalized, the bridge should surface a `media_download_failed` or `unsupported_media` delivery state rather than silently dropping the reply.

## Failure Behavior

- If TangSeng send fails, the adapter returns an error so Clowder can log delivery failure.
- If stream editing fails, the adapter may send a final fallback message, but must avoid duplicate final replies when the original placeholder can still be finalized.

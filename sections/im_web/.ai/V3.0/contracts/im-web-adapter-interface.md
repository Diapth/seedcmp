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

## Failure Behavior

- If TangSeng send fails, the adapter returns an error so Clowder can log delivery failure.
- If stream editing fails, the adapter may send a final fallback message, but must avoid duplicate final replies when the original placeholder can still be finalized.

# V3-41: Image Messages Render Blank And Are Not Readable By Clowder Cats

## Status

Open. Reported from live IM Web V3.0 Clowder usage on 2026-06-06. A user sent an image/screenshot to a Clowder cat, but the Web UI rendered the image message as a blank preview area and the cat could not inspect the image content.

## Created

2026-06-06

## Labels

bug, clowder, im-web, image, media, attachment, screenshot, vision-input, connector, upload, preview, ux

## Priority

P0

## User Report

The user-visible report:

```text
猫猫读取不了图片，并且我的图片发送过去变成空白了
```

Screenshot evidence supplied in chat on 2026-06-06 shows:

- The user sent an image together with the text `你有哪些skill`.
- The outgoing image bubble on the right side appears as a large blank light-gray rectangle instead of rendering the actual screenshot.
- The Clowder cat `121` replied that it could not directly open the image because the HTTP intranet link was incompatible with its reading tool.
- The cat asked the user to describe the image or say what workflow they wanted, which means the image was not available to the cat as inspectable visual input.

Cat reply excerpt from the live UI:

```text
抱歉，我没法直接打开你发的图片（HTTP 内网链接不兼容我的读取工具）。
能否描述一下图片内容？或者你发的是截图的话，直接告诉我想做什么方向...
```

## Problem

Image handling is broken in two user-visible places at the same time:

1. **IM Web display:** the image message becomes a blank placeholder/preview, so the sender cannot verify what was sent and other participants cannot inspect the image in the message history.
2. **Clowder cat input:** the cat receives an image reference that its runtime cannot read, likely an internal HTTP URL or preview URL, instead of a usable local file, browser-accessible public URL, rich image block, or encoded visual input.

This makes screenshots unusable for normal Clowder workflows. Users often send screenshots so cats can debug UI, inspect visual state, or answer questions about the image. With the current behavior, the cat receives a broken reference and falls back to asking the user to manually describe the image.

## Expected Behavior

When a user sends an image/screenshot to a Clowder cat or a Clowder-enabled group:

- The IM Web message list should render the actual image thumbnail/preview, not a blank rectangle.
- Clicking or opening the image should show the full image in the lightbox/preview surface.
- Refresh/history sync should preserve the same visible image preview.
- The Clowder route payload should include an image attachment that the target cat runtime can actually inspect.
- If the runtime cannot read a browser URL directly, the bridge should provide an accessible local file path, uploaded file metadata, or provider-compatible image block.
- The cat should be able to answer questions about the screenshot content without asking the user to describe it again.
- Any internal/private URL should be translated to a URL/path that is valid from the cat runtime environment before dispatch.

## Actual Behavior

- The outgoing image card in IM Web is visually blank.
- The cat receives an HTTP intranet-style image reference that its read tool cannot open.
- The cat cannot inspect the image and asks the user to describe it manually.
- Repeated text prompts such as `你有哪些skill` can reach the cat, but the image payload itself does not become usable context.

## Impact

- Screenshot-driven debugging is effectively broken.
- Users cannot trust whether an image was uploaded/sent correctly.
- Cats cannot perform visual inspection tasks in IM Web.
- The failure mode is confusing because the text message succeeds while the image silently degrades into a blank card and unreadable URL.
- This blocks any workflow that depends on UI screenshots, design review, error screenshot diagnosis, or image-based task context.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/apps/chat/src/views/ChatView.vue
sections/im_web/packages/base-vue/src/service/mediaUrl.ts
sections/im_web/packages/base-vue/src/utils/clowderMessageIdentity.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im/TangSengDaoDaoServer/modules/clowder/normalize.go
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/image-cli-bridge.js
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/image-paths.js
```

## Investigation Checklist

- Capture the exact message payload generated when a user sends an image from IM Web.
- Check whether the image content uses WuKongIM image message type, file message type, or a custom JSON content object.
- Check whether the Web preview URL is normalized through `mediaUrl.ts` and whether the browser can load it directly.
- Check whether the blank rectangle is caused by an empty `src`, a broken `/file/preview/` URL, object-storage host mismatch, CORS, auth, or a missing upload record.
- Check whether the TangSeng bridge forwards user-sent image attachments into `conversation/message` as Clowder attachments.
- Check whether Clowder receives only text plus an inaccessible HTTP URL.
- Check whether the target provider can consume the image as a local path, data URL, remote URL, or provider-native image block.
- Check whether connector media URLs need to be mirrored into `UPLOAD_DIR` or a runtime-accessible temp file before invoking the cat.
- Confirm direct cat chats and group chats behave consistently.
- Confirm the fix does not regress file cards or cat-sent images/files covered by V3-19 and V3-38.

## Acceptance Criteria

- Sending a screenshot/image to a Clowder cat renders a nonblank image thumbnail in IM Web.
- Opening the image in the lightbox shows the correct full image.
- Refreshing the page preserves the image preview and full-size image.
- The cat receives the image as usable input and can describe visible screenshot content without the user retyping it.
- The cat no longer reports that the image is an unreadable HTTP intranet link when the image was uploaded through IM Web.
- Direct cat chats and Clowder group chats both support image delivery to cats.
- Image upload failures show a clear error state instead of a blank image bubble.
- The route payload records enough attachment metadata for debugging: message id, URL/path, MIME type, size if available, and source channel.

## Regression Coverage Required

- Unit/store test: image message content with upload/preview metadata resolves to a nonempty browser preview URL.
- Component test: `MessageList` renders an actual `<img src=...>` for image messages and falls back to an explicit error state when the image URL is invalid.
- Bridge test: TangSeng Clowder route normalizes user-sent image messages into Clowder attachments.
- Provider test: Clowder invocation receives image attachments in a provider-readable form instead of only an internal HTTP URL.
- Browser E2E: log in to IM Web, send a small screenshot to a real OAuth cat, verify the UI preview is nonblank, wait for the cat to describe the screenshot content, refresh, and verify the image remains visible.

## Notes

Do not solve this by only changing the cat prompt to ask users to describe images. The core bug is that uploaded images must survive the full path:

```text
browser upload -> IM message preview -> TangSeng history -> Clowder route payload -> cat runtime image input
```

The fix should make the image visible to both humans and cats.

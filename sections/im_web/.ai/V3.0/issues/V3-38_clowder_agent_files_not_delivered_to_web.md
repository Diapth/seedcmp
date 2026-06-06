# V3-38: Clowder Agent Files Are Not Delivered To Web As Attachments

## Status

Open. Reported from live IM Web V3.0 Clowder direct-chat usage on 2026-06-05. A Clowder agent claims it packaged and sent a file, but the web chat only receives a textual description of the file instead of a usable downloadable attachment/card.

## Created

2026-06-05

## Labels

bug, clowder, agent-output, files, attachments, media, artifacts, connector, im-web, regression, ux

## Priority

P0

## User Report

The user asked the agent to package and send the Maomi Workspace:

```text
把Maomi Workspace 打包发给我
```

The conversation shows the agent first thinking, then replying that packaging is complete:

```text
好的，我来把 Maomi Workspace 打包发给你。Maomi Workspace 已打包完成！

📦 文件: maomi_workspace.zip
📏 大小: 297 字节（非常小，目前只包含 .clowder-root.json 配置文件）
```

However, the file is not delivered to the web UI as a real attachment. In the screenshot, `maomi_workspace.zip` appears only as text/inline code in the message body. There is no file card, no download button, no preview action, and no browser-usable URL.

The user-visible problem is: "文件传输问题，智能体的文件发不到 web".

## Impact

- Users cannot download files that agents say they have packaged or sent.
- The chat transcript can claim delivery succeeded while no deliverable is actually accessible in IM Web.
- Generated archives, reports, screenshots, project bundles, and other agent artifacts become effectively trapped in the backend/runtime workspace.
- The user cannot tell whether the file was never created, created but not uploaded, uploaded but not proxied, or proxied but rendered as text.
- This undermines Clowder's core collaboration promise: agents must be able to hand finished work back to the user.

## Relationship To Existing Issues

- Related to `V3-18_cat_group_chat_mentions_context_media_and_markdown_it.md`, which implemented group media support.
- Related to `V3-19_cat_group_multi_user_identity_mention_file_and_thinking_order_regressions.md`, which fixed group cat file delivery and filename-text recovery.
- Distinct from both because this report is from a direct Clowder agent/chat flow and shows a newly generated archive described in final text without a native web attachment.
- Related to `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md` and `V3-37_clowder_unified_maomi_project_workspace.md`: workspace artifacts should be discoverable both in panels and as chat-delivered attachments when the user asks to receive them.

## Expected Behavior

- When an agent creates or selects a file to send to the user, the final web message should include a structured attachment payload, not only natural-language text.
- Supported files should render through the normal IM Web file message UI with filename, size, download action, and preview when available.
- The attachment should have a browser-usable URL that works after page refresh and from history sync, not only a local filesystem path.
- The text reply may summarize the file, but it must not be the only delivery mechanism.
- If upload/publication fails, the agent message should clearly report `file_delivery_failed` with the underlying reason instead of saying the file was sent.
- The file should preserve Clowder metadata such as cat id/name, thread id, invocation id, artifact id, original path, public URL, and size.

## Acceptance Criteria

- Asking a direct Clowder agent to send `maomi_workspace.zip` produces a native IM Web file card for `maomi_workspace.zip`.
- The rendered file card has a working `下载` action in the browser.
- Refreshing the page or re-syncing message history still shows the file as a file card, not as plain text.
- The message payload contains structured file metadata, including at least `type`, `name` or `fileName`, `size`, and `url`.
- The bridge never treats a successful file-send request as delivered if the file upload/public URL step failed.
- Plain text such as `📦 文件: maomi_workspace.zip` may appear as supporting copy, but the structured attachment must also be present.
- Both direct cat conversations and group cat conversations follow the same file-delivery contract.
- A regression test covers a generated zip file flowing from agent output/rich block to IM Web file card.

## Suspected Areas

```text
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/antigravity-cli-event-parser.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/claude-carrier-factory.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/providers/claude-agent-win.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/adapters/ImWebAdapter.ts
sections/clowder-ai/packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts
sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im_web/packages/base-vue/src/utils/clowderMessageIdentity.ts
sections/im_web/packages/base-vue/src/components/messages/FileCell.vue
sections/im_web/packages/base-vue/src/components/messages/TextCell.vue
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
```

## Investigation Checklist

- Capture the raw Clowder final message/rich blocks for the failing `maomi_workspace.zip` reply.
- Confirm whether the agent actually created the zip file on disk and record its absolute path, size, and lifetime.
- Check whether the provider/parser emits a structured file/artifact event or only text mentioning the filename.
- Check whether Clowder uploads or publishes local agent files to a public `/uploads/...` route before sending to IM Web.
- Check whether `OutboundDeliveryHook` receives a file rich block, artifact reference, or only markdown text.
- Check whether `ImWebAdapter` sends a file/media payload with `url`, `name`, `size`, `catId`, and `catDisplayName`.
- Check whether TangSeng `modules/clowder/outbound.go` preserves direct-chat file payloads as WuKongIM file content type instead of downgrading to text.
- Check whether IM Web `messageStore` or `clowderMessageIdentity` can recover filename-only rows from previous rich blocks in direct conversations, not only group conversations.
- Check whether the file URL is rewritten correctly for the browser origin and remains valid after refresh.
- Distinguish four states in diagnostics: `file_missing`, `upload_failed`, `outbound_payload_missing_url`, and `web_rendered_as_text`.

## Regression Coverage Required

- Provider/parser test: an agent-created zip artifact is represented as a structured file/artifact block, not only markdown text.
- Clowder connector test: file rich blocks include a browser-usable URL and preserve file metadata.
- TangSeng proxy/outbound test: direct Clowder file payloads become native WuKongIM file messages.
- IM Web store test: direct Clowder file messages stay type `8` after realtime merge and history sync.
- Component test: `FileCell` renders Clowder file messages with filename, size, preview/download states, and cat sender metadata.
- Browser smoke: ask a direct cat/coordinator to package a tiny workspace, then assert the message list contains a file card for `maomi_workspace.zip` and the download URL returns HTTP 200.

## Notes

Do not solve this by making filenames clickable inside markdown text. The product requirement is structured file transfer: agent-generated files must cross the Clowder connector boundary and arrive in IM Web as durable attachments with real download metadata.

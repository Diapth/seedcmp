import { createHash, randomBytes } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { type CatId, catRegistry, type RichBlock } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import { publishGeneratedImage } from '../../domains/cats/services/agents/providers/generated-image-publication.js';
import { buildArtifactProvenance, rootsFromEnv } from '../../domains/artifacts/artifact-provenance.js';
import { sanitizeFilenameStem, type SupportedImageMime } from '../../utils/image-storage.js';
import { getDefaultUploadDir, resolveInternalRouteUrl } from '../../utils/upload-paths.js';
import { ConnectorMessageFormatter, type MessageEnvelope, type MessageOrigin } from './ConnectorMessageFormatter.js';
import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';
import { renderAllRichBlocksPlaintext } from './rich-block-plaintext.js';

export interface IOutboundAdapter {
  readonly connectorId: string;
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  sendRichMessage?(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  sendFormattedReply?(
    externalChatId: string,
    envelope: MessageEnvelope,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Phase 5: Send a media message (image, file, audio). */
  sendMedia?(
    externalChatId: string,
    payload: { type: 'image' | 'file' | 'audio'; catId?: string; catDisplayName?: string; [key: string]: unknown },
  ): Promise<void>;
  /** F151: Delivery batch complete. `chainDone=true` = no more output for this task; send close frame. */
  onDeliveryBatchDone?(externalChatId: string, chainDone: boolean): Promise<void>;
  /** F157: Add an emoji reaction to a message (e.g. ❤️ on user's message as instant ack). */
  addReaction?(platformMessageId: string, emojiType: string): Promise<void>;
}

/** Adapter that supports edit-in-place streaming (placeholder → progressive edits). */
export interface IStreamableOutboundAdapter extends IOutboundAdapter {
  /** Send a placeholder message and return its platform-level message ID. */
  sendPlaceholder(externalChatId: string, text: string): Promise<string>;
  /** Edit an already-sent message in place. */
  editMessage(externalChatId: string, platformMessageId: string, text: string): Promise<void>;
  /**
   * Delete a message by platform message ID (cleanup after streaming).
   * externalChatId should be provided by callers that have it (e.g. StreamingOutboundHook),
   * because Telegram message_ids are only unique within a single chat.
   */
  deleteMessage?(platformMessageId: string, externalChatId?: string): Promise<void>;
  /**
   * F157: Edit a streaming placeholder to a minimal completion state (e.g. "✅ 已回复").
   * When present, cleanup prefers this over deleteMessage to avoid "recall" notifications.
   */
  finalizeStreamCard?(externalChatId: string, platformMessageId: string, catDisplayName: string): Promise<void>;
  /**
   * K2: Register a pending inline-final placeholder.
   * The next sendReply/sendRichMessage to this chatId will edit this placeholder
   * instead of sending a new message. Consumed on first use.
   * When present, onStreamEnd uses this path instead of deleteMessage/finalizeStreamCard.
   */
  registerInlinePlaceholder?(externalChatId: string, platformMessageId: string): void;
  /**
   * K2: Clear a registered inline-final placeholder without delivering content.
   * Called by StreamingOutboundHook.cleanupPlaceholders when delivery is skipped,
   * so the stale entry does not corrupt the next delivery for this chatId.
   * If the placeholder was already consumed by a successful delivery, this is a no-op.
   */
  clearInlinePlaceholder?(chatId: string, platformMessageId?: string): Promise<void>;
}

export interface ThreadMeta {
  readonly threadShortId: string;
  readonly threadTitle?: string | undefined;
  readonly featId?: string | undefined;
  readonly deepLinkUrl?: string | undefined;
  readonly artifactSearchRoots?: readonly string[] | undefined;
}

interface PublishedLocalFile {
  /** Browser-usable delivery reference (e.g. /uploads/x.tar.gz). */
  readonly url: string;
  /** On-disk path of the published delivery copy. */
  readonly absPath: string;
  readonly fileName?: string;
  /** V3-39 §2.2: original source the delivery was published from (distinct from `url`). */
  readonly sourcePath?: string;
}

interface ResolvedPublishableFile {
  readonly sourcePath: string;
  readonly fileName?: string;
  readonly cleanup?: boolean;
}

interface NativeFileMediaPayload {
  readonly type: 'file';
  readonly url: string;
  readonly absPath: string;
  readonly fileName: string;
  readonly size?: number;
}

const MAX_ARTIFACT_SEARCH_ENTRIES = 1_500;
const MAX_ARTIFACT_SEARCH_DEPTH = 5;
const MAX_WORKSPACE_ARCHIVE_BYTES = 50 * 1024 * 1024;
const EXCLUDED_ARTIFACT_DIRS = new Set([
  '.git',
  '.next',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export interface OutboundDeliveryHookOptions {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly adapters: Map<string, IOutboundAdapter>;
  readonly log: FastifyBaseLogger;
  /** Resolve a route URL (e.g. /uploads/x.png) to an absolute file path on disk. */
  readonly mediaPathResolver?: ((url: string) => string | undefined) | undefined;
  /** F134: Look up a stored message by ID to retrieve its source.sender for group chat @sender replies. */
  readonly messageLookup?:
    | ((messageId: string) => Promise<{ source?: { sender?: { id: string; name?: string } } } | null>)
    | undefined;
  /** Resolve audio blocks with text but no url (voiceMode frontend-only blocks) by synthesizing TTS. */
  readonly resolveVoiceBlocks?: ((blocks: RichBlock[], catId: string) => Promise<RichBlock[]>) | undefined;
}

export class OutboundDeliveryHook {
  private readonly formatter = new ConnectorMessageFormatter();

  constructor(private readonly opts: OutboundDeliveryHookOptions) {}

  /**
   * Return the set of connectorIds bound to a thread.
   * Used by ConnectorInvokeTrigger to detect single-token adapters (e.g. weixin)
   * that require multi-turn content to be merged before delivery.
   */
  async getConnectorIds(threadId: string): Promise<string[]> {
    const bindings = await this.opts.bindingStore.getByThread(threadId);
    return [...new Set(bindings.map((b) => b.connectorId))];
  }

  async deliver(
    threadId: string,
    content: string,
    catId?: CatId,
    richBlocks?: RichBlock[],
    threadMeta?: ThreadMeta,
    origin?: MessageOrigin,
    triggerMessageId?: string,
  ): Promise<void> {
    return this.executeDelivery(threadId, content, catId, richBlocks, threadMeta, origin, triggerMessageId);
  }

  private async executeDelivery(
    threadId: string,
    content: string,
    catId?: CatId,
    richBlocks?: RichBlock[],
    threadMeta?: ThreadMeta,
    origin?: MessageOrigin,
    triggerMessageId?: string,
  ): Promise<void> {
    this.opts.log.info(
      { threadId, catId, contentLen: content.length, hasRichBlocks: !!(richBlocks && richBlocks.length) },
      '[OutboundDeliveryHook] deliver() called',
    );
    const bindings = await this.opts.bindingStore.getByThread(threadId);
    if (bindings.length === 0) {
      this.opts.log.warn(
        { threadId },
        '[OutboundDeliveryHook] No bindings found for thread — skipping outbound delivery',
      );
      return;
    }
    this.opts.log.info(
      { threadId, bindingCount: bindings.length, connectors: bindings.map((b) => b.connectorId) },
      '[OutboundDeliveryHook] Found bindings, delivering',
    );

    // F134: Resolve sender from the trigger message for group chat @sender replies
    let replyToSender: { id: string; name?: string } | undefined;
    if (triggerMessageId && this.opts.messageLookup) {
      try {
        const msg = await this.opts.messageLookup(triggerMessageId);
        replyToSender = msg?.source?.sender ?? undefined;
      } catch (err) {
        this.opts.log.warn({ err, triggerMessageId }, '[OutboundDeliveryHook] messageLookup failed');
      }
    }

    const entry = catId ? catRegistry.tryGet(catId) : undefined;
    const catDisplayName = entry?.config.displayName ?? '';
    const catEmoji = '🐱';
    const textPrefix = catDisplayName ? `【${catDisplayName}🐱】\n` : '';
    const finalContent = `${textPrefix}${content}`;

    // Resolve audio blocks that have text but no url (voiceMode frontend-only blocks).
    // Without resolution, these would be silently dropped by Phase 6's url check.
    let resolvedBlocks = richBlocks;
    const hasUnresolvedAudio = resolvedBlocks?.some(
      (b) => b.kind === 'audio' && 'text' in b && (!('url' in b) || !b.url),
    );
    if (hasUnresolvedAudio && this.opts.resolveVoiceBlocks && catId) {
      try {
        resolvedBlocks = await this.opts.resolveVoiceBlocks(resolvedBlocks!, catId);
      } catch (err) {
        this.opts.log.warn({ err }, '[OutboundDeliveryHook] resolveVoiceBlocks failed — degrading to text');
      }
    }
    // Fallback: convert any remaining audio-without-url to plaintext-renderable blocks
    // so they are NOT silently dropped by Phase 6's url filter.
    if (resolvedBlocks?.some((b) => b.kind === 'audio' && 'text' in b && (!('url' in b) || !b.url))) {
      resolvedBlocks = resolvedBlocks.map((b) => {
        if (b.kind === 'audio' && 'text' in b && (!('url' in b) || !b.url)) {
          return { id: b.id, kind: 'card' as const, v: 1 as const, title: '🔊 语音', bodyMarkdown: b.text as string };
        }
        return b;
      });
    }
    // After resolve + fallback, normalize to a concrete array so TS narrows downstream.
    let finalBlocks = resolvedBlocks ?? [];
    finalBlocks = await this.publishLocalFileBlocks(finalBlocks, threadMeta, content);
    finalBlocks = await this.enrichLocalFileBlockSizes(finalBlocks);
    const textFileDeliveries = await this.publishTextFileReferences(content, threadId, threadMeta);
    const hasRichBlocks = finalBlocks.length > 0;
    const hasOnlyNativeFileRichBlocks = finalBlocks.every((block) => block.kind === 'file');
    const outMeta = replyToSender ? { replyToSender } : undefined;
    const mediaIdentity = {
      ...(catId ? { catId } : {}),
      ...(catDisplayName ? { catDisplayName } : {}),
      ...(outMeta ? { metadata: outMeta } : {}),
    };

    await Promise.allSettled(
      bindings.map(async (binding) => {
        const adapter = this.opts.adapters.get(binding.connectorId);
        if (!adapter) {
          this.opts.log.warn({ connectorId: binding.connectorId }, 'No adapter registered for connector');
          return;
        }
        try {
          const preferNativeFilesOnly =
            adapter.connectorId === 'im-web' &&
            !!adapter.sendMedia &&
            textFileDeliveries.length > 0 &&
            hasOnlyNativeFileRichBlocks;

          // Phase E: Always prefer sendFormattedReply (interactive card) when adapter supports it.
          // This ensures each cat's reply is a distinct card with identity header,
          // preventing Feishu from merging multiple cats' plain-text into one bubble.
          if (preferNativeFilesOnly) {
            // IM Web should receive native file cards for file-delivery turns. Sending a
            // filename-bearing text row first races browser smoke tests and regresses UX.
          } else if (adapter.sendFormattedReply && !hasRichBlocks) {
            const envelope = threadMeta
              ? this.formatter.format({
                  catDisplayName: catDisplayName || 'Cat',
                  catEmoji,
                  threadShortId: threadMeta.threadShortId,
                  threadTitle: threadMeta.threadTitle,
                  featId: threadMeta.featId,
                  body: content,
                  deepLinkUrl: threadMeta.deepLinkUrl,
                  timestamp: new Date(),
                  origin,
                })
              : this.formatter.formatMinimal({
                  catDisplayName: catDisplayName || 'Cat',
                  catEmoji,
                  body: content,
                  origin,
                });
            await adapter.sendFormattedReply(binding.externalChatId, envelope, outMeta);
          } else if (hasRichBlocks && adapter.sendRichMessage) {
            await adapter.sendRichMessage(
              binding.externalChatId,
              content,
              finalBlocks,
              catDisplayName || 'Cat',
              outMeta,
            );
          } else if (
            hasRichBlocks &&
            adapter.sendMedia &&
            finalBlocks.some((b) => b.kind === 'audio' || b.kind === 'file' || b.kind === 'media_gallery')
          ) {
            // Media-capable adapter without sendRichMessage (e.g. WeChat):
            // BUG-5 corrected: context_token is reusable, so send text first, then media.
            // Render non-media blocks (html_widget, card, etc.) as plaintext alongside text content.
            const nonMediaBlocks = finalBlocks.filter(
              (b) => b.kind !== 'audio' && b.kind !== 'file' && b.kind !== 'media_gallery',
            );
            const blockText = nonMediaBlocks.length > 0 ? renderAllRichBlocksPlaintext(nonMediaBlocks) : '';
            const textToSend = blockText ? `${finalContent}\n\n${blockText}` : finalContent;
            if (textToSend) {
              await adapter.sendReply(binding.externalChatId, textToSend, outMeta);
            }
            // Media blocks sent below in Phase 5/6/J
          } else if (hasRichBlocks) {
            // Fallback for adapters without sendMedia: render blocks as plaintext
            const blockText = renderAllRichBlocksPlaintext(finalBlocks);
            await adapter.sendReply(binding.externalChatId, `${finalContent}\n\n${blockText}`, outMeta);
          } else {
            await adapter.sendReply(binding.externalChatId, finalContent, outMeta);
          }

          // Phase 6: Send audio blocks with url as media messages
          // Phase 5: Send media_gallery image items as image messages
          if (hasRichBlocks && adapter.sendMedia) {
            const resolve = this.opts.mediaPathResolver;
            for (const block of finalBlocks) {
              if (block.kind === 'audio' && 'url' in block && block.url) {
                const absPath = resolve?.(block.url);
                this.opts.log.info(
                  { blockKind: block.kind, url: block.url, absPath: absPath ?? null, hasResolver: !!resolve },
                  '[OutboundDeliveryHook] Phase 6: sending audio block',
                );
                await adapter.sendMedia(binding.externalChatId, {
                  type: 'audio',
                  url: block.url,
                  ...(absPath ? { absPath } : {}),
                  ...('text' in block && block.text ? { text: block.text as string } : {}),
                  ...mediaIdentity,
                });
              }
              // Phase J: Send file blocks as file messages
              // P0 security: file blocks MUST resolve to absPath — never pass raw url to adapter
              // (raw url could be an arbitrary local path like /etc/passwd, exploitable via Telegram InputFile)
              if (block.kind === 'file' && 'url' in block && block.url) {
                const fileUrl = block.url as string;
                const absPath = resolve?.(fileUrl);
                const fileName = 'fileName' in block ? (block.fileName as string) : undefined;
                const fileSize = Number(
                  'fileSize' in block
                    ? block.fileSize
                    : 'size' in block
                      ? (block as { size?: number }).size
                      : 0,
                );
                if (absPath) {
                  this.opts.log.info(
                    { blockKind: block.kind, url: fileUrl, absPath, fileName },
                    '[OutboundDeliveryHook] Phase J: sending file block',
                  );
                  await adapter.sendMedia(binding.externalChatId, {
                    type: 'file',
                    url: resolveInternalRouteUrl(fileUrl),
                    absPath,
                    ...(fileName ? { fileName } : {}),
                    ...(Number.isFinite(fileSize) && fileSize > 0 ? { size: fileSize } : {}),
                    ...mediaIdentity,
                  });
                } else if (fileUrl.startsWith('https://')) {
                  // External HTTPS URLs are safe to pass through (Feishu adapter downloads + uploads)
                  this.opts.log.info(
                    { blockKind: block.kind, url: fileUrl, fileName },
                    '[OutboundDeliveryHook] Phase J: sending file block via external URL',
                  );
                  await adapter.sendMedia(binding.externalChatId, {
                    type: 'file',
                    url: fileUrl,
                    ...(fileName ? { fileName } : {}),
                    ...(Number.isFinite(fileSize) && fileSize > 0 ? { size: fileSize } : {}),
                    ...mediaIdentity,
                  });
                } else {
                  this.opts.log.warn(
                    { blockKind: block.kind, url: fileUrl },
                    '[OutboundDeliveryHook] Phase J: file block skipped — resolver failed and url is not https',
                  );
                }
              }
              if (block.kind === 'media_gallery' && 'items' in block) {
                const items = (block as { items?: Array<{ url?: string; type?: string; alt?: string; caption?: string }> })
                  .items;
                if (items) {
                  for (const [index, item] of items.entries()) {
                    if (!item.url) continue;
                    const isImage = !item.type || item.type === 'image';
                    if (!isImage) continue;
                    if (item.url.startsWith('data:')) {
                      const absPath = await this.writeDataUriToTempFile(item.url);
                      if (absPath) {
                        try {
                          const publishedDataImage = await this.publishLocalImageReference(
                            absPath,
                            block.id,
                            index,
                            'title' in block ? (block.title as string | undefined) : undefined,
                            item.caption ?? item.alt,
                          );
                          await adapter.sendMedia(binding.externalChatId, {
                            type: 'image',
                            ...(publishedDataImage
                              ? {
                                  url: publishedDataImage.url,
                                  absPath: publishedDataImage.absPath,
                                  ...(publishedDataImage.alt ? { alt: publishedDataImage.alt } : {}),
                                }
                              : { absPath }),
                            ...mediaIdentity,
                          });
                        } finally {
                          await unlink(absPath).catch(() => {});
                        }
                      }
                    } else {
                      const publishedFileImage = await this.publishLocalImageReference(
                        item.url,
                        block.id,
                        index,
                        'title' in block ? (block.title as string | undefined) : undefined,
                        item.caption ?? item.alt,
                      );
                      if (publishedFileImage) {
                        await adapter.sendMedia(binding.externalChatId, {
                          type: 'image',
                          url: publishedFileImage.url,
                          absPath: publishedFileImage.absPath,
                          ...(publishedFileImage.alt ? { alt: publishedFileImage.alt } : {}),
                          ...mediaIdentity,
                        });
                        continue;
                      }
                      const absPath = resolve?.(item.url);
                      if (absPath) {
                        await adapter.sendMedia(binding.externalChatId, {
                          type: 'image',
                          url: resolveInternalRouteUrl(item.url),
                          absPath,
                          ...mediaIdentity,
                        });
                      } else if (
                        item.url.startsWith('https://') ||
                        item.url.startsWith('/uploads/') ||
                        item.url.startsWith('/api/connector-media/')
                      ) {
                        const resolvedUrl = resolveInternalRouteUrl(item.url);
                        await adapter.sendMedia(binding.externalChatId, {
                          type: 'image',
                          url: resolvedUrl,
                          ...mediaIdentity,
                        });
                      } else {
                        this.opts.log.warn(
                          { blockKind: block.kind, url: item.url },
                          '[OutboundDeliveryHook] media_gallery image skipped — resolver failed and url is not https',
                        );
                      }
                    }
                  }
                }
              }
            }
          }

          if (adapter.sendMedia) {
            const textImageReferences = this.extractLocalImageReferences(content);
            for (const [index, imageRef] of textImageReferences.entries()) {
              const publishedTextImage = await this.publishLocalImageReference(
                imageRef,
                `text-image-${threadId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
                index,
                'generated image',
                'generated image',
              );
              if (!publishedTextImage) continue;
              await adapter.sendMedia(binding.externalChatId, {
                type: 'image',
                url: publishedTextImage.url,
                absPath: publishedTextImage.absPath,
                ...(publishedTextImage.alt ? { alt: publishedTextImage.alt } : {}),
                ...mediaIdentity,
              });
            }

            const textFileReferences = this.extractLocalFileReferences(content);
            const unpublishedTextFileReferences = textFileReferences.filter((fileRef) => {
              const fileName = basename(fileRef);
              return !textFileDeliveries.some((delivery) => delivery.fileName === fileName);
            });
            for (const fileRef of unpublishedTextFileReferences) {
              const publishedFile = await this.publishLocalFileReference(fileRef, {
                blockId: `text-file-${threadId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
                fileName: basename(fileRef),
                threadMeta,
                content,
              });
              if (!publishedFile) continue;
              const size = await this.safeFileSize(publishedFile.absPath);
              await adapter.sendMedia(binding.externalChatId, {
                type: 'file',
                url: resolveInternalRouteUrl(publishedFile.url),
                absPath: publishedFile.absPath,
                fileName: publishedFile.fileName ?? basename(fileRef),
                ...(size > 0 ? { size } : {}),
                ...mediaIdentity,
              });
            }
            for (const delivery of textFileDeliveries) {
              await adapter.sendMedia(binding.externalChatId, {
                ...delivery,
                ...mediaIdentity,
              });
            }
          }
        } catch (err) {
          this.opts.log.error(
            {
              err,
              connectorId: binding.connectorId,
              externalChatId: binding.externalChatId,
            },
            'Outbound delivery failed',
          );
        }
      }),
    );
  }

  private async writeDataUriToTempFile(dataUri: string): Promise<string | null> {
    const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!match) return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filePath = join(tmpdir(), `cat-cafe-img-${randomBytes(8).toString('hex')}.${ext}`);
    await writeFile(filePath, buffer);
    return filePath;
  }

  private async enrichLocalFileBlockSizes(blocks: RichBlock[]): Promise<RichBlock[]> {
    const resolve = this.opts.mediaPathResolver;
    if (!resolve || blocks.length === 0) return blocks;

    return Promise.all(blocks.map(async (block) => {
      if (block.kind !== 'file' || !('url' in block) || !block.url) return block;
      const currentSize = Number(
        'fileSize' in block
          ? block.fileSize
          : 'size' in block
            ? (block as { size?: number }).size
            : 0,
      );
      if (Number.isFinite(currentSize) && currentSize > 0) return block;

      const absPath = resolve(block.url as string);
      if (!absPath) return block;
      try {
        const fileStat = await stat(absPath);
        if (!fileStat.isFile() || fileStat.size < 0) return block;
        return { ...block, fileSize: fileStat.size } as RichBlock;
      } catch {
        return block;
      }
    }));
  }

  private async publishLocalImageReference(
    url: string,
    blockId: string,
    itemIndex: number,
    title?: string,
    alt?: string,
  ): Promise<{ url: string; absPath: string; alt?: string } | null> {
    if (url.startsWith('/uploads/') || url.startsWith('/api/') || url.startsWith('/avatars/')) return null;
    if (!isLocalPublishableReference(url)) return null;
    let sourcePath: string;
    try {
      sourcePath = normalizeLocalReferencePath(url);
    } catch (err) {
      this.opts.log.warn({ err, url }, '[OutboundDeliveryHook] invalid local media_gallery image URL');
      return null;
    }
    const mimeType = imageMimeFromPath(sourcePath);
    if (!mimeType) {
      this.opts.log.warn(
        { url, sourcePath },
        '[OutboundDeliveryHook] local media_gallery image skipped — unsupported extension',
      );
      return null;
    }

    try {
      const publicationKey = itemIndex === 0 ? blockId : `${blockId}-${itemIndex + 1}`;
      const published = await publishGeneratedImage({
        sourcePath,
        mimeType,
        publicationKey,
        provider: 'skill',
        toolName: 'file-url-media-gallery',
        ...(title ? { title } : {}),
        ...(alt ? { alt } : {}),
      });
      return {
        url: resolveInternalRouteUrl(published.urlPath),
        absPath: published.absPath,
        ...(alt ? { alt } : {}),
      };
    } catch (err) {
      this.opts.log.warn(
        { err, url, sourcePath },
        '[OutboundDeliveryHook] local media_gallery image publish failed',
      );
      return null;
    }
  }

  private async safeFileSize(absPath: string): Promise<number> {
    try {
      const fileStat = await stat(absPath);
      return fileStat.isFile() && fileStat.size > 0 ? fileStat.size : 0;
    } catch {
      return 0;
    }
  }

  private async publishTextFileReferences(
    content: string,
    threadId: string,
    threadMeta?: ThreadMeta,
  ): Promise<NativeFileMediaPayload[]> {
    const deliveries: NativeFileMediaPayload[] = [];
    const textFileReferences = this.extractLocalFileReferences(content);
    for (const fileRef of textFileReferences) {
      const publishedFile = await this.publishLocalFileReference(fileRef, {
        blockId: `text-file-${threadId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        fileName: basename(fileRef),
        threadMeta,
        content,
      });
      if (!publishedFile) continue;
      const size = await this.safeFileSize(publishedFile.absPath);
      deliveries.push({
        type: 'file',
        url: resolveInternalRouteUrl(publishedFile.url),
        absPath: publishedFile.absPath,
        fileName: publishedFile.fileName ?? basename(fileRef),
        ...(size > 0 ? { size } : {}),
      });
    }
    return deliveries;
  }

  private async publishLocalFileReference(
    url: string,
    options: {
      blockId: string;
      fileName?: string;
      threadMeta?: ThreadMeta;
      content?: string;
    },
  ): Promise<PublishedLocalFile | null> {
    if (url.startsWith('/uploads/') || url.startsWith('/api/') || url.startsWith('/avatars/')) return null;
    if (!isLocalPublishableReference(url)) return null;

    const resolvedSource = await this.resolvePublishableLocalFile(url, options.fileName, options.threadMeta, options.content);
    if (!resolvedSource) {
      return null;
    }

    try {
      const uploadDir = getDefaultUploadDir(process.env.UPLOAD_DIR);
      await mkdir(uploadDir, { recursive: true });

      const baseName = resolvedSource.fileName || options.fileName || basename(resolvedSource.sourcePath);
      const { stem, ext } = splitPublishableFileName(baseName);
      const publicationStem = this.buildFilePublicationStem(options.blockId + '-' + stem);
      const targetFileName = `${publicationStem}${ext}`;
      const absPath = resolve(join(uploadDir, targetFileName));

      await copyFile(resolvedSource.sourcePath, absPath);

      const urlPath = `/uploads/${targetFileName}`;
      const provenance = buildArtifactProvenance({
        sourcePath: resolvedSource.sourcePath,
        deliveryUrl: urlPath,
        roots: rootsFromEnv(process.env),
        ...(baseName ? { downloadName: baseName } : {}),
      });
      this.opts.log.info(
        {
          sourcePath: provenance.sourcePath,
          sourceLayer: provenance.sourceLayer,
          ...(provenance.workspaceRelativePath
            ? { workspaceRelativePath: provenance.workspaceRelativePath }
            : {}),
          deliveryUrl: provenance.deliveryUrl,
        },
        '[OutboundDeliveryHook] artifact provenance (source vs delivery)',
      );
      return {
        url: urlPath,
        absPath,
        fileName: baseName,
        sourcePath: resolvedSource.sourcePath,
      };
    } catch (err) {
      this.opts.log.warn({ err, url, sourcePath: resolvedSource.sourcePath }, '[OutboundDeliveryHook] local file publish failed');
      return null;
    } finally {
      if (resolvedSource.cleanup) {
        await unlink(resolvedSource.sourcePath).catch(() => {});
      }
    }
  }

  private async resolvePublishableLocalFile(
    url: string,
    fileName?: string,
    threadMeta?: ThreadMeta,
    content = '',
  ): Promise<ResolvedPublishableFile | null> {
    let sourcePath: string;
    try {
      sourcePath = normalizeLocalReferencePath(url);
    } catch (err) {
      this.opts.log.warn({ err, url }, '[OutboundDeliveryHook] invalid local file URL');
      return null;
    }

    const direct = await this.tryResolveExistingFile(sourcePath);
    if (direct) return { sourcePath: direct, ...(fileName ? { fileName } : {}) };

    const roots = await this.artifactSearchRoots(threadMeta);
    const baseName = fileName || basename(sourcePath);
    const matched = await this.findFileByBasename(roots, baseName);
    if (matched) return { sourcePath: matched, fileName: baseName };

    const generatedArchive = await this.maybeCreateWorkspaceArchive(baseName, content, roots);
    if (generatedArchive) return generatedArchive;

    this.opts.log.warn({ sourcePath, baseName }, '[OutboundDeliveryHook] local file path check failed');
    return null;
  }

  private async tryResolveExistingFile(sourcePath: string): Promise<string | null> {
    try {
      const sourceStats = await stat(sourcePath);
      if (!sourceStats.isFile()) {
        this.opts.log.warn({ sourcePath }, '[OutboundDeliveryHook] local file path is not a file');
        return null;
      }
      return sourcePath;
    } catch {
      return null;
    }
  }

  private async artifactSearchRoots(threadMeta?: ThreadMeta): Promise<string[]> {
    const roots = threadMeta?.artifactSearchRoots ?? [];
    const resolved = new Set<string>();
    for (const root of roots) {
      const path = resolve(String(root || ''));
      try {
        const info = await stat(path);
        if (info.isDirectory() || info.isFile()) resolved.add(path);
      } catch {
        // Ignore stale runtime workspace records.
      }
    }
    return [...resolved];
  }

  private async findFileByBasename(roots: readonly string[], fileName: string): Promise<string | null> {
    const target = basename(fileName).toLowerCase();
    if (!target) return null;
    let visited = 0;
    const queue = roots.map((root) => ({ root, path: root, depth: 0 }));
    while (queue.length > 0 && visited < MAX_ARTIFACT_SEARCH_ENTRIES) {
      const current = queue.shift()!;
      visited++;
      let info;
      try {
        info = await stat(current.path);
      } catch {
        continue;
      }
      if (info.isFile()) {
        if (basename(current.path).toLowerCase() === target) return current.path;
        continue;
      }
      if (!info.isDirectory() || current.depth > MAX_ARTIFACT_SEARCH_DEPTH) continue;
      let entries;
      try {
        entries = await readdir(current.path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (visited + queue.length >= MAX_ARTIFACT_SEARCH_ENTRIES) break;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory() && EXCLUDED_ARTIFACT_DIRS.has(entry.name)) continue;
        const child = join(current.path, entry.name);
        if (!isPathWithin(current.root, child)) continue;
        if (entry.isFile() && entry.name.toLowerCase() === target) return child;
        if (entry.isDirectory()) queue.push({ root: current.root, path: child, depth: current.depth + 1 });
      }
    }
    return null;
  }

  private async maybeCreateWorkspaceArchive(
    requestedFileName: string,
    content: string,
    roots: readonly string[],
  ): Promise<ResolvedPublishableFile | null> {
    if (!isMaomiWorkspaceArchiveRequest(requestedFileName, content)) return null;
    const workspaceRoot = await this.findMaomiWorkspaceRoot(roots);
    if (!workspaceRoot) return null;
    const fileName = archiveFileNameForRequest(requestedFileName);
    const sourcePath = await this.createTarGzArchive(workspaceRoot, fileName);
    return { sourcePath, fileName, cleanup: true };
  }

  private async findMaomiWorkspaceRoot(roots: readonly string[]): Promise<string | null> {
    for (const root of roots) {
      try {
        const info = await stat(root);
        if (info.isDirectory() && await hasMaomiWorkspaceMarker(root)) return root;
      } catch {
        // Continue with other roots.
      }
    }
    for (const root of roots) {
      const found = await this.findDirectoryWithMarker(root, '.clowder-root.json');
      if (found) return found;
    }
    return null;
  }

  private async findDirectoryWithMarker(root: string, marker: string): Promise<string | null> {
    let visited = 0;
    const queue = [{ root, path: root, depth: 0 }];
    while (queue.length > 0 && visited < MAX_ARTIFACT_SEARCH_ENTRIES) {
      const current = queue.shift()!;
      visited++;
      let entries;
      try {
        entries = await readdir(current.path, { withFileTypes: true });
      } catch {
        continue;
      }
      if (entries.some((entry) => entry.isFile() && entry.name === marker)) return current.path;
      if (current.depth >= MAX_ARTIFACT_SEARCH_DEPTH) continue;
      for (const entry of entries) {
        if (visited + queue.length >= MAX_ARTIFACT_SEARCH_ENTRIES) break;
        if (!entry.isDirectory() || EXCLUDED_ARTIFACT_DIRS.has(entry.name)) continue;
        const child = join(current.path, entry.name);
        if (!isPathWithin(current.root, child)) continue;
        queue.push({ root: current.root, path: child, depth: current.depth + 1 });
      }
    }
    return null;
  }

  private async createTarGzArchive(root: string, requestedFileName: string): Promise<string> {
    const files = await this.collectArchiveFiles(root);
    const chunks: Buffer[] = [];
    for (const file of files) {
      const data = await readFile(file.absPath);
      chunks.push(createTarHeader(file.relPath, data.length, file.mtimeSec));
      chunks.push(data);
      const padding = (512 - (data.length % 512)) % 512;
      if (padding > 0) chunks.push(Buffer.alloc(padding));
    }
    chunks.push(Buffer.alloc(1024));

    const archivePath = join(
      tmpdir(),
      `${sanitizeFilenameStem(stripArchiveExtension(requestedFileName))}-${randomBytes(6).toString('hex')}.tar.gz`,
    );
    await writeFile(archivePath, gzipSync(Buffer.concat(chunks)));
    return archivePath;
  }

  private async collectArchiveFiles(root: string): Promise<Array<{ absPath: string; relPath: string; mtimeSec: number }>> {
    const files: Array<{ absPath: string; relPath: string; mtimeSec: number }> = [];
    let totalBytes = 0;
    let visited = 0;
    const queue = [root];
    while (queue.length > 0 && visited < MAX_ARTIFACT_SEARCH_ENTRIES) {
      const dir = queue.shift()!;
      visited++;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (visited + queue.length >= MAX_ARTIFACT_SEARCH_ENTRIES) break;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory() && EXCLUDED_ARTIFACT_DIRS.has(entry.name)) continue;
        const child = join(dir, entry.name);
        if (!isPathWithin(root, child)) continue;
        if (entry.isDirectory()) {
          queue.push(child);
          continue;
        }
        if (!entry.isFile()) continue;
        const info = await stat(child).catch(() => null);
        if (!info?.isFile()) continue;
        totalBytes += info.size;
        if (totalBytes > MAX_WORKSPACE_ARCHIVE_BYTES) {
          this.opts.log.warn({ root, totalBytes }, '[OutboundDeliveryHook] workspace archive skipped — too large');
          return files;
        }
        const relPath = relative(root, child).split(sep).join('/');
        if (!relPath || relPath.startsWith('../') || relPath.includes('/../')) continue;
        files.push({ absPath: child, relPath, mtimeSec: Math.floor(info.mtimeMs / 1000) });
      }
    }
    return files;
  }

  private buildFilePublicationStem(publicationKey: string): string {
    const sanitized = sanitizeFilenameStem(publicationKey);
    const stableSuffix = createHash('sha256').update(publicationKey).digest('hex').slice(0, 8);
    return sanitizeFilenameStem(`${sanitized}-${stableSuffix}`);
  }

  private async publishLocalFileBlocks(
    blocks: RichBlock[],
    threadMeta?: ThreadMeta,
    content?: string,
  ): Promise<RichBlock[]> {
    return Promise.all(
      blocks.map(async (block) => {
        if (block.kind !== 'file' || !('url' in block) || !block.url) return block;
        const fileUrl = block.url as string;
        if (
          fileUrl.startsWith('/uploads/') ||
          fileUrl.startsWith('/api/') ||
          fileUrl.startsWith('https://')
        ) {
          return block;
        }

        const blockFileName = 'fileName' in block ? (block.fileName as string) : undefined;
        const published = await this.publishLocalFileReference(fileUrl, {
          blockId: block.id,
          fileName: blockFileName,
          threadMeta,
          content,
        });

        if (published) {
          this.opts.log.info(
            { blockId: block.id, originalUrl: fileUrl, publishedUrl: published.url, absPath: published.absPath },
            '[OutboundDeliveryHook] Published local file block'
          );
          let size = 'fileSize' in block ? block.fileSize : undefined;
          if (size === undefined || size <= 0) {
            try {
              const fileStat = await stat(published.absPath);
              size = fileStat.size;
            } catch {}
          }
          return {
            ...block,
            url: published.url,
            ...(published.fileName ? { fileName: published.fileName } : {}),
            ...(size !== undefined ? { fileSize: size } : {}),
          };
        } else {
          throw new Error(`file_delivery_failed: failed to publish local file ${fileUrl}`);
        }
      })
    );
  }

  private extractLocalImageReferences(content: string): string[] {
    const references = new Set<string>();
    const fileUrlPattern = /file:\/\/\/[^\s`"'<>)]*\.(?:png|jpe?g|gif|webp)\b/gi;
    for (const match of content.matchAll(fileUrlPattern)) {
      references.add(stripTrailingPunctuation(match[0]));
    }

    const absolutePathPattern = /(?:^|[\s`"'(（:：])((?:\/[^\s`"'<>)]*)+\.(?:png|jpe?g|gif|webp))\b/gi;
    for (const match of content.matchAll(absolutePathPattern)) {
      references.add(stripTrailingPunctuation(match[1]));
    }
    return [...references];
  }

  private extractLocalFileReferences(content: string): string[] {
    const references = new Set<string>();
    const fileUrlPattern = /file:\/\/\/[^\s`"'<>)]*\.(?:zip|tar|gz|rar|7z|pdf|docx?|xlsx?|pptx?|txt|csv|json|md|xml)\b/gi;
    for (const match of content.matchAll(fileUrlPattern)) {
      references.add(stripTrailingPunctuation(match[0]));
    }

    const absolutePathPattern = /(?:^|[\s`"'(（:：])((?:\/[^\s`"'<>)]*)+\.(?:zip|tar|gz|rar|7z|pdf|docx?|xlsx?|pptx?|txt|csv|json|md|xml))\b/gi;
    for (const match of content.matchAll(absolutePathPattern)) {
      references.add(stripTrailingPunctuation(match[1]));
    }

    const homePathPattern = /(?:^|[\s`"'(（:：])(~\/[^\s`"'<>)]*\.(?:zip|tar|gz|rar|7z|pdf|docx?|xlsx?|pptx?|txt|csv|json|md|xml))\b/gi;
    for (const match of content.matchAll(homePathPattern)) {
      references.add(stripTrailingPunctuation(match[1]));
    }
    return [...references];
  }
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;，。；）]+$/g, '');
}

function isLocalPublishableReference(url: string): boolean {
  return url.startsWith('file://') || url.startsWith('~/') || isAbsolute(url);
}

function normalizeLocalReferencePath(url: string): string {
  if (url.startsWith('file://')) return fileURLToPath(url);
  if (url.startsWith('~/')) return resolve(homedir(), url.slice(2));
  return url;
}

function splitPublishableFileName(fileName: string): { stem: string; ext: string } {
  const base = basename(fileName || 'file');
  const lower = base.toLowerCase();
  if (lower.endsWith('.tar.gz')) {
    return {
      stem: sanitizeFilenameStem(base.slice(0, -'.tar.gz'.length)),
      ext: '.tar.gz',
    };
  }
  const ext = extname(base);
  return {
    stem: sanitizeFilenameStem(ext ? basename(base, ext) : base),
    ext: ext || '.bin',
  };
}

function stripArchiveExtension(fileName: string): string {
  const base = basename(fileName || 'archive');
  const lower = base.toLowerCase();
  if (lower.endsWith('.tar.gz')) return base.slice(0, -'.tar.gz'.length);
  if (lower.endsWith('.zip')) return base.slice(0, -'.zip'.length);
  if (lower.endsWith('.gz')) return base.slice(0, -'.gz'.length);
  return extname(base) ? basename(base, extname(base)) : base;
}

function archiveFileNameForRequest(requestedFileName: string): string {
  const stem = sanitizeFilenameStem(stripArchiveExtension(requestedFileName));
  return `${stem || 'maomi_workspace'}.tar.gz`;
}

function isMaomiWorkspaceArchiveRequest(requestedFileName: string, content: string): boolean {
  const base = basename(requestedFileName || '').toLowerCase();
  const asksForMaomiWorkspace =
    /maomi[_-]?workspace/.test(base) ||
    /maomi\s+workspace/i.test(content) ||
    /Maomi\s+Workspace/.test(content);
  const asksForArchive = /\.(?:zip|tar\.gz|gz)$/i.test(base) || /打包|archive|package/i.test(content);
  return asksForMaomiWorkspace && asksForArchive;
}

async function hasMaomiWorkspaceMarker(root: string): Promise<boolean> {
  try {
    const info = await stat(join(root, '.clowder-root.json'));
    return info.isFile();
  } catch {
    return false;
  }
}

function isPathWithin(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`);
}

function octal(value: number, width: number): string {
  return Math.max(0, value).toString(8).padStart(width - 1, '0').slice(-(width - 1)) + '\0';
}

function createTarHeader(name: string, size: number, mtimeSec: number): Buffer {
  const normalizedName = name.replace(/\\/g, '/').slice(0, 100);
  const header = Buffer.alloc(512, 0);
  header.write(normalizedName, 0, 100, 'utf8');
  header.write(octal(0o644, 8), 100, 8, 'ascii');
  header.write(octal(0, 8), 108, 8, 'ascii');
  header.write(octal(0, 8), 116, 8, 'ascii');
  header.write(octal(size, 12), 124, 12, 'ascii');
  header.write(octal(mtimeSec, 12), 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, '0').slice(-6), 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function imageMimeFromPath(filePath: string): SupportedImageMime | null {
  switch (extname(basename(filePath)).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return null;
  }
}

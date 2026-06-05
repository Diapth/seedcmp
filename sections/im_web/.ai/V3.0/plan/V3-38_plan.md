# V3-38 解决计划：Clowder Agent Files Are Not Delivered To Web As Attachments

## 1. 问题现象

在 Clowder 直聊中，当智能体生成/打包工作区文件（例如 `maomi_workspace.zip`）并将其作为附件发送时，IM Web 端只能收到文本消息描述，无法收到结构化的原生文件消息卡片，也无法通过下载按钮下载文件。

具体表现为：
- 智能体输出了 `cc_rich` 文件块，但因为包含本地绝对路径，被后端安全白名单拦截并过滤掉了。
- Web 前端因为没有收到丰富块，退化显示为普通文本。
- 历史消息同步或页面刷新后，无法根据之前的富文本块恢复文件名并渲染为文件卡片。

## 2. 根因判断

主要有两个原因导致了该 Bug：

### 根因 A：缺少本地文件发布与安全校验逻辑
后端 `isValidRichBlock` 在对 `file` 块的 URL 进行验证时，只允许已发布的安全路径：
```ts
const isSafe = url.startsWith('/uploads/') || url.startsWith('/api/') || url.startsWith('https://');
```
但智能体打包输出的文件（如 `maomi_workspace.zip`）在被发送时，其 `url` 通常是绝对路径（如 `/home/yunyi/...`）或 `file://` 协议。这导致：
1. `isValidRichBlock` 将该文件块判定为不安全而完全过滤掉。
2. 过滤后，消息在分发时不再被视为含有富媒体块，最终退化为普通文本发送。
3. 即使没有退化，也没有像图片消息那样将本地文件自动复制/发布到公共 `/uploads/` 目录并重写 URL 的机制。

### 根因 B：直聊会话历史恢复白名单漏配
IM Web 前端中，用于从历史消息的富媒体块恢复出文件卡片的 `canUseClowderHistory` 只识别：
- 群聊（`channelType === 2`）
- `channelId` 以 `clowder_cat:` 开头或为 `clowder_ai` 的会话。

但在直聊中，与猫猫的 WuKongIM 会话 ID `channelId` 通常是猫猫的 UID（例如以 `clowder_cat_` 前缀开头的 ID，例如 `clowder_cat_codex`）。因为缺少对 `clowder_cat_` 前缀的匹配，直聊历史无法启用恢复机制。

此外，前端的 `getClowderFileBlocksFromPayload` 仅从 `richBlocks` 属性中解析文件块。若上游将消息转换为 WuKongIM 原生文件消息（`type === 8`）并去除了 `richBlocks`，则历史同步后该消息无法作为“已知文件块”被用来恢复其他提及该文件名的文本消息。

## 3. 影响范围

- **Clowder API** (`clowder-ai/packages/api`):
  - `rich-block-extract.ts`: `isValidRichBlock` 对本地文件路径的放行校验。
  - `OutboundDeliveryHook.ts`: 增加 `publishLocalFileReference` 机制，在分发前安全地将本地工作区文件复制到公共 `/uploads/` 目录，重写 `block.url` 为公网可访问地址；若复制/上传失败，抛出包含 `file_delivery_failed` 的错误以便桥接器标记投递失败并提示用户。
- **IM Web** (`sections/im_web`):
  - `clowderCatContacts.ts`: `getClowderCatIdFromContactId` 支持匹配以 `clowder_cat_` 开头的 UID，打通直聊会话的历史恢复。
  - `clowderMessageIdentity.ts`: `getClowderFileBlocksFromPayload` 支持从 `type === 8` 的原生文件消息中提取文件信息，提升历史匹配成功率。

## 4. 推荐修复方案

### 4.1 后端文件安全校验与发布
1. 修改 `isValidRichBlock`，允许以 `file://` 或绝对路径开头的本地文件 URL 通过校验。
2. 在 `OutboundDeliveryHook.ts` 的 `executeDelivery` 流程中，在开始向各个适配器（FE/Feishu/WeChat/im-web）分发之前，遍历所有 `file` 类型的富文本块：
   - 提取本地文件路径（转换为绝对路径，进行防目录穿越安全校验）。
   - 将文件复制到服务端的 `/uploads/` 目录下（使用唯一的 Hash 避免同名覆盖）。
   - 更新该块的 `url` 为 `/uploads/xxxx.zip`，并同时读取其实际字节大小更新 `fileSize`。
   - 若在这个过程中发生任何 I/O 错误（如文件不存在、无权限），直接向上层抛出 `file_delivery_failed: <reason>` 错误，终止投递，使 Clowder 桥接器能够识别到发送失败。

### 4.2 前端直聊恢复与原生支持
1. 在 `clowderCatContacts.ts` 的 `getClowderCatIdFromContactId` 中，支持匹配 `clowder_cat_` 前缀，获取真实的 Cat ID。
2. 在 `clowderMessageIdentity.ts` 的 `getClowderFileBlocksFromPayload` 中，当收到类型为 `8`（WuKongIM Native File Message）的消息时，若没有 `richBlocks`，则从其顶层的 `name`、`url`、`size` 属性中组装成一个虚拟的 `ClowderFileBlock`，用于后续的文本消息文件名匹配恢复。

## 5. 具体实施步骤

### 5.1 后端修改
1. **[MODIFY]** [rich-block-extract.ts](file:///home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/rich-block-extract.ts)
   - 导入 `isAbsolute` 从 `'node:path'`。
   - 在 `isValidRichBlock` 里的 `case 'file'`：
     ```ts
     const url = (obj.url as string).trim();
     if (url.includes('..')) return false; // path traversal
     const isSafe =
       url.startsWith('/uploads/') ||
       url.startsWith('/api/') ||
       url.startsWith('https://') ||
       url.startsWith('file://') ||
       isAbsolute(url);
     if (!isSafe) return false;
     ```

2. **[MODIFY]** [OutboundDeliveryHook.ts](file:///home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts)
   - 从 `node:fs/promises` 导入 `copyFile`, `mkdir`。
   - 从 `node:crypto` 导入 `createHash`。
   - 从 `../../utils/image-storage.js` 导入 `sanitizeFilenameStem`。
   - 增加方法 `publishLocalFileReference`：
     ```ts
     private async publishLocalFileReference(
       url: string,
       blockId: string,
       fileName?: string,
     ): Promise<{ url: string; absPath: string } | null> {
       if (url.startsWith('/uploads/') || url.startsWith('/api/') || url.startsWith('/avatars/')) return null;
       if (!url.startsWith('file://') && !isAbsolute(url)) return null;

       let sourcePath: string;
       try {
         sourcePath = url.startsWith('file://') ? fileURLToPath(url) : url;
       } catch (err) {
         this.opts.log.warn({ err, url }, '[OutboundDeliveryHook] invalid local file URL');
         return null;
       }

       try {
         const sourceStats = await stat(sourcePath);
         if (!sourceStats.isFile()) {
           this.opts.log.warn({ sourcePath }, '[OutboundDeliveryHook] local file path is not a file');
           return null;
         }
       } catch (err) {
         this.opts.log.warn({ err, sourcePath }, '[OutboundDeliveryHook] local file path check failed');
         return null;
       }

       try {
         const uploadDir = getDefaultUploadDir(process.env.UPLOAD_DIR);
         await mkdir(uploadDir, { recursive: true });

         const baseName = fileName || basename(sourcePath);
         const ext = extname(baseName);
         const stem = sanitizeFilenameStem(basename(baseName, ext));
         const publicationStem = this.buildFilePublicationStem(blockId + '-' + stem);
         const targetFileName = `${publicationStem}${ext}`;
         const absPath = resolve(join(uploadDir, targetFileName));

         await copyFile(sourcePath, absPath);

         const urlPath = `/uploads/${targetFileName}`;
         return {
           url: resolveInternalRouteUrl(urlPath),
           absPath,
         };
       } catch (err) {
         this.opts.log.warn({ err, url, sourcePath }, '[OutboundDeliveryHook] local file publish failed');
         return null;
       }
     }

     private buildFilePublicationStem(publicationKey: string): string {
       const sanitized = sanitizeFilenameStem(publicationKey);
       const stableSuffix = createHash('sha256').update(publicationKey).digest('hex').slice(0, 8);
       return sanitizeFilenameStem(`${sanitized}-${stableSuffix}`);
     }
     ```
   - 增加方法 `publishLocalFileBlocks` 并应用到 `executeDelivery` 的 `finalBlocks` 处理：
     ```ts
     private async publishLocalFileBlocks(blocks: RichBlock[]): Promise<RichBlock[]> {
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

           const published = await this.publishLocalFileReference(
             fileUrl,
             block.id,
             'fileName' in block ? (block.fileName as string) : undefined
           );

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
               ...(size !== undefined ? { fileSize: size } : {}),
             };
           } else {
             throw new Error(`file_delivery_failed: failed to publish local file ${fileUrl}`);
           }
         })
       );
     }
     ```
   - 在 `executeDelivery` 的 `finalBlocks` 处理：
     ```ts
     let finalBlocks = resolvedBlocks ?? [];
     finalBlocks = await this.publishLocalFileBlocks(finalBlocks);
     finalBlocks = await this.enrichLocalFileBlockSizes(finalBlocks);
     ```

### 5.2 前端修改
1. **[MODIFY]** [clowderCatContacts.ts](file:///home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts)
   - 在 `getClowderCatIdFromContactId` 中增加兼容 `clowder_cat_` 前缀的逻辑：
     ```ts
     export function getClowderCatIdFromContactId(contactId: string) {
       const id = String(contactId || '');
       if (id.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) {
         return id.slice(CLOWDER_CAT_CONTACT_PREFIX.length);
       }
       if (id.startsWith('clowder_cat_')) {
         return id.slice('clowder_cat_'.length);
       }
       return undefined;
     }
     ```

2. **[MODIFY]** [clowderMessageIdentity.ts](file:///home/yunyi/Desktop/Bytedance_cmp/seedcmp/sections/im_web/packages/base-vue/src/utils/clowderMessageIdentity.ts)
   - 在 `getClowderFileBlocksFromPayload` 中，若 `type === 8` (WuKongIM Native File Message) 并且没有其他 `richBlocks`，则作为文件块提取：
     ```ts
     export function getClowderFileBlocksFromPayload(payload: any): ClowderFileBlock[] {
       const blocks = getClowderRichBlocksFromPayload(payload)
         .filter(block => {
           const kind = blockKind(block);
           return kind === 'file' || kind === 'attachment' || Boolean((block?.fileName || block?.filename || block?.name || block?.title) && block?.url);
         })
         .map(block => {
           const name = normalizeFileName(block.fileName || block.filename || block.name || block.title || '');
           const url = normalizeClowderFileUrl(block.url || block.href || block.downloadUrl || block.download_url || '');
           const size = Number(block.size || block.fileSize || block.file_size || block.bytes || 0);
           return {
             name,
             url,
             size: Number.isFinite(size) && size > 0 ? size : undefined,
             raw: block
           };
         })
         .filter(block => Boolean(block.name && block.url));

       const content = getClowderPayload(payload);
       const type = Number(content.type || payload.type || 0);
       if (type === 8) {
         const name = normalizeFileName(content.name || content.fileName || payload.name || payload.fileName || '');
         const url = normalizeClowderFileUrl(content.url || payload.url || '');
         const size = Number(content.size || payload.size || 0);
         if (name && url) {
           blocks.push({
             name,
             url,
             size: Number.isFinite(size) && size > 0 ? size : undefined,
             raw: content
           });
         }
       }

       return blocks;
     }
     ```

## 6. git commit

我们将分两次进行代码提交：

### Commit 1
- **Message**: `fix(clowder-api): support agent file blocks publication and safety check`
- **Description**: Add local file block security whitelist in isValidRichBlock, copy local file references to public uploads directory in OutboundDeliveryHook, throw file_delivery_failed on copy failure.

### Commit 2
- **Message**: `fix(im-web): enable clowder direct chat history recovery and native file message support`
- **Description**: Add clowder_cat_ prefix match in getClowderCatIdFromContactId to support direct conversation file recovery, extract virtual ClowderFileBlock from type 8 native file messages.

## 7. 验证方案

### 自动单元测试
在 `seedcmp/sections/clowder-ai/packages/api` 下运行：
`pnpm test`
确保没有引入 regression 并通过 rich-block 相关的测试用例。

### 手动功能验证
1. 使用启动脚本启动服务：
   `bash scripts/start-im-clowder.sh start`
2. 打开 IM Web 端，在 Codex 平台（或前端界面）创建一个 OAuth 猫猫智能体。
3. 在与该猫猫的直聊中，让它打包或发送一个本地工作区文件（例如 `maomi_workspace.zip`）。
4. **期望结果**：
   - 消息列表中会出现原生 WuKongIM 文件卡片，上面正确显示文件名和大小。
   - 点击文件卡片上的“下载”按钮，文件能成功在浏览器中下载，并能通过网络面板观察到请求了正确的 `/uploads/` 地址。
   - 刷新网页或重新登录后，该文件消息仍然能显示为文件卡片，而不是回退为普通文本。

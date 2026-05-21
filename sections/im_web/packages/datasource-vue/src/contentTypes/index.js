import WKSDK, { MessageContent, MediaMessageContent } from 'wukongimjssdk';
// 3. Gif
export class MessageGif extends MessageContent {
    width;
    height;
    url;
    decodeJSON(content) {
        this.width = content.width || 0;
        this.height = content.height || 0;
        this.url = content.url || '';
    }
    get conversationDigest() {
        return '[动图]';
    }
}
// 4. Voice
export class MessageVoice extends MessageContent {
    url;
    time;
    decodeJSON(content) {
        this.url = content.url || '';
        this.time = content.time || 0;
    }
    get conversationDigest() {
        return '[语音]';
    }
}
// 5. SmallVideo
export class MessageVideo extends MediaMessageContent {
    width;
    height;
    url;
    cover;
    decodeJSON(content) {
        this.width = content.width || 0;
        this.height = content.height || 0;
        this.url = content.url || '';
        this.cover = content.cover || '';
    }
    get conversationDigest() {
        return '[视频]';
    }
}
// 6. Location
export class MessageLocation extends MessageContent {
    latitude;
    longitude;
    title;
    address;
    decodeJSON(content) {
        this.latitude = content.latitude || 0;
        this.longitude = content.longitude || 0;
        this.title = content.title || '';
        this.address = content.address || '';
    }
    get conversationDigest() {
        return '[位置]';
    }
}
// 7. Card
export class MessageCard extends MessageContent {
    uid;
    name;
    avatar;
    decodeJSON(content) {
        this.uid = content.uid || '';
        this.name = content.name || '';
        this.avatar = content.avatar || '';
    }
    get conversationDigest() {
        return '[名片]';
    }
}
// 8. File
export class MessageFile extends MessageContent {
    url;
    name;
    size;
    decodeJSON(content) {
        this.url = content.url || '';
        this.name = content.name || '';
        this.size = content.size || 0;
    }
    get conversationDigest() {
        return `[文件] ${this.name}`;
    }
}
// 11. MergeForward
export class MessageMergeForward extends MessageContent {
    title;
    users;
    messages;
    decodeJSON(content) {
        this.title = content.title || '';
        this.users = content.users || [];
        this.messages = content.messages || [];
    }
    get conversationDigest() {
        return '[聊天记录]';
    }
}
// 12/13. Sticker
export class MessageSticker extends MessageContent {
    category;
    placeholder;
    decodeJSON(content) {
        this.category = content.category || '';
        this.placeholder = content.placeholder || '';
    }
    get conversationDigest() {
        return '[贴图]';
    }
}
export function registerMessageContentTypes() {
    const sdk = WKSDK.shared();
    sdk.register(3, () => new MessageGif());
    sdk.register(4, () => new MessageVoice());
    sdk.register(5, () => new MessageVideo());
    sdk.register(6, () => new MessageLocation());
    sdk.register(7, () => new MessageCard());
    sdk.register(8, () => new MessageFile());
    sdk.register(11, () => new MessageMergeForward());
    sdk.register(12, () => new MessageSticker());
    sdk.register(13, () => new MessageSticker());
}

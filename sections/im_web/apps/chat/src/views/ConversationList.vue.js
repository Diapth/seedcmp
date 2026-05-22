/* __placeholder__ */
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar, ContextMenu, SkeletonScreen } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const route = useRoute();
const conversationStore = useConversationStore();
const userStore = useUserStore();
const loading = ref(false);
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedConversation = ref(null);
const digestFallbackByType = {
    2: '[图片]',
    3: '[动图]',
    4: '[语音]',
    5: '[视频]',
    6: '[位置]',
    7: '[名片]',
    8: '[文件]',
    11: '[聊天记录]',
    12: '[贴图]',
    13: '[贴图]',
    99: '[系统消息]',
    1000: '[系统消息]'
};
onMounted(async () => {
    if (conversationStore.conversations.length === 0) {
        loading.value = true;
        try {
            await conversationStore.syncConversations();
        }
        catch (e) {
            console.error(e);
        }
        finally {
            loading.value = false;
        }
    }
});
watch(() => conversationStore.sortedConversations.map(conv => {
    const lastMessage = getConversationLastMessage(conv);
    return `${conv.channel_id}-${conv.channel_type}-${getSenderUid(lastMessage)}`;
}).join('|'), () => {
    void syncGroupDigestSenders();
}, { immediate: true });
function isActiveConversation(conv) {
    return route.params.channelId === String(conv.channel_id) &&
        Number(route.params.channelType) === Number(conv.channel_type);
}
function getUnreadCount(conv) {
    if (isActiveConversation(conv)) {
        return 0;
    }
    return Number(conv.unread || 0);
}
function handleSelect(channelId, channelType) {
    void conversationStore.clearUnread(channelId, channelType);
    router.push(`/chat/conversation/${channelId}/${channelType}`);
}
function handleConversationContextMenu(event, conv) {
    selectedConversation.value = conv;
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    showContextMenu.value = true;
}
async function handleDeleteConversation() {
    if (!selectedConversation.value)
        return;
    await conversationStore.deleteConversation(selectedConversation.value.channel_id, selectedConversation.value.channel_type);
    if (route.params.channelId === selectedConversation.value.channel_id &&
        Number(route.params.channelType) === selectedConversation.value.channel_type) {
        router.push('/chat');
    }
    selectedConversation.value = null;
}
const contextMenuItems = [
    {
        label: '删除会话',
        danger: true,
        action: handleDeleteConversation
    }
];
function formatTime(timestamp) {
    if (!timestamp)
        return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function parseDigestContent(content) {
    if (typeof content !== 'string') {
        return content;
    }
    try {
        return JSON.parse(content);
    }
    catch (e) {
        return content;
    }
}
function resolveNestedDigestText(value) {
    const parsed = parseDigestContent(value);
    if (!parsed)
        return '';
    if (typeof parsed === 'string')
        return parsed;
    if (typeof parsed !== 'object')
        return '';
    return resolveDigestText(parsed);
}
function resolveDigestText(content) {
    content = parseDigestContent(content);
    if (!content)
        return '';
    if (typeof content === 'string')
        return content;
    const nestedText = resolveNestedDigestText(content.contentObj) ||
        resolveNestedDigestText(content.payload) ||
        (typeof content.content === 'object' ? resolveNestedDigestText(content.content) : '');
    if (nestedText)
        return nestedText;
    return content.text ||
        content.content ||
        content.title ||
        content.name ||
        content.file_name ||
        content.filename ||
        '';
}
function getConversationLastMessage(conv) {
    return conv.last_message || conv.last_msg;
}
function getSenderUid(lastMessage) {
    return String(lastMessage?.fromUID || lastMessage?.from_uid || lastMessage?.from || '');
}
function getSenderName(lastMessage) {
    const uid = getSenderUid(lastMessage);
    return lastMessage?.fromName ||
        lastMessage?.from_name ||
        lastMessage?.sender_name ||
        lastMessage?.senderName ||
        userStore.userCache[uid]?.name ||
        (uid && userStore.currentUser?.uid === uid ? userStore.currentUser?.name : '') ||
        uid ||
        '用户';
}
async function syncGroupDigestSenders() {
    const uids = conversationStore.sortedConversations
        .filter(conv => Number(conv.channel_type) === 2)
        .map(conv => getSenderUid(getConversationLastMessage(conv)))
        .filter(uid => uid && !userStore.userCache[uid]);
    if (uids.length > 0) {
        await userStore.getUsersByIds([...new Set(uids)]);
    }
}
function formatGroupDigest(conv, lastMessage, digest) {
    if (Number(conv.channel_type) !== 2 || !lastMessage) {
        return digest;
    }
    const senderName = getSenderName(lastMessage);
    if (!senderName || digest.startsWith(`${senderName}：`)) {
        return digest;
    }
    return `${senderName}：${digest}`;
}
function getDigest(conv) {
    if (conv.draft) {
        return `[草稿] ${conv.draft}`;
    }
    const lastMessage = getConversationLastMessage(conv);
    if (lastMessage) {
        const payload = parseDigestContent(lastMessage.payload ?? lastMessage.content ?? lastMessage.contentObj);
        const type = Number(payload?.type || lastMessage.type || lastMessage.content_type || lastMessage.contentType || 0);
        const text = resolveDigestText(payload) ||
            resolveDigestText(lastMessage.text) ||
            resolveDigestText(lastMessage.content);
        if (text) {
            const prefix = digestFallbackByType[type];
            if (type === 8 && !String(text).startsWith('[文件]')) {
                return formatGroupDigest(conv, lastMessage, `${prefix} ${text}`);
            }
            if ((type === 6 || type === 7) && prefix && !String(text).startsWith(prefix)) {
                return formatGroupDigest(conv, lastMessage, `${prefix} ${text}`);
            }
            return formatGroupDigest(conv, lastMessage, String(text));
        }
        return formatGroupDigest(conv, lastMessage, digestFallbackByType[type] || '[未知类型]');
    }
    return '暂无消息';
}
let __VLS_modelEmitsType;
const __VLS_componentsOption = {};
let __VLS_name;
function __VLS_template() {
    let __VLS_ctx;
    /* Components */
    let __VLS_otherComponents;
    let __VLS_own;
    let __VLS_localComponents;
    let __VLS_components;
    let __VLS_styleScopedClasses;
    /* CSS variable injection */
    /* CSS variable injection end */
    let __VLS_resolvedLocalAndGlobalComponents;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_components.SkeletonScreen;
    __VLS_components.SkeletonScreen;
    // @ts-ignore
    [SkeletonScreen,];
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_components.ContextMenu;
    __VLS_components.ContextMenu;
    // @ts-ignore
    [ContextMenu,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("conversation-list-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("conversation-list-container"), }));
        if (__VLS_ctx.loading && __VLS_ctx.conversationStore.conversations.length === 0) {
            {
                const __VLS_5 = {}.SkeletonScreen;
                const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({ ...{}, type: ("conversation-item"), count: ((6)), }));
                ({}.SkeletonScreen);
                const __VLS_7 = __VLS_6({ ...{}, type: ("conversation-item"), count: ((6)), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                ({}({ ...{}, type: ("conversation-item"), count: ((6)), }));
                const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            }
            // @ts-ignore
            [loading, conversationStore,];
        }
        else if (__VLS_ctx.conversationStore.conversations.length === 0) {
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("empty-conversations"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("empty-conversations"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["p"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, }));
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            // @ts-ignore
            [conversationStore,];
        }
        else {
            {
                const __VLS_20 = __VLS_intrinsicElements["div"];
                const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                const __VLS_22 = __VLS_21({ ...{}, class: ("list-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                ({}({ ...{}, class: ("list-wrapper"), }));
                for (const [conv] of __VLS_getVForSourceType((__VLS_ctx.conversationStore.sortedConversations))) {
                    {
                        const __VLS_25 = __VLS_intrinsicElements["div"];
                        const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                        const __VLS_27 = __VLS_26({ ...{ 'onClick': {}, 'onContextmenu': {}, }, key: ((conv.channel_id + '-' + conv.channel_type)), class: ("conversation-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{ 'onClick': {}, 'onContextmenu': {}, }, key: ((conv.channel_id + '-' + conv.channel_type)), class: ("conversation-item"), }));
                        ({
                            pinned: conv.top === 1,
                            active: __VLS_ctx.isActiveConversation(conv)
                        });
                        __VLS_styleScopedClasses = ({
                            pinned: conv.top === 1,
                            active: isActiveConversation(conv)
                        });
                        let __VLS_30 = { 'click': __VLS_pickEvent(__VLS_29['click'], {}.onClick) };
                        __VLS_30 = { click: $event => {
                                if (!(!((__VLS_ctx.loading && __VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                if (!(!((__VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                __VLS_ctx.handleSelect(conv.channel_id, conv.channel_type);
                                // @ts-ignore
                                [conversationStore, isActiveConversation, handleSelect,];
                            }
                        };
                        let __VLS_31 = { 'contextmenu': __VLS_pickEvent(__VLS_29['contextmenu'], {}.onContextmenu) };
                        __VLS_31 = { contextmenu: $event => {
                                if (!(!((__VLS_ctx.loading && __VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                if (!(!((__VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                __VLS_ctx.handleConversationContextMenu($event, conv);
                                // @ts-ignore
                                [handleConversationContextMenu,];
                            }
                        };
                        {
                            const __VLS_32 = {}.ChannelAvatar;
                            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }));
                            ({}.ChannelAvatar);
                            const __VLS_34 = __VLS_33({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }, ...__VLS_functionalComponentArgsRest(__VLS_33));
                            ({}({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }));
                            const __VLS_35 = __VLS_pickFunctionalComponentCtx(__VLS_32, __VLS_34);
                        }
                        {
                            const __VLS_37 = __VLS_intrinsicElements["div"];
                            const __VLS_38 = __VLS_elementAsFunctionalComponent(__VLS_37);
                            const __VLS_39 = __VLS_38({ ...{}, class: ("item-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_38));
                            ({}({ ...{}, class: ("item-body"), }));
                            {
                                const __VLS_42 = __VLS_intrinsicElements["div"];
                                const __VLS_43 = __VLS_elementAsFunctionalComponent(__VLS_42);
                                const __VLS_44 = __VLS_43({ ...{}, class: ("item-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                                ({}({ ...{}, class: ("item-header"), }));
                                {
                                    const __VLS_47 = __VLS_intrinsicElements["span"];
                                    const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                                    const __VLS_49 = __VLS_48({ ...{}, class: ("item-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                                    ({}({ ...{}, class: ("item-name"), }));
                                    (conv.name);
                                    (__VLS_50.slots).default;
                                    const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                                }
                                {
                                    const __VLS_52 = __VLS_intrinsicElements["span"];
                                    const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
                                    const __VLS_54 = __VLS_53({ ...{}, class: ("item-time"), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                                    ({}({ ...{}, class: ("item-time"), }));
                                    (__VLS_ctx.formatTime(conv.last_msg_time));
                                    (__VLS_55.slots).default;
                                    const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
                                }
                                (__VLS_45.slots).default;
                                const __VLS_45 = __VLS_pickFunctionalComponentCtx(__VLS_42, __VLS_44);
                            }
                            {
                                const __VLS_57 = __VLS_intrinsicElements["div"];
                                const __VLS_58 = __VLS_elementAsFunctionalComponent(__VLS_57);
                                const __VLS_59 = __VLS_58({ ...{}, class: ("item-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_58));
                                ({}({ ...{}, class: ("item-footer"), }));
                                {
                                    const __VLS_62 = __VLS_intrinsicElements["span"];
                                    const __VLS_63 = __VLS_elementAsFunctionalComponent(__VLS_62);
                                    const __VLS_64 = __VLS_63({ ...{}, class: ("item-digest"), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                                    ({}({ ...{}, class: ("item-digest"), }));
                                    ({ 'item-draft': !!conv.draft });
                                    __VLS_styleScopedClasses = ({ 'item-draft': !!conv.draft });
                                    (__VLS_ctx.getDigest(conv));
                                    (__VLS_65.slots).default;
                                    const __VLS_65 = __VLS_pickFunctionalComponentCtx(__VLS_62, __VLS_64);
                                }
                                {
                                    const __VLS_67 = __VLS_intrinsicElements["div"];
                                    const __VLS_68 = __VLS_elementAsFunctionalComponent(__VLS_67);
                                    const __VLS_69 = __VLS_68({ ...{}, class: ("item-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                                    ({}({ ...{}, class: ("item-status"), }));
                                    if (conv.top === 1) {
                                        {
                                            const __VLS_72 = __VLS_intrinsicElements["span"];
                                            const __VLS_73 = __VLS_elementAsFunctionalComponent(__VLS_72);
                                            const __VLS_74 = __VLS_73({ ...{}, class: ("pin-dot"), title: ("已置顶"), }, ...__VLS_functionalComponentArgsRest(__VLS_73));
                                            ({}({ ...{}, class: ("pin-dot"), title: ("已置顶"), }));
                                            const __VLS_75 = __VLS_pickFunctionalComponentCtx(__VLS_72, __VLS_74);
                                        }
                                        // @ts-ignore
                                        [formatTime, getDigest,];
                                    }
                                    if (__VLS_ctx.getUnreadCount(conv) > 0) {
                                        {
                                            const __VLS_77 = __VLS_intrinsicElements["span"];
                                            const __VLS_78 = __VLS_elementAsFunctionalComponent(__VLS_77);
                                            const __VLS_79 = __VLS_78({ ...{}, class: ("unread-badge"), }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                                            ({}({ ...{}, class: ("unread-badge"), }));
                                            (__VLS_ctx.getUnreadCount(conv) > 99 ? '99+' : __VLS_ctx.getUnreadCount(conv));
                                            (__VLS_80.slots).default;
                                            const __VLS_80 = __VLS_pickFunctionalComponentCtx(__VLS_77, __VLS_79);
                                        }
                                        // @ts-ignore
                                        [getUnreadCount, getUnreadCount, getUnreadCount,];
                                    }
                                    (__VLS_70.slots).default;
                                    const __VLS_70 = __VLS_pickFunctionalComponentCtx(__VLS_67, __VLS_69);
                                }
                                (__VLS_60.slots).default;
                                const __VLS_60 = __VLS_pickFunctionalComponentCtx(__VLS_57, __VLS_59);
                            }
                            (__VLS_40.slots).default;
                            const __VLS_40 = __VLS_pickFunctionalComponentCtx(__VLS_37, __VLS_39);
                        }
                        (__VLS_28.slots).default;
                        const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                        let __VLS_29;
                    }
                }
                (__VLS_23.slots).default;
                const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
            }
        }
        if (__VLS_ctx.showContextMenu) {
            {
                const __VLS_82 = {}.ContextMenu;
                const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.contextMenuX)), y: ((__VLS_ctx.contextMenuY)), items: ((__VLS_ctx.contextMenuItems)), }));
                ({}.ContextMenu);
                const __VLS_84 = __VLS_83({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.contextMenuX)), y: ((__VLS_ctx.contextMenuY)), items: ((__VLS_ctx.contextMenuItems)), }, ...__VLS_functionalComponentArgsRest(__VLS_83));
                ({}({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.contextMenuX)), y: ((__VLS_ctx.contextMenuY)), items: ((__VLS_ctx.contextMenuItems)), }));
                let __VLS_87 = { 'close': __VLS_pickEvent(__VLS_86['close'], {}.onClose) };
                __VLS_87 = { close: $event => {
                        if (!((__VLS_ctx.showContextMenu)))
                            return;
                        __VLS_ctx.showContextMenu = false;
                        // @ts-ignore
                        [showContextMenu, contextMenuX, contextMenuY, contextMenuItems, contextMenuX, contextMenuY, contextMenuItems, contextMenuX, contextMenuY, contextMenuItems, showContextMenu,];
                    }
                };
                const __VLS_85 = __VLS_pickFunctionalComponentCtx(__VLS_82, __VLS_84);
                let __VLS_86;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["conversation-list-container"];
        __VLS_styleScopedClasses["empty-conversations"];
        __VLS_styleScopedClasses["list-wrapper"];
        __VLS_styleScopedClasses["conversation-item"];
        __VLS_styleScopedClasses["item-body"];
        __VLS_styleScopedClasses["item-header"];
        __VLS_styleScopedClasses["item-name"];
        __VLS_styleScopedClasses["item-time"];
        __VLS_styleScopedClasses["item-footer"];
        __VLS_styleScopedClasses["item-digest"];
        __VLS_styleScopedClasses["item-status"];
        __VLS_styleScopedClasses["pin-dot"];
        __VLS_styleScopedClasses["unread-badge"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            ContextMenu: ContextMenu,
            SkeletonScreen: SkeletonScreen,
            conversationStore: conversationStore,
            loading: loading,
            showContextMenu: showContextMenu,
            contextMenuX: contextMenuX,
            contextMenuY: contextMenuY,
            isActiveConversation: isActiveConversation,
            getUnreadCount: getUnreadCount,
            handleSelect: handleSelect,
            handleConversationContextMenu: handleConversationContextMenu,
            contextMenuItems: contextMenuItems,
            formatTime: formatTime,
            getDigest: getDigest,
        };
    },
    emits: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
});

/* __placeholder__ */
import { ref, watch, nextTick, computed } from 'vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useRemoteConfig } from '@tsdaodao/base-vue';
import { TextCell, ImageCell, SystemCell, TimeCell, VoiceCell, FileCell, VideoCell, GifCell, StickerCell, LocationCell, CardCell, MergeCell, ChannelAvatar, ContextMenu } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const messageStore = useMessageStore();
const userStore = useUserStore();
const { remoteConfig } = useRemoteConfig();
const scrollContainer = ref(null);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const selectedMsg = ref(null);
const channelKey = computed(() => `${props.channelId}-${props.channelType}`);
const messages = computed(() => {
    return messageStore.messages[channelKey.value] || [];
});
function scrollToBottom(behavior = 'auto') {
    nextTick(() => {
        if (scrollContainer.value) {
            scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
        }
    });
}
watch(() => messages.value.length, () => {
    scrollToBottom('smooth');
}, { immediate: true });
watch(() => props.channelId, () => {
    scrollToBottom('auto');
});
watch(messages, (newMsgs) => {
    const missingUids = newMsgs
        .map(m => m.fromUID)
        .filter(uid => uid && !userStore.userCache[uid]);
    if (missingUids.length > 0) {
        userStore.getUsersByIds([...new Set(missingUids)]);
    }
}, { immediate: true, deep: true });
function shouldShowTime(msg, index) {
    if (index === 0)
        return true;
    const prevMsg = messages.value[index - 1];
    return (msg.timestamp - prevMsg.timestamp) > 300;
}
function isMe(msg) {
    return msg.fromUID === userStore.currentUser?.uid;
}
function handleRightClick(e, msg) {
    e.preventDefault();
    selectedMsg.value = msg;
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    showMenu.value = true;
}
const menuReactions = computed(() => {
    if (!selectedMsg.value)
        return [];
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    return emojis.map(emoji => ({
        emoji,
        action: () => handleSendReaction(selectedMsg.value, emoji)
    }));
});
async function handleSendReaction(msg, emoji) {
    try {
        await messageStore.toggleReaction(props.channelId, props.channelType, msg, emoji);
    }
    catch (err) {
        Message.error(err.message || err.msg || '回应失败');
    }
}
const menuItems = computed(() => {
    if (!selectedMsg.value)
        return [];
    const items = [];
    const isText = selectedMsg.value.content?.type === 1;
    if (isText) {
        items.push({
            label: '复制文本',
            action: () => {
                const text = selectedMsg.value.content?.text || '';
                navigator.clipboard.writeText(text);
                Message.success('已复制到剪贴板');
            }
        });
    }
    const isMine = isMe(selectedMsg.value);
    const now = Math.floor(Date.now() / 1000);
    const isWithinWindow = (now - selectedMsg.value.timestamp) < remoteConfig.value.revoke_second;
    if (isMine && isWithinWindow) {
        items.push({
            label: '撤回消息',
            danger: true,
            action: async () => {
                try {
                    await messageStore.revokeMessage(props.channelId, props.channelType, selectedMsg.value.clientMsgNo, selectedMsg.value.messageID);
                    Message.success('已撤回消息');
                }
                catch (err) {
                    Message.error(err.msg || '撤回失败');
                }
            }
        });
    }
    items.push({
        label: '回复',
        action: () => {
            messageStore.setReplyTarget(selectedMsg.value);
        }
    });
    return items;
});
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_components.TimeCell;
    __VLS_components.TimeCell;
    // @ts-ignore
    [TimeCell,];
    __VLS_components.SystemCell;
    __VLS_components.SystemCell;
    __VLS_components.SystemCell;
    __VLS_components.SystemCell;
    // @ts-ignore
    [SystemCell, SystemCell,];
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
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_components.TextCell;
    __VLS_components.TextCell;
    // @ts-ignore
    [TextCell,];
    __VLS_components.ImageCell;
    __VLS_components.ImageCell;
    // @ts-ignore
    [ImageCell,];
    __VLS_components.GifCell;
    __VLS_components.GifCell;
    // @ts-ignore
    [GifCell,];
    __VLS_components.VoiceCell;
    __VLS_components.VoiceCell;
    // @ts-ignore
    [VoiceCell,];
    __VLS_components.VideoCell;
    __VLS_components.VideoCell;
    // @ts-ignore
    [VideoCell,];
    __VLS_components.LocationCell;
    __VLS_components.LocationCell;
    // @ts-ignore
    [LocationCell,];
    __VLS_components.CardCell;
    __VLS_components.CardCell;
    // @ts-ignore
    [CardCell,];
    __VLS_components.FileCell;
    __VLS_components.FileCell;
    // @ts-ignore
    [FileCell,];
    __VLS_components.MergeCell;
    __VLS_components.MergeCell;
    // @ts-ignore
    [MergeCell,];
    __VLS_components.StickerCell;
    __VLS_components.StickerCell;
    // @ts-ignore
    [StickerCell,];
    __VLS_components.ContextMenu;
    __VLS_components.ContextMenu;
    // @ts-ignore
    [ContextMenu,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, ref: ("scrollContainer"), class: ("message-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, ref: ("scrollContainer"), class: ("message-list"), }));
        // @ts-ignore
        (__VLS_ctx.scrollContainer);
        for (const [msg, idx] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
            {
                const __VLS_5 = __VLS_intrinsicElements["div"];
                const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
                const __VLS_7 = __VLS_6({ ...{}, key: ((msg.clientMsgNo || msg.messageID)), class: ("message-row-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                ({}({ ...{}, key: ((msg.clientMsgNo || msg.messageID)), class: ("message-row-wrapper"), }));
                if (__VLS_ctx.shouldShowTime(msg, idx)) {
                    {
                        const __VLS_10 = {}.TimeCell;
                        const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({ ...{}, timestamp: ((msg.timestamp)), }));
                        ({}.TimeCell);
                        const __VLS_12 = __VLS_11({ ...{}, timestamp: ((msg.timestamp)), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                        ({}({ ...{}, timestamp: ((msg.timestamp)), }));
                        const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                    }
                    // @ts-ignore
                    [scrollContainer, messages, shouldShowTime,];
                }
                if (msg.content?.type === 1000 || msg.isRevoked) {
                    {
                        const __VLS_15 = __VLS_intrinsicElements["div"];
                        const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                        const __VLS_17 = __VLS_16({ ...{}, class: ("sys-msg-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                        ({}({ ...{}, class: ("sys-msg-row"), }));
                        {
                            const __VLS_20 = {}.SystemCell;
                            const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({ ...{}, message: ((msg)), }));
                            ({}.SystemCell);
                            const __VLS_22 = __VLS_21({ ...{}, message: ((msg)), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                            ({}({ ...{}, message: ((msg)), }));
                            const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                        }
                        (__VLS_18.slots).default;
                        const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                    }
                }
                else {
                    {
                        const __VLS_25 = __VLS_intrinsicElements["div"];
                        const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                        const __VLS_27 = __VLS_26({ ...{ 'onContextmenu': {}, }, class: ("msg-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{ 'onContextmenu': {}, }, class: ("msg-row"), }));
                        ({ 'is-me': __VLS_ctx.isMe(msg) });
                        __VLS_styleScopedClasses = ({ 'is-me': isMe(msg) });
                        let __VLS_30 = { 'contextmenu': __VLS_pickEvent(__VLS_29['contextmenu'], {}.onContextmenu) };
                        __VLS_30 = { contextmenu: $event => {
                                if (!(!((msg.content?.type === 1000 || msg.isRevoked))))
                                    return;
                                __VLS_ctx.handleRightClick($event, msg);
                                // @ts-ignore
                                [isMe, handleRightClick,];
                            }
                        };
                        if (!__VLS_ctx.isMe(msg)) {
                            {
                                const __VLS_31 = {}.ChannelAvatar;
                                const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({ ...{}, name: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.name || '加载中')), avatar: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.avatar)), size: ((36)), class: ("msg-avatar"), }));
                                ({}.ChannelAvatar);
                                const __VLS_33 = __VLS_32({ ...{}, name: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.name || '加载中')), avatar: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.avatar)), size: ((36)), class: ("msg-avatar"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                                ({}({ ...{}, name: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.name || '加载中')), avatar: ((__VLS_ctx.userStore.userCache[msg.fromUID]?.avatar)), size: ((36)), class: ("msg-avatar"), }));
                                const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                            }
                            // @ts-ignore
                            [isMe, userStore, userStore, userStore, userStore, userStore, userStore,];
                        }
                        {
                            const __VLS_36 = __VLS_intrinsicElements["div"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, class: ("msg-bubble-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, class: ("msg-bubble-container"), }));
                            if (__VLS_ctx.channelType === 2 && !__VLS_ctx.isMe(msg)) {
                                {
                                    const __VLS_41 = __VLS_intrinsicElements["div"];
                                    const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                                    const __VLS_43 = __VLS_42({ ...{}, class: ("user-name-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                                    ({}({ ...{}, class: ("user-name-label"), }));
                                    (__VLS_ctx.userStore.userCache[msg.fromUID]?.name || msg.fromUID);
                                    (__VLS_44.slots).default;
                                    const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                                }
                                // @ts-ignore
                                [channelType, isMe, userStore,];
                            }
                            if (msg.content?.reply) {
                                {
                                    const __VLS_46 = __VLS_intrinsicElements["div"];
                                    const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                                    const __VLS_48 = __VLS_47({ ...{}, class: ("quote-reference-box"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                                    ({}({ ...{}, class: ("quote-reference-box"), }));
                                    ({ 'is-me': __VLS_ctx.isMe(msg) });
                                    __VLS_styleScopedClasses = ({ 'is-me': isMe(msg) });
                                    {
                                        const __VLS_51 = __VLS_intrinsicElements["span"];
                                        const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                                        const __VLS_53 = __VLS_52({ ...{}, class: ("quote-author"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                                        ({}({ ...{}, class: ("quote-author"), }));
                                        (msg.content.reply.fromName || msg.content.reply.fromUID);
                                        (__VLS_54.slots).default;
                                        const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                                    }
                                    {
                                        const __VLS_56 = __VLS_intrinsicElements["span"];
                                        const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                                        const __VLS_58 = __VLS_57({ ...{}, class: ("quote-text"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                                        ({}({ ...{}, class: ("quote-text"), }));
                                        (msg.content.reply.content?.text || '[消息]');
                                        (__VLS_59.slots).default;
                                        const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                                    }
                                    (__VLS_49.slots).default;
                                    const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                                }
                                // @ts-ignore
                                [isMe,];
                            }
                            if (msg.content?.type === 1) {
                                {
                                    const __VLS_61 = {}.TextCell;
                                    const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.TextCell);
                                    const __VLS_63 = __VLS_62({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    {
                                        (__VLS_64.slots).default;
                                        // @ts-ignore
                                        [isMe, isMe, isMe,];
                                    }
                                    const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                                }
                            }
                            else if (msg.content?.type === 2) {
                                {
                                    const __VLS_66 = {}.ImageCell;
                                    const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.ImageCell);
                                    const __VLS_68 = __VLS_67({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 3) {
                                {
                                    const __VLS_71 = {}.GifCell;
                                    const __VLS_72 = __VLS_asFunctionalComponent(__VLS_71, new __VLS_71({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.GifCell);
                                    const __VLS_73 = __VLS_72({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 4) {
                                {
                                    const __VLS_76 = {}.VoiceCell;
                                    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.VoiceCell);
                                    const __VLS_78 = __VLS_77({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 5) {
                                {
                                    const __VLS_81 = {}.VideoCell;
                                    const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.VideoCell);
                                    const __VLS_83 = __VLS_82({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 6) {
                                {
                                    const __VLS_86 = {}.LocationCell;
                                    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.LocationCell);
                                    const __VLS_88 = __VLS_87({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_89 = __VLS_pickFunctionalComponentCtx(__VLS_86, __VLS_88);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 7) {
                                {
                                    const __VLS_91 = {}.CardCell;
                                    const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.CardCell);
                                    const __VLS_93 = __VLS_92({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_92));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_94 = __VLS_pickFunctionalComponentCtx(__VLS_91, __VLS_93);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 8) {
                                {
                                    const __VLS_96 = {}.FileCell;
                                    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.FileCell);
                                    const __VLS_98 = __VLS_97({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_97));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_99 = __VLS_pickFunctionalComponentCtx(__VLS_96, __VLS_98);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 11) {
                                {
                                    const __VLS_101 = {}.MergeCell;
                                    const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.MergeCell);
                                    const __VLS_103 = __VLS_102({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_102));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_104 = __VLS_pickFunctionalComponentCtx(__VLS_101, __VLS_103);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else if (msg.content?.type === 12 || msg.content?.type === 13) {
                                {
                                    const __VLS_106 = {}.StickerCell;
                                    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    ({}.StickerCell);
                                    const __VLS_108 = __VLS_107({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }, ...__VLS_functionalComponentArgsRest(__VLS_107));
                                    ({}({ ...{}, message: ((msg)), isMe: ((__VLS_ctx.isMe(msg))), }));
                                    const __VLS_109 = __VLS_pickFunctionalComponentCtx(__VLS_106, __VLS_108);
                                }
                                // @ts-ignore
                                [isMe, isMe, isMe,];
                            }
                            else {
                                {
                                    const __VLS_111 = {}.SystemCell;
                                    const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({ ...{}, message: ((msg)), }));
                                    ({}.SystemCell);
                                    const __VLS_113 = __VLS_112({ ...{}, message: ((msg)), }, ...__VLS_functionalComponentArgsRest(__VLS_112));
                                    ({}({ ...{}, message: ((msg)), }));
                                    const __VLS_114 = __VLS_pickFunctionalComponentCtx(__VLS_111, __VLS_113);
                                }
                            }
                            if (msg.reactions && msg.reactions.length > 0) {
                                {
                                    const __VLS_116 = __VLS_intrinsicElements["div"];
                                    const __VLS_117 = __VLS_elementAsFunctionalComponent(__VLS_116);
                                    const __VLS_118 = __VLS_117({ ...{}, class: ("reactions-bar"), }, ...__VLS_functionalComponentArgsRest(__VLS_117));
                                    ({}({ ...{}, class: ("reactions-bar"), }));
                                    for (const [reaction] of __VLS_getVForSourceType((msg.reactions))) {
                                        {
                                            const __VLS_121 = __VLS_intrinsicElements["div"];
                                            const __VLS_122 = __VLS_elementAsFunctionalComponent(__VLS_121);
                                            const __VLS_123 = __VLS_122({ ...{ 'onClick': {}, }, key: ((reaction.emoji)), class: ("reaction-badge"), }, ...__VLS_functionalComponentArgsRest(__VLS_122));
                                            ({}({ ...{ 'onClick': {}, }, key: ((reaction.emoji)), class: ("reaction-badge"), }));
                                            let __VLS_126 = { 'click': __VLS_pickEvent(__VLS_125['click'], {}.onClick) };
                                            __VLS_126 = { click: $event => {
                                                    if (!(!((msg.content?.type === 1000 || msg.isRevoked))))
                                                        return;
                                                    if (!((msg.reactions && msg.reactions.length > 0)))
                                                        return;
                                                    __VLS_ctx.handleSendReaction(msg, reaction.emoji);
                                                    // @ts-ignore
                                                    [handleSendReaction,];
                                                }
                                            };
                                            {
                                                const __VLS_127 = __VLS_intrinsicElements["span"];
                                                const __VLS_128 = __VLS_elementAsFunctionalComponent(__VLS_127);
                                                const __VLS_129 = __VLS_128({ ...{}, class: ("reaction-emoji"), }, ...__VLS_functionalComponentArgsRest(__VLS_128));
                                                ({}({ ...{}, class: ("reaction-emoji"), }));
                                                (reaction.emoji);
                                                (__VLS_130.slots).default;
                                                const __VLS_130 = __VLS_pickFunctionalComponentCtx(__VLS_127, __VLS_129);
                                            }
                                            {
                                                const __VLS_132 = __VLS_intrinsicElements["span"];
                                                const __VLS_133 = __VLS_elementAsFunctionalComponent(__VLS_132);
                                                const __VLS_134 = __VLS_133({ ...{}, class: ("reaction-count"), }, ...__VLS_functionalComponentArgsRest(__VLS_133));
                                                ({}({ ...{}, class: ("reaction-count"), }));
                                                (reaction.count);
                                                (__VLS_135.slots).default;
                                                const __VLS_135 = __VLS_pickFunctionalComponentCtx(__VLS_132, __VLS_134);
                                            }
                                            (__VLS_124.slots).default;
                                            const __VLS_124 = __VLS_pickFunctionalComponentCtx(__VLS_121, __VLS_123);
                                            let __VLS_125;
                                        }
                                    }
                                    (__VLS_119.slots).default;
                                    const __VLS_119 = __VLS_pickFunctionalComponentCtx(__VLS_116, __VLS_118);
                                }
                            }
                            if (__VLS_ctx.isMe(msg) && msg.status === 'success') {
                                {
                                    const __VLS_137 = __VLS_intrinsicElements["div"];
                                    const __VLS_138 = __VLS_elementAsFunctionalComponent(__VLS_137);
                                    const __VLS_139 = __VLS_138({ ...{}, class: ("read-status-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_138));
                                    ({}({ ...{}, class: ("read-status-wrapper"), }));
                                    if (__VLS_ctx.channelType === 1) {
                                        {
                                            const __VLS_142 = __VLS_intrinsicElements["span"];
                                            const __VLS_143 = __VLS_elementAsFunctionalComponent(__VLS_142);
                                            const __VLS_144 = __VLS_143({ ...{}, class: ("read-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_143));
                                            ({}({ ...{}, class: ("read-status"), }));
                                            ({ 'is-read': msg.remoteExtra?.readed });
                                            __VLS_styleScopedClasses = ({ 'is-read': msg.remoteExtra?.readed });
                                            (msg.remoteExtra?.readed ? '已读' : '未读');
                                            (__VLS_145.slots).default;
                                            const __VLS_145 = __VLS_pickFunctionalComponentCtx(__VLS_142, __VLS_144);
                                        }
                                        // @ts-ignore
                                        [isMe, channelType,];
                                    }
                                    else if (__VLS_ctx.channelType === 2) {
                                        {
                                            const __VLS_147 = __VLS_intrinsicElements["span"];
                                            const __VLS_148 = __VLS_elementAsFunctionalComponent(__VLS_147);
                                            const __VLS_149 = __VLS_148({ ...{}, class: ("read-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_148));
                                            ({}({ ...{}, class: ("read-status"), }));
                                            ({ 'is-read': (msg.remoteExtra?.readedCount || 0) > 0 });
                                            __VLS_styleScopedClasses = ({ 'is-read': (msg.remoteExtra?.readedCount || 0) > 0 });
                                            (msg.remoteExtra?.readedCount ? `${msg.remoteExtra.readedCount}人已读` : '未读');
                                            (__VLS_150.slots).default;
                                            const __VLS_150 = __VLS_pickFunctionalComponentCtx(__VLS_147, __VLS_149);
                                        }
                                        // @ts-ignore
                                        [channelType,];
                                    }
                                    (__VLS_140.slots).default;
                                    const __VLS_140 = __VLS_pickFunctionalComponentCtx(__VLS_137, __VLS_139);
                                }
                            }
                            (__VLS_39.slots).default;
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        }
                        (__VLS_28.slots).default;
                        const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                        let __VLS_29;
                    }
                }
                (__VLS_8.slots).default;
                const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            }
        }
        if (__VLS_ctx.showMenu && __VLS_ctx.menuItems.length > 0) {
            {
                const __VLS_152 = {}.ContextMenu;
                const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.menuX)), y: ((__VLS_ctx.menuY)), items: ((__VLS_ctx.menuItems)), reactions: ((__VLS_ctx.menuReactions)), }));
                ({}.ContextMenu);
                const __VLS_154 = __VLS_153({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.menuX)), y: ((__VLS_ctx.menuY)), items: ((__VLS_ctx.menuItems)), reactions: ((__VLS_ctx.menuReactions)), }, ...__VLS_functionalComponentArgsRest(__VLS_153));
                ({}({ ...{ 'onClose': {}, }, x: ((__VLS_ctx.menuX)), y: ((__VLS_ctx.menuY)), items: ((__VLS_ctx.menuItems)), reactions: ((__VLS_ctx.menuReactions)), }));
                let __VLS_157 = { 'close': __VLS_pickEvent(__VLS_156['close'], {}.onClose) };
                __VLS_157 = { close: $event => {
                        if (!((__VLS_ctx.showMenu && __VLS_ctx.menuItems.length > 0)))
                            return;
                        __VLS_ctx.showMenu = false;
                        // @ts-ignore
                        [showMenu, menuItems, menuX, menuY, menuItems, menuReactions, menuX, menuY, menuItems, menuReactions, menuX, menuY, menuItems, menuReactions, showMenu,];
                    }
                };
                const __VLS_155 = __VLS_pickFunctionalComponentCtx(__VLS_152, __VLS_154);
                let __VLS_156;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["message-list"];
        __VLS_styleScopedClasses["message-row-wrapper"];
        __VLS_styleScopedClasses["sys-msg-row"];
        __VLS_styleScopedClasses["msg-row"];
        __VLS_styleScopedClasses["msg-avatar"];
        __VLS_styleScopedClasses["msg-bubble-container"];
        __VLS_styleScopedClasses["user-name-label"];
        __VLS_styleScopedClasses["quote-reference-box"];
        __VLS_styleScopedClasses["quote-author"];
        __VLS_styleScopedClasses["quote-text"];
        __VLS_styleScopedClasses["reactions-bar"];
        __VLS_styleScopedClasses["reaction-badge"];
        __VLS_styleScopedClasses["reaction-emoji"];
        __VLS_styleScopedClasses["reaction-count"];
        __VLS_styleScopedClasses["read-status-wrapper"];
        __VLS_styleScopedClasses["read-status"];
        __VLS_styleScopedClasses["read-status"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            TextCell: TextCell,
            ImageCell: ImageCell,
            SystemCell: SystemCell,
            TimeCell: TimeCell,
            VoiceCell: VoiceCell,
            FileCell: FileCell,
            VideoCell: VideoCell,
            GifCell: GifCell,
            StickerCell: StickerCell,
            LocationCell: LocationCell,
            CardCell: CardCell,
            MergeCell: MergeCell,
            ChannelAvatar: ChannelAvatar,
            ContextMenu: ContextMenu,
            userStore: userStore,
            scrollContainer: scrollContainer,
            showMenu: showMenu,
            menuX: menuX,
            menuY: menuY,
            messages: messages,
            shouldShowTime: shouldShowTime,
            isMe: isMe,
            handleRightClick: handleRightClick,
            menuReactions: menuReactions,
            handleSendReaction: handleSendReaction,
            menuItems: menuItems,
        };
    },
    props: {},
    emits: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    props: {},
    emits: {},
});

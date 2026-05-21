/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar, SkeletonScreen } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const route = useRoute();
const conversationStore = useConversationStore();
const loading = ref(false);
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
function handleSelect(channelId, channelType) {
    router.push(`/chat/conversation/${channelId}/${channelType}`);
}
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
function getDigest(conv) {
    if (conv.draft) {
        return `[草稿] ${conv.draft}`;
    }
    if (conv.last_message) {
        const payload = conv.last_message.payload || conv.last_message.content;
        if (payload) {
            if (typeof payload === 'string') {
                try {
                    const parsed = JSON.parse(payload);
                    return parsed.text || '[消息]';
                }
                catch (e) {
                    return payload;
                }
            }
            return payload.text || payload.content || '[消息]';
        }
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
                        const __VLS_27 = __VLS_26({ ...{ 'onClick': {}, }, key: ((conv.channel_id + '-' + conv.channel_type)), class: ("conversation-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{ 'onClick': {}, }, key: ((conv.channel_id + '-' + conv.channel_type)), class: ("conversation-item"), }));
                        ({
                            pinned: conv.top === 1,
                            active: __VLS_ctx.route.params.channelId === conv.channel_id && Number(__VLS_ctx.route.params.channelType) === conv.channel_type
                        });
                        __VLS_styleScopedClasses = ({
                            pinned: conv.top === 1,
                            active: route.params.channelId === conv.channel_id && Number(route.params.channelType) === conv.channel_type
                        });
                        let __VLS_30 = { 'click': __VLS_pickEvent(__VLS_29['click'], {}.onClick) };
                        __VLS_30 = { click: $event => {
                                if (!(!((__VLS_ctx.loading && __VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                if (!(!((__VLS_ctx.conversationStore.conversations.length === 0))))
                                    return;
                                __VLS_ctx.handleSelect(conv.channel_id, conv.channel_type);
                                // @ts-ignore
                                [conversationStore, route, route, handleSelect,];
                            }
                        };
                        {
                            const __VLS_31 = {}.ChannelAvatar;
                            const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }));
                            ({}.ChannelAvatar);
                            const __VLS_33 = __VLS_32({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                            ({}({ ...{}, avatar: ((conv.avatar)), name: ((conv.name)), isGroup: ((conv.channel_type === 2)), size: ((42)), }));
                            const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                        }
                        {
                            const __VLS_36 = __VLS_intrinsicElements["div"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, class: ("item-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, class: ("item-body"), }));
                            {
                                const __VLS_41 = __VLS_intrinsicElements["div"];
                                const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                                const __VLS_43 = __VLS_42({ ...{}, class: ("item-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                                ({}({ ...{}, class: ("item-header"), }));
                                {
                                    const __VLS_46 = __VLS_intrinsicElements["span"];
                                    const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                                    const __VLS_48 = __VLS_47({ ...{}, class: ("item-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                                    ({}({ ...{}, class: ("item-name"), }));
                                    (conv.name);
                                    (__VLS_49.slots).default;
                                    const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                                }
                                {
                                    const __VLS_51 = __VLS_intrinsicElements["span"];
                                    const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                                    const __VLS_53 = __VLS_52({ ...{}, class: ("item-time"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                                    ({}({ ...{}, class: ("item-time"), }));
                                    (__VLS_ctx.formatTime(conv.last_msg_time));
                                    (__VLS_54.slots).default;
                                    const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                                }
                                (__VLS_44.slots).default;
                                const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                            }
                            {
                                const __VLS_56 = __VLS_intrinsicElements["div"];
                                const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                                const __VLS_58 = __VLS_57({ ...{}, class: ("item-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                                ({}({ ...{}, class: ("item-footer"), }));
                                {
                                    const __VLS_61 = __VLS_intrinsicElements["span"];
                                    const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                                    const __VLS_63 = __VLS_62({ ...{}, class: ("item-digest"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                                    ({}({ ...{}, class: ("item-digest"), }));
                                    ({ 'item-draft': !!conv.draft });
                                    __VLS_styleScopedClasses = ({ 'item-draft': !!conv.draft });
                                    (__VLS_ctx.getDigest(conv));
                                    (__VLS_64.slots).default;
                                    const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                                }
                                {
                                    const __VLS_66 = __VLS_intrinsicElements["div"];
                                    const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                                    const __VLS_68 = __VLS_67({ ...{}, class: ("item-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                                    ({}({ ...{}, class: ("item-status"), }));
                                    if (conv.top === 1) {
                                        {
                                            const __VLS_71 = __VLS_intrinsicElements["span"];
                                            const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                                            const __VLS_73 = __VLS_72({ ...{}, class: ("pin-dot"), title: ("已置顶"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                                            ({}({ ...{}, class: ("pin-dot"), title: ("已置顶"), }));
                                            const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                                        }
                                        // @ts-ignore
                                        [formatTime, getDigest,];
                                    }
                                    if (conv.unread > 0) {
                                        {
                                            const __VLS_76 = __VLS_intrinsicElements["span"];
                                            const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                                            const __VLS_78 = __VLS_77({ ...{}, class: ("unread-badge"), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                                            ({}({ ...{}, class: ("unread-badge"), }));
                                            (conv.unread > 99 ? '99+' : conv.unread);
                                            (__VLS_79.slots).default;
                                            const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                                        }
                                    }
                                    (__VLS_69.slots).default;
                                    const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                                }
                                (__VLS_59.slots).default;
                                const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                            }
                            (__VLS_39.slots).default;
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
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
            SkeletonScreen: SkeletonScreen,
            route: route,
            conversationStore: conversationStore,
            loading: loading,
            handleSelect: handleSelect,
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

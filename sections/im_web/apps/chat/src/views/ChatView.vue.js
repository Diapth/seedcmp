/* __placeholder__ */
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChannelStore } from '@tsdaodao/datasource-vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { GroupSettingsDrawer } from '@tsdaodao/base-vue';
import MessageList from '../components/MessageList.vue';
import MessageInput from '../components/MessageInput.vue';
import UserProfileDrawer from './UserProfileDrawer.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const channelStore = useChannelStore();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const showGroupSettings = ref(false);
const showUserProfile = ref(false);
const channelId = computed(() => route.params.channelId);
const channelType = computed(() => Number(route.params.channelType || 1));
const channelKey = computed(() => `${channelId.value}-${channelType.value}`);
const channelInfo = computed(() => {
    return channelStore.channels[channelKey.value];
});
const isTyping = computed(() => {
    const key = `${channelId.value}-${channelType.value}`;
    return messageStore.typingState[key]?.isTyping === true;
});
async function loadChannelDetails() {
    const cid = channelId.value;
    const ctype = channelType.value;
    if (!cid)
        return;
    if (!channelInfo.value) {
        channelStore.getChannelInfo(cid, ctype);
    }
    await messageStore.syncMessages(cid, ctype);
    await conversationStore.clearUnread(cid, ctype);
}
onMounted(() => {
    loadChannelDetails();
});
watch([channelId, channelType], () => {
    loadChannelDetails();
});
watch(() => messageStore.messages[channelKey.value]?.length, () => {
    conversationStore.clearUnread(channelId.value, channelType.value);
});
function handleHeaderClick() {
    if (channelType.value === 1) {
        showUserProfile.value = true;
    }
}
function handleGroupSettingsClick() {
    showGroupSettings.value = true;
}
function handleMembersClick() {
    showGroupSettings.value = false;
    router.push(`/chat/group-members/${channelId.value}`);
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
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.path;
    __VLS_components.MessageList;
    __VLS_components.MessageList;
    // @ts-ignore
    [MessageList,];
    __VLS_components.MessageInput;
    __VLS_components.MessageInput;
    // @ts-ignore
    [MessageInput,];
    __VLS_components.GroupSettingsDrawer;
    __VLS_components.GroupSettingsDrawer;
    // @ts-ignore
    [GroupSettingsDrawer,];
    __VLS_components.UserProfileDrawer;
    __VLS_components.UserProfileDrawer;
    // @ts-ignore
    [UserProfileDrawer,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("chat-view-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("chat-view-container"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("chat-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("chat-header"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{ 'onClick': {}, }, class: ("header-left"), style: (({ cursor: __VLS_ctx.channelType === 1 ? 'pointer' : 'default' })), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{ 'onClick': {}, }, class: ("header-left"), style: (({ cursor: __VLS_ctx.channelType === 1 ? 'pointer' : 'default' })), }));
                let __VLS_15 = { 'click': __VLS_pickEvent(__VLS_14['click'], {}.onClick) };
                __VLS_15 = { click: (__VLS_ctx.handleHeaderClick) };
                {
                    const __VLS_16 = __VLS_intrinsicElements["h3"];
                    const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                    const __VLS_18 = __VLS_17({ ...{}, class: ("channel-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                    ({}({ ...{}, class: ("channel-name"), }));
                    (__VLS_ctx.channelInfo?.name || '正在加载...');
                    (__VLS_19.slots).default;
                    const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                }
                if (__VLS_ctx.isTyping) {
                    {
                        const __VLS_21 = __VLS_intrinsicElements["span"];
                        const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                        const __VLS_23 = __VLS_22({ ...{}, class: ("typing-indicator"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, class: ("typing-indicator"), }));
                        (__VLS_24.slots).default;
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    // @ts-ignore
                    [channelType, channelType, handleHeaderClick, channelInfo, isTyping,];
                }
                else {
                    {
                        const __VLS_26 = __VLS_intrinsicElements["span"];
                        const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                        const __VLS_28 = __VLS_27({ ...{}, class: ("status-indicator"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                        ({}({ ...{}, class: ("status-indicator"), }));
                        (__VLS_ctx.channelType === 2 ? '群聊' : '在线');
                        (__VLS_29.slots).default;
                        const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                    }
                    // @ts-ignore
                    [channelType,];
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                let __VLS_14;
            }
            {
                const __VLS_31 = __VLS_intrinsicElements["div"];
                const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                const __VLS_33 = __VLS_32({ ...{}, class: ("header-right"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                ({}({ ...{}, class: ("header-right"), }));
                if (__VLS_ctx.channelType === 2) {
                    {
                        const __VLS_36 = __VLS_intrinsicElements["button"];
                        const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                        const __VLS_38 = __VLS_37({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("群聊设置"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                        ({}({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("群聊设置"), }));
                        let __VLS_41 = { 'click': __VLS_pickEvent(__VLS_40['click'], {}.onClick) };
                        __VLS_41 = { click: (__VLS_ctx.handleGroupSettingsClick) };
                        {
                            const __VLS_42 = __VLS_intrinsicElements["svg"];
                            const __VLS_43 = __VLS_elementAsFunctionalComponent(__VLS_42);
                            const __VLS_44 = __VLS_43({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("settings-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                            ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("settings-icon"), }));
                            {
                                const __VLS_47 = __VLS_intrinsicElements["circle"];
                                const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                                const __VLS_49 = __VLS_48({ ...{}, cx: ("12"), cy: ("12"), r: ("3"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                                ({}({ ...{}, cx: ("12"), cy: ("12"), r: ("3"), }));
                                const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                            }
                            {
                                const __VLS_52 = __VLS_intrinsicElements["path"];
                                const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
                                const __VLS_54 = __VLS_53({ ...{}, d: ("M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                                ({}({ ...{}, d: ("M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"), }));
                                const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
                            }
                            (__VLS_45.slots).default;
                            const __VLS_45 = __VLS_pickFunctionalComponentCtx(__VLS_42, __VLS_44);
                        }
                        (__VLS_39.slots).default;
                        const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        let __VLS_40;
                    }
                    // @ts-ignore
                    [channelType, handleGroupSettingsClick,];
                }
                (__VLS_34.slots).default;
                const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_57 = {}.MessageList;
            const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
            ({}.MessageList);
            const __VLS_59 = __VLS_58({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }, ...__VLS_functionalComponentArgsRest(__VLS_58));
            ({}({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
            const __VLS_60 = __VLS_pickFunctionalComponentCtx(__VLS_57, __VLS_59);
        }
        {
            const __VLS_62 = {}.MessageInput;
            const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
            ({}.MessageInput);
            const __VLS_64 = __VLS_63({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
            ({}({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
            const __VLS_65 = __VLS_pickFunctionalComponentCtx(__VLS_62, __VLS_64);
        }
        if (__VLS_ctx.channelType === 2) {
            {
                const __VLS_67 = {}.GroupSettingsDrawer;
                const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }));
                ({}.GroupSettingsDrawer);
                const __VLS_69 = __VLS_68({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                ({}({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }));
                let __VLS_72 = { 'close': __VLS_pickEvent(__VLS_71['close'], {}.onClose) };
                __VLS_72 = { close: $event => {
                        if (!((__VLS_ctx.channelType === 2)))
                            return;
                        __VLS_ctx.showGroupSettings = false;
                        // @ts-ignore
                        [channelId, channelType, channelId, channelType, channelId, channelType, channelId, channelType, channelId, channelType, channelId, channelType, channelType, channelId, showGroupSettings, channelId, showGroupSettings, channelId, showGroupSettings, showGroupSettings,];
                    }
                };
                let __VLS_73 = { 'members-click': __VLS_pickEvent(__VLS_71['members-click'], {}.onMembersClick) };
                __VLS_73 = { "members-click": (__VLS_ctx.handleMembersClick) };
                const __VLS_70 = __VLS_pickFunctionalComponentCtx(__VLS_67, __VLS_69);
                let __VLS_71;
            }
            // @ts-ignore
            [handleMembersClick,];
        }
        if (__VLS_ctx.channelType === 1) {
            {
                const __VLS_74 = {}.UserProfileDrawer;
                const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }));
                ({}.UserProfileDrawer);
                const __VLS_76 = __VLS_75({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }, ...__VLS_functionalComponentArgsRest(__VLS_75));
                ({}({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }));
                let __VLS_79 = { 'close': __VLS_pickEvent(__VLS_78['close'], {}.onClose) };
                __VLS_79 = { close: $event => {
                        if (!((__VLS_ctx.channelType === 1)))
                            return;
                        __VLS_ctx.showUserProfile = false;
                        // @ts-ignore
                        [channelType, channelId, showUserProfile, channelId, showUserProfile, channelId, showUserProfile, showUserProfile,];
                    }
                };
                const __VLS_77 = __VLS_pickFunctionalComponentCtx(__VLS_74, __VLS_76);
                let __VLS_78;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["chat-view-container"];
        __VLS_styleScopedClasses["chat-header"];
        __VLS_styleScopedClasses["header-left"];
        __VLS_styleScopedClasses["channel-name"];
        __VLS_styleScopedClasses["typing-indicator"];
        __VLS_styleScopedClasses["status-indicator"];
        __VLS_styleScopedClasses["header-right"];
        __VLS_styleScopedClasses["settings-btn"];
        __VLS_styleScopedClasses["settings-icon"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            GroupSettingsDrawer: GroupSettingsDrawer,
            MessageList: MessageList,
            MessageInput: MessageInput,
            UserProfileDrawer: UserProfileDrawer,
            showGroupSettings: showGroupSettings,
            showUserProfile: showUserProfile,
            channelId: channelId,
            channelType: channelType,
            channelInfo: channelInfo,
            isTyping: isTyping,
            handleHeaderClick: handleHeaderClick,
            handleGroupSettingsClick: handleGroupSettingsClick,
            handleMembersClick: handleMembersClick,
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

/* __placeholder__ */
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChannelStore } from '@tsdaodao/datasource-vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { GroupSettingsDrawer } from '@tsdaodao/base-vue';
import MessageList from '../components/MessageList.vue';
import MessageInput from '../components/MessageInput.vue';
import ChatSidePreview from '../components/ChatSidePreview.vue';
import ClowderConversationPanel from '../components/ClowderConversationPanel.vue';
import UserProfileDrawer from './UserProfileDrawer.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const channelStore = useChannelStore();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const showGroupSettings = ref(false);
const showUserProfile = ref(false);
const showClowderPanel = ref(false);
const activeRightDockTab = ref('preview');
const rightDockWidth = ref(Number(window.localStorage.getItem('im-web-right-dock-width') || 420));
const sidePreviewRequestId = ref(0);
const sidePreview = ref({
    visible: false,
    type: 'file-text',
    title: '',
    subtitle: '',
    sourceUrl: '',
    sourceText: '',
    extension: '',
    loading: false,
    error: ''
});
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
const rightDockVisible = computed(() => sidePreview.value.visible || showClowderPanel.value);
const rightDockTabs = computed(() => [
    { key: 'preview', label: '预览', visible: sidePreview.value.visible },
    { key: 'clowder', label: 'Clowder', visible: showClowderPanel.value }
].filter(tab => tab.visible));
function isChatViewActive(cid, ctype) {
    return route.name === 'Conversation' &&
        String(route.params.channelId || '') === String(cid) &&
        Number(route.params.channelType || 0) === Number(ctype);
}
async function loadChannelDetails() {
    const cid = channelId.value;
    const ctype = channelType.value;
    if (!cid)
        return;
    if (!channelInfo.value) {
        channelStore.getChannelInfo(cid, ctype);
    }
    await messageStore.syncMessages(cid, ctype);
    if (isChatViewActive(cid, ctype)) {
        await conversationStore.clearUnread(cid, ctype);
    }
}
onMounted(() => {
    loadChannelDetails();
});
onBeforeUnmount(() => {
    stopRightDockResize();
});
watch([channelId, channelType], () => {
    closeSidePreview();
    loadChannelDetails();
});
watch(() => messageStore.messages[channelKey.value]?.length, () => {
    if (isChatViewActive(channelId.value, channelType.value)) {
        void conversationStore.clearUnread(channelId.value, channelType.value);
    }
});
function handleHeaderClick() {
    if (channelType.value === 1) {
        showUserProfile.value = true;
    }
}
function handleGroupSettingsClick() {
    showGroupSettings.value = true;
}
function handleClowderClick() {
    showClowderPanel.value = true;
    activeRightDockTab.value = 'clowder';
}
function handleMembersClick() {
    showGroupSettings.value = false;
    router.push(`/chat/group-members/${channelId.value}`);
}
function selectRightDockTab(tab) {
    activeRightDockTab.value = tab;
}
function filePreviewType(kind) {
    const map = {
        markdown: 'file-markdown',
        text: 'file-text',
        html: 'file-html',
        pdf: 'file-pdf',
        office: 'file-office'
    };
    return map[kind] || 'file-text';
}
function filePreviewTitle(kind) {
    const labels = {
        markdown: 'Markdown 预览',
        text: '文本预览',
        html: 'HTML 预览',
        pdf: 'PDF 预览',
        office: 'Office 文件预览'
    };
    return labels[kind] || '文件预览';
}
function closeSidePreview() {
    sidePreviewRequestId.value += 1;
    sidePreview.value.visible = false;
    sidePreview.value.loading = false;
    sidePreview.value.error = '';
    if (activeRightDockTab.value === 'preview') {
        activeRightDockTab.value = showClowderPanel.value ? 'clowder' : 'preview';
    }
}
function closeClowderPanel() {
    showClowderPanel.value = false;
    if (activeRightDockTab.value === 'clowder') {
        activeRightDockTab.value = sidePreview.value.visible ? 'preview' : 'clowder';
    }
}
async function handleOpenPreview(payload) {
    const requestId = sidePreviewRequestId.value + 1;
    sidePreviewRequestId.value = requestId;
    activeRightDockTab.value = 'preview';
    if (payload?.source === 'ai-code') {
        sidePreview.value = {
            visible: true,
            type: 'ai-html',
            title: 'AI HTML 预览',
            subtitle: payload.language ? `${payload.language} 代码块` : 'HTML 代码块',
            sourceUrl: '',
            sourceText: payload.code || '',
            extension: 'html',
            loading: false,
            error: payload.code ? '' : '代码块内容为空'
        };
        return;
    }
    if (payload?.source === 'image') {
        sidePreview.value = {
            visible: true,
            type: 'file-image',
            title: '图片预览',
            subtitle: payload?.name || '',
            sourceUrl: payload?.url || '',
            sourceText: '',
            extension: payload?.extension || 'image',
            loading: false,
            error: payload?.url ? '' : '图片地址为空'
        };
        return;
    }
    const type = filePreviewType(payload?.kind || '');
    sidePreview.value = {
        visible: true,
        type,
        title: filePreviewTitle(payload?.kind || ''),
        subtitle: payload?.name || '',
        sourceUrl: payload?.url || '',
        sourceText: '',
        extension: payload?.extension || '',
        loading: ['file-markdown', 'file-text', 'file-html'].includes(type),
        error: ''
    };
    if (!['file-markdown', 'file-text', 'file-html'].includes(type))
        return;
    try {
        const res = await fetch(payload.url);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        if (sidePreviewRequestId.value !== requestId)
            return;
        sidePreview.value.sourceText = await res.text();
    }
    catch (err) {
        if (sidePreviewRequestId.value !== requestId)
            return;
        sidePreview.value.error = err?.message || '预览加载失败';
    }
    finally {
        if (sidePreviewRequestId.value !== requestId)
            return;
        sidePreview.value.loading = false;
    }
}
function setRightDockWidth(width) {
    const maxWidth = Math.max(420, Math.floor(window.innerWidth * 0.75));
    const next = Math.min(maxWidth, Math.max(360, Math.floor(width)));
    rightDockWidth.value = next;
    window.localStorage.setItem('im-web-right-dock-width', String(next));
}
function handleRightDockResize(event) {
    setRightDockWidth(window.innerWidth - event.clientX);
}
function stopRightDockResize() {
    window.removeEventListener('mousemove', handleRightDockResize);
    window.removeEventListener('mouseup', stopRightDockResize);
    document.body.classList.remove('is-resizing-right-dock');
}
function startRightDockResize(event) {
    event.preventDefault();
    document.body.classList.add('is-resizing-right-dock');
    window.addEventListener('mousemove', handleRightDockResize);
    window.addEventListener('mouseup', stopRightDockResize);
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
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
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
    __VLS_intrinsicElements.aside;
    __VLS_intrinsicElements.aside;
    __VLS_intrinsicElements.header;
    __VLS_intrinsicElements.header;
    __VLS_components.ChatSidePreview;
    __VLS_components.ChatSidePreview;
    // @ts-ignore
    [ChatSidePreview,];
    __VLS_components.ClowderConversationPanel;
    __VLS_components.ClowderConversationPanel;
    // @ts-ignore
    [ClowderConversationPanel,];
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
            const __VLS_7 = __VLS_6({ ...{}, class: ("chat-main-column"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("chat-main-column"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("chat-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("chat-header"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["div"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{ 'onClick': {}, }, class: ("header-left"), style: (({ cursor: __VLS_ctx.channelType === 1 ? 'pointer' : 'default' })), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{ 'onClick': {}, }, class: ("header-left"), style: (({ cursor: __VLS_ctx.channelType === 1 ? 'pointer' : 'default' })), }));
                    let __VLS_20 = { 'click': __VLS_pickEvent(__VLS_19['click'], {}.onClick) };
                    __VLS_20 = { click: (__VLS_ctx.handleHeaderClick) };
                    {
                        const __VLS_21 = __VLS_intrinsicElements["h3"];
                        const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                        const __VLS_23 = __VLS_22({ ...{}, class: ("channel-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, class: ("channel-name"), }));
                        (__VLS_ctx.channelInfo?.name || '正在加载...');
                        (__VLS_24.slots).default;
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    if (__VLS_ctx.isTyping) {
                        {
                            const __VLS_26 = __VLS_intrinsicElements["span"];
                            const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                            const __VLS_28 = __VLS_27({ ...{}, class: ("typing-indicator"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                            ({}({ ...{}, class: ("typing-indicator"), }));
                            (__VLS_29.slots).default;
                            const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                        }
                        // @ts-ignore
                        [channelType, channelType, handleHeaderClick, channelInfo, isTyping,];
                    }
                    else {
                        {
                            const __VLS_31 = __VLS_intrinsicElements["span"];
                            const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                            const __VLS_33 = __VLS_32({ ...{}, class: ("status-indicator"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                            ({}({ ...{}, class: ("status-indicator"), }));
                            (__VLS_ctx.channelType === 2 ? '群聊' : '在线');
                            (__VLS_34.slots).default;
                            const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                        }
                        // @ts-ignore
                        [channelType,];
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                    let __VLS_19;
                }
                {
                    const __VLS_36 = __VLS_intrinsicElements["div"];
                    const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                    const __VLS_38 = __VLS_37({ ...{}, class: ("header-right"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                    ({}({ ...{}, class: ("header-right"), }));
                    {
                        const __VLS_41 = __VLS_intrinsicElements["button"];
                        const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                        const __VLS_43 = __VLS_42({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("Clowder"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                        ({}({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("Clowder"), }));
                        let __VLS_46 = { 'click': __VLS_pickEvent(__VLS_45['click'], {}.onClick) };
                        __VLS_46 = { click: (__VLS_ctx.handleClowderClick) };
                        (__VLS_44.slots).default;
                        const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                        let __VLS_45;
                    }
                    if (__VLS_ctx.channelType === 2) {
                        {
                            const __VLS_47 = __VLS_intrinsicElements["button"];
                            const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                            const __VLS_49 = __VLS_48({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("群聊设置"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                            ({}({ ...{ 'onClick': {}, }, class: ("settings-btn"), title: ("群聊设置"), }));
                            let __VLS_52 = { 'click': __VLS_pickEvent(__VLS_51['click'], {}.onClick) };
                            __VLS_52 = { click: (__VLS_ctx.handleGroupSettingsClick) };
                            {
                                const __VLS_53 = __VLS_intrinsicElements["svg"];
                                const __VLS_54 = __VLS_elementAsFunctionalComponent(__VLS_53);
                                const __VLS_55 = __VLS_54({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("settings-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_54));
                                ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("settings-icon"), }));
                                {
                                    const __VLS_58 = __VLS_intrinsicElements["circle"];
                                    const __VLS_59 = __VLS_elementAsFunctionalComponent(__VLS_58);
                                    const __VLS_60 = __VLS_59({ ...{}, cx: ("12"), cy: ("12"), r: ("3"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
                                    ({}({ ...{}, cx: ("12"), cy: ("12"), r: ("3"), }));
                                    const __VLS_61 = __VLS_pickFunctionalComponentCtx(__VLS_58, __VLS_60);
                                }
                                {
                                    const __VLS_63 = __VLS_intrinsicElements["path"];
                                    const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                                    const __VLS_65 = __VLS_64({ ...{}, d: ("M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                                    ({}({ ...{}, d: ("M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"), }));
                                    const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                                }
                                (__VLS_56.slots).default;
                                const __VLS_56 = __VLS_pickFunctionalComponentCtx(__VLS_53, __VLS_55);
                            }
                            (__VLS_50.slots).default;
                            const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                            let __VLS_51;
                        }
                        // @ts-ignore
                        [handleClowderClick, channelType, handleGroupSettingsClick,];
                    }
                    (__VLS_39.slots).default;
                    const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_68 = {}.MessageList;
                const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({ ...{ 'onOpenPreview': {}, }, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                ({}.MessageList);
                const __VLS_70 = __VLS_69({ ...{ 'onOpenPreview': {}, }, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                ({}({ ...{ 'onOpenPreview': {}, }, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                let __VLS_73 = { 'open-preview': __VLS_pickEvent(__VLS_72['open-preview'], {}.onOpenPreview) };
                __VLS_73 = { "open-preview": (__VLS_ctx.handleOpenPreview) };
                const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                let __VLS_72;
            }
            {
                const __VLS_74 = {}.MessageInput;
                const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                ({}.MessageInput);
                const __VLS_76 = __VLS_75({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }, ...__VLS_functionalComponentArgsRest(__VLS_75));
                ({}({ ...{}, channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                const __VLS_77 = __VLS_pickFunctionalComponentCtx(__VLS_74, __VLS_76);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        if (__VLS_ctx.rightDockVisible) {
            {
                const __VLS_79 = __VLS_intrinsicElements["aside"];
                const __VLS_80 = __VLS_elementAsFunctionalComponent(__VLS_79);
                const __VLS_81 = __VLS_80({ ...{}, class: ("right-dock"), style: (({ width: `${__VLS_ctx.rightDockWidth}px` })), "aria-label": ("右侧工作区"), }, ...__VLS_functionalComponentArgsRest(__VLS_80));
                ({}({ ...{}, class: ("right-dock"), style: (({ width: `${__VLS_ctx.rightDockWidth}px` })), "aria-label": ("右侧工作区"), }));
                {
                    const __VLS_84 = __VLS_intrinsicElements["div"];
                    const __VLS_85 = __VLS_elementAsFunctionalComponent(__VLS_84);
                    const __VLS_86 = __VLS_85({ ...{ 'onMousedown': {}, }, class: ("right-dock-resizer"), title: ("拖动调整宽度"), }, ...__VLS_functionalComponentArgsRest(__VLS_85));
                    ({}({ ...{ 'onMousedown': {}, }, class: ("right-dock-resizer"), title: ("拖动调整宽度"), }));
                    let __VLS_89 = { 'mousedown': __VLS_pickEvent(__VLS_88['mousedown'], {}.onMousedown) };
                    __VLS_89 = { mousedown: (__VLS_ctx.startRightDockResize) };
                    const __VLS_87 = __VLS_pickFunctionalComponentCtx(__VLS_84, __VLS_86);
                    let __VLS_88;
                }
                if (__VLS_ctx.rightDockTabs.length > 1) {
                    {
                        const __VLS_90 = __VLS_intrinsicElements["header"];
                        const __VLS_91 = __VLS_elementAsFunctionalComponent(__VLS_90);
                        const __VLS_92 = __VLS_91({ ...{}, class: ("right-dock-tabs"), }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                        ({}({ ...{}, class: ("right-dock-tabs"), }));
                        for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.rightDockTabs))) {
                            {
                                const __VLS_95 = __VLS_intrinsicElements["button"];
                                const __VLS_96 = __VLS_elementAsFunctionalComponent(__VLS_95);
                                const __VLS_97 = __VLS_96({ ...{ 'onClick': {}, }, key: ((tab.key)), type: ("button"), class: ("dock-tab"), }, ...__VLS_functionalComponentArgsRest(__VLS_96));
                                ({}({ ...{ 'onClick': {}, }, key: ((tab.key)), type: ("button"), class: ("dock-tab"), }));
                                ({ active: __VLS_ctx.activeRightDockTab === tab.key });
                                __VLS_styleScopedClasses = ({ active: activeRightDockTab === tab.key });
                                let __VLS_100 = { 'click': __VLS_pickEvent(__VLS_99['click'], {}.onClick) };
                                __VLS_100 = { click: $event => {
                                        if (!((__VLS_ctx.rightDockVisible)))
                                            return;
                                        if (!((__VLS_ctx.rightDockTabs.length > 1)))
                                            return;
                                        __VLS_ctx.selectRightDockTab(tab.key);
                                        // @ts-ignore
                                        [channelId, channelType, channelId, channelType, channelId, channelType, handleOpenPreview, channelId, channelType, channelId, channelType, channelId, channelType, rightDockVisible, rightDockWidth, rightDockWidth, startRightDockResize, rightDockTabs, rightDockTabs, activeRightDockTab, selectRightDockTab,];
                                    }
                                };
                                (tab.label);
                                (__VLS_98.slots).default;
                                const __VLS_98 = __VLS_pickFunctionalComponentCtx(__VLS_95, __VLS_97);
                                let __VLS_99;
                            }
                        }
                        (__VLS_93.slots).default;
                        const __VLS_93 = __VLS_pickFunctionalComponentCtx(__VLS_90, __VLS_92);
                    }
                }
                {
                    const __VLS_101 = __VLS_intrinsicElements["div"];
                    const __VLS_102 = __VLS_elementAsFunctionalComponent(__VLS_101);
                    const __VLS_103 = __VLS_102({ ...{}, class: ("right-dock-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_102));
                    ({}({ ...{}, class: ("right-dock-body"), }));
                    {
                        const __VLS_106 = {}.ChatSidePreview;
                        const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.sidePreview.visible)), type: ((__VLS_ctx.sidePreview.type)), title: ((__VLS_ctx.sidePreview.title)), subtitle: ((__VLS_ctx.sidePreview.subtitle)), sourceUrl: ((__VLS_ctx.sidePreview.sourceUrl)), sourceText: ((__VLS_ctx.sidePreview.sourceText)), extension: ((__VLS_ctx.sidePreview.extension)), loading: ((__VLS_ctx.sidePreview.loading)), error: ((__VLS_ctx.sidePreview.error)), }));
                        ({}.ChatSidePreview);
                        const __VLS_108 = __VLS_107({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.sidePreview.visible)), type: ((__VLS_ctx.sidePreview.type)), title: ((__VLS_ctx.sidePreview.title)), subtitle: ((__VLS_ctx.sidePreview.subtitle)), sourceUrl: ((__VLS_ctx.sidePreview.sourceUrl)), sourceText: ((__VLS_ctx.sidePreview.sourceText)), extension: ((__VLS_ctx.sidePreview.extension)), loading: ((__VLS_ctx.sidePreview.loading)), error: ((__VLS_ctx.sidePreview.error)), }, ...__VLS_functionalComponentArgsRest(__VLS_107));
                        ({}({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.sidePreview.visible)), type: ((__VLS_ctx.sidePreview.type)), title: ((__VLS_ctx.sidePreview.title)), subtitle: ((__VLS_ctx.sidePreview.subtitle)), sourceUrl: ((__VLS_ctx.sidePreview.sourceUrl)), sourceText: ((__VLS_ctx.sidePreview.sourceText)), extension: ((__VLS_ctx.sidePreview.extension)), loading: ((__VLS_ctx.sidePreview.loading)), error: ((__VLS_ctx.sidePreview.error)), }));
                        __VLS_directiveFunction(__VLS_ctx.vShow)((__VLS_ctx.sidePreview.visible && __VLS_ctx.activeRightDockTab === 'preview'));
                        let __VLS_111 = { 'close': __VLS_pickEvent(__VLS_110['close'], {}.onClose) };
                        __VLS_111 = { close: (__VLS_ctx.closeSidePreview) };
                        const __VLS_109 = __VLS_pickFunctionalComponentCtx(__VLS_106, __VLS_108);
                        let __VLS_110;
                    }
                    {
                        const __VLS_112 = {}.ClowderConversationPanel;
                        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showClowderPanel)), channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                        ({}.ClowderConversationPanel);
                        const __VLS_114 = __VLS_113({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showClowderPanel)), channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }, ...__VLS_functionalComponentArgsRest(__VLS_113));
                        ({}({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showClowderPanel)), channelId: ((__VLS_ctx.channelId)), channelType: ((__VLS_ctx.channelType)), }));
                        __VLS_directiveFunction(__VLS_ctx.vShow)((__VLS_ctx.showClowderPanel && __VLS_ctx.activeRightDockTab === 'clowder'));
                        let __VLS_117 = { 'close': __VLS_pickEvent(__VLS_116['close'], {}.onClose) };
                        __VLS_117 = { close: (__VLS_ctx.closeClowderPanel) };
                        const __VLS_115 = __VLS_pickFunctionalComponentCtx(__VLS_112, __VLS_114);
                        let __VLS_116;
                    }
                    (__VLS_104.slots).default;
                    const __VLS_104 = __VLS_pickFunctionalComponentCtx(__VLS_101, __VLS_103);
                }
                (__VLS_82.slots).default;
                const __VLS_82 = __VLS_pickFunctionalComponentCtx(__VLS_79, __VLS_81);
            }
            // @ts-ignore
            [sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, sidePreview, activeRightDockTab, closeSidePreview, showClowderPanel, channelId, channelType, showClowderPanel, channelId, channelType, showClowderPanel, channelId, channelType, showClowderPanel, activeRightDockTab, closeClowderPanel,];
        }
        if (__VLS_ctx.channelType === 2) {
            {
                const __VLS_118 = {}.GroupSettingsDrawer;
                const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }));
                ({}.GroupSettingsDrawer);
                const __VLS_120 = __VLS_119({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }, ...__VLS_functionalComponentArgsRest(__VLS_119));
                ({}({ ...{ 'onClose': {}, 'onMembersClick': {}, }, groupNo: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showGroupSettings)), }));
                let __VLS_123 = { 'close': __VLS_pickEvent(__VLS_122['close'], {}.onClose) };
                __VLS_123 = { close: $event => {
                        if (!((__VLS_ctx.channelType === 2)))
                            return;
                        __VLS_ctx.showGroupSettings = false;
                        // @ts-ignore
                        [channelType, channelId, showGroupSettings, channelId, showGroupSettings, channelId, showGroupSettings, showGroupSettings,];
                    }
                };
                let __VLS_124 = { 'members-click': __VLS_pickEvent(__VLS_122['members-click'], {}.onMembersClick) };
                __VLS_124 = { "members-click": (__VLS_ctx.handleMembersClick) };
                const __VLS_121 = __VLS_pickFunctionalComponentCtx(__VLS_118, __VLS_120);
                let __VLS_122;
            }
            // @ts-ignore
            [handleMembersClick,];
        }
        if (__VLS_ctx.channelType === 1) {
            {
                const __VLS_125 = {}.UserProfileDrawer;
                const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }));
                ({}.UserProfileDrawer);
                const __VLS_127 = __VLS_126({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }, ...__VLS_functionalComponentArgsRest(__VLS_126));
                ({}({ ...{ 'onClose': {}, }, uid: ((__VLS_ctx.channelId)), visible: ((__VLS_ctx.showUserProfile)), }));
                let __VLS_130 = { 'close': __VLS_pickEvent(__VLS_129['close'], {}.onClose) };
                __VLS_130 = { close: $event => {
                        if (!((__VLS_ctx.channelType === 1)))
                            return;
                        __VLS_ctx.showUserProfile = false;
                        // @ts-ignore
                        [channelType, channelId, showUserProfile, channelId, showUserProfile, channelId, showUserProfile, showUserProfile,];
                    }
                };
                const __VLS_128 = __VLS_pickFunctionalComponentCtx(__VLS_125, __VLS_127);
                let __VLS_129;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["chat-view-container"];
        __VLS_styleScopedClasses["chat-main-column"];
        __VLS_styleScopedClasses["chat-header"];
        __VLS_styleScopedClasses["header-left"];
        __VLS_styleScopedClasses["channel-name"];
        __VLS_styleScopedClasses["typing-indicator"];
        __VLS_styleScopedClasses["status-indicator"];
        __VLS_styleScopedClasses["header-right"];
        __VLS_styleScopedClasses["settings-btn"];
        __VLS_styleScopedClasses["settings-btn"];
        __VLS_styleScopedClasses["settings-icon"];
        __VLS_styleScopedClasses["right-dock"];
        __VLS_styleScopedClasses["right-dock-resizer"];
        __VLS_styleScopedClasses["right-dock-tabs"];
        __VLS_styleScopedClasses["dock-tab"];
        __VLS_styleScopedClasses["right-dock-body"];
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
            ChatSidePreview: ChatSidePreview,
            ClowderConversationPanel: ClowderConversationPanel,
            UserProfileDrawer: UserProfileDrawer,
            showGroupSettings: showGroupSettings,
            showUserProfile: showUserProfile,
            showClowderPanel: showClowderPanel,
            activeRightDockTab: activeRightDockTab,
            rightDockWidth: rightDockWidth,
            sidePreview: sidePreview,
            channelId: channelId,
            channelType: channelType,
            channelInfo: channelInfo,
            isTyping: isTyping,
            rightDockVisible: rightDockVisible,
            rightDockTabs: rightDockTabs,
            handleHeaderClick: handleHeaderClick,
            handleGroupSettingsClick: handleGroupSettingsClick,
            handleClowderClick: handleClowderClick,
            handleMembersClick: handleMembersClick,
            selectRightDockTab: selectRightDockTab,
            closeSidePreview: closeSidePreview,
            closeClowderPanel: closeClowderPanel,
            handleOpenPreview: handleOpenPreview,
            startRightDockResize: startRightDockResize,
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

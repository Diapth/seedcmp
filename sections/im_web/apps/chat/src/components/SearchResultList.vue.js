/* __placeholder__ */
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { commonApi, useGroupStore, useMessageStore, useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['select']);
const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();
const messageStore = useMessageStore();
const userStore = useUserStore();
const remoteResults = ref([]);
const remoteSearchState = ref('idle');
const viteEnv = import.meta.env || {};
const enableRemoteSearch = viteEnv.VITE_ENABLE_REMOTE_GLOBAL_SEARCH === 'true';
const searchQuery = computed(() => props.query.trim().toLowerCase());
watch(searchQuery, async (query) => {
    remoteResults.value = [];
    if (!query)
        return;
    if (!enableRemoteSearch) {
        remoteSearchState.value = 'idle';
        return;
    }
    remoteSearchState.value = 'loading';
    try {
        const res = await commonApi.globalSearch({
            keyword: query,
            limit: 20,
            categories: ['user', 'group', 'message']
        });
        remoteResults.value = Array.isArray(res) ? res : (res?.items || res?.list || []);
        remoteSearchState.value = 'idle';
    }
    catch (err) {
        if (viteEnv.DEV) {
            console.info('[SearchResultList] Remote global search unavailable, using local results only.', err);
        }
        remoteSearchState.value = 'failed';
    }
}, { immediate: true });
// Filter Contacts
const filteredContacts = computed(() => {
    if (!searchQuery.value)
        return [];
    return contactStore.contacts.filter(c => (c.name || '').toLowerCase().includes(searchQuery.value) ||
        (c.uid || '').toLowerCase().includes(searchQuery.value)).concat(remoteResults.value
        .filter(item => ['user', 'person', 'contact'].includes(String(item.category || item.type || '').toLowerCase()))
        .map(item => ({
        uid: item.targetId || item.uid || item.id,
        name: item.title || item.name || item.uid,
        avatar: item.avatar || ''
    }))).filter((item, index, list) => item.uid && list.findIndex(next => next.uid === item.uid) === index);
});
// Filter Groups
const filteredGroups = computed(() => {
    if (!searchQuery.value)
        return [];
    // Standard groups
    const groupsList = Object.values(groupStore.groups) || [];
    return groupsList.filter(g => (g.name || '').toLowerCase().includes(searchQuery.value) ||
        (g.group_id || '').toLowerCase().includes(searchQuery.value)).concat(remoteResults.value
        .filter(item => String(item.category || item.type || '').toLowerCase() === 'group')
        .map(item => ({
        group_id: item.targetId || item.group_id || item.id,
        name: item.title || item.name || item.group_id,
        avatar: item.avatar || ''
    }))).filter((item, index, list) => item.group_id && list.findIndex(next => next.group_id === item.group_id) === index);
});
// Filter Messages (Chat History)
const filteredMessages = computed(() => {
    if (!searchQuery.value)
        return [];
    const results = [];
    Object.entries(messageStore.messages).forEach(([channelKey, msgList]) => {
        const parts = channelKey.split('-');
        const channelId = parts[0];
        const channelType = parseInt(parts[1] || '1');
        msgList.forEach(m => {
            if (m.content?.type === 1 && (m.content?.text || '').toLowerCase().includes(searchQuery.value)) {
                results.push({
                    message: m,
                    channelId,
                    channelType,
                    senderName: userStore.userCache[m.fromUID]?.name || m.fromUID
                });
            }
        });
    });
    const remoteMessages = remoteResults.value
        .filter(item => String(item.category || item.type || '').toLowerCase() === 'message')
        .map(item => ({
        message: {
            messageID: item.id || item.message_id,
            clientMsgNo: item.client_msg_no,
            timestamp: item.timestamp || Date.now() / 1000,
            content: { text: item.context || item.subtitle || item.title }
        },
        channelId: item.channel_id || item.channelId || item.targetId,
        channelType: Number(item.channel_type || item.channelType || 1),
        senderName: item.senderName || item.sender_name || item.title || '聊天记录'
    }));
    return results.concat(remoteMessages).slice(0, 10);
});
const hasResults = computed(() => {
    return filteredContacts.value.length > 0 ||
        filteredGroups.value.length > 0 ||
        filteredMessages.value.length > 0;
});
function handleOpenChat(channelId, channelType) {
    router.push(`/chat/conversation/${channelId}/${channelType}`);
    emit('select');
}
function handleOpenUser(uid) {
    router.push(`/chat/conversation/${uid}/1`);
    emit('select');
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
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar, ChannelAvatar,];
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
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("search-result-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("search-result-list"), }));
        if (!__VLS_ctx.hasResults) {
            {
                const __VLS_5 = __VLS_intrinsicElements["div"];
                const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
                const __VLS_7 = __VLS_6({ ...{}, class: ("search-empty"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                ({}({ ...{}, class: ("search-empty"), }));
                {
                    const __VLS_10 = __VLS_intrinsicElements["svg"];
                    const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                    const __VLS_12 = __VLS_11({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("empty-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("empty-icon"), }));
                    {
                        const __VLS_15 = __VLS_intrinsicElements["circle"];
                        const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                        const __VLS_17 = __VLS_16({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                        ({}({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }));
                        const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                    }
                    {
                        const __VLS_20 = __VLS_intrinsicElements["line"];
                        const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                        const __VLS_22 = __VLS_21({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                        ({}({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }));
                        const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                    }
                    (__VLS_13.slots).default;
                    const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                }
                {
                    const __VLS_25 = __VLS_intrinsicElements["p"];
                    const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                    const __VLS_27 = __VLS_26({ ...{}, class: ("empty-text"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                    ({}({ ...{}, class: ("empty-text"), }));
                    (__VLS_28.slots).default;
                    const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                }
                (__VLS_8.slots).default;
                const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            }
            // @ts-ignore
            [hasResults,];
        }
        else {
            {
                const __VLS_30 = __VLS_intrinsicElements["div"];
                const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                const __VLS_32 = __VLS_31({ ...{}, class: ("results-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                ({}({ ...{}, class: ("results-container"), }));
                if (__VLS_ctx.filteredContacts.length > 0) {
                    {
                        const __VLS_35 = __VLS_intrinsicElements["div"];
                        const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                        const __VLS_37 = __VLS_36({ ...{}, class: ("result-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                        ({}({ ...{}, class: ("result-section"), }));
                        {
                            const __VLS_40 = __VLS_intrinsicElements["h4"];
                            const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                            const __VLS_42 = __VLS_41({ ...{}, class: ("section-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                            ({}({ ...{}, class: ("section-title"), }));
                            (__VLS_43.slots).default;
                            const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                        }
                        {
                            const __VLS_45 = __VLS_intrinsicElements["div"];
                            const __VLS_46 = __VLS_elementAsFunctionalComponent(__VLS_45);
                            const __VLS_47 = __VLS_46({ ...{}, class: ("section-items"), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                            ({}({ ...{}, class: ("section-items"), }));
                            for (const [c] of __VLS_getVForSourceType((__VLS_ctx.filteredContacts))) {
                                {
                                    const __VLS_50 = __VLS_intrinsicElements["div"];
                                    const __VLS_51 = __VLS_elementAsFunctionalComponent(__VLS_50);
                                    const __VLS_52 = __VLS_51({ ...{ 'onClick': {}, }, key: ((c.uid)), class: ("result-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                                    ({}({ ...{ 'onClick': {}, }, key: ((c.uid)), class: ("result-item"), }));
                                    let __VLS_55 = { 'click': __VLS_pickEvent(__VLS_54['click'], {}.onClick) };
                                    __VLS_55 = { click: $event => {
                                            if (!(!((!__VLS_ctx.hasResults))))
                                                return;
                                            if (!((__VLS_ctx.filteredContacts.length > 0)))
                                                return;
                                            __VLS_ctx.handleOpenUser(c.uid);
                                            // @ts-ignore
                                            [filteredContacts, filteredContacts, handleOpenUser,];
                                        }
                                    };
                                    {
                                        const __VLS_56 = {}.ChannelAvatar;
                                        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({ ...{}, avatar: ((c.avatar)), name: ((c.name)), size: ((34)), }));
                                        ({}.ChannelAvatar);
                                        const __VLS_58 = __VLS_57({ ...{}, avatar: ((c.avatar)), name: ((c.name)), size: ((34)), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                                        ({}({ ...{}, avatar: ((c.avatar)), name: ((c.name)), size: ((34)), }));
                                        const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                                    }
                                    {
                                        const __VLS_61 = __VLS_intrinsicElements["div"];
                                        const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                                        const __VLS_63 = __VLS_62({ ...{}, class: ("item-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                                        ({}({ ...{}, class: ("item-info"), }));
                                        {
                                            const __VLS_66 = __VLS_intrinsicElements["span"];
                                            const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                                            const __VLS_68 = __VLS_67({ ...{}, class: ("item-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                                            ({}({ ...{}, class: ("item-name"), }));
                                            (c.name);
                                            (__VLS_69.slots).default;
                                            const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                                        }
                                        {
                                            const __VLS_71 = __VLS_intrinsicElements["span"];
                                            const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                                            const __VLS_73 = __VLS_72({ ...{}, class: ("item-sub"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                                            ({}({ ...{}, class: ("item-sub"), }));
                                            (c.uid);
                                            (__VLS_74.slots).default;
                                            const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                                        }
                                        (__VLS_64.slots).default;
                                        const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                                    }
                                    (__VLS_53.slots).default;
                                    const __VLS_53 = __VLS_pickFunctionalComponentCtx(__VLS_50, __VLS_52);
                                    let __VLS_54;
                                }
                            }
                            (__VLS_48.slots).default;
                            const __VLS_48 = __VLS_pickFunctionalComponentCtx(__VLS_45, __VLS_47);
                        }
                        (__VLS_38.slots).default;
                        const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                    }
                }
                if (__VLS_ctx.filteredGroups.length > 0) {
                    {
                        const __VLS_76 = __VLS_intrinsicElements["div"];
                        const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                        const __VLS_78 = __VLS_77({ ...{}, class: ("result-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                        ({}({ ...{}, class: ("result-section"), }));
                        {
                            const __VLS_81 = __VLS_intrinsicElements["h4"];
                            const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                            const __VLS_83 = __VLS_82({ ...{}, class: ("section-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                            ({}({ ...{}, class: ("section-title"), }));
                            (__VLS_84.slots).default;
                            const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                        }
                        {
                            const __VLS_86 = __VLS_intrinsicElements["div"];
                            const __VLS_87 = __VLS_elementAsFunctionalComponent(__VLS_86);
                            const __VLS_88 = __VLS_87({ ...{}, class: ("section-items"), }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                            ({}({ ...{}, class: ("section-items"), }));
                            for (const [g] of __VLS_getVForSourceType((__VLS_ctx.filteredGroups))) {
                                {
                                    const __VLS_91 = __VLS_intrinsicElements["div"];
                                    const __VLS_92 = __VLS_elementAsFunctionalComponent(__VLS_91);
                                    const __VLS_93 = __VLS_92({ ...{ 'onClick': {}, }, key: ((g.group_id)), class: ("result-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_92));
                                    ({}({ ...{ 'onClick': {}, }, key: ((g.group_id)), class: ("result-item"), }));
                                    let __VLS_96 = { 'click': __VLS_pickEvent(__VLS_95['click'], {}.onClick) };
                                    __VLS_96 = { click: $event => {
                                            if (!(!((!__VLS_ctx.hasResults))))
                                                return;
                                            if (!((__VLS_ctx.filteredGroups.length > 0)))
                                                return;
                                            __VLS_ctx.handleOpenChat(g.group_id, 2);
                                            // @ts-ignore
                                            [filteredGroups, filteredGroups, handleOpenChat,];
                                        }
                                    };
                                    {
                                        const __VLS_97 = {}.ChannelAvatar;
                                        const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({ ...{}, avatar: ((g.avatar)), name: ((g.name)), size: ((34)), }));
                                        ({}.ChannelAvatar);
                                        const __VLS_99 = __VLS_98({ ...{}, avatar: ((g.avatar)), name: ((g.name)), size: ((34)), }, ...__VLS_functionalComponentArgsRest(__VLS_98));
                                        ({}({ ...{}, avatar: ((g.avatar)), name: ((g.name)), size: ((34)), }));
                                        const __VLS_100 = __VLS_pickFunctionalComponentCtx(__VLS_97, __VLS_99);
                                    }
                                    {
                                        const __VLS_102 = __VLS_intrinsicElements["div"];
                                        const __VLS_103 = __VLS_elementAsFunctionalComponent(__VLS_102);
                                        const __VLS_104 = __VLS_103({ ...{}, class: ("item-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_103));
                                        ({}({ ...{}, class: ("item-info"), }));
                                        {
                                            const __VLS_107 = __VLS_intrinsicElements["span"];
                                            const __VLS_108 = __VLS_elementAsFunctionalComponent(__VLS_107);
                                            const __VLS_109 = __VLS_108({ ...{}, class: ("item-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_108));
                                            ({}({ ...{}, class: ("item-name"), }));
                                            (g.name);
                                            (__VLS_110.slots).default;
                                            const __VLS_110 = __VLS_pickFunctionalComponentCtx(__VLS_107, __VLS_109);
                                        }
                                        {
                                            const __VLS_112 = __VLS_intrinsicElements["span"];
                                            const __VLS_113 = __VLS_elementAsFunctionalComponent(__VLS_112);
                                            const __VLS_114 = __VLS_113({ ...{}, class: ("item-sub"), }, ...__VLS_functionalComponentArgsRest(__VLS_113));
                                            ({}({ ...{}, class: ("item-sub"), }));
                                            (g.group_id);
                                            (__VLS_115.slots).default;
                                            const __VLS_115 = __VLS_pickFunctionalComponentCtx(__VLS_112, __VLS_114);
                                        }
                                        (__VLS_105.slots).default;
                                        const __VLS_105 = __VLS_pickFunctionalComponentCtx(__VLS_102, __VLS_104);
                                    }
                                    (__VLS_94.slots).default;
                                    const __VLS_94 = __VLS_pickFunctionalComponentCtx(__VLS_91, __VLS_93);
                                    let __VLS_95;
                                }
                            }
                            (__VLS_89.slots).default;
                            const __VLS_89 = __VLS_pickFunctionalComponentCtx(__VLS_86, __VLS_88);
                        }
                        (__VLS_79.slots).default;
                        const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                    }
                }
                if (__VLS_ctx.filteredMessages.length > 0) {
                    {
                        const __VLS_117 = __VLS_intrinsicElements["div"];
                        const __VLS_118 = __VLS_elementAsFunctionalComponent(__VLS_117);
                        const __VLS_119 = __VLS_118({ ...{}, class: ("result-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_118));
                        ({}({ ...{}, class: ("result-section"), }));
                        {
                            const __VLS_122 = __VLS_intrinsicElements["h4"];
                            const __VLS_123 = __VLS_elementAsFunctionalComponent(__VLS_122);
                            const __VLS_124 = __VLS_123({ ...{}, class: ("section-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_123));
                            ({}({ ...{}, class: ("section-title"), }));
                            (__VLS_125.slots).default;
                            const __VLS_125 = __VLS_pickFunctionalComponentCtx(__VLS_122, __VLS_124);
                        }
                        {
                            const __VLS_127 = __VLS_intrinsicElements["div"];
                            const __VLS_128 = __VLS_elementAsFunctionalComponent(__VLS_127);
                            const __VLS_129 = __VLS_128({ ...{}, class: ("section-items"), }, ...__VLS_functionalComponentArgsRest(__VLS_128));
                            ({}({ ...{}, class: ("section-items"), }));
                            for (const [m] of __VLS_getVForSourceType((__VLS_ctx.filteredMessages))) {
                                {
                                    const __VLS_132 = __VLS_intrinsicElements["div"];
                                    const __VLS_133 = __VLS_elementAsFunctionalComponent(__VLS_132);
                                    const __VLS_134 = __VLS_133({ ...{ 'onClick': {}, }, key: ((m.message?.messageID || m.message?.clientMsgNo)), class: ("result-item text-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_133));
                                    ({}({ ...{ 'onClick': {}, }, key: ((m.message?.messageID || m.message?.clientMsgNo)), class: ("result-item text-item"), }));
                                    let __VLS_137 = { 'click': __VLS_pickEvent(__VLS_136['click'], {}.onClick) };
                                    __VLS_137 = { click: $event => {
                                            if (!(!((!__VLS_ctx.hasResults))))
                                                return;
                                            if (!((__VLS_ctx.filteredMessages.length > 0)))
                                                return;
                                            __VLS_ctx.handleOpenChat(m.channelId, m.channelType);
                                            // @ts-ignore
                                            [filteredMessages, filteredMessages, handleOpenChat,];
                                        }
                                    };
                                    {
                                        const __VLS_138 = __VLS_intrinsicElements["div"];
                                        const __VLS_139 = __VLS_elementAsFunctionalComponent(__VLS_138);
                                        const __VLS_140 = __VLS_139({ ...{}, class: ("item-info full-width"), }, ...__VLS_functionalComponentArgsRest(__VLS_139));
                                        ({}({ ...{}, class: ("item-info full-width"), }));
                                        {
                                            const __VLS_143 = __VLS_intrinsicElements["div"];
                                            const __VLS_144 = __VLS_elementAsFunctionalComponent(__VLS_143);
                                            const __VLS_145 = __VLS_144({ ...{}, class: ("msg-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_144));
                                            ({}({ ...{}, class: ("msg-header"), }));
                                            {
                                                const __VLS_148 = __VLS_intrinsicElements["span"];
                                                const __VLS_149 = __VLS_elementAsFunctionalComponent(__VLS_148);
                                                const __VLS_150 = __VLS_149({ ...{}, class: ("sender-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                                                ({}({ ...{}, class: ("sender-name"), }));
                                                (m.senderName);
                                                (__VLS_151.slots).default;
                                                const __VLS_151 = __VLS_pickFunctionalComponentCtx(__VLS_148, __VLS_150);
                                            }
                                            {
                                                const __VLS_153 = __VLS_intrinsicElements["span"];
                                                const __VLS_154 = __VLS_elementAsFunctionalComponent(__VLS_153);
                                                const __VLS_155 = __VLS_154({ ...{}, class: ("msg-time"), }, ...__VLS_functionalComponentArgsRest(__VLS_154));
                                                ({}({ ...{}, class: ("msg-time"), }));
                                                (new Date((m.message?.timestamp || 0) * 1000).toLocaleDateString());
                                                (__VLS_156.slots).default;
                                                const __VLS_156 = __VLS_pickFunctionalComponentCtx(__VLS_153, __VLS_155);
                                            }
                                            (__VLS_146.slots).default;
                                            const __VLS_146 = __VLS_pickFunctionalComponentCtx(__VLS_143, __VLS_145);
                                        }
                                        {
                                            const __VLS_158 = __VLS_intrinsicElements["p"];
                                            const __VLS_159 = __VLS_elementAsFunctionalComponent(__VLS_158);
                                            const __VLS_160 = __VLS_159({ ...{}, class: ("msg-preview"), }, ...__VLS_functionalComponentArgsRest(__VLS_159));
                                            ({}({ ...{}, class: ("msg-preview"), }));
                                            (m.message?.content?.text);
                                            (__VLS_161.slots).default;
                                            const __VLS_161 = __VLS_pickFunctionalComponentCtx(__VLS_158, __VLS_160);
                                        }
                                        (__VLS_141.slots).default;
                                        const __VLS_141 = __VLS_pickFunctionalComponentCtx(__VLS_138, __VLS_140);
                                    }
                                    (__VLS_135.slots).default;
                                    const __VLS_135 = __VLS_pickFunctionalComponentCtx(__VLS_132, __VLS_134);
                                    let __VLS_136;
                                }
                            }
                            (__VLS_130.slots).default;
                            const __VLS_130 = __VLS_pickFunctionalComponentCtx(__VLS_127, __VLS_129);
                        }
                        (__VLS_120.slots).default;
                        const __VLS_120 = __VLS_pickFunctionalComponentCtx(__VLS_117, __VLS_119);
                    }
                }
                (__VLS_33.slots).default;
                const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["search-result-list"];
        __VLS_styleScopedClasses["search-empty"];
        __VLS_styleScopedClasses["empty-icon"];
        __VLS_styleScopedClasses["empty-text"];
        __VLS_styleScopedClasses["results-container"];
        __VLS_styleScopedClasses["result-section"];
        __VLS_styleScopedClasses["section-title"];
        __VLS_styleScopedClasses["section-items"];
        __VLS_styleScopedClasses["result-item"];
        __VLS_styleScopedClasses["item-info"];
        __VLS_styleScopedClasses["item-name"];
        __VLS_styleScopedClasses["item-sub"];
        __VLS_styleScopedClasses["result-section"];
        __VLS_styleScopedClasses["section-title"];
        __VLS_styleScopedClasses["section-items"];
        __VLS_styleScopedClasses["result-item"];
        __VLS_styleScopedClasses["item-info"];
        __VLS_styleScopedClasses["item-name"];
        __VLS_styleScopedClasses["item-sub"];
        __VLS_styleScopedClasses["result-section"];
        __VLS_styleScopedClasses["section-title"];
        __VLS_styleScopedClasses["section-items"];
        __VLS_styleScopedClasses["result-item"];
        __VLS_styleScopedClasses["text-item"];
        __VLS_styleScopedClasses["item-info"];
        __VLS_styleScopedClasses["full-width"];
        __VLS_styleScopedClasses["msg-header"];
        __VLS_styleScopedClasses["sender-name"];
        __VLS_styleScopedClasses["msg-time"];
        __VLS_styleScopedClasses["msg-preview"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            filteredContacts: filteredContacts,
            filteredGroups: filteredGroups,
            filteredMessages: filteredMessages,
            hasResults: hasResults,
            handleOpenChat: handleOpenChat,
            handleOpenUser: handleOpenUser,
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

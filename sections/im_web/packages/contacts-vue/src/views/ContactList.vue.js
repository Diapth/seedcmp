/* __placeholder__ */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '../stores/contactStore';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();
onMounted(() => {
    contactStore.syncContacts();
    contactStore.refreshFriendRequestUnreadCount();
    groupStore.fetchMyGroups();
});
function handleContactClick(uid) {
    router.push(`/chat/conversation/${uid}/1`);
}
function handleAddFriend() {
    router.push('/chat/add-friend');
}
function handleGroupClick(groupNo) {
    router.push(`/chat/conversation/${groupNo}/2`);
}
function handleFriendRequests() {
    router.push('/chat/friend-requests');
}
function scrollToGroupList() {
    const el = document.getElementById('saved-groups-section');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
function scrollToLetter(letter) {
    const el = document.getElementById(`letter-${letter}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
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
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar, ChannelAvatar,];
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("contact-list-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("contact-list-container"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("quick-actions"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("quick-actions"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{ 'onClick': {}, }, class: ("action-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{ 'onClick': {}, }, class: ("action-item"), }));
                let __VLS_15 = { 'click': __VLS_pickEvent(__VLS_14['click'], {}.onClick) };
                __VLS_15 = { click: (__VLS_ctx.handleFriendRequests) };
                {
                    const __VLS_16 = __VLS_intrinsicElements["div"];
                    const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                    const __VLS_18 = __VLS_17({ ...{}, class: ("action-icon requests-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                    ({}({ ...{}, class: ("action-icon requests-icon"), }));
                    {
                        const __VLS_21 = __VLS_intrinsicElements["svg"];
                        const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                        const __VLS_23 = __VLS_22({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }));
                        {
                            const __VLS_26 = __VLS_intrinsicElements["path"];
                            const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                            const __VLS_28 = __VLS_27({ ...{}, d: ("M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                            ({}({ ...{}, d: ("M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }));
                            const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                        }
                        {
                            const __VLS_31 = __VLS_intrinsicElements["circle"];
                            const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                            const __VLS_33 = __VLS_32({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                            ({}({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }));
                            const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                        }
                        {
                            const __VLS_36 = __VLS_intrinsicElements["line"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, x1: ("19"), y1: ("8"), x2: ("19"), y2: ("14"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, x1: ("19"), y1: ("8"), x2: ("19"), y2: ("14"), }));
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        }
                        {
                            const __VLS_41 = __VLS_intrinsicElements["line"];
                            const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                            const __VLS_43 = __VLS_42({ ...{}, x1: ("22"), y1: ("11"), x2: ("16"), y2: ("11"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                            ({}({ ...{}, x1: ("22"), y1: ("11"), x2: ("16"), y2: ("11"), }));
                            const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                        }
                        (__VLS_24.slots).default;
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    (__VLS_19.slots).default;
                    const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                }
                {
                    const __VLS_46 = __VLS_intrinsicElements["div"];
                    const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                    const __VLS_48 = __VLS_47({ ...{}, class: ("action-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                    ({}({ ...{}, class: ("action-label"), }));
                    (__VLS_49.slots).default;
                    const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                }
                if (__VLS_ctx.contactStore.friendRequestUnreadCount > 0) {
                    {
                        const __VLS_51 = __VLS_intrinsicElements["span"];
                        const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                        const __VLS_53 = __VLS_52({ ...{}, class: ("action-badge"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                        ({}({ ...{}, class: ("action-badge"), }));
                        (__VLS_ctx.contactStore.friendRequestUnreadCount > 99 ? '99+' : __VLS_ctx.contactStore.friendRequestUnreadCount);
                        (__VLS_54.slots).default;
                        const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                    }
                    // @ts-ignore
                    [handleFriendRequests, contactStore, contactStore, contactStore,];
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                let __VLS_14;
            }
            {
                const __VLS_56 = __VLS_intrinsicElements["div"];
                const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                const __VLS_58 = __VLS_57({ ...{ 'onClick': {}, }, class: ("action-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                ({}({ ...{ 'onClick': {}, }, class: ("action-item"), }));
                let __VLS_61 = { 'click': __VLS_pickEvent(__VLS_60['click'], {}.onClick) };
                __VLS_61 = { click: (__VLS_ctx.handleAddFriend) };
                {
                    const __VLS_62 = __VLS_intrinsicElements["div"];
                    const __VLS_63 = __VLS_elementAsFunctionalComponent(__VLS_62);
                    const __VLS_64 = __VLS_63({ ...{}, class: ("action-icon add-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                    ({}({ ...{}, class: ("action-icon add-icon"), }));
                    {
                        const __VLS_67 = __VLS_intrinsicElements["svg"];
                        const __VLS_68 = __VLS_elementAsFunctionalComponent(__VLS_67);
                        const __VLS_69 = __VLS_68({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }));
                        {
                            const __VLS_72 = __VLS_intrinsicElements["circle"];
                            const __VLS_73 = __VLS_elementAsFunctionalComponent(__VLS_72);
                            const __VLS_74 = __VLS_73({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }, ...__VLS_functionalComponentArgsRest(__VLS_73));
                            ({}({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }));
                            const __VLS_75 = __VLS_pickFunctionalComponentCtx(__VLS_72, __VLS_74);
                        }
                        {
                            const __VLS_77 = __VLS_intrinsicElements["line"];
                            const __VLS_78 = __VLS_elementAsFunctionalComponent(__VLS_77);
                            const __VLS_79 = __VLS_78({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                            ({}({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }));
                            const __VLS_80 = __VLS_pickFunctionalComponentCtx(__VLS_77, __VLS_79);
                        }
                        {
                            const __VLS_82 = __VLS_intrinsicElements["line"];
                            const __VLS_83 = __VLS_elementAsFunctionalComponent(__VLS_82);
                            const __VLS_84 = __VLS_83({ ...{}, x1: ("11"), y1: ("8"), x2: ("11"), y2: ("14"), }, ...__VLS_functionalComponentArgsRest(__VLS_83));
                            ({}({ ...{}, x1: ("11"), y1: ("8"), x2: ("11"), y2: ("14"), }));
                            const __VLS_85 = __VLS_pickFunctionalComponentCtx(__VLS_82, __VLS_84);
                        }
                        {
                            const __VLS_87 = __VLS_intrinsicElements["line"];
                            const __VLS_88 = __VLS_elementAsFunctionalComponent(__VLS_87);
                            const __VLS_89 = __VLS_88({ ...{}, x1: ("8"), y1: ("11"), x2: ("14"), y2: ("11"), }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                            ({}({ ...{}, x1: ("8"), y1: ("11"), x2: ("14"), y2: ("11"), }));
                            const __VLS_90 = __VLS_pickFunctionalComponentCtx(__VLS_87, __VLS_89);
                        }
                        (__VLS_70.slots).default;
                        const __VLS_70 = __VLS_pickFunctionalComponentCtx(__VLS_67, __VLS_69);
                    }
                    (__VLS_65.slots).default;
                    const __VLS_65 = __VLS_pickFunctionalComponentCtx(__VLS_62, __VLS_64);
                }
                {
                    const __VLS_92 = __VLS_intrinsicElements["div"];
                    const __VLS_93 = __VLS_elementAsFunctionalComponent(__VLS_92);
                    const __VLS_94 = __VLS_93({ ...{}, class: ("action-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                    ({}({ ...{}, class: ("action-label"), }));
                    (__VLS_95.slots).default;
                    const __VLS_95 = __VLS_pickFunctionalComponentCtx(__VLS_92, __VLS_94);
                }
                (__VLS_59.slots).default;
                const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                let __VLS_60;
            }
            {
                const __VLS_97 = __VLS_intrinsicElements["div"];
                const __VLS_98 = __VLS_elementAsFunctionalComponent(__VLS_97);
                const __VLS_99 = __VLS_98({ ...{ 'onClick': {}, }, class: ("action-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_98));
                ({}({ ...{ 'onClick': {}, }, class: ("action-item"), }));
                let __VLS_102 = { 'click': __VLS_pickEvent(__VLS_101['click'], {}.onClick) };
                __VLS_102 = { click: (__VLS_ctx.scrollToGroupList) };
                {
                    const __VLS_103 = __VLS_intrinsicElements["div"];
                    const __VLS_104 = __VLS_elementAsFunctionalComponent(__VLS_103);
                    const __VLS_105 = __VLS_104({ ...{}, class: ("action-icon group-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                    ({}({ ...{}, class: ("action-icon group-icon"), }));
                    {
                        const __VLS_108 = __VLS_intrinsicElements["svg"];
                        const __VLS_109 = __VLS_elementAsFunctionalComponent(__VLS_108);
                        const __VLS_110 = __VLS_109({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_109));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("svg-icon"), }));
                        {
                            const __VLS_113 = __VLS_intrinsicElements["path"];
                            const __VLS_114 = __VLS_elementAsFunctionalComponent(__VLS_113);
                            const __VLS_115 = __VLS_114({ ...{}, d: ("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }, ...__VLS_functionalComponentArgsRest(__VLS_114));
                            ({}({ ...{}, d: ("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }));
                            const __VLS_116 = __VLS_pickFunctionalComponentCtx(__VLS_113, __VLS_115);
                        }
                        {
                            const __VLS_118 = __VLS_intrinsicElements["circle"];
                            const __VLS_119 = __VLS_elementAsFunctionalComponent(__VLS_118);
                            const __VLS_120 = __VLS_119({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }, ...__VLS_functionalComponentArgsRest(__VLS_119));
                            ({}({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }));
                            const __VLS_121 = __VLS_pickFunctionalComponentCtx(__VLS_118, __VLS_120);
                        }
                        {
                            const __VLS_123 = __VLS_intrinsicElements["path"];
                            const __VLS_124 = __VLS_elementAsFunctionalComponent(__VLS_123);
                            const __VLS_125 = __VLS_124({ ...{}, d: ("M23 21v-2a4 4 0 0 0-3-3.87"), }, ...__VLS_functionalComponentArgsRest(__VLS_124));
                            ({}({ ...{}, d: ("M23 21v-2a4 4 0 0 0-3-3.87"), }));
                            const __VLS_126 = __VLS_pickFunctionalComponentCtx(__VLS_123, __VLS_125);
                        }
                        {
                            const __VLS_128 = __VLS_intrinsicElements["path"];
                            const __VLS_129 = __VLS_elementAsFunctionalComponent(__VLS_128);
                            const __VLS_130 = __VLS_129({ ...{}, d: ("M16 3.13a4 4 0 0 1 0 7.75"), }, ...__VLS_functionalComponentArgsRest(__VLS_129));
                            ({}({ ...{}, d: ("M16 3.13a4 4 0 0 1 0 7.75"), }));
                            const __VLS_131 = __VLS_pickFunctionalComponentCtx(__VLS_128, __VLS_130);
                        }
                        (__VLS_111.slots).default;
                        const __VLS_111 = __VLS_pickFunctionalComponentCtx(__VLS_108, __VLS_110);
                    }
                    (__VLS_106.slots).default;
                    const __VLS_106 = __VLS_pickFunctionalComponentCtx(__VLS_103, __VLS_105);
                }
                {
                    const __VLS_133 = __VLS_intrinsicElements["div"];
                    const __VLS_134 = __VLS_elementAsFunctionalComponent(__VLS_133);
                    const __VLS_135 = __VLS_134({ ...{}, class: ("action-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_134));
                    ({}({ ...{}, class: ("action-label"), }));
                    (__VLS_136.slots).default;
                    const __VLS_136 = __VLS_pickFunctionalComponentCtx(__VLS_133, __VLS_135);
                }
                if (__VLS_ctx.groupStore.savedGroups.length > 0) {
                    {
                        const __VLS_138 = __VLS_intrinsicElements["span"];
                        const __VLS_139 = __VLS_elementAsFunctionalComponent(__VLS_138);
                        const __VLS_140 = __VLS_139({ ...{}, class: ("action-count"), }, ...__VLS_functionalComponentArgsRest(__VLS_139));
                        ({}({ ...{}, class: ("action-count"), }));
                        (__VLS_ctx.groupStore.savedGroups.length);
                        (__VLS_141.slots).default;
                        const __VLS_141 = __VLS_pickFunctionalComponentCtx(__VLS_138, __VLS_140);
                    }
                    // @ts-ignore
                    [handleAddFriend, scrollToGroupList, groupStore, groupStore,];
                }
                (__VLS_100.slots).default;
                const __VLS_100 = __VLS_pickFunctionalComponentCtx(__VLS_97, __VLS_99);
                let __VLS_101;
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_143 = __VLS_intrinsicElements["div"];
            const __VLS_144 = __VLS_elementAsFunctionalComponent(__VLS_143);
            const __VLS_145 = __VLS_144({ ...{}, class: ("grouped-list-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_144));
            ({}({ ...{}, class: ("grouped-list-wrapper"), }));
            if (__VLS_ctx.groupStore.savedGroups.length > 0) {
                {
                    const __VLS_148 = __VLS_intrinsicElements["div"];
                    const __VLS_149 = __VLS_elementAsFunctionalComponent(__VLS_148);
                    const __VLS_150 = __VLS_149({ ...{}, id: ("saved-groups-section"), class: ("saved-groups-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                    ({}({ ...{}, id: ("saved-groups-section"), class: ("saved-groups-section"), }));
                    {
                        const __VLS_153 = __VLS_intrinsicElements["div"];
                        const __VLS_154 = __VLS_elementAsFunctionalComponent(__VLS_153);
                        const __VLS_155 = __VLS_154({ ...{}, class: ("group-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_154));
                        ({}({ ...{}, class: ("group-title"), }));
                        (__VLS_156.slots).default;
                        const __VLS_156 = __VLS_pickFunctionalComponentCtx(__VLS_153, __VLS_155);
                    }
                    {
                        const __VLS_158 = __VLS_intrinsicElements["div"];
                        const __VLS_159 = __VLS_elementAsFunctionalComponent(__VLS_158);
                        const __VLS_160 = __VLS_159({ ...{}, class: ("group-items"), }, ...__VLS_functionalComponentArgsRest(__VLS_159));
                        ({}({ ...{}, class: ("group-items"), }));
                        for (const [group] of __VLS_getVForSourceType((__VLS_ctx.groupStore.savedGroups))) {
                            {
                                const __VLS_163 = __VLS_intrinsicElements["div"];
                                const __VLS_164 = __VLS_elementAsFunctionalComponent(__VLS_163);
                                const __VLS_165 = __VLS_164({ ...{ 'onClick': {}, }, key: ((group.group_no)), class: ("friend-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_164));
                                ({}({ ...{ 'onClick': {}, }, key: ((group.group_no)), class: ("friend-item"), }));
                                let __VLS_168 = { 'click': __VLS_pickEvent(__VLS_167['click'], {}.onClick) };
                                __VLS_168 = { click: $event => {
                                        if (!((__VLS_ctx.groupStore.savedGroups.length > 0)))
                                            return;
                                        __VLS_ctx.handleGroupClick(group.group_no);
                                        // @ts-ignore
                                        [groupStore, groupStore, handleGroupClick,];
                                    }
                                };
                                {
                                    const __VLS_169 = {}.ChannelAvatar;
                                    const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({ ...{}, avatar: ((group.avatar)), name: ((group.name)), isGroup: ((true)), size: ((36)), }));
                                    ({}.ChannelAvatar);
                                    const __VLS_171 = __VLS_170({ ...{}, avatar: ((group.avatar)), name: ((group.name)), isGroup: ((true)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_170));
                                    ({}({ ...{}, avatar: ((group.avatar)), name: ((group.name)), isGroup: ((true)), size: ((36)), }));
                                    const __VLS_172 = __VLS_pickFunctionalComponentCtx(__VLS_169, __VLS_171);
                                }
                                {
                                    const __VLS_174 = __VLS_intrinsicElements["div"];
                                    const __VLS_175 = __VLS_elementAsFunctionalComponent(__VLS_174);
                                    const __VLS_176 = __VLS_175({ ...{}, class: ("friend-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_175));
                                    ({}({ ...{}, class: ("friend-info"), }));
                                    {
                                        const __VLS_179 = __VLS_intrinsicElements["span"];
                                        const __VLS_180 = __VLS_elementAsFunctionalComponent(__VLS_179);
                                        const __VLS_181 = __VLS_180({ ...{}, class: ("friend-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_180));
                                        ({}({ ...{}, class: ("friend-name"), }));
                                        (group.name);
                                        (__VLS_182.slots).default;
                                        const __VLS_182 = __VLS_pickFunctionalComponentCtx(__VLS_179, __VLS_181);
                                    }
                                    (__VLS_177.slots).default;
                                    const __VLS_177 = __VLS_pickFunctionalComponentCtx(__VLS_174, __VLS_176);
                                }
                                (__VLS_166.slots).default;
                                const __VLS_166 = __VLS_pickFunctionalComponentCtx(__VLS_163, __VLS_165);
                                let __VLS_167;
                            }
                        }
                        (__VLS_161.slots).default;
                        const __VLS_161 = __VLS_pickFunctionalComponentCtx(__VLS_158, __VLS_160);
                    }
                    (__VLS_151.slots).default;
                    const __VLS_151 = __VLS_pickFunctionalComponentCtx(__VLS_148, __VLS_150);
                }
            }
            if (__VLS_ctx.contactStore.groupedContacts.length === 0 && __VLS_ctx.groupStore.savedGroups.length === 0) {
                {
                    const __VLS_184 = __VLS_intrinsicElements["div"];
                    const __VLS_185 = __VLS_elementAsFunctionalComponent(__VLS_184);
                    const __VLS_186 = __VLS_185({ ...{}, class: ("empty-contacts"), }, ...__VLS_functionalComponentArgsRest(__VLS_185));
                    ({}({ ...{}, class: ("empty-contacts"), }));
                    {
                        const __VLS_189 = __VLS_intrinsicElements["p"];
                        const __VLS_190 = __VLS_elementAsFunctionalComponent(__VLS_189);
                        const __VLS_191 = __VLS_190({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_190));
                        ({}({ ...{}, }));
                        (__VLS_192.slots).default;
                        const __VLS_192 = __VLS_pickFunctionalComponentCtx(__VLS_189, __VLS_191);
                    }
                    (__VLS_187.slots).default;
                    const __VLS_187 = __VLS_pickFunctionalComponentCtx(__VLS_184, __VLS_186);
                }
                // @ts-ignore
                [contactStore, groupStore,];
            }
            else {
                {
                    const __VLS_194 = __VLS_intrinsicElements["div"];
                    const __VLS_195 = __VLS_elementAsFunctionalComponent(__VLS_194);
                    const __VLS_196 = __VLS_195({ ...{}, class: ("groups-scroller"), }, ...__VLS_functionalComponentArgsRest(__VLS_195));
                    ({}({ ...{}, class: ("groups-scroller"), }));
                    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.contactStore.groupedContacts))) {
                        {
                            const __VLS_199 = __VLS_intrinsicElements["div"];
                            const __VLS_200 = __VLS_elementAsFunctionalComponent(__VLS_199);
                            const __VLS_201 = __VLS_200({ ...{}, key: ((group.initial)), id: ((`letter-${group.initial}`)), class: ("contact-group"), }, ...__VLS_functionalComponentArgsRest(__VLS_200));
                            ({}({ ...{}, key: ((group.initial)), id: ((`letter-${group.initial}`)), class: ("contact-group"), }));
                            {
                                const __VLS_204 = __VLS_intrinsicElements["div"];
                                const __VLS_205 = __VLS_elementAsFunctionalComponent(__VLS_204);
                                const __VLS_206 = __VLS_205({ ...{}, class: ("group-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_205));
                                ({}({ ...{}, class: ("group-title"), }));
                                (group.initial);
                                (__VLS_207.slots).default;
                                const __VLS_207 = __VLS_pickFunctionalComponentCtx(__VLS_204, __VLS_206);
                            }
                            {
                                const __VLS_209 = __VLS_intrinsicElements["div"];
                                const __VLS_210 = __VLS_elementAsFunctionalComponent(__VLS_209);
                                const __VLS_211 = __VLS_210({ ...{}, class: ("group-items"), }, ...__VLS_functionalComponentArgsRest(__VLS_210));
                                ({}({ ...{}, class: ("group-items"), }));
                                for (const [friend] of __VLS_getVForSourceType((group.list))) {
                                    {
                                        const __VLS_214 = __VLS_intrinsicElements["div"];
                                        const __VLS_215 = __VLS_elementAsFunctionalComponent(__VLS_214);
                                        const __VLS_216 = __VLS_215({ ...{ 'onClick': {}, }, key: ((friend.uid)), class: ("friend-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_215));
                                        ({}({ ...{ 'onClick': {}, }, key: ((friend.uid)), class: ("friend-item"), }));
                                        let __VLS_219 = { 'click': __VLS_pickEvent(__VLS_218['click'], {}.onClick) };
                                        __VLS_219 = { click: $event => {
                                                if (!(!((__VLS_ctx.contactStore.groupedContacts.length === 0 && __VLS_ctx.groupStore.savedGroups.length === 0))))
                                                    return;
                                                __VLS_ctx.handleContactClick(friend.uid);
                                                // @ts-ignore
                                                [contactStore, handleContactClick,];
                                            }
                                        };
                                        {
                                            const __VLS_220 = {}.ChannelAvatar;
                                            const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }));
                                            ({}.ChannelAvatar);
                                            const __VLS_222 = __VLS_221({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_221));
                                            ({}({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }));
                                            const __VLS_223 = __VLS_pickFunctionalComponentCtx(__VLS_220, __VLS_222);
                                        }
                                        {
                                            const __VLS_225 = __VLS_intrinsicElements["div"];
                                            const __VLS_226 = __VLS_elementAsFunctionalComponent(__VLS_225);
                                            const __VLS_227 = __VLS_226({ ...{}, class: ("friend-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_226));
                                            ({}({ ...{}, class: ("friend-info"), }));
                                            {
                                                const __VLS_230 = __VLS_intrinsicElements["span"];
                                                const __VLS_231 = __VLS_elementAsFunctionalComponent(__VLS_230);
                                                const __VLS_232 = __VLS_231({ ...{}, class: ("friend-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_231));
                                                ({}({ ...{}, class: ("friend-name"), }));
                                                (friend.remark || friend.name);
                                                (__VLS_233.slots).default;
                                                const __VLS_233 = __VLS_pickFunctionalComponentCtx(__VLS_230, __VLS_232);
                                            }
                                            if (friend.remark) {
                                                {
                                                    const __VLS_235 = __VLS_intrinsicElements["span"];
                                                    const __VLS_236 = __VLS_elementAsFunctionalComponent(__VLS_235);
                                                    const __VLS_237 = __VLS_236({ ...{}, class: ("friend-alias"), }, ...__VLS_functionalComponentArgsRest(__VLS_236));
                                                    ({}({ ...{}, class: ("friend-alias"), }));
                                                    (friend.name);
                                                    (__VLS_238.slots).default;
                                                    const __VLS_238 = __VLS_pickFunctionalComponentCtx(__VLS_235, __VLS_237);
                                                }
                                            }
                                            (__VLS_228.slots).default;
                                            const __VLS_228 = __VLS_pickFunctionalComponentCtx(__VLS_225, __VLS_227);
                                        }
                                        (__VLS_217.slots).default;
                                        const __VLS_217 = __VLS_pickFunctionalComponentCtx(__VLS_214, __VLS_216);
                                        let __VLS_218;
                                    }
                                }
                                (__VLS_212.slots).default;
                                const __VLS_212 = __VLS_pickFunctionalComponentCtx(__VLS_209, __VLS_211);
                            }
                            (__VLS_202.slots).default;
                            const __VLS_202 = __VLS_pickFunctionalComponentCtx(__VLS_199, __VLS_201);
                        }
                    }
                    (__VLS_197.slots).default;
                    const __VLS_197 = __VLS_pickFunctionalComponentCtx(__VLS_194, __VLS_196);
                }
            }
            (__VLS_146.slots).default;
            const __VLS_146 = __VLS_pickFunctionalComponentCtx(__VLS_143, __VLS_145);
        }
        if (__VLS_ctx.contactStore.groupedContacts.length > 0) {
            {
                const __VLS_240 = __VLS_intrinsicElements["div"];
                const __VLS_241 = __VLS_elementAsFunctionalComponent(__VLS_240);
                const __VLS_242 = __VLS_241({ ...{}, class: ("letter-quick-bar"), }, ...__VLS_functionalComponentArgsRest(__VLS_241));
                ({}({ ...{}, class: ("letter-quick-bar"), }));
                for (const [group] of __VLS_getVForSourceType((__VLS_ctx.contactStore.groupedContacts))) {
                    {
                        const __VLS_245 = __VLS_intrinsicElements["div"];
                        const __VLS_246 = __VLS_elementAsFunctionalComponent(__VLS_245);
                        const __VLS_247 = __VLS_246({ ...{ 'onClick': {}, }, key: (('quick-' + group.initial)), class: ("quick-letter"), }, ...__VLS_functionalComponentArgsRest(__VLS_246));
                        ({}({ ...{ 'onClick': {}, }, key: (('quick-' + group.initial)), class: ("quick-letter"), }));
                        let __VLS_250 = { 'click': __VLS_pickEvent(__VLS_249['click'], {}.onClick) };
                        __VLS_250 = { click: $event => {
                                if (!((__VLS_ctx.contactStore.groupedContacts.length > 0)))
                                    return;
                                __VLS_ctx.scrollToLetter(group.initial);
                                // @ts-ignore
                                [contactStore, contactStore, scrollToLetter,];
                            }
                        };
                        (group.initial);
                        (__VLS_248.slots).default;
                        const __VLS_248 = __VLS_pickFunctionalComponentCtx(__VLS_245, __VLS_247);
                        let __VLS_249;
                    }
                }
                (__VLS_243.slots).default;
                const __VLS_243 = __VLS_pickFunctionalComponentCtx(__VLS_240, __VLS_242);
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["contact-list-container"];
        __VLS_styleScopedClasses["quick-actions"];
        __VLS_styleScopedClasses["action-item"];
        __VLS_styleScopedClasses["action-icon"];
        __VLS_styleScopedClasses["requests-icon"];
        __VLS_styleScopedClasses["svg-icon"];
        __VLS_styleScopedClasses["action-label"];
        __VLS_styleScopedClasses["action-badge"];
        __VLS_styleScopedClasses["action-item"];
        __VLS_styleScopedClasses["action-icon"];
        __VLS_styleScopedClasses["add-icon"];
        __VLS_styleScopedClasses["svg-icon"];
        __VLS_styleScopedClasses["action-label"];
        __VLS_styleScopedClasses["action-item"];
        __VLS_styleScopedClasses["action-icon"];
        __VLS_styleScopedClasses["group-icon"];
        __VLS_styleScopedClasses["svg-icon"];
        __VLS_styleScopedClasses["action-label"];
        __VLS_styleScopedClasses["action-count"];
        __VLS_styleScopedClasses["grouped-list-wrapper"];
        __VLS_styleScopedClasses["saved-groups-section"];
        __VLS_styleScopedClasses["group-title"];
        __VLS_styleScopedClasses["group-items"];
        __VLS_styleScopedClasses["friend-item"];
        __VLS_styleScopedClasses["friend-info"];
        __VLS_styleScopedClasses["friend-name"];
        __VLS_styleScopedClasses["empty-contacts"];
        __VLS_styleScopedClasses["groups-scroller"];
        __VLS_styleScopedClasses["contact-group"];
        __VLS_styleScopedClasses["group-title"];
        __VLS_styleScopedClasses["group-items"];
        __VLS_styleScopedClasses["friend-item"];
        __VLS_styleScopedClasses["friend-info"];
        __VLS_styleScopedClasses["friend-name"];
        __VLS_styleScopedClasses["friend-alias"];
        __VLS_styleScopedClasses["letter-quick-bar"];
        __VLS_styleScopedClasses["quick-letter"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            contactStore: contactStore,
            groupStore: groupStore,
            handleContactClick: handleContactClick,
            handleAddFriend: handleAddFriend,
            handleGroupClick: handleGroupClick,
            handleFriendRequests: handleFriendRequests,
            scrollToGroupList: scrollToGroupList,
            scrollToLetter: scrollToLetter,
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

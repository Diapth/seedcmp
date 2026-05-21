/* __placeholder__ */
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { groupApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const groupStore = useGroupStore();
const userStore = useUserStore();
const groupNo = computed(() => route.params.groupNo);
const groupInfo = computed(() => groupStore.groups[groupNo.value]);
const members = computed(() => groupStore.groupMembers[groupNo.value] || []);
const isOwner = computed(() => {
    return groupInfo.value?.owner === userStore.currentUser?.uid;
});
onMounted(async () => {
    if (groupNo.value) {
        await groupStore.getGroupInfo(groupNo.value);
        await groupStore.fetchGroupMembers(groupNo.value);
    }
});
async function handleRemoveMember(uid) {
    try {
        await groupApi.removeMembers(groupNo.value, [uid]);
        Message.success('已移出该成员');
        await groupStore.fetchGroupMembers(groupNo.value);
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
    }
}
async function handleMuteMember(uid, action) {
    try {
        // action: 1 to mute, 0 to unmute
        await groupApi.muteMember(groupNo.value, { member_uid: uid, action, key: 1 });
        Message.success(action === 1 ? '已禁言该成员' : '已解除禁言');
        await groupStore.fetchGroupMembers(groupNo.value);
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
    }
}
function handleGoBack() {
    router.push(`/chat/conversation/${groupNo.value}/2`);
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
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
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
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("members-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("members-page"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("page-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("page-header"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["button"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{ 'onClick': {}, }, class: ("back-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{ 'onClick': {}, }, class: ("back-btn"), }));
                let __VLS_15 = { 'click': __VLS_pickEvent(__VLS_14['click'], {}.onClick) };
                __VLS_15 = { click: (__VLS_ctx.handleGoBack) };
                {
                    const __VLS_16 = __VLS_intrinsicElements["svg"];
                    const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                    const __VLS_18 = __VLS_17({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("back-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("back-icon"), }));
                    {
                        const __VLS_21 = __VLS_intrinsicElements["line"];
                        const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                        const __VLS_23 = __VLS_22({ ...{}, x1: ("19"), y1: ("12"), x2: ("5"), y2: ("12"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, x1: ("19"), y1: ("12"), x2: ("5"), y2: ("12"), }));
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    {
                        const __VLS_26 = __VLS_intrinsicElements["polyline"];
                        const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                        const __VLS_28 = __VLS_27({ ...{}, points: ("12 19 5 12 12 5"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                        ({}({ ...{}, points: ("12 19 5 12 12 5"), }));
                        const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                    }
                    (__VLS_19.slots).default;
                    const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                let __VLS_14;
            }
            {
                const __VLS_31 = __VLS_intrinsicElements["h3"];
                const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                const __VLS_33 = __VLS_32({ ...{}, class: ("page-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                ({}({ ...{}, class: ("page-title"), }));
                (__VLS_ctx.members.length);
                (__VLS_34.slots).default;
                const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_36 = __VLS_intrinsicElements["div"];
            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
            const __VLS_38 = __VLS_37({ ...{}, class: ("page-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            ({}({ ...{}, class: ("page-content"), }));
            {
                const __VLS_41 = __VLS_intrinsicElements["div"];
                const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                const __VLS_43 = __VLS_42({ ...{}, class: ("members-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                ({}({ ...{}, class: ("members-list"), }));
                for (const [m] of __VLS_getVForSourceType((__VLS_ctx.members))) {
                    {
                        const __VLS_46 = __VLS_intrinsicElements["div"];
                        const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                        const __VLS_48 = __VLS_47({ ...{}, key: ((m.uid)), class: ("member-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                        ({}({ ...{}, key: ((m.uid)), class: ("member-row"), }));
                        {
                            const __VLS_51 = {}.ChannelAvatar;
                            const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((36)), }));
                            ({}.ChannelAvatar);
                            const __VLS_53 = __VLS_52({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                            ({}({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((36)), }));
                            const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                        }
                        {
                            const __VLS_56 = __VLS_intrinsicElements["div"];
                            const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                            const __VLS_58 = __VLS_57({ ...{}, class: ("member-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                            ({}({ ...{}, class: ("member-body"), }));
                            {
                                const __VLS_61 = __VLS_intrinsicElements["span"];
                                const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                                const __VLS_63 = __VLS_62({ ...{}, class: ("member-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                                ({}({ ...{}, class: ("member-name"), }));
                                (m.name);
                                (__VLS_64.slots).default;
                                const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                            }
                            if (m.uid === __VLS_ctx.groupInfo?.owner) {
                                {
                                    const __VLS_66 = __VLS_intrinsicElements["span"];
                                    const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                                    const __VLS_68 = __VLS_67({ ...{}, class: ("role-badge owner"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                                    ({}({ ...{}, class: ("role-badge owner"), }));
                                    (__VLS_69.slots).default;
                                    const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                                }
                                // @ts-ignore
                                [handleGoBack, members, members, groupInfo,];
                            }
                            else if (m.role === 1 || m.role === 'admin') {
                                {
                                    const __VLS_71 = __VLS_intrinsicElements["span"];
                                    const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                                    const __VLS_73 = __VLS_72({ ...{}, class: ("role-badge admin"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                                    ({}({ ...{}, class: ("role-badge admin"), }));
                                    (__VLS_74.slots).default;
                                    const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                                }
                            }
                            (__VLS_59.slots).default;
                            const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                        }
                        {
                            const __VLS_76 = __VLS_intrinsicElements["div"];
                            const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                            const __VLS_78 = __VLS_77({ ...{}, class: ("member-actions"), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                            ({}({ ...{}, class: ("member-actions"), }));
                            if (__VLS_ctx.isOwner && m.uid !== __VLS_ctx.groupInfo?.owner) {
                                {
                                    const __VLS_81 = __VLS_intrinsicElements["button"];
                                    const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                                    const __VLS_83 = __VLS_82({ ...{ 'onClick': {}, }, class: ("action-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn"), }));
                                    ({ muted: m.is_mute === 1 });
                                    __VLS_styleScopedClasses = ({ muted: m.is_mute === 1 });
                                    let __VLS_86 = { 'click': __VLS_pickEvent(__VLS_85['click'], {}.onClick) };
                                    __VLS_86 = { click: $event => {
                                            if (!((__VLS_ctx.isOwner && m.uid !== __VLS_ctx.groupInfo?.owner)))
                                                return;
                                            __VLS_ctx.handleMuteMember(m.uid, m.is_mute === 1 ? 0 : 1);
                                            // @ts-ignore
                                            [isOwner, groupInfo, handleMuteMember,];
                                        }
                                    };
                                    (m.is_mute === 1 ? '解禁' : '禁言');
                                    (__VLS_84.slots).default;
                                    const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                                    let __VLS_85;
                                }
                            }
                            if (__VLS_ctx.isOwner && m.uid !== __VLS_ctx.groupInfo?.owner) {
                                {
                                    const __VLS_87 = __VLS_intrinsicElements["button"];
                                    const __VLS_88 = __VLS_elementAsFunctionalComponent(__VLS_87);
                                    const __VLS_89 = __VLS_88({ ...{ 'onClick': {}, }, class: ("action-btn kick-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn kick-btn"), }));
                                    let __VLS_92 = { 'click': __VLS_pickEvent(__VLS_91['click'], {}.onClick) };
                                    __VLS_92 = { click: $event => {
                                            if (!((__VLS_ctx.isOwner && m.uid !== __VLS_ctx.groupInfo?.owner)))
                                                return;
                                            __VLS_ctx.handleRemoveMember(m.uid);
                                            // @ts-ignore
                                            [isOwner, groupInfo, handleRemoveMember,];
                                        }
                                    };
                                    (__VLS_90.slots).default;
                                    const __VLS_90 = __VLS_pickFunctionalComponentCtx(__VLS_87, __VLS_89);
                                    let __VLS_91;
                                }
                            }
                            (__VLS_79.slots).default;
                            const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                        }
                        (__VLS_49.slots).default;
                        const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                    }
                }
                (__VLS_44.slots).default;
                const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
            }
            (__VLS_39.slots).default;
            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["members-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["back-btn"];
        __VLS_styleScopedClasses["back-icon"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["page-content"];
        __VLS_styleScopedClasses["members-list"];
        __VLS_styleScopedClasses["member-row"];
        __VLS_styleScopedClasses["member-body"];
        __VLS_styleScopedClasses["member-name"];
        __VLS_styleScopedClasses["role-badge"];
        __VLS_styleScopedClasses["owner"];
        __VLS_styleScopedClasses["role-badge"];
        __VLS_styleScopedClasses["admin"];
        __VLS_styleScopedClasses["member-actions"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["kick-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            groupInfo: groupInfo,
            members: members,
            isOwner: isOwner,
            handleRemoveMember: handleRemoveMember,
            handleMuteMember: handleMuteMember,
            handleGoBack: handleGoBack,
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

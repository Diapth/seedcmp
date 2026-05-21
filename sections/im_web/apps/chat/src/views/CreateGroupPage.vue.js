/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { groupApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const contactStore = useContactStore();
const groupName = ref('');
const selectedUids = ref([]);
const creating = ref(false);
onMounted(() => {
    contactStore.syncContacts();
});
function toggleSelect(uid) {
    const idx = selectedUids.value.indexOf(uid);
    if (idx > -1) {
        selectedUids.value.splice(idx, 1);
    }
    else {
        selectedUids.value.push(uid);
    }
}
async function handleCreate() {
    const name = groupName.value.trim();
    if (!name) {
        Message.warning('请输入群聊名称');
        return;
    }
    if (selectedUids.value.length === 0) {
        Message.warning('请选择至少一个群成员');
        return;
    }
    creating.value = true;
    try {
        const res = await groupApi.createGroup({
            name,
            members: selectedUids.value
        });
        const groupNo = res.data?.group_no || res.group_no;
        if (groupNo) {
            Message.success('群组创建成功');
            router.push(`/chat/conversation/${groupNo}/2`);
        }
        else {
            throw new Error('No group_no returned');
        }
    }
    catch (err) {
        Message.error(err.msg || '群组创建失败');
    }
    finally {
        creating.value = false;
    }
}
function handleGoBack() {
    router.push('/chat');
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
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("create-group-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("create-group-page"), }));
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
                const __VLS_43 = __VLS_42({ ...{}, class: ("input-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                ({}({ ...{}, class: ("input-section"), }));
                {
                    const __VLS_46 = __VLS_intrinsicElements["label"];
                    const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                    const __VLS_48 = __VLS_47({ ...{}, class: ("section-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                    ({}({ ...{}, class: ("section-label"), }));
                    (__VLS_49.slots).default;
                    const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                }
                {
                    const __VLS_51 = __VLS_intrinsicElements["input"];
                    const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                    const __VLS_53 = __VLS_52({ ...{}, value: ((__VLS_ctx.groupName)), type: ("text"), placeholder: ("请输入群聊名称..."), class: ("name-input"), disabled: ((__VLS_ctx.creating)), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                    ({}({ ...{}, value: ((__VLS_ctx.groupName)), type: ("text"), placeholder: ("请输入群聊名称..."), class: ("name-input"), disabled: ((__VLS_ctx.creating)), }));
                    const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                }
                (__VLS_44.slots).default;
                const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
            }
            {
                const __VLS_56 = __VLS_intrinsicElements["div"];
                const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                const __VLS_58 = __VLS_57({ ...{}, class: ("selector-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                ({}({ ...{}, class: ("selector-section"), }));
                {
                    const __VLS_61 = __VLS_intrinsicElements["label"];
                    const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                    const __VLS_63 = __VLS_62({ ...{}, class: ("section-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                    ({}({ ...{}, class: ("section-label"), }));
                    (__VLS_ctx.selectedUids.length);
                    (__VLS_64.slots).default;
                    const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                }
                {
                    const __VLS_66 = __VLS_intrinsicElements["div"];
                    const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                    const __VLS_68 = __VLS_67({ ...{}, class: ("friends-list-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                    ({}({ ...{}, class: ("friends-list-wrapper"), }));
                    if (__VLS_ctx.contactStore.contacts.length === 0) {
                        {
                            const __VLS_71 = __VLS_intrinsicElements["div"];
                            const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                            const __VLS_73 = __VLS_72({ ...{}, class: ("empty-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                            ({}({ ...{}, class: ("empty-state"), }));
                            {
                                const __VLS_76 = __VLS_intrinsicElements["p"];
                                const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                                const __VLS_78 = __VLS_77({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                                ({}({ ...{}, }));
                                (__VLS_79.slots).default;
                                const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                            }
                            (__VLS_74.slots).default;
                            const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                        }
                        // @ts-ignore
                        [handleGoBack, groupName, creating, groupName, creating, selectedUids, contactStore,];
                    }
                    else {
                        {
                            const __VLS_81 = __VLS_intrinsicElements["div"];
                            const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                            const __VLS_83 = __VLS_82({ ...{}, class: ("friends-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                            ({}({ ...{}, class: ("friends-list"), }));
                            for (const [friend] of __VLS_getVForSourceType((__VLS_ctx.contactStore.contacts))) {
                                {
                                    const __VLS_86 = __VLS_intrinsicElements["div"];
                                    const __VLS_87 = __VLS_elementAsFunctionalComponent(__VLS_86);
                                    const __VLS_88 = __VLS_87({ ...{ 'onClick': {}, }, key: ((friend.uid)), class: ("selector-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                                    ({}({ ...{ 'onClick': {}, }, key: ((friend.uid)), class: ("selector-item"), }));
                                    ({ selected: __VLS_ctx.selectedUids.includes(friend.uid) });
                                    __VLS_styleScopedClasses = ({ selected: selectedUids.includes(friend.uid) });
                                    let __VLS_91 = { 'click': __VLS_pickEvent(__VLS_90['click'], {}.onClick) };
                                    __VLS_91 = { click: $event => {
                                            if (!(!((__VLS_ctx.contactStore.contacts.length === 0))))
                                                return;
                                            __VLS_ctx.toggleSelect(friend.uid);
                                            // @ts-ignore
                                            [contactStore, selectedUids, toggleSelect,];
                                        }
                                    };
                                    {
                                        const __VLS_92 = __VLS_intrinsicElements["div"];
                                        const __VLS_93 = __VLS_elementAsFunctionalComponent(__VLS_92);
                                        const __VLS_94 = __VLS_93({ ...{}, class: ("checkbox-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                                        ({}({ ...{}, class: ("checkbox-wrapper"), }));
                                        {
                                            const __VLS_97 = __VLS_intrinsicElements["div"];
                                            const __VLS_98 = __VLS_elementAsFunctionalComponent(__VLS_97);
                                            const __VLS_99 = __VLS_98({ ...{}, class: ("custom-checkbox"), }, ...__VLS_functionalComponentArgsRest(__VLS_98));
                                            ({}({ ...{}, class: ("custom-checkbox"), }));
                                            const __VLS_100 = __VLS_pickFunctionalComponentCtx(__VLS_97, __VLS_99);
                                        }
                                        (__VLS_95.slots).default;
                                        const __VLS_95 = __VLS_pickFunctionalComponentCtx(__VLS_92, __VLS_94);
                                    }
                                    {
                                        const __VLS_102 = {}.ChannelAvatar;
                                        const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }));
                                        ({}.ChannelAvatar);
                                        const __VLS_104 = __VLS_103({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_103));
                                        ({}({ ...{}, avatar: ((friend.avatar)), name: ((friend.remark || friend.name)), size: ((36)), }));
                                        const __VLS_105 = __VLS_pickFunctionalComponentCtx(__VLS_102, __VLS_104);
                                    }
                                    {
                                        const __VLS_107 = __VLS_intrinsicElements["span"];
                                        const __VLS_108 = __VLS_elementAsFunctionalComponent(__VLS_107);
                                        const __VLS_109 = __VLS_108({ ...{}, class: ("friend-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_108));
                                        ({}({ ...{}, class: ("friend-name"), }));
                                        (friend.remark || friend.name);
                                        (__VLS_110.slots).default;
                                        const __VLS_110 = __VLS_pickFunctionalComponentCtx(__VLS_107, __VLS_109);
                                    }
                                    (__VLS_89.slots).default;
                                    const __VLS_89 = __VLS_pickFunctionalComponentCtx(__VLS_86, __VLS_88);
                                    let __VLS_90;
                                }
                            }
                            (__VLS_84.slots).default;
                            const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                        }
                    }
                    (__VLS_69.slots).default;
                    const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                }
                (__VLS_59.slots).default;
                const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
            }
            {
                const __VLS_112 = __VLS_intrinsicElements["button"];
                const __VLS_113 = __VLS_elementAsFunctionalComponent(__VLS_112);
                const __VLS_114 = __VLS_113({ ...{ 'onClick': {}, }, class: ("create-btn"), disabled: ((__VLS_ctx.creating || !__VLS_ctx.groupName.trim() || __VLS_ctx.selectedUids.length === 0)), }, ...__VLS_functionalComponentArgsRest(__VLS_113));
                ({}({ ...{ 'onClick': {}, }, class: ("create-btn"), disabled: ((__VLS_ctx.creating || !__VLS_ctx.groupName.trim() || __VLS_ctx.selectedUids.length === 0)), }));
                let __VLS_117 = { 'click': __VLS_pickEvent(__VLS_116['click'], {}.onClick) };
                __VLS_117 = { click: (__VLS_ctx.handleCreate) };
                (__VLS_ctx.creating ? '正在创建...' : '立即创建');
                (__VLS_115.slots).default;
                const __VLS_115 = __VLS_pickFunctionalComponentCtx(__VLS_112, __VLS_114);
                let __VLS_116;
            }
            (__VLS_39.slots).default;
            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["create-group-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["back-btn"];
        __VLS_styleScopedClasses["back-icon"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["page-content"];
        __VLS_styleScopedClasses["input-section"];
        __VLS_styleScopedClasses["section-label"];
        __VLS_styleScopedClasses["name-input"];
        __VLS_styleScopedClasses["selector-section"];
        __VLS_styleScopedClasses["section-label"];
        __VLS_styleScopedClasses["friends-list-wrapper"];
        __VLS_styleScopedClasses["empty-state"];
        __VLS_styleScopedClasses["friends-list"];
        __VLS_styleScopedClasses["selector-item"];
        __VLS_styleScopedClasses["checkbox-wrapper"];
        __VLS_styleScopedClasses["custom-checkbox"];
        __VLS_styleScopedClasses["friend-name"];
        __VLS_styleScopedClasses["create-btn"];
    }
    var __VLS_slots;
    // @ts-ignore
    [creating, groupName, selectedUids, creating, groupName, selectedUids, handleCreate, creating,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            contactStore: contactStore,
            groupName: groupName,
            selectedUids: selectedUids,
            creating: creating,
            toggleSelect: toggleSelect,
            handleCreate: handleCreate,
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

/* __placeholder__ */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['close']);
const router = useRouter();
const userStore = useUserStore();
const contactStore = useContactStore();
const userDetails = computed(() => {
    return userStore.userCache[props.uid] || { uid: props.uid, name: '加载中...', avatar: '' };
});
const isFriend = computed(() => {
    return contactStore.contacts.some(c => c.uid === props.uid);
});
onMounted(() => {
    if (props.uid && !userStore.userCache[props.uid]) {
        userStore.getUsersByIds([props.uid]);
    }
});
async function handleSendMessage() {
    emit('close');
    router.push(`/chat/conversation/${props.uid}/1`);
}
async function handleDeleteFriend() {
    try {
        await friendApi.deleteFriend(props.uid);
        Message.success('已删除好友');
        // 乐观更新，立刻移除
        contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
        contactStore.syncContacts();
        emit('close');
    }
    catch (err) {
        // 后端如果报400或者路由问题，也强制乐观更新以避免界面卡死
        contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
        Message.success('已删除好友');
        emit('close');
    }
}
async function handleAddBlacklist() {
    try {
        await friendApi.addBlacklist(props.uid);
        Message.success('已加入黑名单');
        contactStore.syncContacts();
        emit('close');
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
    }
}
function handleAddFriend() {
    emit('close');
    router.push({ path: '/chat/add-friend', query: { uid: props.uid } });
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
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    if (__VLS_ctx.visible) {
        {
            const __VLS_0 = __VLS_intrinsicElements["div"];
            const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
            const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("drawer-overlay"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            ({}({ ...{ 'onClick': {}, }, class: ("drawer-overlay"), }));
            let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
            __VLS_5 = { click: $event => {
                    if (!((__VLS_ctx.visible)))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [visible, emit,];
                }
            };
            {
                const __VLS_6 = __VLS_intrinsicElements["div"];
                const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
                const __VLS_8 = __VLS_7({ ...{ 'onClick': {}, }, class: ("drawer-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
                ({}({ ...{ 'onClick': {}, }, class: ("drawer-content"), }));
                let __VLS_11 = { 'click': __VLS_pickEvent(__VLS_10['click'], {}.onClick) };
                __VLS_11 = { click: () => { } };
                {
                    const __VLS_12 = __VLS_intrinsicElements["div"];
                    const __VLS_13 = __VLS_elementAsFunctionalComponent(__VLS_12);
                    const __VLS_14 = __VLS_13({ ...{}, class: ("drawer-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
                    ({}({ ...{}, class: ("drawer-header"), }));
                    {
                        const __VLS_17 = __VLS_intrinsicElements["h4"];
                        const __VLS_18 = __VLS_elementAsFunctionalComponent(__VLS_17);
                        const __VLS_19 = __VLS_18({ ...{}, class: ("drawer-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_18));
                        ({}({ ...{}, class: ("drawer-title"), }));
                        (__VLS_20.slots).default;
                        const __VLS_20 = __VLS_pickFunctionalComponentCtx(__VLS_17, __VLS_19);
                    }
                    {
                        const __VLS_22 = __VLS_intrinsicElements["button"];
                        const __VLS_23 = __VLS_elementAsFunctionalComponent(__VLS_22);
                        const __VLS_24 = __VLS_23({ ...{ 'onClick': {}, }, class: ("close-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_23));
                        ({}({ ...{ 'onClick': {}, }, class: ("close-btn"), }));
                        let __VLS_27 = { 'click': __VLS_pickEvent(__VLS_26['click'], {}.onClick) };
                        __VLS_27 = { click: $event => {
                                if (!((__VLS_ctx.visible)))
                                    return;
                                __VLS_ctx.emit('close');
                                // @ts-ignore
                                [emit,];
                            }
                        };
                        {
                            const __VLS_28 = __VLS_intrinsicElements["svg"];
                            const __VLS_29 = __VLS_elementAsFunctionalComponent(__VLS_28);
                            const __VLS_30 = __VLS_29({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_29));
                            ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }));
                            {
                                const __VLS_33 = __VLS_intrinsicElements["line"];
                                const __VLS_34 = __VLS_elementAsFunctionalComponent(__VLS_33);
                                const __VLS_35 = __VLS_34({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_34));
                                ({}({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }));
                                const __VLS_36 = __VLS_pickFunctionalComponentCtx(__VLS_33, __VLS_35);
                            }
                            {
                                const __VLS_38 = __VLS_intrinsicElements["line"];
                                const __VLS_39 = __VLS_elementAsFunctionalComponent(__VLS_38);
                                const __VLS_40 = __VLS_39({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
                                ({}({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }));
                                const __VLS_41 = __VLS_pickFunctionalComponentCtx(__VLS_38, __VLS_40);
                            }
                            (__VLS_31.slots).default;
                            const __VLS_31 = __VLS_pickFunctionalComponentCtx(__VLS_28, __VLS_30);
                        }
                        (__VLS_25.slots).default;
                        const __VLS_25 = __VLS_pickFunctionalComponentCtx(__VLS_22, __VLS_24);
                        let __VLS_26;
                    }
                    (__VLS_15.slots).default;
                    const __VLS_15 = __VLS_pickFunctionalComponentCtx(__VLS_12, __VLS_14);
                }
                {
                    const __VLS_43 = __VLS_intrinsicElements["div"];
                    const __VLS_44 = __VLS_elementAsFunctionalComponent(__VLS_43);
                    const __VLS_45 = __VLS_44({ ...{}, class: ("drawer-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_44));
                    ({}({ ...{}, class: ("drawer-body"), }));
                    {
                        const __VLS_48 = __VLS_intrinsicElements["div"];
                        const __VLS_49 = __VLS_elementAsFunctionalComponent(__VLS_48);
                        const __VLS_50 = __VLS_49({ ...{}, class: ("profile-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_49));
                        ({}({ ...{}, class: ("profile-card"), }));
                        {
                            const __VLS_53 = {}.ChannelAvatar;
                            const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }));
                            ({}.ChannelAvatar);
                            const __VLS_55 = __VLS_54({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }, ...__VLS_functionalComponentArgsRest(__VLS_54));
                            ({}({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }));
                            const __VLS_56 = __VLS_pickFunctionalComponentCtx(__VLS_53, __VLS_55);
                        }
                        {
                            const __VLS_58 = __VLS_intrinsicElements["div"];
                            const __VLS_59 = __VLS_elementAsFunctionalComponent(__VLS_58);
                            const __VLS_60 = __VLS_59({ ...{}, class: ("profile-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
                            ({}({ ...{}, class: ("profile-info"), }));
                            {
                                const __VLS_63 = __VLS_intrinsicElements["div"];
                                const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                                const __VLS_65 = __VLS_64({ ...{}, class: ("profile-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                                ({}({ ...{}, class: ("profile-name"), }));
                                (__VLS_ctx.userDetails.name);
                                (__VLS_66.slots).default;
                                const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                            }
                            {
                                const __VLS_68 = __VLS_intrinsicElements["div"];
                                const __VLS_69 = __VLS_elementAsFunctionalComponent(__VLS_68);
                                const __VLS_70 = __VLS_69({ ...{}, class: ("profile-uid"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                                ({}({ ...{}, class: ("profile-uid"), }));
                                (__VLS_ctx.userDetails.uid);
                                (__VLS_71.slots).default;
                                const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                            }
                            (__VLS_61.slots).default;
                            const __VLS_61 = __VLS_pickFunctionalComponentCtx(__VLS_58, __VLS_60);
                        }
                        (__VLS_51.slots).default;
                        const __VLS_51 = __VLS_pickFunctionalComponentCtx(__VLS_48, __VLS_50);
                    }
                    {
                        const __VLS_73 = __VLS_intrinsicElements["div"];
                        const __VLS_74 = __VLS_elementAsFunctionalComponent(__VLS_73);
                        const __VLS_75 = __VLS_74({ ...{}, class: ("action-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                        ({}({ ...{}, class: ("action-section"), }));
                        if (__VLS_ctx.isFriend) {
                            {
                                const __VLS_78 = __VLS_intrinsicElements["button"];
                                const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                                const __VLS_80 = __VLS_79({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }));
                                let __VLS_83 = { 'click': __VLS_pickEvent(__VLS_82['click'], {}.onClick) };
                                __VLS_83 = { click: (__VLS_ctx.handleSendMessage) };
                                (__VLS_81.slots).default;
                                const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                                let __VLS_82;
                            }
                            // @ts-ignore
                            [userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, isFriend, handleSendMessage,];
                        }
                        else {
                            {
                                const __VLS_84 = __VLS_intrinsicElements["button"];
                                const __VLS_85 = __VLS_elementAsFunctionalComponent(__VLS_84);
                                const __VLS_86 = __VLS_85({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_85));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }));
                                let __VLS_89 = { 'click': __VLS_pickEvent(__VLS_88['click'], {}.onClick) };
                                __VLS_89 = { click: (__VLS_ctx.handleAddFriend) };
                                (__VLS_87.slots).default;
                                const __VLS_87 = __VLS_pickFunctionalComponentCtx(__VLS_84, __VLS_86);
                                let __VLS_88;
                            }
                            // @ts-ignore
                            [handleAddFriend,];
                        }
                        if (__VLS_ctx.isFriend) {
                            {
                                const __VLS_90 = __VLS_intrinsicElements["div"];
                                const __VLS_91 = __VLS_elementAsFunctionalComponent(__VLS_90);
                                const __VLS_92 = __VLS_91({ ...{}, class: ("danger-zone"), }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                                ({}({ ...{}, class: ("danger-zone"), }));
                                {
                                    const __VLS_95 = __VLS_intrinsicElements["button"];
                                    const __VLS_96 = __VLS_elementAsFunctionalComponent(__VLS_95);
                                    const __VLS_97 = __VLS_96({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_96));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }));
                                    let __VLS_100 = { 'click': __VLS_pickEvent(__VLS_99['click'], {}.onClick) };
                                    __VLS_100 = { click: (__VLS_ctx.handleAddBlacklist) };
                                    (__VLS_98.slots).default;
                                    const __VLS_98 = __VLS_pickFunctionalComponentCtx(__VLS_95, __VLS_97);
                                    let __VLS_99;
                                }
                                {
                                    const __VLS_101 = __VLS_intrinsicElements["button"];
                                    const __VLS_102 = __VLS_elementAsFunctionalComponent(__VLS_101);
                                    const __VLS_103 = __VLS_102({ ...{ 'onClick': {}, }, class: ("action-btn danger-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_102));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn danger-btn"), }));
                                    let __VLS_106 = { 'click': __VLS_pickEvent(__VLS_105['click'], {}.onClick) };
                                    __VLS_106 = { click: (__VLS_ctx.handleDeleteFriend) };
                                    (__VLS_104.slots).default;
                                    const __VLS_104 = __VLS_pickFunctionalComponentCtx(__VLS_101, __VLS_103);
                                    let __VLS_105;
                                }
                                (__VLS_93.slots).default;
                                const __VLS_93 = __VLS_pickFunctionalComponentCtx(__VLS_90, __VLS_92);
                            }
                            // @ts-ignore
                            [isFriend, handleAddBlacklist, handleDeleteFriend,];
                        }
                        (__VLS_76.slots).default;
                        const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
                    }
                    (__VLS_46.slots).default;
                    const __VLS_46 = __VLS_pickFunctionalComponentCtx(__VLS_43, __VLS_45);
                }
                (__VLS_9.slots).default;
                const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
                let __VLS_10;
            }
            (__VLS_3.slots).default;
            const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
            let __VLS_4;
        }
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["drawer-overlay"];
        __VLS_styleScopedClasses["drawer-content"];
        __VLS_styleScopedClasses["drawer-header"];
        __VLS_styleScopedClasses["drawer-title"];
        __VLS_styleScopedClasses["close-btn"];
        __VLS_styleScopedClasses["close-icon"];
        __VLS_styleScopedClasses["drawer-body"];
        __VLS_styleScopedClasses["profile-card"];
        __VLS_styleScopedClasses["profile-info"];
        __VLS_styleScopedClasses["profile-name"];
        __VLS_styleScopedClasses["profile-uid"];
        __VLS_styleScopedClasses["action-section"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["primary-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["primary-btn"];
        __VLS_styleScopedClasses["danger-zone"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["secondary-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["danger-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            emit: emit,
            userDetails: userDetails,
            isFriend: isFriend,
            handleSendMessage: handleSendMessage,
            handleDeleteFriend: handleDeleteFriend,
            handleAddBlacklist: handleAddBlacklist,
            handleAddFriend: handleAddFriend,
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

/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '../stores/contactStore';
import { friendApi } from '@tsdaodao/datasource-vue';
import { FriendRequestItem } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const contactStore = useContactStore();
const loading = ref(false);
async function loadRequests() {
    loading.value = true;
    try {
        await contactStore.fetchFriendRequests();
        await contactStore.markFriendRequestsRead();
    }
    finally {
        loading.value = false;
    }
}
onMounted(() => {
    loadRequests();
});
async function handleApprove(token) {
    try {
        await friendApi.approveFriend(token);
        Message.success('已同意好友申请');
        contactStore.markFriendRequestAccepted(token);
        await Promise.all([
            contactStore.syncContacts(),
            contactStore.fetchFriendRequests()
        ]);
    }
    catch (err) {
        Message.error(err.msg || '同意申请失败');
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
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_components.FriendRequestItem;
    __VLS_components.FriendRequestItem;
    // @ts-ignore
    [FriendRequestItem,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("requests-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("requests-page"), }));
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
            const __VLS_38 = __VLS_37({ ...{}, class: ("requests-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            ({}({ ...{}, class: ("requests-list"), }));
            if (__VLS_ctx.loading || __VLS_ctx.contactStore.isFriendRequestsLoading) {
                {
                    const __VLS_41 = __VLS_intrinsicElements["div"];
                    const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                    const __VLS_43 = __VLS_42({ ...{}, class: ("empty-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                    ({}({ ...{}, class: ("empty-state"), }));
                    {
                        const __VLS_46 = __VLS_intrinsicElements["p"];
                        const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                        const __VLS_48 = __VLS_47({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                        ({}({ ...{}, }));
                        (__VLS_49.slots).default;
                        const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                    }
                    (__VLS_44.slots).default;
                    const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                }
                // @ts-ignore
                [handleGoBack, loading, contactStore,];
            }
            else if (__VLS_ctx.contactStore.friendRequests.length === 0) {
                {
                    const __VLS_51 = __VLS_intrinsicElements["div"];
                    const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                    const __VLS_53 = __VLS_52({ ...{}, class: ("empty-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                    ({}({ ...{}, class: ("empty-state"), }));
                    {
                        const __VLS_56 = __VLS_intrinsicElements["p"];
                        const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                        const __VLS_58 = __VLS_57({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                        ({}({ ...{}, }));
                        (__VLS_59.slots).default;
                        const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                    }
                    (__VLS_54.slots).default;
                    const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                }
                // @ts-ignore
                [contactStore,];
            }
            else {
                {
                    const __VLS_61 = __VLS_intrinsicElements["div"];
                    const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                    const __VLS_63 = __VLS_62({ ...{}, class: ("list-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                    ({}({ ...{}, class: ("list-wrapper"), }));
                    for (const [req] of __VLS_getVForSourceType((__VLS_ctx.contactStore.friendRequests))) {
                        {
                            const __VLS_66 = {}.FriendRequestItem;
                            const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({ ...{ 'onApprove': {}, }, key: ((req.id)), request: ((req)), }));
                            ({}.FriendRequestItem);
                            const __VLS_68 = __VLS_67({ ...{ 'onApprove': {}, }, key: ((req.id)), request: ((req)), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                            ({}({ ...{ 'onApprove': {}, }, key: ((req.id)), request: ((req)), }));
                            let __VLS_71 = { 'approve': __VLS_pickEvent(__VLS_70['approve'], {}.onApprove) };
                            __VLS_71 = { approve: (__VLS_ctx.handleApprove) };
                            const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                            let __VLS_70;
                        }
                        // @ts-ignore
                        [contactStore, handleApprove,];
                    }
                    (__VLS_64.slots).default;
                    const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                }
            }
            (__VLS_39.slots).default;
            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["requests-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["back-btn"];
        __VLS_styleScopedClasses["back-icon"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["requests-list"];
        __VLS_styleScopedClasses["empty-state"];
        __VLS_styleScopedClasses["empty-state"];
        __VLS_styleScopedClasses["list-wrapper"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            FriendRequestItem: FriendRequestItem,
            contactStore: contactStore,
            loading: loading,
            handleApprove: handleApprove,
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

/* __placeholder__ */
import { ref } from 'vue';
import ChannelAvatar from './ChannelAvatar.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['approve', 'reject']);
const processing = ref(false);
async function handleApprove() {
    processing.value = true;
    try {
        emit('approve', props.request.token);
    }
    finally {
        processing.value = false;
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
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("request-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("request-item"), }));
        {
            const __VLS_5 = {}.ChannelAvatar;
            const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({ ...{}, avatar: ((__VLS_ctx.request.avatar)), name: ((__VLS_ctx.request.name)), size: ((40)), }));
            ({}.ChannelAvatar);
            const __VLS_7 = __VLS_6({ ...{}, avatar: ((__VLS_ctx.request.avatar)), name: ((__VLS_ctx.request.name)), size: ((40)), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, avatar: ((__VLS_ctx.request.avatar)), name: ((__VLS_ctx.request.name)), size: ((40)), }));
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_10 = __VLS_intrinsicElements["div"];
            const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
            const __VLS_12 = __VLS_11({ ...{}, class: ("request-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            ({}({ ...{}, class: ("request-body"), }));
            {
                const __VLS_15 = __VLS_intrinsicElements["div"];
                const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                const __VLS_17 = __VLS_16({ ...{}, class: ("request-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                ({}({ ...{}, class: ("request-name"), }));
                (__VLS_ctx.request.name);
                (__VLS_18.slots).default;
                const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
            }
            {
                const __VLS_20 = __VLS_intrinsicElements["div"];
                const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                const __VLS_22 = __VLS_21({ ...{}, class: ("request-remark"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                ({}({ ...{}, class: ("request-remark"), }));
                (__VLS_ctx.request.remark || '申请添加你为好友');
                (__VLS_23.slots).default;
                const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
            }
            (__VLS_13.slots).default;
            const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
        }
        {
            const __VLS_25 = __VLS_intrinsicElements["div"];
            const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
            const __VLS_27 = __VLS_26({ ...{}, class: ("request-actions"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            ({}({ ...{}, class: ("request-actions"), }));
            if (__VLS_ctx.request.status === 1) {
                {
                    const __VLS_30 = __VLS_intrinsicElements["span"];
                    const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                    const __VLS_32 = __VLS_31({ ...{}, class: ("status-label accepted"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                    ({}({ ...{}, class: ("status-label accepted"), }));
                    (__VLS_33.slots).default;
                    const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                }
                // @ts-ignore
                [request, request, request, request, request, request, request, request, request,];
            }
            else if (__VLS_ctx.request.status === 2) {
                {
                    const __VLS_35 = __VLS_intrinsicElements["span"];
                    const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                    const __VLS_37 = __VLS_36({ ...{}, class: ("status-label declined"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                    ({}({ ...{}, class: ("status-label declined"), }));
                    (__VLS_38.slots).default;
                    const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                }
                // @ts-ignore
                [request,];
            }
            else {
                {
                    const __VLS_40 = __VLS_intrinsicElements["div"];
                    const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                    const __VLS_42 = __VLS_41({ ...{}, class: ("btn-group"), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                    ({}({ ...{}, class: ("btn-group"), }));
                    {
                        const __VLS_45 = __VLS_intrinsicElements["button"];
                        const __VLS_46 = __VLS_elementAsFunctionalComponent(__VLS_45);
                        const __VLS_47 = __VLS_46({ ...{ 'onClick': {}, }, class: ("action-btn approve-btn"), disabled: ((__VLS_ctx.processing)), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                        ({}({ ...{ 'onClick': {}, }, class: ("action-btn approve-btn"), disabled: ((__VLS_ctx.processing)), }));
                        let __VLS_50 = { 'click': __VLS_pickEvent(__VLS_49['click'], {}.onClick) };
                        __VLS_50 = { click: (__VLS_ctx.handleApprove) };
                        (__VLS_48.slots).default;
                        const __VLS_48 = __VLS_pickFunctionalComponentCtx(__VLS_45, __VLS_47);
                        let __VLS_49;
                    }
                    (__VLS_43.slots).default;
                    const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                }
                // @ts-ignore
                [processing, processing, handleApprove,];
            }
            (__VLS_28.slots).default;
            const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["request-item"];
        __VLS_styleScopedClasses["request-body"];
        __VLS_styleScopedClasses["request-name"];
        __VLS_styleScopedClasses["request-remark"];
        __VLS_styleScopedClasses["request-actions"];
        __VLS_styleScopedClasses["status-label"];
        __VLS_styleScopedClasses["accepted"];
        __VLS_styleScopedClasses["status-label"];
        __VLS_styleScopedClasses["declined"];
        __VLS_styleScopedClasses["btn-group"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["approve-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            processing: processing,
            handleApprove: handleApprove,
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

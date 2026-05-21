/* __placeholder__ */
import { computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知文件');
const size = computed(() => props.message.content?.size || props.message.payload?.size || 0);
const sizeStr = computed(() => {
    if (size.value === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size.value) / Math.log(k));
    return parseFloat((size.value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});
function handleDownload() {
    if (!url.value)
        return;
    window.open(url.value, '_blank');
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
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("file-cell"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{ 'onClick': {}, }, class: ("file-cell"), }));
        ({ 'is-me': __VLS_ctx.isMe });
        __VLS_styleScopedClasses = ({ 'is-me': isMe });
        let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
        __VLS_5 = { click: (__VLS_ctx.handleDownload) };
        {
            const __VLS_6 = __VLS_intrinsicElements["div"];
            const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
            const __VLS_8 = __VLS_7({ ...{}, class: ("bubble"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
            ({}({ ...{}, class: ("bubble"), }));
            {
                const __VLS_11 = __VLS_intrinsicElements["div"];
                const __VLS_12 = __VLS_elementAsFunctionalComponent(__VLS_11);
                const __VLS_13 = __VLS_12({ ...{}, class: ("file-details"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
                ({}({ ...{}, class: ("file-details"), }));
                {
                    const __VLS_16 = __VLS_intrinsicElements["span"];
                    const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                    const __VLS_18 = __VLS_17({ ...{}, class: ("file-name"), title: ((__VLS_ctx.name)), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                    ({}({ ...{}, class: ("file-name"), title: ((__VLS_ctx.name)), }));
                    (__VLS_ctx.name);
                    (__VLS_19.slots).default;
                    const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                }
                {
                    const __VLS_21 = __VLS_intrinsicElements["span"];
                    const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                    const __VLS_23 = __VLS_22({ ...{}, class: ("file-size"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                    ({}({ ...{}, class: ("file-size"), }));
                    (__VLS_ctx.sizeStr);
                    (__VLS_24.slots).default;
                    const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                }
                (__VLS_14.slots).default;
                const __VLS_14 = __VLS_pickFunctionalComponentCtx(__VLS_11, __VLS_13);
            }
            {
                const __VLS_26 = __VLS_intrinsicElements["div"];
                const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                const __VLS_28 = __VLS_27({ ...{}, class: ("file-icon-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                ({}({ ...{}, class: ("file-icon-wrapper"), }));
                {
                    const __VLS_31 = __VLS_intrinsicElements["svg"];
                    const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                    const __VLS_33 = __VLS_32({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("file-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("file-svg"), }));
                    {
                        const __VLS_36 = __VLS_intrinsicElements["path"];
                        const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                        const __VLS_38 = __VLS_37({ ...{}, d: ("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                        ({}({ ...{}, d: ("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), }));
                        const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                    }
                    {
                        const __VLS_41 = __VLS_intrinsicElements["polyline"];
                        const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                        const __VLS_43 = __VLS_42({ ...{}, points: ("14 2 14 8 20 8"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                        ({}({ ...{}, points: ("14 2 14 8 20 8"), }));
                        const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                    }
                    {
                        const __VLS_46 = __VLS_intrinsicElements["line"];
                        const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                        const __VLS_48 = __VLS_47({ ...{}, x1: ("16"), y1: ("13"), x2: ("8"), y2: ("13"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                        ({}({ ...{}, x1: ("16"), y1: ("13"), x2: ("8"), y2: ("13"), }));
                        const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                    }
                    {
                        const __VLS_51 = __VLS_intrinsicElements["line"];
                        const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                        const __VLS_53 = __VLS_52({ ...{}, x1: ("16"), y1: ("17"), x2: ("8"), y2: ("17"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                        ({}({ ...{}, x1: ("16"), y1: ("17"), x2: ("8"), y2: ("17"), }));
                        const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                    }
                    {
                        const __VLS_56 = __VLS_intrinsicElements["polyline"];
                        const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                        const __VLS_58 = __VLS_57({ ...{}, points: ("10 9 9 9 8 9"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                        ({}({ ...{}, points: ("10 9 9 9 8 9"), }));
                        const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                    }
                    (__VLS_34.slots).default;
                    const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                }
                (__VLS_29.slots).default;
                const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
            }
            (__VLS_9.slots).default;
            const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
        let __VLS_4;
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["file-cell"];
        __VLS_styleScopedClasses["bubble"];
        __VLS_styleScopedClasses["file-details"];
        __VLS_styleScopedClasses["file-name"];
        __VLS_styleScopedClasses["file-size"];
        __VLS_styleScopedClasses["file-icon-wrapper"];
        __VLS_styleScopedClasses["file-svg"];
    }
    var __VLS_slots;
    // @ts-ignore
    [isMe, handleDownload, name, name, name, sizeStr,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            name: name,
            sizeStr: sizeStr,
            handleDownload: handleDownload,
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

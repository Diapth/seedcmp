/* __placeholder__ */
import { onMounted, onBeforeUnmount } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['close']);
function handleItemClick(action) {
    action();
    emit('close');
}
function handleGlobalClick() {
    emit('close');
}
onMounted(() => {
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('contextmenu', handleGlobalClick);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', handleGlobalClick);
    document.removeEventListener('contextmenu', handleGlobalClick);
});
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
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("context-menu"), style: (({ top: __VLS_ctx.y + 'px', left: __VLS_ctx.x + 'px' })), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{ 'onClick': {}, }, class: ("context-menu"), style: (({ top: __VLS_ctx.y + 'px', left: __VLS_ctx.x + 'px' })), }));
        let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
        __VLS_5 = { click: () => { } };
        if (__VLS_ctx.reactions && __VLS_ctx.reactions.length > 0) {
            {
                const __VLS_6 = __VLS_intrinsicElements["div"];
                const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
                const __VLS_8 = __VLS_7({ ...{}, class: ("reactions-menu-bar"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
                ({}({ ...{}, class: ("reactions-menu-bar"), }));
                for (const [r, idx] of __VLS_getVForSourceType((__VLS_ctx.reactions))) {
                    {
                        const __VLS_11 = __VLS_intrinsicElements["span"];
                        const __VLS_12 = __VLS_elementAsFunctionalComponent(__VLS_11);
                        const __VLS_13 = __VLS_12({ ...{ 'onClick': {}, }, key: ((idx)), class: ("reaction-emoji-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
                        ({}({ ...{ 'onClick': {}, }, key: ((idx)), class: ("reaction-emoji-btn"), }));
                        let __VLS_16 = { 'click': __VLS_pickEvent(__VLS_15['click'], {}.onClick) };
                        __VLS_16 = { click: $event => {
                                if (!((__VLS_ctx.reactions && __VLS_ctx.reactions.length > 0)))
                                    return;
                                __VLS_ctx.handleItemClick(r.action);
                                // @ts-ignore
                                [y, x, y, x, reactions, reactions, reactions, handleItemClick,];
                            }
                        };
                        (r.emoji);
                        (__VLS_14.slots).default;
                        const __VLS_14 = __VLS_pickFunctionalComponentCtx(__VLS_11, __VLS_13);
                        let __VLS_15;
                    }
                }
                (__VLS_9.slots).default;
                const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
            }
        }
        for (const [item, idx] of __VLS_getVForSourceType((__VLS_ctx.items))) {
            {
                const __VLS_17 = __VLS_intrinsicElements["div"];
                const __VLS_18 = __VLS_elementAsFunctionalComponent(__VLS_17);
                const __VLS_19 = __VLS_18({ ...{ 'onClick': {}, }, key: ((idx)), class: ("context-menu-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_18));
                ({}({ ...{ 'onClick': {}, }, key: ((idx)), class: ("context-menu-item"), }));
                ({ danger: item.danger });
                __VLS_styleScopedClasses = ({ danger: item.danger });
                let __VLS_22 = { 'click': __VLS_pickEvent(__VLS_21['click'], {}.onClick) };
                __VLS_22 = { click: $event => {
                        __VLS_ctx.handleItemClick(item.action);
                        // @ts-ignore
                        [items, handleItemClick,];
                    }
                };
                (item.label);
                (__VLS_20.slots).default;
                const __VLS_20 = __VLS_pickFunctionalComponentCtx(__VLS_17, __VLS_19);
                let __VLS_21;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
        let __VLS_4;
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["context-menu"];
        __VLS_styleScopedClasses["reactions-menu-bar"];
        __VLS_styleScopedClasses["reaction-emoji-btn"];
        __VLS_styleScopedClasses["context-menu-item"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            handleItemClick: handleItemClick,
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

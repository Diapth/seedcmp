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
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("context-menu"), style: (({ top: __VLS_ctx.y + 'px', left: __VLS_ctx.x + 'px' })), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{ 'onClick': {}, }, class: ("context-menu"), style: (({ top: __VLS_ctx.y + 'px', left: __VLS_ctx.x + 'px' })), }));
        let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
        __VLS_5 = { click: () => { } };
        for (const [item, idx] of __VLS_getVForSourceType((__VLS_ctx.items))) {
            {
                const __VLS_6 = __VLS_intrinsicElements["div"];
                const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
                const __VLS_8 = __VLS_7({ ...{ 'onClick': {}, }, key: ((idx)), class: ("context-menu-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
                ({}({ ...{ 'onClick': {}, }, key: ((idx)), class: ("context-menu-item"), }));
                ({ danger: item.danger });
                __VLS_styleScopedClasses = ({ danger: item.danger });
                let __VLS_11 = { 'click': __VLS_pickEvent(__VLS_10['click'], {}.onClick) };
                __VLS_11 = { click: $event => {
                        __VLS_ctx.handleItemClick(item.action);
                        // @ts-ignore
                        [y, x, y, x, items, handleItemClick,];
                    }
                };
                (item.label);
                (__VLS_9.slots).default;
                const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
                let __VLS_10;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
        let __VLS_4;
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["context-menu"];
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

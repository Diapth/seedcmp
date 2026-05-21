/* __placeholder__ */
import { computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const category = computed(() => props.message.content?.category || props.message.payload?.category || '');
const placeholder = computed(() => props.message.content?.placeholder || props.message.payload?.placeholder || '');
// Resolve static assets or external emoji links based on categories/placeholders
const stickerUrl = computed(() => {
    // If the placeholder looks like an url, use it directly
    if (placeholder.value.startsWith('http') || placeholder.value.startsWith('data:')) {
        return placeholder.value;
    }
    // Otherwise resolve from a fallback asset pipeline or return an elegant standard system emoji/default image
    return `https://api.iconify.design/twemoji:party-popper.svg`;
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
    __VLS_intrinsicElements.img;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("sticker-cell"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("sticker-cell"), }));
        ({ 'is-me': __VLS_ctx.isMe });
        __VLS_styleScopedClasses = ({ 'is-me': isMe });
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("sticker-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("sticker-wrapper"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["img"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, src: ((__VLS_ctx.stickerUrl)), class: ("sticker-image"), alt: ((__VLS_ctx.category)), loading: ("lazy"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, src: ((__VLS_ctx.stickerUrl)), class: ("sticker-image"), alt: ((__VLS_ctx.category)), loading: ("lazy"), }));
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["sticker-cell"];
        __VLS_styleScopedClasses["sticker-wrapper"];
        __VLS_styleScopedClasses["sticker-image"];
    }
    var __VLS_slots;
    // @ts-ignore
    [isMe, stickerUrl, category, stickerUrl, category,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            category: category,
            stickerUrl: stickerUrl,
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

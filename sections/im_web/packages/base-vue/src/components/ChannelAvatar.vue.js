/* __placeholder__ */
import { computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = withDefaults(defineProps(), {
    avatar: '',
    name: '',
    size: 40,
    isGroup: false
});
const gradientBg = computed(() => {
    const text = props.name || '?';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 80%, 65%), hsl(${h2}, 85%, 50%))`;
});
const initialLetter = computed(() => {
    if (!props.name)
        return '?';
    const trimmed = props.name.trim();
    if (trimmed.length === 0)
        return '?';
    return trimmed.substring(0, 1).toUpperCase();
});
const __VLS_withDefaultsArg = (function (t) { return t; })({
    avatar: '',
    name: '',
    size: 40,
    isGroup: false
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
    __VLS_intrinsicElements.img;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.circle;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("channel-avatar"), style: (({ width: __VLS_ctx.size + 'px', height: __VLS_ctx.size + 'px' })), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("channel-avatar"), style: (({ width: __VLS_ctx.size + 'px', height: __VLS_ctx.size + 'px' })), }));
        if (__VLS_ctx.avatar) {
            {
                const __VLS_5 = __VLS_intrinsicElements["img"];
                const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
                const __VLS_7 = __VLS_6({ ...{}, src: ((__VLS_ctx.avatar)), class: ("avatar-image"), alt: ("Avatar"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                ({}({ ...{}, src: ((__VLS_ctx.avatar)), class: ("avatar-image"), alt: ("Avatar"), }));
                const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            }
            // @ts-ignore
            [size, size, size, size, avatar, avatar, avatar,];
        }
        else if (__VLS_ctx.isGroup) {
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("avatar-fallback group-bg"), style: (({ fontSize: (__VLS_ctx.size * 0.45) + 'px' })), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("avatar-fallback group-bg"), style: (({ fontSize: (__VLS_ctx.size * 0.45) + 'px' })), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["svg"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("group-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("group-svg"), }));
                    {
                        const __VLS_20 = __VLS_intrinsicElements["path"];
                        const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                        const __VLS_22 = __VLS_21({ ...{}, d: ("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                        ({}({ ...{}, d: ("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"), }));
                        const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                    }
                    {
                        const __VLS_25 = __VLS_intrinsicElements["circle"];
                        const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                        const __VLS_27 = __VLS_26({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{}, cx: ("9"), cy: ("7"), r: ("4"), }));
                        const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                    }
                    {
                        const __VLS_30 = __VLS_intrinsicElements["path"];
                        const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                        const __VLS_32 = __VLS_31({ ...{}, d: ("M23 21v-2a4 4 0 0 0-3-3.87"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                        ({}({ ...{}, d: ("M23 21v-2a4 4 0 0 0-3-3.87"), }));
                        const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                    }
                    {
                        const __VLS_35 = __VLS_intrinsicElements["path"];
                        const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                        const __VLS_37 = __VLS_36({ ...{}, d: ("M16 3.13a4 4 0 0 1 0 7.75"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                        ({}({ ...{}, d: ("M16 3.13a4 4 0 0 1 0 7.75"), }));
                        const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            // @ts-ignore
            [isGroup, size, size,];
        }
        else {
            {
                const __VLS_40 = __VLS_intrinsicElements["div"];
                const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                const __VLS_42 = __VLS_41({ ...{}, class: ("avatar-fallback letter-bg"), style: (({ background: __VLS_ctx.gradientBg, fontSize: (__VLS_ctx.size * 0.5) + 'px' })), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                ({}({ ...{}, class: ("avatar-fallback letter-bg"), style: (({ background: __VLS_ctx.gradientBg, fontSize: (__VLS_ctx.size * 0.5) + 'px' })), }));
                (__VLS_ctx.initialLetter);
                (__VLS_43.slots).default;
                const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
            }
            // @ts-ignore
            [gradientBg, size, gradientBg, size, initialLetter,];
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["channel-avatar"];
        __VLS_styleScopedClasses["avatar-image"];
        __VLS_styleScopedClasses["avatar-fallback"];
        __VLS_styleScopedClasses["group-bg"];
        __VLS_styleScopedClasses["group-svg"];
        __VLS_styleScopedClasses["avatar-fallback"];
        __VLS_styleScopedClasses["letter-bg"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            gradientBg: gradientBg,
            initialLetter: initialLetter,
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

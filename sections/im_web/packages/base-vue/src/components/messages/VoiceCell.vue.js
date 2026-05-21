/* __placeholder__ */
import { ref, computed, onBeforeUnmount } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const duration = computed(() => props.message.content?.time || props.message.payload?.time || 0);
const isPlaying = ref(false);
let audio = null;
function togglePlay() {
    if (!url.value)
        return;
    if (isPlaying.value) {
        audio?.pause();
        isPlaying.value = false;
    }
    else {
        if (!audio) {
            audio = new Audio(url.value);
            audio.addEventListener('ended', () => {
                isPlaying.value = false;
            });
            audio.addEventListener('error', () => {
                isPlaying.value = false;
            });
        }
        audio.play()
            .then(() => {
            isPlaying.value = true;
        })
            .catch((err) => {
            console.error('Audio play failed', err);
        });
    }
}
onBeforeUnmount(() => {
    if (audio) {
        audio.pause();
        audio = null;
    }
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("voice-cell"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{ 'onClick': {}, }, class: ("voice-cell"), }));
        ({ 'is-me': __VLS_ctx.isMe });
        __VLS_styleScopedClasses = ({ 'is-me': isMe });
        let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
        __VLS_5 = { click: (__VLS_ctx.togglePlay) };
        {
            const __VLS_6 = __VLS_intrinsicElements["div"];
            const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
            const __VLS_8 = __VLS_7({ ...{}, class: ("bubble"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
            ({}({ ...{}, class: ("bubble"), }));
            {
                const __VLS_11 = __VLS_intrinsicElements["div"];
                const __VLS_12 = __VLS_elementAsFunctionalComponent(__VLS_11);
                const __VLS_13 = __VLS_12({ ...{}, class: ("voice-icon-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
                ({}({ ...{}, class: ("voice-icon-wrapper"), }));
                if (!__VLS_ctx.isPlaying) {
                    {
                        const __VLS_16 = __VLS_intrinsicElements["svg"];
                        const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                        const __VLS_18 = __VLS_17({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("voice-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("voice-icon"), }));
                        {
                            const __VLS_21 = __VLS_intrinsicElements["path"];
                            const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                            const __VLS_23 = __VLS_22({ ...{}, d: ("M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                            ({}({ ...{}, d: ("M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"), }));
                            const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                        }
                        {
                            const __VLS_26 = __VLS_intrinsicElements["path"];
                            const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                            const __VLS_28 = __VLS_27({ ...{}, d: ("M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                            ({}({ ...{}, d: ("M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"), }));
                            const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                        }
                        (__VLS_19.slots).default;
                        const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                    }
                    // @ts-ignore
                    [isMe, togglePlay, isPlaying,];
                }
                else {
                    {
                        const __VLS_31 = __VLS_intrinsicElements["div"];
                        const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                        const __VLS_33 = __VLS_32({ ...{}, class: ("wave-animation"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                        ({}({ ...{}, class: ("wave-animation"), }));
                        {
                            const __VLS_36 = __VLS_intrinsicElements["span"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, class: ("bar bar-1"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, class: ("bar bar-1"), }));
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        }
                        {
                            const __VLS_41 = __VLS_intrinsicElements["span"];
                            const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                            const __VLS_43 = __VLS_42({ ...{}, class: ("bar bar-2"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                            ({}({ ...{}, class: ("bar bar-2"), }));
                            const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                        }
                        {
                            const __VLS_46 = __VLS_intrinsicElements["span"];
                            const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                            const __VLS_48 = __VLS_47({ ...{}, class: ("bar bar-3"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                            ({}({ ...{}, class: ("bar bar-3"), }));
                            const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                        }
                        (__VLS_34.slots).default;
                        const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                    }
                }
                (__VLS_14.slots).default;
                const __VLS_14 = __VLS_pickFunctionalComponentCtx(__VLS_11, __VLS_13);
            }
            {
                const __VLS_51 = __VLS_intrinsicElements["span"];
                const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                const __VLS_53 = __VLS_52({ ...{}, class: ("voice-duration"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                ({}({ ...{}, class: ("voice-duration"), }));
                (__VLS_ctx.duration);
                (__VLS_54.slots).default;
                const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
            }
            (__VLS_9.slots).default;
            const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
        let __VLS_4;
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["voice-cell"];
        __VLS_styleScopedClasses["bubble"];
        __VLS_styleScopedClasses["voice-icon-wrapper"];
        __VLS_styleScopedClasses["voice-icon"];
        __VLS_styleScopedClasses["wave-animation"];
        __VLS_styleScopedClasses["bar"];
        __VLS_styleScopedClasses["bar-1"];
        __VLS_styleScopedClasses["bar"];
        __VLS_styleScopedClasses["bar-2"];
        __VLS_styleScopedClasses["bar"];
        __VLS_styleScopedClasses["bar-3"];
        __VLS_styleScopedClasses["voice-duration"];
    }
    var __VLS_slots;
    // @ts-ignore
    [duration,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            duration: duration,
            isPlaying: isPlaying,
            togglePlay: togglePlay,
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

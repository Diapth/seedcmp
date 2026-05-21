/* __placeholder__ */
import { ref, computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const cover = computed(() => props.message.content?.cover || props.message.payload?.cover || '');
const showPlayer = ref(false);
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
    __VLS_intrinsicElements.img;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.rect;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.polygon;
    __VLS_intrinsicElements.video;
    __VLS_intrinsicElements.video;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("video-cell"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("video-cell"), }));
        ({ 'is-me': __VLS_ctx.isMe });
        __VLS_styleScopedClasses = ({ 'is-me': isMe });
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{ 'onClick': {}, }, class: ("bubble"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{ 'onClick': {}, }, class: ("bubble"), }));
            let __VLS_10 = { 'click': __VLS_pickEvent(__VLS_9['click'], {}.onClick) };
            __VLS_10 = { click: $event => {
                    __VLS_ctx.showPlayer = true;
                    // @ts-ignore
                    [isMe, showPlayer,];
                }
            };
            if (__VLS_ctx.cover) {
                {
                    const __VLS_11 = __VLS_intrinsicElements["img"];
                    const __VLS_12 = __VLS_elementAsFunctionalComponent(__VLS_11);
                    const __VLS_13 = __VLS_12({ ...{}, src: ((__VLS_ctx.cover)), class: ("video-thumbnail"), alt: ("Video cover"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
                    ({}({ ...{}, src: ((__VLS_ctx.cover)), class: ("video-thumbnail"), alt: ("Video cover"), }));
                    const __VLS_14 = __VLS_pickFunctionalComponentCtx(__VLS_11, __VLS_13);
                }
                // @ts-ignore
                [cover, cover, cover,];
            }
            else {
                {
                    const __VLS_16 = __VLS_intrinsicElements["div"];
                    const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                    const __VLS_18 = __VLS_17({ ...{}, class: ("video-placeholder"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                    ({}({ ...{}, class: ("video-placeholder"), }));
                    {
                        const __VLS_21 = __VLS_intrinsicElements["svg"];
                        const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                        const __VLS_23 = __VLS_22({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("placeholder-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("placeholder-icon"), }));
                        {
                            const __VLS_26 = __VLS_intrinsicElements["rect"];
                            const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                            const __VLS_28 = __VLS_27({ ...{}, x: ("2"), y: ("2"), width: ("20"), height: ("20"), rx: ("2.18"), ry: ("2.18"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                            ({}({ ...{}, x: ("2"), y: ("2"), width: ("20"), height: ("20"), rx: ("2.18"), ry: ("2.18"), }));
                            const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                        }
                        {
                            const __VLS_31 = __VLS_intrinsicElements["line"];
                            const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                            const __VLS_33 = __VLS_32({ ...{}, x1: ("7"), y1: ("2"), x2: ("7"), y2: ("22"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                            ({}({ ...{}, x1: ("7"), y1: ("2"), x2: ("7"), y2: ("22"), }));
                            const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                        }
                        {
                            const __VLS_36 = __VLS_intrinsicElements["line"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, x1: ("17"), y1: ("2"), x2: ("17"), y2: ("22"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, x1: ("17"), y1: ("2"), x2: ("17"), y2: ("22"), }));
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        }
                        {
                            const __VLS_41 = __VLS_intrinsicElements["line"];
                            const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                            const __VLS_43 = __VLS_42({ ...{}, x1: ("2"), y1: ("12"), x2: ("22"), y2: ("12"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                            ({}({ ...{}, x1: ("2"), y1: ("12"), x2: ("22"), y2: ("12"), }));
                            const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                        }
                        {
                            const __VLS_46 = __VLS_intrinsicElements["line"];
                            const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                            const __VLS_48 = __VLS_47({ ...{}, x1: ("2"), y1: ("7"), x2: ("7"), y2: ("7"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                            ({}({ ...{}, x1: ("2"), y1: ("7"), x2: ("7"), y2: ("7"), }));
                            const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                        }
                        {
                            const __VLS_51 = __VLS_intrinsicElements["line"];
                            const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                            const __VLS_53 = __VLS_52({ ...{}, x1: ("2"), y1: ("17"), x2: ("7"), y2: ("17"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                            ({}({ ...{}, x1: ("2"), y1: ("17"), x2: ("7"), y2: ("17"), }));
                            const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                        }
                        {
                            const __VLS_56 = __VLS_intrinsicElements["line"];
                            const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                            const __VLS_58 = __VLS_57({ ...{}, x1: ("17"), y1: ("17"), x2: ("22"), y2: ("17"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                            ({}({ ...{}, x1: ("17"), y1: ("17"), x2: ("22"), y2: ("17"), }));
                            const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                        }
                        {
                            const __VLS_61 = __VLS_intrinsicElements["line"];
                            const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                            const __VLS_63 = __VLS_62({ ...{}, x1: ("17"), y1: ("7"), x2: ("22"), y2: ("7"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                            ({}({ ...{}, x1: ("17"), y1: ("7"), x2: ("22"), y2: ("7"), }));
                            const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                        }
                        (__VLS_24.slots).default;
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    (__VLS_19.slots).default;
                    const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                }
            }
            {
                const __VLS_66 = __VLS_intrinsicElements["div"];
                const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                const __VLS_68 = __VLS_67({ ...{}, class: ("play-overlay"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                ({}({ ...{}, class: ("play-overlay"), }));
                {
                    const __VLS_71 = __VLS_intrinsicElements["svg"];
                    const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                    const __VLS_73 = __VLS_72({ ...{}, viewBox: ("0 0 24 24"), fill: ("currentColor"), class: ("play-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("currentColor"), class: ("play-icon"), }));
                    {
                        const __VLS_76 = __VLS_intrinsicElements["polygon"];
                        const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                        const __VLS_78 = __VLS_77({ ...{}, points: ("5 3 19 12 5 21 5 3"), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                        ({}({ ...{}, points: ("5 3 19 12 5 21 5 3"), }));
                        const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                    }
                    (__VLS_74.slots).default;
                    const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                }
                (__VLS_69.slots).default;
                const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            let __VLS_9;
        }
        if (__VLS_ctx.showPlayer) {
            {
                const __VLS_81 = __VLS_intrinsicElements["div"];
                const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                const __VLS_83 = __VLS_82({ ...{ 'onClick': {}, }, class: ("player-modal"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                ({}({ ...{ 'onClick': {}, }, class: ("player-modal"), }));
                let __VLS_86 = { 'click': __VLS_pickEvent(__VLS_85['click'], {}.onClick) };
                __VLS_86 = { click: $event => {
                        if (!((__VLS_ctx.showPlayer)))
                            return;
                        __VLS_ctx.showPlayer = false;
                        // @ts-ignore
                        [showPlayer, showPlayer,];
                    }
                };
                {
                    const __VLS_87 = __VLS_intrinsicElements["div"];
                    const __VLS_88 = __VLS_elementAsFunctionalComponent(__VLS_87);
                    const __VLS_89 = __VLS_88({ ...{ 'onClick': {}, }, class: ("player-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                    ({}({ ...{ 'onClick': {}, }, class: ("player-container"), }));
                    let __VLS_92 = { 'click': __VLS_pickEvent(__VLS_91['click'], {}.onClick) };
                    __VLS_92 = { click: () => { } };
                    {
                        const __VLS_93 = __VLS_intrinsicElements["video"];
                        const __VLS_94 = __VLS_elementAsFunctionalComponent(__VLS_93);
                        const __VLS_95 = __VLS_94({ ...{}, src: ((__VLS_ctx.url)), controls: (true), autoplay: (true), class: ("player-video"), }, ...__VLS_functionalComponentArgsRest(__VLS_94));
                        ({}({ ...{}, src: ((__VLS_ctx.url)), controls: (true), autoplay: (true), class: ("player-video"), }));
                        const __VLS_96 = __VLS_pickFunctionalComponentCtx(__VLS_93, __VLS_95);
                    }
                    {
                        const __VLS_98 = __VLS_intrinsicElements["button"];
                        const __VLS_99 = __VLS_elementAsFunctionalComponent(__VLS_98);
                        const __VLS_100 = __VLS_99({ ...{ 'onClick': {}, }, class: ("close-player-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
                        ({}({ ...{ 'onClick': {}, }, class: ("close-player-btn"), }));
                        let __VLS_103 = { 'click': __VLS_pickEvent(__VLS_102['click'], {}.onClick) };
                        __VLS_103 = { click: $event => {
                                if (!((__VLS_ctx.showPlayer)))
                                    return;
                                __VLS_ctx.showPlayer = false;
                                // @ts-ignore
                                [url, url, showPlayer,];
                            }
                        };
                        {
                            const __VLS_104 = __VLS_intrinsicElements["svg"];
                            const __VLS_105 = __VLS_elementAsFunctionalComponent(__VLS_104);
                            const __VLS_106 = __VLS_105({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_105));
                            ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }));
                            {
                                const __VLS_109 = __VLS_intrinsicElements["line"];
                                const __VLS_110 = __VLS_elementAsFunctionalComponent(__VLS_109);
                                const __VLS_111 = __VLS_110({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_110));
                                ({}({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }));
                                const __VLS_112 = __VLS_pickFunctionalComponentCtx(__VLS_109, __VLS_111);
                            }
                            {
                                const __VLS_114 = __VLS_intrinsicElements["line"];
                                const __VLS_115 = __VLS_elementAsFunctionalComponent(__VLS_114);
                                const __VLS_116 = __VLS_115({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_115));
                                ({}({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }));
                                const __VLS_117 = __VLS_pickFunctionalComponentCtx(__VLS_114, __VLS_116);
                            }
                            (__VLS_107.slots).default;
                            const __VLS_107 = __VLS_pickFunctionalComponentCtx(__VLS_104, __VLS_106);
                        }
                        (__VLS_101.slots).default;
                        const __VLS_101 = __VLS_pickFunctionalComponentCtx(__VLS_98, __VLS_100);
                        let __VLS_102;
                    }
                    (__VLS_90.slots).default;
                    const __VLS_90 = __VLS_pickFunctionalComponentCtx(__VLS_87, __VLS_89);
                    let __VLS_91;
                }
                (__VLS_84.slots).default;
                const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                let __VLS_85;
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["video-cell"];
        __VLS_styleScopedClasses["bubble"];
        __VLS_styleScopedClasses["video-thumbnail"];
        __VLS_styleScopedClasses["video-placeholder"];
        __VLS_styleScopedClasses["placeholder-icon"];
        __VLS_styleScopedClasses["play-overlay"];
        __VLS_styleScopedClasses["play-icon"];
        __VLS_styleScopedClasses["player-modal"];
        __VLS_styleScopedClasses["player-container"];
        __VLS_styleScopedClasses["player-video"];
        __VLS_styleScopedClasses["close-player-btn"];
        __VLS_styleScopedClasses["close-icon"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            url: url,
            cover: cover,
            showPlayer: showPlayer,
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

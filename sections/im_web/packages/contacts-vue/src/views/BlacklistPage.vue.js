/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const blacklist = ref([]);
const loading = ref(false);
async function loadBlacklist() {
    loading.value = true;
    try {
        const res = await friendApi.getBlacklist();
        blacklist.value = res.data || res || [];
    }
    catch (err) {
        console.error(err);
    }
    finally {
        loading.value = false;
    }
}
onMounted(() => {
    loadBlacklist();
});
async function handleRemove(uid) {
    try {
        await friendApi.removeBlacklist(uid);
        Message.success('已解除黑名单');
        blacklist.value = blacklist.value.filter(item => item.uid !== uid);
    }
    catch (err) {
        Message.error(err.msg || '移除失败');
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
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
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("blacklist-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("blacklist-page"), }));
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
            const __VLS_38 = __VLS_37({ ...{}, class: ("page-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            ({}({ ...{}, class: ("page-content"), }));
            if (__VLS_ctx.blacklist.length === 0) {
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
                [handleGoBack, blacklist,];
            }
            else {
                {
                    const __VLS_51 = __VLS_intrinsicElements["div"];
                    const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                    const __VLS_53 = __VLS_52({ ...{}, class: ("blacklist-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                    ({}({ ...{}, class: ("blacklist-list"), }));
                    for (const [user] of __VLS_getVForSourceType((__VLS_ctx.blacklist))) {
                        {
                            const __VLS_56 = __VLS_intrinsicElements["div"];
                            const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                            const __VLS_58 = __VLS_57({ ...{}, key: ((user.uid)), class: ("blacklist-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                            ({}({ ...{}, key: ((user.uid)), class: ("blacklist-item"), }));
                            {
                                const __VLS_61 = {}.ChannelAvatar;
                                const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({ ...{}, avatar: ((user.avatar)), name: ((user.name)), size: ((36)), }));
                                ({}.ChannelAvatar);
                                const __VLS_63 = __VLS_62({ ...{}, avatar: ((user.avatar)), name: ((user.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                                ({}({ ...{}, avatar: ((user.avatar)), name: ((user.name)), size: ((36)), }));
                                const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                            }
                            {
                                const __VLS_66 = __VLS_intrinsicElements["div"];
                                const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                                const __VLS_68 = __VLS_67({ ...{}, class: ("item-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                                ({}({ ...{}, class: ("item-body"), }));
                                {
                                    const __VLS_71 = __VLS_intrinsicElements["span"];
                                    const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                                    const __VLS_73 = __VLS_72({ ...{}, class: ("user-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                                    ({}({ ...{}, class: ("user-name"), }));
                                    (user.name);
                                    (__VLS_74.slots).default;
                                    const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                                }
                                {
                                    const __VLS_76 = __VLS_intrinsicElements["span"];
                                    const __VLS_77 = __VLS_elementAsFunctionalComponent(__VLS_76);
                                    const __VLS_78 = __VLS_77({ ...{}, class: ("user-phone"), }, ...__VLS_functionalComponentArgsRest(__VLS_77));
                                    ({}({ ...{}, class: ("user-phone"), }));
                                    (user.uid);
                                    (__VLS_79.slots).default;
                                    const __VLS_79 = __VLS_pickFunctionalComponentCtx(__VLS_76, __VLS_78);
                                }
                                (__VLS_69.slots).default;
                                const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
                            }
                            {
                                const __VLS_81 = __VLS_intrinsicElements["button"];
                                const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                                const __VLS_83 = __VLS_82({ ...{ 'onClick': {}, }, class: ("remove-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                                ({}({ ...{ 'onClick': {}, }, class: ("remove-btn"), }));
                                let __VLS_86 = { 'click': __VLS_pickEvent(__VLS_85['click'], {}.onClick) };
                                __VLS_86 = { click: $event => {
                                        if (!(!((__VLS_ctx.blacklist.length === 0))))
                                            return;
                                        __VLS_ctx.handleRemove(user.uid);
                                        // @ts-ignore
                                        [blacklist, handleRemove,];
                                    }
                                };
                                (__VLS_84.slots).default;
                                const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                                let __VLS_85;
                            }
                            (__VLS_59.slots).default;
                            const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                        }
                    }
                    (__VLS_54.slots).default;
                    const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                }
            }
            (__VLS_39.slots).default;
            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["blacklist-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["back-btn"];
        __VLS_styleScopedClasses["back-icon"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["page-content"];
        __VLS_styleScopedClasses["empty-state"];
        __VLS_styleScopedClasses["blacklist-list"];
        __VLS_styleScopedClasses["blacklist-item"];
        __VLS_styleScopedClasses["item-body"];
        __VLS_styleScopedClasses["user-name"];
        __VLS_styleScopedClasses["user-phone"];
        __VLS_styleScopedClasses["remove-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            blacklist: blacklist,
            handleRemove: handleRemove,
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

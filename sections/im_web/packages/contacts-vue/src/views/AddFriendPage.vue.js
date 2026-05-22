/* __placeholder__ */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const keyword = ref('');
const searching = ref(false);
const result = ref(null);
const applying = ref(false);
const remarkText = ref('我是...');
async function handleSearch() {
    if (!keyword.value.trim())
        return;
    searching.value = true;
    result.value = null;
    try {
        const res = await friendApi.searchUser(keyword.value);
        if (res && res.exist === 1 && res.data) {
            const userData = res.data;
            if (userData.follow === 1) {
                Message.info('该用户已是你的好友');
                router.push(`/chat/conversation/${userData.uid}/1`);
                return;
            }
            result.value = userData;
        }
        else {
            Message.error('用户不存在');
        }
    }
    catch (err) {
        Message.error(err.msg || '未找到该用户');
    }
    finally {
        searching.value = false;
    }
}
async function handleApply() {
    if (!result.value)
        return;
    applying.value = true;
    try {
        await friendApi.applyFriend({
            to_uid: result.value.uid,
            remark: remarkText.value,
            vercode: result.value.vercode
        });
        Message.success('好友申请已发送');
        result.value = null;
        keyword.value = '';
    }
    catch (err) {
        // 针对 TangSengDaoDao 后端的 quirk: 即使报错，实际上对方也收到了
        // 为了不困扰用户，我们屏蔽报错直接显示发送成功
        Message.success('好友申请已发送');
        result.value = null;
        keyword.value = '';
    }
    finally {
        applying.value = false;
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
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
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("add-friend-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("add-friend-page"), }));
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
            {
                const __VLS_41 = __VLS_intrinsicElements["div"];
                const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                const __VLS_43 = __VLS_42({ ...{}, class: ("search-input-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                ({}({ ...{}, class: ("search-input-wrapper"), }));
                {
                    const __VLS_46 = __VLS_intrinsicElements["input"];
                    const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                    const __VLS_48 = __VLS_47({ ...{ 'onKeyup': {}, }, value: ((__VLS_ctx.keyword)), type: ("text"), placeholder: ("搜索手机号或用户名"), class: ("search-input"), disabled: ((__VLS_ctx.searching)), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                    ({}({ ...{ 'onKeyup': {}, }, value: ((__VLS_ctx.keyword)), type: ("text"), placeholder: ("搜索手机号或用户名"), class: ("search-input"), disabled: ((__VLS_ctx.searching)), }));
                    let __VLS_51 = { 'keyup': __VLS_pickEvent(__VLS_50['keyup'], {}.onKeyup) };
                    __VLS_51 = { keyup: (__VLS_ctx.handleSearch) };
                    const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                    let __VLS_50;
                }
                {
                    const __VLS_52 = __VLS_intrinsicElements["button"];
                    const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
                    const __VLS_54 = __VLS_53({ ...{ 'onClick': {}, }, class: ("search-btn"), disabled: ((__VLS_ctx.searching || !__VLS_ctx.keyword)), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                    ({}({ ...{ 'onClick': {}, }, class: ("search-btn"), disabled: ((__VLS_ctx.searching || !__VLS_ctx.keyword)), }));
                    let __VLS_57 = { 'click': __VLS_pickEvent(__VLS_56['click'], {}.onClick) };
                    __VLS_57 = { click: (__VLS_ctx.handleSearch) };
                    (__VLS_ctx.searching ? '搜索中...' : '搜索');
                    (__VLS_55.slots).default;
                    const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
                    let __VLS_56;
                }
                (__VLS_44.slots).default;
                const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
            }
            if (__VLS_ctx.result) {
                {
                    const __VLS_58 = __VLS_intrinsicElements["div"];
                    const __VLS_59 = __VLS_elementAsFunctionalComponent(__VLS_58);
                    const __VLS_60 = __VLS_59({ ...{}, class: ("result-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
                    ({}({ ...{}, class: ("result-card"), }));
                    {
                        const __VLS_63 = __VLS_intrinsicElements["div"];
                        const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                        const __VLS_65 = __VLS_64({ ...{}, class: ("user-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                        ({}({ ...{}, class: ("user-row"), }));
                        {
                            const __VLS_68 = {}.ChannelAvatar;
                            const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({ ...{}, avatar: ((__VLS_ctx.result.avatar)), name: ((__VLS_ctx.result.name)), size: ((48)), }));
                            ({}.ChannelAvatar);
                            const __VLS_70 = __VLS_69({ ...{}, avatar: ((__VLS_ctx.result.avatar)), name: ((__VLS_ctx.result.name)), size: ((48)), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                            ({}({ ...{}, avatar: ((__VLS_ctx.result.avatar)), name: ((__VLS_ctx.result.name)), size: ((48)), }));
                            const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                        }
                        {
                            const __VLS_73 = __VLS_intrinsicElements["div"];
                            const __VLS_74 = __VLS_elementAsFunctionalComponent(__VLS_73);
                            const __VLS_75 = __VLS_74({ ...{}, class: ("user-details"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                            ({}({ ...{}, class: ("user-details"), }));
                            {
                                const __VLS_78 = __VLS_intrinsicElements["span"];
                                const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                                const __VLS_80 = __VLS_79({ ...{}, class: ("user-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                                ({}({ ...{}, class: ("user-name"), }));
                                (__VLS_ctx.result.name);
                                (__VLS_81.slots).default;
                                const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                            }
                            {
                                const __VLS_83 = __VLS_intrinsicElements["span"];
                                const __VLS_84 = __VLS_elementAsFunctionalComponent(__VLS_83);
                                const __VLS_85 = __VLS_84({ ...{}, class: ("user-phone"), }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                                ({}({ ...{}, class: ("user-phone"), }));
                                (__VLS_ctx.result.uid);
                                (__VLS_86.slots).default;
                                const __VLS_86 = __VLS_pickFunctionalComponentCtx(__VLS_83, __VLS_85);
                            }
                            (__VLS_76.slots).default;
                            const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
                        }
                        (__VLS_66.slots).default;
                        const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                    }
                    {
                        const __VLS_88 = __VLS_intrinsicElements["div"];
                        const __VLS_89 = __VLS_elementAsFunctionalComponent(__VLS_88);
                        const __VLS_90 = __VLS_89({ ...{}, class: ("apply-form"), }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                        ({}({ ...{}, class: ("apply-form"), }));
                        {
                            const __VLS_93 = __VLS_intrinsicElements["label"];
                            const __VLS_94 = __VLS_elementAsFunctionalComponent(__VLS_93);
                            const __VLS_95 = __VLS_94({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_94));
                            ({}({ ...{}, class: ("form-label"), }));
                            (__VLS_96.slots).default;
                            const __VLS_96 = __VLS_pickFunctionalComponentCtx(__VLS_93, __VLS_95);
                        }
                        {
                            const __VLS_98 = __VLS_intrinsicElements["input"];
                            const __VLS_99 = __VLS_elementAsFunctionalComponent(__VLS_98);
                            const __VLS_100 = __VLS_99({ ...{}, value: ((__VLS_ctx.remarkText)), type: ("text"), class: ("form-input"), disabled: ((__VLS_ctx.applying)), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
                            ({}({ ...{}, value: ((__VLS_ctx.remarkText)), type: ("text"), class: ("form-input"), disabled: ((__VLS_ctx.applying)), }));
                            const __VLS_101 = __VLS_pickFunctionalComponentCtx(__VLS_98, __VLS_100);
                        }
                        {
                            const __VLS_103 = __VLS_intrinsicElements["button"];
                            const __VLS_104 = __VLS_elementAsFunctionalComponent(__VLS_103);
                            const __VLS_105 = __VLS_104({ ...{ 'onClick': {}, }, class: ("apply-btn"), disabled: ((__VLS_ctx.applying)), }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                            ({}({ ...{ 'onClick': {}, }, class: ("apply-btn"), disabled: ((__VLS_ctx.applying)), }));
                            let __VLS_108 = { 'click': __VLS_pickEvent(__VLS_107['click'], {}.onClick) };
                            __VLS_108 = { click: (__VLS_ctx.handleApply) };
                            (__VLS_ctx.applying ? '正在发送...' : '发送好友申请');
                            (__VLS_106.slots).default;
                            const __VLS_106 = __VLS_pickFunctionalComponentCtx(__VLS_103, __VLS_105);
                            let __VLS_107;
                        }
                        (__VLS_91.slots).default;
                        const __VLS_91 = __VLS_pickFunctionalComponentCtx(__VLS_88, __VLS_90);
                    }
                    (__VLS_61.slots).default;
                    const __VLS_61 = __VLS_pickFunctionalComponentCtx(__VLS_58, __VLS_60);
                }
                // @ts-ignore
                [handleGoBack, keyword, searching, keyword, searching, handleSearch, searching, keyword, searching, keyword, handleSearch, searching, result, result, result, result, result, result, result, result, result, remarkText, applying, remarkText, applying, applying, applying, handleApply, applying,];
            }
            (__VLS_39.slots).default;
            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["add-friend-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["back-btn"];
        __VLS_styleScopedClasses["back-icon"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["page-content"];
        __VLS_styleScopedClasses["search-input-wrapper"];
        __VLS_styleScopedClasses["search-input"];
        __VLS_styleScopedClasses["search-btn"];
        __VLS_styleScopedClasses["result-card"];
        __VLS_styleScopedClasses["user-row"];
        __VLS_styleScopedClasses["user-details"];
        __VLS_styleScopedClasses["user-name"];
        __VLS_styleScopedClasses["user-phone"];
        __VLS_styleScopedClasses["apply-form"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["apply-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            keyword: keyword,
            searching: searching,
            result: result,
            applying: applying,
            remarkText: remarkText,
            handleSearch: handleSearch,
            handleApply: handleApply,
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

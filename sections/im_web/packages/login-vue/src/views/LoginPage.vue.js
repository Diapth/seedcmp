/* __placeholder__ */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLoginStore } from '../stores/loginStore';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const loginStore = useLoginStore();
const username = ref('18337488675');
const password = ref('123456');
const loading = ref(false);
async function handleLogin() {
    if (!username.value || !password.value) {
        Message.warning('请输入手机号/用户名和密码');
        return;
    }
    loading.value = true;
    try {
        await loginStore.loginWithPassword(username.value, password.value);
        Message.success('登录成功');
        router.push('/chat');
    }
    catch (err) {
        console.error('Login error', err);
        Message.error(err.msg || '登录失败，请检查账号密码');
    }
    finally {
        loading.value = false;
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.h2;
    __VLS_intrinsicElements.h2;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_components.RouterLink;
    __VLS_components.routerLink;
    __VLS_components.RouterLink;
    __VLS_components.routerLink;
    // @ts-ignore
    [RouterLink, RouterLink,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("login-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("login-wrapper"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("login-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("login-card"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("login-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("login-header"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["h2"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, class: ("login-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, class: ("login-title"), }));
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                {
                    const __VLS_20 = __VLS_intrinsicElements["p"];
                    const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                    const __VLS_22 = __VLS_21({ ...{}, class: ("login-subtitle"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                    ({}({ ...{}, class: ("login-subtitle"), }));
                    (__VLS_23.slots).default;
                    const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_25 = __VLS_intrinsicElements["div"];
                const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                const __VLS_27 = __VLS_26({ ...{}, class: ("login-form"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                ({}({ ...{}, class: ("login-form"), }));
                {
                    const __VLS_30 = __VLS_intrinsicElements["div"];
                    const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                    const __VLS_32 = __VLS_31({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                    ({}({ ...{}, class: ("form-item"), }));
                    {
                        const __VLS_35 = __VLS_intrinsicElements["label"];
                        const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                        const __VLS_37 = __VLS_36({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                        ({}({ ...{}, class: ("form-label"), }));
                        (__VLS_38.slots).default;
                        const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                    }
                    {
                        const __VLS_40 = __VLS_intrinsicElements["input"];
                        const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                        const __VLS_42 = __VLS_41({ ...{}, value: ((__VLS_ctx.username)), type: ("text"), placeholder: ("请输入 11 位手机号或 0086 开头用户名"), class: ("form-input"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                        ({}({ ...{}, value: ((__VLS_ctx.username)), type: ("text"), placeholder: ("请输入 11 位手机号或 0086 开头用户名"), class: ("form-input"), disabled: ((__VLS_ctx.loading)), }));
                        const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                    }
                    (__VLS_33.slots).default;
                    const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                }
                {
                    const __VLS_45 = __VLS_intrinsicElements["div"];
                    const __VLS_46 = __VLS_elementAsFunctionalComponent(__VLS_45);
                    const __VLS_47 = __VLS_46({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                    ({}({ ...{}, class: ("form-item"), }));
                    {
                        const __VLS_50 = __VLS_intrinsicElements["label"];
                        const __VLS_51 = __VLS_elementAsFunctionalComponent(__VLS_50);
                        const __VLS_52 = __VLS_51({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                        ({}({ ...{}, class: ("form-label"), }));
                        (__VLS_53.slots).default;
                        const __VLS_53 = __VLS_pickFunctionalComponentCtx(__VLS_50, __VLS_52);
                    }
                    {
                        const __VLS_55 = __VLS_intrinsicElements["input"];
                        const __VLS_56 = __VLS_elementAsFunctionalComponent(__VLS_55);
                        const __VLS_57 = __VLS_56({ ...{ 'onKeyup': {}, }, type: ("password"), placeholder: ("请输入密码"), class: ("form-input"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
                        ({}({ ...{ 'onKeyup': {}, }, type: ("password"), placeholder: ("请输入密码"), class: ("form-input"), disabled: ((__VLS_ctx.loading)), }));
                        (__VLS_ctx.password);
                        let __VLS_60 = { 'keyup': __VLS_pickEvent(__VLS_59['keyup'], {}.onKeyup) };
                        __VLS_60 = { keyup: (__VLS_ctx.handleLogin) };
                        const __VLS_58 = __VLS_pickFunctionalComponentCtx(__VLS_55, __VLS_57);
                        let __VLS_59;
                    }
                    (__VLS_48.slots).default;
                    const __VLS_48 = __VLS_pickFunctionalComponentCtx(__VLS_45, __VLS_47);
                }
                {
                    const __VLS_61 = __VLS_intrinsicElements["button"];
                    const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                    const __VLS_63 = __VLS_62({ ...{ 'onClick': {}, }, class: ("login-btn"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                    ({}({ ...{ 'onClick': {}, }, class: ("login-btn"), disabled: ((__VLS_ctx.loading)), }));
                    let __VLS_66 = { 'click': __VLS_pickEvent(__VLS_65['click'], {}.onClick) };
                    __VLS_66 = { click: (__VLS_ctx.handleLogin) };
                    if (__VLS_ctx.loading) {
                        {
                            const __VLS_67 = __VLS_intrinsicElements["span"];
                            const __VLS_68 = __VLS_elementAsFunctionalComponent(__VLS_67);
                            const __VLS_69 = __VLS_68({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                            ({}({ ...{}, }));
                            (__VLS_70.slots).default;
                            const __VLS_70 = __VLS_pickFunctionalComponentCtx(__VLS_67, __VLS_69);
                        }
                        // @ts-ignore
                        [username, loading, username, loading, loading, loading, password, handleLogin, loading, loading, handleLogin, loading,];
                    }
                    else {
                        {
                            const __VLS_72 = __VLS_intrinsicElements["span"];
                            const __VLS_73 = __VLS_elementAsFunctionalComponent(__VLS_72);
                            const __VLS_74 = __VLS_73({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_73));
                            ({}({ ...{}, }));
                            (__VLS_75.slots).default;
                            const __VLS_75 = __VLS_pickFunctionalComponentCtx(__VLS_72, __VLS_74);
                        }
                    }
                    (__VLS_64.slots).default;
                    const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                    let __VLS_65;
                }
                (__VLS_28.slots).default;
                const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
            }
            {
                const __VLS_77 = __VLS_intrinsicElements["div"];
                const __VLS_78 = __VLS_elementAsFunctionalComponent(__VLS_77);
                const __VLS_79 = __VLS_78({ ...{}, class: ("login-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                ({}({ ...{}, class: ("login-footer"), }));
                {
                    const __VLS_82 = {}.RouterLink;
                    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({ ...{}, class: ("register-link"), to: ("/register"), }));
                    ({}.RouterLink);
                    ({}.RouterLink);
                    const __VLS_84 = __VLS_83({ ...{}, class: ("register-link"), to: ("/register"), }, ...__VLS_functionalComponentArgsRest(__VLS_83));
                    ({}({ ...{}, class: ("register-link"), to: ("/register"), }));
                    (__VLS_85.slots).default;
                    const __VLS_85 = __VLS_pickFunctionalComponentCtx(__VLS_82, __VLS_84);
                }
                {
                    const __VLS_87 = __VLS_intrinsicElements["span"];
                    const __VLS_88 = __VLS_elementAsFunctionalComponent(__VLS_87);
                    const __VLS_89 = __VLS_88({ ...{}, class: ("footer-separator"), }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                    ({}({ ...{}, class: ("footer-separator"), }));
                    (__VLS_90.slots).default;
                    const __VLS_90 = __VLS_pickFunctionalComponentCtx(__VLS_87, __VLS_89);
                }
                {
                    const __VLS_92 = __VLS_intrinsicElements["span"];
                    const __VLS_93 = __VLS_elementAsFunctionalComponent(__VLS_92);
                    const __VLS_94 = __VLS_93({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                    ({}({ ...{}, }));
                    (__VLS_95.slots).default;
                    const __VLS_95 = __VLS_pickFunctionalComponentCtx(__VLS_92, __VLS_94);
                }
                (__VLS_80.slots).default;
                const __VLS_80 = __VLS_pickFunctionalComponentCtx(__VLS_77, __VLS_79);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["login-wrapper"];
        __VLS_styleScopedClasses["login-card"];
        __VLS_styleScopedClasses["login-header"];
        __VLS_styleScopedClasses["login-title"];
        __VLS_styleScopedClasses["login-subtitle"];
        __VLS_styleScopedClasses["login-form"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["login-btn"];
        __VLS_styleScopedClasses["login-footer"];
        __VLS_styleScopedClasses["register-link"];
        __VLS_styleScopedClasses["footer-separator"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            username: username,
            password: password,
            loading: loading,
            handleLogin: handleLogin,
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

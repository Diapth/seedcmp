/* __placeholder__ */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { authApi } from '@tsdaodao/datasource-vue';
import { buildLoginDevice, useLoginStore } from '../stores/loginStore';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const loginStore = useLoginStore();
const zone = ref('0086');
const phone = ref('18337488675');
const name = ref('leng');
const password = ref('123456');
const code = ref('123456');
const loading = ref(false);
function buildUsername() {
    return `${zone.value.trim()}${phone.value.trim()}`;
}
async function handleSendCode() {
    if (!zone.value.trim() || !phone.value.trim()) {
        Message.warning('请输入区号和手机号');
        return;
    }
    loading.value = true;
    try {
        await authApi.getRegisterSmsCode({
            zone: zone.value.trim(),
            phone: phone.value.trim()
        });
        Message.success('验证码已发送');
    }
    catch (err) {
        Message.error(err?.msg || '发送验证码失败');
    }
    finally {
        loading.value = false;
    }
}
async function handleRegister() {
    if (!zone.value.trim() || !phone.value.trim() || !name.value.trim() || !password.value.trim() || !code.value.trim()) {
        Message.warning('请填写完整注册信息');
        return;
    }
    loading.value = true;
    try {
        await authApi.register({
            zone: zone.value.trim(),
            phone: phone.value.trim(),
            name: name.value.trim(),
            code: code.value.trim(),
            password: password.value.trim(),
            flag: 1,
            device: buildLoginDevice()
        });
        await loginStore.loginWithPassword(buildUsername(), password.value.trim());
        Message.success('注册成功');
        router.push('/chat');
    }
    catch (err) {
        Message.error(err?.msg || '注册失败');
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
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
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
        const __VLS_2 = __VLS_1({ ...{}, class: ("register-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("register-wrapper"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("register-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("register-card"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("register-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("register-header"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["h2"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, class: ("register-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, class: ("register-title"), }));
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                {
                    const __VLS_20 = __VLS_intrinsicElements["p"];
                    const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                    const __VLS_22 = __VLS_21({ ...{}, class: ("register-subtitle"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                    ({}({ ...{}, class: ("register-subtitle"), }));
                    (__VLS_23.slots).default;
                    const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_25 = __VLS_intrinsicElements["div"];
                const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                const __VLS_27 = __VLS_26({ ...{}, class: ("register-form"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                ({}({ ...{}, class: ("register-form"), }));
                {
                    const __VLS_30 = __VLS_intrinsicElements["div"];
                    const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                    const __VLS_32 = __VLS_31({ ...{}, class: ("form-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                    ({}({ ...{}, class: ("form-row"), }));
                    {
                        const __VLS_35 = __VLS_intrinsicElements["div"];
                        const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                        const __VLS_37 = __VLS_36({ ...{}, class: ("form-item zone-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                        ({}({ ...{}, class: ("form-item zone-item"), }));
                        {
                            const __VLS_40 = __VLS_intrinsicElements["label"];
                            const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                            const __VLS_42 = __VLS_41({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                            ({}({ ...{}, class: ("form-label"), }));
                            (__VLS_43.slots).default;
                            const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                        }
                        {
                            const __VLS_45 = __VLS_intrinsicElements["input"];
                            const __VLS_46 = __VLS_elementAsFunctionalComponent(__VLS_45);
                            const __VLS_47 = __VLS_46({ ...{}, value: ((__VLS_ctx.zone)), class: ("form-input"), type: ("text"), placeholder: ("0086"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                            ({}({ ...{}, value: ((__VLS_ctx.zone)), class: ("form-input"), type: ("text"), placeholder: ("0086"), disabled: ((__VLS_ctx.loading)), }));
                            const __VLS_48 = __VLS_pickFunctionalComponentCtx(__VLS_45, __VLS_47);
                        }
                        (__VLS_38.slots).default;
                        const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                    }
                    {
                        const __VLS_50 = __VLS_intrinsicElements["div"];
                        const __VLS_51 = __VLS_elementAsFunctionalComponent(__VLS_50);
                        const __VLS_52 = __VLS_51({ ...{}, class: ("form-item phone-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                        ({}({ ...{}, class: ("form-item phone-item"), }));
                        {
                            const __VLS_55 = __VLS_intrinsicElements["label"];
                            const __VLS_56 = __VLS_elementAsFunctionalComponent(__VLS_55);
                            const __VLS_57 = __VLS_56({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
                            ({}({ ...{}, class: ("form-label"), }));
                            (__VLS_58.slots).default;
                            const __VLS_58 = __VLS_pickFunctionalComponentCtx(__VLS_55, __VLS_57);
                        }
                        {
                            const __VLS_60 = __VLS_intrinsicElements["input"];
                            const __VLS_61 = __VLS_elementAsFunctionalComponent(__VLS_60);
                            const __VLS_62 = __VLS_61({ ...{}, value: ((__VLS_ctx.phone)), class: ("form-input"), type: ("text"), placeholder: ("11 位手机号"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_61));
                            ({}({ ...{}, value: ((__VLS_ctx.phone)), class: ("form-input"), type: ("text"), placeholder: ("11 位手机号"), disabled: ((__VLS_ctx.loading)), }));
                            const __VLS_63 = __VLS_pickFunctionalComponentCtx(__VLS_60, __VLS_62);
                        }
                        (__VLS_53.slots).default;
                        const __VLS_53 = __VLS_pickFunctionalComponentCtx(__VLS_50, __VLS_52);
                    }
                    (__VLS_33.slots).default;
                    const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                }
                {
                    const __VLS_65 = __VLS_intrinsicElements["div"];
                    const __VLS_66 = __VLS_elementAsFunctionalComponent(__VLS_65);
                    const __VLS_67 = __VLS_66({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_66));
                    ({}({ ...{}, class: ("form-item"), }));
                    {
                        const __VLS_70 = __VLS_intrinsicElements["label"];
                        const __VLS_71 = __VLS_elementAsFunctionalComponent(__VLS_70);
                        const __VLS_72 = __VLS_71({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_71));
                        ({}({ ...{}, class: ("form-label"), }));
                        (__VLS_73.slots).default;
                        const __VLS_73 = __VLS_pickFunctionalComponentCtx(__VLS_70, __VLS_72);
                    }
                    {
                        const __VLS_75 = __VLS_intrinsicElements["input"];
                        const __VLS_76 = __VLS_elementAsFunctionalComponent(__VLS_75);
                        const __VLS_77 = __VLS_76({ ...{}, value: ((__VLS_ctx.name)), class: ("form-input"), type: ("text"), placeholder: ("请输入昵称"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_76));
                        ({}({ ...{}, value: ((__VLS_ctx.name)), class: ("form-input"), type: ("text"), placeholder: ("请输入昵称"), disabled: ((__VLS_ctx.loading)), }));
                        const __VLS_78 = __VLS_pickFunctionalComponentCtx(__VLS_75, __VLS_77);
                    }
                    (__VLS_68.slots).default;
                    const __VLS_68 = __VLS_pickFunctionalComponentCtx(__VLS_65, __VLS_67);
                }
                {
                    const __VLS_80 = __VLS_intrinsicElements["div"];
                    const __VLS_81 = __VLS_elementAsFunctionalComponent(__VLS_80);
                    const __VLS_82 = __VLS_81({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_81));
                    ({}({ ...{}, class: ("form-item"), }));
                    {
                        const __VLS_85 = __VLS_intrinsicElements["label"];
                        const __VLS_86 = __VLS_elementAsFunctionalComponent(__VLS_85);
                        const __VLS_87 = __VLS_86({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_86));
                        ({}({ ...{}, class: ("form-label"), }));
                        (__VLS_88.slots).default;
                        const __VLS_88 = __VLS_pickFunctionalComponentCtx(__VLS_85, __VLS_87);
                    }
                    {
                        const __VLS_90 = __VLS_intrinsicElements["div"];
                        const __VLS_91 = __VLS_elementAsFunctionalComponent(__VLS_90);
                        const __VLS_92 = __VLS_91({ ...{}, class: ("code-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                        ({}({ ...{}, class: ("code-row"), }));
                        {
                            const __VLS_95 = __VLS_intrinsicElements["input"];
                            const __VLS_96 = __VLS_elementAsFunctionalComponent(__VLS_95);
                            const __VLS_97 = __VLS_96({ ...{}, value: ((__VLS_ctx.code)), class: ("form-input"), type: ("text"), placeholder: ("验证码"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_96));
                            ({}({ ...{}, value: ((__VLS_ctx.code)), class: ("form-input"), type: ("text"), placeholder: ("验证码"), disabled: ((__VLS_ctx.loading)), }));
                            const __VLS_98 = __VLS_pickFunctionalComponentCtx(__VLS_95, __VLS_97);
                        }
                        {
                            const __VLS_100 = __VLS_intrinsicElements["button"];
                            const __VLS_101 = __VLS_elementAsFunctionalComponent(__VLS_100);
                            const __VLS_102 = __VLS_101({ ...{ 'onClick': {}, }, class: ("code-btn"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_101));
                            ({}({ ...{ 'onClick': {}, }, class: ("code-btn"), disabled: ((__VLS_ctx.loading)), }));
                            let __VLS_105 = { 'click': __VLS_pickEvent(__VLS_104['click'], {}.onClick) };
                            __VLS_105 = { click: (__VLS_ctx.handleSendCode) };
                            (__VLS_103.slots).default;
                            const __VLS_103 = __VLS_pickFunctionalComponentCtx(__VLS_100, __VLS_102);
                            let __VLS_104;
                        }
                        (__VLS_93.slots).default;
                        const __VLS_93 = __VLS_pickFunctionalComponentCtx(__VLS_90, __VLS_92);
                    }
                    (__VLS_83.slots).default;
                    const __VLS_83 = __VLS_pickFunctionalComponentCtx(__VLS_80, __VLS_82);
                }
                {
                    const __VLS_106 = __VLS_intrinsicElements["div"];
                    const __VLS_107 = __VLS_elementAsFunctionalComponent(__VLS_106);
                    const __VLS_108 = __VLS_107({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_107));
                    ({}({ ...{}, class: ("form-item"), }));
                    {
                        const __VLS_111 = __VLS_intrinsicElements["label"];
                        const __VLS_112 = __VLS_elementAsFunctionalComponent(__VLS_111);
                        const __VLS_113 = __VLS_112({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_112));
                        ({}({ ...{}, class: ("form-label"), }));
                        (__VLS_114.slots).default;
                        const __VLS_114 = __VLS_pickFunctionalComponentCtx(__VLS_111, __VLS_113);
                    }
                    {
                        const __VLS_116 = __VLS_intrinsicElements["input"];
                        const __VLS_117 = __VLS_elementAsFunctionalComponent(__VLS_116);
                        const __VLS_118 = __VLS_117({ ...{}, class: ("form-input"), type: ("password"), placeholder: ("请输入密码"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_117));
                        ({}({ ...{}, class: ("form-input"), type: ("password"), placeholder: ("请输入密码"), disabled: ((__VLS_ctx.loading)), }));
                        (__VLS_ctx.password);
                        const __VLS_119 = __VLS_pickFunctionalComponentCtx(__VLS_116, __VLS_118);
                    }
                    (__VLS_109.slots).default;
                    const __VLS_109 = __VLS_pickFunctionalComponentCtx(__VLS_106, __VLS_108);
                }
                {
                    const __VLS_121 = __VLS_intrinsicElements["button"];
                    const __VLS_122 = __VLS_elementAsFunctionalComponent(__VLS_121);
                    const __VLS_123 = __VLS_122({ ...{ 'onClick': {}, }, class: ("register-btn"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_122));
                    ({}({ ...{ 'onClick': {}, }, class: ("register-btn"), disabled: ((__VLS_ctx.loading)), }));
                    let __VLS_126 = { 'click': __VLS_pickEvent(__VLS_125['click'], {}.onClick) };
                    __VLS_126 = { click: (__VLS_ctx.handleRegister) };
                    if (__VLS_ctx.loading) {
                        {
                            const __VLS_127 = __VLS_intrinsicElements["span"];
                            const __VLS_128 = __VLS_elementAsFunctionalComponent(__VLS_127);
                            const __VLS_129 = __VLS_128({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_128));
                            ({}({ ...{}, }));
                            (__VLS_130.slots).default;
                            const __VLS_130 = __VLS_pickFunctionalComponentCtx(__VLS_127, __VLS_129);
                        }
                        // @ts-ignore
                        [zone, loading, zone, loading, phone, loading, phone, loading, name, loading, name, loading, code, loading, code, loading, loading, loading, handleSendCode, loading, loading, password, loading, loading, handleRegister, loading,];
                    }
                    else {
                        {
                            const __VLS_132 = __VLS_intrinsicElements["span"];
                            const __VLS_133 = __VLS_elementAsFunctionalComponent(__VLS_132);
                            const __VLS_134 = __VLS_133({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_133));
                            ({}({ ...{}, }));
                            (__VLS_135.slots).default;
                            const __VLS_135 = __VLS_pickFunctionalComponentCtx(__VLS_132, __VLS_134);
                        }
                    }
                    (__VLS_124.slots).default;
                    const __VLS_124 = __VLS_pickFunctionalComponentCtx(__VLS_121, __VLS_123);
                    let __VLS_125;
                }
                (__VLS_28.slots).default;
                const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
            }
            {
                const __VLS_137 = __VLS_intrinsicElements["div"];
                const __VLS_138 = __VLS_elementAsFunctionalComponent(__VLS_137);
                const __VLS_139 = __VLS_138({ ...{}, class: ("register-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_138));
                ({}({ ...{}, class: ("register-footer"), }));
                {
                    const __VLS_142 = {}.RouterLink;
                    const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({ ...{}, to: ("/login"), }));
                    ({}.RouterLink);
                    ({}.RouterLink);
                    const __VLS_144 = __VLS_143({ ...{}, to: ("/login"), }, ...__VLS_functionalComponentArgsRest(__VLS_143));
                    ({}({ ...{}, to: ("/login"), }));
                    (__VLS_145.slots).default;
                    const __VLS_145 = __VLS_pickFunctionalComponentCtx(__VLS_142, __VLS_144);
                }
                (__VLS_140.slots).default;
                const __VLS_140 = __VLS_pickFunctionalComponentCtx(__VLS_137, __VLS_139);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["register-wrapper"];
        __VLS_styleScopedClasses["register-card"];
        __VLS_styleScopedClasses["register-header"];
        __VLS_styleScopedClasses["register-title"];
        __VLS_styleScopedClasses["register-subtitle"];
        __VLS_styleScopedClasses["register-form"];
        __VLS_styleScopedClasses["form-row"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["zone-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["phone-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["code-row"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["code-btn"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["register-btn"];
        __VLS_styleScopedClasses["register-footer"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            zone: zone,
            phone: phone,
            name: name,
            password: password,
            code: code,
            loading: loading,
            handleSendCode: handleSendCode,
            handleRegister: handleRegister,
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

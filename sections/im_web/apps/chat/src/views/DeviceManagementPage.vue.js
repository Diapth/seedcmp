/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@tsdaodao/datasource-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const devices = ref([]);
const loading = ref(false);
const quittingSession = ref(false);
async function loadDevices() {
    loading.value = true;
    try {
        const res = await authApi.getDevices();
        devices.value = Array.isArray(res) ? res : (res?.data || []);
    }
    catch (err) {
        Message.error(err.msg || '获取设备列表失败');
    }
    finally {
        loading.value = false;
    }
}
async function removeDevice(deviceId) {
    try {
        await authApi.deleteDevice(deviceId);
        Message.success('设备已移除');
        await loadDevices();
    }
    catch (err) {
        Message.error(err.msg || '移除设备失败');
    }
}
async function quitCurrentSession() {
    quittingSession.value = true;
    try {
        await authApi.quit();
        Message.success('当前 Web 会话已退出');
    }
    catch (err) {
        Message.error(err.msg || '退出当前会话失败');
    }
    finally {
        quittingSession.value = false;
    }
}
function goBack() {
    router.back();
}
function formatDeviceFlag(flag) {
    if (flag === 2)
        return 'PC';
    if (flag === 1)
        return 'Web';
    return '移动端';
}
function getDeviceKind(device) {
    const source = `${device.device_name || ''} ${device.device_model || ''}`.toLowerCase();
    if (/web|browser|chrome|edge|firefox|safari|desktop|pc|mac|windows|linux/.test(source)) {
        return 'Web';
    }
    return formatDeviceFlag(Number(device.device_flag || 0));
}
onMounted(() => {
    loadDevices();
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
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("devices-page"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("devices-page"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("page-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("page-header"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["button"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{ 'onClick': {}, }, class: ("plain-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{ 'onClick': {}, }, class: ("plain-btn"), }));
                let __VLS_15 = { 'click': __VLS_pickEvent(__VLS_14['click'], {}.onClick) };
                __VLS_15 = { click: (__VLS_ctx.goBack) };
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                let __VLS_14;
            }
            {
                const __VLS_16 = __VLS_intrinsicElements["h3"];
                const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                const __VLS_18 = __VLS_17({ ...{}, class: ("page-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                ({}({ ...{}, class: ("page-title"), }));
                (__VLS_19.slots).default;
                const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
            }
            {
                const __VLS_21 = __VLS_intrinsicElements["button"];
                const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                const __VLS_23 = __VLS_22({ ...{ 'onClick': {}, }, class: ("danger-btn"), disabled: ((__VLS_ctx.quittingSession)), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                ({}({ ...{ 'onClick': {}, }, class: ("danger-btn"), disabled: ((__VLS_ctx.quittingSession)), }));
                let __VLS_26 = { 'click': __VLS_pickEvent(__VLS_25['click'], {}.onClick) };
                __VLS_26 = { click: (__VLS_ctx.quitCurrentSession) };
                (__VLS_ctx.quittingSession ? '处理中...' : '退出当前会话');
                (__VLS_24.slots).default;
                const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                let __VLS_25;
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        if (__VLS_ctx.loading) {
            {
                const __VLS_27 = __VLS_intrinsicElements["div"];
                const __VLS_28 = __VLS_elementAsFunctionalComponent(__VLS_27);
                const __VLS_29 = __VLS_28({ ...{}, class: ("page-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_28));
                ({}({ ...{}, class: ("page-state"), }));
                (__VLS_30.slots).default;
                const __VLS_30 = __VLS_pickFunctionalComponentCtx(__VLS_27, __VLS_29);
            }
            // @ts-ignore
            [goBack, quittingSession, quittingSession, quitCurrentSession, quittingSession, loading,];
        }
        else if (__VLS_ctx.devices.length === 0) {
            {
                const __VLS_32 = __VLS_intrinsicElements["div"];
                const __VLS_33 = __VLS_elementAsFunctionalComponent(__VLS_32);
                const __VLS_34 = __VLS_33({ ...{}, class: ("page-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_33));
                ({}({ ...{}, class: ("page-state"), }));
                (__VLS_35.slots).default;
                const __VLS_35 = __VLS_pickFunctionalComponentCtx(__VLS_32, __VLS_34);
            }
            // @ts-ignore
            [devices,];
        }
        else {
            {
                const __VLS_37 = __VLS_intrinsicElements["div"];
                const __VLS_38 = __VLS_elementAsFunctionalComponent(__VLS_37);
                const __VLS_39 = __VLS_38({ ...{}, class: ("device-list"), }, ...__VLS_functionalComponentArgsRest(__VLS_38));
                ({}({ ...{}, class: ("device-list"), }));
                for (const [device] of __VLS_getVForSourceType((__VLS_ctx.devices))) {
                    {
                        const __VLS_42 = __VLS_intrinsicElements["div"];
                        const __VLS_43 = __VLS_elementAsFunctionalComponent(__VLS_42);
                        const __VLS_44 = __VLS_43({ ...{}, key: ((device.device_id || device.id)), class: ("device-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                        ({}({ ...{}, key: ((device.device_id || device.id)), class: ("device-item"), }));
                        {
                            const __VLS_47 = __VLS_intrinsicElements["div"];
                            const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                            const __VLS_49 = __VLS_48({ ...{}, class: ("device-meta"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                            ({}({ ...{}, class: ("device-meta"), }));
                            {
                                const __VLS_52 = __VLS_intrinsicElements["div"];
                                const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
                                const __VLS_54 = __VLS_53({ ...{}, class: ("device-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                                ({}({ ...{}, class: ("device-name"), }));
                                (device.device_name || '未命名设备');
                                (__VLS_55.slots).default;
                                const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
                            }
                            {
                                const __VLS_57 = __VLS_intrinsicElements["div"];
                                const __VLS_58 = __VLS_elementAsFunctionalComponent(__VLS_57);
                                const __VLS_59 = __VLS_58({ ...{}, class: ("device-desc"), }, ...__VLS_functionalComponentArgsRest(__VLS_58));
                                ({}({ ...{}, class: ("device-desc"), }));
                                (device.device_model || '未知型号');
                                (__VLS_ctx.getDeviceKind(device));
                                (__VLS_60.slots).default;
                                const __VLS_60 = __VLS_pickFunctionalComponentCtx(__VLS_57, __VLS_59);
                            }
                            (__VLS_50.slots).default;
                            const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                        }
                        {
                            const __VLS_62 = __VLS_intrinsicElements["button"];
                            const __VLS_63 = __VLS_elementAsFunctionalComponent(__VLS_62);
                            const __VLS_64 = __VLS_63({ ...{ 'onClick': {}, }, class: ("plain-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                            ({}({ ...{ 'onClick': {}, }, class: ("plain-btn"), }));
                            let __VLS_67 = { 'click': __VLS_pickEvent(__VLS_66['click'], {}.onClick) };
                            __VLS_67 = { click: $event => {
                                    if (!(!((__VLS_ctx.loading))))
                                        return;
                                    if (!(!((__VLS_ctx.devices.length === 0))))
                                        return;
                                    __VLS_ctx.removeDevice(device.device_id || device.id);
                                    // @ts-ignore
                                    [devices, getDeviceKind, removeDevice,];
                                }
                            };
                            (__VLS_65.slots).default;
                            const __VLS_65 = __VLS_pickFunctionalComponentCtx(__VLS_62, __VLS_64);
                            let __VLS_66;
                        }
                        (__VLS_45.slots).default;
                        const __VLS_45 = __VLS_pickFunctionalComponentCtx(__VLS_42, __VLS_44);
                    }
                }
                (__VLS_40.slots).default;
                const __VLS_40 = __VLS_pickFunctionalComponentCtx(__VLS_37, __VLS_39);
            }
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["devices-page"];
        __VLS_styleScopedClasses["page-header"];
        __VLS_styleScopedClasses["plain-btn"];
        __VLS_styleScopedClasses["page-title"];
        __VLS_styleScopedClasses["danger-btn"];
        __VLS_styleScopedClasses["page-state"];
        __VLS_styleScopedClasses["page-state"];
        __VLS_styleScopedClasses["device-list"];
        __VLS_styleScopedClasses["device-item"];
        __VLS_styleScopedClasses["device-meta"];
        __VLS_styleScopedClasses["device-name"];
        __VLS_styleScopedClasses["device-desc"];
        __VLS_styleScopedClasses["plain-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            devices: devices,
            loading: loading,
            quittingSession: quittingSession,
            removeDevice: removeDevice,
            quitCurrentSession: quitCurrentSession,
            goBack: goBack,
            getDeviceKind: getDeviceKind,
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

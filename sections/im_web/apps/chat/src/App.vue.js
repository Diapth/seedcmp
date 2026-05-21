/* __placeholder__ */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSdkStore } from '@tsdaodao/datasource-vue';
import { StorageService, KickoutOverlay } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const sdkStore = useSdkStore();
const isKickedOut = computed(() => sdkStore.isKickedOut);
const handleRelogin = () => {
    StorageService.clear();
    sdkStore.disconnect();
    router.push('/login');
};
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
    __VLS_components.RouterView;
    __VLS_components.routerView;
    // @ts-ignore
    [RouterView,];
    __VLS_components.KickoutOverlay;
    __VLS_components.KickoutOverlay;
    // @ts-ignore
    [KickoutOverlay,];
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("app-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("app-container"), }));
        {
            const __VLS_5 = {}.RouterView;
            const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({ ...{}, }));
            ({}.RouterView);
            const __VLS_7 = __VLS_6({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, }));
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_10 = {}.KickoutOverlay;
            const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.isKickedOut)), }));
            ({}.KickoutOverlay);
            const __VLS_12 = __VLS_11({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.isKickedOut)), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            ({}({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.isKickedOut)), }));
            let __VLS_15 = { 'relogin': __VLS_pickEvent(__VLS_14['relogin'], {}.onRelogin) };
            __VLS_15 = { relogin: (__VLS_ctx.handleRelogin) };
            const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            let __VLS_14;
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
    }
    var __VLS_slots;
    // @ts-ignore
    [isKickedOut, isKickedOut, isKickedOut, handleRelogin,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            KickoutOverlay: KickoutOverlay,
            isKickedOut: isKickedOut,
            handleRelogin: handleRelogin,
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

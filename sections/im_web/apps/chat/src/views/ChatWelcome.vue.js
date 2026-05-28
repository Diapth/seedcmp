/* __placeholder__ */
import { computed, onMounted, ref } from 'vue';
import { useRemoteConfig } from '@tsdaodao/base-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const { remoteConfig, fetchRemoteConfig } = useRemoteConfig();
const recentAppIds = ref(JSON.parse(localStorage.getItem('tsdd-recent-workplace-apps') || '[]'));
const fallbackApps = [
    { id: 'contacts', name: '通讯录', category: '协作', route: '/chat', order: 1, enabled: true },
    { id: 'files', name: '文件助手', category: '工具', route: '/chat/conversation/filehelper/1', order: 2, enabled: true },
    { id: 'reports', name: '举报与反馈', category: '安全', route: '', order: 3, enabled: true }
];
const workplaceApps = computed(() => {
    const apps = remoteConfig.value.workplace_apps?.length ? remoteConfig.value.workplace_apps : fallbackApps;
    return apps.filter((app) => app.enabled !== false);
});
const sortedWorkplaceApps = computed(() => {
    return [...workplaceApps.value].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
});
const groupedApps = computed(() => {
    return sortedWorkplaceApps.value.reduce((acc, app) => {
        const category = app.category || '常用';
        acc[category] = acc[category] || [];
        acc[category].push(app);
        return acc;
    }, {});
});
const recentApps = computed(() => {
    return recentAppIds.value
        .map(id => workplaceApps.value.find((app) => app.id === id))
        .filter((app) => Boolean(app));
});
const workplaceVisible = computed(() => remoteConfig.value.feature_visibility?.workplace !== false);
const updatePrompt = computed(() => remoteConfig.value.update_prompt);
function persistRecentApps() {
    localStorage.setItem('tsdd-recent-workplace-apps', JSON.stringify(recentAppIds.value.slice(0, 8)));
}
function toggleRecentApp(app) {
    if (recentAppIds.value.includes(app.id)) {
        recentAppIds.value = recentAppIds.value.filter(id => id !== app.id);
    }
    else {
        recentAppIds.value = [app.id, ...recentAppIds.value];
    }
    persistRecentApps();
}
function openWorkplaceApp(app) {
    toggleRecentApp(app);
    if (app.url) {
        window.open(app.url, '_blank', 'noopener,noreferrer');
    }
    else if (app.route) {
        window.location.href = app.route;
    }
}
onMounted(() => {
    fetchRemoteConfig();
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
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.div;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.h3;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.p;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.a;
    __VLS_intrinsicElements.a;
    __VLS_intrinsicElements.section;
    __VLS_intrinsicElements.section;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("welcome-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("welcome-container"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("welcome-inner"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("welcome-inner"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("logo-box"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("logo-box"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["svg"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("1.5"), class: ("welcome-logo"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("1.5"), class: ("welcome-logo"), }));
                    {
                        const __VLS_20 = __VLS_intrinsicElements["path"];
                        const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                        const __VLS_22 = __VLS_21({ ...{}, d: ("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                        ({}({ ...{}, d: ("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), }));
                        const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_25 = __VLS_intrinsicElements["h3"];
                const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                const __VLS_27 = __VLS_26({ ...{}, class: ("welcome-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                ({}({ ...{}, class: ("welcome-title"), }));
                (__VLS_28.slots).default;
                const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
            }
            {
                const __VLS_30 = __VLS_intrinsicElements["p"];
                const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                const __VLS_32 = __VLS_31({ ...{}, class: ("welcome-desc"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                ({}({ ...{}, class: ("welcome-desc"), }));
                (__VLS_33.slots).default;
                const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
            }
            if (__VLS_ctx.updatePrompt?.enabled) {
                {
                    const __VLS_35 = __VLS_intrinsicElements["div"];
                    const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                    const __VLS_37 = __VLS_36({ ...{}, class: ("update-prompt"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                    ({}({ ...{}, class: ("update-prompt"), }));
                    {
                        const __VLS_40 = __VLS_intrinsicElements["span"];
                        const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                        const __VLS_42 = __VLS_41({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                        ({}({ ...{}, }));
                        (__VLS_ctx.updatePrompt.message || `发现新版本 ${__VLS_ctx.updatePrompt.version}`);
                        (__VLS_43.slots).default;
                        const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                    }
                    if (__VLS_ctx.updatePrompt.url) {
                        {
                            const __VLS_45 = __VLS_intrinsicElements["a"];
                            const __VLS_46 = __VLS_elementAsFunctionalComponent(__VLS_45);
                            const __VLS_47 = __VLS_46({ ...{}, href: ((__VLS_ctx.updatePrompt.url)), target: ("_blank"), rel: ("noreferrer"), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
                            ({}({ ...{}, href: ((__VLS_ctx.updatePrompt.url)), target: ("_blank"), rel: ("noreferrer"), }));
                            (__VLS_48.slots).default;
                            const __VLS_48 = __VLS_pickFunctionalComponentCtx(__VLS_45, __VLS_47);
                        }
                        // @ts-ignore
                        [updatePrompt, updatePrompt, updatePrompt, updatePrompt, updatePrompt, updatePrompt,];
                    }
                    (__VLS_38.slots).default;
                    const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                }
            }
            if (__VLS_ctx.workplaceVisible) {
                {
                    const __VLS_50 = __VLS_intrinsicElements["section"];
                    const __VLS_51 = __VLS_elementAsFunctionalComponent(__VLS_50);
                    const __VLS_52 = __VLS_51({ ...{}, class: ("workplace-panel"), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                    ({}({ ...{}, class: ("workplace-panel"), }));
                    {
                        const __VLS_55 = __VLS_intrinsicElements["div"];
                        const __VLS_56 = __VLS_elementAsFunctionalComponent(__VLS_55);
                        const __VLS_57 = __VLS_56({ ...{}, class: ("workplace-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
                        ({}({ ...{}, class: ("workplace-header"), }));
                        {
                            const __VLS_60 = __VLS_intrinsicElements["span"];
                            const __VLS_61 = __VLS_elementAsFunctionalComponent(__VLS_60);
                            const __VLS_62 = __VLS_61({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_61));
                            ({}({ ...{}, }));
                            (__VLS_63.slots).default;
                            const __VLS_63 = __VLS_pickFunctionalComponentCtx(__VLS_60, __VLS_62);
                        }
                        {
                            const __VLS_65 = __VLS_intrinsicElements["span"];
                            const __VLS_66 = __VLS_elementAsFunctionalComponent(__VLS_65);
                            const __VLS_67 = __VLS_66({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_66));
                            ({}({ ...{}, }));
                            (__VLS_ctx.sortedWorkplaceApps.length);
                            (__VLS_68.slots).default;
                            const __VLS_68 = __VLS_pickFunctionalComponentCtx(__VLS_65, __VLS_67);
                        }
                        (__VLS_58.slots).default;
                        const __VLS_58 = __VLS_pickFunctionalComponentCtx(__VLS_55, __VLS_57);
                    }
                    if (__VLS_ctx.recentApps.length) {
                        {
                            const __VLS_70 = __VLS_intrinsicElements["div"];
                            const __VLS_71 = __VLS_elementAsFunctionalComponent(__VLS_70);
                            const __VLS_72 = __VLS_71({ ...{}, class: ("recent-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_71));
                            ({}({ ...{}, class: ("recent-row"), }));
                            for (const [app] of __VLS_getVForSourceType((__VLS_ctx.recentApps))) {
                                {
                                    const __VLS_75 = __VLS_intrinsicElements["button"];
                                    const __VLS_76 = __VLS_elementAsFunctionalComponent(__VLS_75);
                                    const __VLS_77 = __VLS_76({ ...{ 'onClick': {}, }, key: ((app.id)), class: ("recent-chip"), }, ...__VLS_functionalComponentArgsRest(__VLS_76));
                                    ({}({ ...{ 'onClick': {}, }, key: ((app.id)), class: ("recent-chip"), }));
                                    let __VLS_80 = { 'click': __VLS_pickEvent(__VLS_79['click'], {}.onClick) };
                                    __VLS_80 = { click: $event => {
                                            if (!((__VLS_ctx.workplaceVisible)))
                                                return;
                                            if (!((__VLS_ctx.recentApps.length)))
                                                return;
                                            __VLS_ctx.openWorkplaceApp(app);
                                            // @ts-ignore
                                            [workplaceVisible, sortedWorkplaceApps, recentApps, recentApps, openWorkplaceApp,];
                                        }
                                    };
                                    (app.name);
                                    (__VLS_78.slots).default;
                                    const __VLS_78 = __VLS_pickFunctionalComponentCtx(__VLS_75, __VLS_77);
                                    let __VLS_79;
                                }
                            }
                            (__VLS_73.slots).default;
                            const __VLS_73 = __VLS_pickFunctionalComponentCtx(__VLS_70, __VLS_72);
                        }
                    }
                    {
                        const __VLS_81 = __VLS_intrinsicElements["div"];
                        const __VLS_82 = __VLS_elementAsFunctionalComponent(__VLS_81);
                        const __VLS_83 = __VLS_82({ ...{}, class: ("app-groups"), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
                        ({}({ ...{}, class: ("app-groups"), }));
                        for (const [apps, category] of __VLS_getVForSourceType((__VLS_ctx.groupedApps))) {
                            {
                                const __VLS_86 = __VLS_intrinsicElements["div"];
                                const __VLS_87 = __VLS_elementAsFunctionalComponent(__VLS_86);
                                const __VLS_88 = __VLS_87({ ...{}, key: ((category)), class: ("app-group"), }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                                ({}({ ...{}, key: ((category)), class: ("app-group"), }));
                                {
                                    const __VLS_91 = __VLS_intrinsicElements["div"];
                                    const __VLS_92 = __VLS_elementAsFunctionalComponent(__VLS_91);
                                    const __VLS_93 = __VLS_92({ ...{}, class: ("app-category"), }, ...__VLS_functionalComponentArgsRest(__VLS_92));
                                    ({}({ ...{}, class: ("app-category"), }));
                                    (category);
                                    (__VLS_94.slots).default;
                                    const __VLS_94 = __VLS_pickFunctionalComponentCtx(__VLS_91, __VLS_93);
                                }
                                {
                                    const __VLS_96 = __VLS_intrinsicElements["div"];
                                    const __VLS_97 = __VLS_elementAsFunctionalComponent(__VLS_96);
                                    const __VLS_98 = __VLS_97({ ...{}, class: ("app-grid"), }, ...__VLS_functionalComponentArgsRest(__VLS_97));
                                    ({}({ ...{}, class: ("app-grid"), }));
                                    for (const [app] of __VLS_getVForSourceType((apps))) {
                                        {
                                            const __VLS_101 = __VLS_intrinsicElements["button"];
                                            const __VLS_102 = __VLS_elementAsFunctionalComponent(__VLS_101);
                                            const __VLS_103 = __VLS_102({ ...{ 'onClick': {}, }, key: ((app.id)), class: ("app-tile"), }, ...__VLS_functionalComponentArgsRest(__VLS_102));
                                            ({}({ ...{ 'onClick': {}, }, key: ((app.id)), class: ("app-tile"), }));
                                            let __VLS_106 = { 'click': __VLS_pickEvent(__VLS_105['click'], {}.onClick) };
                                            __VLS_106 = { click: $event => {
                                                    if (!((__VLS_ctx.workplaceVisible)))
                                                        return;
                                                    __VLS_ctx.openWorkplaceApp(app);
                                                    // @ts-ignore
                                                    [groupedApps, openWorkplaceApp,];
                                                }
                                            };
                                            {
                                                const __VLS_107 = __VLS_intrinsicElements["span"];
                                                const __VLS_108 = __VLS_elementAsFunctionalComponent(__VLS_107);
                                                const __VLS_109 = __VLS_108({ ...{}, class: ("app-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_108));
                                                ({}({ ...{}, class: ("app-icon"), }));
                                                (app.icon || app.name.slice(0, 1));
                                                (__VLS_110.slots).default;
                                                const __VLS_110 = __VLS_pickFunctionalComponentCtx(__VLS_107, __VLS_109);
                                            }
                                            {
                                                const __VLS_112 = __VLS_intrinsicElements["span"];
                                                const __VLS_113 = __VLS_elementAsFunctionalComponent(__VLS_112);
                                                const __VLS_114 = __VLS_113({ ...{}, class: ("app-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_113));
                                                ({}({ ...{}, class: ("app-name"), }));
                                                (app.name);
                                                (__VLS_115.slots).default;
                                                const __VLS_115 = __VLS_pickFunctionalComponentCtx(__VLS_112, __VLS_114);
                                            }
                                            {
                                                const __VLS_117 = __VLS_intrinsicElements["span"];
                                                const __VLS_118 = __VLS_elementAsFunctionalComponent(__VLS_117);
                                                const __VLS_119 = __VLS_118({ ...{}, class: ("app-action"), }, ...__VLS_functionalComponentArgsRest(__VLS_118));
                                                ({}({ ...{}, class: ("app-action"), }));
                                                (__VLS_ctx.recentAppIds.includes(app.id) ? '移除常用' : '添加常用');
                                                (__VLS_120.slots).default;
                                                const __VLS_120 = __VLS_pickFunctionalComponentCtx(__VLS_117, __VLS_119);
                                            }
                                            (__VLS_104.slots).default;
                                            const __VLS_104 = __VLS_pickFunctionalComponentCtx(__VLS_101, __VLS_103);
                                            let __VLS_105;
                                        }
                                        // @ts-ignore
                                        [recentAppIds,];
                                    }
                                    (__VLS_99.slots).default;
                                    const __VLS_99 = __VLS_pickFunctionalComponentCtx(__VLS_96, __VLS_98);
                                }
                                (__VLS_89.slots).default;
                                const __VLS_89 = __VLS_pickFunctionalComponentCtx(__VLS_86, __VLS_88);
                            }
                        }
                        (__VLS_84.slots).default;
                        const __VLS_84 = __VLS_pickFunctionalComponentCtx(__VLS_81, __VLS_83);
                    }
                    (__VLS_53.slots).default;
                    const __VLS_53 = __VLS_pickFunctionalComponentCtx(__VLS_50, __VLS_52);
                }
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["welcome-container"];
        __VLS_styleScopedClasses["welcome-inner"];
        __VLS_styleScopedClasses["logo-box"];
        __VLS_styleScopedClasses["welcome-logo"];
        __VLS_styleScopedClasses["welcome-title"];
        __VLS_styleScopedClasses["welcome-desc"];
        __VLS_styleScopedClasses["update-prompt"];
        __VLS_styleScopedClasses["workplace-panel"];
        __VLS_styleScopedClasses["workplace-header"];
        __VLS_styleScopedClasses["recent-row"];
        __VLS_styleScopedClasses["recent-chip"];
        __VLS_styleScopedClasses["app-groups"];
        __VLS_styleScopedClasses["app-group"];
        __VLS_styleScopedClasses["app-category"];
        __VLS_styleScopedClasses["app-grid"];
        __VLS_styleScopedClasses["app-tile"];
        __VLS_styleScopedClasses["app-icon"];
        __VLS_styleScopedClasses["app-name"];
        __VLS_styleScopedClasses["app-action"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            recentAppIds: recentAppIds,
            sortedWorkplaceApps: sortedWorkplaceApps,
            groupedApps: groupedApps,
            recentApps: recentApps,
            workplaceVisible: workplaceVisible,
            updatePrompt: updatePrompt,
            openWorkplaceApp: openWorkplaceApp,
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

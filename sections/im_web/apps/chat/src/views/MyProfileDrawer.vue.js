/* __placeholder__ */
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore, userApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['close']);
const router = useRouter();
const userStore = useUserStore();
const newName = ref('');
const newAvatar = ref('');
const isEditing = ref(false);
const saving = ref(false);
const currentUser = computed(() => userStore.currentUser);
watch(() => props.visible, (val) => {
    if (val && currentUser.value) {
        newName.value = currentUser.value.name || '';
        newAvatar.value = currentUser.value.avatar || '';
        isEditing.value = false;
    }
});
async function handleSave() {
    if (!newName.value.trim()) {
        Message.error('昵称不能为空');
        return;
    }
    saving.value = true;
    try {
        // 1. Update Profile (Name)
        await userApi.updateProfile({ name: newName.value.trim() });
        // 2. Local State update
        if (userStore.currentUser) {
            userStore.currentUser.name = newName.value.trim();
        }
        Message.success('个人资料更新成功');
        isEditing.value = false;
    }
    catch (err) {
        Message.error(err.msg || '保存失败');
    }
    finally {
        saving.value = false;
    }
}
// Support choosing a dynamic preset avatar to bypass complex uploading constraints
const presets = [
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Boots',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Garfield'
];
async function selectPresetAvatar(url) {
    try {
        newAvatar.value = url;
        // Update local state directly for mock / demonstration
        if (userStore.currentUser) {
            userStore.currentUser.avatar = url;
        }
        Message.success('头像设置成功');
    }
    catch (err) {
        console.error(err);
    }
}
function goToDevices() {
    emit('close');
    router.push('/chat/devices');
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
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.h4;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.img;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    if (__VLS_ctx.visible) {
        {
            const __VLS_0 = __VLS_intrinsicElements["div"];
            const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
            const __VLS_2 = __VLS_1({ ...{ 'onClick': {}, }, class: ("drawer-overlay"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            ({}({ ...{ 'onClick': {}, }, class: ("drawer-overlay"), }));
            let __VLS_5 = { 'click': __VLS_pickEvent(__VLS_4['click'], {}.onClick) };
            __VLS_5 = { click: $event => {
                    if (!((__VLS_ctx.visible)))
                        return;
                    __VLS_ctx.emit('close');
                    // @ts-ignore
                    [visible, emit,];
                }
            };
            {
                const __VLS_6 = __VLS_intrinsicElements["div"];
                const __VLS_7 = __VLS_elementAsFunctionalComponent(__VLS_6);
                const __VLS_8 = __VLS_7({ ...{ 'onClick': {}, }, class: ("drawer-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
                ({}({ ...{ 'onClick': {}, }, class: ("drawer-content"), }));
                let __VLS_11 = { 'click': __VLS_pickEvent(__VLS_10['click'], {}.onClick) };
                __VLS_11 = { click: () => { } };
                {
                    const __VLS_12 = __VLS_intrinsicElements["div"];
                    const __VLS_13 = __VLS_elementAsFunctionalComponent(__VLS_12);
                    const __VLS_14 = __VLS_13({ ...{}, class: ("drawer-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
                    ({}({ ...{}, class: ("drawer-header"), }));
                    {
                        const __VLS_17 = __VLS_intrinsicElements["h4"];
                        const __VLS_18 = __VLS_elementAsFunctionalComponent(__VLS_17);
                        const __VLS_19 = __VLS_18({ ...{}, class: ("drawer-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_18));
                        ({}({ ...{}, class: ("drawer-title"), }));
                        (__VLS_20.slots).default;
                        const __VLS_20 = __VLS_pickFunctionalComponentCtx(__VLS_17, __VLS_19);
                    }
                    {
                        const __VLS_22 = __VLS_intrinsicElements["button"];
                        const __VLS_23 = __VLS_elementAsFunctionalComponent(__VLS_22);
                        const __VLS_24 = __VLS_23({ ...{ 'onClick': {}, }, class: ("close-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_23));
                        ({}({ ...{ 'onClick': {}, }, class: ("close-btn"), }));
                        let __VLS_27 = { 'click': __VLS_pickEvent(__VLS_26['click'], {}.onClick) };
                        __VLS_27 = { click: $event => {
                                if (!((__VLS_ctx.visible)))
                                    return;
                                __VLS_ctx.emit('close');
                                // @ts-ignore
                                [emit,];
                            }
                        };
                        {
                            const __VLS_28 = __VLS_intrinsicElements["svg"];
                            const __VLS_29 = __VLS_elementAsFunctionalComponent(__VLS_28);
                            const __VLS_30 = __VLS_29({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_29));
                            ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-icon"), }));
                            {
                                const __VLS_33 = __VLS_intrinsicElements["line"];
                                const __VLS_34 = __VLS_elementAsFunctionalComponent(__VLS_33);
                                const __VLS_35 = __VLS_34({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_34));
                                ({}({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }));
                                const __VLS_36 = __VLS_pickFunctionalComponentCtx(__VLS_33, __VLS_35);
                            }
                            {
                                const __VLS_38 = __VLS_intrinsicElements["line"];
                                const __VLS_39 = __VLS_elementAsFunctionalComponent(__VLS_38);
                                const __VLS_40 = __VLS_39({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
                                ({}({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }));
                                const __VLS_41 = __VLS_pickFunctionalComponentCtx(__VLS_38, __VLS_40);
                            }
                            (__VLS_31.slots).default;
                            const __VLS_31 = __VLS_pickFunctionalComponentCtx(__VLS_28, __VLS_30);
                        }
                        (__VLS_25.slots).default;
                        const __VLS_25 = __VLS_pickFunctionalComponentCtx(__VLS_22, __VLS_24);
                        let __VLS_26;
                    }
                    (__VLS_15.slots).default;
                    const __VLS_15 = __VLS_pickFunctionalComponentCtx(__VLS_12, __VLS_14);
                }
                if (__VLS_ctx.currentUser) {
                    {
                        const __VLS_43 = __VLS_intrinsicElements["div"];
                        const __VLS_44 = __VLS_elementAsFunctionalComponent(__VLS_43);
                        const __VLS_45 = __VLS_44({ ...{}, class: ("drawer-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_44));
                        ({}({ ...{}, class: ("drawer-body"), }));
                        {
                            const __VLS_48 = __VLS_intrinsicElements["div"];
                            const __VLS_49 = __VLS_elementAsFunctionalComponent(__VLS_48);
                            const __VLS_50 = __VLS_49({ ...{}, class: ("profile-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_49));
                            ({}({ ...{}, class: ("profile-card"), }));
                            {
                                const __VLS_53 = {}.ChannelAvatar;
                                const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({ ...{}, avatar: ((__VLS_ctx.newAvatar)), name: ((__VLS_ctx.newName || __VLS_ctx.currentUser.name)), size: ((72)), }));
                                ({}.ChannelAvatar);
                                const __VLS_55 = __VLS_54({ ...{}, avatar: ((__VLS_ctx.newAvatar)), name: ((__VLS_ctx.newName || __VLS_ctx.currentUser.name)), size: ((72)), }, ...__VLS_functionalComponentArgsRest(__VLS_54));
                                ({}({ ...{}, avatar: ((__VLS_ctx.newAvatar)), name: ((__VLS_ctx.newName || __VLS_ctx.currentUser.name)), size: ((72)), }));
                                const __VLS_56 = __VLS_pickFunctionalComponentCtx(__VLS_53, __VLS_55);
                            }
                            {
                                const __VLS_58 = __VLS_intrinsicElements["div"];
                                const __VLS_59 = __VLS_elementAsFunctionalComponent(__VLS_58);
                                const __VLS_60 = __VLS_59({ ...{}, class: ("profile-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
                                ({}({ ...{}, class: ("profile-info"), }));
                                {
                                    const __VLS_63 = __VLS_intrinsicElements["div"];
                                    const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                                    const __VLS_65 = __VLS_64({ ...{}, class: ("profile-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                                    ({}({ ...{}, class: ("profile-name"), }));
                                    (__VLS_ctx.currentUser.name);
                                    (__VLS_66.slots).default;
                                    const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                                }
                                {
                                    const __VLS_68 = __VLS_intrinsicElements["div"];
                                    const __VLS_69 = __VLS_elementAsFunctionalComponent(__VLS_68);
                                    const __VLS_70 = __VLS_69({ ...{}, class: ("profile-uid"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                                    ({}({ ...{}, class: ("profile-uid"), }));
                                    (__VLS_ctx.currentUser.uid);
                                    (__VLS_71.slots).default;
                                    const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                                }
                                (__VLS_61.slots).default;
                                const __VLS_61 = __VLS_pickFunctionalComponentCtx(__VLS_58, __VLS_60);
                            }
                            (__VLS_51.slots).default;
                            const __VLS_51 = __VLS_pickFunctionalComponentCtx(__VLS_48, __VLS_50);
                        }
                        {
                            const __VLS_73 = __VLS_intrinsicElements["div"];
                            const __VLS_74 = __VLS_elementAsFunctionalComponent(__VLS_73);
                            const __VLS_75 = __VLS_74({ ...{}, class: ("form-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                            ({}({ ...{}, class: ("form-section"), }));
                            {
                                const __VLS_78 = __VLS_intrinsicElements["h4"];
                                const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                                const __VLS_80 = __VLS_79({ ...{}, class: ("section-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                                ({}({ ...{}, class: ("section-title"), }));
                                (__VLS_81.slots).default;
                                const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                            }
                            {
                                const __VLS_83 = __VLS_intrinsicElements["div"];
                                const __VLS_84 = __VLS_elementAsFunctionalComponent(__VLS_83);
                                const __VLS_85 = __VLS_84({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                                ({}({ ...{}, class: ("form-item"), }));
                                {
                                    const __VLS_88 = __VLS_intrinsicElements["label"];
                                    const __VLS_89 = __VLS_elementAsFunctionalComponent(__VLS_88);
                                    const __VLS_90 = __VLS_89({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                                    ({}({ ...{}, class: ("form-label"), }));
                                    (__VLS_91.slots).default;
                                    const __VLS_91 = __VLS_pickFunctionalComponentCtx(__VLS_88, __VLS_90);
                                }
                                {
                                    const __VLS_93 = __VLS_intrinsicElements["input"];
                                    const __VLS_94 = __VLS_elementAsFunctionalComponent(__VLS_93);
                                    const __VLS_95 = __VLS_94({ ...{}, value: ((__VLS_ctx.newName)), type: ("text"), class: ("form-input"), placeholder: ("请输入新的昵称"), }, ...__VLS_functionalComponentArgsRest(__VLS_94));
                                    ({}({ ...{}, value: ((__VLS_ctx.newName)), type: ("text"), class: ("form-input"), placeholder: ("请输入新的昵称"), }));
                                    const __VLS_96 = __VLS_pickFunctionalComponentCtx(__VLS_93, __VLS_95);
                                }
                                (__VLS_86.slots).default;
                                const __VLS_86 = __VLS_pickFunctionalComponentCtx(__VLS_83, __VLS_85);
                            }
                            {
                                const __VLS_98 = __VLS_intrinsicElements["div"];
                                const __VLS_99 = __VLS_elementAsFunctionalComponent(__VLS_98);
                                const __VLS_100 = __VLS_99({ ...{}, class: ("form-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
                                ({}({ ...{}, class: ("form-item"), }));
                                {
                                    const __VLS_103 = __VLS_intrinsicElements["label"];
                                    const __VLS_104 = __VLS_elementAsFunctionalComponent(__VLS_103);
                                    const __VLS_105 = __VLS_104({ ...{}, class: ("form-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                                    ({}({ ...{}, class: ("form-label"), }));
                                    (__VLS_106.slots).default;
                                    const __VLS_106 = __VLS_pickFunctionalComponentCtx(__VLS_103, __VLS_105);
                                }
                                {
                                    const __VLS_108 = __VLS_intrinsicElements["div"];
                                    const __VLS_109 = __VLS_elementAsFunctionalComponent(__VLS_108);
                                    const __VLS_110 = __VLS_109({ ...{}, class: ("preset-avatars"), }, ...__VLS_functionalComponentArgsRest(__VLS_109));
                                    ({}({ ...{}, class: ("preset-avatars"), }));
                                    for (const [p] of __VLS_getVForSourceType((__VLS_ctx.presets))) {
                                        {
                                            const __VLS_113 = __VLS_intrinsicElements["div"];
                                            const __VLS_114 = __VLS_elementAsFunctionalComponent(__VLS_113);
                                            const __VLS_115 = __VLS_114({ ...{ 'onClick': {}, }, key: ((p)), class: ("preset-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_114));
                                            ({}({ ...{ 'onClick': {}, }, key: ((p)), class: ("preset-item"), }));
                                            ({ active: __VLS_ctx.newAvatar === p });
                                            __VLS_styleScopedClasses = ({ active: newAvatar === p });
                                            let __VLS_118 = { 'click': __VLS_pickEvent(__VLS_117['click'], {}.onClick) };
                                            __VLS_118 = { click: $event => {
                                                    if (!((__VLS_ctx.visible)))
                                                        return;
                                                    if (!((__VLS_ctx.currentUser)))
                                                        return;
                                                    __VLS_ctx.selectPresetAvatar(p);
                                                    // @ts-ignore
                                                    [currentUser, newAvatar, newName, currentUser, newAvatar, newName, currentUser, newAvatar, newName, currentUser, currentUser, currentUser, newName, newName, presets, newAvatar, selectPresetAvatar,];
                                                }
                                            };
                                            {
                                                const __VLS_119 = __VLS_intrinsicElements["img"];
                                                const __VLS_120 = __VLS_elementAsFunctionalComponent(__VLS_119);
                                                const __VLS_121 = __VLS_120({ ...{}, src: ((p)), class: ("preset-img"), alt: ("Preset Avatar"), }, ...__VLS_functionalComponentArgsRest(__VLS_120));
                                                ({}({ ...{}, src: ((p)), class: ("preset-img"), alt: ("Preset Avatar"), }));
                                                const __VLS_122 = __VLS_pickFunctionalComponentCtx(__VLS_119, __VLS_121);
                                            }
                                            (__VLS_116.slots).default;
                                            const __VLS_116 = __VLS_pickFunctionalComponentCtx(__VLS_113, __VLS_115);
                                            let __VLS_117;
                                        }
                                    }
                                    (__VLS_111.slots).default;
                                    const __VLS_111 = __VLS_pickFunctionalComponentCtx(__VLS_108, __VLS_110);
                                }
                                (__VLS_101.slots).default;
                                const __VLS_101 = __VLS_pickFunctionalComponentCtx(__VLS_98, __VLS_100);
                            }
                            {
                                const __VLS_124 = __VLS_intrinsicElements["button"];
                                const __VLS_125 = __VLS_elementAsFunctionalComponent(__VLS_124);
                                const __VLS_126 = __VLS_125({ ...{ 'onClick': {}, }, class: ("save-btn"), disabled: ((__VLS_ctx.saving)), }, ...__VLS_functionalComponentArgsRest(__VLS_125));
                                ({}({ ...{ 'onClick': {}, }, class: ("save-btn"), disabled: ((__VLS_ctx.saving)), }));
                                let __VLS_129 = { 'click': __VLS_pickEvent(__VLS_128['click'], {}.onClick) };
                                __VLS_129 = { click: (__VLS_ctx.handleSave) };
                                (__VLS_ctx.saving ? '正在保存...' : '保存修改');
                                (__VLS_127.slots).default;
                                const __VLS_127 = __VLS_pickFunctionalComponentCtx(__VLS_124, __VLS_126);
                                let __VLS_128;
                            }
                            (__VLS_76.slots).default;
                            const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
                        }
                        {
                            const __VLS_130 = __VLS_intrinsicElements["div"];
                            const __VLS_131 = __VLS_elementAsFunctionalComponent(__VLS_130);
                            const __VLS_132 = __VLS_131({ ...{}, class: ("form-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_131));
                            ({}({ ...{}, class: ("form-section"), }));
                            {
                                const __VLS_135 = __VLS_intrinsicElements["h4"];
                                const __VLS_136 = __VLS_elementAsFunctionalComponent(__VLS_135);
                                const __VLS_137 = __VLS_136({ ...{}, class: ("section-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_136));
                                ({}({ ...{}, class: ("section-title"), }));
                                (__VLS_138.slots).default;
                                const __VLS_138 = __VLS_pickFunctionalComponentCtx(__VLS_135, __VLS_137);
                            }
                            {
                                const __VLS_140 = __VLS_intrinsicElements["div"];
                                const __VLS_141 = __VLS_elementAsFunctionalComponent(__VLS_140);
                                const __VLS_142 = __VLS_141({ ...{}, class: ("pref-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_141));
                                ({}({ ...{}, class: ("pref-item"), }));
                                {
                                    const __VLS_145 = __VLS_intrinsicElements["div"];
                                    const __VLS_146 = __VLS_elementAsFunctionalComponent(__VLS_145);
                                    const __VLS_147 = __VLS_146({ ...{}, class: ("pref-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_146));
                                    ({}({ ...{}, class: ("pref-info"), }));
                                    {
                                        const __VLS_150 = __VLS_intrinsicElements["span"];
                                        const __VLS_151 = __VLS_elementAsFunctionalComponent(__VLS_150);
                                        const __VLS_152 = __VLS_151({ ...{}, class: ("pref-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_151));
                                        ({}({ ...{}, class: ("pref-title"), }));
                                        (__VLS_153.slots).default;
                                        const __VLS_153 = __VLS_pickFunctionalComponentCtx(__VLS_150, __VLS_152);
                                    }
                                    {
                                        const __VLS_155 = __VLS_intrinsicElements["span"];
                                        const __VLS_156 = __VLS_elementAsFunctionalComponent(__VLS_155);
                                        const __VLS_157 = __VLS_156({ ...{}, class: ("pref-desc"), }, ...__VLS_functionalComponentArgsRest(__VLS_156));
                                        ({}({ ...{}, class: ("pref-desc"), }));
                                        (__VLS_158.slots).default;
                                        const __VLS_158 = __VLS_pickFunctionalComponentCtx(__VLS_155, __VLS_157);
                                    }
                                    (__VLS_148.slots).default;
                                    const __VLS_148 = __VLS_pickFunctionalComponentCtx(__VLS_145, __VLS_147);
                                }
                                {
                                    const __VLS_160 = __VLS_intrinsicElements["div"];
                                    const __VLS_161 = __VLS_elementAsFunctionalComponent(__VLS_160);
                                    const __VLS_162 = __VLS_161({ ...{}, class: ("toggle-switch active"), }, ...__VLS_functionalComponentArgsRest(__VLS_161));
                                    ({}({ ...{}, class: ("toggle-switch active"), }));
                                    {
                                        const __VLS_165 = __VLS_intrinsicElements["div"];
                                        const __VLS_166 = __VLS_elementAsFunctionalComponent(__VLS_165);
                                        const __VLS_167 = __VLS_166({ ...{}, class: ("toggle-thumb"), }, ...__VLS_functionalComponentArgsRest(__VLS_166));
                                        ({}({ ...{}, class: ("toggle-thumb"), }));
                                        const __VLS_168 = __VLS_pickFunctionalComponentCtx(__VLS_165, __VLS_167);
                                    }
                                    (__VLS_163.slots).default;
                                    const __VLS_163 = __VLS_pickFunctionalComponentCtx(__VLS_160, __VLS_162);
                                }
                                (__VLS_143.slots).default;
                                const __VLS_143 = __VLS_pickFunctionalComponentCtx(__VLS_140, __VLS_142);
                            }
                            {
                                const __VLS_170 = __VLS_intrinsicElements["div"];
                                const __VLS_171 = __VLS_elementAsFunctionalComponent(__VLS_170);
                                const __VLS_172 = __VLS_171({ ...{}, class: ("pref-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_171));
                                ({}({ ...{}, class: ("pref-item"), }));
                                {
                                    const __VLS_175 = __VLS_intrinsicElements["div"];
                                    const __VLS_176 = __VLS_elementAsFunctionalComponent(__VLS_175);
                                    const __VLS_177 = __VLS_176({ ...{}, class: ("pref-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_176));
                                    ({}({ ...{}, class: ("pref-info"), }));
                                    {
                                        const __VLS_180 = __VLS_intrinsicElements["span"];
                                        const __VLS_181 = __VLS_elementAsFunctionalComponent(__VLS_180);
                                        const __VLS_182 = __VLS_181({ ...{}, class: ("pref-title"), }, ...__VLS_functionalComponentArgsRest(__VLS_181));
                                        ({}({ ...{}, class: ("pref-title"), }));
                                        (__VLS_183.slots).default;
                                        const __VLS_183 = __VLS_pickFunctionalComponentCtx(__VLS_180, __VLS_182);
                                    }
                                    {
                                        const __VLS_185 = __VLS_intrinsicElements["span"];
                                        const __VLS_186 = __VLS_elementAsFunctionalComponent(__VLS_185);
                                        const __VLS_187 = __VLS_186({ ...{}, class: ("pref-desc"), }, ...__VLS_functionalComponentArgsRest(__VLS_186));
                                        ({}({ ...{}, class: ("pref-desc"), }));
                                        (__VLS_188.slots).default;
                                        const __VLS_188 = __VLS_pickFunctionalComponentCtx(__VLS_185, __VLS_187);
                                    }
                                    (__VLS_178.slots).default;
                                    const __VLS_178 = __VLS_pickFunctionalComponentCtx(__VLS_175, __VLS_177);
                                }
                                {
                                    const __VLS_190 = __VLS_intrinsicElements["div"];
                                    const __VLS_191 = __VLS_elementAsFunctionalComponent(__VLS_190);
                                    const __VLS_192 = __VLS_191({ ...{}, class: ("toggle-switch active"), }, ...__VLS_functionalComponentArgsRest(__VLS_191));
                                    ({}({ ...{}, class: ("toggle-switch active"), }));
                                    {
                                        const __VLS_195 = __VLS_intrinsicElements["div"];
                                        const __VLS_196 = __VLS_elementAsFunctionalComponent(__VLS_195);
                                        const __VLS_197 = __VLS_196({ ...{}, class: ("toggle-thumb"), }, ...__VLS_functionalComponentArgsRest(__VLS_196));
                                        ({}({ ...{}, class: ("toggle-thumb"), }));
                                        const __VLS_198 = __VLS_pickFunctionalComponentCtx(__VLS_195, __VLS_197);
                                    }
                                    (__VLS_193.slots).default;
                                    const __VLS_193 = __VLS_pickFunctionalComponentCtx(__VLS_190, __VLS_192);
                                }
                                (__VLS_173.slots).default;
                                const __VLS_173 = __VLS_pickFunctionalComponentCtx(__VLS_170, __VLS_172);
                            }
                            {
                                const __VLS_200 = __VLS_intrinsicElements["button"];
                                const __VLS_201 = __VLS_elementAsFunctionalComponent(__VLS_200);
                                const __VLS_202 = __VLS_201({ ...{ 'onClick': {}, }, class: ("secondary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_201));
                                ({}({ ...{ 'onClick': {}, }, class: ("secondary-btn"), }));
                                let __VLS_205 = { 'click': __VLS_pickEvent(__VLS_204['click'], {}.onClick) };
                                __VLS_205 = { click: (__VLS_ctx.goToDevices) };
                                (__VLS_203.slots).default;
                                const __VLS_203 = __VLS_pickFunctionalComponentCtx(__VLS_200, __VLS_202);
                                let __VLS_204;
                            }
                            (__VLS_133.slots).default;
                            const __VLS_133 = __VLS_pickFunctionalComponentCtx(__VLS_130, __VLS_132);
                        }
                        (__VLS_46.slots).default;
                        const __VLS_46 = __VLS_pickFunctionalComponentCtx(__VLS_43, __VLS_45);
                    }
                    // @ts-ignore
                    [saving, saving, handleSave, saving, goToDevices,];
                }
                (__VLS_9.slots).default;
                const __VLS_9 = __VLS_pickFunctionalComponentCtx(__VLS_6, __VLS_8);
                let __VLS_10;
            }
            (__VLS_3.slots).default;
            const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
            let __VLS_4;
        }
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["drawer-overlay"];
        __VLS_styleScopedClasses["drawer-content"];
        __VLS_styleScopedClasses["drawer-header"];
        __VLS_styleScopedClasses["drawer-title"];
        __VLS_styleScopedClasses["close-btn"];
        __VLS_styleScopedClasses["close-icon"];
        __VLS_styleScopedClasses["drawer-body"];
        __VLS_styleScopedClasses["profile-card"];
        __VLS_styleScopedClasses["profile-info"];
        __VLS_styleScopedClasses["profile-name"];
        __VLS_styleScopedClasses["profile-uid"];
        __VLS_styleScopedClasses["form-section"];
        __VLS_styleScopedClasses["section-title"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["form-input"];
        __VLS_styleScopedClasses["form-item"];
        __VLS_styleScopedClasses["form-label"];
        __VLS_styleScopedClasses["preset-avatars"];
        __VLS_styleScopedClasses["preset-item"];
        __VLS_styleScopedClasses["preset-img"];
        __VLS_styleScopedClasses["save-btn"];
        __VLS_styleScopedClasses["form-section"];
        __VLS_styleScopedClasses["section-title"];
        __VLS_styleScopedClasses["pref-item"];
        __VLS_styleScopedClasses["pref-info"];
        __VLS_styleScopedClasses["pref-title"];
        __VLS_styleScopedClasses["pref-desc"];
        __VLS_styleScopedClasses["toggle-switch"];
        __VLS_styleScopedClasses["active"];
        __VLS_styleScopedClasses["toggle-thumb"];
        __VLS_styleScopedClasses["pref-item"];
        __VLS_styleScopedClasses["pref-info"];
        __VLS_styleScopedClasses["pref-title"];
        __VLS_styleScopedClasses["pref-desc"];
        __VLS_styleScopedClasses["toggle-switch"];
        __VLS_styleScopedClasses["active"];
        __VLS_styleScopedClasses["toggle-thumb"];
        __VLS_styleScopedClasses["secondary-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            emit: emit,
            newName: newName,
            newAvatar: newAvatar,
            saving: saving,
            currentUser: currentUser,
            handleSave: handleSave,
            presets: presets,
            selectPresetAvatar: selectPresetAvatar,
            goToDevices: goToDevices,
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

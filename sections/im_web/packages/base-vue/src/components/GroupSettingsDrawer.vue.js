/* __placeholder__ */
import { ref, onMounted, computed } from 'vue';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { groupApi } from '@tsdaodao/datasource-vue';
import ChannelAvatar from './ChannelAvatar.vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['close', 'members-click']);
const groupStore = useGroupStore();
const userStore = useUserStore();
const groupInfo = computed(() => groupStore.groups[props.groupNo]);
const members = computed(() => groupStore.groupMembers[props.groupNo] || []);
const editingName = ref(false);
const newName = ref('');
const editingNotice = ref(false);
const newNotice = ref('');
const isOwner = computed(() => {
    return groupInfo.value?.owner === userStore.currentUser?.uid;
});
onMounted(async () => {
    if (props.groupNo) {
        await groupStore.getGroupInfo(props.groupNo);
        await groupStore.fetchGroupMembers(props.groupNo);
    }
});
async function saveGroupName() {
    if (!newName.value.trim())
        return;
    try {
        await groupApi.updateGroupInfo(props.groupNo, { name: newName.value });
        Message.success('群名修改成功');
        if (groupInfo.value)
            groupInfo.value.name = newName.value;
        editingName.value = false;
    }
    catch (err) {
        Message.error(err.msg || '修改失败');
    }
}
async function saveGroupNotice() {
    try {
        await groupApi.updateGroupInfo(props.groupNo, { notice: newNotice.value });
        Message.success('公告修改成功');
        if (groupInfo.value)
            groupInfo.value.notice = newNotice.value;
        editingNotice.value = false;
    }
    catch (err) {
        Message.error(err.msg || '修改失败');
    }
}
async function handleDisband() {
    try {
        await groupApi.disbandGroup(props.groupNo);
        Message.success('群组已解散');
        emit('close');
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
    }
}
async function handleExit() {
    try {
        await groupApi.exitGroup(props.groupNo);
        Message.success('已退出群聊');
        emit('close');
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
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
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
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
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar, ChannelAvatar,];
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
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.textarea;
    __VLS_intrinsicElements.textarea;
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
                {
                    const __VLS_43 = __VLS_intrinsicElements["div"];
                    const __VLS_44 = __VLS_elementAsFunctionalComponent(__VLS_43);
                    const __VLS_45 = __VLS_44({ ...{}, class: ("drawer-body"), }, ...__VLS_functionalComponentArgsRest(__VLS_44));
                    ({}({ ...{}, class: ("drawer-body"), }));
                    {
                        const __VLS_48 = __VLS_intrinsicElements["div"];
                        const __VLS_49 = __VLS_elementAsFunctionalComponent(__VLS_48);
                        const __VLS_50 = __VLS_49({ ...{}, class: ("group-profile-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_49));
                        ({}({ ...{}, class: ("group-profile-section"), }));
                        {
                            const __VLS_53 = {}.ChannelAvatar;
                            const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({ ...{}, avatar: ((__VLS_ctx.groupInfo?.avatar)), name: ((__VLS_ctx.groupInfo?.name)), isGroup: ((true)), size: ((64)), }));
                            ({}.ChannelAvatar);
                            const __VLS_55 = __VLS_54({ ...{}, avatar: ((__VLS_ctx.groupInfo?.avatar)), name: ((__VLS_ctx.groupInfo?.name)), isGroup: ((true)), size: ((64)), }, ...__VLS_functionalComponentArgsRest(__VLS_54));
                            ({}({ ...{}, avatar: ((__VLS_ctx.groupInfo?.avatar)), name: ((__VLS_ctx.groupInfo?.name)), isGroup: ((true)), size: ((64)), }));
                            const __VLS_56 = __VLS_pickFunctionalComponentCtx(__VLS_53, __VLS_55);
                        }
                        {
                            const __VLS_58 = __VLS_intrinsicElements["div"];
                            const __VLS_59 = __VLS_elementAsFunctionalComponent(__VLS_58);
                            const __VLS_60 = __VLS_59({ ...{}, class: ("info-fields"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
                            ({}({ ...{}, class: ("info-fields"), }));
                            {
                                const __VLS_63 = __VLS_intrinsicElements["div"];
                                const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                                const __VLS_65 = __VLS_64({ ...{}, class: ("info-field"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                                ({}({ ...{}, class: ("info-field"), }));
                                {
                                    const __VLS_68 = __VLS_intrinsicElements["span"];
                                    const __VLS_69 = __VLS_elementAsFunctionalComponent(__VLS_68);
                                    const __VLS_70 = __VLS_69({ ...{}, class: ("field-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                                    ({}({ ...{}, class: ("field-label"), }));
                                    (__VLS_71.slots).default;
                                    const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                                }
                                if (!__VLS_ctx.editingName) {
                                    {
                                        const __VLS_73 = __VLS_intrinsicElements["div"];
                                        const __VLS_74 = __VLS_elementAsFunctionalComponent(__VLS_73);
                                        const __VLS_75 = __VLS_74({ ...{}, class: ("field-value-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                                        ({}({ ...{}, class: ("field-value-row"), }));
                                        {
                                            const __VLS_78 = __VLS_intrinsicElements["span"];
                                            const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                                            const __VLS_80 = __VLS_79({ ...{}, class: ("field-value"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                                            ({}({ ...{}, class: ("field-value"), }));
                                            (__VLS_ctx.groupInfo?.name);
                                            (__VLS_81.slots).default;
                                            const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                                        }
                                        if (__VLS_ctx.isOwner) {
                                            {
                                                const __VLS_83 = __VLS_intrinsicElements["button"];
                                                const __VLS_84 = __VLS_elementAsFunctionalComponent(__VLS_83);
                                                const __VLS_85 = __VLS_84({ ...{ 'onClick': {}, }, class: ("edit-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                                                ({}({ ...{ 'onClick': {}, }, class: ("edit-btn"), }));
                                                let __VLS_88 = { 'click': __VLS_pickEvent(__VLS_87['click'], {}.onClick) };
                                                __VLS_88 = { click: $event => {
                                                        if (!((__VLS_ctx.visible)))
                                                            return;
                                                        if (!((!__VLS_ctx.editingName)))
                                                            return;
                                                        if (!((__VLS_ctx.isOwner)))
                                                            return;
                                                        __VLS_ctx.editingName = true;
                                                        __VLS_ctx.newName = __VLS_ctx.groupInfo?.name || '';
                                                        // @ts-ignore
                                                        [groupInfo, groupInfo, groupInfo, groupInfo, groupInfo, groupInfo, editingName, groupInfo, isOwner, editingName, newName, groupInfo,];
                                                    }
                                                };
                                                (__VLS_86.slots).default;
                                                const __VLS_86 = __VLS_pickFunctionalComponentCtx(__VLS_83, __VLS_85);
                                                let __VLS_87;
                                            }
                                        }
                                        (__VLS_76.slots).default;
                                        const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
                                    }
                                }
                                else {
                                    {
                                        const __VLS_89 = __VLS_intrinsicElements["div"];
                                        const __VLS_90 = __VLS_elementAsFunctionalComponent(__VLS_89);
                                        const __VLS_91 = __VLS_90({ ...{}, class: ("edit-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_90));
                                        ({}({ ...{}, class: ("edit-row"), }));
                                        {
                                            const __VLS_94 = __VLS_intrinsicElements["input"];
                                            const __VLS_95 = __VLS_elementAsFunctionalComponent(__VLS_94);
                                            const __VLS_96 = __VLS_95({ ...{}, value: ((__VLS_ctx.newName)), type: ("text"), class: ("edit-input"), }, ...__VLS_functionalComponentArgsRest(__VLS_95));
                                            ({}({ ...{}, value: ((__VLS_ctx.newName)), type: ("text"), class: ("edit-input"), }));
                                            const __VLS_97 = __VLS_pickFunctionalComponentCtx(__VLS_94, __VLS_96);
                                        }
                                        {
                                            const __VLS_99 = __VLS_intrinsicElements["button"];
                                            const __VLS_100 = __VLS_elementAsFunctionalComponent(__VLS_99);
                                            const __VLS_101 = __VLS_100({ ...{ 'onClick': {}, }, class: ("save-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_100));
                                            ({}({ ...{ 'onClick': {}, }, class: ("save-btn"), }));
                                            let __VLS_104 = { 'click': __VLS_pickEvent(__VLS_103['click'], {}.onClick) };
                                            __VLS_104 = { click: (__VLS_ctx.saveGroupName) };
                                            (__VLS_102.slots).default;
                                            const __VLS_102 = __VLS_pickFunctionalComponentCtx(__VLS_99, __VLS_101);
                                            let __VLS_103;
                                        }
                                        (__VLS_92.slots).default;
                                        const __VLS_92 = __VLS_pickFunctionalComponentCtx(__VLS_89, __VLS_91);
                                    }
                                    // @ts-ignore
                                    [newName, newName, saveGroupName,];
                                }
                                (__VLS_66.slots).default;
                                const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                            }
                            {
                                const __VLS_105 = __VLS_intrinsicElements["div"];
                                const __VLS_106 = __VLS_elementAsFunctionalComponent(__VLS_105);
                                const __VLS_107 = __VLS_106({ ...{}, class: ("info-field"), }, ...__VLS_functionalComponentArgsRest(__VLS_106));
                                ({}({ ...{}, class: ("info-field"), }));
                                {
                                    const __VLS_110 = __VLS_intrinsicElements["span"];
                                    const __VLS_111 = __VLS_elementAsFunctionalComponent(__VLS_110);
                                    const __VLS_112 = __VLS_111({ ...{}, class: ("field-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_111));
                                    ({}({ ...{}, class: ("field-label"), }));
                                    (__VLS_113.slots).default;
                                    const __VLS_113 = __VLS_pickFunctionalComponentCtx(__VLS_110, __VLS_112);
                                }
                                if (!__VLS_ctx.editingNotice) {
                                    {
                                        const __VLS_115 = __VLS_intrinsicElements["div"];
                                        const __VLS_116 = __VLS_elementAsFunctionalComponent(__VLS_115);
                                        const __VLS_117 = __VLS_116({ ...{}, class: ("field-value-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_116));
                                        ({}({ ...{}, class: ("field-value-row"), }));
                                        {
                                            const __VLS_120 = __VLS_intrinsicElements["span"];
                                            const __VLS_121 = __VLS_elementAsFunctionalComponent(__VLS_120);
                                            const __VLS_122 = __VLS_121({ ...{}, class: ("field-value empty-notice"), }, ...__VLS_functionalComponentArgsRest(__VLS_121));
                                            ({}({ ...{}, class: ("field-value empty-notice"), }));
                                            (__VLS_ctx.groupInfo?.notice || '未设置群公告');
                                            (__VLS_123.slots).default;
                                            const __VLS_123 = __VLS_pickFunctionalComponentCtx(__VLS_120, __VLS_122);
                                        }
                                        if (__VLS_ctx.isOwner) {
                                            {
                                                const __VLS_125 = __VLS_intrinsicElements["button"];
                                                const __VLS_126 = __VLS_elementAsFunctionalComponent(__VLS_125);
                                                const __VLS_127 = __VLS_126({ ...{ 'onClick': {}, }, class: ("edit-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_126));
                                                ({}({ ...{ 'onClick': {}, }, class: ("edit-btn"), }));
                                                let __VLS_130 = { 'click': __VLS_pickEvent(__VLS_129['click'], {}.onClick) };
                                                __VLS_130 = { click: $event => {
                                                        if (!((__VLS_ctx.visible)))
                                                            return;
                                                        if (!((!__VLS_ctx.editingNotice)))
                                                            return;
                                                        if (!((__VLS_ctx.isOwner)))
                                                            return;
                                                        __VLS_ctx.editingNotice = true;
                                                        __VLS_ctx.newNotice = __VLS_ctx.groupInfo?.notice || '';
                                                        // @ts-ignore
                                                        [editingNotice, groupInfo, isOwner, editingNotice, newNotice, groupInfo,];
                                                    }
                                                };
                                                (__VLS_128.slots).default;
                                                const __VLS_128 = __VLS_pickFunctionalComponentCtx(__VLS_125, __VLS_127);
                                                let __VLS_129;
                                            }
                                        }
                                        (__VLS_118.slots).default;
                                        const __VLS_118 = __VLS_pickFunctionalComponentCtx(__VLS_115, __VLS_117);
                                    }
                                }
                                else {
                                    {
                                        const __VLS_131 = __VLS_intrinsicElements["div"];
                                        const __VLS_132 = __VLS_elementAsFunctionalComponent(__VLS_131);
                                        const __VLS_133 = __VLS_132({ ...{}, class: ("edit-row notice-edit"), }, ...__VLS_functionalComponentArgsRest(__VLS_132));
                                        ({}({ ...{}, class: ("edit-row notice-edit"), }));
                                        {
                                            const __VLS_136 = __VLS_intrinsicElements["textarea"];
                                            const __VLS_137 = __VLS_elementAsFunctionalComponent(__VLS_136);
                                            const __VLS_138 = __VLS_137({ ...{}, value: ((__VLS_ctx.newNotice)), class: ("edit-textarea"), rows: ("3"), }, ...__VLS_functionalComponentArgsRest(__VLS_137));
                                            ({}({ ...{}, value: ((__VLS_ctx.newNotice)), class: ("edit-textarea"), rows: ("3"), }));
                                            const __VLS_139 = __VLS_pickFunctionalComponentCtx(__VLS_136, __VLS_138);
                                        }
                                        {
                                            const __VLS_141 = __VLS_intrinsicElements["button"];
                                            const __VLS_142 = __VLS_elementAsFunctionalComponent(__VLS_141);
                                            const __VLS_143 = __VLS_142({ ...{ 'onClick': {}, }, class: ("save-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_142));
                                            ({}({ ...{ 'onClick': {}, }, class: ("save-btn"), }));
                                            let __VLS_146 = { 'click': __VLS_pickEvent(__VLS_145['click'], {}.onClick) };
                                            __VLS_146 = { click: (__VLS_ctx.saveGroupNotice) };
                                            (__VLS_144.slots).default;
                                            const __VLS_144 = __VLS_pickFunctionalComponentCtx(__VLS_141, __VLS_143);
                                            let __VLS_145;
                                        }
                                        (__VLS_134.slots).default;
                                        const __VLS_134 = __VLS_pickFunctionalComponentCtx(__VLS_131, __VLS_133);
                                    }
                                    // @ts-ignore
                                    [newNotice, newNotice, saveGroupNotice,];
                                }
                                (__VLS_108.slots).default;
                                const __VLS_108 = __VLS_pickFunctionalComponentCtx(__VLS_105, __VLS_107);
                            }
                            (__VLS_61.slots).default;
                            const __VLS_61 = __VLS_pickFunctionalComponentCtx(__VLS_58, __VLS_60);
                        }
                        (__VLS_51.slots).default;
                        const __VLS_51 = __VLS_pickFunctionalComponentCtx(__VLS_48, __VLS_50);
                    }
                    {
                        const __VLS_147 = __VLS_intrinsicElements["div"];
                        const __VLS_148 = __VLS_elementAsFunctionalComponent(__VLS_147);
                        const __VLS_149 = __VLS_148({ ...{}, class: ("members-summary-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_148));
                        ({}({ ...{}, class: ("members-summary-section"), }));
                        {
                            const __VLS_152 = __VLS_intrinsicElements["div"];
                            const __VLS_153 = __VLS_elementAsFunctionalComponent(__VLS_152);
                            const __VLS_154 = __VLS_153({ ...{ 'onClick': {}, }, class: ("section-title-row"), }, ...__VLS_functionalComponentArgsRest(__VLS_153));
                            ({}({ ...{ 'onClick': {}, }, class: ("section-title-row"), }));
                            let __VLS_157 = { 'click': __VLS_pickEvent(__VLS_156['click'], {}.onClick) };
                            __VLS_157 = { click: $event => {
                                    if (!((__VLS_ctx.visible)))
                                        return;
                                    __VLS_ctx.emit('members-click');
                                    // @ts-ignore
                                    [emit,];
                                }
                            };
                            {
                                const __VLS_158 = __VLS_intrinsicElements["span"];
                                const __VLS_159 = __VLS_elementAsFunctionalComponent(__VLS_158);
                                const __VLS_160 = __VLS_159({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_159));
                                ({}({ ...{}, }));
                                (__VLS_ctx.members.length);
                                (__VLS_161.slots).default;
                                const __VLS_161 = __VLS_pickFunctionalComponentCtx(__VLS_158, __VLS_160);
                            }
                            {
                                const __VLS_163 = __VLS_intrinsicElements["button"];
                                const __VLS_164 = __VLS_elementAsFunctionalComponent(__VLS_163);
                                const __VLS_165 = __VLS_164({ ...{}, class: ("view-all-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_164));
                                ({}({ ...{}, class: ("view-all-btn"), }));
                                (__VLS_166.slots).default;
                                const __VLS_166 = __VLS_pickFunctionalComponentCtx(__VLS_163, __VLS_165);
                            }
                            (__VLS_155.slots).default;
                            const __VLS_155 = __VLS_pickFunctionalComponentCtx(__VLS_152, __VLS_154);
                            let __VLS_156;
                        }
                        {
                            const __VLS_168 = __VLS_intrinsicElements["div"];
                            const __VLS_169 = __VLS_elementAsFunctionalComponent(__VLS_168);
                            const __VLS_170 = __VLS_169({ ...{}, class: ("members-grid"), }, ...__VLS_functionalComponentArgsRest(__VLS_169));
                            ({}({ ...{}, class: ("members-grid"), }));
                            for (const [m] of __VLS_getVForSourceType((__VLS_ctx.members.slice(0, 8)))) {
                                {
                                    const __VLS_173 = __VLS_intrinsicElements["div"];
                                    const __VLS_174 = __VLS_elementAsFunctionalComponent(__VLS_173);
                                    const __VLS_175 = __VLS_174({ ...{}, key: ((m.uid)), class: ("member-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_174));
                                    ({}({ ...{}, key: ((m.uid)), class: ("member-item"), }));
                                    {
                                        const __VLS_178 = {}.ChannelAvatar;
                                        const __VLS_179 = __VLS_asFunctionalComponent(__VLS_178, new __VLS_178({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((32)), }));
                                        ({}.ChannelAvatar);
                                        const __VLS_180 = __VLS_179({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((32)), }, ...__VLS_functionalComponentArgsRest(__VLS_179));
                                        ({}({ ...{}, avatar: ((m.avatar)), name: ((m.name)), size: ((32)), }));
                                        const __VLS_181 = __VLS_pickFunctionalComponentCtx(__VLS_178, __VLS_180);
                                    }
                                    {
                                        const __VLS_183 = __VLS_intrinsicElements["span"];
                                        const __VLS_184 = __VLS_elementAsFunctionalComponent(__VLS_183);
                                        const __VLS_185 = __VLS_184({ ...{}, class: ("member-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_184));
                                        ({}({ ...{}, class: ("member-name"), }));
                                        (m.name);
                                        (__VLS_186.slots).default;
                                        const __VLS_186 = __VLS_pickFunctionalComponentCtx(__VLS_183, __VLS_185);
                                    }
                                    (__VLS_176.slots).default;
                                    const __VLS_176 = __VLS_pickFunctionalComponentCtx(__VLS_173, __VLS_175);
                                }
                                // @ts-ignore
                                [members, members,];
                            }
                            (__VLS_171.slots).default;
                            const __VLS_171 = __VLS_pickFunctionalComponentCtx(__VLS_168, __VLS_170);
                        }
                        (__VLS_150.slots).default;
                        const __VLS_150 = __VLS_pickFunctionalComponentCtx(__VLS_147, __VLS_149);
                    }
                    {
                        const __VLS_188 = __VLS_intrinsicElements["div"];
                        const __VLS_189 = __VLS_elementAsFunctionalComponent(__VLS_188);
                        const __VLS_190 = __VLS_189({ ...{}, class: ("danger-zone"), }, ...__VLS_functionalComponentArgsRest(__VLS_189));
                        ({}({ ...{}, class: ("danger-zone"), }));
                        if (__VLS_ctx.isOwner) {
                            {
                                const __VLS_193 = __VLS_intrinsicElements["button"];
                                const __VLS_194 = __VLS_elementAsFunctionalComponent(__VLS_193);
                                const __VLS_195 = __VLS_194({ ...{ 'onClick': {}, }, class: ("action-btn disband-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_194));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn disband-btn"), }));
                                let __VLS_198 = { 'click': __VLS_pickEvent(__VLS_197['click'], {}.onClick) };
                                __VLS_198 = { click: (__VLS_ctx.handleDisband) };
                                (__VLS_196.slots).default;
                                const __VLS_196 = __VLS_pickFunctionalComponentCtx(__VLS_193, __VLS_195);
                                let __VLS_197;
                            }
                            // @ts-ignore
                            [isOwner, handleDisband,];
                        }
                        else {
                            {
                                const __VLS_199 = __VLS_intrinsicElements["button"];
                                const __VLS_200 = __VLS_elementAsFunctionalComponent(__VLS_199);
                                const __VLS_201 = __VLS_200({ ...{ 'onClick': {}, }, class: ("action-btn exit-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_200));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn exit-btn"), }));
                                let __VLS_204 = { 'click': __VLS_pickEvent(__VLS_203['click'], {}.onClick) };
                                __VLS_204 = { click: (__VLS_ctx.handleExit) };
                                (__VLS_202.slots).default;
                                const __VLS_202 = __VLS_pickFunctionalComponentCtx(__VLS_199, __VLS_201);
                                let __VLS_203;
                            }
                            // @ts-ignore
                            [handleExit,];
                        }
                        (__VLS_191.slots).default;
                        const __VLS_191 = __VLS_pickFunctionalComponentCtx(__VLS_188, __VLS_190);
                    }
                    (__VLS_46.slots).default;
                    const __VLS_46 = __VLS_pickFunctionalComponentCtx(__VLS_43, __VLS_45);
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
        __VLS_styleScopedClasses["group-profile-section"];
        __VLS_styleScopedClasses["info-fields"];
        __VLS_styleScopedClasses["info-field"];
        __VLS_styleScopedClasses["field-label"];
        __VLS_styleScopedClasses["field-value-row"];
        __VLS_styleScopedClasses["field-value"];
        __VLS_styleScopedClasses["edit-btn"];
        __VLS_styleScopedClasses["edit-row"];
        __VLS_styleScopedClasses["edit-input"];
        __VLS_styleScopedClasses["save-btn"];
        __VLS_styleScopedClasses["info-field"];
        __VLS_styleScopedClasses["field-label"];
        __VLS_styleScopedClasses["field-value-row"];
        __VLS_styleScopedClasses["field-value"];
        __VLS_styleScopedClasses["empty-notice"];
        __VLS_styleScopedClasses["edit-btn"];
        __VLS_styleScopedClasses["edit-row"];
        __VLS_styleScopedClasses["notice-edit"];
        __VLS_styleScopedClasses["edit-textarea"];
        __VLS_styleScopedClasses["save-btn"];
        __VLS_styleScopedClasses["members-summary-section"];
        __VLS_styleScopedClasses["section-title-row"];
        __VLS_styleScopedClasses["view-all-btn"];
        __VLS_styleScopedClasses["members-grid"];
        __VLS_styleScopedClasses["member-item"];
        __VLS_styleScopedClasses["member-name"];
        __VLS_styleScopedClasses["danger-zone"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["disband-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["exit-btn"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            emit: emit,
            groupInfo: groupInfo,
            members: members,
            editingName: editingName,
            newName: newName,
            editingNotice: editingNotice,
            newNotice: newNotice,
            isOwner: isOwner,
            saveGroupName: saveGroupName,
            saveGroupNotice: saveGroupNotice,
            handleDisband: handleDisband,
            handleExit: handleExit,
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

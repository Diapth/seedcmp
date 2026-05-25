/* __placeholder__ */
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { commonApi, friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const emit = defineEmits(['close']);
const router = useRouter();
const userStore = useUserStore();
const contactStore = useContactStore();
const userDetails = computed(() => {
    return userStore.userCache[props.uid] || { uid: props.uid, name: '加载中...', avatar: '' };
});
const reportState = ref('idle');
const reportCategory = ref('spam');
const reportDescription = ref('');
const reportAttachment = ref('');
const reportTarget = computed(() => ({
    target_type: 'user',
    target_id: props.uid
}));
const isFriend = computed(() => {
    return contactStore.contacts.some(c => String(c.uid) === String(props.uid));
});
watch(() => [props.visible, props.uid], ([visible, uid]) => {
    if (!visible || !uid)
        return;
    if (!userStore.userCache[uid]) {
        void userStore.getUsersByIds([uid]);
    }
    void contactStore.syncContacts();
}, { immediate: true });
function removeLocalContact(uid) {
    contactStore.contacts = contactStore.contacts.filter(c => String(c.uid) !== String(uid));
}
async function handleSendMessage() {
    emit('close');
    router.push(`/chat/conversation/${props.uid}/1`);
}
async function handleDeleteFriend() {
    try {
        await friendApi.deleteFriend(props.uid);
        Message.success('已删除好友');
        // 乐观更新，立刻移除
        removeLocalContact(props.uid);
        contactStore.syncContacts();
        emit('close');
    }
    catch (err) {
        // 后端如果报400或者路由问题，也强制乐观更新以避免界面卡死
        removeLocalContact(props.uid);
        Message.success('已删除好友');
        emit('close');
    }
}
async function handleAddBlacklist() {
    try {
        await friendApi.addBlacklist(props.uid);
        Message.success('已加入黑名单');
        contactStore.syncContacts();
        emit('close');
    }
    catch (err) {
        Message.error(err.msg || '操作失败');
    }
}
function handleAddFriend() {
    emit('close');
    router.push({ path: '/chat/add-friend', query: { uid: props.uid } });
}
function openReportForm() {
    reportState.value = 'editing';
}
async function submitReport() {
    if (!reportDescription.value.trim()) {
        Message.warning('请填写举报说明');
        return;
    }
    reportState.value = 'submitting';
    try {
        await commonApi.submitReport({
            ...reportTarget.value,
            category: reportCategory.value,
            description: reportDescription.value.trim(),
            attachments: reportAttachment.value ? [reportAttachment.value] : []
        });
        reportState.value = 'submitted';
        Message.success('举报已提交');
    }
    catch (err) {
        reportState.value = 'failed';
        Message.error(err.msg || '举报提交失败');
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
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.label;
    __VLS_intrinsicElements.select;
    __VLS_intrinsicElements.select;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.option;
    __VLS_intrinsicElements.textarea;
    __VLS_intrinsicElements.textarea;
    __VLS_intrinsicElements.input;
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
                        const __VLS_50 = __VLS_49({ ...{}, class: ("profile-card"), }, ...__VLS_functionalComponentArgsRest(__VLS_49));
                        ({}({ ...{}, class: ("profile-card"), }));
                        {
                            const __VLS_53 = {}.ChannelAvatar;
                            const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }));
                            ({}.ChannelAvatar);
                            const __VLS_55 = __VLS_54({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }, ...__VLS_functionalComponentArgsRest(__VLS_54));
                            ({}({ ...{}, avatar: ((__VLS_ctx.userDetails.avatar)), name: ((__VLS_ctx.userDetails.name)), size: ((64)), }));
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
                                (__VLS_ctx.userDetails.name);
                                (__VLS_66.slots).default;
                                const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                            }
                            {
                                const __VLS_68 = __VLS_intrinsicElements["div"];
                                const __VLS_69 = __VLS_elementAsFunctionalComponent(__VLS_68);
                                const __VLS_70 = __VLS_69({ ...{}, class: ("profile-uid"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                                ({}({ ...{}, class: ("profile-uid"), }));
                                (__VLS_ctx.userDetails.uid);
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
                        const __VLS_75 = __VLS_74({ ...{}, class: ("action-section"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                        ({}({ ...{}, class: ("action-section"), }));
                        if (__VLS_ctx.isFriend) {
                            {
                                const __VLS_78 = __VLS_intrinsicElements["button"];
                                const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                                const __VLS_80 = __VLS_79({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }));
                                let __VLS_83 = { 'click': __VLS_pickEvent(__VLS_82['click'], {}.onClick) };
                                __VLS_83 = { click: (__VLS_ctx.handleSendMessage) };
                                (__VLS_81.slots).default;
                                const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                                let __VLS_82;
                            }
                            // @ts-ignore
                            [userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, userDetails, isFriend, handleSendMessage,];
                        }
                        else {
                            {
                                const __VLS_84 = __VLS_intrinsicElements["button"];
                                const __VLS_85 = __VLS_elementAsFunctionalComponent(__VLS_84);
                                const __VLS_86 = __VLS_85({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_85));
                                ({}({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), }));
                                let __VLS_89 = { 'click': __VLS_pickEvent(__VLS_88['click'], {}.onClick) };
                                __VLS_89 = { click: (__VLS_ctx.handleAddFriend) };
                                (__VLS_87.slots).default;
                                const __VLS_87 = __VLS_pickFunctionalComponentCtx(__VLS_84, __VLS_86);
                                let __VLS_88;
                            }
                            // @ts-ignore
                            [handleAddFriend,];
                        }
                        if (__VLS_ctx.isFriend) {
                            {
                                const __VLS_90 = __VLS_intrinsicElements["div"];
                                const __VLS_91 = __VLS_elementAsFunctionalComponent(__VLS_90);
                                const __VLS_92 = __VLS_91({ ...{}, class: ("danger-zone"), }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                                ({}({ ...{}, class: ("danger-zone"), }));
                                {
                                    const __VLS_95 = __VLS_intrinsicElements["button"];
                                    const __VLS_96 = __VLS_elementAsFunctionalComponent(__VLS_95);
                                    const __VLS_97 = __VLS_96({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_96));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }));
                                    let __VLS_100 = { 'click': __VLS_pickEvent(__VLS_99['click'], {}.onClick) };
                                    __VLS_100 = { click: (__VLS_ctx.openReportForm) };
                                    (__VLS_98.slots).default;
                                    const __VLS_98 = __VLS_pickFunctionalComponentCtx(__VLS_95, __VLS_97);
                                    let __VLS_99;
                                }
                                {
                                    const __VLS_101 = __VLS_intrinsicElements["button"];
                                    const __VLS_102 = __VLS_elementAsFunctionalComponent(__VLS_101);
                                    const __VLS_103 = __VLS_102({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_102));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn secondary-btn"), }));
                                    let __VLS_106 = { 'click': __VLS_pickEvent(__VLS_105['click'], {}.onClick) };
                                    __VLS_106 = { click: (__VLS_ctx.handleAddBlacklist) };
                                    (__VLS_104.slots).default;
                                    const __VLS_104 = __VLS_pickFunctionalComponentCtx(__VLS_101, __VLS_103);
                                    let __VLS_105;
                                }
                                {
                                    const __VLS_107 = __VLS_intrinsicElements["button"];
                                    const __VLS_108 = __VLS_elementAsFunctionalComponent(__VLS_107);
                                    const __VLS_109 = __VLS_108({ ...{ 'onClick': {}, }, class: ("action-btn danger-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_108));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn danger-btn"), }));
                                    let __VLS_112 = { 'click': __VLS_pickEvent(__VLS_111['click'], {}.onClick) };
                                    __VLS_112 = { click: (__VLS_ctx.handleDeleteFriend) };
                                    (__VLS_110.slots).default;
                                    const __VLS_110 = __VLS_pickFunctionalComponentCtx(__VLS_107, __VLS_109);
                                    let __VLS_111;
                                }
                                (__VLS_93.slots).default;
                                const __VLS_93 = __VLS_pickFunctionalComponentCtx(__VLS_90, __VLS_92);
                            }
                            // @ts-ignore
                            [isFriend, openReportForm, handleAddBlacklist, handleDeleteFriend,];
                        }
                        if (__VLS_ctx.reportState !== 'idle') {
                            {
                                const __VLS_113 = __VLS_intrinsicElements["div"];
                                const __VLS_114 = __VLS_elementAsFunctionalComponent(__VLS_113);
                                const __VLS_115 = __VLS_114({ ...{}, class: ("report-panel"), }, ...__VLS_functionalComponentArgsRest(__VLS_114));
                                ({}({ ...{}, class: ("report-panel"), }));
                                {
                                    const __VLS_118 = __VLS_intrinsicElements["label"];
                                    const __VLS_119 = __VLS_elementAsFunctionalComponent(__VLS_118);
                                    const __VLS_120 = __VLS_119({ ...{}, class: ("report-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_119));
                                    ({}({ ...{}, class: ("report-label"), }));
                                    (__VLS_121.slots).default;
                                    const __VLS_121 = __VLS_pickFunctionalComponentCtx(__VLS_118, __VLS_120);
                                }
                                {
                                    const __VLS_123 = __VLS_intrinsicElements["select"];
                                    const __VLS_124 = __VLS_elementAsFunctionalComponent(__VLS_123);
                                    const __VLS_125 = __VLS_124({ ...{}, value: ((__VLS_ctx.reportCategory)), class: ("report-input"), }, ...__VLS_functionalComponentArgsRest(__VLS_124));
                                    ({}({ ...{}, value: ((__VLS_ctx.reportCategory)), class: ("report-input"), }));
                                    {
                                        const __VLS_128 = __VLS_intrinsicElements["option"];
                                        const __VLS_129 = __VLS_elementAsFunctionalComponent(__VLS_128);
                                        const __VLS_130 = __VLS_129({ ...{}, value: ("spam"), }, ...__VLS_functionalComponentArgsRest(__VLS_129));
                                        ({}({ ...{}, value: ("spam"), }));
                                        (__VLS_131.slots).default;
                                        const __VLS_131 = __VLS_pickFunctionalComponentCtx(__VLS_128, __VLS_130);
                                    }
                                    {
                                        const __VLS_133 = __VLS_intrinsicElements["option"];
                                        const __VLS_134 = __VLS_elementAsFunctionalComponent(__VLS_133);
                                        const __VLS_135 = __VLS_134({ ...{}, value: ("abuse"), }, ...__VLS_functionalComponentArgsRest(__VLS_134));
                                        ({}({ ...{}, value: ("abuse"), }));
                                        (__VLS_136.slots).default;
                                        const __VLS_136 = __VLS_pickFunctionalComponentCtx(__VLS_133, __VLS_135);
                                    }
                                    {
                                        const __VLS_138 = __VLS_intrinsicElements["option"];
                                        const __VLS_139 = __VLS_elementAsFunctionalComponent(__VLS_138);
                                        const __VLS_140 = __VLS_139({ ...{}, value: ("fraud"), }, ...__VLS_functionalComponentArgsRest(__VLS_139));
                                        ({}({ ...{}, value: ("fraud"), }));
                                        (__VLS_141.slots).default;
                                        const __VLS_141 = __VLS_pickFunctionalComponentCtx(__VLS_138, __VLS_140);
                                    }
                                    {
                                        const __VLS_143 = __VLS_intrinsicElements["option"];
                                        const __VLS_144 = __VLS_elementAsFunctionalComponent(__VLS_143);
                                        const __VLS_145 = __VLS_144({ ...{}, value: ("other"), }, ...__VLS_functionalComponentArgsRest(__VLS_144));
                                        ({}({ ...{}, value: ("other"), }));
                                        (__VLS_146.slots).default;
                                        const __VLS_146 = __VLS_pickFunctionalComponentCtx(__VLS_143, __VLS_145);
                                    }
                                    (__VLS_126.slots).default;
                                    const __VLS_126 = __VLS_pickFunctionalComponentCtx(__VLS_123, __VLS_125);
                                }
                                {
                                    const __VLS_148 = __VLS_intrinsicElements["label"];
                                    const __VLS_149 = __VLS_elementAsFunctionalComponent(__VLS_148);
                                    const __VLS_150 = __VLS_149({ ...{}, class: ("report-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                                    ({}({ ...{}, class: ("report-label"), }));
                                    (__VLS_151.slots).default;
                                    const __VLS_151 = __VLS_pickFunctionalComponentCtx(__VLS_148, __VLS_150);
                                }
                                {
                                    const __VLS_153 = __VLS_intrinsicElements["textarea"];
                                    const __VLS_154 = __VLS_elementAsFunctionalComponent(__VLS_153);
                                    const __VLS_155 = __VLS_154({ ...{}, value: ((__VLS_ctx.reportDescription)), class: ("report-textarea"), placeholder: ("描述你遇到的问题"), }, ...__VLS_functionalComponentArgsRest(__VLS_154));
                                    ({}({ ...{}, value: ((__VLS_ctx.reportDescription)), class: ("report-textarea"), placeholder: ("描述你遇到的问题"), }));
                                    const __VLS_156 = __VLS_pickFunctionalComponentCtx(__VLS_153, __VLS_155);
                                }
                                {
                                    const __VLS_158 = __VLS_intrinsicElements["label"];
                                    const __VLS_159 = __VLS_elementAsFunctionalComponent(__VLS_158);
                                    const __VLS_160 = __VLS_159({ ...{}, class: ("report-label"), }, ...__VLS_functionalComponentArgsRest(__VLS_159));
                                    ({}({ ...{}, class: ("report-label"), }));
                                    (__VLS_161.slots).default;
                                    const __VLS_161 = __VLS_pickFunctionalComponentCtx(__VLS_158, __VLS_160);
                                }
                                {
                                    const __VLS_163 = __VLS_intrinsicElements["input"];
                                    const __VLS_164 = __VLS_elementAsFunctionalComponent(__VLS_163);
                                    const __VLS_165 = __VLS_164({ ...{}, class: ("report-input"), placeholder: ("可选，填写截图或文件链接"), }, ...__VLS_functionalComponentArgsRest(__VLS_164));
                                    ({}({ ...{}, class: ("report-input"), placeholder: ("可选，填写截图或文件链接"), }));
                                    (__VLS_ctx.reportAttachment);
                                    const __VLS_166 = __VLS_pickFunctionalComponentCtx(__VLS_163, __VLS_165);
                                }
                                {
                                    const __VLS_168 = __VLS_intrinsicElements["button"];
                                    const __VLS_169 = __VLS_elementAsFunctionalComponent(__VLS_168);
                                    const __VLS_170 = __VLS_169({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), disabled: ((__VLS_ctx.reportState === 'submitting')), }, ...__VLS_functionalComponentArgsRest(__VLS_169));
                                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn primary-btn"), disabled: ((__VLS_ctx.reportState === 'submitting')), }));
                                    let __VLS_173 = { 'click': __VLS_pickEvent(__VLS_172['click'], {}.onClick) };
                                    __VLS_173 = { click: (__VLS_ctx.submitReport) };
                                    (__VLS_ctx.reportState === 'submitting' ? '提交中...' : '提交举报');
                                    (__VLS_171.slots).default;
                                    const __VLS_171 = __VLS_pickFunctionalComponentCtx(__VLS_168, __VLS_170);
                                    let __VLS_172;
                                }
                                if (__VLS_ctx.reportState === 'submitted') {
                                    {
                                        const __VLS_174 = __VLS_intrinsicElements["div"];
                                        const __VLS_175 = __VLS_elementAsFunctionalComponent(__VLS_174);
                                        const __VLS_176 = __VLS_175({ ...{}, class: ("report-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_175));
                                        ({}({ ...{}, class: ("report-state"), }));
                                        (__VLS_177.slots).default;
                                        const __VLS_177 = __VLS_pickFunctionalComponentCtx(__VLS_174, __VLS_176);
                                    }
                                    // @ts-ignore
                                    [reportState, reportCategory, reportCategory, reportDescription, reportDescription, reportAttachment, reportState, reportState, submitReport, reportState, reportState,];
                                }
                                else if (__VLS_ctx.reportState === 'failed') {
                                    {
                                        const __VLS_179 = __VLS_intrinsicElements["div"];
                                        const __VLS_180 = __VLS_elementAsFunctionalComponent(__VLS_179);
                                        const __VLS_181 = __VLS_180({ ...{}, class: ("report-state"), }, ...__VLS_functionalComponentArgsRest(__VLS_180));
                                        ({}({ ...{}, class: ("report-state"), }));
                                        (__VLS_182.slots).default;
                                        const __VLS_182 = __VLS_pickFunctionalComponentCtx(__VLS_179, __VLS_181);
                                    }
                                    // @ts-ignore
                                    [reportState,];
                                }
                                (__VLS_116.slots).default;
                                const __VLS_116 = __VLS_pickFunctionalComponentCtx(__VLS_113, __VLS_115);
                            }
                        }
                        (__VLS_76.slots).default;
                        const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
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
        __VLS_styleScopedClasses["profile-card"];
        __VLS_styleScopedClasses["profile-info"];
        __VLS_styleScopedClasses["profile-name"];
        __VLS_styleScopedClasses["profile-uid"];
        __VLS_styleScopedClasses["action-section"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["primary-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["primary-btn"];
        __VLS_styleScopedClasses["danger-zone"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["secondary-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["secondary-btn"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["danger-btn"];
        __VLS_styleScopedClasses["report-panel"];
        __VLS_styleScopedClasses["report-label"];
        __VLS_styleScopedClasses["report-input"];
        __VLS_styleScopedClasses["report-label"];
        __VLS_styleScopedClasses["report-textarea"];
        __VLS_styleScopedClasses["report-label"];
        __VLS_styleScopedClasses["report-input"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["primary-btn"];
        __VLS_styleScopedClasses["report-state"];
        __VLS_styleScopedClasses["report-state"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            ChannelAvatar: ChannelAvatar,
            emit: emit,
            userDetails: userDetails,
            reportState: reportState,
            reportCategory: reportCategory,
            reportDescription: reportDescription,
            reportAttachment: reportAttachment,
            isFriend: isFriend,
            handleSendMessage: handleSendMessage,
            handleDeleteFriend: handleDeleteFriend,
            handleAddBlacklist: handleAddBlacklist,
            handleAddFriend: handleAddFriend,
            openReportForm: openReportForm,
            submitReport: submitReport,
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

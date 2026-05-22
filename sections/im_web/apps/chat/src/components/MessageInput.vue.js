/* __placeholder__ */
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { Message as ArcoMessage } from '@arco-design/web-vue';
import { useMessageStore, useConversationStore, useGroupStore, useUserStore } from '@tsdaodao/datasource-vue';
import WKSDK, { CMDContent } from 'wukongimjssdk';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const groupStore = useGroupStore();
const userStore = useUserStore();
const inputText = ref('');
const textareaRef = ref(null);
const imageInputRef = ref(null);
const fileInputRef = ref(null);
const uploadHint = ref('');
let typingTimeout = null;
// Mention state
const showMentionPopup = ref(false);
const mentionQuery = ref('');
const mentionedUids = ref([]);
// Reply targetcomputed fields
const replyUser = computed(() => {
    const target = messageStore.replyTarget;
    if (!target)
        return '';
    return userStore.userCache[target.fromUID]?.name || target.fromUID;
});
const replyDigest = computed(() => {
    const target = messageStore.replyTarget;
    if (!target)
        return '';
    return target.content?.text || '[消息]';
});
// Group members list
const currentGroupMembers = computed(() => {
    return groupStore.groupMembers[props.channelId] || [];
});
const filteredGroupMembers = computed(() => {
    const query = mentionQuery.value.toLowerCase();
    if (!query)
        return currentGroupMembers.value;
    return currentGroupMembers.value.filter(m => (m.member_name || '').toLowerCase().includes(query) ||
        (m.member_uid || '').toLowerCase().includes(query));
});
watch(() => props.channelId, (newId) => {
    const conv = conversationStore.conversations.find(c => c.channel_id === newId && c.channel_type === props.channelType);
    inputText.value = conv?.draft || '';
    messageStore.setReplyTarget(null);
    showMentionPopup.value = false;
}, { immediate: true });
watch(inputText, (newVal) => {
    conversationStore.updateDraft(props.channelId, props.channelType, newVal);
    triggerTyping();
    if (props.channelType !== 2)
        return;
    const caretPos = textareaRef.value?.selectionStart || 0;
    const textBeforeCaret = newVal.substring(0, caretPos);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || textBeforeCaret[lastAtIdx - 1] === ' ' || textBeforeCaret[lastAtIdx - 1] === '\n')) {
        const query = textBeforeCaret.substring(lastAtIdx + 1);
        if (!query.includes(' ')) {
            showMentionPopup.value = true;
            mentionQuery.value = query;
            return;
        }
    }
    showMentionPopup.value = false;
});
function triggerTyping() {
    if (typingTimeout)
        return;
    typingTimeout = setTimeout(() => {
        typingTimeout = null;
    }, 2000);
    const channel = WKSDK.shared().newChannel(props.channelId, props.channelType);
    const cmdContent = new CMDContent();
    cmdContent.cmd = 'typing';
    cmdContent.param = {};
    WKSDK.shared().chatManager.send(cmdContent, channel);
}
function selectMember(member) {
    const caretPos = textareaRef.value?.selectionStart || 0;
    const textBeforeCaret = inputText.value.substring(0, caretPos);
    const textAfterCaret = inputText.value.substring(caretPos);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    if (lastAtIdx !== -1) {
        const name = member.member_name || member.member_uid;
        const newText = textBeforeCaret.substring(0, lastAtIdx) + `@${name} ` + textAfterCaret;
        inputText.value = newText;
        if (!mentionedUids.value.includes(member.member_uid)) {
            mentionedUids.value.push(member.member_uid);
        }
    }
    showMentionPopup.value = false;
    textareaRef.value?.focus();
}
function openImagePicker() {
    imageInputRef.value?.click();
}
function openFilePicker() {
    fileInputRef.value?.click();
}
function insertMentionTrigger() {
    inputText.value = `${inputText.value}${inputText.value && !inputText.value.endsWith(' ') ? ' ' : ''}@`;
    textareaRef.value?.focus();
}
async function sendSelectedFile(file) {
    if (!file)
        return;
    try {
        uploadHint.value = file.type.startsWith('image/') ? `正在发送图片: ${file.name}` : `正在发送文件: ${file.name}`;
        if (file.type.startsWith('image/')) {
            ArcoMessage.info('图片发送能力正在完善，当前先保留显式入口与文件检测');
            return;
        }
        ArcoMessage.info('文件发送能力正在完善，当前先保留显式入口与文件检测');
    }
    finally {
        uploadHint.value = '';
    }
}
async function handleImageChange(event) {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        await sendSelectedFile(file);
    }
    target.value = '';
}
async function handleFileChange(event) {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        await sendSelectedFile(file);
    }
    target.value = '';
}
async function handlePaste(event) {
    const file = Array.from(event.clipboardData?.files || [])[0];
    if (!file)
        return;
    event.preventDefault();
    await sendSelectedFile(file);
}
async function handleDrop(event) {
    const file = Array.from(event.dataTransfer?.files || [])[0];
    if (!file)
        return;
    event.preventDefault();
    await sendSelectedFile(file);
}
async function handleSend() {
    const text = inputText.value.trim();
    if (!text)
        return;
    inputText.value = '';
    conversationStore.updateDraft(props.channelId, props.channelType, '');
    const options = {};
    // Build Mention
    if (props.channelType === 2) {
        if (text.includes('@所有人') || text.includes('@all')) {
            options.mention = { all: true, uids: [] };
        }
        else if (mentionedUids.value.length > 0) {
            const activeMentions = mentionedUids.value.filter(uid => {
                const member = currentGroupMembers.value.find(m => m.member_uid === uid);
                const name = member?.member_name || uid;
                return text.includes(`@${name}`);
            });
            if (activeMentions.length > 0) {
                options.mention = { all: false, uids: activeMentions };
            }
        }
    }
    // Build Reply / Quote
    if (messageStore.replyTarget) {
        const target = messageStore.replyTarget;
        options.reply = {
            messageID: target.messageID,
            messageSeq: target.messageSeq,
            fromUID: target.fromUID,
            fromName: userStore.userCache[target.fromUID]?.name || target.fromUID,
            content: target.content
        };
    }
    try {
        await messageStore.sendMessage(props.channelId, props.channelType, text, options);
        messageStore.setReplyTarget(null);
        mentionedUids.value = [];
    }
    catch (err) {
        console.error('Failed to send message', err);
    }
}
function handleKeyDown(e) {
    if (e.isComposing)
        return;
    if (e.key === 'Enter') {
        if (!e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
}
onBeforeUnmount(() => {
    if (typingTimeout)
        clearTimeout(typingTimeout);
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
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
    __VLS_intrinsicElements.span;
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
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.rect;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.input;
    __VLS_intrinsicElements.textarea;
    __VLS_intrinsicElements.textarea;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("message-input-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("message-input-container"), }));
        if (__VLS_ctx.showMentionPopup && __VLS_ctx.filteredGroupMembers.length > 0) {
            {
                const __VLS_5 = __VLS_intrinsicElements["div"];
                const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
                const __VLS_7 = __VLS_6({ ...{}, class: ("mention-popup"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
                ({}({ ...{}, class: ("mention-popup"), }));
                for (const [member] of __VLS_getVForSourceType((__VLS_ctx.filteredGroupMembers))) {
                    {
                        const __VLS_10 = __VLS_intrinsicElements["div"];
                        const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                        const __VLS_12 = __VLS_11({ ...{ 'onClick': {}, }, key: ((member.member_uid)), class: ("mention-item"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                        ({}({ ...{ 'onClick': {}, }, key: ((member.member_uid)), class: ("mention-item"), }));
                        let __VLS_15 = { 'click': __VLS_pickEvent(__VLS_14['click'], {}.onClick) };
                        __VLS_15 = { click: $event => {
                                if (!((__VLS_ctx.showMentionPopup && __VLS_ctx.filteredGroupMembers.length > 0)))
                                    return;
                                __VLS_ctx.selectMember(member);
                                // @ts-ignore
                                [showMentionPopup, filteredGroupMembers, filteredGroupMembers, selectMember,];
                            }
                        };
                        {
                            const __VLS_16 = __VLS_intrinsicElements["span"];
                            const __VLS_17 = __VLS_elementAsFunctionalComponent(__VLS_16);
                            const __VLS_18 = __VLS_17({ ...{}, class: ("mention-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
                            ({}({ ...{}, class: ("mention-name"), }));
                            (member.member_name || member.member_uid);
                            (__VLS_19.slots).default;
                            const __VLS_19 = __VLS_pickFunctionalComponentCtx(__VLS_16, __VLS_18);
                        }
                        (__VLS_13.slots).default;
                        const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
                        let __VLS_14;
                    }
                }
                (__VLS_8.slots).default;
                const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
            }
        }
        if (__VLS_ctx.messageStore.replyTarget) {
            {
                const __VLS_21 = __VLS_intrinsicElements["div"];
                const __VLS_22 = __VLS_elementAsFunctionalComponent(__VLS_21);
                const __VLS_23 = __VLS_22({ ...{}, class: ("reply-preview-bar"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                ({}({ ...{}, class: ("reply-preview-bar"), }));
                {
                    const __VLS_26 = __VLS_intrinsicElements["span"];
                    const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                    const __VLS_28 = __VLS_27({ ...{}, class: ("reply-text"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                    ({}({ ...{}, class: ("reply-text"), }));
                    (__VLS_ctx.replyUser);
                    (__VLS_ctx.replyDigest);
                    (__VLS_29.slots).default;
                    const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                }
                {
                    const __VLS_31 = __VLS_intrinsicElements["button"];
                    const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                    const __VLS_33 = __VLS_32({ ...{ 'onClick': {}, }, class: ("reply-close-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                    ({}({ ...{ 'onClick': {}, }, class: ("reply-close-btn"), }));
                    let __VLS_36 = { 'click': __VLS_pickEvent(__VLS_35['click'], {}.onClick) };
                    __VLS_36 = { click: $event => {
                            if (!((__VLS_ctx.messageStore.replyTarget)))
                                return;
                            __VLS_ctx.messageStore.setReplyTarget(null);
                            // @ts-ignore
                            [messageStore, replyUser, replyDigest, messageStore,];
                        }
                    };
                    {
                        const __VLS_37 = __VLS_intrinsicElements["svg"];
                        const __VLS_38 = __VLS_elementAsFunctionalComponent(__VLS_37);
                        const __VLS_39 = __VLS_38({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_38));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("close-svg"), }));
                        {
                            const __VLS_42 = __VLS_intrinsicElements["line"];
                            const __VLS_43 = __VLS_elementAsFunctionalComponent(__VLS_42);
                            const __VLS_44 = __VLS_43({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                            ({}({ ...{}, x1: ("18"), y1: ("6"), x2: ("6"), y2: ("18"), }));
                            const __VLS_45 = __VLS_pickFunctionalComponentCtx(__VLS_42, __VLS_44);
                        }
                        {
                            const __VLS_47 = __VLS_intrinsicElements["line"];
                            const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                            const __VLS_49 = __VLS_48({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                            ({}({ ...{}, x1: ("6"), y1: ("6"), x2: ("18"), y2: ("18"), }));
                            const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                        }
                        (__VLS_40.slots).default;
                        const __VLS_40 = __VLS_pickFunctionalComponentCtx(__VLS_37, __VLS_39);
                    }
                    (__VLS_34.slots).default;
                    const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                    let __VLS_35;
                }
                (__VLS_24.slots).default;
                const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
            }
        }
        {
            const __VLS_52 = __VLS_intrinsicElements["div"];
            const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
            const __VLS_54 = __VLS_53({ ...{}, class: ("input-actions"), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            ({}({ ...{}, class: ("input-actions"), }));
            {
                const __VLS_57 = __VLS_intrinsicElements["button"];
                const __VLS_58 = __VLS_elementAsFunctionalComponent(__VLS_57);
                const __VLS_59 = __VLS_58({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("选择图片"), }, ...__VLS_functionalComponentArgsRest(__VLS_58));
                ({}({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("选择图片"), }));
                let __VLS_62 = { 'click': __VLS_pickEvent(__VLS_61['click'], {}.onClick) };
                __VLS_62 = { click: (__VLS_ctx.openImagePicker) };
                {
                    const __VLS_63 = __VLS_intrinsicElements["svg"];
                    const __VLS_64 = __VLS_elementAsFunctionalComponent(__VLS_63);
                    const __VLS_65 = __VLS_64({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }));
                    {
                        const __VLS_68 = __VLS_intrinsicElements["rect"];
                        const __VLS_69 = __VLS_elementAsFunctionalComponent(__VLS_68);
                        const __VLS_70 = __VLS_69({ ...{}, x: ("3"), y: ("3"), width: ("18"), height: ("18"), rx: ("2"), ry: ("2"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                        ({}({ ...{}, x: ("3"), y: ("3"), width: ("18"), height: ("18"), rx: ("2"), ry: ("2"), }));
                        const __VLS_71 = __VLS_pickFunctionalComponentCtx(__VLS_68, __VLS_70);
                    }
                    {
                        const __VLS_73 = __VLS_intrinsicElements["circle"];
                        const __VLS_74 = __VLS_elementAsFunctionalComponent(__VLS_73);
                        const __VLS_75 = __VLS_74({ ...{}, cx: ("8.5"), cy: ("8.5"), r: ("1.5"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
                        ({}({ ...{}, cx: ("8.5"), cy: ("8.5"), r: ("1.5"), }));
                        const __VLS_76 = __VLS_pickFunctionalComponentCtx(__VLS_73, __VLS_75);
                    }
                    {
                        const __VLS_78 = __VLS_intrinsicElements["polyline"];
                        const __VLS_79 = __VLS_elementAsFunctionalComponent(__VLS_78);
                        const __VLS_80 = __VLS_79({ ...{}, points: ("21 15 16 10 5 21"), }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                        ({}({ ...{}, points: ("21 15 16 10 5 21"), }));
                        const __VLS_81 = __VLS_pickFunctionalComponentCtx(__VLS_78, __VLS_80);
                    }
                    (__VLS_66.slots).default;
                    const __VLS_66 = __VLS_pickFunctionalComponentCtx(__VLS_63, __VLS_65);
                }
                (__VLS_60.slots).default;
                const __VLS_60 = __VLS_pickFunctionalComponentCtx(__VLS_57, __VLS_59);
                let __VLS_61;
            }
            {
                const __VLS_83 = __VLS_intrinsicElements["button"];
                const __VLS_84 = __VLS_elementAsFunctionalComponent(__VLS_83);
                const __VLS_85 = __VLS_84({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("选择文件"), }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                ({}({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("选择文件"), }));
                let __VLS_88 = { 'click': __VLS_pickEvent(__VLS_87['click'], {}.onClick) };
                __VLS_88 = { click: (__VLS_ctx.openFilePicker) };
                {
                    const __VLS_89 = __VLS_intrinsicElements["svg"];
                    const __VLS_90 = __VLS_elementAsFunctionalComponent(__VLS_89);
                    const __VLS_91 = __VLS_90({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_90));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }));
                    {
                        const __VLS_94 = __VLS_intrinsicElements["path"];
                        const __VLS_95 = __VLS_elementAsFunctionalComponent(__VLS_94);
                        const __VLS_96 = __VLS_95({ ...{}, d: ("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), }, ...__VLS_functionalComponentArgsRest(__VLS_95));
                        ({}({ ...{}, d: ("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"), }));
                        const __VLS_97 = __VLS_pickFunctionalComponentCtx(__VLS_94, __VLS_96);
                    }
                    {
                        const __VLS_99 = __VLS_intrinsicElements["polyline"];
                        const __VLS_100 = __VLS_elementAsFunctionalComponent(__VLS_99);
                        const __VLS_101 = __VLS_100({ ...{}, points: ("14 2 14 8 20 8"), }, ...__VLS_functionalComponentArgsRest(__VLS_100));
                        ({}({ ...{}, points: ("14 2 14 8 20 8"), }));
                        const __VLS_102 = __VLS_pickFunctionalComponentCtx(__VLS_99, __VLS_101);
                    }
                    (__VLS_92.slots).default;
                    const __VLS_92 = __VLS_pickFunctionalComponentCtx(__VLS_89, __VLS_91);
                }
                (__VLS_86.slots).default;
                const __VLS_86 = __VLS_pickFunctionalComponentCtx(__VLS_83, __VLS_85);
                let __VLS_87;
            }
            if (__VLS_ctx.channelType === 2) {
                {
                    const __VLS_104 = __VLS_intrinsicElements["button"];
                    const __VLS_105 = __VLS_elementAsFunctionalComponent(__VLS_104);
                    const __VLS_106 = __VLS_105({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("插入@成员"), }, ...__VLS_functionalComponentArgsRest(__VLS_105));
                    ({}({ ...{ 'onClick': {}, }, class: ("action-btn"), title: ("插入@成员"), }));
                    let __VLS_109 = { 'click': __VLS_pickEvent(__VLS_108['click'], {}.onClick) };
                    __VLS_109 = { click: (__VLS_ctx.insertMentionTrigger) };
                    (__VLS_107.slots).default;
                    const __VLS_107 = __VLS_pickFunctionalComponentCtx(__VLS_104, __VLS_106);
                    let __VLS_108;
                }
                // @ts-ignore
                [openImagePicker, openFilePicker, channelType, insertMentionTrigger,];
            }
            (__VLS_55.slots).default;
            const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
        }
        {
            const __VLS_110 = __VLS_intrinsicElements["div"];
            const __VLS_111 = __VLS_elementAsFunctionalComponent(__VLS_110);
            const __VLS_112 = __VLS_111({ ...{}, class: ("input-area-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_111));
            ({}({ ...{}, class: ("input-area-wrapper"), }));
            {
                const __VLS_115 = __VLS_intrinsicElements["input"];
                const __VLS_116 = __VLS_elementAsFunctionalComponent(__VLS_115);
                const __VLS_117 = __VLS_116({ ...{ 'onChange': {}, }, ref: ("imageInputRef"), type: ("file"), accept: ("image/*"), class: ("hidden-input"), }, ...__VLS_functionalComponentArgsRest(__VLS_116));
                ({}({ ...{ 'onChange': {}, }, ref: ("imageInputRef"), type: ("file"), accept: ("image/*"), class: ("hidden-input"), }));
                // @ts-ignore
                (__VLS_ctx.imageInputRef);
                let __VLS_120 = { 'change': __VLS_pickEvent(__VLS_119['change'], {}.onChange) };
                __VLS_120 = { change: (__VLS_ctx.handleImageChange) };
                const __VLS_118 = __VLS_pickFunctionalComponentCtx(__VLS_115, __VLS_117);
                let __VLS_119;
            }
            {
                const __VLS_121 = __VLS_intrinsicElements["input"];
                const __VLS_122 = __VLS_elementAsFunctionalComponent(__VLS_121);
                const __VLS_123 = __VLS_122({ ...{ 'onChange': {}, }, ref: ("fileInputRef"), type: ("file"), class: ("hidden-input"), }, ...__VLS_functionalComponentArgsRest(__VLS_122));
                ({}({ ...{ 'onChange': {}, }, ref: ("fileInputRef"), type: ("file"), class: ("hidden-input"), }));
                // @ts-ignore
                (__VLS_ctx.fileInputRef);
                let __VLS_126 = { 'change': __VLS_pickEvent(__VLS_125['change'], {}.onChange) };
                __VLS_126 = { change: (__VLS_ctx.handleFileChange) };
                const __VLS_124 = __VLS_pickFunctionalComponentCtx(__VLS_121, __VLS_123);
                let __VLS_125;
            }
            {
                const __VLS_127 = __VLS_intrinsicElements["textarea"];
                const __VLS_128 = __VLS_elementAsFunctionalComponent(__VLS_127);
                const __VLS_129 = __VLS_128({ ...{ 'onKeydown': {}, 'onPaste': {}, 'onDrop': {}, 'onDragover': {}, }, ref: ("textareaRef"), value: ((__VLS_ctx.inputText)), placeholder: ("输入消息，Enter 发送，Ctrl+Enter 换行"), class: ("input-textarea"), rows: ("3"), }, ...__VLS_functionalComponentArgsRest(__VLS_128));
                ({}({ ...{ 'onKeydown': {}, 'onPaste': {}, 'onDrop': {}, 'onDragover': {}, }, ref: ("textareaRef"), value: ((__VLS_ctx.inputText)), placeholder: ("输入消息，Enter 发送，Ctrl+Enter 换行"), class: ("input-textarea"), rows: ("3"), }));
                // @ts-ignore
                (__VLS_ctx.textareaRef);
                let __VLS_132 = { 'keydown': __VLS_pickEvent(__VLS_131['keydown'], {}.onKeydown) };
                __VLS_132 = { keydown: (__VLS_ctx.handleKeyDown) };
                let __VLS_133 = { 'paste': __VLS_pickEvent(__VLS_131['paste'], {}.onPaste) };
                __VLS_133 = { paste: (__VLS_ctx.handlePaste) };
                let __VLS_134 = { 'drop': __VLS_pickEvent(__VLS_131['drop'], {}.onDrop) };
                __VLS_134 = { drop: (__VLS_ctx.handleDrop) };
                let __VLS_135 = { 'dragover': __VLS_pickEvent(__VLS_131['dragover'], {}.onDragover) };
                __VLS_135 = { dragover: () => { } };
                const __VLS_130 = __VLS_pickFunctionalComponentCtx(__VLS_127, __VLS_129);
                let __VLS_131;
            }
            (__VLS_113.slots).default;
            const __VLS_113 = __VLS_pickFunctionalComponentCtx(__VLS_110, __VLS_112);
        }
        {
            const __VLS_136 = __VLS_intrinsicElements["div"];
            const __VLS_137 = __VLS_elementAsFunctionalComponent(__VLS_136);
            const __VLS_138 = __VLS_137({ ...{}, class: ("input-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_137));
            ({}({ ...{}, class: ("input-footer"), }));
            {
                const __VLS_141 = __VLS_intrinsicElements["div"];
                const __VLS_142 = __VLS_elementAsFunctionalComponent(__VLS_141);
                const __VLS_143 = __VLS_142({ ...{}, class: ("input-hint"), }, ...__VLS_functionalComponentArgsRest(__VLS_142));
                ({}({ ...{}, class: ("input-hint"), }));
                (__VLS_ctx.uploadHint || '输入自动同步草稿，Enter 发送，Ctrl+Enter 换行');
                (__VLS_144.slots).default;
                const __VLS_144 = __VLS_pickFunctionalComponentCtx(__VLS_141, __VLS_143);
            }
            {
                const __VLS_146 = __VLS_intrinsicElements["button"];
                const __VLS_147 = __VLS_elementAsFunctionalComponent(__VLS_146);
                const __VLS_148 = __VLS_147({ ...{ 'onClick': {}, }, class: ("send-btn"), disabled: ((!__VLS_ctx.inputText.trim())), "aria-label": ("发送消息"), title: ("发送消息"), }, ...__VLS_functionalComponentArgsRest(__VLS_147));
                ({}({ ...{ 'onClick': {}, }, class: ("send-btn"), disabled: ((!__VLS_ctx.inputText.trim())), "aria-label": ("发送消息"), title: ("发送消息"), }));
                let __VLS_151 = { 'click': __VLS_pickEvent(__VLS_150['click'], {}.onClick) };
                __VLS_151 = { click: (__VLS_ctx.handleSend) };
                {
                    const __VLS_152 = __VLS_intrinsicElements["svg"];
                    const __VLS_153 = __VLS_elementAsFunctionalComponent(__VLS_152);
                    const __VLS_154 = __VLS_153({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("send-btn-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_153));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("send-btn-icon"), }));
                    {
                        const __VLS_157 = __VLS_intrinsicElements["path"];
                        const __VLS_158 = __VLS_elementAsFunctionalComponent(__VLS_157);
                        const __VLS_159 = __VLS_158({ ...{}, d: ("M22 2 11 13"), }, ...__VLS_functionalComponentArgsRest(__VLS_158));
                        ({}({ ...{}, d: ("M22 2 11 13"), }));
                        const __VLS_160 = __VLS_pickFunctionalComponentCtx(__VLS_157, __VLS_159);
                    }
                    {
                        const __VLS_162 = __VLS_intrinsicElements["path"];
                        const __VLS_163 = __VLS_elementAsFunctionalComponent(__VLS_162);
                        const __VLS_164 = __VLS_163({ ...{}, d: ("m22 2-7 20-4-9-9-4 20-7Z"), }, ...__VLS_functionalComponentArgsRest(__VLS_163));
                        ({}({ ...{}, d: ("m22 2-7 20-4-9-9-4 20-7Z"), }));
                        const __VLS_165 = __VLS_pickFunctionalComponentCtx(__VLS_162, __VLS_164);
                    }
                    (__VLS_155.slots).default;
                    const __VLS_155 = __VLS_pickFunctionalComponentCtx(__VLS_152, __VLS_154);
                }
                {
                    const __VLS_167 = __VLS_intrinsicElements["span"];
                    const __VLS_168 = __VLS_elementAsFunctionalComponent(__VLS_167);
                    const __VLS_169 = __VLS_168({ ...{}, class: ("send-btn-text"), }, ...__VLS_functionalComponentArgsRest(__VLS_168));
                    ({}({ ...{}, class: ("send-btn-text"), }));
                    (__VLS_170.slots).default;
                    const __VLS_170 = __VLS_pickFunctionalComponentCtx(__VLS_167, __VLS_169);
                }
                {
                    const __VLS_172 = __VLS_intrinsicElements["span"];
                    const __VLS_173 = __VLS_elementAsFunctionalComponent(__VLS_172);
                    const __VLS_174 = __VLS_173({ ...{}, class: ("send-btn-shortcut"), }, ...__VLS_functionalComponentArgsRest(__VLS_173));
                    ({}({ ...{}, class: ("send-btn-shortcut"), }));
                    (__VLS_175.slots).default;
                    const __VLS_175 = __VLS_pickFunctionalComponentCtx(__VLS_172, __VLS_174);
                }
                (__VLS_149.slots).default;
                const __VLS_149 = __VLS_pickFunctionalComponentCtx(__VLS_146, __VLS_148);
                let __VLS_150;
            }
            (__VLS_139.slots).default;
            const __VLS_139 = __VLS_pickFunctionalComponentCtx(__VLS_136, __VLS_138);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["message-input-container"];
        __VLS_styleScopedClasses["mention-popup"];
        __VLS_styleScopedClasses["mention-item"];
        __VLS_styleScopedClasses["mention-name"];
        __VLS_styleScopedClasses["reply-preview-bar"];
        __VLS_styleScopedClasses["reply-text"];
        __VLS_styleScopedClasses["reply-close-btn"];
        __VLS_styleScopedClasses["close-svg"];
        __VLS_styleScopedClasses["input-actions"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["action-svg"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["action-svg"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["input-area-wrapper"];
        __VLS_styleScopedClasses["hidden-input"];
        __VLS_styleScopedClasses["hidden-input"];
        __VLS_styleScopedClasses["input-textarea"];
        __VLS_styleScopedClasses["input-footer"];
        __VLS_styleScopedClasses["input-hint"];
        __VLS_styleScopedClasses["send-btn"];
        __VLS_styleScopedClasses["send-btn-icon"];
        __VLS_styleScopedClasses["send-btn-text"];
        __VLS_styleScopedClasses["send-btn-shortcut"];
    }
    var __VLS_slots;
    // @ts-ignore
    [imageInputRef, handleImageChange, fileInputRef, handleFileChange, inputText, inputText, textareaRef, handleKeyDown, handlePaste, handleDrop, uploadHint, inputText, inputText, handleSend,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            messageStore: messageStore,
            inputText: inputText,
            textareaRef: textareaRef,
            imageInputRef: imageInputRef,
            fileInputRef: fileInputRef,
            uploadHint: uploadHint,
            showMentionPopup: showMentionPopup,
            replyUser: replyUser,
            replyDigest: replyDigest,
            filteredGroupMembers: filteredGroupMembers,
            selectMember: selectMember,
            openImagePicker: openImagePicker,
            openFilePicker: openFilePicker,
            insertMentionTrigger: insertMentionTrigger,
            handleImageChange: handleImageChange,
            handleFileChange: handleFileChange,
            handlePaste: handlePaste,
            handleDrop: handleDrop,
            handleSend: handleSend,
            handleKeyDown: handleKeyDown,
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

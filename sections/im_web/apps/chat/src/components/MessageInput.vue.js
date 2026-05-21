/* __placeholder__ */
import { ref, watch, onBeforeUnmount } from 'vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import WKSDK, { CMDContent } from 'wukongimjssdk';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const inputText = ref('');
let typingTimeout = null;
watch(() => props.channelId, (newId) => {
    const conv = conversationStore.conversations.find(c => c.channel_id === newId && c.channel_type === props.channelType);
    inputText.value = conv?.draft || '';
}, { immediate: true });
watch(inputText, (newVal) => {
    conversationStore.updateDraft(props.channelId, props.channelType, newVal);
    triggerTyping();
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
onBeforeUnmount(() => {
    if (typingTimeout)
        clearTimeout(typingTimeout);
});
async function handleSend() {
    const text = inputText.value.trim();
    if (!text)
        return;
    inputText.value = '';
    conversationStore.updateDraft(props.channelId, props.channelType, '');
    try {
        await messageStore.sendMessage(props.channelId, props.channelType, text);
    }
    catch (err) {
        console.error('Failed to send message', err);
    }
}
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        if (!e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.rect;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.textarea;
    __VLS_intrinsicElements.textarea;
    {
        const __VLS_0 = __VLS_intrinsicElements["div"];
        const __VLS_1 = __VLS_elementAsFunctionalComponent(__VLS_0);
        const __VLS_2 = __VLS_1({ ...{}, class: ("message-input-container"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("message-input-container"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("input-actions"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("input-actions"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["button"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("action-btn"), title: ("发送图片"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("action-btn"), title: ("发送图片"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["svg"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("action-svg"), }));
                    {
                        const __VLS_20 = __VLS_intrinsicElements["rect"];
                        const __VLS_21 = __VLS_elementAsFunctionalComponent(__VLS_20);
                        const __VLS_22 = __VLS_21({ ...{}, x: ("3"), y: ("3"), width: ("18"), height: ("18"), rx: ("2"), ry: ("2"), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                        ({}({ ...{}, x: ("3"), y: ("3"), width: ("18"), height: ("18"), rx: ("2"), ry: ("2"), }));
                        const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                    }
                    {
                        const __VLS_25 = __VLS_intrinsicElements["circle"];
                        const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                        const __VLS_27 = __VLS_26({ ...{}, cx: ("8.5"), cy: ("8.5"), r: ("1.5"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{}, cx: ("8.5"), cy: ("8.5"), r: ("1.5"), }));
                        const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                    }
                    {
                        const __VLS_30 = __VLS_intrinsicElements["polyline"];
                        const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                        const __VLS_32 = __VLS_31({ ...{}, points: ("21 15 16 10 5 21"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                        ({}({ ...{}, points: ("21 15 16 10 5 21"), }));
                        const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_35 = __VLS_intrinsicElements["div"];
            const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
            const __VLS_37 = __VLS_36({ ...{}, class: ("input-area-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
            ({}({ ...{}, class: ("input-area-wrapper"), }));
            {
                const __VLS_40 = __VLS_intrinsicElements["textarea"];
                const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                const __VLS_42 = __VLS_41({ ...{ 'onKeydown': {}, }, value: ((__VLS_ctx.inputText)), placeholder: ("输入消息，Enter 发送，Ctrl+Enter 换行"), class: ("input-textarea"), rows: ("3"), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                ({}({ ...{ 'onKeydown': {}, }, value: ((__VLS_ctx.inputText)), placeholder: ("输入消息，Enter 发送，Ctrl+Enter 换行"), class: ("input-textarea"), rows: ("3"), }));
                let __VLS_45 = { 'keydown': __VLS_pickEvent(__VLS_44['keydown'], {}.onKeydown) };
                __VLS_45 = { keydown: (__VLS_ctx.handleKeyDown) };
                const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                let __VLS_44;
            }
            (__VLS_38.slots).default;
            const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
        }
        {
            const __VLS_46 = __VLS_intrinsicElements["div"];
            const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
            const __VLS_48 = __VLS_47({ ...{}, class: ("input-footer"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
            ({}({ ...{}, class: ("input-footer"), }));
            {
                const __VLS_51 = __VLS_intrinsicElements["div"];
                const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                const __VLS_53 = __VLS_52({ ...{}, class: ("input-hint"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                ({}({ ...{}, class: ("input-hint"), }));
                (__VLS_54.slots).default;
                const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
            }
            {
                const __VLS_56 = __VLS_intrinsicElements["button"];
                const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                const __VLS_58 = __VLS_57({ ...{ 'onClick': {}, }, class: ("send-btn"), disabled: ((!__VLS_ctx.inputText.trim())), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                ({}({ ...{ 'onClick': {}, }, class: ("send-btn"), disabled: ((!__VLS_ctx.inputText.trim())), }));
                let __VLS_61 = { 'click': __VLS_pickEvent(__VLS_60['click'], {}.onClick) };
                __VLS_61 = { click: (__VLS_ctx.handleSend) };
                (__VLS_59.slots).default;
                const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                let __VLS_60;
            }
            (__VLS_49.slots).default;
            const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["message-input-container"];
        __VLS_styleScopedClasses["input-actions"];
        __VLS_styleScopedClasses["action-btn"];
        __VLS_styleScopedClasses["action-svg"];
        __VLS_styleScopedClasses["input-area-wrapper"];
        __VLS_styleScopedClasses["input-textarea"];
        __VLS_styleScopedClasses["input-footer"];
        __VLS_styleScopedClasses["input-hint"];
        __VLS_styleScopedClasses["send-btn"];
    }
    var __VLS_slots;
    // @ts-ignore
    [inputText, inputText, handleKeyDown, inputText, inputText, handleSend,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            inputText: inputText,
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

/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useKickoutStore } from '@tsdaodao/datasource-vue';
import { KickoutOverlay, ChannelAvatar } from '@tsdaodao/base-vue';
import ConversationList from '../views/ConversationList.vue';
import { ContactList } from '@tsdaodao/contacts-vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
// Placeholders for contacts view
const activeTab = ref('chats');
const router = useRouter();
const userStore = useUserStore();
const conversationStore = useConversationStore();
const kickoutStore = useKickoutStore();
onMounted(async () => {
    if (userStore.isLoggedIn && userStore.currentUser) {
        // Sync conversations on startup
        await conversationStore.syncConversations();
    }
});
function handleLogout() {
    userStore.logout();
    router.push('/login');
}
function handleKickoutRelogin() {
    kickoutStore.resetKickout();
    router.push('/login');
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
    __VLS_components.ChannelAvatar;
    __VLS_components.ChannelAvatar;
    // @ts-ignore
    [ChannelAvatar,];
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.line;
    __VLS_components.ConversationList;
    __VLS_components.ConversationList;
    // @ts-ignore
    [ConversationList,];
    __VLS_components.ContactList;
    __VLS_components.ContactList;
    // @ts-ignore
    [ContactList,];
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
        const __VLS_2 = __VLS_1({ ...{}, class: ("main-layout"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        ({}({ ...{}, class: ("main-layout"), }));
        {
            const __VLS_5 = __VLS_intrinsicElements["div"];
            const __VLS_6 = __VLS_elementAsFunctionalComponent(__VLS_5);
            const __VLS_7 = __VLS_6({ ...{}, class: ("sidebar"), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            ({}({ ...{}, class: ("sidebar"), }));
            {
                const __VLS_10 = __VLS_intrinsicElements["div"];
                const __VLS_11 = __VLS_elementAsFunctionalComponent(__VLS_10);
                const __VLS_12 = __VLS_11({ ...{}, class: ("sidebar-header"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
                ({}({ ...{}, class: ("sidebar-header"), }));
                {
                    const __VLS_15 = __VLS_intrinsicElements["div"];
                    const __VLS_16 = __VLS_elementAsFunctionalComponent(__VLS_15);
                    const __VLS_17 = __VLS_16({ ...{}, class: ("user-profile"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{}, class: ("user-profile"), }));
                    {
                        const __VLS_20 = {}.ChannelAvatar;
                        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }));
                        ({}.ChannelAvatar);
                        const __VLS_22 = __VLS_21({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                        ({}({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }));
                        const __VLS_23 = __VLS_pickFunctionalComponentCtx(__VLS_20, __VLS_22);
                    }
                    {
                        const __VLS_25 = __VLS_intrinsicElements["div"];
                        const __VLS_26 = __VLS_elementAsFunctionalComponent(__VLS_25);
                        const __VLS_27 = __VLS_26({ ...{}, class: ("user-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
                        ({}({ ...{}, class: ("user-info"), }));
                        {
                            const __VLS_30 = __VLS_intrinsicElements["div"];
                            const __VLS_31 = __VLS_elementAsFunctionalComponent(__VLS_30);
                            const __VLS_32 = __VLS_31({ ...{}, class: ("user-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                            ({}({ ...{}, class: ("user-name"), }));
                            (__VLS_ctx.userStore.currentUser?.name || '用户');
                            (__VLS_33.slots).default;
                            const __VLS_33 = __VLS_pickFunctionalComponentCtx(__VLS_30, __VLS_32);
                        }
                        {
                            const __VLS_35 = __VLS_intrinsicElements["div"];
                            const __VLS_36 = __VLS_elementAsFunctionalComponent(__VLS_35);
                            const __VLS_37 = __VLS_36({ ...{}, class: ("user-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_36));
                            ({}({ ...{}, class: ("user-status"), }));
                            (__VLS_38.slots).default;
                            const __VLS_38 = __VLS_pickFunctionalComponentCtx(__VLS_35, __VLS_37);
                        }
                        (__VLS_28.slots).default;
                        const __VLS_28 = __VLS_pickFunctionalComponentCtx(__VLS_25, __VLS_27);
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                }
                {
                    const __VLS_40 = __VLS_intrinsicElements["button"];
                    const __VLS_41 = __VLS_elementAsFunctionalComponent(__VLS_40);
                    const __VLS_42 = __VLS_41({ ...{ 'onClick': {}, }, class: ("logout-btn"), title: ("退出登录"), }, ...__VLS_functionalComponentArgsRest(__VLS_41));
                    ({}({ ...{ 'onClick': {}, }, class: ("logout-btn"), title: ("退出登录"), }));
                    let __VLS_45 = { 'click': __VLS_pickEvent(__VLS_44['click'], {}.onClick) };
                    __VLS_45 = { click: (__VLS_ctx.handleLogout) };
                    {
                        const __VLS_46 = __VLS_intrinsicElements["svg"];
                        const __VLS_47 = __VLS_elementAsFunctionalComponent(__VLS_46);
                        const __VLS_48 = __VLS_47({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("logout-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("logout-icon"), }));
                        {
                            const __VLS_51 = __VLS_intrinsicElements["path"];
                            const __VLS_52 = __VLS_elementAsFunctionalComponent(__VLS_51);
                            const __VLS_53 = __VLS_52({ ...{}, d: ("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
                            ({}({ ...{}, d: ("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), }));
                            const __VLS_54 = __VLS_pickFunctionalComponentCtx(__VLS_51, __VLS_53);
                        }
                        {
                            const __VLS_56 = __VLS_intrinsicElements["polyline"];
                            const __VLS_57 = __VLS_elementAsFunctionalComponent(__VLS_56);
                            const __VLS_58 = __VLS_57({ ...{}, points: ("16 17 21 12 16 7"), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                            ({}({ ...{}, points: ("16 17 21 12 16 7"), }));
                            const __VLS_59 = __VLS_pickFunctionalComponentCtx(__VLS_56, __VLS_58);
                        }
                        {
                            const __VLS_61 = __VLS_intrinsicElements["line"];
                            const __VLS_62 = __VLS_elementAsFunctionalComponent(__VLS_61);
                            const __VLS_63 = __VLS_62({ ...{}, x1: ("21"), y1: ("12"), x2: ("9"), y2: ("12"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
                            ({}({ ...{}, x1: ("21"), y1: ("12"), x2: ("9"), y2: ("12"), }));
                            const __VLS_64 = __VLS_pickFunctionalComponentCtx(__VLS_61, __VLS_63);
                        }
                        (__VLS_49.slots).default;
                        const __VLS_49 = __VLS_pickFunctionalComponentCtx(__VLS_46, __VLS_48);
                    }
                    (__VLS_43.slots).default;
                    const __VLS_43 = __VLS_pickFunctionalComponentCtx(__VLS_40, __VLS_42);
                    let __VLS_44;
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_66 = __VLS_intrinsicElements["div"];
                const __VLS_67 = __VLS_elementAsFunctionalComponent(__VLS_66);
                const __VLS_68 = __VLS_67({ ...{}, class: ("tab-switcher"), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                ({}({ ...{}, class: ("tab-switcher"), }));
                {
                    const __VLS_71 = __VLS_intrinsicElements["button"];
                    const __VLS_72 = __VLS_elementAsFunctionalComponent(__VLS_71);
                    const __VLS_73 = __VLS_72({ ...{ 'onClick': {}, }, class: ("tab-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_72));
                    ({}({ ...{ 'onClick': {}, }, class: ("tab-btn"), }));
                    ({ active: __VLS_ctx.activeTab === 'chats' });
                    __VLS_styleScopedClasses = ({ active: activeTab === 'chats' });
                    let __VLS_76 = { 'click': __VLS_pickEvent(__VLS_75['click'], {}.onClick) };
                    __VLS_76 = { click: $event => {
                            __VLS_ctx.activeTab = 'chats';
                            // @ts-ignore
                            [userStore, userStore, userStore, userStore, handleLogout, activeTab, activeTab,];
                        }
                    };
                    (__VLS_74.slots).default;
                    const __VLS_74 = __VLS_pickFunctionalComponentCtx(__VLS_71, __VLS_73);
                    let __VLS_75;
                }
                {
                    const __VLS_77 = __VLS_intrinsicElements["button"];
                    const __VLS_78 = __VLS_elementAsFunctionalComponent(__VLS_77);
                    const __VLS_79 = __VLS_78({ ...{ 'onClick': {}, }, class: ("tab-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                    ({}({ ...{ 'onClick': {}, }, class: ("tab-btn"), }));
                    ({ active: __VLS_ctx.activeTab === 'contacts' });
                    __VLS_styleScopedClasses = ({ active: activeTab === 'contacts' });
                    let __VLS_82 = { 'click': __VLS_pickEvent(__VLS_81['click'], {}.onClick) };
                    __VLS_82 = { click: $event => {
                            __VLS_ctx.activeTab = 'contacts';
                            // @ts-ignore
                            [activeTab, activeTab,];
                        }
                    };
                    (__VLS_80.slots).default;
                    const __VLS_80 = __VLS_pickFunctionalComponentCtx(__VLS_77, __VLS_79);
                    let __VLS_81;
                }
                (__VLS_69.slots).default;
                const __VLS_69 = __VLS_pickFunctionalComponentCtx(__VLS_66, __VLS_68);
            }
            {
                const __VLS_83 = __VLS_intrinsicElements["div"];
                const __VLS_84 = __VLS_elementAsFunctionalComponent(__VLS_83);
                const __VLS_85 = __VLS_84({ ...{}, class: ("sidebar-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                ({}({ ...{}, class: ("sidebar-content"), }));
                if (__VLS_ctx.activeTab === 'chats') {
                    {
                        const __VLS_88 = {}.ConversationList;
                        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({ ...{}, }));
                        ({}.ConversationList);
                        const __VLS_90 = __VLS_89({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                        ({}({ ...{}, }));
                        const __VLS_91 = __VLS_pickFunctionalComponentCtx(__VLS_88, __VLS_90);
                    }
                    // @ts-ignore
                    [activeTab,];
                }
                else {
                    {
                        const __VLS_93 = {}.ContactList;
                        const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({ ...{}, }));
                        ({}.ContactList);
                        const __VLS_95 = __VLS_94({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_94));
                        ({}({ ...{}, }));
                        const __VLS_96 = __VLS_pickFunctionalComponentCtx(__VLS_93, __VLS_95);
                    }
                }
                (__VLS_86.slots).default;
                const __VLS_86 = __VLS_pickFunctionalComponentCtx(__VLS_83, __VLS_85);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_98 = __VLS_intrinsicElements["div"];
            const __VLS_99 = __VLS_elementAsFunctionalComponent(__VLS_98);
            const __VLS_100 = __VLS_99({ ...{}, class: ("chat-viewport"), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
            ({}({ ...{}, class: ("chat-viewport"), }));
            {
                const __VLS_103 = {}.RouterView;
                const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({ ...{}, }));
                ({}.RouterView);
                const __VLS_105 = __VLS_104({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                ({}({ ...{}, }));
                const __VLS_106 = __VLS_pickFunctionalComponentCtx(__VLS_103, __VLS_105);
            }
            (__VLS_101.slots).default;
            const __VLS_101 = __VLS_pickFunctionalComponentCtx(__VLS_98, __VLS_100);
        }
        {
            const __VLS_108 = {}.KickoutOverlay;
            const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }));
            ({}.KickoutOverlay);
            const __VLS_110 = __VLS_109({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }, ...__VLS_functionalComponentArgsRest(__VLS_109));
            ({}({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }));
            let __VLS_113 = { 'relogin': __VLS_pickEvent(__VLS_112['relogin'], {}.onRelogin) };
            __VLS_113 = { relogin: (__VLS_ctx.handleKickoutRelogin) };
            const __VLS_111 = __VLS_pickFunctionalComponentCtx(__VLS_108, __VLS_110);
            let __VLS_112;
        }
        (__VLS_3.slots).default;
        const __VLS_3 = __VLS_pickFunctionalComponentCtx(__VLS_0, __VLS_2);
    }
    if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {
        __VLS_styleScopedClasses["main-layout"];
        __VLS_styleScopedClasses["sidebar"];
        __VLS_styleScopedClasses["sidebar-header"];
        __VLS_styleScopedClasses["user-profile"];
        __VLS_styleScopedClasses["user-info"];
        __VLS_styleScopedClasses["user-name"];
        __VLS_styleScopedClasses["user-status"];
        __VLS_styleScopedClasses["logout-btn"];
        __VLS_styleScopedClasses["logout-icon"];
        __VLS_styleScopedClasses["tab-switcher"];
        __VLS_styleScopedClasses["tab-btn"];
        __VLS_styleScopedClasses["tab-btn"];
        __VLS_styleScopedClasses["sidebar-content"];
        __VLS_styleScopedClasses["chat-viewport"];
    }
    var __VLS_slots;
    // @ts-ignore
    [kickoutStore, kickoutStore, kickoutStore, handleKickoutRelogin,];
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            KickoutOverlay: KickoutOverlay,
            ChannelAvatar: ChannelAvatar,
            ConversationList: ConversationList,
            ContactList: ContactList,
            activeTab: activeTab,
            userStore: userStore,
            kickoutStore: kickoutStore,
            handleLogout: handleLogout,
            handleKickoutRelogin: handleKickoutRelogin,
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

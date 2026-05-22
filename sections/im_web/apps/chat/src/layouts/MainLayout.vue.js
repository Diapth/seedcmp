/* __placeholder__ */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useKickoutStore } from '@tsdaodao/datasource-vue';
import { KickoutOverlay, ChannelAvatar } from '@tsdaodao/base-vue';
import ConversationList from '../views/ConversationList.vue';
import { ContactList } from '@tsdaodao/contacts-vue';
import SearchResultList from '../components/SearchResultList.vue';
import MyProfileDrawer from '../views/MyProfileDrawer.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
// Placeholders for contacts view
const activeTab = ref('chats');
const searchQuery = ref('');
const showMyProfileDrawer = ref(false);
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
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.button;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.svg;
    __VLS_intrinsicElements.path;
    __VLS_intrinsicElements.polyline;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.line;
    __VLS_intrinsicElements.circle;
    __VLS_intrinsicElements.input;
    __VLS_components.SearchResultList;
    __VLS_components.SearchResultList;
    // @ts-ignore
    [SearchResultList,];
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
    __VLS_components.MyProfileDrawer;
    __VLS_components.MyProfileDrawer;
    // @ts-ignore
    [MyProfileDrawer,];
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
                    const __VLS_17 = __VLS_16({ ...{ 'onClick': {}, }, class: ("user-profile"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
                    ({}({ ...{ 'onClick': {}, }, class: ("user-profile"), }));
                    let __VLS_20 = { 'click': __VLS_pickEvent(__VLS_19['click'], {}.onClick) };
                    __VLS_20 = { click: $event => {
                            __VLS_ctx.showMyProfileDrawer = true;
                            // @ts-ignore
                            [showMyProfileDrawer,];
                        }
                    };
                    {
                        const __VLS_21 = {}.ChannelAvatar;
                        const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }));
                        ({}.ChannelAvatar);
                        const __VLS_23 = __VLS_22({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
                        ({}({ ...{}, name: ((__VLS_ctx.userStore.currentUser?.name)), size: ((36)), }));
                        const __VLS_24 = __VLS_pickFunctionalComponentCtx(__VLS_21, __VLS_23);
                    }
                    {
                        const __VLS_26 = __VLS_intrinsicElements["div"];
                        const __VLS_27 = __VLS_elementAsFunctionalComponent(__VLS_26);
                        const __VLS_28 = __VLS_27({ ...{}, class: ("user-info"), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
                        ({}({ ...{}, class: ("user-info"), }));
                        {
                            const __VLS_31 = __VLS_intrinsicElements["div"];
                            const __VLS_32 = __VLS_elementAsFunctionalComponent(__VLS_31);
                            const __VLS_33 = __VLS_32({ ...{}, class: ("user-name"), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                            ({}({ ...{}, class: ("user-name"), }));
                            (__VLS_ctx.userStore.currentUser?.name || '用户');
                            (__VLS_34.slots).default;
                            const __VLS_34 = __VLS_pickFunctionalComponentCtx(__VLS_31, __VLS_33);
                        }
                        {
                            const __VLS_36 = __VLS_intrinsicElements["div"];
                            const __VLS_37 = __VLS_elementAsFunctionalComponent(__VLS_36);
                            const __VLS_38 = __VLS_37({ ...{}, class: ("user-status"), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                            ({}({ ...{}, class: ("user-status"), }));
                            (__VLS_39.slots).default;
                            const __VLS_39 = __VLS_pickFunctionalComponentCtx(__VLS_36, __VLS_38);
                        }
                        (__VLS_29.slots).default;
                        const __VLS_29 = __VLS_pickFunctionalComponentCtx(__VLS_26, __VLS_28);
                    }
                    (__VLS_18.slots).default;
                    const __VLS_18 = __VLS_pickFunctionalComponentCtx(__VLS_15, __VLS_17);
                    let __VLS_19;
                }
                {
                    const __VLS_41 = __VLS_intrinsicElements["button"];
                    const __VLS_42 = __VLS_elementAsFunctionalComponent(__VLS_41);
                    const __VLS_43 = __VLS_42({ ...{ 'onClick': {}, }, class: ("logout-btn"), title: ("退出登录"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                    ({}({ ...{ 'onClick': {}, }, class: ("logout-btn"), title: ("退出登录"), }));
                    let __VLS_46 = { 'click': __VLS_pickEvent(__VLS_45['click'], {}.onClick) };
                    __VLS_46 = { click: (__VLS_ctx.handleLogout) };
                    {
                        const __VLS_47 = __VLS_intrinsicElements["svg"];
                        const __VLS_48 = __VLS_elementAsFunctionalComponent(__VLS_47);
                        const __VLS_49 = __VLS_48({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("logout-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("logout-icon"), }));
                        {
                            const __VLS_52 = __VLS_intrinsicElements["path"];
                            const __VLS_53 = __VLS_elementAsFunctionalComponent(__VLS_52);
                            const __VLS_54 = __VLS_53({ ...{}, d: ("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                            ({}({ ...{}, d: ("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), }));
                            const __VLS_55 = __VLS_pickFunctionalComponentCtx(__VLS_52, __VLS_54);
                        }
                        {
                            const __VLS_57 = __VLS_intrinsicElements["polyline"];
                            const __VLS_58 = __VLS_elementAsFunctionalComponent(__VLS_57);
                            const __VLS_59 = __VLS_58({ ...{}, points: ("16 17 21 12 16 7"), }, ...__VLS_functionalComponentArgsRest(__VLS_58));
                            ({}({ ...{}, points: ("16 17 21 12 16 7"), }));
                            const __VLS_60 = __VLS_pickFunctionalComponentCtx(__VLS_57, __VLS_59);
                        }
                        {
                            const __VLS_62 = __VLS_intrinsicElements["line"];
                            const __VLS_63 = __VLS_elementAsFunctionalComponent(__VLS_62);
                            const __VLS_64 = __VLS_63({ ...{}, x1: ("21"), y1: ("12"), x2: ("9"), y2: ("12"), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                            ({}({ ...{}, x1: ("21"), y1: ("12"), x2: ("9"), y2: ("12"), }));
                            const __VLS_65 = __VLS_pickFunctionalComponentCtx(__VLS_62, __VLS_64);
                        }
                        (__VLS_50.slots).default;
                        const __VLS_50 = __VLS_pickFunctionalComponentCtx(__VLS_47, __VLS_49);
                    }
                    (__VLS_44.slots).default;
                    const __VLS_44 = __VLS_pickFunctionalComponentCtx(__VLS_41, __VLS_43);
                    let __VLS_45;
                }
                (__VLS_13.slots).default;
                const __VLS_13 = __VLS_pickFunctionalComponentCtx(__VLS_10, __VLS_12);
            }
            {
                const __VLS_67 = __VLS_intrinsicElements["div"];
                const __VLS_68 = __VLS_elementAsFunctionalComponent(__VLS_67);
                const __VLS_69 = __VLS_68({ ...{}, class: ("sidebar-search"), }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                ({}({ ...{}, class: ("sidebar-search"), }));
                {
                    const __VLS_72 = __VLS_intrinsicElements["div"];
                    const __VLS_73 = __VLS_elementAsFunctionalComponent(__VLS_72);
                    const __VLS_74 = __VLS_73({ ...{}, class: ("search-input-wrapper"), }, ...__VLS_functionalComponentArgsRest(__VLS_73));
                    ({}({ ...{}, class: ("search-input-wrapper"), }));
                    {
                        const __VLS_77 = __VLS_intrinsicElements["svg"];
                        const __VLS_78 = __VLS_elementAsFunctionalComponent(__VLS_77);
                        const __VLS_79 = __VLS_78({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("search-icon"), }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                        ({}({ ...{}, viewBox: ("0 0 24 24"), fill: ("none"), stroke: ("currentColor"), "stroke-width": ("2"), class: ("search-icon"), }));
                        {
                            const __VLS_82 = __VLS_intrinsicElements["circle"];
                            const __VLS_83 = __VLS_elementAsFunctionalComponent(__VLS_82);
                            const __VLS_84 = __VLS_83({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }, ...__VLS_functionalComponentArgsRest(__VLS_83));
                            ({}({ ...{}, cx: ("11"), cy: ("11"), r: ("8"), }));
                            const __VLS_85 = __VLS_pickFunctionalComponentCtx(__VLS_82, __VLS_84);
                        }
                        {
                            const __VLS_87 = __VLS_intrinsicElements["line"];
                            const __VLS_88 = __VLS_elementAsFunctionalComponent(__VLS_87);
                            const __VLS_89 = __VLS_88({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                            ({}({ ...{}, x1: ("21"), y1: ("21"), x2: ("16.65"), y2: ("16.65"), }));
                            const __VLS_90 = __VLS_pickFunctionalComponentCtx(__VLS_87, __VLS_89);
                        }
                        (__VLS_80.slots).default;
                        const __VLS_80 = __VLS_pickFunctionalComponentCtx(__VLS_77, __VLS_79);
                    }
                    {
                        const __VLS_92 = __VLS_intrinsicElements["input"];
                        const __VLS_93 = __VLS_elementAsFunctionalComponent(__VLS_92);
                        const __VLS_94 = __VLS_93({ ...{}, value: ((__VLS_ctx.searchQuery)), type: ("text"), placeholder: ("搜索会话/联系人/聊天记录..."), class: ("search-input"), }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                        ({}({ ...{}, value: ((__VLS_ctx.searchQuery)), type: ("text"), placeholder: ("搜索会话/联系人/聊天记录..."), class: ("search-input"), }));
                        const __VLS_95 = __VLS_pickFunctionalComponentCtx(__VLS_92, __VLS_94);
                    }
                    if (__VLS_ctx.searchQuery) {
                        {
                            const __VLS_97 = __VLS_intrinsicElements["button"];
                            const __VLS_98 = __VLS_elementAsFunctionalComponent(__VLS_97);
                            const __VLS_99 = __VLS_98({ ...{ 'onClick': {}, }, class: ("clear-search-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_98));
                            ({}({ ...{ 'onClick': {}, }, class: ("clear-search-btn"), }));
                            let __VLS_102 = { 'click': __VLS_pickEvent(__VLS_101['click'], {}.onClick) };
                            __VLS_102 = { click: $event => {
                                    if (!((__VLS_ctx.searchQuery)))
                                        return;
                                    __VLS_ctx.searchQuery = '';
                                    // @ts-ignore
                                    [userStore, userStore, userStore, userStore, handleLogout, searchQuery, searchQuery, searchQuery, searchQuery,];
                                }
                            };
                            (__VLS_100.slots).default;
                            const __VLS_100 = __VLS_pickFunctionalComponentCtx(__VLS_97, __VLS_99);
                            let __VLS_101;
                        }
                    }
                    (__VLS_75.slots).default;
                    const __VLS_75 = __VLS_pickFunctionalComponentCtx(__VLS_72, __VLS_74);
                }
                (__VLS_70.slots).default;
                const __VLS_70 = __VLS_pickFunctionalComponentCtx(__VLS_67, __VLS_69);
            }
            {
                const __VLS_103 = __VLS_intrinsicElements["div"];
                const __VLS_104 = __VLS_elementAsFunctionalComponent(__VLS_103);
                const __VLS_105 = __VLS_104({ ...{}, class: ("tab-switcher"), }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                ({}({ ...{}, class: ("tab-switcher"), }));
                {
                    const __VLS_108 = __VLS_intrinsicElements["button"];
                    const __VLS_109 = __VLS_elementAsFunctionalComponent(__VLS_108);
                    const __VLS_110 = __VLS_109({ ...{ 'onClick': {}, }, class: ("tab-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_109));
                    ({}({ ...{ 'onClick': {}, }, class: ("tab-btn"), }));
                    ({ active: __VLS_ctx.activeTab === 'chats' });
                    __VLS_styleScopedClasses = ({ active: activeTab === 'chats' });
                    let __VLS_113 = { 'click': __VLS_pickEvent(__VLS_112['click'], {}.onClick) };
                    __VLS_113 = { click: $event => {
                            __VLS_ctx.activeTab = 'chats';
                            // @ts-ignore
                            [activeTab, activeTab,];
                        }
                    };
                    (__VLS_111.slots).default;
                    const __VLS_111 = __VLS_pickFunctionalComponentCtx(__VLS_108, __VLS_110);
                    let __VLS_112;
                }
                {
                    const __VLS_114 = __VLS_intrinsicElements["button"];
                    const __VLS_115 = __VLS_elementAsFunctionalComponent(__VLS_114);
                    const __VLS_116 = __VLS_115({ ...{ 'onClick': {}, }, class: ("tab-btn"), }, ...__VLS_functionalComponentArgsRest(__VLS_115));
                    ({}({ ...{ 'onClick': {}, }, class: ("tab-btn"), }));
                    ({ active: __VLS_ctx.activeTab === 'contacts' });
                    __VLS_styleScopedClasses = ({ active: activeTab === 'contacts' });
                    let __VLS_119 = { 'click': __VLS_pickEvent(__VLS_118['click'], {}.onClick) };
                    __VLS_119 = { click: $event => {
                            __VLS_ctx.activeTab = 'contacts';
                            // @ts-ignore
                            [activeTab, activeTab,];
                        }
                    };
                    (__VLS_117.slots).default;
                    const __VLS_117 = __VLS_pickFunctionalComponentCtx(__VLS_114, __VLS_116);
                    let __VLS_118;
                }
                (__VLS_106.slots).default;
                const __VLS_106 = __VLS_pickFunctionalComponentCtx(__VLS_103, __VLS_105);
            }
            {
                const __VLS_120 = __VLS_intrinsicElements["div"];
                const __VLS_121 = __VLS_elementAsFunctionalComponent(__VLS_120);
                const __VLS_122 = __VLS_121({ ...{}, class: ("sidebar-content"), }, ...__VLS_functionalComponentArgsRest(__VLS_121));
                ({}({ ...{}, class: ("sidebar-content"), }));
                if (__VLS_ctx.searchQuery) {
                    {
                        const __VLS_125 = {}.SearchResultList;
                        const __VLS_126 = __VLS_asFunctionalComponent(__VLS_125, new __VLS_125({ ...{ 'onSelect': {}, }, query: ((__VLS_ctx.searchQuery)), }));
                        ({}.SearchResultList);
                        const __VLS_127 = __VLS_126({ ...{ 'onSelect': {}, }, query: ((__VLS_ctx.searchQuery)), }, ...__VLS_functionalComponentArgsRest(__VLS_126));
                        ({}({ ...{ 'onSelect': {}, }, query: ((__VLS_ctx.searchQuery)), }));
                        let __VLS_130 = { 'select': __VLS_pickEvent(__VLS_129['select'], {}.onSelect) };
                        __VLS_130 = { select: $event => {
                                if (!((__VLS_ctx.searchQuery)))
                                    return;
                                __VLS_ctx.searchQuery = '';
                                // @ts-ignore
                                [searchQuery, searchQuery, searchQuery, searchQuery, searchQuery,];
                            }
                        };
                        const __VLS_128 = __VLS_pickFunctionalComponentCtx(__VLS_125, __VLS_127);
                        let __VLS_129;
                    }
                }
                else {
                    if (__VLS_ctx.activeTab === 'chats') {
                        {
                            const __VLS_131 = {}.ConversationList;
                            const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({ ...{}, }));
                            ({}.ConversationList);
                            const __VLS_133 = __VLS_132({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_132));
                            ({}({ ...{}, }));
                            const __VLS_134 = __VLS_pickFunctionalComponentCtx(__VLS_131, __VLS_133);
                        }
                        // @ts-ignore
                        [activeTab,];
                    }
                    else {
                        {
                            const __VLS_136 = {}.ContactList;
                            const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({ ...{}, }));
                            ({}.ContactList);
                            const __VLS_138 = __VLS_137({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_137));
                            ({}({ ...{}, }));
                            const __VLS_139 = __VLS_pickFunctionalComponentCtx(__VLS_136, __VLS_138);
                        }
                    }
                }
                (__VLS_123.slots).default;
                const __VLS_123 = __VLS_pickFunctionalComponentCtx(__VLS_120, __VLS_122);
            }
            (__VLS_8.slots).default;
            const __VLS_8 = __VLS_pickFunctionalComponentCtx(__VLS_5, __VLS_7);
        }
        {
            const __VLS_141 = __VLS_intrinsicElements["div"];
            const __VLS_142 = __VLS_elementAsFunctionalComponent(__VLS_141);
            const __VLS_143 = __VLS_142({ ...{}, class: ("chat-viewport"), }, ...__VLS_functionalComponentArgsRest(__VLS_142));
            ({}({ ...{}, class: ("chat-viewport"), }));
            {
                const __VLS_146 = {}.RouterView;
                const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({ ...{}, }));
                ({}.RouterView);
                const __VLS_148 = __VLS_147({ ...{}, }, ...__VLS_functionalComponentArgsRest(__VLS_147));
                ({}({ ...{}, }));
                const __VLS_149 = __VLS_pickFunctionalComponentCtx(__VLS_146, __VLS_148);
            }
            (__VLS_144.slots).default;
            const __VLS_144 = __VLS_pickFunctionalComponentCtx(__VLS_141, __VLS_143);
        }
        {
            const __VLS_151 = {}.KickoutOverlay;
            const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }));
            ({}.KickoutOverlay);
            const __VLS_153 = __VLS_152({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }, ...__VLS_functionalComponentArgsRest(__VLS_152));
            ({}({ ...{ 'onRelogin': {}, }, visible: ((__VLS_ctx.kickoutStore.isKickedOut)), }));
            let __VLS_156 = { 'relogin': __VLS_pickEvent(__VLS_155['relogin'], {}.onRelogin) };
            __VLS_156 = { relogin: (__VLS_ctx.handleKickoutRelogin) };
            const __VLS_154 = __VLS_pickFunctionalComponentCtx(__VLS_151, __VLS_153);
            let __VLS_155;
        }
        {
            const __VLS_157 = {}.MyProfileDrawer;
            const __VLS_158 = __VLS_asFunctionalComponent(__VLS_157, new __VLS_157({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showMyProfileDrawer)), }));
            ({}.MyProfileDrawer);
            const __VLS_159 = __VLS_158({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showMyProfileDrawer)), }, ...__VLS_functionalComponentArgsRest(__VLS_158));
            ({}({ ...{ 'onClose': {}, }, visible: ((__VLS_ctx.showMyProfileDrawer)), }));
            let __VLS_162 = { 'close': __VLS_pickEvent(__VLS_161['close'], {}.onClose) };
            __VLS_162 = { close: $event => {
                    __VLS_ctx.showMyProfileDrawer = false;
                    // @ts-ignore
                    [kickoutStore, kickoutStore, kickoutStore, handleKickoutRelogin, showMyProfileDrawer, showMyProfileDrawer, showMyProfileDrawer, showMyProfileDrawer,];
                }
            };
            const __VLS_160 = __VLS_pickFunctionalComponentCtx(__VLS_157, __VLS_159);
            let __VLS_161;
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
        __VLS_styleScopedClasses["sidebar-search"];
        __VLS_styleScopedClasses["search-input-wrapper"];
        __VLS_styleScopedClasses["search-icon"];
        __VLS_styleScopedClasses["search-input"];
        __VLS_styleScopedClasses["clear-search-btn"];
        __VLS_styleScopedClasses["tab-switcher"];
        __VLS_styleScopedClasses["tab-btn"];
        __VLS_styleScopedClasses["tab-btn"];
        __VLS_styleScopedClasses["sidebar-content"];
        __VLS_styleScopedClasses["chat-viewport"];
    }
    var __VLS_slots;
    return __VLS_slots;
}
const __VLS_internalComponent = (await import('vue')).defineComponent({
    setup() {
        return {
            KickoutOverlay: KickoutOverlay,
            ChannelAvatar: ChannelAvatar,
            ConversationList: ConversationList,
            ContactList: ContactList,
            SearchResultList: SearchResultList,
            MyProfileDrawer: MyProfileDrawer,
            activeTab: activeTab,
            searchQuery: searchQuery,
            showMyProfileDrawer: showMyProfileDrawer,
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

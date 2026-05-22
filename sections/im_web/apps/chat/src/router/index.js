import { createRouter, createWebHistory } from 'vue-router';
import { StorageService } from '@tsdaodao/base-vue';
import { LoginPage } from '@tsdaodao/login-vue';
import { FriendRequestsPage, AddFriendPage, BlacklistPage } from '@tsdaodao/contacts-vue';
const routes = [
    {
        path: '/',
        redirect: '/chat'
    },
    {
        path: '/login',
        name: 'Login',
        component: LoginPage
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@tsdaodao/login-vue/views/RegisterPage.vue')
    },
    {
        path: '/chat',
        name: 'ChatLayout',
        component: () => import('../layouts/MainLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                name: 'ChatWelcome',
                component: () => import('../views/ChatWelcome.vue')
            },
            {
                path: 'conversation/:channelId/:channelType',
                name: 'Conversation',
                component: () => import('../views/ChatView.vue'),
                props: true
            },
            {
                path: 'friend-requests',
                name: 'FriendRequests',
                component: FriendRequestsPage
            },
            {
                path: 'add-friend',
                name: 'AddFriend',
                component: AddFriendPage
            },
            {
                path: 'blacklist',
                name: 'Blacklist',
                component: BlacklistPage
            },
            {
                path: 'create-group',
                name: 'CreateGroup',
                component: () => import('../views/CreateGroupPage.vue')
            },
            {
                path: 'group-members/:groupNo',
                name: 'GroupMembers',
                component: () => import('../views/GroupMemberList.vue')
            },
            {
                path: 'devices',
                name: 'DeviceManagement',
                component: () => import('../views/DeviceManagementPage.vue')
            }
        ]
    }
];
export const router = createRouter({
    history: createWebHistory(),
    routes
});
router.beforeEach((to, from, next) => {
    const token = StorageService.get('token');
    if (to.matched.some(record => record.meta.requiresAuth) && !token) {
        next('/login');
    }
    else {
        next();
    }
});

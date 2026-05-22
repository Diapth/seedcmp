import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { friendApi, userApi } from '@tsdaodao/datasource-vue';
import { StorageService } from '@tsdaodao/base-vue';
import { pinyin } from 'pinyin-pro';
export const useContactStore = defineStore('contact', () => {
    const contacts = ref([]);
    const friendRequests = ref([]);
    const blacklist = ref([]);
    const version = ref(0);
    const friendRequestUnreadCount = ref(0);
    const isFriendRequestsLoading = ref(false);
    let contactSyncRequestId = 0;
    function getUnreadStorageKey() {
        const uid = StorageService.get('uid') || '';
        return uid ? `${uid}-friend-applys-unread-count` : 'friend-applys-unread-count';
    }
    function setFriendRequestUnreadCount(count) {
        const safeCount = Math.max(0, Number(count || 0));
        friendRequestUnreadCount.value = safeCount;
        StorageService.set(getUnreadStorageKey(), String(safeCount));
    }
    function hydrateFriendRequestUnreadCount() {
        const stored = StorageService.get(getUnreadStorageKey());
        setFriendRequestUnreadCount(Number(stored || 0));
    }
    // Sync friends incrementally
    async function syncContacts() {
        const requestId = ++contactSyncRequestId;
        try {
            const res = await friendApi.syncFriends({
                version: version.value,
                limit: 1000,
                api_version: 1
            });
            // friend/sync 返回直接数组
            const list = Array.isArray(res) ? res : (res?.friends || []);
            if (requestId !== contactSyncRequestId)
                return;
            if (list.length === 0) {
                return;
            }
            contacts.value = list.filter((f) => f.is_deleted !== 1 && f.follow === 1);
            const lastItem = list[list.length - 1];
            if (lastItem?.version) {
                version.value = lastItem.version;
            }
        }
        catch (e) {
            console.error('Failed to sync friends', e);
        }
    }
    async function fetchFriendRequests() {
        isFriendRequestsLoading.value = true;
        try {
            const res = await friendApi.getFriendApplies({
                page_index: 1,
                page_size: 999
            });
            // 后端返回直接数组或 { list: [...] } 结构
            const list = Array.isArray(res) ? res : (res?.list || []);
            friendRequests.value = list.map((item) => ({
                id: String(item.id || item.uid || item.to_uid || item.token || ''),
                uid: item.uid || item.apply_uid || item.to_uid || '',
                name: item.to_name || item.name || item.apply_name || '未知用户',
                avatar: item.avatar || '',
                remark: item.remark || '申请添加你为好友',
                status: item.status ?? 0,
                token: item.token || '',
                to_uid: item.to_uid || item.uid || '',
                created_at: item.created_at || item.createdAt || ''
            }));
            return friendRequests.value;
        }
        catch (e) {
            console.error('Failed to fetch friend requests', e);
            return [];
        }
        finally {
            isFriendRequestsLoading.value = false;
        }
    }
    async function refreshFriendRequestUnreadCount() {
        try {
            const res = await userApi.getReddot('friendApply');
            setFriendRequestUnreadCount(res?.count || 0);
        }
        catch (e) {
            console.error('Failed to refresh friend request unread count', e);
        }
    }
    async function markFriendRequestsRead() {
        setFriendRequestUnreadCount(0);
        try {
            await userApi.deleteReddot('friendApply');
        }
        catch (e) {
            console.error('Failed to clear friend request reddot', e);
        }
    }
    function markFriendRequestAccepted(token) {
        const request = friendRequests.value.find(item => item.token === token);
        if (request) {
            request.status = 1;
        }
    }
    // Get blacklists
    async function fetchBlacklist() {
        try {
            const res = await friendApi.getBlacklist();
            // friend/blacklists 返回直接数组
            blacklist.value = Array.isArray(res) ? res : (res?.list || []);
        }
        catch (e) {
            console.error(e);
        }
    }
    // Group contacts by pinyin initial A-Z
    const groupedContacts = computed(() => {
        const groups = {};
        contacts.value.forEach(contact => {
            const displayName = contact.remark || contact.name || '未知';
            const firstChar = displayName.charAt(0);
            let initial = 'Z';
            try {
                const py = pinyin(firstChar, { pattern: 'initial', toneType: 'none' });
                if (py && py.trim()) {
                    initial = py.substring(0, 1).toUpperCase();
                }
                else if (/^[a-zA-Z]/.test(firstChar)) {
                    initial = firstChar.toUpperCase();
                }
            }
            catch (err) {
                // Fallback
            }
            if (!/^[A-Z]$/.test(initial)) {
                initial = '#';
            }
            if (!groups[initial]) {
                groups[initial] = [];
            }
            groups[initial].push(contact);
        });
        // Sort keys alphabetically, with '#' at the end
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === '#')
                return 1;
            if (b === '#')
                return -1;
            return a.localeCompare(b);
        });
        const sortedGroups = [];
        sortedKeys.forEach(key => {
            // Sort list by name inside group
            groups[key].sort((a, b) => (a.remark || a.name).localeCompare(b.remark || b.name));
            sortedGroups.push({
                initial: key,
                list: groups[key]
            });
        });
        return sortedGroups;
    });
    // Listen to CMD events from datasource-vue
    hydrateFriendRequestUnreadCount();
    if (typeof window !== 'undefined') {
        window.addEventListener('wksdk:friendAccept', () => {
            syncContacts();
            fetchFriendRequests();
        });
        window.addEventListener('wksdk:friendDeleted', () => {
            syncContacts();
        });
        window.addEventListener('wksdk:friendRequest', () => {
            fetchFriendRequests();
            refreshFriendRequestUnreadCount();
        });
    }
    return {
        contacts,
        friendRequests,
        blacklist,
        friendRequestUnreadCount,
        isFriendRequestsLoading,
        syncContacts,
        fetchFriendRequests,
        fetchBlacklist,
        refreshFriendRequestUnreadCount,
        markFriendRequestsRead,
        markFriendRequestAccepted,
        groupedContacts
    };
});

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { friendApi, userApi } from '@tsdaodao/datasource-vue';
import { pinyin } from 'pinyin-pro';

export interface Friend {
  uid: string;
  name: string;
  avatar: string;
  remark?: string;
  online?: number;
  [key: string]: any;
}

export const useContactStore = defineStore('contact', () => {
  const contacts = ref<Friend[]>([]);
  const friendRequests = ref<any[]>([]);
  const blacklist = ref<any[]>([]);
  const version = ref(0);

  // Sync friends incrementally
  async function syncContacts() {
    try {
      const res: any = await friendApi.syncFriends({
        version: version.value,
        limit: 1000,
        api_version: 1
      });
      if (res && res.data) {
        // Simple incremental merge or replace
        const list = res.data.friends || res.data || [];
        contacts.value = list;
        if (res.data.version) {
          version.value = res.data.version;
        }
      }
    } catch (e) {
      console.error('Failed to sync friends', e);
    }
  }

  // Get blacklists
  async function fetchBlacklist() {
    try {
      const res: any = await friendApi.getBlacklist();
      blacklist.value = res.data || res || [];
    } catch (e) {
      console.error(e);
    }
  }

  // Group contacts by pinyin initial A-Z
  const groupedContacts = computed(() => {
    const groups: { [key: string]: Friend[] } = {};
    
    contacts.value.forEach(contact => {
      const displayName = contact.remark || contact.name || '未知';
      const firstChar = displayName.charAt(0);
      let initial = 'Z';
      
      try {
        const py = pinyin(firstChar, { pattern: 'initial', toneType: 'none' });
        if (py && py.trim()) {
          initial = py.substring(0, 1).toUpperCase();
        } else if (/^[a-zA-Z]/.test(firstChar)) {
          initial = firstChar.toUpperCase();
        }
      } catch (err) {
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
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: { initial: string; list: Friend[] }[] = [];
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

  return {
    contacts,
    friendRequests,
    blacklist,
    syncContacts,
    fetchBlacklist,
    groupedContacts
  };
});

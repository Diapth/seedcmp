import { defineStore } from 'pinia';

export const useNavigationStore = defineStore('navigation', {
  state: () => ({
    activeModule: 'chat',
    modules: [
      { id: 'chat', label: '聊天', icon: 'chat', path: '/pages/chat/index' },
      { id: 'contacts', label: '通讯录', icon: 'contacts', path: '/pages/contacts/index' },
      { id: 'agents', label: '智能体', icon: 'agents', path: '/pages/agents/index' },
      { id: 'files', label: '文件', icon: 'files', path: '/pages/files/index' }
    ],
    settingsItem: { id: 'settings', label: '设置', icon: 'settings', path: '/pages/settings/index' }
  }),
  actions: {
    setActiveModule(modId) {
      const mod = this.modules.find(m => m.id === modId);
      if (mod || modId === this.settingsItem.id) {
        this.activeModule = modId;
      }
    }
  }
});

import { defineStore } from 'pinia';
import { useSdkStore } from './sdk';
import { computed } from 'vue';
import { StorageService } from '@tsdaodao/base-vue';
import { useMessageStore } from './messageStore';
import { useConversationStore } from './conversationStore';
import { useGroupStore } from './groupStore';
import { useUserStore } from './userStore';

export const useKickoutStore = defineStore('kickout', () => {
  const sdkStore = useSdkStore();
  const isKickedOut = computed(() => sdkStore.isKickedOut);

  function triggerKickout() {
    sdkStore.isKickedOut = true;
  }

  function resetKickout() {
    sdkStore.isKickedOut = false;
  }

  function clearSensitiveState() {
    useMessageStore().reset();
    useConversationStore().reset();
    useGroupStore().reset();
    useUserStore().logout();
    StorageService.clear();
    sdkStore.disconnect();
    resetKickout();
  }

  return {
    isKickedOut,
    triggerKickout,
    clearSensitiveState,
    resetKickout
  };
});

import { defineStore } from 'pinia';
import { useSdkStore } from './sdk';
import { computed } from 'vue';
export const useKickoutStore = defineStore('kickout', () => {
    const sdkStore = useSdkStore();
    const isKickedOut = computed(() => sdkStore.isKickedOut);
    function triggerKickout() {
        sdkStore.isKickedOut = true;
    }
    function resetKickout() {
        sdkStore.isKickedOut = false;
    }
    return {
        isKickedOut,
        triggerKickout,
        resetKickout
    };
});

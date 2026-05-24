<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKickoutStore, useSdkStore } from '@tsdaodao/datasource-vue';
import { KickoutOverlay } from '@tsdaodao/base-vue';

const router = useRouter();
const sdkStore = useSdkStore();
const kickoutStore = useKickoutStore();

const isKickedOut = computed(() => sdkStore.isKickedOut);

const handleRelogin = () => {
  kickoutStore.clearSensitiveState();
  router.push('/login');
};
</script>

<template>
  <div class="app-container">
    <router-view />
    <KickoutOverlay :visible="isKickedOut" @relogin="handleRelogin" />
  </div>
</template>

<style>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-primary);
  color: var(--text-main);
}
</style>

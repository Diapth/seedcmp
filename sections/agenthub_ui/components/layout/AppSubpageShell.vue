<template>
  <AppShell :hide-mobile-tab-bar="!isDesktop">
    <slot />
  </AppShell>
</template>

<script setup>
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppShell from './AppShell.vue';

const { isDesktop } = useResponsiveLayout();
</script>

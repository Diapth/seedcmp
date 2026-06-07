<template>
  <view class="app-icon" :style="{ width: sizeStyle, height: sizeStyle, color: color }">
    <!-- #ifdef H5 -->
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      :stroke-width="strokeWidth" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      class="svg-icon"
      :style="{ width: sizeStyle, height: sizeStyle }"
    >
      <g v-if="pathData">
        <path v-for="(p, idx) in pathData" :key="idx" :d="p" />
      </g>
      <text v-else x="12" y="16" font-size="12" text-anchor="middle" fill="currentColor">?</text>
    </svg>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <UniIcons
      class="native-icon"
      :type="nativeIconType"
      :size="nativeIconSize"
      :color="nativeIconColor"
    />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed } from 'vue';
// #ifndef H5
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue';
// #endif

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 20
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  strokeWidth: {
    type: Number,
    default: 2
  }
});

const sizeStyle = computed(() => {
  return typeof props.size === 'number' ? `${props.size}px` : props.size;
});

const nativeIconMap = {
  chat: 'chatbubble',
  group: 'staff',
  contacts: 'contact',
  agents: 'auth',
  files: 'folder-add',
  copy: 'compose',
  quote: 'chatboxes',
  at: 'email',
  edit: 'compose',
  trash: 'trash',
  undo: 'undo',
  pin: 'map-pin',
  mute: 'micoff',
  hide: 'eye-slash',
  block: 'clear',
  exit: 'forward',
  settings: 'settings',
  user: 'person',
  lock: 'locked',
  eye: 'eye',
  'eye-off': 'eye-slash',
  fullscreen: 'eye',
  plus: 'plus',
  search: 'search',
  refresh: 'refresh',
  back: 'back',
  more: 'more',
  close: 'close',
  check: 'checkmarkempty',
  grid: 'bars',
  list: 'list',
  shield: 'auth',
  clock: 'calendar',
  image: 'image',
  camera: 'camera',
  mic: 'mic',
  'voice-wave': 'mic',
  phone: 'phone',
  location: 'location',
  bookmark: 'star',
  smile: 'heart',
  'plus-circle': 'plus-filled',
  'agent-spark': 'chatbubble-filled',
  download: 'download',
  upload: 'upload',
  package: 'folder-add',
  'book-open': 'compose',
  'file-plus': 'folder-add',
  keyboard: 'bars',
  info: 'info',
  send: 'paperplane',
  'chevron-right': 'right',
  'chevron-down': 'bottom',
  right: 'right',
  down: 'bottom',
  up: 'top',
  wifi: 'email',
  code: 'compose',
  briefcase: 'folder-add',
  flag: 'flag',
  'user-plus': 'person',
  'group-plus': 'staff'
};

const nativeIconType = computed(() => nativeIconMap[props.name] || 'help');
const nativeIconSize = computed(() => props.size);
const nativeIconColor = computed(() => (props.color === 'currentColor' ? 'inherit' : props.color));

// SVG Paths dictionary for complete cross-platform support without webfont dependencies
const iconsDict = {
  chat: [
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
  ],
  group: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75'
  ],
  contacts: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M16 11V7a4 4 0 0 0-4-4',
    'M19 21v-2a4 4 0 0 0-3-3.87'
  ],
  agents: [
    'M12 2v2',
    'M12 20v2',
    'M4.93 4.93l1.41 1.41',
    'M17.66 17.66l1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'M6.34 17.66l-1.41 1.41',
    'M19.07 4.93l-1.41 1.41',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
  ],
  files: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8'
  ],
  copy: [
    'M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
    'M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h1'
  ],
  quote: [
    'M3 21c3 0 7-1 7-8V5H3v8h4c0 3-1 5-4 5z',
    'M14 21c3 0 7-1 7-8V5h-7v8h4c0 3-1 5-4 5z'
  ],
  at: [
    'M16 8a5 5 0 1 0 1 4v-2a5 5 0 1 0-1 4',
    'M12 22a10 10 0 1 1 9.54-7'
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z'
  ],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    'M10 11v6',
    'M14 11v6'
  ],
  undo: [
    'M9 14L4 9l5-5',
    'M4 9h10a6 6 0 1 1 0 12h-2'
  ],
  pin: [
    'M12 17v5',
    'M5 17h14',
    'M7 3h10l-2 7 3 4H6l3-4z'
  ],
  mute: [
    'M11 5L6 9H2v6h4l5 4z',
    'M23 9l-6 6',
    'M17 9l6 6'
  ],
  hide: [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
    'M1 1l22 22'
  ],
  block: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M4.93 4.93l14.14 14.14'
  ],
  exit: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9'
  ],
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
  ],
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  ],
  lock: [
    'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4'
  ],
  eye: [
    'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  ],
  'eye-off': [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
    'M14.12 14.12a3 3 0 0 1-4.24-4.24',
    'M1 1l22 22'
  ],
  fullscreen: [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M21 8V5a2 2 0 0 0-2-2h-3',
    'M16 21h3a2 2 0 0 0 2-2v-3',
    'M3 16v3a2 2 0 0 0 2 2h3'
  ],
  plus: [
    'M12 5v14',
    'M5 12h14'
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35'
  ],
  refresh: [
    'M21 12a9 9 0 0 1-15.35 6.36L3 16',
    'M3 21v-5h5',
    'M3 12A9 9 0 0 1 18.35 5.64L21 8',
    'M21 3v5h-5'
  ],
  back: [
    'M19 12H5',
    'M12 19l-7-7 7-7'
  ],
  more: [
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'
  ],
  close: [
    'M18 6L6 18',
    'M6 6l12 12'
  ],
  check: [
    'M20 6L9 17l-5-5'
  ],
  grid: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M3 14h7v7H3z',
    'M14 14h7v7h-7z'
  ],
  list: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3 6h.01',
    'M3 12h.01',
    'M3 18h.01'
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4'
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2'
  ],
  image: [
    'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z',
    'M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'M21 15l-5-5L5 21'
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  ],
  mic: [
    'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z',
    'M19 10v1a7 7 0 0 1-14 0v-1',
    'M12 18v4',
    'M8 22h8'
  ],
  'voice-wave': [
    'M4 9c1.4 1.5 1.4 4.5 0 6',
    'M7.5 6.5c2.7 3 2.7 8 0 11',
    'M11 4c4 4.4 4 11.6 0 16',
    'M16 9v6',
    'M20 7v10'
  ],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.48-1.2a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92z'
  ],
  location: [
    'M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  ],
  bookmark: [
    'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'
  ],
  smile: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M8 14s1.5 2 4 2 4-2 4-2',
    'M9 9h.01',
    'M15 9h.01'
  ],
  keyboard: [
    'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    'M6 9h.01',
    'M10 9h.01',
    'M14 9h.01',
    'M18 9h.01',
    'M8 13h8',
    'M18 13h.01',
    'M6 13h.01'
  ],
  info: [
    'M12 16v-4',
    'M12 8h.01',
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'
  ],
  send: [
    'M22 2L11 13',
    'M22 2l-7 20-4-9-9-4 20-7z'
  ],
  'plus-circle': [
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
    'M12 8v8',
    'M8 12h8'
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3'
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12'
  ],
  package: [
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'M3.27 6.96L12 12l8.73-5.04',
    'M12 22V12'
  ],
  'book-open': [
    'M2 4.5A2.5 2.5 0 0 1 4.5 2H11v18H4.5A2.5 2.5 0 0 1 2 17.5z',
    'M22 4.5A2.5 2.5 0 0 0 19.5 2H13v18h6.5a2.5 2.5 0 0 0 2.5-2.5z'
  ],
  'file-plus': [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M12 18v-6',
    'M9 15h6'
  ],
  'agent-spark': [
    'M12 18a6 6 0 1 1 6-6c0 .77-.14 1.5-.4 2.18L19.5 18l-3.82-1.9A5.96 5.96 0 0 1 12 18z',
    'M8.5 11h2l-.5 2h-1.5z',
    'M13.5 11h2l-.5 2h-1.5z',
    'M10.5 11.5h3',
    'M19 3l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z'
  ],
  'chevron-right': [
    'M9 18l6-6-6-6'
  ],
  'chevron-down': [
    'M6 9l6 6 6-6'
  ],
  right: [
    'M9 18l6-6-6-6'
  ],
  down: [
    'M6 9l6 6 6-6'
  ],
  up: [
    'M18 15l-6-6-6 6'
  ],
  wifi: [
    'M5 12.55a11 11 0 0 1 14.08 0',
    'M1.42 9a16 16 0 0 1 21.16 0',
    'M8.53 16.11a6 6 0 0 1 6.95 0',
    'M12 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2'
  ],
  code: [
    'M16 18l6-6-6-6',
    'M8 6L2 12l6 6'
  ],
  briefcase: [
    'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
    'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'
  ],
  flag: [
    'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    'M4 22v-7'
  ],
  'user-plus': [
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M16 11h6'
  ],
  'group-plus': [
    'M17 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M21 15v6',
    'M18 18h6',
    'M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  ]
};

const pathData = computed(() => {
  return iconsDict[props.name] || null;
});
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}
.svg-icon {
  display: block;
}
.native-icon {
  display: block;
  line-height: 1;
}
</style>

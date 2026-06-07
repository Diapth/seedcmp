import { ref } from 'vue';

const isOnline = ref(true);
const globalLoading = ref(false);

// Listen to H5 online events
// #ifdef H5
window.addEventListener('online', () => { isOnline.value = true; });
window.addEventListener('offline', () => { isOnline.value = false; });
// #endif

// Handle uni-app network status API
try {
  uni.onNetworkStatusChange((res) => {
    isOnline.value = res.isConnected;
  });
} catch (e) {}

export function useVisualState() {
  return {
    isOnline,
    globalLoading
  };
}

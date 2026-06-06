import { ref, onMounted, onUnmounted } from 'vue';

const isDesktop = ref(false);
const windowWidth = ref(375);

function checkResponsive() {
  try {
    const sys = uni.getSystemInfoSync();
    windowWidth.value = sys.windowWidth;
    isDesktop.value = sys.windowWidth >= 768;
  } catch (e) {
    isDesktop.value = false;
  }
}

// Initial check
checkResponsive();

export function useResponsiveLayout() {
  onMounted(() => {
    // #ifdef H5
    window.addEventListener('resize', checkResponsive);
    // #endif
  });

  onUnmounted(() => {
    // #ifdef H5
    window.removeEventListener('resize', checkResponsive);
    // #endif
  });

  return {
    isDesktop,
    windowWidth
  };
}

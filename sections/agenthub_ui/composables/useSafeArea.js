import { ref } from 'vue';

const safeAreaInsets = ref({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
});

try {
  const sys = uni.getSystemInfoSync();
  if (sys.safeAreaInsets) {
    safeAreaInsets.value = {
      top: sys.safeAreaInsets.top || 0,
      bottom: sys.safeAreaInsets.bottom || 0,
      left: sys.safeAreaInsets.left || 0,
      right: sys.safeAreaInsets.right || 0
    };
  } else if (sys.safeArea) {
    safeAreaInsets.value = {
      top: sys.safeArea.top || 0,
      bottom: sys.screenHeight - sys.safeArea.bottom || 0,
      left: sys.safeArea.left || 0,
      right: sys.screenWidth - sys.safeArea.right || 0
    };
  }
} catch (e) {
  console.error('Failed to get safeArea', e);
}

export function useSafeArea() {
  return {
    safeAreaInsets
  };
}

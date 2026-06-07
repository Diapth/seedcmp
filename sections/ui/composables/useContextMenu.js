import { ref, computed } from 'vue';

/**
 * 统一处理桌面 @contextmenu / 移动 @longpress, 返回 { x, y, visible, target, show(event, data), hide() }
 *
 * target 为调用方传进来的任意 payload (消息 / 会话 / 群成员), 由 useContextMenu 透传给消费者.
 */
export function useContextMenu() {
  const visible = ref(false);
  const x = ref(0);
  const y = ref(0);
  const target = ref(null);

  // 桌面 / 移动检测: 简单靠窗口宽度
  const isDesktop = ref(true);
  if (typeof window !== 'undefined') {
    isDesktop.value = window.innerWidth > 768;
    window.addEventListener('resize', () => {
      isDesktop.value = window.innerWidth > 768;
    });
  }

  function readPoint(event) {
    if (!event) return { clientX: 80, clientY: 200 };
    if (event.touches && event.touches[0]) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if (event.changedTouches && event.changedTouches[0]) {
      return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
  }

  function show(event, data) {
    const point = readPoint(event);
    x.value = point.clientX;
    y.value = point.clientY;
    target.value = data ?? null;
    visible.value = true;
    if (event && event.preventDefault) event.preventDefault();
  }

  function hide() {
    visible.value = false;
    target.value = null;
  }

  return {
    visible,
    x,
    y,
    target,
    isDesktop: computed(() => isDesktop.value),
    show,
    hide
  };
}

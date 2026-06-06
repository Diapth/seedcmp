import { ref } from 'vue';

interface ConfirmOptions {
  title?: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  variant?: 'confirm' | 'bottom-sheet';
}

interface ConfirmState extends Required<Omit<ConfirmOptions, never>> {
  visible: boolean;
  resolve: ((v: boolean) => void) | null;
}

const state = ref<ConfirmState>({
  visible: false,
  title: '',
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  destructive: false,
  variant: 'confirm',
  resolve: null
});

export function useConfirm() {
  function confirm(content: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        visible: true,
        title: opts.title ?? '请确认',
        content,
        confirmText: opts.confirmText ?? '确定',
        cancelText: opts.cancelText ?? '取消',
        destructive: opts.destructive ?? false,
        variant: opts.variant ?? 'confirm',
        resolve
      };
    });
  }

  function handleConfirm() {
    if (state.value.resolve) {
      state.value.resolve(true);
      state.value.resolve = null;
    }
    state.value.visible = false;
  }

  function handleCancel() {
    if (state.value.resolve) {
      state.value.resolve(false);
      state.value.resolve = null;
    }
    state.value.visible = false;
  }

  return { state, confirm, handleConfirm, handleCancel };
}

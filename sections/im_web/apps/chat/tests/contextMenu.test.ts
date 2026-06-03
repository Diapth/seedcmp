import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/vue'
import ContextMenu from '../../../packages/base-vue/src/components/ContextMenu.vue'

function waitForDeferredListeners() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('context menu', () => {
  it('does not close from the contextmenu event that opened it', async () => {
    const action = vi.fn()
    const close = vi.fn()

    const { getByText } = render(ContextMenu, {
      props: {
        x: 24,
        y: 48,
        items: [{ label: '删除会话', action }],
        onClose: close
      }
    })

    document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(close).not.toHaveBeenCalled()

    await waitForDeferredListeners()
    document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(close).toHaveBeenCalledTimes(1)

    close.mockClear()
    await fireEvent.click(getByText('删除会话'))
    expect(action).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
})

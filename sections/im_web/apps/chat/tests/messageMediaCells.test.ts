import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('message media cells', () => {
  it('image cells expose load/error preview states with stable sizing', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/ImageCell.vue?raw')

    expect(source.default).toContain('imageLoadState')
    expect(source.default).toContain('@load=')
    expect(source.default).toContain('@error=')
    expect(source.default).toContain('aspect-ratio')
  })

  it('image cells emit preview payloads that the chat view opens in a direct lightbox', async () => {
    const image = await import('../../../packages/base-vue/src/components/messages/ImageCell.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')
    const view = await import('../src/views/ChatView.vue?raw')

    expect(image.default).toContain("event: 'preview'")
    expect(image.default).toContain("kind: 'image'")
    expect(list.default).toContain('@preview="handleImagePreview"')
    expect(view.default).toContain("payload?.source === 'image'")
    expect(view.default).toContain('image-lightbox')
    expect(view.default).not.toContain("type: 'file-image'")
  })

  it('file, voice, and video cells expose unavailable states instead of dead controls', async () => {
    const file = await import('../../../packages/base-vue/src/components/messages/FileCell.vue?raw')
    const voice = await import('../../../packages/base-vue/src/components/messages/VoiceCell.vue?raw')
    const video = await import('../../../packages/base-vue/src/components/messages/VideoCell.vue?raw')

    expect(file.default).toContain('isAvailable')
    expect(file.default).toContain('下载不可用')
    expect(voice.default).toContain('isAvailable')
    expect(voice.default).toContain('语音不可用')
    expect(video.default).toContain('isAvailable')
    expect(video.default).toContain('视频不可用')
  })

  it('file cells label the external action as download and resolve missing size from the file response', async () => {
    const FileCell = (await import('../../../packages/base-vue/src/components/messages/FileCell.vue')).default
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
      status: 200,
      headers: { 'content-length': '86660' }
    })))

    render(FileCell, {
      props: {
        isMe: false,
        message: {
          content: {
            type: 8,
            url: 'http://localhost:3003/uploads/ordering-demo.tar.gz',
            name: 'ordering-demo.tar.gz',
            size: 0
          }
        }
      }
    })

    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3004/uploads/ordering-demo.tar.gz',
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' })
    )
    await waitFor(() => {
      expect(screen.getByText(/84\.63 KB · 点击下载/)).toBeInTheDocument()
    })
  })
})

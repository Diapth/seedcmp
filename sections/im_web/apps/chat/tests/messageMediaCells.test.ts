import { describe, expect, it } from 'vitest'

describe('message media cells', () => {
  it('image cells expose load/error preview states with stable sizing', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/ImageCell.vue?raw')

    expect(source.default).toContain('imageLoadState')
    expect(source.default).toContain('@load=')
    expect(source.default).toContain('@error=')
    expect(source.default).toContain('aspect-ratio')
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
})

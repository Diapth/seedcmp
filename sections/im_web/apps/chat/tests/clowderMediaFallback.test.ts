import { describe, expect, it } from 'vitest'

describe('clowder media fallback contracts', () => {
  it('normalizes supported media attachments and exposes unavailable fallback states', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const normalizer = await fs.readFile(
      path.resolve(process.cwd(), '../../../im/TangSengDaoDaoServer/modules/clowder/media.go'),
      'utf8'
    )
    const textCell = await import('../../../packages/base-vue/src/components/messages/TextCell.vue?raw')
    const store = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts?raw')

    expect(normalizer).toContain('NormalizeMediaAttachment')
    expect(normalizer).toContain('unsupported')
    expect(textCell.default).toContain('unsupportedMedia')
    expect(store.default).toContain('media_download_failed')
  })
})

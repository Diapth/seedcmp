import { describe, expect, it } from 'vitest'

describe('Markdown code copy fallback', () => {
  it('uses a DOM textarea fallback when navigator.clipboard is unavailable on non-secure origins', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/TextCell.vue?raw')

    expect(source.default).toContain('fallbackCopyText')
    expect(source.default).toContain("document.execCommand('copy')")
    expect(source.default).toContain('textarea.select()')
    expect(source.default).toContain('navigator?.clipboard?.writeText')
  })
})


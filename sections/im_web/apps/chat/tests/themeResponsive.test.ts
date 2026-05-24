import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('theme and responsive shell contracts', () => {
  it('persists dark mode and applies responsive shell behavior', async () => {
    const source = await import('../src/layouts/MainLayout.vue?raw')
    const text = source.default

    expect(text).toContain('themeMode')
    expect(text).toContain('toggleTheme')
    expect(text).toContain('localStorage.setItem')
    expect(text).toContain('theme-mode')
    expect(text).toContain('@media (max-width: 720px)')
  })

  it('defines dark variables for desktop readiness', async () => {
    const text = readFileSync(resolve(__dirname, '../../../packages/base-vue/src/styles/variables.css'), 'utf8')

    expect(text).toContain('[theme-mode="dark"]')
    expect(text).toContain('--bg-primary')
    expect(text).toContain('--chat-background')
  })
})

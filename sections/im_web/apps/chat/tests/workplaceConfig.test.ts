import { describe, expect, it } from 'vitest'

describe('workplace and client config contracts', () => {
  it('renders workplace banner, categories, app ordering, recent use, and feature visibility', async () => {
    const source = await import('../src/views/ChatWelcome.vue?raw')
    const text = source.default

    expect(text).toContain('useRemoteConfig')
    expect(text).toContain('workplaceApps')
    expect(text).toContain('recentAppIds')
    expect(text).toContain('toggleRecentApp')
    expect(text).toContain('sortedWorkplaceApps')
    expect(text).toContain('工作台')
  })

  it('normalizes remote client config for feature visibility and update prompts', async () => {
    const source = await import('../../../packages/base-vue/src/composables/useRemoteConfig.ts?raw')
    const text = source.default

    expect(text).toContain('feature_visibility')
    expect(text).toContain('chat_background')
    expect(text).toContain('update_prompt')
    expect(text).toContain('workplace_apps')
    expect(text).toContain('normalizeRemoteConfig')
  })
})

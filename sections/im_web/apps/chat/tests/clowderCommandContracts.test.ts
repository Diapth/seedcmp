import { describe, expect, it } from 'vitest'

describe('clowder slash command contracts', () => {
  it('keeps the IM Web V3 command set aligned with the bridge contract', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const contract = await fs.readFile(
      path.resolve(process.cwd(), '../../.ai/V3.0/contracts/im-web-clowder-bridge.md'),
      'utf8'
    )

    for (const command of ['/ask', '/focus', '/use', '/thread', '/new', '/where', '/cats', '/status', '/history']) {
      expect(contract).toContain(command)
    }
  })

  it('requires command responses to be presentable as connector/system messages', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await fs.readFile(
      path.resolve(process.cwd(), '../../packages/datasource-vue/src/stores/messageStore.ts'),
      'utf8'
    )

    expect(source).toContain('addClowderCommandResponse')
    expect(source).toContain('connectorCommand')
    expect(source).toContain('clowder:command')
  })
})

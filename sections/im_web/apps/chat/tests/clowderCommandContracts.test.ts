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

  it('routes deployment confirmation cards through structured connector actions', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const [api, store, bridge, backend] = await Promise.all([
      fs.readFile(path.resolve(process.cwd(), '../../packages/datasource-vue/src/api/clowder.ts'), 'utf8'),
      fs.readFile(path.resolve(process.cwd(), '../../packages/datasource-vue/src/stores/clowderStore.ts'), 'utf8'),
      fs.readFile(path.resolve(process.cwd(), '../../../im/TangSengDaoDaoServer/modules/clowder/api.go'), 'utf8'),
      fs.readFile(path.resolve(process.cwd(), '../../../clowder-ai/packages/api/src/routes/connector-deployment-action.ts'), 'utf8')
    ])

    expect(api).toContain('sendDeploymentAction')
    expect(api).toContain('deploymentRequestId')
    expect(store).toContain('sendDeploymentAction')
    expect(bridge).toContain('/conversation/deployment-action')
    expect(bridge).toContain('/api/connectors/im-web/deployment-action')
    expect(backend).toContain("status === 'needs_fields'")
    expect(backend).toContain('actionId')
  })
})

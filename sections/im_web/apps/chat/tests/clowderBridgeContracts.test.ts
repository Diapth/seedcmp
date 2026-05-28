import { describe, expect, it } from 'vitest'

describe('clowder bridge API contracts', () => {
  it('keeps TangSeng-owned Clowder endpoints out of browser secret handling', async () => {
    const api = await import('../../../packages/datasource-vue/src/api/clowder.ts?raw')
    const source = api.default

    expect(source).toContain("apiClient.get<ClowderConnectionStatus>('clowder/status')")
    expect(source).toContain("apiClient.get<ClowderConversationStateResponse>('clowder/conversation'")
    expect(source).toContain("apiClient.post<IMConnectorBinding>('clowder/conversation/bind'")
    expect(source).toContain("apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus'")
    expect(source).toContain("apiClient.post<IMConnectorPermission>('clowder/group/allow'")
    expect(source).toContain("apiClient.post<IMConnectorPermission>('clowder/group/deny'")
    expect(source).not.toContain('CLOWDER_CONNECTOR_SECRET')
    expect(source).not.toContain('x-clowder-signature')
  })

  it('models binding, status, agents, permission, and delivery state for the V3 panel', async () => {
    const api = await import('../../../packages/datasource-vue/src/api/clowder.ts?raw')
    const types = await import('../../../packages/datasource-vue/src/stores/clowderTypes.ts?raw')

    expect(api.default).toContain('export interface IMConnectorBinding')
    expect(api.default).toContain('export interface ClowderConnectionStatus')
    expect(api.default).toContain('export interface ClowderAgent')
    expect(api.default).toContain('export interface IMConnectorPermission')
    expect(api.default).toContain('export interface ClowderLastDeliveryState')
    expect(types.default).toContain('export interface ClowderConversationPanelState')
    expect(types.default).toContain('export interface ClowderReplyPresentation')
  })
})

import { describe, expect, it } from 'vitest'

describe('clowder bridge API contracts', () => {
  it('keeps TangSeng-owned Clowder endpoints out of browser secret handling', async () => {
    const api = await import('../../../packages/datasource-vue/src/api/clowder.ts?raw')
    const source = api.default

    expect(source).toContain("apiClient.get<ClowderConnectionStatus>('clowder/status')")
    expect(source).toContain("apiClient.get<ClowderConversationStateResponse>('clowder/conversation'")
    expect(source).toContain("apiClient.post<IMConnectorBinding>('clowder/conversation/bind'")
    expect(source).toContain("apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus'")
    expect(source).toContain('getThreadTasks')
    expect(source).toContain("`clowder/thread/${encodeURIComponent(threadId)}/tasks`")
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
    expect(api.default).toContain('export interface ClowderThreadTasksResponse')
    expect(api.default).toContain('thread_binding_mismatch')
    expect(types.default).toContain('export interface ClowderConversationPanelState')
    expect(types.default).toContain('export interface ClowderReplyPresentation')
  })

  it('stores thread tasks as explicit load states instead of collapsing failures into empty kanban', async () => {
    const store = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts?raw')

    expect(store.default).toContain('export type ThreadTaskLoadState')
    expect(store.default).toContain("state: 'success_empty'")
    expect(store.default).toContain("state: 'route_failed'")
    expect(store.default).toContain("state: 'thread_binding_mismatch'")
    expect(store.default).toContain('fetchThreadTasks')
    expect(store.default).toContain('getThreadTasksState')
  })
})

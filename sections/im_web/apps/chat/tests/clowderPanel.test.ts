import { describe, expect, it } from 'vitest'

describe('clowder conversation panel component', () => {
  it('defines ready, disabled, denied, loading, and error states without nested card layout', async () => {
    const source = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(source.default).toContain('ClowderConversationPanel')
    for (const token of ['ready', 'disabled', 'denied', 'loading', 'error']) {
      expect(source.default).toContain(token)
    }
    expect(source.default).toContain('agentDirectories')
    expect(source.default).toContain('setFocus')
    expect(source.default).not.toContain('card')
  })

  it('refreshes connector health before conversation data and keeps degraded status visible', async () => {
    const source = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(source.default).toContain('clowderStore.refreshStatus')
    expect(source.default).toContain('statusReason')
    expect(source.default).toContain('clowder_unavailable')
  })

  it('exposes group auto reply mode controls from the clowder panel', async () => {
    const source = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(source.default).toContain('setGroupAutoReplyMode')
    expect(source.default).toContain('仅 @ 时回复')
    expect(source.default).toContain('默认协调者')
    expect(source.default).toContain('关闭')
  })

  it('passes observed task ids to kanban and refreshes on kanban activation', async () => {
    const source = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(source.default).toContain('TASK_ID_PATTERN')
    expect(source.default).toContain('observedTaskIds')
    expect(source.default).toContain(':observed-task-ids="observedTaskIds"')
    expect(source.default).toContain("next === 'kanban'")
    expect(source.default).toContain('deliveryRefreshToken')
  })

  it('renders kanban from clowder task store with explicit diagnostics', async () => {
    const source = await import('../src/components/ProjectKanbanPanel.vue?raw')

    expect(source.default).toContain('useClowderStore')
    expect(source.default).toContain('fetchThreadTasks')
    expect(source.default).toContain('getThreadTasksState')
    expect(source.default).toContain('thread_binding_mismatch')
    expect(source.default).toContain('route_failed')
    expect(source.default).toContain('onUnmounted')
    expect(source.default).not.toContain('apiClient.get')
  })
})

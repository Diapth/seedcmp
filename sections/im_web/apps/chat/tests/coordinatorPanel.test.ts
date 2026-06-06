import { describe, expect, it } from 'vitest'

describe('orchestrator web experience contracts', () => {
  it('adds a dedicated coordination tab backed by persisted thread coordination state', async () => {
    const panel = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(panel.default).toContain("type SubTab = 'overview' | 'coordination' | 'kanban' | 'artifacts'")
    expect(panel.default).toContain('loadThreadCoordinations')
    expect(panel.default).toContain('getThreadCoordinations')
    expect(panel.default).toContain('cancelCoordination')
    expect(panel.default).toContain('协调任务')
    expect(panel.default).toContain(':coordination-subtasks="activeCoordinationSubtasks"')
  })

  it('aligns the kanban with coordination subtasks and exposes click-to-locate behavior', async () => {
    const kanban = await import('../src/components/ProjectKanbanPanel.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')

    expect(kanban.default).toContain('coordinationSubtasks')
    expect(kanban.default).toContain("status === 'failed' || status === 'cancelled'")
    expect(kanban.default).toContain("source: 'coordination'")
    expect(kanban.default).toContain("new CustomEvent('clowder:locate-message'")
    expect(list.default).toContain("addEventListener('clowder:locate-message'")
    expect(list.default).toContain('data-message-key')
    expect(list.default).toContain('is-located')
  })

  it('renders coordinator summaries in the chat stream with guarded redispatch and cancel actions', async () => {
    const list = await import('../src/components/MessageList.vue?raw')
    const summary = await import('../src/components/CoordinatorSummaryCard.vue?raw')

    expect(list.default).toContain("import CoordinatorSummaryCard from './CoordinatorSummaryCard.vue'")
    expect(list.default).toContain('buildCoordinatorSummary')
    expect(list.default).toContain('Coordinator / Multi-Mention 结果汇总')
    expect(list.default).toContain('/dispatch ${coordinationId}')
    expect(list.default).toContain('coordinatorActionKey')
    expect(summary.default).toContain('重新派发')
    expect(summary.default).toContain('取消')
    expect(summary.default).toContain('检测到可能的产物或路径冲突')
  })

  it('offers coordinator slash commands from the composer and routes them to the coordinator', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')

    for (const command of ['/plan', '/dispatch', '/status', '/cancel']) {
      expect(input.default).toContain(command)
    }
    expect(input.default).toContain('COORDINATOR_COMMANDS')
    expect(input.default).toContain('showCoordinatorCommandMenu')
    expect(input.default).toContain("return [CLOWDER_COORDINATOR_CAT_ID]")
    expect(input.default).toContain('selectCoordinatorCommand')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()
const patch = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get,
    post,
    patch
  }
}))

describe('clowder control store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('binds a thread and tracks the last delivery state', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    post.mockResolvedValueOnce({
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      channelId: 'group-clowder',
      channelType: 2,
      threadId: 'thread-new',
      userId: 'owner-1',
      status: 'active'
    })
    get.mockResolvedValueOnce({
      status: { enabled: true, configured: true, reachable: true, state: 'ready' },
      binding: {
        connectorId: 'im-web',
        externalChatId: '2:group-clowder',
        channelId: 'group-clowder',
        channelType: 2,
        threadId: 'thread-new',
        userId: 'owner-1',
        status: 'active'
      },
      agents: [],
      lastDelivery: {
        externalChatId: '2:group-clowder',
        threadId: 'thread-new',
        state: 'delivered'
      }
    })

    await store.bindConversation({ channelId: 'group-clowder', channelType: 2, threadId: 'thread-new' })
    const state = await store.loadConversation({ channelId: 'group-clowder', channelType: 2 })

    expect(post).toHaveBeenCalledWith('clowder/conversation/bind', {
      channelId: 'group-clowder',
      channelType: 2,
      threadId: 'thread-new'
    })
    expect(state.binding?.threadId).toBe('thread-new')
    expect(state.lastDelivery?.state).toBe('delivered')
  })

  it('caches missing active deployment lookups briefly', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    get.mockRejectedValueOnce({ response: { status: 404 } })

    const first = await store.loadActiveDeploymentRequest({ channelId: 'clowder_cat:xtz', channelType: 1 })
    const second = await store.loadActiveDeploymentRequest({ channelId: 'clowder_cat:xtz', channelType: 1 })

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('clowder/conversation/deployment-request/active', {
      params: { channelId: 'clowder_cat:xtz', channelType: 1 }
    })
  })

  it('caches PM project group bindings and persists the routed project thread', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()
    const binding = {
      id: 'binding-1',
      userId: 'user-1',
      projectName: '婚礼',
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1,
      pmDirectThreadId: 'thread-direct',
      projectGroupNo: 'group-wedding',
      projectThreadId: '',
      pmMemberId: 'clowder_cat:coordinator',
      userMemberIds: ['user-1', 'clowder_cat:coordinator'],
      catMemberIds: ['codex'],
      createdBy: 'pm',
      createdAt: 1,
      updatedAt: 1,
      status: 'active'
    }

    post.mockResolvedValueOnce({
      data: {
        binding,
        group: { group_no: 'group-wedding', name: '婚礼' },
        reused: false
      }
    })

    await store.ensureProjectGroup({
      projectName: '婚礼',
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1,
      pmDirectThreadId: 'thread-direct'
    })

    expect(store.getProjectGroupBinding({
      userId: 'user-1',
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1,
      projectName: '婚礼'
    })?.projectGroupNo).toBe('group-wedding')
    expect(store.getActiveProjectGroupBindingForDirect({
      userId: 'user-1',
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1
    })?.id).toBe('binding-1')

    get.mockResolvedValueOnce({
      data: {
        binding: {
          ...binding,
          updatedAt: 2
        }
      }
    })
    await store.loadActiveProjectGroupBindingForDirect({
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1
    })

    expect(get).toHaveBeenCalledWith('clowder/project-groups/active', {
      params: {
        pmDirectChannelId: 'clowder_cat:coordinator',
        pmDirectChannelType: 1,
        projectName: undefined
      }
    })

    post.mockResolvedValueOnce({
      data: {
        binding: {
          ...binding,
          projectThreadId: 'thread-project',
          updatedAt: 3
        }
      }
    })
    await store.updateProjectGroupBindingThread('binding-1', 'thread-project')

    expect(post).toHaveBeenLastCalledWith('clowder/project-groups/binding-1/thread', {
      projectThreadId: 'thread-project'
    })
    expect(store.getActiveProjectGroupBindingForDirect({
      userId: 'user-1',
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1
    })?.projectThreadId).toBe('thread-project')
  })

  it('tracks coordination records by id and thread', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    const coordination = {
      coordinationId: 'coord-1',
      threadId: 'thread-1',
      createdBy: 'user-a',
      status: 'planning',
      goal: 'Build a page',
      assumptions: [],
      subtasks: [],
      targetCatIds: ['codex'],
      dispatchMode: 'parallel',
      createdAt: 1,
      updatedAt: 1
    }

    post.mockResolvedValueOnce({ data: { coordination } })
    const created = await store.createCoordination({
      threadId: 'thread-1',
      goal: 'Build a page',
      targetCatIds: ['codex']
    })

    expect(created.coordinationId).toBe('coord-1')
    expect(store.getCoordination('coord-1')?.goal).toBe('Build a page')
    expect(store.getThreadCoordinations('thread-1').map(item => item.coordinationId)).toEqual(['coord-1'])

    get.mockResolvedValueOnce({
      data: {
        threadId: 'thread-1',
        coordinations: [
          {
            ...coordination,
            status: 'dispatching',
            updatedAt: 2
          }
        ]
      }
    })
    const list = await store.loadThreadCoordinations('thread-1')
    expect(list[0].status).toBe('dispatching')
    expect(store.getCoordination('coord-1')?.status).toBe('dispatching')

    post.mockResolvedValueOnce({
      data: {
        coordination: {
          ...coordination,
          status: 'cancelled',
          failureReason: 'manual',
          updatedAt: 3
        }
      }
    })
    const cancelled = await store.cancelCoordination('coord-1', 'manual')
    expect(cancelled.status).toBe('cancelled')
    expect(store.getCoordination('coord-1')?.failureReason).toBe('manual')
  })
})

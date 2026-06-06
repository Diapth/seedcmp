import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isProjectStartRequest, resolveProjectGroupName } from '../src/utils/clowderProjectGroup'

describe('Clowder PM project group helpers', () => {
  it('detects PM project-start requests', () => {
    expect(isProjectStartRequest('帮我做一个活动页项目，项目名叫 婚礼')).toBe(true)
    expect(isProjectStartRequest('请 PM 协调猫猫拆解并开始执行')).toBe(true)
    expect(isProjectStartRequest('今天下午几点开会')).toBe(false)
  })

  it('extracts explicit project names for PM-created groups', () => {
    expect(resolveProjectGroupName('帮我做一个小项目，项目名叫 PM项目群验收，请拉猫猫进群')).toBe('PM项目群验收')
    expect(resolveProjectGroupName('项目名称为「婚礼」')).toBe('婚礼')
    expect(resolveProjectGroupName('请创建群名叫 todo 的项目群')).toBe('todo 的项目群')
  })

  it('falls back to workspace or compact request text', () => {
    expect(resolveProjectGroupName('帮我拆解并执行这个需求', 'Maomi Workspace')).toBe('Maomi Workspace')
    expect(resolveProjectGroupName('@PM 请协调一下 todo 页面')).toBe('请协调一下 todo 页面')
  })

  it('creates a pending confirmation card instead of auto-creating PM direct project groups', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')
    const store = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts?raw')
    const api = await import('../../../packages/datasource-vue/src/api/clowder.ts?raw')

    expect(input.default).toContain('addProjectGroupConfirmationCard')
    expect(input.default).toContain('project_group_confirmation: true')
    expect(input.default).toContain('pending_confirmation')
    expect(input.default).toContain('已生成项目群确认卡')
    expect(input.default).not.toContain('projectGroupRoute = await ensureProjectGroupForPMDirect')
    expect(list.default).toContain('confirmProjectGroupCreation')
    expect(list.default).toContain('确认创建项目群')
    expect(list.default).toContain('ensureProjectGroupFromConfirmation')
    expect(list.default).toContain('updateProjectGroupBindingThread(trimmedBindingId, routedThreadId)')
    expect(store.default).toContain('updateProjectGroupBindingThread')
    expect(api.default).toContain('project-groups/${encodeURIComponent(bindingId)}/thread')
  })

  it('lets PM direct clowder views resolve execution state from the active project group', async () => {
    const panel = await import('../src/components/ClowderConversationPanel.vue?raw')
    const store = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts?raw')
    const api = await import('../../../packages/datasource-vue/src/api/clowder.ts?raw')

    expect(panel.default).toContain('activeProjectGroupBinding')
    expect(panel.default).toContain('executionConversationRef')
    expect(panel.default).toContain('projectThreadId')
    expect(panel.default).toContain('loadActiveProjectGroupBindingForDirect')
    expect(panel.default).toContain('Project Group')
    expect(store.default).toContain('getActiveProjectGroupBindingForDirect')
    expect(store.default).toContain('loadActiveProjectGroupBindingForDirect')
    expect(api.default).toContain('clowder/project-groups/active')
  })

  it('renders a clickable project group handoff from PM direct messages', async () => {
    const list = await import('../src/components/MessageList.vue?raw')

    expect(list.default).toContain('getProjectGroupHandoff')
    expect(list.default).toContain('metadata.project_group_no')
    expect(list.default).toContain('openProjectGroupFromHandoff')
    expect(list.default).toContain('打开项目群')
    expect(list.default).toContain('/chat/conversation/${handoff.groupNo}/2')
  })

  it('keeps PM and cats visible in the group member surface', async () => {
    const members = await import('../src/views/GroupMemberList.vue?raw')
    const bridge = await fs.readFile(
      path.resolve(process.cwd(), '../../../im/TangSengDaoDaoServer/modules/clowder/api.go'),
      'utf8',
    )

    expect(members.default).toContain('members.length + catMembers.length')
    expect(members.default).toContain('猫猫成员')
    expect(members.default).toContain('role-badge admin')
    expect(bridge).toContain('defaultPMMemberID = "clowder_cat:coordinator"')
    expect(bridge).toContain('ensureVirtualClowderUser(pmMemberID, pmDisplayName)')
  })
})

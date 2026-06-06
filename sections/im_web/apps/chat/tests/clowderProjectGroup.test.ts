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
})

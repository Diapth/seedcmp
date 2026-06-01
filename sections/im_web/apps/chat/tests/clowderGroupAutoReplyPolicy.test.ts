import { describe, expect, it } from 'vitest'
import { resolveGroupCatAutoReplyTrigger } from '../src/utils/clowderGroupAutoReplyPolicy'

const ragdoll = {
  catId: 'ragdoll',
  displayName: '布偶猫',
  aliases: ['@布偶猫', 'ragdoll'],
  mentionNames: ['@布偶猫'],
  available: true
}

const codex = {
  catId: 'codex',
  displayName: 'Codex',
  aliases: ['@codex'],
  mentionNames: ['@codex', '@Codex'],
  available: true
}

describe('Clowder group auto reply policy', () => {
  it('routes explicit cat mentions regardless of soft auto reply mode', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '@Codex 帮我看一下这段逻辑',
      mode: 'mentions_only',
      cats: [codex, ragdoll],
      explicitTargetCatIds: ['codex']
    })

    expect(decision).toEqual({
      shouldRoute: true,
      targetCatIds: ['codex'],
      reason: 'explicit_mention'
    })
  })

  it('soft-routes a generic cat keyword to the only available group cat', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '猫猫帮忙总结一下刚才的讨论',
      mode: 'soft_mentions',
      cats: [ragdoll],
      explicitTargetCatIds: []
    })

    expect(decision).toEqual({
      shouldRoute: true,
      targetCatIds: ['ragdoll'],
      reason: 'soft_cat_keyword'
    })
  })

  it('does not soft-route generic cat keywords when auto replies are disabled', () => {
    const offDecision = resolveGroupCatAutoReplyTrigger({
      text: '猫猫帮忙总结一下刚才的讨论',
      mode: 'off',
      cats: [ragdoll],
      explicitTargetCatIds: []
    })
    const mentionsOnlyDecision = resolveGroupCatAutoReplyTrigger({
      text: '猫猫帮忙总结一下刚才的讨论',
      mode: 'mentions_only',
      cats: [ragdoll],
      explicitTargetCatIds: []
    })

    expect(offDecision).toEqual({
      shouldRoute: false,
      targetCatIds: [],
      reason: 'auto_reply_disabled'
    })
    expect(mentionsOnlyDecision).toEqual({
      shouldRoute: false,
      targetCatIds: [],
      reason: 'auto_reply_disabled'
    })
  })

  it('does not interrupt ordinary human chat when no cat trigger is present', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '我们先把明天的会议时间定下来',
      mode: 'soft_mentions',
      cats: [ragdoll],
      explicitTargetCatIds: []
    })

    expect(decision.shouldRoute).toBe(false)
    expect(decision.reason).toBe('no_trigger')
    expect(decision.targetCatIds).toEqual([])
  })

  it('does not silently choose a cat for ambiguous generic keyword in multi-cat groups', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '猫猫谁来回答一下？',
      mode: 'soft_mentions',
      cats: [codex, ragdoll],
      explicitTargetCatIds: []
    })

    expect(decision.shouldRoute).toBe(false)
    expect(decision.reason).toBe('ambiguous_cat_keyword')
    expect(decision.targetCatIds).toEqual([])
  })

  it('uses focus to resolve a generic cat keyword in multi-cat groups', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '猫猫继续讲',
      mode: 'soft_mentions',
      cats: [codex, ragdoll],
      explicitTargetCatIds: [],
      focusedCatId: 'codex'
    })

    expect(decision).toEqual({
      shouldRoute: true,
      targetCatIds: ['codex'],
      reason: 'soft_cat_keyword'
    })
  })

  it('routes replies to recent cat messages back to that cat', () => {
    const decision = resolveGroupCatAutoReplyTrigger({
      text: '这个结论再展开一下',
      mode: 'soft_mentions',
      cats: [codex, ragdoll],
      explicitTargetCatIds: [],
      replyTarget: {
        content: {
          connectorId: 'im-web',
          catId: 'ragdoll',
          catDisplayName: '布偶猫',
          text: '上一轮回答'
        }
      }
    })

    expect(decision).toEqual({
      shouldRoute: true,
      targetCatIds: ['ragdoll'],
      reason: 'reply_to_cat'
    })
  })
})

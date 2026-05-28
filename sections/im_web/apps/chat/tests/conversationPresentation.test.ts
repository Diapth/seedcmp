import { describe, it, expect } from 'vitest'
import { buildDigestPresentation, formatConversationTime } from '../src/utils/conversationPresentation';

describe('conversationPresentation', () => {
  const now = new Date(2026, 4, 23, 18, 38, 0)

  describe('formatConversationTime', () => {
    it('today shows HH:mm', () => {
      expect(formatConversationTime(new Date(2026, 4, 23, 18, 38).getTime() / 1000, now)).toBe('18:38')
    })
    it('yesterday shows 昨天 HH:mm', () => {
      expect(formatConversationTime(new Date(2026, 4, 22, 9, 5).getTime() / 1000, now)).toBe('昨天 09:05')
    })
    it('within week shows weekday HH:mm', () => {
      expect(formatConversationTime(new Date(2026, 4, 20, 7, 8).getTime() / 1000, now)).toBe('星期三 07:08')
    })
    it('same year shows MM/DD', () => {
      expect(formatConversationTime(new Date(2026, 4, 12, 7, 8).getTime() / 1000, now)).toBe('05/12')
    })
    it('different year shows YYYY/MM/DD', () => {
      expect(formatConversationTime(new Date(2025, 2, 24, 7, 8).getTime() / 1000, now)).toBe('2025/03/24')
    })
  })

  describe('buildDigestPresentation', () => {
    it('mention message shows mention reminder, sender, and text', () => {
      const result = buildDigestPresentation({
        channelType: 2,
        isSystem: false,
        senderName: 'leng_test_updated',
        mentionReminder: '[有人@我]',
        text: '@123 1111'
      })
      expect(result.mentionReminder).toBe('[有人@我]')
      expect(result.senderName).toBe('leng_test_updated')
      expect(result.text).toBe('@123 1111')
    })

    it('system message clears mention and sender', () => {
      const result = buildDigestPresentation({
        channelType: 2,
        isSystem: true,
        senderName: '用户',
        mentionReminder: '[有人@我]',
        text: '你已加入群聊 TestGroup'
      })
      expect(result.mentionReminder).toBe('')
      expect(result.senderName).toBe('')
      expect(result.text).toBe('你已加入群聊 TestGroup')
    })
  })
})

import { buildDigestPresentation, formatConversationTime } from '../src/utils/conversationPresentation';

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const now = new Date(2026, 4, 23, 18, 38, 0);

assertEqual(formatConversationTime(new Date(2026, 4, 23, 18, 38).getTime() / 1000, now), '18:38');
assertEqual(formatConversationTime(new Date(2026, 4, 22, 9, 5).getTime() / 1000, now), '昨天 09:05');
assertEqual(formatConversationTime(new Date(2026, 4, 20, 7, 8).getTime() / 1000, now), '星期三 07:08');
assertEqual(formatConversationTime(new Date(2026, 4, 12, 7, 8).getTime() / 1000, now), '05/12');
assertEqual(formatConversationTime(new Date(2025, 2, 24, 7, 8).getTime() / 1000, now), '2025/03/24');

const mentionDigest = buildDigestPresentation({
  channelType: 2,
  isSystem: false,
  senderName: 'leng_test_updated',
  mentionReminder: '[有人@我]',
  text: '@123 1111'
});

assertEqual(mentionDigest.mentionReminder, '[有人@我]');
assertEqual(mentionDigest.senderName, 'leng_test_updated');
assertEqual(mentionDigest.text, '@123 1111');

const systemDigest = buildDigestPresentation({
  channelType: 2,
  isSystem: true,
  senderName: '用户',
  mentionReminder: '[有人@我]',
  text: '你已加入群聊 TestGroup'
});

assertEqual(systemDigest.mentionReminder, '');
assertEqual(systemDigest.senderName, '');
assertEqual(systemDigest.text, '你已加入群聊 TestGroup');

console.log('conversationPresentation.test.ts passed');

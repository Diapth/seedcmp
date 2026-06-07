export function dropMockConversations(conversations = []) {
  return conversations.filter((item) => item?.source !== 'mock');
}

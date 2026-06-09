function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function createReplyTarget(payload = {}, conversationId = '') {
  const sourceConversationId = clean(
    payload.conversationId
    || payload.channelId
    || payload.channel_id
    || conversationId
  );
  return {
    id: clean(payload.id || payload.messageId || payload.sourceMessageId || `reply-${Date.now()}`),
    conversationId: sourceConversationId,
    senderName: clean(payload.senderName || payload.fileName || '文件片段'),
    contentPreview: clean(payload.contentPreview || payload.content || '')
  };
}

export function replyTargetForConversation(replyTarget, conversationId = '') {
  if (!replyTarget) return null;
  const activeId = clean(conversationId);
  const sourceId = clean(replyTarget.conversationId || replyTarget.channelId || replyTarget.channel_id);
  if (sourceId && activeId && sourceId !== activeId) return null;
  return replyTarget;
}

export function shouldClearReplyTargetOnConversationChange(replyTarget, nextConversationId = '') {
  return Boolean(replyTarget && !replyTargetForConversation(replyTarget, nextConversationId));
}

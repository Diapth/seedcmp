function hasClowderMarker(value = {}) {
  if (!value || typeof value !== 'object') return false;
  return Boolean(
    value.binding ||
    value.bindingId ||
    value.binding_id ||
    value.projectGroupId ||
    value.project_group_id ||
    value.threadId ||
    value.thread_id ||
    value.clowder ||
    value.clowderEnabled ||
    value.clowder_enabled ||
    value.isClowder ||
    value.is_clowder
  );
}

export function isClowderConversation(conversation = {}) {
  if (!conversation) return false;
  const id = String(conversation.channelId || conversation.id || conversation.raw?.channel_id || conversation.raw?.channelId || '');
  if (id.startsWith('clowder:') || id.startsWith('clowder_cat:')) return true;
  if (hasClowderMarker(conversation)) return true;
  if (hasClowderMarker(conversation.raw)) return true;
  const category = String(conversation.category || conversation.raw?.category || '').toLowerCase();
  return category.includes('clowder');
}

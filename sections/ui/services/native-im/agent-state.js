function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

export function createAgentConversation(agent = {}) {
  const id = firstNonEmpty(agent.id, agent.agentId, agent.uid, agent.alias);
  const name = firstNonEmpty(agent.name, agent.nickname, agent.alias, '智能体');
  return {
    id,
    channelId: id,
    channelType: 1,
    type: 'robot',
    name,
    avatar: firstNonEmpty(agent.avatar, agent.logo),
    unread: 0,
    lastMessage: firstNonEmpty(agent.desc, agent.description, '智能体已连接，可以开始对话'),
    lastTime: Date.now(),
    isPinned: false,
    isMuted: false,
    draft: '',
    isAgent: true,
    agentId: id
  };
}

export function createAgentMember(agent = {}) {
  const id = firstNonEmpty(agent.id, agent.agentId, agent.uid, agent.alias);
  const name = firstNonEmpty(agent.name, agent.nickname, agent.alias, '智能体');
  const alias = firstNonEmpty(agent.alias, name.startsWith('@') ? name : `@${id || name}`);
  return {
    id,
    uid: id,
    nickname: name,
    name,
    alias,
    avatar: firstNonEmpty(agent.avatar, agent.logo),
    role: 'member',
    isMuted: false,
    isAgent: true,
    agentId: id,
    status: agent.status || 'active'
  };
}

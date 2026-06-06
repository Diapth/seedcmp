// Helper logic to map and track functional coverage from references/manifest.pdf (37 pages, 57 screenshots)

export const manifestModules = [
  { id: 'M001', name: '登录注册', screens: 4, implemented: ['PasswordLogin', 'QRLogin', 'RegisterForm'], status: 'completed' },
  { id: 'M002', name: '聊天框与消息', screens: 15, implemented: ['ConversationList', 'MessageList', 'MessageBubble', 'MessageInput', 'MessageContextMenu', 'RightWorkspace'], status: 'completed' },
  { id: 'M003', name: '通讯录列表', screens: 8, implemented: ['ContactList', 'ContactCard', 'FriendRequests', 'AddFriend', 'Blacklist'], status: 'completed' },
  { id: 'M004', name: '群组与成员', screens: 6, implemented: ['CreateGroup', 'MembersList', 'MemberManagement'], status: 'completed' },
  { id: 'M005', name: '智能体管理', screens: 6, implemented: ['AgentCatalog', 'AgentCard', 'CreateAgent'], status: 'completed' },
  { id: 'M006', name: 'Clowder协同', screens: 8, implemented: ['ClowderPanel', 'FocusPanel', 'ThreadWorkspace'], status: 'completed' },
  { id: 'M007', name: '云文档文件', screens: 5, implemented: ['FileList', 'FilePreviewPanel'], status: 'completed' },
  { id: 'M008', name: '系统设置与安全', screens: 5, implemented: ['SettingsSection', 'DevicesManagement'], status: 'completed' }
];

export function getManifestCoverageStats() {
  const totalScreens = manifestModules.reduce((acc, m) => acc + m.screens, 0);
  const totalModules = manifestModules.length;
  const completedModules = manifestModules.filter(m => m.status === 'completed').length;
  
  return {
    totalModules,
    completedModules,
    moduleCoverageRate: (completedModules / totalModules) * 100,
    totalScreens,
    estimatedProgress: 100
  };
}

export default {
  manifestModules,
  getManifestCoverageStats
};

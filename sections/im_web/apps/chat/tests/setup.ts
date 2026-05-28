import '@testing-library/jest-dom'

export const v3ClowderFixtureMap = {
  messageStore: [
    'messageActions.test.ts',
    'messageStoreDailyMessaging.test.ts',
    'messageListenerOwnEcho.test.ts'
  ],
  recovery: [
    'sdkRecovery.test.ts',
    'offlineQueue.test.ts',
    'largeHistory.test.ts'
  ],
  media: [
    'filePreviewVoiceAiContracts.test.ts',
    'messageMediaCells.test.ts',
    'messageMediaSending.test.ts',
    'mediaUrlNormalization.test.ts'
  ],
  permissions: [
    'groupPermissions.test.ts',
    'groupOwnerPermission.test.ts',
    'groupSettingsDrawer.test.ts'
  ],
  presentation: [
    'conversationPresentation.test.ts',
    'messageUiStability.test.ts',
    'uiLayoutStability.test.ts'
  ]
} as const

export function createClowderTestBinding(overrides: Record<string, unknown> = {}) {
  return {
    connectorId: 'im-web',
    externalChatId: '2:group-clowder',
    channelId: 'group-clowder',
    channelType: 2,
    threadId: 'thr-im-web',
    userId: 'clowder-user',
    hubThreadId: 'hub-im-web',
    status: 'active',
    ...overrides
  }
}

export function createClowderTestReply(overrides: Record<string, unknown> = {}) {
  return {
    connectorId: 'im-web',
    externalChatId: '2:group-clowder',
    threadId: 'thr-im-web',
    invocationId: 'invoke-im-web',
    catId: 'codex',
    catDisplayName: 'Codex',
    content: 'Clowder reply',
    format: 'markdown',
    richBlocks: [],
    stream: {
      state: 'final',
      platformMessageId: 'clowder-invoke-im-web-final'
    },
    ...overrides
  }
}

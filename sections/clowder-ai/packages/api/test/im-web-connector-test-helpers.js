import crypto from 'node:crypto';

export const IM_WEB_CONNECTOR_ID = 'im-web';
export const IM_WEB_TEST_SECRET = 'im-web-test-secret';

export function createImWebExternalChatId(channelType = 2, channelId = 'group-clowder') {
  return `${channelType}:${channelId}`;
}

export function createImWebInboundPayload(overrides = {}) {
  const channelType = overrides.channelType ?? 2;
  const channelId = overrides.channelId ?? 'group-clowder';
  return {
    connectorId: IM_WEB_CONNECTOR_ID,
    externalChatId: createImWebExternalChatId(channelType, channelId),
    channelId,
    channelType,
    chatType: channelType === 2 ? 'group' : 'direct',
    chatName: channelType === 2 ? 'Clowder Group' : 'Clowder Direct',
    messageId: 'im-msg-1',
    clientMsgNo: 'client-msg-1',
    messageSeq: 1,
    text: '@codex hello from IM Web',
    timestamp: 1780000000000,
    sender: {
      id: 'u_10001',
      name: 'Alice',
    },
    attachments: [],
    ...overrides,
  };
}

export function createImWebOutboundPayload(overrides = {}) {
  return {
    connectorId: IM_WEB_CONNECTOR_ID,
    externalChatId: createImWebExternalChatId(),
    threadId: 'thr-im-web',
    invocationId: 'invoke-im-web',
    catId: 'codex',
    catDisplayName: 'Codex',
    content: 'Clowder reply',
    format: 'markdown',
    richBlocks: [],
    origin: {
      triggerMessageId: 'msg-im-web',
    },
    stream: {
      state: 'final',
      platformMessageId: 'clowder-invoke-im-web-final',
    },
    ...overrides,
  };
}

export function signImWebBody(body, secret = IM_WEB_TEST_SECRET, timestamp = '1780000000000') {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    rawBody,
    timestamp,
    signature: crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'),
  };
}

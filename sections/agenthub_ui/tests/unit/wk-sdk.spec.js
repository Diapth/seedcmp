import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMock = vi.hoisted(() => {
  const textContent = { kind: 'text-content', encode: vi.fn(() => new Uint8Array()) };
  const channel = { channelID: 'clowder_cat:codex', channelType: 1 };
  const sendResult = { clientSeq: 7, clientMsgNo: 'sdk-generated' };
  const shared = {
    newMessageText: vi.fn(() => textContent),
    newChannel: vi.fn(() => channel),
    chatManager: {
      send: vi.fn(async () => sendResult)
    }
  };
  return { textContent, channel, sendResult, shared };
});

vi.mock('wukongimjssdk', () => ({
  default: {
    shared: () => sdkMock.shared
  }
}));

describe('WKSDK adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sends text through WKSDK using positional content and channel arguments', async () => {
    const { sendTextMessage } = await import('../../utils/wk-sdk.js');

    const result = await sendTextMessage({
      channelId: 'clowder_cat:codex',
      channelType: 1,
      text: 'hello from agenthub',
      clientMsgNo: 'agenthub-client-1'
    });

    expect(sdkMock.shared.newMessageText).toHaveBeenCalledWith('hello from agenthub');
    expect(sdkMock.shared.newChannel).toHaveBeenCalledWith('clowder_cat:codex', 1);
    expect(sdkMock.shared.chatManager.send).toHaveBeenCalledWith(sdkMock.textContent, sdkMock.channel);
    expect(result.clientMsgNo).toBe('agenthub-client-1');
  });
});

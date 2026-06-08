import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  request,
  resetRequestRuntimeForTests,
  setAuthTokenProvider,
  setKickoutHandler,
  setRefreshHandler,
  setRequestAdapter
} from '../../utils/request.js';
import { syncApi } from '../../api/sync.js';

describe('request runtime adapter', () => {
  beforeEach(() => {
    resetRequestRuntimeForTests();
  });

  it('injects the current token through a uni-app safe header', async () => {
    setAuthTokenProvider(() => 'token-a');
    const adapter = vi.fn(async (options) => ({ status: 200, data: { code: 0, data: { ok: true } }, options }));
    setRequestAdapter(adapter);

    const response = await request('/ping', { method: 'POST', data: { hello: 'world' } });

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining('/ping'),
      method: 'POST',
      headers: expect.objectContaining({ token: 'token-a' })
    }));
    expect(response.data).toEqual({ ok: true });
  });

  it('triggers kickout without retrying when backend reports a kicked session', async () => {
    setAuthTokenProvider(() => 'expired');
    const kickout = vi.fn();
    const refresh = vi.fn();
    setKickoutHandler(kickout);
    setRefreshHandler(refresh);
    setRequestAdapter(async () => ({ status: 401, data: { code: 'kicked', msg: '其他设备登录' } }));

    await expect(request('/secure')).rejects.toMatchObject({ status: 401, code: 'kicked' });

    expect(kickout).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes once for a normal 401 and retries the original request', async () => {
    setAuthTokenProvider(() => 'old-token');
    const refresh = vi.fn(async () => 'new-token');
    setRefreshHandler(refresh);
    const adapter = vi.fn()
      .mockResolvedValueOnce({ status: 401, data: { code: 401, msg: 'token expired' } })
      .mockResolvedValueOnce({ status: 200, data: { code: 0, data: { ok: true } } });
    setRequestAdapter(adapter);

    const response = await request('/secure');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(response.data).toEqual({ ok: true });
  });

  it('normalizes business errors as AppError', async () => {
    setRequestAdapter(async () => ({ status: 200, data: { code: 40042, msg: '参数错误' } }));

    await expect(request('/business-error')).rejects.toBeInstanceOf(AppError);
    await expect(request('/business-error')).rejects.toMatchObject({
      code: 40042,
      message: '参数错误'
    });
  });

  it('posts pinned message sync and clear requests through the AgentHub adapter', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: { ok: true } } }));
    setRequestAdapter(adapter);

    await syncApi.syncPinnedMessages({ channel_id: 'g1', channel_type: 2, version: 0 });
    await syncApi.clearPinnedMessages({ channel_id: 'g1', channel_type: 2 });

    expect(adapter).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: expect.stringContaining('/message/pinned/sync'),
      method: 'POST',
      data: { channel_id: 'g1', channel_type: 2, version: 0 }
    }));
    expect(adapter).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: expect.stringContaining('/message/pinned/clear'),
      method: 'POST',
      data: { channel_id: 'g1', channel_type: 2 }
    }));
  });
});

import { request } from '@/utils/request.js';

export const authApi = {
  login(data) {
    return request('user/login', { method: 'POST', data, skipRefresh: true });
  },
  register(data) {
    return request('user/register', { method: 'POST', data, skipRefresh: true });
  },
  getRegisterSmsCode(data) {
    return request('user/sms/registercode', { method: 'POST', data, skipRefresh: true });
  },
  getLoginUUID() {
    return request('user/loginuuid', { skipRefresh: true });
  },
  getLoginStatus(uuid) {
    return request(`user/loginstatus?uuid=${encodeURIComponent(uuid)}`, { skipRefresh: true });
  },
  loginWithAuthCode(authCode) {
    return request(`user/login_authcode/${encodeURIComponent(authCode)}`, { method: 'POST', skipRefresh: true });
  },
  refreshToken(refreshToken) {
    return request('user/token/refresh', {
      method: 'POST',
      data: { refresh_token: refreshToken },
      skipRefresh: true
    });
  },
  quit() {
    return request('user/quit', { method: 'POST' });
  },
  getDevices() {
    return request('user/devices');
  },
  deleteDevice(deviceId) {
    return request(`user/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
  }
};

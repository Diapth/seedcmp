import { request } from '@/utils/request.js';

export const userApi = {
  getUserInfo(uid, groupNo = '') {
    const suffix = groupNo ? `?group_no=${encodeURIComponent(groupNo)}` : '';
    return request(`users/${encodeURIComponent(uid)}${suffix}`);
  },
  updateProfile(data) {
    return request('user/current', { method: 'PUT', data });
  },
  getImCredentials(uid) {
    return request(`users/${encodeURIComponent(uid)}/im`);
  },
  getReddot(category) {
    return request(`user/reddot/${encodeURIComponent(category)}`);
  },
  deleteReddot(category) {
    return request(`user/reddot/${encodeURIComponent(category)}`, { method: 'DELETE' });
  }
};

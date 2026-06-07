import { apiDelete, request } from '@/utils/request.js';

export const friendApi = {
  syncFriends(params = { version: 0, limit: 100, api_version: 1 }) {
    const query = new URLSearchParams(params).toString();
    return request(`friend/sync?${query}`);
  },
  applyFriend(data) {
    return request('friend/apply', { method: 'POST', data });
  },
  getFriendApplies(params = { page_index: 1, page_size: 50 }) {
    const query = new URLSearchParams(params).toString();
    return request(`friend/apply?${query}`);
  },
  approveFriend(token) {
    return request('friend/sure', { method: 'POST', data: { token } });
  },
  updateRemark(data) {
    return request('friend/remark', { method: 'PUT', data });
  },
  deleteFriend(uid) {
    return apiDelete(`friend/${encodeURIComponent(uid)}`);
  },
  searchUser(keyword) {
    return request(`user/search?keyword=${encodeURIComponent(keyword)}`);
  },
  getBlacklist() {
    return request('user/blacklists');
  },
  addBlacklist(uid) {
    return request(`user/blacklist/${encodeURIComponent(uid)}`, { method: 'POST' });
  },
  removeBlacklist(uid) {
    return apiDelete(`user/blacklist/${encodeURIComponent(uid)}`);
  }
};

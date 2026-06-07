import { apiDelete, request } from '@/utils/request.js';

export const groupApi = {
  createGroup(data) {
    return request('group/create', { method: 'POST', data });
  },
  getMyGroups() {
    return request('group/my');
  },
  getGroupInfo(groupNo) {
    return request(`groups/${encodeURIComponent(groupNo)}`);
  },
  getGroupMembers(groupNo, params = { page: 1, limit: 100 }) {
    const query = new URLSearchParams(params).toString();
    return request(`groups/${encodeURIComponent(groupNo)}/members?${query}`);
  },
  inviteMembers(groupNo, members) {
    return request(`groups/${encodeURIComponent(groupNo)}/members`, { method: 'POST', data: { members } });
  },
  removeMembers(groupNo, members) {
    return apiDelete(`groups/${encodeURIComponent(groupNo)}/members`, { members });
  },
  updateGroupInfo(groupNo, data) {
    return request(`groups/${encodeURIComponent(groupNo)}`, { method: 'PUT', data });
  },
  updateSetting(groupNo, data) {
    return request(`groups/${encodeURIComponent(groupNo)}/setting`, { method: 'PUT', data });
  },
  getGroupQRCode(groupNo) {
    return request(`groups/${encodeURIComponent(groupNo)}/qrcode`);
  },
  exitGroup(groupNo) {
    return request(`groups/${encodeURIComponent(groupNo)}/exit`, { method: 'POST' });
  },
  disbandGroup(groupNo) {
    return apiDelete(`groups/${encodeURIComponent(groupNo)}/disband`);
  }
};

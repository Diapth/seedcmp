import { apiClient, apiDelete, normalizeMediaUrl, StorageService } from '@tsdaodao/base-vue';
export * from './clowder';

export type AiStreamEvent = {
  delta?: string;
  done?: boolean;
  error?: string;
  message_id?: string;
  message_seq?: number;
  timestamp?: number;
  model?: string;
};

export function parseAiStreamLine(line: string): AiStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (!trimmed.startsWith('data:')) return null;

  const data = trimmed.slice(5).trim();
  if (!data) return null;
  if (data === '[DONE]') return { done: true };

  try {
    const payload = JSON.parse(data);
    if (payload?.error || payload?.msg) {
      return { error: String(payload.error || payload.msg) };
    }
    if (payload?.done === true) {
      return {
        done: true,
        message_id: payload.message_id === undefined ? undefined : String(payload.message_id),
        message_seq: payload.message_seq === undefined ? undefined : Number(payload.message_seq),
        timestamp: payload.timestamp === undefined ? undefined : Number(payload.timestamp),
        model: payload.model === undefined ? undefined : String(payload.model)
      };
    }

    const delta = payload?.delta ?? payload?.content ?? payload?.choices?.[0]?.delta?.content;
    if (delta !== undefined) {
      return { delta: String(delta) };
    }
  } catch {
    return { delta: data };
  }

  return null;
}

// 1. 身份认证与登录设备管理 API (Auth & Device)
export const authApi = {
  // 手机号验证码/密码登录
  login(data: any) {
    return apiClient.post('user/login', data);
  },
  // 手机号注册
  register(data: any) {
    return apiClient.post('user/register', data);
  },
  // 获取短信验证码 (注册)
  getRegisterSmsCode(data: { zone: string; phone: string }) {
    return apiClient.post('user/sms/registercode', data);
  },
  // 获取短信验证码 (忘记密码)
  getForgetPwdSmsCode(phone: string) {
    return apiClient.post('user/sms/forgetpwd', { phone });
  },
  // 获取扫码登录 UUID
  getLoginUUID() {
    return apiClient.get('user/loginuuid');
  },
  // 轮询扫码登录状态
  getLoginStatus(uuid: string) {
    return apiClient.get(`user/loginstatus?uuid=${uuid}`);
  },
  // 扫码授权码登录
  loginWithAuthCode(authCode: string) {
    return apiClient.post(`user/login_authcode/${authCode}`);
  },
  // 获取当前在线设备
  getDevices() {
    return apiClient.get('user/devices');
  },
  // 强退指定设备
  deleteDevice(deviceId: string) {
    return apiDelete(`user/devices/${deviceId}`);
  },
  // 安全退出
  quit() {
    return apiClient.post('user/quit');
  }
};

// 2. 个人信息与系统设置 API (User Profile & System Settings)
export const userApi = {
  // 获取特定用户详情
  getUserInfo(uid: string, groupNo?: string) {
    const url = groupNo ? `users/${uid}?group_no=${groupNo}` : `users/${uid}`;
    return apiClient.get(url);
  },
  // 修改个人资料
  updateProfile(data: { name?: string; sex?: number; short_no?: string }) {
    return apiClient.put('user/current', data);
  },
  // 个人头像上传
  uploadAvatar(uid: string, formData: FormData) {
    return apiClient.post(`users/${uid}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // 获取 IM 节点通讯凭证
  getImCredentials(uid: string) {
    return apiClient.get(`users/${uid}/im`);
  },
  // 获取红点提示
  getReddot(category: string) {
    return apiClient.get(`user/reddot/${category}`);
  },
  // 清除红点未读
  deleteReddot(category: string) {
    return apiDelete(`user/reddot/${category}`);
  },
  // 注册推送 token
  registerDeviceToken(data: { device_token: string; device_type: string; bundle_id?: string }) {
    return apiClient.post('user/device_token', data);
  },
  // 移除推送 token
  unregisterDeviceToken() {
    return apiDelete('user/device_token');
  },
  // 更新设备角标
  updateDeviceBadge(badge: number) {
    return apiClient.post('user/device_badge', { badge });
  }
};

// 3. 好友与联系人 API (Friend Relationship)
export const friendApi = {
  // 增量同步好友名册
  syncFriends(params: { version: number; limit: number; keyword?: string; api_version: number }) {
    return apiClient.get('friend/sync', { params });
  },
  // 发起好友申请
  applyFriend(data: { to_uid: string; remark: string; vercode?: string }) {
    return apiClient.post('friend/apply', data);
  },
  // 获取好友申请列表
  getFriendApplies(params: { page_index: number; page_size: number }) {
    return apiClient.get('friend/apply', { params });
  },
  // 删除好友申请记录
  deleteFriendApply(toUid: string) {
    return apiDelete(`friend/apply/${toUid}`);
  },
  // 同意好友申请
  approveFriend(token: string) {
    return apiClient.post('friend/sure', { token });
  },
  // 修改好友备注名
  updateRemark(data: { uid: string; remark: string }) {
    return apiClient.put('friend/remark', data);
  },
  // 删除好友
  deleteFriend(uid: string) {
    return apiDelete(`friend/${uid}`);
  },
  // 搜索用户
  searchUser(keyword: string) {
    return apiClient.get('user/search', { params: { keyword } });
  },
  // 获取黑名单列表
  getBlacklist() {
    return apiClient.get('user/blacklists');
  },
  // 拉黑好友
  addBlacklist(uid: string) {
    return apiClient.post(`user/blacklist/${uid}`);
  },
  // 解除黑名单
  removeBlacklist(uid: string) {
    return apiDelete(`user/blacklist/${uid}`);
  }
};

// 4. 群组管理 API (Group Administration)
export const groupApi = {
  // 建群
  createGroup(data: { name: string; members: string[] }) {
    return apiClient.post('group/create', data);
  },
  // 获取我保存的群聊列表
  getMyGroups() {
    return apiClient.get('group/my');
  },
  // 获取群详情
  getGroupInfo(groupNo: string) {
    return apiClient.get(`groups/${groupNo}`);
  },
  // 增量同步群成员
  syncGroupMembers(groupNo: string, params: { version: number; limit: number }) {
    return apiClient.get(`groups/${groupNo}/membersync`, { params });
  },
  // 搜索群成员
  getGroupMembers(groupNo: string, params: { keyword?: string; page: number; limit: number }) {
    return apiClient.get(`groups/${groupNo}/members`, { params });
  },
  // 邀请/添加成员进群
  inviteMembers(groupNo: string, members: string[]) {
    return apiClient.post(`groups/${groupNo}/members`, { members });
  },
  // 需要管理员确认的群成员邀请
  inviteMembersForApproval(groupNo: string, uids: string[], remark = '') {
    return apiClient.post(`groups/${groupNo}/member/invite`, { uids, remark });
  },
  // 获取群邀请详情
  getInviteDetail(inviteNo: string) {
    return apiClient.get(`group/invites/${inviteNo}`);
  },
  // 确认群邀请
  confirmInvite(authCode: string) {
    return apiClient.post(`group/invite/sure?auth_code=${authCode}`);
  },
  // 移除群成员
  removeMembers(groupNo: string, members: string[]) {
    return apiDelete(`groups/${groupNo}/members`, { members });
  },
  // 修改群成员属性 (群名片)
  updateMemberRemark(groupNo: string, uid: string, remark: string) {
    return apiClient.put(`groups/${groupNo}/members/${uid}`, { remark });
  },
  // 修改群设置 (置顶/免打扰/进群确认等)
  updateSetting(groupNo: string, data: any) {
    return apiClient.put(`groups/${groupNo}/setting`, data);
  },
  // 上传群头像
  uploadAvatar(groupNo: string, formData: FormData) {
    return apiClient.post(`groups/${groupNo}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // 修改群基础信息 (群名、公告)
  updateGroupInfo(groupNo: string, data: { name?: string; notice?: string }) {
    return apiClient.put(`groups/${groupNo}`, data);
  },
  // 任免群管理员
  appointManager(groupNo: string, uids: string[]) {
    return apiClient.post(`groups/${groupNo}/managers`, uids);
  },
  removeManager(groupNo: string, uids: string[]) {
    return apiDelete(`groups/${groupNo}/managers`, uids);
  },
  // 群主转让
  transferOwner(groupNo: string, toUid: string) {
    return apiClient.post(`groups/${groupNo}/transfer/${toUid}`);
  },
  // 获取群二维码
  getGroupQRCode(groupNo: string) {
    return apiClient.get(`groups/${groupNo}/qrcode`);
  },
  // 扫码入群
  scanJoinGroup(groupNo: string, authCode: string) {
    return apiClient.get(`groups/${groupNo}/scanjoin?auth_code=${authCode}`);
  },
  // 退群
  exitGroup(groupNo: string) {
    return apiClient.post(`groups/${groupNo}/exit`);
  },
  // 解散群
  disbandGroup(groupNo: string) {
    return apiDelete(`groups/${groupNo}/disband`);
  },
  // 全员禁言/解除
  muteAll(groupNo: string, on: number) {
    return apiClient.post(`groups/${groupNo}/forbidden/${on}`);
  },
  // 个别成员禁言/解禁
  muteMember(groupNo: string, data: { member_uid: string; action: number; key: number }) {
    return apiClient.post(`groups/${groupNo}/forbidden_with_member`, data);
  },
  // 添加或移除群黑名单
  blacklistMember(groupNo: string, action: 0 | 1, uids: string[]) {
    return apiClient.post(`groups/${groupNo}/blacklist/${action}`, { uids });
  }
};

// 5. 最近会话与消息增量同步 API (Sync Engine)
export const syncApi = {
  // 同步最近会话列表
  syncConversations(data: { msg_count: number }) {
    return apiClient.post('conversation/sync', data);
  },
  // 确认最近会话同步
  ackConversations() {
    return apiClient.post('conversation/syncack');
  },
  // 增量拉取最近会话扩展属性 (草稿置顶等)
  syncConversationExtra(data: { version: number }) {
    return apiClient.post('conversation/extra/sync', data);
  },
  // 更新最近会话扩展属性 (草稿置顶等，后端为 POST 方法)
  updateConversationExtra(
    channelIdOrData: string | { channel_id: string; channel_type: number; browse_to?: number; keep_message_seq?: number; keep_offset_y?: number; draft?: string; top?: number; mute?: number },
    channelType?: number,
    data?: { draft?: string; browse_to?: number; keep_message_seq?: number; keep_offset_y?: number; top?: number; mute?: number }
  ) {
    if (typeof channelIdOrData === 'object') {
      return apiClient.post(`conversations/${channelIdOrData.channel_id}/${channelIdOrData.channel_type}/extra`, channelIdOrData);
    }
    return apiClient.post(`conversations/${channelIdOrData}/${channelType}/extra`, data || {});
  },
  // 删除最近会话
  deleteConversation(channelId: string, channelType: number) {
    return apiDelete(`conversations/${channelId}/${channelType}`);
  },
  // 消息通道增量同步
  syncMessages(data: { channel_id: string; channel_type: number; limit: number; start_message_seq: number; end_message_seq: number; pull_mode: number; device_uuid?: string }) {
    return apiClient.post('message/channel/sync', data);
  },
  // 撤销消息
  revokeMessage(params: { channel_id: string; channel_type: number; message_id: string; client_msg_no: string }) {
    return apiClient.post('message/revoke', null, { params });
  },
  // 编辑消息
  editMessage(data: { channel_id: string; channel_type: number; message_id: string; message_seq: number; content_edit: string }) {
    return apiClient.post('message/edit', data);
  },
  // 本地删除消息
  deleteMessage(data: Array<{ channel_id: string; channel_type: number; message_id: string; message_seq: number }>) {
    return apiDelete('message', data);
  },
  // 双向删除消息
  mutualDeleteMessage(data: { channel_id: string; channel_type: number; message_id: string; message_seq: number }) {
    return apiDelete('message/mutual', data);
  },
  // 消息标记已读
  markReaded(data: { channel_id: string; channel_type: number; message_ids: string[] }) {
    return apiClient.post('message/readed', data);
  },
  // 消息回执详情
  getMessageReceipt(messageId: string, readed?: 0 | 1) {
    const params = readed === undefined ? undefined : { readed };
    return apiClient.get(`messages/${messageId}/receipt`, { params });
  },
  // 清除未读计数 (typo 拼写 coversation 保持一致，与后端路由匹配)
  clearUnread(channelId: string, channelType: number, messageSeq = 0) {
    return apiClient.put('coversation/clearUnread', {
      channel_id: channelId,
      channel_type: channelType,
      unread: 0,
      message_seq: messageSeq
    });
  },
  // 消息回应/表态
  addReaction(data: { channel_id: string; channel_type: number; message_id: string; emoji: string }) {
    return apiClient.post('reactions', data);
  },
  // 增量同步消息回应
  syncReactions(data: { channel_id: string; channel_type: number; version: number }) {
    return apiClient.post('reaction/sync', data);
  },
  // 置顶或取消置顶消息
  pinMessage(data: { channel_id: string; channel_type: number; message_id: string; message_seq: number }) {
    return apiClient.post('message/pinned', data);
  },
  // 增量同步置顶消息
  syncPinnedMessages(data: { channel_id: string; channel_type: number; version: number }) {
    return apiClient.post('message/pinned/sync', data);
  },
  // 清空置顶消息
  clearPinnedMessages(data: { channel_id: string; channel_type: number }) {
    return apiClient.post('message/pinned/clear', data);
  },
  // 同步提醒
  syncReminders(data: { version: number; limit: number; channel_ids?: string[] }) {
    return apiClient.post('message/reminder/sync', data);
  },
  // 完成提醒
  doneReminders(ids: number[]) {
    return apiClient.post('message/reminder/done', ids);
  }
};

// 6. 频道、文件、搜索与通用配置 API (Channel, File, Search & Common)
export const commonApi = {
  // 获取频道状态 (单聊在线，呼叫等)
  getChannelState(channelId: string, channelType: number) {
    return apiClient.get(`channel/state?channel_id=${channelId}&channel_type=${channelType}`);
  },
  // 获取频道详情 (资料状态等)
  getChannelInfo(channelId: string, channelType: number) {
    return apiClient.get(`channels/${channelId}/${channelType}`);
  },
  // 获取上传路径
  getUploadUrl(path: string, type: string) {
    return apiClient.get(`file/upload?path=${path}&type=${type}`);
  },
  // 上传文件
  uploadFile(url: string, formData: FormData) {
    return apiClient.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // 全局搜索
  globalSearch(data: any) {
    return apiClient.post('search/global', data);
  },
  // 举报用户、群组或消息
  submitReport(data: any) {
    return apiClient.post('reports', data);
  },
  // 机器人菜单或快捷指令
  getRobotMenus(channelId: string, channelType: number) {
    return apiClient.post('robot/sync', [{
      robot_id: channelId,
      version: 0
    }]);
  },
  requestAiReply(data: {
    channel_id: string;
    channel_type: number;
    prompt: string;
    system_prompt?: string;
    model?: string;
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }) {
    return apiClient.post('robot/ai_reply', data, { timeout: 45000 });
  },
  async requestAiReplyStream(
    data: {
      channel_id: string;
      channel_type: number;
      prompt: string;
      system_prompt?: string;
      model?: string;
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      stream?: boolean;
    },
    handlers: {
      onDelta?: (delta: string) => void;
      onDone?: (event: AiStreamEvent) => void;
      onError?: (message: string) => void;
      signal?: AbortSignal;
    } = {}
  ) {
    const token = StorageService.get('token');
    const url = `${String(apiClient.defaults?.baseURL || '/v1/').replace(/\/$/, '')}/robot/ai_reply`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { token } : {})
      },
      body: JSON.stringify({ ...data, stream: true }),
      signal: handlers.signal
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw {
        msg: payload?.msg || `AI 助手暂不可用 (${response.status})`,
        status: response.status
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalEvent: AiStreamEvent = {};

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const event = parseAiStreamLine(line);
        if (!event) continue;
        if (event.error) {
          handlers.onError?.(event.error);
          throw { msg: event.error };
        }
        if (event.delta) {
          handlers.onDelta?.(event.delta);
        }
        if (event.done) {
          finalEvent = event;
          handlers.onDone?.(event);
        }
      }
    }

    const tail = parseAiStreamLine(buffer);
    if (tail?.delta) handlers.onDelta?.(tail.delta);
    if (tail?.done) {
      finalEvent = tail;
      handlers.onDone?.(tail);
    }
    return finalEvent;
  }
};

export function resolveApiAssetUrl(pathOrUrl: string, referenceUrl?: string) {
  return normalizeMediaUrl(pathOrUrl, {
    baseUrl: String(apiClient.defaults?.baseURL || '/'),
    referenceUrl
  });
}

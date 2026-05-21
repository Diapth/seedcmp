import { apiClient, apiDelete } from '@tsdaodao/base-vue';
// 1. 身份认证与登录设备管理 API (Auth & Device)
export const authApi = {
    // 手机号验证码/密码登录
    login(data) {
        return apiClient.post('user/login', data);
    },
    // 获取短信验证码 (注册)
    getRegisterSmsCode(phone) {
        return apiClient.post('user/sms/registercode', { phone });
    },
    // 获取短信验证码 (忘记密码)
    getForgetPwdSmsCode(phone) {
        return apiClient.post('user/sms/forgetpwd', { phone });
    },
    // 获取扫码登录 UUID
    getLoginUUID() {
        return apiClient.get('user/loginuuid');
    },
    // 轮询扫码登录状态
    getLoginStatus(uuid) {
        return apiClient.get(`user/loginstatus?uuid=${uuid}`);
    },
    // 扫码授权码登录
    loginWithAuthCode(authCode) {
        return apiClient.post(`user/login_authcode/${authCode}`);
    },
    // 获取当前在线设备
    getDevices() {
        return apiClient.get('user/devices');
    },
    // 强退指定设备
    deleteDevice(deviceId) {
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
    getUserInfo(uid, groupNo) {
        const url = groupNo ? `users/${uid}?group_no=${groupNo}` : `users/${uid}`;
        return apiClient.get(url);
    },
    // 修改个人资料
    updateProfile(data) {
        return apiClient.put('user/current', data);
    },
    // 个人头像上传
    uploadAvatar(uid, formData) {
        return apiClient.post(`users/${uid}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    // 获取 IM 节点通讯凭证
    getImCredentials(uid) {
        return apiClient.get(`users/${uid}/im`);
    },
    // 获取红点提示
    getReddot(category) {
        return apiClient.get(`user/reddot/${category}`);
    },
    // 清除红点未读
    deleteReddot(category) {
        return apiDelete(`user/reddot/${category}`);
    }
};
// 3. 好友与联系人 API (Friend Relationship)
export const friendApi = {
    // 增量同步好友名册
    syncFriends(params) {
        return apiClient.get('friend/sync', { params });
    },
    // 发起好友申请
    applyFriend(data) {
        return apiClient.post('friend/apply', data);
    },
    // 同意好友申请
    approveFriend(token) {
        return apiClient.post('friend/sure', { token });
    },
    // 修改好友备注名
    updateRemark(data) {
        return apiClient.put('friend/remark', data);
    },
    // 删除好友
    deleteFriend(uid) {
        return apiDelete(`friends/${uid}`);
    },
    // 搜索用户
    searchUser(keyword) {
        return apiClient.get('user/search', { params: { keyword } });
    },
    // 获取黑名单列表
    getBlacklist() {
        return apiClient.get('user/blacklists');
    },
    // 拉黑好友
    addBlacklist(uid) {
        return apiClient.post(`user/blacklist/${uid}`);
    },
    // 解除黑名单
    removeBlacklist(uid) {
        return apiDelete(`user/blacklist/${uid}`);
    }
};
// 4. 群组管理 API (Group Administration)
export const groupApi = {
    // 建群
    createGroup(data) {
        return apiClient.post('group/create', data);
    },
    // 获取我保存的群聊列表
    getMyGroups() {
        return apiClient.get('group/my');
    },
    // 获取群详情
    getGroupInfo(groupNo) {
        return apiClient.get(`groups/${groupNo}`);
    },
    // 增量同步群成员
    syncGroupMembers(groupNo, params) {
        return apiClient.get(`groups/${groupNo}/membersync`, { params });
    },
    // 搜索群成员
    getGroupMembers(groupNo, params) {
        return apiClient.get(`groups/${groupNo}/members`, { params });
    },
    // 邀请/添加成员进群
    inviteMembers(groupNo, members) {
        return apiClient.post(`groups/${groupNo}/members`, { members });
    },
    // 移除群成员
    removeMembers(groupNo, members) {
        return apiDelete(`groups/${groupNo}/members`, { members });
    },
    // 修改群成员属性 (群名片)
    updateMemberRemark(groupNo, uid, remark) {
        return apiClient.put(`groups/${groupNo}/members/${uid}`, { remark });
    },
    // 修改群设置 (置顶/免打扰/进群确认等)
    updateSetting(groupNo, data) {
        return apiClient.put(`groups/${groupNo}/setting`, data);
    },
    // 修改群基础信息 (群名、公告)
    updateGroupInfo(groupNo, data) {
        return apiClient.put(`groups/${groupNo}`, data);
    },
    // 任免群管理员
    appointManager(groupNo, uids) {
        return apiClient.post(`groups/${groupNo}/managers`, uids);
    },
    removeManager(groupNo, uids) {
        return apiDelete(`groups/${groupNo}/managers`, uids);
    },
    // 群主转让
    transferOwner(groupNo, toUid) {
        return apiClient.post(`groups/${groupNo}/transfer/${toUid}`);
    },
    // 退群
    exitGroup(groupNo) {
        return apiClient.post(`groups/${groupNo}/exit`);
    },
    // 解散群
    disbandGroup(groupNo) {
        return apiDelete(`groups/${groupNo}/disband`);
    },
    // 全员禁言/解除
    muteAll(groupNo, on) {
        return apiClient.post(`groups/${groupNo}/forbidden/${on}`);
    },
    // 个别成员禁言/解禁
    muteMember(groupNo, data) {
        return apiClient.post(`groups/${groupNo}/forbidden_with_member`, data);
    }
};
// 5. 最近会话与消息增量同步 API (Sync Engine)
export const syncApi = {
    // 同步最近会话列表
    syncConversations(data) {
        return apiClient.post('conversation/sync', data);
    },
    // 确认最近会话同步
    ackConversations() {
        return apiClient.post('conversation/syncack');
    },
    // 增量拉取最近会话扩展属性 (草稿置顶等)
    syncConversationExtra(data) {
        return apiClient.post('conversation/extra/sync', data);
    },
    // 更新最近会话扩展属性 (草稿置顶等)
    updateConversationExtra(channelId, channelType, data) {
        return apiClient.post(`conversations/${channelId}/${channelType}/extra`, data);
    },
    // 删除最近会话
    deleteConversation(channelId, channelType) {
        return apiDelete(`conversations/${channelId}/${channelType}`);
    },
    // 消息通道增量同步
    syncMessages(data) {
        return apiClient.post('message/channel/sync', data);
    },
    // 撤销消息
    revokeMessage(params) {
        return apiClient.post('message/revoke', null, { params });
    },
    // 消息标记已读
    markReaded(data) {
        return apiClient.post('message/readed', data);
    },
    // 清除未读计数 (typo 拼写 coversation 保持一致)
    clearUnread(channelId, channelType) {
        return apiClient.put('coversation/clearUnread', { channel_id: channelId, channel_type: channelType });
    },
    // 消息回应/表态
    addReaction(data) {
        return apiClient.post('reactions', data);
    },
    // 增量同步消息回应
    syncReactions(data) {
        return apiClient.post('reaction/sync', data);
    }
};
// 6. 频道、文件、搜索与通用配置 API (Channel, File, Search & Common)
export const commonApi = {
    // 获取频道状态 (单聊在线，呼叫等)
    getChannelState(channelId, channelType) {
        return apiClient.get(`channel/state?channel_id=${channelId}&channel_type=${channelType}`);
    },
    // 获取频道详情 (资料状态等)
    getChannelInfo(channelId, channelType) {
        return apiClient.get(`channels/${channelId}/${channelType}`);
    },
    // 获取上传路径
    getUploadUrl(path, type) {
        return apiClient.get(`file/upload?path=${path}&type=${type}`);
    },
    // 上传文件
    uploadFile(url, formData) {
        return apiClient.post(url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    // 全局搜索
    globalSearch(data) {
        return apiClient.post('search/global', data);
    }
};

import { useSettingsStore } from '@/stores/settings';
import { storage } from '@/utils/storage.js';

const PERMISSION_STORAGE_KEY = 'notification_permission_status';

function setPermissionStatus(status) {
  const settingsStore = useSettingsStore();
  settingsStore.updateNotificationSettings({ permissionStatus: status });
  storage.set(PERMISSION_STORAGE_KEY, status);
}

function getStoredPermissionStatus() {
  return storage.get(PERMISSION_STORAGE_KEY) || 'default';
}

function openConversationFromNotification(conversationId) {
  if (!conversationId) return;
  storage.set('active_conversation_id', conversationId);

  let isDesktop = false;
  try {
    isDesktop = uni.getSystemInfoSync().windowWidth >= 768;
  } catch (e) {
    isDesktop = false;
  }

  const url = isDesktop
    ? '/pages/chat/index'
    : `/pages/chat/detail?id=${encodeURIComponent(conversationId)}`;

  uni.redirectTo({
    url,
    fail: () => uni.navigateTo({ url })
  });
}

function normalizeNotificationPayload(rawPayload) {
  if (!rawPayload) return {};
  if (typeof rawPayload === 'string') {
    try {
      return JSON.parse(rawPayload);
    } catch (e) {
      return {};
    }
  }
  return rawPayload;
}

function formatMessagePreview(message) {
  if (!message) return '收到一条新消息';
  if (message.type === 'image') return '[图片]';
  if (message.type === 'voice') return '[语音]';
  if (message.type === 'file') return `[文件] ${message.fileName || message.name || message.content || ''}`.trim();
  return String(message.content || '收到一条新消息').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength = 80) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function buildMessageNotification(conversation, message, showPreview) {
  const senderName = message?.senderName || conversation?.name || '新消息';
  const title = conversation?.type === 'group'
    ? `${conversation.name} · ${senderName}`
    : senderName;
  const preview = showPreview ? formatMessagePreview(message) : '收到一条新消息';
  return {
    title,
    body: truncateText(preview),
    payload: {
      conversationId: conversation?.id || '',
      messageId: message?.id || '',
      senderId: message?.senderId || ''
    }
  };
}

function shouldSkipForegroundNotification(force) {
  // #ifdef H5
  if (!force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return true;
  }
  // #endif
  return false;
}

export function getNotificationPermissionState() {
  // #ifdef H5
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
  // #endif

  // #ifdef APP-PLUS
  return getStoredPermissionStatus();
  // #endif

  return 'unsupported';
}

export async function requestNotificationPermission() {
  // #ifdef H5
  if (typeof window === 'undefined' || !('Notification' in window)) {
    setPermissionStatus('unsupported');
    return { status: 'unsupported' };
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    setPermissionStatus(Notification.permission);
    return { status: Notification.permission };
  }

  const permission = await Notification.requestPermission();
  setPermissionStatus(permission);
  return { status: permission };
  // #endif

  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    try {
      if (typeof plus === 'undefined' || !plus.push) {
        setPermissionStatus('unsupported');
        resolve({ status: 'unsupported' });
        return;
      }

      if (plus.os?.name === 'Android' && plus.android?.requestPermissions) {
        plus.android.requestPermissions(
          ['android.permission.POST_NOTIFICATIONS'],
          (event) => {
            const deniedAlways = event.deniedAlways || [];
            const deniedPresent = event.deniedPresent || [];
            const status = deniedAlways.length || deniedPresent.length ? 'denied' : 'granted';
            setPermissionStatus(status);
            resolve({ status });
          },
          () => {
            setPermissionStatus('granted');
            resolve({ status: 'granted' });
          }
        );
        return;
      }

      setPermissionStatus('granted');
      resolve({ status: 'granted' });
    } catch (e) {
      setPermissionStatus('unsupported');
      resolve({ status: 'unsupported' });
    }
  });
  // #endif

  setPermissionStatus('unsupported');
  return { status: 'unsupported' };
}

export function notifyMessage({ conversation, message, force = false }) {
  const settingsStore = useSettingsStore();
  const settings = settingsStore.notificationSettings;

  if (!settings.enableSystemNotifications || settings.doNotDisturb) return false;
  if (!conversation || !message || message.senderId === 'me') return false;
  if (shouldSkipForegroundNotification(force)) return false;

  const notification = buildMessageNotification(conversation, message, settings.showPreview);

  // #ifdef H5
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const browserNotification = new Notification(notification.title, {
    body: notification.body,
    tag: `agenthub-${conversation.id}`,
    data: notification.payload,
    silent: !settings.enableSound
  });
  browserNotification.onclick = () => {
    window.focus();
    openConversationFromNotification(notification.payload.conversationId);
    browserNotification.close();
  };
  return true;
  // #endif

  // #ifdef APP-PLUS
  try {
    if (typeof plus === 'undefined' || !plus.push) return false;
    plus.push.createMessage(
      notification.body,
      JSON.stringify(notification.payload),
      {
        title: notification.title,
        cover: false,
        sound: settings.enableSound ? 'system' : 'none'
      }
    );
    if (settings.enableVibrate && plus.device?.vibrate) {
      plus.device.vibrate(200);
    }
    return true;
  } catch (e) {
    return false;
  }
  // #endif

  return false;
}

export function initSystemNotificationClickHandler() {
  // #ifdef APP-PLUS
  if (typeof plus === 'undefined' || !plus.push) return;
  plus.push.addEventListener('click', (message) => {
    const payload = normalizeNotificationPayload(message.payload);
    openConversationFromNotification(payload.conversationId);
  }, false);
  // #endif
}

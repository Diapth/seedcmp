import { normalizeTimestampMs } from './formatMessage.js';

export function formatConversationPreview(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTime(timestamp) {
  if (!timestamp) return '';
  const normalized = normalizeTimestampMs(timestamp);
  if (!normalized) return '';
  const date = new Date(normalized);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 3600 * 1000;
  
  if (normalized >= today) {
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  } else if (normalized >= yesterday) {
    return '昨天';
  } else if (now.getTime() - normalized < 7 * 24 * 3600 * 1000) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[date.getDay()];
  } else {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function formatUnread(unreadCount) {
  if (unreadCount > 99) return '99+';
  return String(unreadCount);
}

export default {
  formatConversationPreview,
  formatTime,
  formatUnread
};

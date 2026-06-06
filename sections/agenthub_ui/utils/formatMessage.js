export function getMessageSummary(msg) {
  if (!msg) return '';
  switch (msg.type) {
    case 'text':
      return msg.content;
    case 'image':
      return '[图片]';
    case 'file':
      return '[文件]';
    case 'voice':
      return '[语音]';
    case 'system':
      return msg.content;
    default:
      return '[消息]';
  }
}

const THREE_MINUTES = 3 * 60 * 1000;
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function padTime(value) {
  return String(value).padStart(2, '0');
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date) {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

export function formatChatTime(timestamp, nowValue = Date.now()) {
  if (!timestamp) return '';

  const timeValue = Number(timestamp);
  if (Number.isNaN(timeValue)) return '';

  const date = new Date(timeValue);
  const now = new Date(nowValue);
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = startOfWeek(now);
  const clock = `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;

  if (date >= today) {
    return clock;
  }

  if (date >= yesterday) {
    return `昨天 ${clock}`;
  }

  if (date >= weekStart) {
    return `${WEEKDAY_LABELS[date.getDay()]} ${clock}`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
}

export function shouldShowMessageTime(current, previous, threshold = THREE_MINUTES) {
  const currentTime = Number(current?.time || 0);
  if (!currentTime) return false;

  const previousTime = Number(previous?.time || 0);
  if (!previousTime) return true;

  return currentTime - previousTime > threshold;
}

export default {
  getMessageSummary,
  formatChatTime,
  shouldShowMessageTime
};

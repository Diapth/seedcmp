export interface DigestPresentation {
  mentionReminder: string;
  senderName: string;
  text: string;
}

export function normalizeMessageTimestamp(message: any): number {
  return Number(message?.timestamp || message?.message_timestamp || message?.messageTimestamp || message?.time || 0);
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatHourMinute(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatConversationTime(timestamp: number, nowDate = new Date()): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const dayDiff = Math.floor((startOfDay(nowDate) - startOfDay(date)) / 86400000);

  if (dayDiff === 0) {
    return formatHourMinute(date);
  }
  if (dayDiff === 1) {
    return `昨天 ${formatHourMinute(date)}`;
  }
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    return `${weekday} ${formatHourMinute(date)}`;
  }
  if (date.getFullYear() === nowDate.getFullYear()) {
    return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  }
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

export function buildDigestPresentation(options: {
  channelType: number;
  isSystem: boolean;
  senderName: string;
  mentionReminder?: string;
  text: string;
}): DigestPresentation {
  if (Number(options.channelType) !== 2 || options.isSystem) {
    return {
      mentionReminder: '',
      senderName: '',
      text: options.text
    };
  }

  return {
    mentionReminder: options.mentionReminder || '',
    senderName: options.senderName || '',
    text: options.text
  };
}

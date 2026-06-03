import { weddingInviteContent, type WeddingInviteContent } from './content';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
}

export type CountdownState =
  | { kind: 'loading'; label: string }
  | { kind: 'error'; label: string }
  | { kind: 'celebration'; label: string }
  | { kind: 'live'; label: string; parts: CountdownParts };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatEventDate(eventIso: string, timeZoneId: string): string {
  const date = new Date(eventIso);
  if (Number.isNaN(date.getTime())) {
    return '日期待确认';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: timeZoneId,
  }).format(date);
}

export function formatEventTime(eventIso: string, timeZoneId: string): string {
  const date = new Date(eventIso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZoneId,
  }).format(date);
}

export function getCountdownState(nowMs: number | null, eventIso: string): CountdownState {
  if (nowMs === null) {
    return { kind: 'loading', label: '倒计时加载中' };
  }

  const targetMs = new Date(eventIso).getTime();
  if (Number.isNaN(targetMs)) {
    return { kind: 'error', label: '婚礼日期配置无效，请检查时间字段。' };
  }

  const diff = targetMs - nowMs;
  if (diff <= 0) {
    return { kind: 'celebration', label: '今天就是婚礼日，欢迎直接前往仪式现场。' };
  }

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diff % HOUR_MS) / MINUTE_MS);

  return {
    kind: 'live',
    label: '距离婚礼开始还有',
    parts: { days, hours, minutes },
  };
}

function padIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildCalendarHref(content: WeddingInviteContent = weddingInviteContent): string {
  const start = new Date(content.event.isoStart);
  const end = new Date(content.event.isoEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '#';
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clowder AI//Wedding Invite Showcase//CN',
    'BEGIN:VEVENT',
    `UID:wedding-invite-showcase@clowder.ai`,
    `DTSTAMP:${padIcsDate(new Date('2026-06-03T00:00:00Z'))}`,
    `DTSTART:${padIcsDate(start)}`,
    `DTEND:${padIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(`${content.couple.display} Wedding`)}`,
    `LOCATION:${escapeIcsText(`${content.event.venue}, ${content.event.city}`)}`,
    `DESCRIPTION:${escapeIcsText(content.overview)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

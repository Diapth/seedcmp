import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WeddingInviteShowcase } from '../WeddingInviteShowcase';
import { weddingInviteContent } from '../content';
import { buildCalendarHref, formatEventDate, formatEventTime, getCountdownState } from '../helpers';

describe('Wedding invite showcase', () => {
  it('renders key wedding sections and explicit placeholder states', () => {
    const html = renderToStaticMarkup(<WeddingInviteShowcase />);

    expect(html).toContain('Nuo &amp; Chuan');
    expect(html).toContain(weddingInviteContent.couple.native);
    expect(html).toContain('主视觉照片待替换');
    expect(html).toContain('RSVP 表单待接入');
    expect(html).toContain(weddingInviteContent.event.address);
  });

  it('keeps countdown state explicit across loading, live, and celebration phases', () => {
    expect(getCountdownState(null, weddingInviteContent.event.isoStart)).toEqual({
      kind: 'loading',
      label: '倒计时加载中',
    });

    expect(
      getCountdownState(new Date('2026-10-17T14:30:00+08:00').getTime(), weddingInviteContent.event.isoStart),
    ).toEqual({
      kind: 'live',
      label: '距离婚礼开始还有',
      parts: { days: 1, hours: 1, minutes: 0 },
    });

    expect(
      getCountdownState(new Date('2026-10-18T16:00:00+08:00').getTime(), weddingInviteContent.event.isoStart),
    ).toEqual({
      kind: 'celebration',
      label: '今天就是婚礼日，欢迎直接前往仪式现场。',
    });
  });

  it('formats event date and time in the configured wedding timezone', () => {
    expect(formatEventDate(weddingInviteContent.event.isoStart, weddingInviteContent.event.timeZoneId)).toBe(
      '2026年10月18日星期日',
    );
    expect(formatEventTime(weddingInviteContent.event.isoStart, weddingInviteContent.event.timeZoneId)).toBe('15:30');
  });

  it('builds a downloadable calendar payload instead of a dead CTA', () => {
    const href = buildCalendarHref();

    expect(href.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(href).toContain('BEGIN%3AVCALENDAR');
    expect(href).toContain('SUMMARY%3ANuo%20%26%20Chuan%20Wedding');
  });
});

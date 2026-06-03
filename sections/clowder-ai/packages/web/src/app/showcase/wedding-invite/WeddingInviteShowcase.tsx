'use client';

import localFont from 'next/font/local';
import { useEffect, useState, type CSSProperties } from 'react';
import { weddingInviteContent } from './content';
import { buildCalendarHref, formatEventDate, formatEventTime, getCountdownState } from './helpers';
import styles from './wedding-invite.module.css';

const fraunces = localFont({ src: '../../../fonts/Fraunces-Medium.woff2', weight: '500', display: 'swap' });
const plusJakartaSans = localFont({
  src: '../../../fonts/PlusJakartaSans-Variable.woff2',
  weight: '400 700',
  display: 'swap',
});

const calendarHref = buildCalendarHref(weddingInviteContent);
const eventDateLabel = formatEventDate(weddingInviteContent.event.isoStart, weddingInviteContent.event.timeZoneId);
const eventTimeLabel = formatEventTime(weddingInviteContent.event.isoStart, weddingInviteContent.event.timeZoneId);
const pageStyle = {
  '--wedding-display-font': fraunces.style.fontFamily,
  '--wedding-body-font': plusJakartaSans.style.fontFamily,
} as CSSProperties;

type CopyState = 'idle' | 'copied' | 'unsupported';

export function WeddingInviteShowcase() {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (copyState !== 'copied') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, 2_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  const countdown = getCountdownState(nowMs, weddingInviteContent.event.isoStart);
  const copyFeedback =
    copyState === 'copied'
      ? '地址已复制，可直接发给宾客。'
      : copyState === 'unsupported'
        ? '当前环境不支持自动复制，请手动复制下方地址。'
        : '可直接复制下方地址，后续替换为真实导航地址。';

  async function handleCopyAddress() {
    if (!navigator.clipboard?.writeText) {
      setCopyState('unsupported');
      return;
    }

    try {
      await navigator.clipboard.writeText(weddingInviteContent.event.address);
      setCopyState('copied');
    } catch {
      setCopyState('unsupported');
    }
  }

  return (
    <main className={styles.page} style={pageStyle}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>{weddingInviteContent.label}</span>
          <p className={styles.overline}>
            {eventDateLabel} · {eventTimeLabel} · {weddingInviteContent.event.timezone}
          </p>
          <h1 className={styles.heroTitle}>{weddingInviteContent.couple.display}</h1>
          <p className={styles.heroNative}>{weddingInviteContent.couple.native}</p>
          <p className={styles.heroSummary}>{weddingInviteContent.overview}</p>

          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href={calendarHref} download="wedding-invite-showcase.ics">
              下载日历提醒
            </a>
            {weddingInviteContent.event.mapUrl ? (
              <a
                className={styles.secondaryAction}
                href={weddingInviteContent.event.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                打开地图
              </a>
            ) : (
              <span className={styles.secondaryActionMuted} aria-disabled="true">
                地图链接待补充
              </span>
            )}
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.photoCard}>
            <span className={styles.photoBadge}>主视觉照片待替换</span>
            <div className={styles.monogram}>{weddingInviteContent.couple.monogram}</div>
            <p className={styles.photoHint}>建议替换为一张竖版双人照，首屏氛围会立刻成立。</p>
          </div>

          <div className={styles.countdownCard} aria-live="polite">
            <span className={styles.cardEyebrow}>Countdown</span>
            <h2 className={styles.cardTitle}>{weddingInviteContent.theme}</h2>

            {countdown.kind === 'loading' && <p className={styles.cardBody}>{countdown.label}</p>}
            {countdown.kind === 'error' && <p className={styles.cardBody}>{countdown.label}</p>}
            {countdown.kind === 'celebration' && <p className={styles.cardBody}>{countdown.label}</p>}
            {countdown.kind === 'live' && (
              <>
                <p className={styles.cardBody}>{countdown.label}</p>
                <div className={styles.countdownGrid}>
                  <div className={styles.countdownUnit}>
                    <strong>{countdown.parts.days}</strong>
                    <span>天</span>
                  </div>
                  <div className={styles.countdownUnit}>
                    <strong>{countdown.parts.hours}</strong>
                    <span>小时</span>
                  </div>
                  <div className={styles.countdownUnit}>
                    <strong>{countdown.parts.minutes}</strong>
                    <span>分钟</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className={styles.infoGrid} aria-label="婚礼信息">
        <article className={styles.infoCard}>
          <span className={styles.cardEyebrow}>When</span>
          <h2 className={styles.infoTitle}>{eventDateLabel}</h2>
          <p className={styles.infoBody}>{weddingInviteContent.event.arrival}</p>
        </article>
        <article className={styles.infoCard}>
          <span className={styles.cardEyebrow}>Where</span>
          <h2 className={styles.infoTitle}>
            {weddingInviteContent.event.venue} · {weddingInviteContent.event.city}
          </h2>
          <p className={styles.infoBody}>{weddingInviteContent.event.venueNote}</p>
        </article>
        <article className={styles.infoCard}>
          <span className={styles.cardEyebrow}>Dress Code</span>
          <h2 className={styles.infoTitle}>Garden Formal</h2>
          <p className={styles.infoBody}>{weddingInviteContent.event.dressCode}</p>
        </article>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Flow of the day</span>
          <h2 className={styles.sectionTitle}>婚礼流程</h2>
        </div>
        <ol className={styles.timeline}>
          {weddingInviteContent.schedule.map((item) => (
            <li key={`${item.time}-${item.title}`} className={styles.timelineItem}>
              <span className={styles.timelineTime}>{item.time}</span>
              <div className={styles.timelineContent}>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Our story</span>
          <h2 className={styles.sectionTitle}>我们的故事</h2>
        </div>
        <div className={styles.storyGrid}>
          {weddingInviteContent.story.map((item) => (
            <article key={item.year} className={styles.storyCard}>
              <span className={styles.storyYear}>{item.year}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Gallery status</span>
          <h2 className={styles.sectionTitle}>相册准备度</h2>
        </div>
        <div className={styles.galleryGrid}>
          {weddingInviteContent.gallery.map((item) => (
            <article key={item.title} className={styles.galleryCard}>
              <span className={styles.photoBadge}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.supportGrid}>
        <article className={styles.supportCard}>
          <div className={styles.sectionHeadingCompact}>
            <span className={styles.kicker}>Travel notes</span>
            <h2 className={styles.sectionTitle}>到场指引</h2>
          </div>
          <ul className={styles.noteList}>
            {weddingInviteContent.travel.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.tertiaryAction} onClick={handleCopyAddress}>
            复制示例地址
          </button>
          <p className={styles.inlineFeedback} aria-live="polite">
            {copyFeedback}
          </p>
          <p className={styles.inlineAddress}>{weddingInviteContent.event.address}</p>
        </article>

        <article className={styles.supportCard} id="rsvp">
          <div className={styles.sectionHeadingCompact}>
            <span className={styles.kicker}>RSVP</span>
            <h2 className={styles.sectionTitle}>宾客回执</h2>
          </div>
          <p className={styles.supportLead}>请在 {weddingInviteContent.rsvp.deadline} 前确认是否出席与同行人数。</p>
          {weddingInviteContent.rsvp.formUrl ? (
            <a
              className={styles.primaryAction}
              href={weddingInviteContent.rsvp.formUrl}
              target="_blank"
              rel="noreferrer"
            >
              填写 RSVP
            </a>
          ) : (
            <div className={styles.emptyState}>
              <strong>RSVP 表单待接入</strong>
              <p>{weddingInviteContent.rsvp.note}</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Swap checklist</span>
          <h2 className={styles.sectionTitle}>上线前替换清单</h2>
        </div>
        <ul className={styles.checklist}>
          {weddingInviteContent.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

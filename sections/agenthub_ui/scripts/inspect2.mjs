import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const groupItem = p.locator('text=AgentHub 产品研发群').first();
if (await groupItem.count() > 0) {
  await groupItem.click().catch(() => {});
  await p.waitForTimeout(800);
}

// Use the workbench-right but also find message bubbles
const inspect = await p.evaluate(() => {
  const out = {};
  out.workbenchRight = (() => {
    const el = document.querySelector('.workbench-right');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.x, y: r.y };
  })();
  out.messageBubbles = (() => {
    const els = document.querySelectorAll('.message-bubble');
    return Array.from(els).map(el => {
      const r = el.getBoundingClientRect();
      return {
        cls: el.className,
        w: r.width, h: r.height, x: r.x, y: r.y
      };
    });
  })();
  // Try to fire contextmenu and check
  const bubble = document.querySelector('.message-bubble.bubble-other');
  if (bubble) {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window });
    bubble.dispatchEvent(ev);
  }
  return out;
});
console.log(JSON.stringify(inspect, null, 2));
await p.waitForTimeout(400);
const ctxMenu = await p.evaluate(() => {
  const el = document.querySelector('.ctx-menu');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, x: r.x, y: r.y, items: Array.from(el.querySelectorAll('.ctx-item-text, .ctx-item')).map(i => i.textContent.trim()) };
});
console.log('Context menu:', JSON.stringify(ctxMenu, null, 2));
await b.close();

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
const result = await p.evaluate(() => {
  const findClass = (name) => {
    const els = document.querySelectorAll('*');
    const found = [];
    for (const el of els) {
      if (el.className && typeof el.className === 'string' && el.className.includes(name)) {
        const r = el.getBoundingClientRect();
        found.push({ className: el.className, w: r.width, h: r.height, x: r.x, y: r.y });
      }
    }
    return found;
  };
  return {
    workbenchRight: findClass('workbench-right'),
    rightWorkspace: findClass('right-workspace'),
    replyRef: findClass('reply-ref')
  };
});
console.log(JSON.stringify(result, null, 2));
await b.close();

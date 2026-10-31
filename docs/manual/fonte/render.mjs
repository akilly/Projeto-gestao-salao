import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file:///tmp/manual/manual.html'); await p.waitForTimeout(800);
const n = await p.locator('.page').count();
for (let i = 0; i < n; i++) await p.locator('.page').nth(i).screenshot({ path: `/tmp/manual/prev/p${String(i + 1).padStart(2, '0')}.png` });
await p.pdf({ path: '/tmp/manual/Manual-Hanne.pdf', width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
await b.close(); console.log(n);

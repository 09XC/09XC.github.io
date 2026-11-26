import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_ = process.env.TARGET || 'http://127.0.0.1:8766/index.html';
const OUT = 'C:/Users/zxc/Desktop/dumate/solo-os/.design-suite';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

// 1) 抓到真实界面的两张元素图
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: 'zh-CN' });
const page = await context.newPage();
await page.goto(URL_, { waitUntil: 'load' });
await page.click('#btnDemo');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/cap-cockpit.png`, clip: await rectOf(page, '.cockpit') });
await page.screenshot({ path: `${OUT}/cap-quote.png`, clip: await rectOf(page, '#stage-2 .module') });
await page.screenshot({ path: `${OUT}/cap-table.png`, clip: await rectOf(page, '#stage-1 .module') });
await context.close();

async function rectOf(p, sel) {
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
  await p.waitForTimeout(300);
  const box = await p.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, sel);
  return { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 1440 - box.x), height: Math.min(box.height, 1000 - box.y) };
}

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(`${OUT}/${f}`).toString('base64');
const cockpit = b64('cap-cockpit.png');
const table = b64('cap-table.png');

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1280px;height:720px;background:#fff;font-family:Inter,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#0E1116;overflow:hidden;position:relative}
  .grid{position:absolute;inset:0;background-image:linear-gradient(#EDEFF3 1px,transparent 1px),linear-gradient(90deg,#EDEFF3 1px,transparent 1px);background-size:64px 64px;opacity:.5}
  .fade{position:absolute;inset:0;background:linear-gradient(90deg,#fff 30%,rgba(255,255,255,.86) 52%,rgba(255,255,255,.35))}
  .in{position:relative;height:100%;padding:46px 54px;display:grid;grid-template-columns:596px 1fr;gap:30px}
  .left{display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:10px}
  .mark{width:30px;height:30px;border-radius:6px;background:#0E1116;position:relative}
  .mark::before{content:"";position:absolute;left:7px;bottom:7px;width:4px;height:10px;background:#fff;border-radius:1px}
  .mark::after{content:"";position:absolute;left:14px;bottom:7px;width:4px;height:16px;background:#fff;border-radius:1px}
  .brand b{font-size:20px;letter-spacing:-.01em}
  .brand span{font-size:12px;color:#5B6472;margin-left:4px}
  .eyebrow{font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.16em;color:#0E7C66;text-transform:uppercase;margin-bottom:12px}
  h1{font-size:50px;line-height:1.1;letter-spacing:-.028em;font-weight:650}
  h1 em{font-style:normal;color:#0E7C66}
  .sub{margin-top:16px;font-size:15px;line-height:1.7;color:#5B6472;max-width:36ch}
  .flow{display:flex;align-items:center;gap:10px;margin-top:22px}
  .step{display:flex;align-items:center;gap:7px;font-size:12px;color:#242A33;background:#F6F7F9;border:1px solid #E4E7EC;border-radius:999px;padding:6px 11px}
  .step i{font-style:normal;font-family:ui-monospace,Consolas,monospace;font-size:10px;color:#0E7C66;font-weight:600}
  .tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .tag{font-size:11px;color:#5B6472;border:1px dashed #D0D5DD;border-radius:6px;padding:5px 9px}
  .foot{font-size:11px;color:#7C8595;font-family:ui-monospace,Consolas,monospace;letter-spacing:.03em}
  .right{position:relative;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:10px;min-width:0}
  .card{position:relative;width:100%;max-width:522px;border:1px solid #D0D5DD;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 24px 48px -30px rgba(14,17,22,.45)}
  .card img{display:block;width:100%}
  .badge{font-size:10px;font-family:ui-monospace,Consolas,monospace;color:#0E7C66;background:#EAF4F1;border:1px solid #CFE5DF;border-radius:999px;padding:4px 9px}
</style></head><body>
  <div class="grid"></div><div class="fade"></div>
  <div class="in">
    <div class="left">
      <div>
        <div class="brand"><span class="mark"></span><b>Solo OS</b><span>一人公司经营作战室</span></div>
        <div style="height:34px"></div>
        <div class="eyebrow">OPC · One Person Company</div>
        <h1>一个人的公司，<br>也要有<em>经营系统</em></h1>
        <p class="sub">把接单、定价、排期、回款收进一张桌面：录一次，有效时薪、三档报价与应收账龄自动算出来。</p>
        <div class="flow">
          <span class="step"><i>01</i>归档</span>
          <span class="step"><i>02</i>定价</span>
          <span class="step"><i>03</i>排期</span>
          <span class="step"><i>04</i>回款</span>
        </div>
        <div class="tags"><span class="tag">真实可操作界面</span><span class="tag">零网络依赖</span><span class="tag">数据不出浏览器</span></div>
      </div>
      <div class="foot">第九届传智杯大学生数智创新与AI应用大赛 · AI 应用生成挑战赛</div>
    </div>
    <div class="right">
      <div class="badge">实时计算 · 虚构示例数据 · 真实界面截图</div>
      <div class="card"><img src="${cockpit}" alt="Solo OS 经营驾驶舱：已回款、应收未收、在办项目、有效时薪与未来八周应收"></div>
    </div>
  </div>
</body></html>`;

fs.writeFileSync(`${OUT}/cover.html`, html, 'utf8');

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, locale: 'zh-CN' });
const p2 = await ctx2.newPage();
await p2.setContent(html, { waitUntil: 'load' });
await p2.waitForTimeout(500);
await p2.screenshot({ path: `${OUT}/cover-2x.png` });
await ctx2.close();

const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'zh-CN' });
const p3 = await ctx3.newPage();
await p3.setContent(html, { waitUntil: 'load' });
await p3.waitForTimeout(400);
await p3.screenshot({ path: 'C:/Users/zxc/Desktop/dumate/solo-os/项目封面-1280x720.png' });
await ctx3.close();

await browser.close();
console.log(JSON.stringify({ ok: true, cover: `${OUT}/cover-2x.png` }));
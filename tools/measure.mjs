import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_ = process.env.TARGET || 'http://127.0.0.1:8765/index.html';
const OUT = 'C:/Users/zxc/Desktop/dumate/solo-os/.design-suite';
const VIEWPORTS = [
  { id: '320x568', width: 320, height: 568, touch: true },
  { id: '390x844', width: 390, height: 844, touch: true },
  { id: '768x1024', width: 768, height: 1024, touch: true },
  { id: '1440x1000', width: 1440, height: 1000, touch: false },
  { id: '1920x1080', width: 1920, height: 1080, touch: false },
  { id: '2560x1080', width: 2560, height: 1080, touch: false }
];
const PROBES = {
  main: '#main',
  hero_grid: '.hero-grid',
  cockpit: '.cockpit',
  project_rows: '#stage-1 .rows',
  quote_grid: '#stage-2 .quote-grid',
  plan_grid: '#stage-3 .plan-grid',
  recovery_table: '#boundaries .rt'
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const viewports = [];
const consoleIssues = [];
const extras = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: vp.touch,
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  let errors = 0;
  let warnings = 0;
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors++;
      consoleIssues.push({ viewport: vp.id, type: 'error', text: msg.text().slice(0, 300) });
    } else if (msg.type() === 'warning') {
      warnings++;
      consoleIssues.push({ viewport: vp.id, type: 'warning', text: msg.text().slice(0, 300) });
    }
  });
  page.on('pageerror', (err) => {
    errors++;
    consoleIssues.push({ viewport: vp.id, type: 'pageerror', text: String(err).slice(0, 300) });
  });

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(450);

  const m = await page.evaluate((probeSel) => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const round = (n) => Math.round(n * 10) / 10;
    const probes = {};
    Object.keys(probeSel).forEach((key) => {
      const el = document.querySelector(probeSel[key]);
      if (!el) return;
      const r = el.getBoundingClientRect();
      probes[key] = { width: round(r.width), left: round(r.left), right: round(r.right), height: round(r.height) };
    });
    const over = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) over.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 40) });
    });
    const small = [];
    document.querySelectorAll('button, a.btn').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.height > 0 && r.height < 32) small.push({ text: (b.textContent || '').trim().slice(0, 14), h: Math.round(r.height) });
    });
    const imgs = [...document.images];
    const skip = document.querySelector('a[href="#main"]');
    const firstFocusable = document.querySelector('body a, body button, body [tabindex]');
    return {
      vw,
      client_width: de.clientWidth,
      scroll_width: de.scrollWidth,
      body_scroll_width: document.body.scrollWidth,
      doc_height: de.scrollHeight,
      probes,
      over,
      small,
      image_count: imgs.length,
      loaded_images: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      skip_first: firstFocusable === skip,
      sections: [...document.querySelectorAll('[data-composition-section]')].map((s) => s.getAttribute('data-composition-section'))
    };
  }, PROBES);

  await page.screenshot({ path: `${OUT}/vp-${vp.id}.png`, fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/fold-${vp.id}.png` });

  viewports.push({
    id: vp.id,
    width: vp.width,
    height: vp.height,
    client_width: m.client_width,
    scroll_width: m.scroll_width,
    console_errors: errors,
    console_warnings: warnings,
    image_count: m.image_count,
    loaded_images: m.loaded_images,
    probes: m.probes
  });
  extras.push({ id: vp.id, over: m.over, small: m.small, skip_first: m.skip_first, sections: m.sections, doc_height: m.doc_height, body_scroll_width: m.body_scroll_width });
  await context.close();
}

await browser.close();

const ids = VIEWPORTS.map((v) => v.id);
const payload = {
  target: URL_,
  generated_at: new Date().toISOString(),
  required_viewports: VIEWPORTS.map((v) => ({ id: v.id, width: v.width, height: v.height })),
  viewports,
  probe_invariants: [
    { probe: 'main', viewports: ids, max_shrink_px: 2, min_width: 200 },
    { probe: 'cockpit', viewports: ids, max_shrink_px: 2, min_width: 200 },
    { probe: 'hero_grid', viewports: ids, max_shrink_px: 2, min_width: 200 }
  ],
  extras,
  console_issues: consoleIssues
};

fs.writeFileSync(`${OUT}/layout-geometry.json`, JSON.stringify(payload, null, 2), 'utf8');
fs.writeFileSync(`${OUT}/browser-console.json`, JSON.stringify(consoleIssues, null, 2), 'utf8');
console.log(JSON.stringify({
  over: extras.map((e) => `${e.id}:sw=${viewports.find((v) => v.id === e.id).scroll_width}/${e.id.split('x')[0]} over=${e.over.length} small=${e.small.length} skip=${e.skip_first}`),
  console: consoleIssues.length,
  sections: extras[0].sections
}, null, 1));
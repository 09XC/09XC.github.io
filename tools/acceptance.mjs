import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_ = process.env.TARGET || 'http://127.0.0.1:8765/index.html';
const OUT = 'C:/Users/zxc/Desktop/dumate/solo-os/.design-suite';
const steps = [];
const issues = [];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 240)));

function rec(id, ok, detail) {
  steps.push({ id, ok: !!ok, detail: String(detail === undefined ? '' : detail).slice(0, 400) });
  if (!ok) issues.push(id + ' :: ' + detail);
}
const money = (t) => Number(String(t).replace(/[^0-9.-]/g, '') || 0);

await page.goto(URL_, { waitUntil: 'load' });
await page.waitForTimeout(400);

// 1 首屏与结构
const first = await page.evaluate(() => {
  const vw = window.innerWidth;
  const firstFocusable = document.querySelector('body a, body button, body [tabindex]');
  const skip = document.querySelector('a[href="#main"]');
  const secs = [...document.querySelectorAll('[data-composition-section]')].map((s) => s.getAttribute('data-composition-section'));
  const h1 = document.querySelector('h1');
  const heroPanel = document.querySelector('.cockpit').getBoundingClientRect();
  return {
    vw, over: document.documentElement.scrollWidth <= vw + 1,
    skipFirst: firstFocusable === skip,
    secs, h1: h1 ? h1.textContent.replace(/\s+/g, '') : '',
    panelBottom: Math.round(heroPanel.bottom),
    hasNextHint: !!document.querySelector('.hero-next')
  };
});
rec('skip-link-first-focusable', first.skipFirst, 'body 首个可聚焦元素是 a[href="#main"]');
rec('composition-sections', first.secs.join(',') === '1,2,3,4,4,4,4,5,7', first.secs.join(','));
rec('hero-inside-first-fold', first.panelBottom <= 1000, 'cockpit 底边 ' + first.panelBottom + 'px');
rec('next-section-hint', first.hasNextHint, '首屏底部有下一节提示');

// 键盘：Tab 到跳转链接
await page.keyboard.press('Tab');
const focusId = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'));
rec('keyboard-focus-skip-link', focusId === '#main', 'Tab 后焦点 href=' + focusId);

// 2 空状态
const emptyState = await page.evaluate(() => {
  const list = document.querySelector('#projectList .empty');
  const chartEmpty = document.querySelector('#chartEmpty');
  return { listEmpty: !!list, chartEmptyShown: chartEmpty ? !chartEmpty.hidden : false };
});
rec('empty-state-project', emptyState.listEmpty, '空台账给出下一步提示');
rec('empty-state-chart', emptyState.chartEmptyShown, '无应收时显示占位说明');

// 3 载入示例数据
await page.click('#btnDemo');
await page.waitForTimeout(500);
const demo = await page.evaluate(() => ({
  pill: !document.querySelector('#demoPill').hidden,
  count: document.querySelector('#countLabel').textContent,
  rows: document.querySelectorAll('#projectList .row').length,
  tasks: document.querySelectorAll('#taskList .task').length,
  received: document.querySelector('#kReceived').textContent,
  receivable: document.querySelector('#kReceivable').textContent,
  hourly: document.querySelector('#kHourly').textContent,
  bars: document.querySelectorAll('#chart .bar-col').length,
  overduePill: document.querySelectorAll('#projectList .pill-danger').length
}));
rec('demo-seed', demo.rows === 6 && demo.tasks === 24 && demo.pill, demo.count + ' rows=' + demo.rows + ' tasks=' + demo.tasks);
rec('demo-kpi-nonzero', money(demo.received) > 0 && money(demo.receivable) > 0, demo.received + ' / ' + demo.receivable + ' / ' + demo.hourly);
rec('chart-bars-8', demo.bars === 8, 'bar cols=' + demo.bars);
rec('overdue-flag', demo.overduePill > 0, '逾期标记数量 ' + demo.overduePill);

await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/shot-1440-fold-demo.png` });
await page.screenshot({ path: `${OUT}/shot-1440-full-demo.png`, fullPage: true });

// 4 客户与项目录入
await page.fill('#clName', '测试客户甲');
await page.fill('#clIndustry', '教育');
await page.selectOption('#clSource', '内容');
await page.click('#clientForm button[type=submit]');
await page.waitForTimeout(250);
const afterClient = await page.evaluate(() => ({
  chips: document.querySelectorAll('#clientChips .chip').length,
  count: document.querySelector('#countLabel').textContent,
  reset: document.querySelector('#clName').value === ''
}));
rec('add-client', afterClient.chips === 5 && afterClient.reset, 'chips=' + afterClient.chips + ' ' + afterClient.count);

await page.selectOption('#pjClient', { label: '测试客户甲' });
await page.fill('#pjName', '暑期课程页设计');
await page.fill('#pjAmount', '9600');
await page.fill('#pjHours', '24');
await page.fill('#pjDue', '2099-12-01');
await page.click('#projectForm button[type=submit]');
await page.waitForTimeout(250);
const afterProject = await page.evaluate(() => ({
  rows: document.querySelectorAll('#projectList .row').length,
  status: document.querySelector('#projectList .row:last-child .status').value
}));
rec('add-project', afterProject.rows === 7 && afterProject.status === 'quoted', 'rows=' + afterProject.rows + ' status=' + afterProject.status);

// 表单校验：空客户名
await page.fill('#clName', '');
await page.click('#clientForm button[type=submit]');
await page.waitForTimeout(150);
const validation = await page.evaluate(() => ({
  errShown: !document.querySelector('#clNameErr').hidden,
  invalid: document.querySelector('#clName').getAttribute('aria-invalid')
}));
rec('form-validation', validation.errShown && validation.invalid === 'true', '错误提示已显示且 aria-invalid=true');

// 5 状态流转
await page.selectOption('#projectList .row:last-child .status', 'doing');
await page.waitForTimeout(250);
const statusFlow = await page.evaluate(() => document.querySelector('#projectList .row:last-child .status').value);
rec('status-change', statusFlow === 'doing', '状态改为 ' + statusFlow);

// 6 报价引擎
await page.fill('#qHours', '80');
await page.waitForTimeout(200);
const q1 = await page.evaluate(() => ({
  suggest: document.querySelector('#qSuggest').textContent,
  formula: document.querySelector('#qFormula').textContent,
  inst: document.querySelectorAll('#qInst > div').length
}));
await page.fill('#qHours', '60');
await page.waitForTimeout(200);
const q2 = await page.evaluate(() => document.querySelector('#qSuggest').textContent);
rec('quote-recompute', money(q1.suggest) !== money(q2), '80h=' + q1.suggest + ' / 60h=' + q2.suggest);
rec('quote-formula-visible', q1.formula.indexOf('有效工时') >= 0 && q1.formula.indexOf('建议价') >= 0, q1.formula.replace(/\n/g, ' | '));
rec('quote-instalments', q1.inst === 3, '分期段数 ' + q1.inst);

// 报价 → 归档项目
await page.click('#qAdd');
await page.waitForTimeout(250);
const afterQuote = await page.evaluate(() => document.querySelectorAll('#projectList .row').length);
rec('quote-to-project', afterQuote === 8, 'rows=' + afterQuote);

// 7 作战计划
await page.fill('#gAmount', '30000');
await page.fill('#gDeal', '10000');
await page.click('#planForm button[type=submit]');
await page.waitForTimeout(350);
const plan = await page.evaluate(() => ({
  leadsWeek: document.querySelector('#planLeadsWeek').textContent,
  tasks: document.querySelectorAll('#taskList .task').length,
  progress: document.querySelector('#planProgressText').textContent
}));
rec('plan-generate', plan.tasks === 24 && plan.progress.indexOf('0 /') === 0, plan.leadsWeek + ' tasks=' + plan.tasks + ' progress=' + plan.progress);

await page.click('#taskList .task:first-child input');
await page.waitForTimeout(200);
const afterTask = await page.evaluate(() => document.querySelector('#planProgressText').textContent);
rec('task-toggle', afterTask.indexOf('1 /') === 0, '进度 ' + afterTask);

// 8 回款登记
const before = await page.evaluate(() => document.querySelector('#recvTotal').textContent);
await page.fill('#recvList .row:first-child [data-recv]', '1000');
await page.click('#recvList .row:first-child [data-recvok]');
await page.waitForTimeout(300);
const after = await page.evaluate(() => document.querySelector('#recvTotal').textContent);
rec('register-payment', money(after) === money(before) - 1000, before + ' -> ' + after);

// 9 删除确认（取消分支）
const beforeDel = await page.evaluate(() => document.querySelectorAll('#projectList .row').length);
await page.click('#projectList .row:last-child [data-del]');
await page.waitForTimeout(200);
const dlgOpen = await page.evaluate(() => document.querySelector('#confirmDlg').open);
await page.click('#confirmDlg .btn-ghost');
await page.waitForTimeout(200);
const afterCancel = await page.evaluate(() => document.querySelectorAll('#projectList .row').length);
rec('delete-confirm-cancel', dlgOpen && afterCancel === beforeDel, '对话框打开=' + dlgOpen + ' 行数 ' + beforeDel + '->' + afterCancel);

// 10 导入非法文件
const badFile = 'C:/Users/zxc/AppData/Local/Temp/bad-backup.json';
fs.writeFileSync(badFile, '{ "oops": true }', 'utf8');
await page.setInputFiles('#fileInput', badFile);
await page.waitForTimeout(500);
const importState = await page.evaluate(() => {
  const ts = [...document.querySelectorAll('#toast .toast')];
  return { rows: document.querySelectorAll('#projectList .row').length, toast: ts.length ? ts[ts.length - 1].textContent : '' };
});
rec('import-invalid-safe', importState.rows === beforeDel && /备份|解析/.test(importState.toast), 'toast=' + importState.toast.trim());

// 11 导出
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
  page.click('#btnExport')
]);
let downloaded = '';
if (download) {
  downloaded = await download.path();
}
rec('export-backup', !!download, downloaded ? '已生成备份文件' : '未触发下载');

// 12 无障碍与偏好
const a11y = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.input, .select')];
  const noLabel = inputs.filter((el) => (!el.labels || el.labels.length === 0) && !el.getAttribute('aria-label')).length;
  const btns = [...document.querySelectorAll('button')];
  const noName = btns.filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label')).length;
  const dialog = document.querySelector('#confirmDlg');
  return { inputs: inputs.length, noLabel, btns: btns.length, noName, hasDialogLabel: !!(dialog.getAttribute('aria-labelledby') && dialog.getAttribute('aria-describedby')) };
});
rec('a11y-labels', a11y.noLabel === 0, a11y.inputs + ' 个输入均有 label');
rec('a11y-button-names', a11y.noName === 0, a11y.btns + ' 个按钮均有可访问名称');
rec('a11y-dialog-label', a11y.hasDialogLabel, '确认对话框有 aria-labelledby/describedby');

// 键盘操作：输入框可用键盘聚焦并编辑
await page.focus('#qTarget');
await page.keyboard.press('Control+a');
await page.keyboard.type('350');
await page.waitForTimeout(200);
const kbQuote = await page.evaluate(() => document.querySelector('#qTarget').value);
rec('keyboard-edit', kbQuote === '350', '键盘编辑目标时薪 -> ' + kbQuote);

// reduced motion
const ctxRM = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'zh-CN' });
const pageRM = await ctxRM.newPage();
await pageRM.goto(URL_, { waitUntil: 'load' });
const rm = await pageRM.evaluate(() => {
  const btn = document.querySelector('.btn-primary');
  return { transition: getComputedStyle(btn).transitionDuration };
});
rec('reduced-motion', parseFloat(rm.transition) < 0.01, 'transition-duration=' + rm.transition);
await ctxRM.close();

// 200% zoom 代理检查
const zoom = await page.evaluate(() => {
  document.documentElement.style.zoom = '2';
  const vw = window.innerWidth;
  const sw = document.documentElement.scrollWidth;
  document.documentElement.style.zoom = '';
  return { vw, sw };
});
rec('zoom-200-no-hscroll', zoom.sw <= zoom.vw * 2 + 2, 'zoom2: scrollWidth=' + zoom.sw + ' innerWidth=' + zoom.vw);

// 移动端截图
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'zh-CN', storageState: await context.storageState() });
const pageM = await ctxM.newPage();
await pageM.goto(URL_, { waitUntil: 'load' });
await pageM.waitForTimeout(400);
await pageM.screenshot({ path: `${OUT}/shot-390-fold-demo.png` });
await pageM.screenshot({ path: `${OUT}/shot-390-full-demo.png`, fullPage: true });
const mOver = await pageM.evaluate(() => ({ vw: window.innerWidth, sw: document.documentElement.scrollWidth }));
rec('mobile-no-overflow', mOver.sw <= mOver.vw + 1, '390: ' + mOver.sw + '/' + mOver.vw);
await ctxM.close();

// 分段截图（桌面）
await page.evaluate(() => document.querySelector('#stage-2').scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot-stage2.png` });
await page.evaluate(() => document.querySelector('#stage-3').scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot-stage3.png` });
await page.evaluate(() => document.querySelector('#stage-4').scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot-stage4.png` });
await page.evaluate(() => document.querySelector('#boundaries').scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot-boundaries.png` });

rec('console-clean', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

const report = {
  target: URL_,
  generated_at: new Date().toISOString(),
  total: steps.length,
  passed: steps.filter((s) => s.ok).length,
  failed: steps.filter((s) => !s.ok).length,
  steps,
  console_errors: consoleErrors
};
fs.writeFileSync(`${OUT}/acceptance-report.json`, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, issues: issues.length ? issues : 'none' }, null, 1));
await browser.close();
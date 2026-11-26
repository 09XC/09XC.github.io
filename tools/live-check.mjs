import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_='https://09xc.github.io/';
const b=await chromium.launch({executablePath:EDGE,headless:true});
const c=await b.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
const p=await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
const resp=await p.goto(URL_,{waitUntil:'load',timeout:45000});
await p.waitForTimeout(800);
await p.click('#btnDemo');
await p.waitForTimeout(700);
const r=await p.evaluate(()=>({
  title:document.title,
  kpi:document.querySelector('#kReceived').textContent,
  rows:document.querySelectorAll('#projectList .row').length,
  tasks:document.querySelectorAll('#taskList .task').length,
  suggest:document.querySelector('#qSuggest').textContent,
  stored:(()=>{try{return !!localStorage.getItem('solo-os:v1')}catch(e){return 'blocked'}})(),
  over:document.documentElement.scrollWidth<=window.innerWidth+1
}));
await p.screenshot({path:'C:/Users/zxc/Desktop/dumate/solo-os/.design-suite/live-1440.png'});
fs.writeFileSync('C:/Users/zxc/Desktop/dumate/solo-os/.design-suite/live-check.json', JSON.stringify({status:resp.status(),...r,errs},null,1));
process.exit(0);

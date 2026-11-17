import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {makeFixtures} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const dir=process.argv[2]?path.resolve(process.argv[2]):fileURLToPath(new URL('../../loon/master/',import.meta.url));
const source=fs.readFileSync(path.join(dir,'ptzone-mobile.browser.js'),'utf8');
const response=fs.readFileSync(path.join(dir,'ptzone-mobile.js'),'utf8');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const output=process.env.PTZONE_TEST_OUTPUT||'/tmp/ptzone-mobile-checks';fs.mkdirSync(output,{recursive:true});
let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
function equal(a,b,message){assert.deepEqual(a,b,message);checks++;}

// Synthetic fixtures reproduce the observed NexusPHP structure and headers.
// No signed URLs, profile fields, messages, or downloaded site data are stored.
const {fixture}=makeFixtures(source);

// Response guards are run independently of the DOM renderer.
function runResponse(req={},res={}){let result;vm.runInNewContext(response,{$request:{url:'https://ptzone.xyz/torrents.php',method:'GET',headers:{'User-Agent':ua},...req},$response:{status:200,headers:{'Content-Type':'text/html'},body:'<!doctype html><html><head><title>fixture</title></head><body><p>native</p></body></html>',...res},$done:x=>{result=x;}});return result;}
ok(runResponse().body?.includes('pzm-bootstrap'),'Allowed document gets payload');
for(const request of [{method:'POST'},{url:'https://ptzone.xyz/download.php?id=1'},{url:'https://example.com/torrents.php'},{headers:{'User-Agent':'Desktop'}},{headers:{'User-Agent':ua,'X-Requested-With':'XMLHttpRequest'}},{headers:{'User-Agent':ua,Range:'bytes=0-20'}},{headers:{'User-Agent':ua,'Sec-Fetch-Dest':'empty'}}])equal(Object.keys(runResponse(request)),[],'Disallowed request is untouched');
for(const res of [{status:302},{headers:{'content-type':'application/json'}},{headers:{'content-type':'text/html','content-security-policy':"script-src 'self'"}},{headers:{'content-type':'text/html','content-disposition':'attachment'}},{body:'<html><head><meta http-equiv="Content-Security-Policy" content="script-src self"></head><body></body></html>'}])equal(Object.keys(runResponse({},res)),[],'Non-document or enforced CSP is untouched');

const browser=await chromium.launch({headless:true,executablePath:process.env.PTZONE_CHROMIUM||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const context=await browser.newContext({userAgent:ua,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:fixture(new URL(route.request().url()))}));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function open(pathname){await page.goto('https://ptzone.xyz/'+pathname);await page.waitForFunction(()=>window.__ptzoneMobile?.active);}
async function restore(){await page.getByRole('button',{name:'显示设置',exact:true}).click();await page.getByRole('button',{name:'全站使用原版',exact:true}).click();equal(await page.evaluate(()=>document.querySelector('table.mainouter').outerHTML===window.mainBefore),true,'Restoration preserves the original DOM exactly');await page.getByRole('button',{name:'全站使用移动版',exact:true}).click();}
try{
  await open('torrents.php');
  equal(await page.locator('.pzm-torrent').count(),50,'All 50 rows become cards');
  equal(await page.evaluate(()=>document.querySelector('.pzm-quick-filters select')===window.nativeSelect),true,'Quick filter is the original select');
  equal(await page.evaluate(()=>Array.from(new FormData(window.nativeForm))),await page.evaluate(()=>window.formBefore),'FormData unchanged by adaptation');
  await restore();
  await page.locator('.pzm-quick-filters select[name=spstate]').selectOption('2');
  equal(await page.evaluate(()=>new FormData(window.nativeForm).get('spstate')),'2','Quick selection submits native value');
  await page.locator('#bookmark1').click();await page.waitForFunction(()=>document.getElementById('bookmark1').getAttribute('aria-label')==='已收藏');checks++;
  equal(await page.evaluate(()=>window.nativeBookmark===document.getElementById('bookmark1')),true,'Bookmark node identity kept');
  await page.locator('.pzm-description-toggle').first().click();ok(await page.locator('.pzm-description-open').count()>0,'Description expands');
  await page.locator('.pzm-actions a[data-test-download]').first().click();equal(await page.evaluate(()=>window.downloadHits),1,'Download invokes native handler once');
  equal(await page.locator('.pzm-pagination a').first().getAttribute('href'),'?search=HDR&spstate=2&page=1','Pager keeps all native search parameters');
  await page.locator('.pzm-page-select').first().click();ok(await page.locator('.pzm-pager-open').first().isVisible(),'Native ranges can expand');
  await open('details.php?id=1');equal(await page.locator('.pzm-detail-actions>a').count(),2,'Detail action strip has download and bookmark');
  equal(await page.evaluate(()=>document.querySelector('.pzm-detail-actions a[id^=bookmark]')===window.nativeBookmark),true,'Detail bookmark remains the same original node');
  await restore();
  await page.locator('.pzm-detail-actions>a[href*="download.php"]').click();equal(await page.evaluate(()=>window.downloadHits),1,'Detail download delegates to native handler');
  await page.locator('#bookmark0').click();await page.waitForFunction(()=>document.getElementById('bookmark0').getAttribute('aria-label')==='已收藏');checks++;
  await page.locator('.pzm-detail-section .pzm-section-toggle').first().click();ok(await page.locator('.pzm-detail-section').first().locator('pre').isVisible(),'MediaInfo expands');
  await page.locator('.pzm-native-section-toggle').click();equal(await page.locator('#kdescr').isVisible(),false,'Native description toggle still works');
  await open('index.php');equal(await page.locator('.pzm-home-section').evaluateAll(els=>els.map(e=>e.getAttribute('data-pzm-home-section'))),['news','recent','chat','lucky'],'Recent torrents follow news');
  equal(await page.locator('.pzm-home-folded').count(),3,'Announcements, chat and lottery start collapsed');
  await restore();
  await page.locator('[data-pzm-home-section=chat] .pzm-section-toggle').click();ok(await page.locator('#chat-text').isVisible(),'Chat expands with its original input');
  equal(await page.locator('#chat-text').inputValue(),'草稿','Chat draft preserved');
  await open('forums.php');equal(await page.locator('.pzm-record-section').count(),2,'Both forum section headers kept');equal(await page.locator('.pzm-record').count(),2,'Section header is never a post card');await restore();
  await open('usercp.php');equal(await page.locator('.pzm-account-stats>div').count(),4,'My account contains four stats');equal(await page.locator('.pzm-account-links>a').count(),5,'Only native account links are used');await restore();
  await open('usercp.php?action=personal');equal(await page.locator('.pzm-account-dashboard').count(),0,'Settings forms do not get a dashboard');equal(await page.locator('input[name=title]').inputValue(),'原有设置','Settings value retained');await restore();
  await open('torrents.php?partial=1');ok(await page.locator('.pzm-partial-notice').isVisible(),'Partial-page notice identifies missing tail without inventing records');equal(await page.locator('.pzm-torrent').count(),10,'Partial page keeps its actual 10 rows');
  await open('torrents.php');await page.locator('.pzm-torrents>tbody>tr').first().locator('img[alt=seeders]').evaluate(e=>{e.alt='unknown';});await page.waitForFunction(()=>window.__ptzoneMobile.active===false);checks++;
  ok(await page.locator('.pzm-status').isVisible(),'Fallback reason stays visible');equal(await page.getByRole('button',{name:'菜单',exact:true}).isVisible(),false,'Fallback hides inactive menu');
  for(const width of [320,375,390,430]) {
    await page.setViewportSize({width,height:844});
    for(const view of ['index.php','torrents.php','torrents.php?page=1','torrents.php?partial=1','details.php?id=1','forums.php','usercp.php']){
      await open(view);
      const sizes=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,overflow:Array.from(document.querySelectorAll('.pzm-torrent,.pzm-pagination,.pzm-quick-filters,.pzm-account-dashboard')).filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className)}));
      ok(sizes.width<=sizes.viewport+1,view+' at '+width+' has no document overflow: '+JSON.stringify(sizes));equal(sizes.overflow,[],view+' has no card/pager overflow');
      if(width===390&&!view.includes('?page'))await page.screenshot({path:path.join(output,view.split('?')[0].replace('.php','')+(view.includes('partial')?'-partial':'')+'.png'),fullPage:false});
    }
  }
  equal(errors,[],'No browser exceptions');
  console.log(JSON.stringify({checks,viewportChecks:28,screenshots:output,result:'passed'}));
}finally{await browser.close();}

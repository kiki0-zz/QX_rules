import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {parseHTML,HTMLElement,Event}=await import(process.env.PTZONE_LINKEDOM?pathToFileURL(process.env.PTZONE_LINKEDOM).href:'linkedom');
import {makeFixtures} from './fixtures.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const dir=process.argv[2]?path.resolve(process.argv[2]):fileURLToPath(new URL('../../loon/master/',import.meta.url));
const source=fs.readFileSync(dir+'/ptzone-mobile.browser.js','utf8');
const response=fs.readFileSync(dir+'/ptzone-mobile.js','utf8');
const css=fs.readFileSync(dir+'/ptzone-mobile.css','utf8');
const {fixture}=makeFixtures(source);
let count=0;
function ok(x,msg){assert.ok(x,msg);count++;}
function equal(a,b,msg){assert.deepEqual(a,b,msg);count++;}
const properties={rows:{get(){return this.tagName==='TABLE'?Array.from(this.querySelectorAll(':scope>tbody>tr,:scope>thead>tr,:scope>tfoot>tr,:scope>tr')):undefined;}},cells:{get(){return this.tagName==='TR'?Array.from(this.children).filter(e=>e.tagName==='TD'||e.tagName==='TH'):undefined;}},colSpan:{get(){return Number(this.getAttribute('colspan')||1);}}};
for(const [key,value]of Object.entries(properties))Object.defineProperty(HTMLElement.prototype,key,{...value,configurable:true});
HTMLElement.prototype.click=function(){const event=new Event('click',{bubbles:true,cancelable:true});event.button=0;this.dispatchEvent(event);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function boot(view){
  const location=new URL('https://ptzone.xyz/'+view),{document,window:domWindow}=parseHTML(fixture(location));
  for(const table of Array.from(document.querySelectorAll('table'))){const rows=Array.from(table.children).filter(e=>e.tagName==='TR');if(rows.length){const body=document.createElement('tbody');table.insertBefore(body,rows[0]);rows.forEach(r=>body.appendChild(r));}}
  document.readyState='complete';
  const storage=new Map(),eventTarget=new domWindow.EventTarget();
  const window={document,getSelection:()=>({toString:()=>''}),addEventListener:(...a)=>eventTarget.addEventListener(...a)};
  const context=vm.createContext({window,document,location,navigator:{userAgent:'Mozilla/5.0 iPhone'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,MutationObserver:domWindow.MutationObserver,setTimeout,clearTimeout});
  const nativeForm=document.querySelector('form[name=searchbox]'),nativeSelect=document.querySelector('select[name=spstate]'),bookmark=document.querySelector('a[id^=bookmark]');
  let downloads=0;
  for(const a of document.querySelectorAll('[data-test-download]'))a.addEventListener('click',e=>{e.preventDefault();downloads++;});
  for(const a of document.querySelectorAll('a[id^=bookmark]'))a.addEventListener('click',e=>{e.preventDefault();a.querySelector('img').alt='Bookmarked';});
  const before=document.querySelector('table.mainouter').outerHTML;
  vm.runInContext(source,context);
  return {window,document,nativeForm,nativeSelect,bookmark,before,downloads:()=>downloads};
}
function restore(x){x.window.__ptzoneMobile.restore();equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Native DOM restores exactly');const button=Array.from(x.document.querySelectorAll('#pzm-controls button')).find(b=>b.textContent==='全站使用移动版');button.click();ok(x.window.__ptzoneMobile.active,'Re-enable works');}
for(const view of ['index.php','torrents.php','torrents.php?page=1','torrents.php?partial=1','details.php?id=1','forums.php','usercp.php','usercp.php?action=personal']){
  const x=boot(view),d=x.document;ok(x.window.__ptzoneMobile?.active,view+' active');
  equal(d.getElementById('pzm-style').textContent,css,'Built CSS matches the canonical stylesheet');
  if(view.startsWith('torrents')){equal(d.querySelectorAll('.pzm-torrent').length,view.includes('partial')?10:50,'All original records');ok(d.querySelector('.pzm-quick-filters select')===x.nativeSelect,'Native select identity');ok(d.querySelector('form[name=searchbox]')===x.nativeForm,'Native form identity');equal(d.querySelectorAll('.pzm-quick-filters select').length,3,'Three native filters');equal(d.querySelectorAll('select[name=spstate]').length,1,'No duplicate native select');if(view.includes('partial'))ok(d.querySelector('.pzm-partial-notice')?.hidden===false,'Incomplete page notice');}
  if(view==='index.php'){equal(Array.from(d.querySelectorAll('.pzm-home-section'),e=>e.dataset.pzmHomeSection),['news','recent','chat','lucky'],'Home grouping and order');equal(d.querySelectorAll('.pzm-home-folded').length,3,'Home collapsed modules');}
  if(view==='forums.php'){equal(d.querySelectorAll('.pzm-record-section').length,2,'Both forum sections');equal(d.querySelectorAll('.pzm-record').length,2,'Section titles excluded from data cards');}
  if(view==='details.php?id=1'){equal(d.querySelectorAll('.pzm-detail-actions>a').length,2,'Detail buttons');ok(d.querySelector('.pzm-detail-actions a[id^=bookmark]')===x.bookmark,'Detail bookmark identity');equal(d.querySelectorAll('.pzm-detail-folded').length,2,'MediaInfo and file fold');}
  if(view==='usercp.php'){equal(d.querySelectorAll('.pzm-account-stats>div').length,4,'Account stats');equal(d.querySelectorAll('.pzm-account-links>a').length,5,'Account native entries');}
  if(view.includes('action=personal'))equal(d.querySelectorAll('.pzm-account-dashboard').length,0,'Settings form not dashboard');
  restore(x);
  if(view==='torrents.php'||view.startsWith('details')){x.bookmark.click();await delay(150);equal(x.bookmark.getAttribute('aria-label'),'已收藏','Async bookmark label sync');const selector=view.startsWith('details')?'.pzm-detail-actions>a[href*="download.php"]':'.pzm-actions a[data-test-download]';d.querySelector(selector).click();equal(x.downloads(),1,'Native download handler invoked exactly once');}
  if(view==='torrents.php'){d.querySelector('.pzm-description-toggle').click();equal(d.querySelectorAll('.pzm-description-open').length,1,'Description expand');equal(d.querySelector('.pzm-pagination a').getAttribute('href'),'?search=HDR&spstate=2&page=1','Native pager conditions preserved');d.querySelector('.pzm-page-select').click();ok(d.querySelector('.pzm-pager-open'),'Native page range expansion');d.querySelector('.pzm-sort img[alt=seeders]').alt='unknown';await delay(160);ok(x.window.__ptzoneMobile.active===false,'Unknown header fallback');ok(d.querySelector('.pzm-status').textContent.includes('原版'),'Fallback reason displayed');ok(Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='菜单').hidden,'Inactive menu hidden');}
  if(view==='index.php'){d.querySelector('[data-pzm-home-section=chat] button').click();ok(!d.querySelector('[data-pzm-home-section=chat]').classList.contains('pzm-home-folded'),'Chat expands');equal(d.querySelector('#chat-text').getAttribute('value'),'草稿','Draft preserved');}
  x.window.__ptzoneMobile.restore();
}
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
// Response guards are run independently of the DOM renderer.
function runResponse(req={},res={}){let result;vm.runInNewContext(response,{$request:{url:'https://ptzone.xyz/torrents.php',method:'GET',headers:{'User-Agent':ua},...req},$response:{status:200,headers:{'Content-Type':'text/html'},body:'<!doctype html><html><head><title>fixture</title></head><body><p>native</p></body></html>',...res},$done:x=>{result=x;}});return result;}
ok(runResponse().body?.includes('pzm-bootstrap'),'Allowed document gets payload');
for(const request of [{method:'POST'},{url:'https://ptzone.xyz/download.php?id=1'},{url:'https://example.com/torrents.php'},{headers:{'User-Agent':'Desktop'}},{headers:{'User-Agent':ua,'X-Requested-With':'XMLHttpRequest'}},{headers:{'User-Agent':ua,Range:'bytes=0-20'}},{headers:{'User-Agent':ua,'Sec-Fetch-Dest':'empty'}}])equal(Object.keys(runResponse(request)),[],'Disallowed request is untouched');
for(const res of [{status:302},{headers:{'content-type':'application/json'}},{headers:{'content-type':'text/html','content-security-policy':"script-src 'self'"}},{headers:{'content-type':'text/html','content-disposition':'attachment'}},{body:'<html><head><meta http-equiv="Content-Security-Policy" content="script-src self"></head><body></body></html>'}])equal(Object.keys(runResponse({},res)),[],'Non-document or enforced CSP is untouched');

console.log(JSON.stringify({checks:count,result:'passed',scope:'DOM behavior only; no layout engine'}));

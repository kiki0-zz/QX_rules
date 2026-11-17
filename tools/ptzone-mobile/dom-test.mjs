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
  // Linkedom reports the observed root for childList mutations, whereas DOM
  // browsers report the changed parent. Normalize added-node records to that
  // parent so account text changes exercise the browser's callback semantics.
  class BrowserMutationObserver {
    constructor(callback){this.observer=new domWindow.MutationObserver(records=>callback(records.map(record=>record.type==='childList'&&record.addedNodes[0]?.parentNode?{...record,target:record.addedNodes[0].parentNode}:record)));}
    observe(...args){this.observer.observe(...args);}
    disconnect(){this.observer.disconnect();}
  }
  const context=vm.createContext({window,document,location,navigator:{userAgent:'Mozilla/5.0 iPhone'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,MutationObserver:BrowserMutationObserver,setTimeout,clearTimeout});
  const nativeForm=document.querySelector('form[name=searchbox]'),nativeSelect=document.querySelector('select[name=spstate]'),bookmark=document.querySelector('a[id^=bookmark]'),nativeMode=document.querySelector('select[name=search_mode]');
  let downloads=0;
  for(const a of document.querySelectorAll('[data-test-download]'))a.addEventListener('click',e=>{e.preventDefault();downloads++;});
  for(const a of document.querySelectorAll('a[id^=bookmark]'))a.addEventListener('click',e=>{e.preventDefault();a.querySelector('img').alt='Bookmarked';});
  const before=document.querySelector('table.mainouter').outerHTML;
  const footerBefore=document.getElementById('footer')?.outerHTML,calendarBefore=document.getElementById('calendar')?.outerHTML;
  vm.runInContext(source,context);
  return {window,document,nativeForm,nativeSelect,nativeMode,bookmark,before,footerBefore,calendarBefore,downloads:()=>downloads};
}
function restore(x){x.window.__ptzoneMobile.restore();equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Native DOM restores exactly');equal(x.document.getElementById('footer')?.outerHTML,x.footerBefore,'Copyright and diagnostics restore exactly');const button=Array.from(x.document.querySelectorAll('#pzm-controls button')).find(b=>b.textContent==='全站使用移动版');button.click();ok(x.window.__ptzoneMobile.active,'Re-enable works');}
for(const view of ['index.php','torrents.php','torrents.php?page=1','torrents.php?partial=1','details.php?id=1','forums.php','usercp.php','usercp.php?action=personal','attendance.php']){
  const x=boot(view),d=x.document;ok(x.window.__ptzoneMobile?.active,view+' active');
  equal(d.getElementById('pzm-style').textContent,css,'Built CSS matches the canonical stylesheet');
  equal(d.querySelectorAll('#pzm-account-panel .pzm-account-stats>div').length,4,'Top account panel has four stats');
  equal(d.querySelectorAll('#pzm-account-panel .pzm-account-links>a').length,6,'Top panel has all six common links');
  equal(d.querySelector('#pzm-account-panel [data-pzm-account-path="/attendance.php"]').textContent,'今日已签','Signed-in attendance state retained');
  equal(d.querySelector('#pzm-account-panel [data-pzm-account-path="/messages.php"]').textContent,'消息 · 2未读','Unread count retained');
  equal(Array.from(d.querySelectorAll('#pzm-account-panel [data-pzm-activity]'),e=>e.textContent),['做种 0','下载中 0','可连接 未知'],'Native activity counts retained');
  equal(new Set(Array.from(d.querySelectorAll('#pzm-account-panel a'),a=>a.getAttribute('href'))),new Set(Array.from(d.querySelectorAll('#info_block a'),a=>a.getAttribute('href'))),'Every native account link remains accessible');
  ok(d.getElementById('footer')?.querySelector('.pzm-footer-diagnostics')||view.includes('partial'),'Only recognized footer diagnostics hidden');
  if(view.startsWith('torrents')){ok(d.querySelector('.pzm-search-options select[name=search_mode]')===x.nativeMode,'Native match select identity retained');equal(Array.from(x.nativeMode.querySelectorAll('option'),o=>[o.getAttribute('value'),o.textContent]),[['0','全部关键词'],['2','整段匹配']],'Search labels improve without changing submitted values');}
  if(view.startsWith('torrents')){equal(d.querySelectorAll('.pzm-torrent').length,view.includes('partial')?10:50,'All original records');ok(d.querySelector('.pzm-quick-filters select')===x.nativeSelect,'Native select identity');ok(d.querySelector('form[name=searchbox]')===x.nativeForm,'Native form identity');equal(d.querySelectorAll('.pzm-quick-filters select').length,3,'Three native filters');equal(d.querySelectorAll('select[name=spstate]').length,1,'No duplicate native select');if(view.includes('partial'))ok(d.querySelector('.pzm-partial-notice')?.hidden===false,'Incomplete page notice');}
  if(view==='index.php'){equal(Array.from(d.querySelectorAll('.pzm-home-section'),e=>e.dataset.pzmHomeSection),['news','recent','chat','lucky'],'Home grouping and order');equal(d.querySelectorAll('.pzm-home-folded').length,3,'Home collapsed modules');}
  if(view==='forums.php'){equal(d.querySelectorAll('.pzm-record-section').length,2,'Both forum sections');equal(d.querySelectorAll('.pzm-record').length,2,'Section titles excluded from data cards');}
  if(view==='details.php?id=1'){equal(d.querySelectorAll('.pzm-detail-actions>a').length,2,'Detail buttons');ok(d.querySelector('.pzm-detail-actions a[id^=bookmark]')===x.bookmark,'Detail bookmark identity');equal(d.querySelectorAll('.pzm-detail-folded').length,2,'MediaInfo and file fold');}
  if(view==='usercp.php'){equal(d.querySelectorAll('.pzm-account-dashboard .pzm-account-stats>div').length,4,'Account stats');equal(d.querySelectorAll('.pzm-account-dashboard .pzm-account-links>a').length,6,'Account native entries');}
  if(view==='index.php'){equal(d.querySelectorAll('.pzm-footer-icon').length,4,'All browser/client icons get a bounded size');equal(d.querySelectorAll('.pzm-footer-caption').length,4,'Browser/client captions added');equal(d.querySelectorAll('.pzm-footer-brand').length,1,'NexusPHP branding constrained separately');}
  if(view==='attendance.php'){equal(d.querySelectorAll('.pzm-attendance-milestone').length,3,'All three milestone rewards formatted');equal(Array.from(d.querySelectorAll('.pzm-rule-reward'),e=>e.textContent),['+200 魔力值','+500 魔力值','+1000 魔力值'],'Actual reward values preserved');equal(d.getElementById('calendar').outerHTML,x.calendarBefore,'Calendar markup unchanged');equal(d.querySelectorAll('.pzm-attendance-basic').length,2,'Both original base rules retained');}
  if(view.includes('action=personal'))equal(d.querySelectorAll('.pzm-account-dashboard').length,0,'Settings form not dashboard');
  restore(x);
  if(view==='index.php'){d.getElementById('bonus-value').textContent='10,600.7';await delay(150);equal(d.querySelector('#pzm-account-panel [data-pzm-stat=bonus]').textContent,'10,600.7','Native account updates refresh the card');}
  if(view==='torrents.php'){x.nativeMode.querySelector('option[value="2"]').setAttribute('selected','');x.nativeMode.dispatchEvent(new Event('change',{bubbles:true}));ok(d.querySelector('.pzm-search-match-hint').textContent.includes('整段文字'),'Match explanation updates from the native selection');}
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

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
const properties={rows:{get(){return this.tagName==='TABLE'?Array.from(this.querySelectorAll(':scope>tbody>tr,:scope>thead>tr,:scope>tfoot>tr,:scope>tr')):undefined;}},tBodies:{get(){return this.tagName==='TABLE'?Array.from(this.children).filter(e=>e.tagName==='TBODY'):undefined;}},cells:{get(){return this.tagName==='TR'?Array.from(this.children).filter(e=>e.tagName==='TD'||e.tagName==='TH'):undefined;}},colSpan:{get(){return Number(this.getAttribute('colspan')||1);}}};
for(const [key,value]of Object.entries(properties))Object.defineProperty(HTMLElement.prototype,key,{...value,configurable:true});
HTMLElement.prototype.click=function(){const event=new Event('click',{bubbles:true,cancelable:true});event.button=0;this.dispatchEvent(event);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function normalizeTables(document){for(const table of Array.from(document.querySelectorAll('table'))){const rows=Array.from(table.children).filter(e=>e.tagName==='TR');if(rows.length){const body=document.createElement('tbody');table.insertBefore(body,rows[0]);rows.forEach(r=>body.appendChild(r));}}return document;}
function boot(view,options={}){
  const location=new URL('https://ptzone.xyz/'+view),{document,window:domWindow}=parseHTML(options.html||fixture(location));
  normalizeTables(document);
  document.readyState='complete';
  const storage=new Map(),eventTarget=new domWindow.EventTarget();
  const window={document,getSelection:()=>({toString:()=>''}),addEventListener:(...a)=>eventTarget.addEventListener(...a)};
  if(options.bookmark)window.bookmark=options.bookmark;
  // Linkedom reports the observed root for childList mutations, whereas DOM
  // browsers report the changed parent. Normalize added-node records to that
  // parent so account text changes exercise the browser's callback semantics.
  class BrowserMutationObserver {
    constructor(callback){this.observer=new domWindow.MutationObserver(records=>callback(records.map(record=>record.type==='childList'&&record.addedNodes[0]?.parentNode?{...record,target:record.addedNodes[0].parentNode}:record)));}
    observe(...args){this.observer.observe(...args);}
    disconnect(){this.observer.disconnect();}
  }
  class BrowserDOMParser {parseFromString(html){return normalizeTables(parseHTML(html).document);}}
  const context=vm.createContext({window,document,location,navigator:{userAgent:'Mozilla/5.0 iPhone'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,MutationObserver:BrowserMutationObserver,DOMParser:BrowserDOMParser,AbortController,fetch:options.fetch,setTimeout,clearTimeout});
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
// Native PHP can terminate before the rating/action/statistic cells. Model
// those exact interrupted rows and real pageSize/zero-based page semantics.
const templateDoc=normalizeTables(parseHTML(fixture(new URL('https://ptzone.xyz/torrents.php'))).document);
const templateTable=templateDoc.querySelector('table.torrents');
const templateHeader=templateTable.rows[0].outerHTML,templateRow=templateTable.rows[1];
const brokenIds=new Set([130,174,201,214,247]);
function serverPage(offset,size,{cutIds=brokenIds,shift=0}={}){
  const rows=[];let cut=false;
  for(let i=0;i<size;i++){
    const id=offset+i+1+shift,row=templateRow.cloneNode(true);
    row.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(/(?:details|download|viewsnatches)\.php\?/.test(href))a.setAttribute('href',href.replace(/\bid=\d+/, 'id='+id));});
    row.querySelector('table.torrentname a[href*="details.php?"]').textContent='Native record '+id;
    row.querySelector('img.nexus-lazy-load').setAttribute('data-src','https://images.example.test/'+id+'.jpg');
    const bookmark=row.querySelector('a[id^=bookmark]');bookmark.id='bookmark'+i;bookmark.setAttribute('href','javascript: bookmark('+id+','+i+');');bookmark.removeAttribute('onclick');
    if(cutIds.has(id)){while(row.cells.length>2)row.cells[row.cells.length-1].remove();const nested=row.querySelector('table.torrentname');while(nested.rows[0].cells.length>2)nested.rows[0].cells[nested.rows[0].cells.length-1].remove();cut=true;}
    rows.push(row.outerHTML);if(cut)break;
  }
  const base=normalizeTables(parseHTML(fixture(new URL('https://ptzone.xyz/torrents.php'))).document);
  const outer=base.getElementById('outer');outer.innerHTML='<p><font class="gray">'+(offset+1)+' - '+(offset+size)+'</font> <a href="?page=1">下一頁 &gt;&gt;</a></p><table class="torrents"><tbody>'+templateHeader+rows.join('')+'</tbody></table>';
  if(cut)base.getElementById('footer').remove();
  return base.documentElement.outerHTML;
}
async function until(condition,message){for(let n=0;n<200;n++){if(condition())return;await delay(10);}throw new Error(message);}
function visibleRows(doc){return Array.from(doc.querySelectorAll('tr.pzm-torrent:not([data-pzm-recovery-original])'));}
function visibleIds(doc){return visibleRows(doc).map(row=>Number(new URL(row.querySelector('.pzm-name-title>a[href*="details.php?"]').getAttribute('href'),'https://ptzone.xyz').searchParams.get('id')));}
for(let page=0;page<5;page++){
  const calls=[];
  const get=async(url,options)=>{
    const u=new URL(url),size=Number(u.searchParams.get('pageSize')||50),offset=Number(u.searchParams.get('page'))*size;
    calls.push({offset,size,notnewword:u.searchParams.get('notnewword')});equal(u.origin,'https://ptzone.xyz','Recovery uses only the original site');equal(u.searchParams.get('spstate'),'2','Promotion filter is retained');equal(u.searchParams.get('search'),'HDR','Search query is retained');equal(options.credentials,'same-origin','No manual cookie or credential extraction');
    return {ok:true,text:async()=>serverPage(offset,size)};
  };
  let bookmarkCalls=0;
  const x=boot('torrents.php?incldead=1&spstate=2&search=HDR&page='+page,{html:serverPage(page*50,50),fetch:get,bookmark:page===2?()=>{bookmarkCalls++;}:undefined}),d=x.document;
  if(page>=2)await until(()=>d.querySelector('.pzm-partial-notice p')?.textContent.startsWith('已补齐'),'Recovery did not complete on page '+(page+1));
  else await delay(10);
  const actual=visibleIds(d);
  equal(actual,Array.from({length:50},(_,i)=>page*50+i+1),'Page '+(page+1)+' has exactly its original 50 records, in order');
  equal(new Set(actual).size,50,'Recovered page has no duplicated records');
  if(page>=2)equal(Array.from(d.querySelectorAll('.pzm-recovery-pagination a'),a=>a.getAttribute('href')),Array.from(d.querySelectorAll('nav.pzm-pagination:not(.pzm-recovery-pagination) a'),a=>a.getAttribute('href')),'Recovered pages mirror native navigation at the bottom');
  if(page>=2){const imported=d.querySelector('tr.pzm-torrent:not([data-pzm-source-missing]):not([data-pzm-recovery-original]) a[id^=bookmark]');ok(imported.getAttribute('href').startsWith(page===2?'javascript:':'details.php?'),'Available native bookmark helper is preserved; absent helper opens native details');equal(visibleRows(d)[0].querySelector('img.nexus-lazy-load').getAttribute('loading'),'lazy','Recovered page initializes lazy native posters without missing footer scripts');equal(bookmarkCalls,0,'Recovery never automatically bookmarks a resource');}
  const ids=visibleRows(d).flatMap(row=>Array.from(row.querySelectorAll('a[id^=bookmark]'),a=>a.id));equal(new Set(ids).size,ids.length,'Imported bookmark controls have unique IDs');
  for(const row of d.querySelectorAll('tr[data-pzm-source-missing]')){equal(row.querySelector('[data-pzm-field=size]').textContent,'—','Missing source statistics are not replaced with invented zeroes');ok(row.querySelector('.pzm-source-missing-note'),'Unavailable source fields explicitly labelled');ok(row.querySelector('.pzm-actions a[href*="download.php"]'),'Incomplete records retain a native-format download destination');}
  ok(calls.length<=50,'Recovery has a bounded request budget');if(page<2)equal(calls.length,0,'Complete native pages do not send recovery requests');
  if(page>=2)ok(calls.every(call=>call.notnewword==='1'),'Fragment reads do not repeatedly submit the query as a new hot search');
  x.window.__ptzoneMobile.restore();equal(d.querySelector('table.mainouter').outerHTML,x.before,'Recovery removes all imported records when restoring the native page');
}
// The iPhone report: the initial document ends after four records, while a
// fresh request to the same page works. No fragments should be requested.
{
  const calls=[];
  const x=boot('torrents.php?page=2&incldead=1&sort=4&type=desc',{html:serverPage(100,50,{cutIds:new Set([105])}),fetch:async(url,options)=>{
    calls.push({query:Object.fromEntries(new URL(url).searchParams),cache:options.cache});
    return {ok:true,text:async()=>serverPage(100,50,{cutIds:new Set(),shift:-1})};
  }});
  await until(()=>visibleRows(x.document).length===50,'Fresh same-page request did not restore all 50 records');
  equal(calls,[{query:{page:'2',incldead:'1',sort:'4',type:'desc',notnewword:'1'},cache:'no-store'}],'One fresh read of the current page preserves the query and skips fragments');
  equal(visibleIds(x.document),Array.from({length:50},(_,i)=>100+i),'Full retry uses the new page as one snapshot');
  ok(x.document.querySelector('.pzm-partial-notice').hidden,'A fully restored page clears the warning');
  x.window.__ptzoneMobile.restore();equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Original document remains reversible after a fresh result');
}
for(const {cut,retry} of [{cut:46,retry:'complete'},{cut:20,retry:'complete'},{cut:46,retry:'partial'},{cut:46,retry:'error'}]){
  const native=serverPage(0,46,{cutIds:new Set([cut])});
  const calls=[];
  let wholeReads=0;
  const x=boot('torrents.php?search=HDR&incldead=1',{html:native,fetch:async url=>{
    const query=new URL(url).searchParams;
    const size=Number(query.get('pageSize')||46);
    const offset=Number(query.get('page'))*size;
    calls.push([offset,size,query.get('search'),query.get('incldead')]);
    if(!query.has('pageSize')&&++wholeReads===2){
      if(retry==='error')return {ok:false};
      if(retry==='complete')return {ok:true,text:async()=>serverPage(0,46,{cutIds:new Set()})};
    }
    return {ok:true,text:async()=>serverPage(offset,size,{cutIds:new Set([cut])})};
  }});
  const notice=()=>x.document.querySelector('.pzm-partial-notice');
  await until(()=>notice()?.textContent.includes('已补齐本页 46 条'),'Partial statistics did not settle');
  equal(wholeReads,2,'Missing statistics get exactly one additional whole-page read');
  ok(calls.every(([, ,search,dead])=>search==='HDR'&&dead==='1'),'Statistics retry preserves search and filters');
  equal(visibleIds(x.document),Array.from({length:46},(_,i)=>i+1),'The original 46 results remain in order without duplicates');
  equal(x.document.querySelectorAll('tr[data-pzm-source-missing]').length,retry==='complete'?0:1,'Temporary missing fields recover while unavailable fields retain their marker');
  equal(notice().hidden,retry==='complete','A clean retry clears the warning; unavailable statistics remain visible');
  x.window.__ptzoneMobile.restore();
  equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Statistics recovery remains reversible');
}
for(const resolves of [true,false]){
  const pageRequests=[];
  const x=boot('torrents.php?page=2',{html:serverPage(100,50,{cutIds:new Set([105])}),fetch:async url=>{
    const u=new URL(url),size=Number(u.searchParams.get('pageSize')||50),offset=Number(u.searchParams.get('page'))*size;
    pageRequests.push([offset,size]);
    if(size!==50)equal(visibleIds(x.document),[101,102,103,104],'Unverified fragments do not alter the visible list');
    const html=size===50?serverPage(100,50,{cutIds:new Set(resolves&&pageRequests.length>1?[]:[105]),shift:resolves&&pageRequests.length>1?-1:0}):serverPage(offset,size,{shift:-1});
    return {ok:true,text:async()=>html};
  }});
  if(resolves){
    await until(()=>visibleRows(x.document).length===50,'Overlap did not recover with a fresh snapshot');
    equal(pageRequests,[[100,50],[105,5],[100,50]],'An overlapping fragment triggers one full-page retry');
    equal(visibleIds(x.document),Array.from({length:50},(_,i)=>100+i),'Only the renewed snapshot is committed');
  }else{
    await until(()=>x.document.querySelector('.pzm-partial-notice p')?.textContent.includes('仍在更新'),'Repeated overlap did not settle');
    equal(pageRequests.length,4,'Persistent overlap has a bounded retry');
    equal(visibleIds(x.document),[101,102,103,104],'Failed recovery leaves the original records in order');
  }
  x.window.__ptzoneMobile.restore();equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Recovery remains reversible after an overlap');
}
{
  const calls=[];
  const partial=serverPage(250,50,{cutIds:new Set([255])});
  const x=boot('torrents.php?page=5',{html:partial,fetch:async url=>{
    calls.push(new URL(url).searchParams.get('pageSize'));
    return {ok:true,text:async()=>partial};
  }});
  await until(()=>x.document.querySelector('.pzm-partial-notice p')?.textContent.includes('仍不完整'),'Later page did not attempt a fresh read');
  equal(calls,[null],'Later pages also retry the current page but leave further fragment requests to the user');
  equal(visibleIds(x.document),[251,252,253,254],'A partial later page remains available');
  x.window.__ptzoneMobile.restore();
}
{
  let calls=0;
  const x=boot('torrents.php?page=2',{html:serverPage(100,50),fetch:async()=>{calls++;return {ok:true,text:async()=>'<html><body>Login required</body></html>'};}});
  await until(()=>x.document.querySelector('.pzm-partial-notice p')?.textContent.includes('登录状态'),'Login-change recovery did not stop');
  equal(calls,1,'Login/template failure stops instead of retrying in a loop');
  x.window.__ptzoneMobile.restore();equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Failed recovery remains fully reversible');
}
{
  let calls=0,aborted=false;
  const x=boot('torrents.php?page=2',{html:serverPage(100,50),fetch:(url,options)=>{calls++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('Aborted'));},{once:true}));}});
  await until(()=>calls===1,'Recovery request did not start');x.window.__ptzoneMobile.restore();await delay(10);
  ok(aborted,'Switching to original aborts pending recovery');equal(x.document.querySelector('table.mainouter').outerHTML,x.before,'Pending recovery cannot mutate a restored page');
}
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
// Response guards are run independently of the DOM renderer.
function runResponse(req={},res={}){let result;vm.runInNewContext(response,{$request:{url:'https://ptzone.xyz/torrents.php',method:'GET',headers:{'User-Agent':ua},...req},$response:{status:200,headers:{'Content-Type':'text/html'},body:'<!doctype html><html><head><title>fixture</title></head><body><p>native</p></body></html>',...res},$done:x=>{result=x;}});return result;}
ok(runResponse().body?.includes('pzm-bootstrap'),'Allowed document gets payload');
for(const request of [{method:'POST'},{url:'https://ptzone.xyz/download.php?id=1'},{url:'https://example.com/torrents.php'},{headers:{'User-Agent':'Desktop'}},{headers:{'User-Agent':ua,'X-Requested-With':'XMLHttpRequest'}},{headers:{'User-Agent':ua,Range:'bytes=0-20'}},{headers:{'User-Agent':ua,'Sec-Fetch-Dest':'empty'}}])equal(Object.keys(runResponse(request)),[],'Disallowed request is untouched');
for(const res of [{status:302},{headers:{'content-type':'application/json'}},{headers:{'content-type':'text/html','content-security-policy':"script-src 'self'"}},{headers:{'content-type':'text/html','content-disposition':'attachment'}},{body:'<html><head><meta http-equiv="Content-Security-Policy" content="script-src self"></head><body></body></html>'}])equal(Object.keys(runResponse({},res)),[],'Non-document or enforced CSP is untouched');

console.log(JSON.stringify({checks:count,result:'passed',scope:'DOM behavior only; no layout engine'}));

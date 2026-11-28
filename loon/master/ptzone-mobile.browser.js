(function(){"use strict";
// Observed PTZone table, 2026-11-07. Nodes, links and listeners stay in place.
function torrentSchema(table) {
  const header = table.rows[0];
  if (!header) return null;
  const names = { comments: '评论', time: '发布', size: '大小', seeders: '做种', leechers: '下载中', snatched: '完成' };
  const fields = Array.from(header.cells, cell => {
    const icon = cell.querySelector('img[alt]');
    const text = cell.textContent.trim();
    const key = icon && names[icon.alt] ? icon.alt : /標題|标题/.test(text) ? 'title' : /類型|类型/.test(text) ? 'category' : /發佈者|发布者/.test(text) ? 'uploader' : 'extra';
    return { key, label: names[key] || ({title:'标题',category:'分类',uploader:'发布者'})[key] || text || '其他信息' };
  });
  if (!['title','size','seeders'].every(key => fields.some(f => f.key === key))) return null;
  return fields;
}

function torrentRowMatches(row, fields) {
  return row.cells.length === fields.length && !!row.cells[fields.findIndex(f=>f.key==='title')]?.querySelector('a[href*="details.php?"]');
}

function compactTorrentDescription(ctx, cell) {
  const title=cell.querySelector('a[href*="details.php?"]');
  if(!title)return;
  // Only a long, direct subtitle text node is folded. Titles, native tags,
  // promotion/countdown elements and every original control remain visible.
  let afterTitle=false;
  for(const node of Array.from(cell.childNodes)){
    if(node===title || (node.nodeType===1 && node.contains(title)))afterTitle=true;
    if(!afterTitle || node.nodeType!==3 || node.textContent.trim().length<80)continue;
    const wrap=document.createElement('span');wrap.className='pzm-description';
    ctx.add(cell,wrap);node.after(wrap);wrap.appendChild(node);
    ctx.undo.push(()=>{if(wrap.parentNode)wrap.before(node);});
    const toggle=ctx.button('展开简介',()=>{
      const expanded=wrap.classList.toggle('pzm-description-open');
      toggle.textContent=expanded?'收起简介':'展开简介';toggle.setAttribute('aria-expanded',String(expanded));
    });
    toggle.className='pzm-description-toggle';toggle.setAttribute('aria-expanded','false');
    ctx.add(cell,toggle);wrap.after(toggle);
  }
}

function adaptTorrents(ctx, dirtyRows) {
  const tables = Array.from(document.querySelectorAll('#outer table.torrents'));
  if (!tables.length) return false;
  const schemas = tables.map(torrentSchema);
  if (schemas.some(s => !s)) return false;
  tables.forEach((table, tableIndex) => {
    const fields = schemas[tableIndex];
    ctx.cls(table, 'pzm-torrents');
    ctx.cls(table.rows[0], 'pzm-sort');
    Array.from(table.rows[0].cells).forEach((cell,i) => {
      const anchor = cell.querySelector('a');
      if (anchor && !anchor.textContent.trim()) ctx.textBadge(anchor, fields[i].label, 'pzm-sort-label');
    });
    Array.from(table.rows).slice(1).forEach(row => {
      if (dirtyRows && !dirtyRows.has(row)) return;
      if (!torrentRowMatches(row,fields)) {ctx.cls(row,'pzm-torrent-fallback');return;}
      if(row.classList.contains('pzm-torrent-fallback'))row.classList.remove('pzm-torrent-fallback');
      ctx.cls(row, 'pzm-torrent');
      Array.from(row.cells).forEach((cell,i) => {
        ctx.attr(cell, 'data-pzm-field', fields[i].key);
        ctx.attr(cell, 'data-pzm-label', fields[i].label);
      });
      const category = row.querySelector('[data-pzm-field="category"] a');
      if (category) {
        const label=category.querySelector('img')?.alt || '分类';
        const local=/[（(]([^）)]+)[）)]/.exec(label);
        ctx.textBadge(category,local&&/[\u3400-\u9fff]/.test(local[1])?local[1]:label,'pzm-category-label');
        ctx.attr(category,'aria-label',label);
      }
      const nested = row.querySelector('table.torrentname');
      if (nested) {
        ctx.cls(nested, 'pzm-name');
        const cells = Array.from(nested.rows[0]?.cells || []);
        cells.forEach(cell => {
          const isTitle = !!cell.querySelector('a[href*="details.php?"]');
          const isAction = !!cell.querySelector('a[href*="download.php"],a[id^="bookmark"]');
          const isCover = !!cell.querySelector('img.nexus-lazy-load');
          ctx.cls(cell, isAction ? 'pzm-actions' : isTitle ? 'pzm-name-title' : isCover ? 'pzm-cover' : 'pzm-rating');
        });
        nested.querySelectorAll('.pzm-name-title img').forEach(image=>{
          if(!/^(pro_|sticky)/.test(image.className))return;
          if(image.hasAttribute('data-pzm-promoted')) {
            const badge=image.nextElementSibling;
            const label=image.title || ({'Free':'免费','2X Free':'2X 免费','Sticky':'置顶'})[image.alt] || image.alt;
            if(badge?.classList.contains('pzm-promotion') && badge.textContent!==label)badge.textContent=label;
            return;
          }
          ctx.attr(image,'data-pzm-promoted','');
          const label=document.createElement('span');label.className='pzm-promotion';
          label.textContent=image.title || ({'Free':'免费','2X Free':'2X 免费','Sticky':'置顶'})[image.alt] || image.alt;
          if(label.textContent){ctx.add(image.parentElement,label);image.after(label);}
          if(!image.closest('a,button,[onclick]'))ctx.attr(image,'data-pzm-promo-text','');
        });
        const titleCell=cells.find(c=>c.classList.contains('pzm-name-title'));
        if(titleCell)compactTorrentDescription(ctx,titleCell);
      }
      if (!ctx.bound.has(row)) {
        ctx.bound.add(row);
        ctx.listen(row, 'click', event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (event.target.closest('a,button,input,select,textarea,label,[role="button"]') || window.getSelection()?.toString()) return;
          const anchor = row.querySelector('.pzm-name-title a[href*="details.php?"]');
          // Use the original anchor, including target and the site's click handlers.
          if (anchor) anchor.click();
        });
      }
    });
  });
  const form = document.querySelector('form[name="searchbox"]');
  const advanced = document.getElementById('ksearchboxmain');
  if (form && advanced && !form.querySelector('[data-pzm-advanced]')) {
    ctx.cls(form, 'pzm-search');
    const cell = form.querySelector('table.searchbox > tbody:first-child td');
    if (cell) {
      const button = ctx.button('高级筛选', () => {
        const open = advanced.style.display === 'none';
        advanced.style.display = open ? '' : 'none';
        button.setAttribute('aria-expanded', String(open));
      });
      button.setAttribute('data-pzm-advanced','');
      button.setAttribute('aria-controls', advanced.id);
      button.setAttribute('aria-expanded',String(advanced.style.display !== 'none'));
      const initial = advanced.getAttribute('style');
      ctx.undo.push(() => initial === null ? advanced.removeAttribute('style') : advanced.setAttribute('style',initial));
      ctx.add(cell,button);
      const basicRows=form.querySelector('table.searchbox > tbody:last-child > tr > td > table')?.rows;
      if(basicRows && basicRows.length>1){
        Array.from(basicRows).slice(1).forEach(row=>ctx.cls(row,'pzm-suggestions'));
        const suggestions=ctx.button('热门词与标签',()=>{
          form.classList.toggle('pzm-suggestions-open');
          suggestions.setAttribute('aria-expanded',String(form.classList.contains('pzm-suggestions-open')));
        });
        suggestions.className='pzm-suggestions-toggle';suggestions.setAttribute('aria-expanded','false');
        ctx.undo.push(()=>form.classList.remove('pzm-suggestions-open'));
        ctx.add(cell,suggestions);
      }
    }
    form.querySelectorAll('td').forEach(cell => {
      const checkbox = cell.querySelector(':scope > input[type="checkbox"][id]');
      const image = cell.querySelector('a > img[alt]');
      if (checkbox && image) {
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.className = 'pzm-filter-label';
        label.textContent = image.alt;
        ctx.add(cell,label);
        ctx.attr(checkbox,'aria-label',image.alt);
      }
    });
    if (!form.querySelector('input[name="search"]')?.getAttribute('aria-label')) ctx.attr(form.querySelector('input[name="search"]'),'aria-label','搜索关键词');
  }
  adaptQuickFilters(ctx, form);
  adaptSearchOptions(ctx, form);
  return true;
}

// Home widgets are content lists, not wide data grids. Match the observed
// headers AND native destinations before changing any layout.
function homeListSchema(table) {
  if (table.querySelector('table') || !table.rows.length) return null;
  const header = table.rows[0];
  if (!Array.from(header.cells).every(cell => cell.classList.contains('colhead'))) return null;
  const labels = Array.from(header.cells, cell => cell.textContent.trim().replace(/\s+/g, ''));
  let fields = null, type = null;
  if (labels.length === 4 && /^(標題|标题)$/.test(labels[0]) && labels[1] === '查看' && labels[2] === '作者' && /^(發表時間|发表时间)$/.test(labels[3])) {
    type = 'posts'; fields = ['title', 'views', 'author', 'time'];
  } else if (labels.length === 3 && /^(標題|标题)$/.test(labels[0]) && /^(做種|做种)$/.test(labels[1]) && /^(下載|下载)$/.test(labels[2])) {
    type = 'torrents'; fields = ['title', 'seeders', 'leechers'];
  } else if (labels.length === 3 && labels[0] === '作者' && /^(數量|数量)$/.test(labels[1]) && labels[2] === '排名' && table.classList.contains('top-uploader')) {
    type = 'uploaders'; fields = ['author', 'count', 'rank'];
  }
  if (!fields) return null;
  const data = Array.from(table.rows).slice(1);
  for (const row of data) {
    if (row.cells.length !== fields.length) return null;
    const cell = row.cells[0];
    const link = Array.from(cell.querySelectorAll('a[href]')).some(a => {
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        if (url.origin !== location.origin) return false;
        return type === 'posts' ? url.pathname === '/forums.php' && url.searchParams.get('action') === 'viewtopic' :
          type === 'torrents' ? url.pathname === '/details.php' : url.pathname === '/userdetails.php';
      } catch (_) { return false; }
    });
    if (!link) return null;
  }
  return {type, fields, header, rows:data, labels};
}

// These groups match the logged-in site's H2 + sibling structure. Moving
// existing nodes preserves forms, native listeners, IDs, and iframe state.
function arrangeHome(ctx, outer) {
  if (outer.querySelector('.pzm-home-section')) return;
  const groups = [];
  for (const heading of Array.from(outer.querySelectorAll('h2'))) {
    const text = heading.textContent.trim();
    const key = /^(最近消息|最新公告)/.test(text) ? 'news' : /^最近.*[種种]子/.test(text) ? 'recent' :
      /^群聊/.test(text) ? 'chat' : /^幸[運运]大[轉转][盤盘]/.test(text) ? 'lucky' : null;
    if (!key) continue;
    const nodes = [heading];
    for (let node = heading.nextSibling; node && !(node.nodeType===1 && /^H[12]$/.test(node.tagName)); node=node.nextSibling) nodes.push(node);
    const section = document.createElement('section'); section.className='pzm-home-section';
    section.setAttribute('data-pzm-home-section',key);
    ctx.add(heading.parentElement,section,false);heading.before(section);
    nodes.forEach(node=>ctx.move(node,section));
    if (key !== 'recent') {
      ctx.cls(section,'pzm-home-folded');
      const label = key==='news'?'公告':key==='chat'?'聊天':'抽奖记录';
      const toggle=ctx.button('展开'+label,()=>{
        const open=section.classList.toggle('pzm-home-folded')===false;
        toggle.textContent=(open?'收起':'展开')+label;
        toggle.setAttribute('aria-expanded',String(open));
      });
      toggle.className='pzm-section-toggle';toggle.setAttribute('aria-expanded','false');
      ctx.add(heading,toggle);
      if (key==='news') {
        const original=section.querySelector('a[href*="klappe_news"]');
        if (original) {const summary=document.createElement('p');summary.className='pzm-news-summary';summary.textContent=original.textContent.replace(/Show\/Hide/gi,'').trim();ctx.add(section,summary);heading.after(summary);}
      }
    }
    groups.push({key,section});
  }
  const news=groups.find(g=>g.key==='news')?.section,recent=groups.find(g=>g.key==='recent')?.section;
  if(news && recent && news.parentNode===recent.parentNode)ctx.move(recent,news.parentNode,news.nextSibling);
}

function nativeLink(ctx, original, label) {
  const anchor=document.createElement('a');anchor.textContent=label;
  anchor.setAttribute('href',original.getAttribute('href'));
  for(const name of ['target','rel','download'])if(original.hasAttribute(name))anchor.setAttribute(name,original.getAttribute(name));
  ctx.listen(anchor,'click',event=>{
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();original.click();
  });
  return anchor;
}

function adaptQuickFilters(ctx, form) {
  if(!form || form.querySelector('.pzm-quick-filters'))return;
  const filters=document.createElement('div');filters.className='pzm-quick-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','常用筛选');
  for(const [name,label] of [['spstate','促销'],['incldead','种子状态'],['inclbookmarked','收藏']]) {
    const original=form.querySelector('select[name="'+name+'"]');
    if(!original)continue;
    // The native select is moved rather than duplicated; FormData stays exact.
    const item=document.createElement('label'),text=document.createElement('span');text.textContent=label;item.appendChild(text);
    filters.appendChild(item);ctx.move(original,item);
  }
  if(!filters.children.length)return;
  ctx.add(form,filters,false);
  const table=form.querySelector('table.searchbox');
  if(table)table.after(filters);
}

function adaptSearchOptions(ctx, form) {
  if(!form||form.querySelector('.pzm-search-options'))return;
  const area=form.querySelector('select[name="search_area"]'),mode=form.querySelector('select[name="search_mode"]');
  if(!area||!mode)return;
  const cell=area.closest('td');
  // Only restructure the inspected same-cell template. Unknown layouts stay native.
  if(!cell||mode.closest('td')!==cell)return;
  ctx.cls(cell,'pzm-search-choice-cell');
  const options=document.createElement('div');options.className='pzm-search-options';ctx.add(cell,options,false);
  for(const node of Array.from(cell.childNodes)) {
    if(node.nodeType!==3||!node.textContent.trim())continue;
    const wrap=document.createElement('span');wrap.className='pzm-search-old-label';ctx.add(cell,wrap,false);node.before(wrap);ctx.move(node,wrap);
  }
  for(const [original,name] of [[area,'搜索范围'],[mode,'匹配方式']]) {
    const label=document.createElement('label'),text=document.createElement('span');text.textContent=name;label.appendChild(text);options.appendChild(label);ctx.move(original,label);ctx.attr(original,'aria-label',name);
  }
  for(const option of Array.from(mode.querySelectorAll('option'))) {
    const label=({'0':'全部关键词','2':'整段匹配'})[option.getAttribute('value')];
    if(label&&option.textContent!==label){const before=option.textContent;ctx.undo.push(()=>{option.textContent=before;});option.textContent=label;}
  }
  const hint=document.createElement('p');hint.className='pzm-search-match-hint';ctx.add(options,hint);
  const update=()=>{hint.textContent=String(mode.value)==='2'?'按输入的整段文字查找，顺序和间隔需一致。':'每个关键词都要出现，位置可以分开。';};
  ctx.listen(mode,'change',update);update();
}

function adaptDetails(ctx, outer) {
  if(outer.querySelector('.pzm-detail-actions'))return;
  const main=Array.from(outer.querySelectorAll('table')).find(t=>Array.from(t.rows).some(r=>r.cells[0]?.classList.contains('rowhead') && /^(下載|下载)$/.test(r.cells[0].textContent.trim())));
  if(!main)return;
  ctx.cls(main,'pzm-detail-main');
  const download=Array.from(main.querySelectorAll('a[href]')).find(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin && u.pathname==='/download.php' && u.searchParams.has('id');}catch(_){return false;}});
  const bookmark=main.querySelector('a[id^="bookmark"]');
  const actions=document.createElement('div');actions.className='pzm-detail-actions';actions.setAttribute('aria-label','种子操作');
  ctx.add(main.parentElement,actions,false);main.before(actions);
  if(download)ctx.add(actions,nativeLink(ctx,download,'下载种子'));
  if(bookmark)ctx.move(bookmark,actions);
  for(const row of Array.from(main.rows)) {
    if(row.cells.length!==2)continue;
    const name=row.cells[0].textContent.trim().replace(/\s+/g,'');
    if(/MediaInfo|BDInfo|種子檔案|种子文件|種子文件/.test(name)) {
      ctx.cls(row,'pzm-detail-section');ctx.cls(row,'pzm-detail-folded');
      const button=ctx.button('展开',()=>{const open=!row.classList.toggle('pzm-detail-folded');button.textContent=open?'收起':'展开';button.setAttribute('aria-expanded',String(open));});
      button.className='pzm-section-toggle';button.setAttribute('aria-expanded','false');ctx.add(row.cells[0],button);
    }
    const native=row.cells[0].querySelector('a[href*="klappe_news"]');
    if(native){ctx.cls(native,'pzm-native-section-toggle');ctx.attr(native,'aria-label','展开或收起简介');}
  }
}

function accountAnchor(info,path,predicate) {
  return Array.from(info.querySelectorAll('a[href]')).find(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&u.pathname===path&&(!predicate||predicate(u));}catch(_){return false;}});
}

function nextText(node) {
  let text='';
  for(let next=node?.nextSibling;next;next=next.nextSibling){if(next.nodeType===1&&next.tagName==='A')break;text+=next.textContent||'';}
  return text;
}

function accountValues(info) {
  const source=info.textContent.replace(/\s+/g,' '),stats={};
  for(const [key,pattern] of [['ratio',/分享率\s*[:：]\s*([\d.,]+|∞)/],['upload',/上[傳传]量\s*[:：]\s*([\d.,]+\s*[KMGTPE]?B)/i],['download',/下[載载]量\s*[:：]\s*([\d.,]+\s*[KMGTPE]?B)/i],['bonus',/魔力值\s*\[[^\]]*\]\s*[:：]\s*([\d.,]+)/]])stats[key]=pattern.exec(source)?.[1]||'—';
  const activity={};
  for(const [key,alt] of [['seeding','Torrents seeding'],['leeching','Torrents leeching']]){const image=Array.from(info.querySelectorAll('img')).find(i=>i.alt===alt);const number=/^\s*([\d,]+)/.exec(nextText(image));if(number)activity[key]=number[1];}
  activity.connect=/可[連连]接\s*[:：]\s*([^\s]+)/.exec(source)?.[1];
  const inbox=accountAnchor(info,'/messages.php',u=>!u.searchParams.get('box'));
  const mail=/(\d[\d,]*)\s*\(\s*(\d+)\s*新\s*\)/.exec(nextText(inbox));
  const attendance=accountAnchor(info,'/attendance.php');
  return {stats,activity,unread:mail?mail[2]:null,signed:!!attendance&&/已得|已[簽签]/.test(attendance.textContent)};
}

function buildAccountCard(ctx,info,top) {
  const card=document.createElement('section');card.className=top?'pzm-account-panel':'pzm-account-dashboard';card.setAttribute('aria-label',top?'账户信息':'我的账户');
  const header=document.createElement('header');header.className='pzm-account-heading';card.appendChild(header);
  const profile=accountAnchor(info,'/userdetails.php'),settings=accountAnchor(info,'/usercp.php');
  if(profile){const name=nativeLink(ctx,profile,profile.textContent.trim());name.className='pzm-account-name';ctx.add(header,name);}
  if(settings)ctx.add(header,nativeLink(ctx,settings,'账户设置'));
  const stats=document.createElement('dl');stats.className='pzm-account-stats';card.appendChild(stats);
  for(const [key,label] of [['ratio','分享率'],['upload','上传量'],['download','下载量'],['bonus','魔力值']]){const item=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');name.textContent=label;value.setAttribute('data-pzm-stat',key);item.append(name,value);stats.appendChild(item);}
  const activity=document.createElement('div');activity.className='pzm-account-activity';card.appendChild(activity);
  for(const [key,label]of [['seeding','做种'],['leeching','下载中'],['connect','可连接']]){const item=document.createElement('span');item.setAttribute('data-pzm-activity',key);item.setAttribute('data-pzm-label',label);activity.appendChild(item);}
  const links=document.createElement('nav');links.className='pzm-account-links';links.setAttribute('aria-label','账户常用入口');card.appendChild(links);
  const used=new Set([profile,settings]);
  for(const [path,label,predicate] of [['/torrents.php','我的收藏',u=>u.searchParams.get('inclbookmarked')==='1'],['/mybonus.php','魔力中心'],['/attendance.php','签到页面'],['/task.php','任务中心'],['/medal.php','我的勋章'],['/messages.php','站内消息',u=>!u.searchParams.get('box')]]){
    const original=accountAnchor(info,path,predicate);if(!original)continue;used.add(original);
    const anchor=nativeLink(ctx,original,label);anchor.setAttribute('data-pzm-account-path',path);ctx.add(links,anchor);
  }
  const more=document.createElement('details');more.className='pzm-account-more';
  const summary=document.createElement('summary');summary.textContent='更多账户信息';more.appendChild(summary);card.appendChild(more);
  const extra=document.createElement('nav');extra.className='pzm-account-extra';more.appendChild(extra);
  const names={'/invite.php':'邀请管理','/claim.php':'我的认领','/friends.php':'好友列表','/getrss.php':'RSS订阅','/messages.php':'发件箱','/logout.php':'退出登录'};
  // Every remaining native link is retained, including future site additions.
  for(const original of Array.from(info.querySelectorAll('a[href]'))){if(used.has(original))continue;let path='';try{path=new URL(original.getAttribute('href'),location.href).pathname;}catch(_){}const label=names[path]||original.textContent.trim()||original.querySelector('img')?.alt||'原站入口';ctx.add(extra,nativeLink(ctx,original,label));}
  if(top){const raw=ctx.button('查看原始账户信息',()=>{const open=!info.classList.contains('pzm-account-raw-open');info.classList.toggle('pzm-account-raw-open',open);raw.setAttribute('aria-expanded',String(open));raw.textContent=open?'收起原始账户信息':'查看原始账户信息';});raw.setAttribute('aria-expanded','false');ctx.add(more,raw);}
  ctx.accountCards.push(card);return card;
}

function refreshAccountCards(ctx) {
  const info=document.getElementById('info_block');if(!info)return;
  const values=accountValues(info);
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  for(const card of ctx.accountCards){
    card.querySelectorAll('[data-pzm-stat]').forEach(node=>text(node,values.stats[node.getAttribute('data-pzm-stat')]));
    card.querySelectorAll('[data-pzm-activity]').forEach(node=>{const value=values.activity[node.getAttribute('data-pzm-activity')];node.hidden=!value;if(value)text(node,node.getAttribute('data-pzm-label')+' '+value);});
    const attendance=card.querySelector('[data-pzm-account-path="/attendance.php"]');if(attendance)text(attendance,values.signed?'今日已签':'签到页面');
    const messages=card.querySelector('[data-pzm-account-path="/messages.php"]');if(messages)text(messages,values.unread&&values.unread!=='0'?'消息 · '+values.unread+'未读':'站内消息');
  }
}

function adaptAccountPanel(ctx) {
  const info=document.getElementById('info_block');if(!info)return null;
  let panel=document.getElementById('pzm-account-panel');
  if(!panel){panel=buildAccountCard(ctx,info,true);panel.id='pzm-account-panel';ctx.add(info.parentElement,panel);info.before(panel);ctx.cls(info,'pzm-account-source');ctx.undo.push(()=>info.classList.remove('pzm-account-raw-open'));}
  return panel;
}

function adaptAccount(ctx,outer) {
  if(outer.querySelector('.pzm-account-dashboard'))return;
  const info=document.getElementById('info_block');if(!info)return;
  const card=buildAccountCard(ctx,info,false);ctx.add(outer,card);outer.prepend(card);
}

function adaptAttendance(ctx,outer) {
  if(outer.querySelector('.pzm-attendance-card'))return;
  const list=Array.from(outer.querySelectorAll('ul')).find(ul=>!ul.parentElement.closest('ul,ol')&&/^首次[簽签]到/.test(ul.querySelector('li')?.textContent.trim()||'')&&/[連连][續续][簽签]到/.test(ul.textContent));
  if(!list)return;
  const card=document.createElement('section');card.className='pzm-attendance-card';card.setAttribute('aria-label','签到规则');
  const title=document.createElement('h2');title.textContent='签到规则';card.appendChild(title);ctx.add(list.parentElement,card,false);list.before(card);ctx.move(list,card);ctx.cls(list,'pzm-attendance-rules');
  for(const li of Array.from(list.children)){
    const milestones=li.querySelector('ol');if(!milestones){ctx.cls(li,'pzm-attendance-basic');continue;}
    ctx.cls(li,'pzm-attendance-bonus-group');ctx.cls(milestones,'pzm-attendance-milestones');
    for(const item of Array.from(milestones.children)){
      if(item.children.length)continue;
      const match=/^\s*(?:連續|连续)[簽签]到第\s*(\d+)\s*天[，,]\s*(?:額外|额外)[獲获]得\s*([\d,]+)\s*魔力值[。.]?\s*$/.exec(item.textContent);
      if(!match)continue;
      const original=Array.from(item.childNodes),source=document.createElement('span');source.className='pzm-rule-original';ctx.add(item,source,false);original.forEach(node=>ctx.move(node,source));
      const day=document.createElement('span'),reward=document.createElement('strong');day.className='pzm-rule-day';reward.className='pzm-rule-reward';day.textContent='连续 '+match[1]+' 天';reward.textContent='+'+match[2]+' 魔力值';day.setAttribute('aria-hidden','true');reward.setAttribute('aria-hidden','true');ctx.add(item,day);ctx.add(item,reward);ctx.cls(item,'pzm-attendance-milestone');
    }
  }
}

function adaptSiteFooter(ctx,outer) {
  if(outer)outer.querySelectorAll('img.img-browser').forEach(image=>{
    const label=/Chrome/i.test(image.alt)?'Chrome':/Firefox/i.test(image.alt)?'Firefox':/qBittorrent/i.test(image.alt)?'qBittorrent':/Transmission/i.test(image.alt)?'Transmission':null;
    if(!label)return;ctx.cls(image,'pzm-footer-icon');const font=image.closest('font');if(font)ctx.cls(font,'pzm-browser-advice');const anchor=image.closest('a');if(anchor)ctx.textBadge(anchor,label,'pzm-footer-caption');
  });
  if(outer)outer.querySelectorAll('a[title="NexusPHP"]>img[alt="NexusPHP"]').forEach(image=>ctx.cls(image,'pzm-footer-brand'));
  const footer=document.getElementById('footer');if(!footer||footer.querySelector('.pzm-footer-diagnostics'))return;
  for(const parent of [footer,...footer.querySelectorAll('div')]){
    const nodes=Array.from(parent.childNodes),start=nodes.findIndex(node=>node.nodeType===3&&/^\s*\[page created in\b/i.test(node.textContent));
    if(start<0)continue;
    let first=start;while(first>0&&(nodes[first-1].nodeType===1&&nodes[first-1].tagName==='BR'||nodes[first-1].nodeType===3&&!nodes[first-1].textContent.trim()))first--;
    // Hide only the recognized diagnostics tail, retaining every original node.
    if(!/\]\s*$/.test(nodes.slice(start).map(n=>n.textContent).join('')))continue;
    const wrap=document.createElement('span');wrap.className='pzm-footer-diagnostics';ctx.add(parent,wrap,false);nodes.slice(first).forEach(node=>ctx.move(node,wrap));break;
  }
}

function listingRange(outer) {
  for(const node of outer.querySelectorAll('p font.gray,p span.gray')){
    const match=/^\s*([\d,]+)\s*[-–]\s*([\d,]+)\s*$/.exec(node.textContent);
    if(match){const start=Number(match[1].replace(/,/g,''))-1,end=Number(match[2].replace(/,/g,''));if(start>=0&&end>start)return {start,end};}
  }
  return null;
}

function nativeTorrentId(row) {
  const anchor=row.querySelector('table.torrentname a[href*="details.php?"]');
  if(!anchor)return null;
  try{const u=new URL(anchor.getAttribute('href'),location.href),id=u.searchParams.get('id');return u.origin===location.origin&&u.pathname==='/details.php'&&/^[1-9]\d*$/.test(id||'')?id:null;}catch(_){return null;}
}

function recoveryRow(source,fields) {
  const id=nativeTorrentId(source);if(!id)return null;
  const row=document.importNode(source,true),missing=!torrentRowMatches(row,fields);
  row.querySelectorAll('script,link[rel="stylesheet"]').forEach(node=>node.remove());
  if(missing){
    while(row.cells.length<fields.length){const cell=document.createElement('td');cell.className='rowfollow';cell.textContent='—';row.appendChild(cell);}
    const name=row.querySelector('table.torrentname'),title=name?.querySelector('a[href*="details.php?"]')?.closest('td');
    if(!name||!title)return null;
    const note=document.createElement('span');note.className='pzm-source-missing-note';note.textContent='原站未返回本条的评分与统计信息';title.appendChild(note);
    // The native document stops before its actions. Use verified same-site
    // destinations; bookmark state is unknown, so open details for that action.
    const cell=document.createElement('td');cell.className='embedded';
    const download=document.createElement('a');download.href='/download.php?id='+id;
    const details=document.createElement('a');details.setAttribute('href',title.querySelector('a[href*="details.php?"]').getAttribute('href'));details.textContent='详情 / 收藏';cell.append(download,details);name.rows[0].appendChild(cell);
    row.setAttribute('data-pzm-source-missing','');
  }
  // Each server fragment starts bookmark counters at zero. Keep native bookmark
  // handlers, assigning each imported control a unique counter on this page.
  row.querySelectorAll('a[id^="bookmark"]').forEach(anchor=>{
    const href=anchor.getAttribute('href')||'',match=/^javascript:\s*bookmark\(\s*(\d+)\s*,\s*\d+\s*\);?\s*$/.exec(href);
    if(match){const counter=1000000000+Number(match[1]);anchor.id='bookmark'+counter;anchor.setAttribute('href','javascript: bookmark('+match[1]+','+counter+');');}
  });
  return {row,missing};
}

function adaptHome(ctx, outer) {
  arrangeHome(ctx, outer);
  const names = {title:'标题',views:'查看',author:'作者',time:'发表时间',seeders:'做种',leechers:'下载中',count:'数量',rank:'排名'};
  outer.querySelectorAll('table').forEach(table => {
    const schema = homeListSchema(table);
    if (schema) {
      ctx.cls(table, 'pzm-home-list');
      ctx.attr(table, 'data-pzm-home-type', schema.type);
      ctx.cls(schema.header, 'pzm-home-header');
      // Text-only headers become per-field labels. Never hide header controls.
      if (!schema.header.querySelector('a,button,input,select,textarea')) ctx.cls(schema.header, 'pzm-home-static-header');
      schema.rows.forEach(row => {
        ctx.cls(row, 'pzm-home-card');
        Array.from(row.cells).forEach((cell, index) => {
          const field = schema.fields[index];
          ctx.attr(cell, 'data-pzm-home-field', field);
          ctx.attr(cell, 'data-pzm-home-label', names[field] || schema.labels[index]);
        });
      });
    } else if (table.classList.contains('pzm-home-list')) {
      // A recognized widget changed shape after an asynchronous update.
      // The caller's transaction restores this page instead of guessing.
      throw new Error('Home widget structure changed');
    } else if (!table.querySelector('table') && Array.from(table.rows).some(row=>row.cells.length===4) && Array.from(table.rows).every(row =>
      row.cells.length === 1 ? row.cells[0].colSpan === 4 && row.cells[0].classList.contains('rowhead') :
      row.cells.length === 4 && [0,2].every(i => row.cells[i].classList.contains('rowhead')) && [1,3].every(i => row.cells[i].classList.contains('rowfollow')))) {
      ctx.cls(table, 'pzm-home-stats');
      Array.from(table.rows).forEach(row => {
        if(row.cells.length===1)ctx.cls(row,'pzm-home-stats-section');
        else Array.from(row.cells).forEach((cell,index) => ctx.attr(cell, 'data-pzm-home-stat', String(index)));
      });
    }
  });
}

function adaptPagination(ctx,outer) {
  const isStep=(text,dir)=>dir==='prev'?/上一[页頁]|previous|\bprev\b/i.test(text):/下一[页頁]|\bnext\b/i.test(text);
  outer.querySelectorAll('p').forEach(p=>{
    if(p.classList.contains('pzm-native-pager') || p.closest('[data-pzm-owned]'))return;
    const links=Array.from(p.querySelectorAll('a[href]')).filter(a=>{
      try {const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&u.pathname===location.pathname&&u.searchParams.has('page');}catch(_){return false;}
    });
    if(!links.length)return;
    const nativePrev=links.find(a=>isStep(a.textContent,'prev'));
    const nativeNext=links.find(a=>isStep(a.textContent,'next'));
    const page=new URLSearchParams(location.search).get('page');
    const current=/^\d+$/.test(page||'')?Number(page)+1:page?null:1;
    ctx.cls(p,'pzm-native-pager');
    const nav=document.createElement('nav');nav.className='pzm-pagination';nav.setAttribute('aria-label','页面切换');
    const step=(original,label)=>{
      if(!original){const b=ctx.button(label,()=>{});b.disabled=true;return b;}
      const a=document.createElement('a');a.setAttribute('href',original.getAttribute('href'));a.textContent=label;
      // Dispatch through the native anchor; do not rebuild search parameters.
      ctx.listen(a,'click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();original.click();});
      return a;
    };
    const center=ctx.button(current?'第 '+current+' 页 ▾':'选择页码 ▾',()=>{
      const open=p.classList.toggle('pzm-pager-open');center.setAttribute('aria-expanded',String(open));
    });center.className='pzm-page-select';center.setAttribute('aria-expanded','false');
    ctx.undo.push(()=>p.classList.remove('pzm-pager-open'));
    nav.append(step(nativePrev,'‹ 上一页'),center,step(nativeNext,'下一页 ›'));
    ctx.add(p.parentElement,nav);p.before(nav);
    links.forEach(a=>{if(isStep(a.textContent,'prev')||isStep(a.textContent,'next'))ctx.cls(a,'pzm-native-step');});
    p.querySelectorAll('font.gray,span.gray').forEach(node=>{
      if(/\d[\d,]*\s*[-–]\s*\d/.test(node.textContent))ctx.cls(node,'pzm-page-current');
      else if(isStep(node.textContent,'prev')||isStep(node.textContent,'next'))ctx.cls(node,'pzm-native-step');
    });
  });
}

function adaptContent(ctx, kind) {
  const outer = document.getElementById('outer');
  if (!outer) return false;
  if (kind === 'details' && !document.getElementById('kdescr')) return false;
  ctx.cls(outer, 'pzm-content');
  if (kind === 'home') adaptHome(ctx, outer);
  outer.querySelectorAll('td.rowhead,td.rowhead_left,td.rowhead_center').forEach(cell => {
    const table = cell.closest('table');
    if (table && !table.closest('#calendar,.fc')) ctx.cls(table,'pzm-kv');
  });
  outer.querySelectorAll('table[id^="pid"],table[id^="cid"]').forEach(table => ctx.cls(table,'pzm-post'));
  outer.querySelectorAll('div[id^="pid"][id$="body"],table[id^="cid"] + table').forEach(body=>{
    const table=body.matches('table')?body:body.closest('table');
    if(table)ctx.cls(table,'pzm-post-body');
  });
  outer.querySelectorAll('td').forEach(cell=>{
    if(cell.querySelectorAll(':scope > a > img[alt="poster"]').length>=4)ctx.cls(cell,'pzm-hotrail');
  });
  // A table is a record list only when the observed header and native links agree.
  outer.querySelectorAll('table').forEach(table => {
    if (table.closest('#calendar,.fc,.pzm-torrents,.pzm-name,.pzm-post,.pzm-post-body') || table.classList.contains('pzm-kv') || table.classList.contains('pzm-home-list')) return;
    const rows = Array.from(table.rows);
    if (!rows.length) return;
    const header = rows.find(r => r.cells.length >= 3 && Array.from(r.cells).every(c => c.classList.contains('colhead')));
    const isForum = kind.startsWith('forum') && !!table.querySelector('a[href*="action=viewforum"],a[href*="action=viewtopic"]');
    const isMail = kind === 'messages' && !!table.querySelector('input[name="messages[]"]');
    if (header && (isForum || isMail)) {
      ctx.cls(table,'pzm-records');
      ctx.cls(header,'pzm-record-header');
      if(isForum && rows.filter(r=>r.cells.length && Array.from(r.cells).every(c=>c.classList.contains('colhead'))).length>1 && !header.querySelector('a,button,input,select'))ctx.cls(header,'pzm-record-section');
      const labels = Array.from(header.cells,c=>c.textContent.trim() || c.querySelector('img')?.alt || '选择');
      for (const row of rows) {
        if (row === header) continue;
        if (Array.from(row.cells).every(cell => cell.classList.contains('colhead'))) {
          ctx.cls(row,row.querySelector('a,button,input,select')?'pzm-record-header':'pzm-record-section');
          continue;
        }
        if (row.cells.length === labels.length) {
          ctx.cls(row,'pzm-record');
          Array.from(row.cells).forEach((cell,i)=>ctx.attr(cell,'data-pzm-label',labels[i]));
        }
      }
    } else if (rows.some(r => r.cells.length >= 3) && !table.querySelector('table')) {
      ctx.cls(table,'pzm-scroll');
      ctx.attr(table,'tabindex','0');
      ctx.attr(table,'aria-label','数据表，可在表内左右滑动');
    } else if (rows.every(r=>r.cells.length === 1)) {
      ctx.cls(table,'pzm-layout');
    }
  });
  // Key/value forms with a single spanning introductory row (upload, usercp).
  outer.querySelectorAll('form > table').forEach(table => {
    if (!table.classList.contains('pzm-scroll') && Array.from(table.rows).some(r=>r.cells[0]?.classList.contains('rowhead'))) ctx.cls(table,'pzm-kv');
  });
  adaptPagination(ctx,outer);
  if (kind === 'details') {
    outer.querySelectorAll('a[href*="download.php?"]').forEach(a=>ctx.cls(a,'pzm-download'));
    adaptDetails(ctx, outer);
  }
  if (kind === 'usercp' && !new URLSearchParams(location.search).has('action')) adaptAccount(ctx, outer);
  if (kind === 'attendance') adaptAttendance(ctx, outer);
  adaptSiteFooter(ctx,outer);
  return true;
}

function startMobile(css, version) {
  if (window.__ptzoneMobile || !/iPhone|iPod/i.test(navigator.userAgent)) return;
  if (location.hostname !== 'ptzone.xyz') return;
  const kinds = {
    '/':'home','/index.php':'home','/torrents.php':'torrents','/details.php':'details',
    '/forums.php':'forums','/usercp.php':'usercp','/userdetails.php':'userdetails',
    '/messages.php':'messages','/subtitles.php':'subtitles','/topten.php':'topten',
    '/rules.php':'rules','/faq.php':'faq','/contactstaff.php':'contactstaff',
    '/task.php':'task','/medal.php':'medal','/claim.php':'claim','/mybonus.php':'mybonus',
    '/friends.php':'friends','/getrss.php':'getrss','/upload.php':'upload','/invite.php':'invite',
    '/attendance.php':'attendance','/login.php':'login','/shoutbox.php':'shoutbox','/sendmessage.php':'sendmessage'
  };
  let kind = kinds[location.pathname];
  if (!kind) return;
  if (kind === 'forums') {
    const action = new URLSearchParams(location.search).get('action') || 'index';
    if (!['index','viewforum','viewtopic','search','viewunread','newtopic','quotepost','editpost','postreply','reply'].includes(action)) return;
    kind = 'forum-' + action;
  }
  const login = kind === 'login' && document.getElementById('login-form');
  const inframe = kind === 'shoutbox' && document.body.classList.contains('inframe');
  if (!login && !inframe && (!document.querySelector('body > table.mainouter') || !document.getElementById('outer'))) return;
  const key = 'ptzone.mobile.v1';
  let prefs = { mode:'mobile', disabled:[] };
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (data && ['original','mobile'].includes(data.mode) && Array.isArray(data.disabled)) prefs = {mode:data.mode,disabled:data.disabled.filter(v=>typeof v==='string').slice(0,50)};
  } catch (_) { /* Private browsing/storage denial: in-memory choices still work. */ }
  const save = () => { try { localStorage.setItem(key,JSON.stringify(prefs)); } catch (_) {} };
  const style = document.createElement('style');
  style.id = 'pzm-style'; style.textContent = css; document.head.appendChild(style);
  let ctx = null, observer = null, timer = null, active = false, failureReason = '';
  let pendingFull=false, pendingActions=false, pendingAccount=false;
  const pendingRows=new Set();
  const observe=()=>observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['alt','class']});
  function context() {
    const values = new WeakMap(), moved = new WeakSet();
    return {
      undo:[], bound:new WeakSet(), accountCards:[],
      cls(node,name) { if(node && !node.classList.contains(name)) {const hadClass=node.hasAttribute('class');node.classList.add(name);this.undo.push(()=>{node.classList.remove(name);if(!hadClass&&!node.className)node.removeAttribute('class');});} },
      attr(node,name,value) {
        if (!node || node.getAttribute(name) === value) return;
        let map=values.get(node);if(!map){map=new Map();values.set(node,map);}
        if(!map.has(name)){const old=node.getAttribute(name);map.set(name,old);this.undo.push(()=>old===null?node.removeAttribute(name):node.setAttribute(name,old));}
        node.setAttribute(name,value);
      },
      add(parent,node,owned=true) {if(owned)node.setAttribute('data-pzm-owned','');parent.appendChild(node);this.undo.push(()=>node.remove());return node;},
      move(node,parent,before=null) {
        if(!moved.has(node)){moved.add(node);const from=node.parentNode,next=node.nextSibling;this.undo.push(()=>{if(from)from.insertBefore(node,next?.parentNode===from?next:null);});}
        parent.insertBefore(node,before);
      },
      listen(node,event,fn) {node.addEventListener(event,fn);this.undo.push(()=>node.removeEventListener(event,fn));},
      button(text,fn) {const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;},
      textBadge(parent,text,name) {
        let badge=Array.from(parent.children).find(e=>e.classList.contains(name));
        if(!badge){badge=document.createElement('span');badge.className=name;this.add(parent,badge);}
        if(badge.textContent!==text)badge.textContent=text;
      }
    };
  }
  function actions(rows) {
    const anchors=rows ? Array.from(rows).flatMap(row=>Array.from(row.querySelectorAll('.pzm-actions a'))) : document.querySelectorAll('.pzm-actions a,.pzm-detail-actions a');
    anchors.forEach(a=>{
      const image=a.querySelector('img');
      const isBookmark=/^bookmark\d+$/.test(a.id);
      let label=isBookmark ? (image?.alt==='Bookmarked'?'已收藏':'收藏') : /download\.php/.test(a.getAttribute('href')||'')?'下载种子':null;
      if(isBookmark&&ctx.recovery&&typeof window.bookmark!=='function'){
        const original=a.closest('tr.pzm-torrent')?.querySelector('.pzm-name-title a[href*="details.php?"]');
        if(original){ctx.attr(a,'href',original.getAttribute('href'));label='详情 / 收藏';}
      }
      if(label){ctx.textBadge(a,label,'pzm-action-label');ctx.attr(a,'aria-label',label);}
    });
    if(ctx.recovery)document.querySelectorAll('table.pzm-torrents img.nexus-lazy-load[data-src]').forEach(image=>{
      try{const url=new URL(image.getAttribute('data-src'),location.href);if(!/^https?:$/.test(url.protocol))return;ctx.attr(image,'loading','lazy');ctx.attr(image,'decoding','async');ctx.attr(image,'src',url.href);}catch(_){}
    });
  }
  function partialNotice() {
    if(kind!=='torrents'||!ctx||document.readyState!=='complete')return;
    const outer=document.getElementById('outer');if(!outer)return;
    const range=listingRange(outer);
    const expected=range?range.end-range.start:0;
    const count=outer.querySelectorAll('table.pzm-torrents>tbody>tr.pzm-torrent:not([data-pzm-recovery-original])').length;
    const incomplete=!document.getElementById('footer') && expected>count;
    let notice=outer.querySelector('.pzm-partial-notice');
    const state=ctx.recovery;
    if(!incomplete&&!state){if(notice)notice.hidden=true;return;}
    if(!notice){notice=document.createElement('div');notice.className='pzm-partial-notice';notice.setAttribute('role','status');const text=document.createElement('p');notice.appendChild(text);notice.appendChild(ctx.button('重新加载',()=>location.reload()));const retry=ctx.button('补齐本页',()=>{if(ctx?.recovery?.running)ctx.recovery.controller.abort();else maybeRecover(true);});retry.setAttribute('data-pzm-retry','');notice.appendChild(retry);ctx.add(outer,notice);outer.querySelector('table.pzm-torrents')?.before(notice);}
    notice.hidden=!!state?.complete&&!state.missing;
    const text=notice.querySelector('p'),retry=notice.querySelector('[data-pzm-retry]');
    if(state?.running)text.textContent=state.loaded===null?'正在重新获取本页…':'正在核对本页记录：'+state.loaded+' / '+expected+'。';
    else if(state?.complete)text.textContent='已补齐本页 '+expected+' 条记录。其中 '+state.missing+' 条的评分与统计未由原站返回，已明确标注。';
    else text.textContent=(state?.error||'原站返回的页面未完整结束。')+' 当前显示 '+count+' 条，可补齐本页或重新加载。';
    retry.hidden=!!state?.complete;retry.textContent=state?.running?'停止补齐':state?'重试补齐':'补齐本页';
  }

  async function maybeRecover(manual=false) {
    if(!active||kind!=='torrents'||!ctx||document.readyState!=='complete'||typeof fetch!=='function')return;
    const owner=ctx,outer=document.getElementById('outer'),table=outer?.querySelector('table.pzm-torrents'),range=outer&&listingRange(outer),fields=table&&torrentSchema(table);
    const page=Number(new URLSearchParams(location.search).get('page')||0);
    if(!table||!range||!fields||document.getElementById('footer')||range.end-range.start>50||!Number.isSafeInteger(page)||page<0||owner.recovery?.running||(!manual&&owner.recovery))return;
    const expected=range.end-range.start;
    const originals=Array.from(table.rows).slice(1);
    if(owner.recovery?.complete||originals.filter(row=>torrentRowMatches(row,fields)&&nativeTorrentId(row)).length===expected)return;
    const state={running:true,complete:false,loaded:null,missing:0,controller:new AbortController(),error:null};
    owner.recovery=state;
    const current=()=>ctx===owner&&active&&table.isConnected;
    const pageUrl=new URL(location.href);
    // Preserve the selected filters while avoiding a new hot-search entry.
    pageUrl.searchParams.set('notnewword','1');
    const schema=JSON.stringify(fields);
    const deadline=Date.now()+45000;
    let requests=0;
    const fetchRows=async(url,start,end)=>{
      if(!current()||state.controller.signal.aborted)throw new Error('补齐已停止。');
      const timeLeft=deadline-Date.now();
      if(++requests>50||timeLeft<=0)throw new Error('补齐等候超时。');
      const timeout=setTimeout(()=>state.controller.abort(),Math.min(timeLeft,8000));
      let html;
      try{
        const response=await fetch(url.href,{method:'GET',credentials:'same-origin',mode:'same-origin',cache:'no-store',signal:state.controller.signal});
        if(!response.ok)throw new Error('原站暂未返回列表。');
        html=await response.text();
      }finally{clearTimeout(timeout);}
      if(!current()||state.controller.signal.aborted)throw new Error('补齐已停止。');
      if(html.length>4*1024*1024)throw new Error('原站响应过大。');
      const doc=new DOMParser().parseFromString(html,'text/html');
      const content=doc.getElementById('outer'),fragment=content?.querySelector('table.torrents');
      const returned=content&&listingRange(content);
      if(!fragment||!returned||returned.start!==start||returned.end!==end||JSON.stringify(torrentSchema(fragment))!==schema){
        throw new Error('原站分页或登录状态发生变化。');
      }
      const rows=Array.from(fragment.rows).slice(1);
      // A truncated trailing row might end before its ID. Earlier unknown
      // rows cannot be skipped because their positions are significant.
      if(rows.length&&!nativeTorrentId(rows.at(-1)))rows.pop();
      if(rows.length>end-start||rows.some(row=>!nativeTorrentId(row)))throw new Error('原站记录位置无法确认。');
      return rows;
    };
    partialNotice();
    try{
      let recovered;
      for(let attempt=0;attempt<2;attempt++){
        state.loaded=null;
        partialNotice();
        const staged=await fetchRows(pageUrl,range.start,range.end);
        if(!manual&&page>4&&staged.length<expected){
          throw new Error('重新获取后，原站返回的本页仍不完整。');
        }
        const ids=new Set(staged.map(nativeTorrentId));
        let overlap=ids.size!==staged.length;
        while(!overlap&&staged.length<expected){
          state.loaded=staged.length;
          partialNotice();
          const offset=range.start+staged.length;
          const size=[10,5,2,1].find(n=>offset%n===0&&n<=range.end-offset);
          const url=new URL(pageUrl.href);
          url.searchParams.set('pageSize',String(size));
          url.searchParams.set('page',String(offset/size));
          const fragment=await fetchRows(url,offset,offset+size);
          if(!fragment.length)throw new Error('原站没有返回这一段记录。');
          for(const row of fragment){
            const id=nativeTorrentId(row);
            if(ids.has(id)){overlap=true;break;}
            ids.add(id);
            staged.push(row);
          }
        }
        if(!overlap){recovered=staged;break;}
      }
      if(!recovered)throw new Error('原站列表仍在更新，暂时未能补齐。');
      const batch=recovered.map(row=>recoveryRow(row,fields));
      if(batch.some(row=>!row))throw new Error('原站记录结构无法识别。');
      // Publish only a full, unique set. Until then leave the native list usable.
      observer?.disconnect();
      originals.forEach(row=>owner.attr(row,'data-pzm-recovery-original',''));
      batch.forEach(record=>owner.add(table.tBodies[0],record.row,false));
      state.missing=batch.filter(record=>record.missing).length;
      state.complete=true;
      scan();
      if(!current())return;
      if(state.complete&&!outer.querySelector('.pzm-recovery-pagination')){
        const top=outer.querySelector('nav.pzm-pagination');
        if(top){const bottom=top.cloneNode(true);bottom.classList.add('pzm-recovery-pagination');bottom.setAttribute('aria-label','页面切换（页尾）');const select=bottom.querySelector('.pzm-page-select');if(select){const label=document.createElement('span');label.className='pzm-page-select';label.textContent='第 '+(page+1)+' 页';select.replaceWith(label);}owner.add(table.parentElement,bottom);table.after(bottom);}
      }
    }catch(error){if(current())state.error=state.controller.signal.aborted?'补齐已停止或请求超时。':error.message;}
    finally{state.running=false;if(current()){observe();partialNotice();}}
  }
  function fallback(message) {
    failureReason=message;deactivate();status.textContent=message+' · v'+version;syncControls();
  }
  function scan(rows) {
    if(!ctx)return;
    if(kind==='torrents' && !adaptTorrents(ctx,rows)) {fallback('页面结构变化，已切回原版');return;}
    if(!rows && !login && !inframe) {
      if(adaptAccountPanel(ctx))ctx.attr(account,'aria-controls','pzm-account-panel');
      adaptContent(ctx,kind);
    }
    refreshAccountCards(ctx);
    actions(rows);partialNotice();
  }
  function deactivate() {
    ctx?.recovery?.controller.abort();
    observer?.disconnect();observer=null;
    if(timer!==null){clearTimeout(timer);timer=null;}
    pendingFull=false;pendingActions=false;pendingAccount=false;pendingRows.clear();
    if(ctx){for(const undo of ctx.undo.reverse()){try{undo();}catch(_){}}ctx=null;}
    active=false;
    document.documentElement.classList.remove('pzm-menu-open','pzm-account-open');
  }
  function activate() {
    if(active)return true;
    if(kind==='torrents') {
      const tables=Array.from(document.querySelectorAll('#outer table.torrents'));
      if(!tables.length || tables.some(t=>!torrentSchema(t)))return false;
    }
    if(kind==='details'&&!document.getElementById('kdescr'))return false;
    ctx=context();
    try {
      ctx.cls(document.documentElement,'pzm-mobile');
      ctx.attr(document.documentElement,'data-pzm-page',kind);
      const existing=Array.from(document.querySelectorAll('meta[name="viewport" i]'));
      if(existing.length){existing.forEach(meta=>ctx.attr(meta,'content','width=device-width, initial-scale=1, viewport-fit=cover'));}
      else {const meta=document.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1, viewport-fit=cover';ctx.add(document.head,meta);}
      document.querySelectorAll('table.main').forEach(t=>{if(Array.from(t.rows).every(r=>r.cells.length===1))ctx.cls(t,'pzm-layout');});
      const primary=document.querySelector('#nav > ul');
      if(primary)document.querySelectorAll('ul[id^="nexus-menu"] a').forEach(original=>{
        const href=original.getAttribute('href');
        if(!href || Array.from(primary.querySelectorAll('a')).some(a=>a.getAttribute('href')===href))return;
        const item=document.createElement('li'),anchor=document.createElement('a');
        anchor.setAttribute('href',href);anchor.textContent=original.textContent.trim();item.appendChild(anchor);ctx.add(primary,item);
      });
      if(login){document.querySelectorAll('#login-form table').forEach(t=>ctx.cls(t,'pzm-kv'));}
      scan();
      if(!ctx)return false;
      active=true;
      observer=new MutationObserver(records=>{
        for(const record of records) {
          const target=record.target.nodeType===1?record.target:record.target.parentElement;
          if(!target||target.closest('[data-pzm-owned]'))continue;
          if(target.closest('#info_block')){pendingAccount=true;continue;}
          if(target.closest('a[id^="bookmark"]')){pendingActions=true;continue;}
          const row=target.closest('tr.pzm-torrent');
          if(kind==='torrents'&&row){pendingRows.add(row);continue;}
          if(kind==='torrents'&&(target.closest('table.pzm-torrents')||target.tagName==='TABLE')){pendingFull=true;continue;}
          // Most native class changes (hover, menus, calendars) do not change
          // structure. Re-scan only structural mutations outside torrent rows.
          if(record.type==='childList' && Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node=>node.nodeType===1))pendingFull=true;
        }
        if(!pendingFull&&!pendingActions&&!pendingAccount&&!pendingRows.size)return;
        if(timer===null)timer=setTimeout(()=>{
          timer=null;observer?.disconnect();
          const full=pendingFull,rows=new Set(pendingRows),onlyActions=pendingActions,accountChanged=pendingAccount;
          pendingFull=false;pendingActions=false;pendingAccount=false;pendingRows.clear();
          try{if(full)scan();else if(rows.size)scan(rows);else {if(onlyActions)actions();if(accountChanged&&ctx)refreshAccountCards(ctx);}}
          catch(_){fallback('适配遇到异常，已切回原版');}
          observe();
        },100);
      });
      observe();
      return true;
    } catch (_) {deactivate();return false;}
  }
  const controls=document.createElement('div');controls.id='pzm-controls';controls.setAttribute('data-pzm-owned','');
  const bar=document.createElement('div');bar.className='pzm-bar';controls.appendChild(bar);
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;};
  const menu=button('菜单',()=>{document.documentElement.classList.toggle('pzm-menu-open');menu.setAttribute('aria-expanded',String(document.documentElement.classList.contains('pzm-menu-open')));});
  menu.setAttribute('aria-controls','nav');menu.setAttribute('aria-expanded','false');
  const account=button('账户信息',()=>{document.documentElement.classList.toggle('pzm-account-open');account.setAttribute('aria-expanded',String(document.documentElement.classList.contains('pzm-account-open')));});
  account.setAttribute('aria-controls','info_block');account.setAttribute('aria-expanded','false');
  const panel=document.createElement('section');panel.className='pzm-settings';panel.hidden=true;
  const settings=button('显示设置',()=>{panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',String(!panel.hidden));});
  settings.setAttribute('aria-expanded','false');
  const status=document.createElement('p');status.setAttribute('role','status');
  status.className='pzm-status';
  function syncControls() {
    controls.classList.toggle('pzm-original',!active);
    globalButton.textContent=prefs.mode==='mobile'?'全站使用原版':'全站使用移动版';
    pageButton.textContent=prefs.disabled.includes(kind)?'为当前类页面启用适配':'仅当前类页面使用原版';
    pageButton.disabled=prefs.mode==='original';
    menu.hidden=!active||!document.getElementById('nav');account.hidden=!active||!document.getElementById('info_block');
    menu.setAttribute('aria-expanded',String(document.documentElement.classList.contains('pzm-menu-open')));
    account.setAttribute('aria-expanded',String(document.documentElement.classList.contains('pzm-account-open')));
    scaleControl();
  }
  const apply=()=>{
    deactivate();
    failureReason='';
    const enabled=prefs.mode==='mobile'&&!prefs.disabled.includes(kind);
    const ok=enabled&&activate();
    status.textContent=(ok?'移动版':enabled?(failureReason||'页面结构未识别，保留原版'):'原版')+' · v'+version;
    syncControls();
  };
  const globalButton=button('全站使用原版',()=>{prefs.mode=prefs.mode==='mobile'?'original':'mobile';save();apply();});
  const pageButton=button('仅当前类页面使用原版',()=>{prefs.disabled=prefs.disabled.includes(kind)?prefs.disabled.filter(x=>x!==kind):prefs.disabled.concat(kind);save();apply();});
  const reset=button('重置本机显示偏好',()=>{prefs={mode:'mobile',disabled:[]};save();apply();});
  panel.append(globalButton,pageButton,reset,button('收起',()=>{panel.hidden=true;settings.setAttribute('aria-expanded','false');}));
  bar.append(menu,account,settings);controls.append(status,panel);
  const outerTable=document.querySelector('body > table.mainouter');
  document.body.insertBefore(controls,outerTable||document.body.firstChild);
  const quick=document.createElement('nav');quick.id='pzm-quick';quick.setAttribute('aria-label','快捷导航');quick.setAttribute('data-pzm-owned','');
  const shortcuts=[['/index.php','首页'],['/torrents.php','种子'],['/forums.php','论坛'],['/messages.php','消息'],['/usercp.php','我的']];
  shortcuts.forEach(([path,label])=>{
    const original=Array.from(document.querySelectorAll('#nav a,#info_block a')).find(a=>{try{return new URL(a.href,location.href).pathname===path;}catch(_){return false;}});
    if(original){const a=document.createElement('a');a.setAttribute('href',original.getAttribute('href'));a.textContent=label;if(location.pathname===path)a.setAttribute('aria-current','page');quick.appendChild(a);}
  });
  if(quick.children.length&&!inframe)document.body.appendChild(quick);
  function scaleControl(){if(!active){const scale=window.visualViewport?.scale||1;controls.style.setProperty('--pzm-control-scale',String(1/Math.max(.1,scale)));}else controls.style.removeProperty('--pzm-control-scale');}
  window.visualViewport?.addEventListener('resize',scaleControl);
  if(inframe){controls.remove();quick.remove();}
  apply();
  window.addEventListener('load',()=>{if(active){partialNotice();maybeRecover();}},{once:true});
  Promise.resolve().then(()=>maybeRecover());
  window.__ptzoneMobile={version,kind,get active(){return active;},restore:()=>{prefs.mode='original';save();apply();}};
}

function boot(){startMobile("/* Every site rule is gated by a class applied only after template validation. */\n#pzm-controls,#pzm-quick{box-sizing:border-box;font:15px/1.5 -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif;color:#192c39;text-align:left}\n#pzm-controls button{appearance:none;font:inherit;color:inherit;border:1px solid #cbd8df;border-radius:10px;background:#fff;min-height:44px;padding:9px 14px;cursor:pointer}\n#pzm-controls button:disabled{opacity:.45}\n#pzm-controls [hidden]{display:none!important}\n#pzm-controls{margin:0 10px 10px;position:relative;z-index:20}\n#pzm-controls .pzm-bar{display:flex;gap:8px;align-items:center;justify-content:space-between}\n#pzm-controls .pzm-settings{padding:14px;background:#fff;border:1px solid #cbd8df;border-radius:12px;margin:8px 0;box-shadow:0 6px 24px #13293716}\n#pzm-controls .pzm-settings button{display:block;width:100%;margin:8px 0}\n#pzm-controls.pzm-original{position:fixed;right:12px;bottom:16px;margin:0;transform:scale(var(--pzm-control-scale,1));transform-origin:bottom right;max-width:290px;z-index:2147483000}\n#pzm-quick{display:none}\n.pzm-mobile{width:100%!important;min-width:0!important;background:#eff3f5!important;-webkit-text-size-adjust:100%;scroll-padding-top:12px;scroll-padding-bottom:90px}\n.pzm-mobile body{margin:0!important;padding:0 0 calc(84px + env(safe-area-inset-bottom))!important;min-width:0!important;width:100%!important;box-sizing:border-box;background:#eff3f5!important;color:#233541;font:15px/1.6 -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif!important;overflow-wrap:anywhere}\n.pzm-mobile *, .pzm-mobile *::before,.pzm-mobile *::after{box-sizing:border-box}\n.pzm-mobile body>table.head{width:100%!important;max-width:100%;height:auto!important;margin:0 0 10px;table-layout:fixed;background:#fff}\n.pzm-mobile body>table.head>tbody>tr>td{width:auto!important;white-space:normal!important;padding:8px}\n.pzm-mobile body>table.head img{max-width:100%;height:auto;object-fit:contain}\n.pzm-mobile body>table.mainouter{display:block!important;width:100%!important;min-width:0!important;background:transparent;border:0!important}\n.pzm-mobile body>table.mainouter>tbody,.pzm-mobile body>table.mainouter>tbody>tr,.pzm-mobile body>table.mainouter>tbody>tr>td{display:block!important;width:100%!important;min-width:0!important;border:0!important}\n.pzm-mobile #outer{padding:0 10px!important;background:transparent!important}\n.pzm-mobile #nav_block{padding:0 10px!important;background:transparent!important}\n.pzm-mobile #nav{display:none!important}\n.pzm-mobile.pzm-menu-open #nav{display:block!important;background:white;padding:10px;border-radius:12px;margin:0 0 10px}\n.pzm-mobile #nav>ul{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:0;padding:0;gap:6px}\n.pzm-mobile #nav>ul>li{float:none!important;display:block!important;min-width:0;border:0!important;margin:0!important}\n.pzm-mobile #nav>ul>li>a{display:flex;align-items:center;min-height:44px;padding:8px 12px!important;border-radius:8px;background:#f0f5f7;color:#173f4e;white-space:normal!important;font-size:15px!important;line-height:1.5!important}\n.pzm-mobile #nav-mobile{display:none!important}\n.pzm-mobile ul[id^=\"nexus-menu\"]{max-width:calc(100vw - 20px)!important;left:10px!important}\n.pzm-mobile #info_block{display:none!important}\n.pzm-mobile.pzm-account-open #info_block{display:block!important;margin:0 0 12px;padding:12px;border:1px solid #dbe3e7;border-radius:12px;background:#fff}\n.pzm-mobile #info_block table,.pzm-mobile #info_block tbody,.pzm-mobile #info_block tr,.pzm-mobile #info_block td{display:block;width:100%!important;white-space:normal!important;padding:0;border:0;font-size:14px;line-height:1.9;background:transparent}\n.pzm-mobile #info_block a{display:inline-flex;align-items:center;min-height:44px;padding:2px 5px}\n.pzm-mobile #pzm-quick{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:1000;background:#ffffffef;backdrop-filter:blur(12px);border-top:1px solid #d4dfe5;padding:6px max(8px,env(safe-area-inset-left)) calc(6px + env(safe-area-inset-bottom));justify-content:space-around;gap:4px}\n.pzm-mobile #pzm-quick a{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;min-height:44px;color:#526873;border-radius:9px;font-size:14px;text-decoration:none}\n.pzm-mobile #pzm-quick a[aria-current]{color:#086b72;background:#e6f3f2;font-weight:700}\n.pzm-mobile a{color:#086b81;overflow-wrap:anywhere}\n.pzm-mobile a:focus-visible,.pzm-mobile button:focus-visible,.pzm-mobile input:focus-visible,.pzm-mobile [tabindex]:focus-visible{outline:3px solid #177a9b;outline-offset:2px}\n.pzm-mobile h1{font-size:20px!important;line-height:1.5;text-align:left;margin:16px 0 12px}\n.pzm-mobile h2{font-size:18px!important;line-height:1.5;margin:16px 0 8px;text-align:left}\n.pzm-mobile h3{font-size:16px!important}\n.pzm-mobile td,.pzm-mobile th,.pzm-mobile .small,.pzm-mobile .medium,.pzm-mobile font{font-size:inherit}\n.pzm-mobile td{line-height:1.6}\n.pzm-mobile img:not(.medium-zoom-image--opened),.pzm-mobile video,.pzm-mobile canvas{max-width:100%;height:auto}\n.pzm-mobile svg{max-width:100%;vertical-align:middle}\n.pzm-mobile iframe{max-width:100%;border:0}\n.pzm-mobile #iframe-shout-box{width:100%;min-height:230px}\n.pzm-mobile td.pzm-hotrail{display:flex!important;flex-wrap:nowrap;gap:10px;overflow-x:auto;white-space:nowrap!important;padding:10px 0!important;max-width:100%;overscroll-behavior-x:contain}\n.pzm-mobile .pzm-hotrail>a{flex:0 0 80px;display:block}\n.pzm-mobile .pzm-hotrail>a>img{width:80px;height:112px;object-fit:cover;border-radius:7px}\n.pzm-mobile pre{max-width:100%;overflow:auto;white-space:pre;font-size:13px;line-height:1.5;-webkit-overflow-scrolling:touch}\n.pzm-mobile blockquote{margin:10px 0;padding:10px;border-left:3px solid #b6cbd3;max-width:100%;background:#f4f7f9}\n.pzm-mobile input,.pzm-mobile select,.pzm-mobile textarea,.pzm-mobile button{font-family:inherit;font-size:16px!important;max-width:100%;border-radius:8px}\n.pzm-mobile input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"hidden\"]),.pzm-mobile select,.pzm-mobile button{min-height:44px;padding:8px 10px}\n.pzm-mobile input[type=\"checkbox\"],.pzm-mobile input[type=\"radio\"]{width:22px;height:22px;vertical-align:middle;accent-color:#087c82}\n.pzm-mobile textarea{width:100%!important;min-height:160px;padding:10px;line-height:1.6}\n.pzm-mobile input[type=\"text\"],.pzm-mobile input[type=\"password\"],.pzm-mobile input[type=\"number\"],.pzm-mobile input[type=\"search\"]{width:100%!important;min-width:0}\n.pzm-mobile .btn,.pzm-mobile .btn2,.pzm-mobile button,.pzm-mobile input[type=\"submit\"]{cursor:pointer}\n.pzm-mobile .pzm-layout,.pzm-mobile .pzm-layout>tbody,.pzm-mobile .pzm-layout>tbody>tr,.pzm-mobile .pzm-layout>tbody>tr>td{display:block;width:100%!important;min-width:0!important;max-width:100%;border:0!important;background:transparent}\n.pzm-mobile .pzm-layout>tbody>tr>td.embedded{padding:0!important}\n.pzm-mobile .pzm-kv{display:block;width:100%!important;min-width:0!important;margin:10px 0;background:#fff;border-radius:12px;overflow:hidden}\n.pzm-mobile .pzm-kv>tbody{display:block}\n.pzm-mobile .pzm-kv>tbody>tr{display:block;border-bottom:1px solid #e5ebee;padding:10px 12px}\n.pzm-mobile .pzm-kv>tbody>tr>td{display:block;width:100%!important;max-width:100%;min-width:0;white-space:normal!important;text-align:left!important;border:0!important;padding:3px 0!important;background:transparent}\n.pzm-mobile .pzm-kv>tbody>tr>td.rowhead{font-size:14px!important;font-weight:700;color:#5a707c;margin-bottom:4px}\n.pzm-mobile .pzm-kv>tbody>tr>td.rowhead a{min-height:44px;display:inline-flex;align-items:center}\n.pzm-mobile .pzm-scroll{display:block;max-width:100%;width:100%!important;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;background:#fff;border-radius:10px;margin:10px 0}\n.pzm-mobile .pzm-scroll>tbody{display:table;min-width:600px;width:100%}\n.pzm-mobile .pzm-scroll::before{content:'表内可左右滑动';display:block;position:sticky;left:0;padding:6px 10px;font-size:12px;color:#617985;background:#edf3f5}\n.pzm-mobile .pzm-scroll>tbody>tr>td,.pzm-mobile .pzm-scroll>tbody>tr>th{padding:9px 10px}\n.pzm-mobile .pzm-content>table:not(.pzm-kv):not(.pzm-scroll):not(.pzm-records){max-width:100%;width:100%!important}\n.pzm-mobile .pzm-content .nowrap{white-space:normal!important}\n.pzm-mobile .pzm-pages{display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:2}\n.pzm-mobile .pzm-pages a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:6px 10px;border:1px solid #d7e2e8;border-radius:9px;background:#fff}\n.pzm-mobile #usercpmenu,.pzm-mobile #pmboxmenu{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:8px 0}\n.pzm-mobile #usercpmenu li,.pzm-mobile #pmboxmenu li{float:none!important}\n.pzm-mobile #usercpmenu a,.pzm-mobile #pmboxmenu a{display:flex;align-items:center;min-height:44px;padding:8px;background:white;border-radius:8px}\n.pzm-mobile .pzm-post{display:block;width:100%!important;margin-top:16px;border:0!important;background:#e7f0f4;border-radius:10px;padding:10px}\n.pzm-mobile .pzm-post>tbody,.pzm-mobile .pzm-post>tbody>tr,.pzm-mobile .pzm-post>tbody>tr>td{display:block;width:100%!important;white-space:normal!important;background:transparent;border:0!important;padding:2px!important}\n.pzm-mobile .pzm-post-body{display:block;width:100%!important;background:#fff;border-radius:10px;margin-bottom:14px}\n.pzm-mobile .pzm-post-body>tbody,.pzm-mobile .pzm-post-body>tbody>tr,.pzm-mobile .pzm-post-body>tbody>tr>td{display:block;width:100%!important;border:0!important;padding:8px!important;white-space:normal!important;background:transparent}\n.pzm-mobile .pzm-post-body>tbody>tr:first-child>td:first-child{font-size:13px;color:#617680;border-bottom:1px solid #e0e8ec!important}\n.pzm-mobile .pzm-post-body img[alt=\"avatar\"]{max-width:44px;height:auto;float:left;margin-right:12px}\n.pzm-mobile .toolbox{overflow:auto}\n.pzm-mobile .toolbox a,.pzm-mobile .btn-post-like,.pzm-mobile .btn-post-reward{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}\n.pzm-mobile .pzm-records{display:block;width:100%!important;border:0!important}\n.pzm-mobile .pzm-records>tbody{display:block}\n.pzm-mobile .pzm-record-header{display:flex;gap:8px;flex-wrap:wrap;background:#e8eff3;padding:8px;border-radius:10px;margin:10px 0}\n.pzm-mobile .pzm-record-header>td{display:block;border:0;padding:2px;white-space:normal!important;background:transparent}\n.pzm-mobile .pzm-record-header a{display:inline-flex;min-height:44px;align-items:center}\n.pzm-mobile .pzm-record{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#fff;border:1px solid #dce5e9;margin:10px 0;border-radius:12px;padding:10px;gap:8px}\n.pzm-mobile .pzm-record>td{display:block;width:auto!important;border:0;min-width:0;padding:0;background:transparent!important;text-align:left!important;white-space:normal!important}\n.pzm-mobile .pzm-record>td:first-child{grid-column:1/-1;font-size:16px}\n.pzm-mobile .pzm-record>td::before{content:attr(data-pzm-label);display:block;font-size:12px;color:#647b87}\n.pzm-mobile .pzm-record a{display:inline-flex;min-height:44px;align-items:center}\n.pzm-mobile .pzm-download{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;margin:4px 0;background:#e5f4f1;color:#075c65;border:1px solid #b6dad4;border-radius:9px;word-break:break-all}\n.pzm-mobile .layui-layer{max-width:calc(100vw - 20px)!important;left:10px!important}\n.pzm-mobile .layui-layer-content{max-width:100%;max-height:70vh;overflow:auto!important}\n.pzm-mobile .layui-layer-content input,.pzm-mobile .layui-layer-content textarea{max-width:100%;min-width:0!important}\n.pzm-mobile .xdsoft_datetimepicker{max-width:calc(100vw - 16px)!important;left:8px!important;right:8px!important;width:auto!important}\n.pzm-mobile #calendar{width:100%!important;max-width:100%;font-size:13px}\n.pzm-mobile #calendar .fc-toolbar{flex-wrap:wrap;gap:8px}\n.pzm-mobile #calendar table{width:100%!important}\n.pzm-mobile #calendar .fc-daygrid-day-number{min-height:44px;min-width:32px;display:flex;align-items:center;justify-content:center}\n.pzm-mobile #footer{font-size:12px;color:#6a7b85;margin:20px 12px;overflow-wrap:anywhere}\n.pzm-mobile body.inframe{padding:8px!important;background:white!important}\n.pzm-mobile body.inframe td{font-size:14px!important;white-space:normal}\n/* Light mode deliberately retains site promotion colors and BBCode colors. */\n\n.pzm-mobile .pzm-search{margin:12px 0;background:#fff;border-radius:12px;border:1px solid #dce5e9;padding:10px}\n.pzm-mobile .pzm-search table,.pzm-mobile .pzm-search tbody,.pzm-mobile .pzm-search tr,.pzm-mobile .pzm-search td{width:100%!important;max-width:100%;min-width:0;white-space:normal!important;background:transparent;border:0!important}\n.pzm-mobile .pzm-search table{display:block}\n.pzm-mobile .pzm-search tbody{display:block}\n.pzm-mobile .pzm-search tr{display:flex;flex-wrap:wrap;gap:6px}\n.pzm-mobile .pzm-search td{display:block;padding:4px!important;flex:1 1 100%}\n.pzm-mobile .pzm-search table.searchbox{display:flex;flex-direction:column}\n.pzm-mobile .pzm-search table.searchbox>tbody:last-child{order:-1}\n.pzm-mobile .pzm-search table.searchbox>tbody:first-child .colhead>a{display:none}\n.pzm-mobile .pzm-search #ksearchboxmain[style*=\"none\"]{display:none!important}\n.pzm-mobile .pzm-search #ksearchboxmain td.bottom{flex:1 1 135px;width:auto!important;min-height:44px;display:flex;align-items:center;gap:6px}\n.pzm-mobile .pzm-search #ksearchboxmain td.bottom img{max-width:46px}\n.pzm-mobile .pzm-filter-label{display:flex;align-items:center;min-height:44px;font-size:14px}\n.pzm-mobile .pzm-search input[type=\"submit\"],.pzm-mobile [data-pzm-advanced]{width:100%;background:#0b737b;color:#fff;border:0}\n.pzm-mobile [data-pzm-advanced]{background:#e9f3f5;color:#174b5a}\n.pzm-mobile .pzm-search:not(.pzm-suggestions-open) .pzm-suggestions{display:none!important}\n.pzm-mobile .pzm-search .pzm-suggestions-toggle{min-height:44px;width:100%;margin-top:6px;background:#f4f7f8;color:#49636e;border:0;font-size:14px!important}\n.pzm-mobile .pzm-torrents{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent}\n.pzm-mobile .pzm-torrents>tbody{display:block}\n.pzm-mobile .pzm-torrents>tbody>.pzm-sort{display:flex;flex-wrap:nowrap;overflow-x:auto;max-width:100%;gap:6px;margin:12px 0;padding:10px;background:#e5edf1;border-radius:12px;overscroll-behavior-x:contain}\n.pzm-mobile .pzm-sort>td{display:block;min-width:0;background:transparent;border:0;padding:0!important;font-size:13px!important}\n.pzm-mobile .pzm-sort a{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;min-width:44px;padding:6px 9px;border:1px solid #cadbe3;border-radius:8px;background:#fff}\n.pzm-mobile .pzm-sort a>img{display:none}\n.pzm-mobile .pzm-sort>td{flex-shrink:0;color:#46616f}\n.pzm-mobile .pzm-torrents>tbody>.pzm-torrent{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px;border:1px solid #d7e3e9;border-radius:14px;margin:12px 0;background:#fff!important;box-shadow:0 2px 5px #17354505;cursor:pointer}\n.pzm-mobile .pzm-torrent>td{display:block;width:auto!important;min-width:0;max-width:100%;border:0!important;padding:0!important;background:transparent!important;white-space:normal!important;text-align:left!important;font-size:14px!important;line-height:1.5}\n.pzm-mobile .pzm-torrent>td::before{content:attr(data-pzm-label);display:block;font-size:12px;color:#647b87;margin-bottom:2px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]{grid-column:1/-1}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"]{order:-4}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]{order:-3}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"leechers\"]{order:-2;font-size:16px!important;font-weight:650}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"]::before,.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]::before{display:none}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] a{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13px;color:#53717e}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] img{max-width:46px;max-height:40px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"]{grid-column:span 2}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"] br,.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"] br{display:none}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"] br::after,.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"] br::after{content:' '}\n.pzm-mobile .pzm-name,.pzm-mobile .pzm-name>tbody{display:block!important;width:100%!important}\n.pzm-mobile .pzm-name>tbody>tr{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;background:transparent!important}\n.pzm-mobile .pzm-name>tbody>tr>td{display:block;min-width:0;width:auto!important;max-width:100%;padding:0!important;background:transparent!important;border:0;text-align:left!important;height:auto!important;white-space:normal!important}\n.pzm-mobile .pzm-name .pzm-cover{grid-column:1;grid-row:1}\n.pzm-mobile .pzm-cover img.nexus-lazy-load{width:64px;max-width:64px!important;max-height:96px!important;object-fit:contain;border-radius:6px}\n.pzm-mobile .pzm-name .pzm-name-title{grid-column:2;grid-row:1/3;font-size:14px!important;line-height:1.7;overflow-wrap:anywhere}\n.pzm-mobile .pzm-name-title>a[href*=\"details.php?\"]{display:inline;font-size:16px;font-weight:700;line-height:1.6;white-space:normal!important;overflow-wrap:anywhere}\n.pzm-mobile .pzm-promotion{display:inline-block;font-size:12px;line-height:1.6;background:#e1f3e9;color:#11643a;padding:2px 6px;margin:2px 3px;border-radius:5px;font-weight:650}\n.pzm-mobile .pzm-name-title span[style*=\"font-size:12px\"]{display:inline-block;padding:2px 5px!important;border-radius:4px!important;margin:3px 3px 3px 0!important}\n.pzm-mobile .pzm-name .pzm-rating{grid-column:1;grid-row:2;font-size:13px!important;line-height:1.6}\n.pzm-mobile .pzm-name .pzm-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}\n.pzm-mobile .pzm-actions>br{display:none}\n.pzm-mobile .pzm-actions>a{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;min-width:90px;background:#edf5f7;border:1px solid #cfe2e8;border-radius:9px;padding:7px 12px;color:#0c5c70;font-size:14px;text-decoration:none}\n.pzm-mobile .pzm-actions>a[href*=\"download.php\"]{background:#0b737b;color:#fff;border-color:#0b737b}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"] a{color:#157342}\n.pzm-mobile .pzm-torrent>td:not([data-pzm-field=\"title\"]):not([data-pzm-field=\"category\"]) a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}\n@media(min-width:700px){.pzm-mobile .pzm-torrent>td[data-pzm-field=\"time\"]{grid-column:auto}.pzm-mobile .pzm-torrent{grid-template-columns:repeat(5,minmax(0,1fr))}}\n\n/* Home: full-width titles and readable metadata, without horizontal lists. */\n.pzm-mobile .pzm-home-list{display:block!important;width:100%!important;min-width:0!important;max-width:100%;border:0!important;border-collapse:separate;background:transparent;overflow:visible!important;margin:10px 0}\n.pzm-mobile .pzm-home-list[hidden],.pzm-mobile .pzm-home-list[style*=\"display: none\"],.pzm-mobile .pzm-home-list[style*=\"display:none\"]{display:none!important}\n.pzm-mobile .pzm-home-list::before{content:none!important}\n.pzm-mobile .pzm-home-list>tbody{display:block!important;width:100%!important;min-width:0!important;max-width:100%}\n.pzm-mobile .pzm-home-list>tbody>.pzm-home-header{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}\n.pzm-mobile .pzm-home-list>tbody>.pzm-home-header>td{display:block;width:auto!important;border:0!important;background:transparent;padding:4px;font-size:14px;white-space:normal!important}\n.pzm-mobile .pzm-home-list>tbody>.pzm-home-static-header{display:none!important}\n.pzm-mobile .pzm-home-list>tbody>.pzm-home-card{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;min-width:0;width:100%;max-width:100%;margin:10px 0;padding:14px;background:#fff!important;border:1px solid #dce5e9;border-radius:12px}\n.pzm-mobile .pzm-home-card>td{display:block!important;min-width:0!important;width:auto!important;max-width:100%;height:auto!important;white-space:normal!important;word-break:normal;overflow-wrap:anywhere;border:0!important;background:transparent!important;text-align:left!important;padding:0!important;font-size:14px;line-height:1.65}\n.pzm-mobile .pzm-home-card>td::before{content:attr(data-pzm-home-label);display:block;font-size:12px;color:#647b87;font-weight:400;line-height:1.5;margin-bottom:3px}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"title\"]{grid-column:1/-1;order:-3;font-size:15px}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"title\"]::before{display:none}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"title\"] a{display:block;min-height:44px;max-width:100%;width:auto!important;white-space:normal!important;overflow-wrap:anywhere;word-break:normal;line-height:1.65;font-size:16px}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"title\"] a>b{font-weight:700}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"author\"]{grid-column:1/-1;order:-2}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"author\"] a{display:inline-block;max-width:100%;min-height:44px;padding:9px 0;white-space:normal!important;word-break:normal;overflow-wrap:anywhere;font-size:14px;line-height:1.65;vertical-align:middle}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"views\"],.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"count\"],.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"seeders\"],.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"leechers\"]{font-weight:650}\n.pzm-mobile .pzm-home-card>[data-pzm-home-field=\"seeders\"]{color:#157342}\n.pzm-mobile .pzm-home-stats{width:100%!important;min-width:0!important}\n.pzm-mobile .pzm-home-stats>tbody>tr{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}\n.pzm-mobile .pzm-home-stats>tbody>tr>td{width:auto!important;min-width:0;white-space:normal!important;overflow-wrap:anywhere}\n.pzm-mobile .pzm-home-stats [data-pzm-home-stat=\"0\"]{grid-column:1;grid-row:1}\n.pzm-mobile .pzm-home-stats [data-pzm-home-stat=\"1\"]{grid-column:1;grid-row:2;font-weight:650}\n.pzm-mobile .pzm-home-stats [data-pzm-home-stat=\"2\"]{grid-column:2;grid-row:1}\n.pzm-mobile .pzm-home-stats [data-pzm-home-stat=\"3\"]{grid-column:2;grid-row:2;font-weight:650}\n.pzm-mobile .pzm-home-stats>tbody>.pzm-home-stats-section>td{grid-column:1/-1!important;grid-row:auto!important}\n\n/* Compact torrent cards. All data and native actions remain in the DOM. */\n.pzm-mobile .pzm-torrents>tbody>.pzm-torrent{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;padding:10px 12px;margin:8px 0;border-radius:12px;box-shadow:none}\n.pzm-mobile .pzm-torrent>td{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto;min-height:28px;font-size:12px!important;line-height:1.35;margin-right:8px}\n.pzm-mobile .pzm-torrent>td::before{display:inline;color:#75858c;font-size:11px;margin:0;font-weight:400;flex-shrink:0}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]{display:block;flex:0 0 100%;margin:0;min-height:0}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] a{min-height:22px;gap:0;font-size:11px;line-height:1.4;color:#71838d}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] img{display:none}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"leechers\"]{flex:1 1 calc((100% - 16px)/3);margin:0;min-height:32px;font-size:14px!important;font-weight:650}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"]{grid-column:auto}\n.pzm-mobile .pzm-torrent>td:not([data-pzm-field=\"title\"]):not([data-pzm-field=\"category\"]) a{display:inline-flex;align-items:center;min-height:28px;min-width:0;padding:0 2px}\n.pzm-mobile .pzm-name>tbody>tr{grid-template-columns:50px minmax(0,1fr);gap:4px 9px}\n.pzm-mobile .pzm-name .pzm-cover{grid-column:1;grid-row:1/3;align-self:start;padding-top:3px!important}\n.pzm-mobile .pzm-cover img.nexus-lazy-load{width:50px;max-width:50px!important;max-height:74px!important;border-radius:5px}\n.pzm-mobile .pzm-name .pzm-name-title{grid-column:2;grid-row:1;font-size:12px!important;line-height:1.5}\n.pzm-mobile .pzm-name-title>a[href*=\"details.php?\"]{display:block;font-size:15px;line-height:1.45;margin:0 0 3px;font-weight:650}\n.pzm-mobile img[data-pzm-promo-text]{display:none}\n.pzm-mobile .pzm-promotion{font-size:10px;padding:1px 5px;margin:0 4px 2px 0;line-height:1.5;vertical-align:middle}\n.pzm-mobile .pzm-name-title span[style*=\"font-size:12px\"]{font-size:10px!important;padding:1px 4px!important;margin:1px 3px 2px 0!important}\n.pzm-mobile .pzm-description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.5;color:#5c707b;font-size:12px}\n.pzm-mobile .pzm-description.pzm-description-open{display:block;-webkit-line-clamp:unset;overflow:visible}\n.pzm-mobile .pzm-name-title button.pzm-description-toggle{display:inline-flex;align-items:center;min-height:28px!important;padding:2px 0!important;font-size:11px!important;color:#277a83;background:none;border:0;margin:0}\n.pzm-mobile .pzm-name .pzm-rating{grid-column:2;grid-row:2;align-self:end;font-size:11px!important;line-height:1.4}\n.pzm-mobile .pzm-rating>div{flex-direction:row!important;justify-content:flex-start;gap:12px}\n.pzm-mobile .pzm-rating>div>div{gap:4px;align-items:center}\n.pzm-mobile .pzm-name .pzm-actions{grid-column:1/-1;margin:3px 0 1px;gap:8px}\n.pzm-mobile .pzm-actions>a{min-height:44px;min-width:0;flex:1;gap:5px;padding:6px 10px;font-size:13px;border-radius:8px}\n.pzm-mobile .pzm-torrent-fallback:not(.pzm-torrent){display:block;max-width:100%;overflow-x:auto;background:#fff;border:1px solid #dce5e9;border-radius:12px;margin:8px 0;padding:10px}\n.pzm-mobile .pzm-torrent-fallback:not(.pzm-torrent)>td{display:block;max-width:100%;width:auto!important;white-space:normal!important;overflow-wrap:anywhere}\n/* One calm pager row. Original range links expand underneath on demand. */\n.pzm-mobile .pzm-pagination{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin:12px 0;padding:6px;background:#fff;border:1px solid #d7e3e9;border-radius:12px}\n.pzm-mobile .pzm-pagination>a,.pzm-mobile .pzm-pagination>button{display:flex;align-items:center;justify-content:center;min-height:44px;min-width:0;padding:6px 10px;border:0;border-radius:8px;background:#eaf3f4;color:#176270;text-decoration:none;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif!important;white-space:nowrap}\n.pzm-mobile .pzm-pagination>button:disabled{background:#f6f8f9;color:#a5b0b5}\n.pzm-mobile .pzm-pagination>.pzm-page-select{color:#45606d;background:transparent;font-size:12px!important}\n.pzm-mobile p.pzm-native-pager{display:flex;flex-wrap:wrap;gap:6px;padding:8px;margin:0 0 12px;border:1px solid #dce5e9;border-radius:10px;background:#fff;font-size:0;line-height:0;text-align:left}\n.pzm-mobile p.pzm-native-pager:not(.pzm-pager-open){display:none!important}\n.pzm-mobile p.pzm-native-pager a,.pzm-mobile p.pzm-native-pager .pzm-page-current{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:5px 9px;font-size:12px;line-height:1.4;border-radius:7px;background:#edf3f6;border:0}\n.pzm-mobile p.pzm-native-pager .pzm-page-current{background:#d7eeec;color:#075c65;font-weight:650}\n.pzm-mobile p.pzm-native-pager .pzm-native-step{display:none!important}\n\n/* 0.2.0: readable compact cards, native controls, and page-specific groups. */\n#pzm-controls .pzm-status{margin:5px 2px 0;font-size:12px;line-height:1.5;color:#617985}\n#pzm-controls.pzm-original{background:#f6fafbef;border:1px solid #cbd8df;border-radius:12px;padding:8px;box-shadow:0 3px 14px #1735451a}\n.pzm-mobile .pzm-torrent>td{font-size:14px!important;line-height:1.5;min-height:32px}\n.pzm-mobile .pzm-torrent>td::before{font-size:12px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"leechers\"]{font-size:14px!important;min-height:44px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] a{min-height:44px;font-size:13px}\n.pzm-mobile .pzm-torrent>td:not([data-pzm-field=\"title\"]):not([data-pzm-field=\"category\"]) a{min-height:44px;min-width:44px}\n.pzm-mobile .pzm-name .pzm-name-title{font-size:14px!important;line-height:1.6}\n.pzm-mobile .pzm-name-title>a[href*=\"details.php?\"]{font-size:16px;line-height:1.5}\n.pzm-mobile .pzm-description{font-size:14px;line-height:1.6}\n.pzm-mobile .pzm-name-title button.pzm-description-toggle{min-height:44px!important;font-size:13px!important;padding:6px 0!important}\n.pzm-mobile .pzm-promotion{font-size:12px;line-height:1.6}\n.pzm-mobile .pzm-name-title span[style*=\"font-size:12px\"]{font-size:12px!important;line-height:1.6}\n.pzm-mobile .pzm-name .pzm-rating{font-size:13px!important;line-height:1.5}\n.pzm-mobile .pzm-rating>div{flex-wrap:wrap;gap:4px 12px}\n.pzm-mobile .pzm-actions>a{font-size:14px}\n.pzm-mobile .pzm-quick-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 2px}\n.pzm-mobile .pzm-quick-filters>label{display:block;min-width:0;font-size:13px;color:#5a707c}\n.pzm-mobile .pzm-quick-filters select{display:block;width:100%!important;min-width:0;padding:8px 5px;border:1px solid #cbdde3;background:#f6fafb;color:#174b5a}\n.pzm-mobile .pzm-detail-actions{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}\n.pzm-mobile .pzm-detail-actions>a{display:flex;flex:1 1 120px;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px;border:1px solid #bcd9df;border-radius:10px;background:#e5f1f3;color:#075c65;font-size:16px;line-height:1.5;text-decoration:none}\n.pzm-mobile .pzm-detail-actions>a[href*=\"download.php\"]{background:#0b737b;color:#fff;border-color:#0b737b}\n.pzm-mobile .pzm-detail-actions img{width:18px;height:18px;object-fit:contain}\n.pzm-mobile .pzm-detail-main{overflow:visible}\n.pzm-mobile .pzm-detail-main>tbody>tr{padding:12px;border-radius:10px}\n.pzm-mobile .pzm-detail-main .pzm-download{font-size:14px;line-height:1.6;max-width:100%}\n.pzm-mobile .pzm-detail-section>td:first-child{display:flex!important;align-items:center;justify-content:space-between;gap:8px}\n.pzm-mobile .pzm-detail-folded>td:not(:first-child){display:none!important}\n.pzm-mobile .pzm-section-toggle{display:inline-flex;align-items:center;justify-content:center;min-height:44px;flex-shrink:0;padding:6px 12px;border:1px solid #c9dfe4;background:#eaf3f4;color:#176270;font-size:14px!important;border-radius:9px}\n.pzm-mobile a.pzm-native-section-toggle{display:flex!important;align-items:center;min-height:44px;gap:10px;flex-wrap:wrap}\n.pzm-mobile a.pzm-native-section-toggle::after{content:'点击展开/收起';font-size:12px;font-weight:400;color:#617985}\n.pzm-mobile .pzm-home-section{min-width:0;max-width:100%;margin:12px 0}\n.pzm-mobile .pzm-home-section>h2{display:flex;align-items:center;flex-wrap:wrap;gap:8px;justify-content:space-between}\n.pzm-mobile .pzm-home-folded>:not(h2):not(.pzm-news-summary){display:none!important}\n.pzm-mobile .pzm-news-summary{margin:6px 0;padding:12px;border:1px solid #dce5e9;border-radius:10px;background:#fff;font-size:14px;color:#526873;line-height:1.7}\n.pzm-mobile .pzm-home-section:not(.pzm-home-folded)>.pzm-news-summary{display:none}\n.pzm-mobile .pzm-records>tbody>.pzm-record-section{display:block;margin:16px 0 6px;padding:9px 12px;background:#dfedf0;border-radius:10px}\n.pzm-mobile .pzm-record-section>td:first-child{display:block;padding:0!important;border:0;background:transparent;font-size:17px;font-weight:650;text-align:left!important;white-space:normal!important}\n.pzm-mobile .pzm-record-section>td:not(:first-child){display:none!important}\n.pzm-mobile .pzm-record>td:first-child a{font-size:16px;line-height:1.6;white-space:normal!important}\n.pzm-mobile .pzm-account-dashboard{margin:10px 0 16px;padding:14px;border:1px solid #d5e4e8;border-radius:14px;background:#fff}\n.pzm-mobile .pzm-account-dashboard>h1{margin:0 0 12px}\n.pzm-mobile .pzm-account-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 14px}\n.pzm-mobile .pzm-account-stats>div{min-width:0;padding:10px;background:#f0f6f7;border-radius:9px}\n.pzm-mobile .pzm-account-stats dt{font-size:13px;color:#617985}\n.pzm-mobile .pzm-account-stats dd{margin:3px 0 0;font-size:18px;font-weight:650;overflow-wrap:anywhere}\n.pzm-mobile .pzm-account-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}\n.pzm-mobile .pzm-account-links>a{display:flex;align-items:center;justify-content:center;min-height:48px;padding:8px;border:1px solid #cddfe4;border-radius:9px;background:#f6fafb;font-size:15px;text-decoration:none}\n.pzm-mobile .pzm-partial-notice{padding:12px;margin:10px 0;border:1px solid #d7b779;border-radius:10px;background:#fff8e8;color:#705326;font-size:14px}\n.pzm-mobile .pzm-partial-notice p{margin:0 0 8px}\n.pzm-mobile .pzm-partial-notice[hidden]{display:none!important}\n.pzm-mobile .pzm-home-section>h2{height:auto!important;background:transparent!important;color:#254f5d;padding:0!important}\n@media(max-width:360px){.pzm-mobile .pzm-quick-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.pzm-mobile .pzm-quick-filters>label:last-child{grid-column:1/-1}}\n\n/* 0.2.1: one account card layout in the global panel and My page. */\n.pzm-mobile #pzm-account-panel{display:none}\n.pzm-mobile.pzm-account-open #pzm-account-panel{display:block}\n.pzm-mobile.pzm-account-open #info_block.pzm-account-source{display:none!important}\n.pzm-mobile.pzm-account-open #info_block.pzm-account-source.pzm-account-raw-open{display:block!important}\n.pzm-mobile .pzm-account-panel,.pzm-mobile .pzm-account-dashboard{max-width:100%;min-width:0;margin:10px 0 16px;padding:14px;background:#fff;border:1px solid #d5e4e8;border-radius:14px;text-align:left;font:15px/1.6 -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif;color:#233541}\n.pzm-mobile .pzm-account-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;margin:0 0 10px}\n.pzm-mobile .pzm-account-heading>a{display:inline-flex;align-items:center;min-height:44px;font-size:13px;text-decoration:none}\n.pzm-mobile .pzm-account-heading>.pzm-account-name{min-width:0;font-size:19px;font-weight:700;overflow-wrap:anywhere}\n.pzm-mobile .pzm-account-heading>a:not(.pzm-account-name){flex-shrink:0;color:#58727b}\n.pzm-mobile .pzm-account-stats{gap:8px;margin-bottom:10px}\n.pzm-mobile .pzm-account-stats dd{font-size:18px;line-height:1.5;font-variant-numeric:tabular-nums}\n.pzm-mobile .pzm-account-activity{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}\n.pzm-mobile .pzm-account-activity>span{padding:3px 8px;border-radius:6px;background:#f4f7f8;font-size:12px;color:#617985}\n.pzm-mobile .pzm-account-activity>[hidden]{display:none!important}\n.pzm-mobile .pzm-account-links{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}\n.pzm-mobile .pzm-account-links>a{min-width:0;padding:8px 3px;min-height:48px;font-size:13px;line-height:1.6;white-space:normal;text-align:center;overflow-wrap:anywhere}\n.pzm-mobile .pzm-account-more{margin-top:12px;border-top:1px solid #e4ecef}\n.pzm-mobile .pzm-account-more>summary{display:list-item;min-height:44px;padding:11px 2px;cursor:pointer;font-size:13px;color:#5e747f}\n.pzm-mobile .pzm-account-more>nav{display:none}\n.pzm-mobile .pzm-account-more[open]>nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 6px}\n.pzm-mobile .pzm-account-extra>a{display:flex;align-items:center;min-height:44px;font-size:13px;text-decoration:none}\n.pzm-mobile .pzm-account-more>button{display:none}\n.pzm-mobile .pzm-account-more[open]>button{display:block;background:#f3f7f8;color:#58727b;border:1px solid #d8e4e8;font-size:13px!important;width:100%}\n.pzm-mobile .pzm-search-choice-cell{font-size:0!important}\n.pzm-mobile .pzm-search-old-label{display:none!important}\n.pzm-mobile .pzm-search-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;padding:4px 0;font-size:14px;line-height:1.6;text-align:left}\n.pzm-mobile .pzm-search-options>label{display:block;min-width:0;font-size:13px;color:#617985}\n.pzm-mobile .pzm-search-options>label>span{display:block;margin-bottom:3px}\n.pzm-mobile .pzm-search-options select{display:block;min-width:0;width:100%!important;border:1px solid #cbdde3;background:#f6fafb;padding:8px 5px}\n.pzm-mobile .pzm-search-match-hint{grid-column:1/-1;margin:2px 0 0;font-size:12px;color:#71848d;line-height:1.6}\n.pzm-mobile .pzm-attendance-card{max-width:100%;margin:18px 0;padding:14px;background:#fff;border:1px solid #d8e4e8;border-radius:12px;text-align:left}\n.pzm-mobile #outer .pzm-attendance-card>h2{margin:0 0 6px;font-size:17px!important}\n.pzm-mobile ul.pzm-attendance-rules,.pzm-mobile ol.pzm-attendance-milestones{margin:0!important;padding:0!important;list-style:none!important;text-align:left!important;font-size:14px;line-height:1.75}\n.pzm-mobile .pzm-attendance-rules>li,.pzm-mobile .pzm-attendance-milestones>li{list-style:none!important;max-width:100%;margin:0!important;padding:10px 0;text-align:left!important}\n.pzm-mobile .pzm-attendance-basic{border-bottom:1px solid #e6edef}\n.pzm-mobile .pzm-attendance-rules>.pzm-attendance-bonus-group{padding:4px 0 0}\n.pzm-mobile .pzm-attendance-milestones>.pzm-attendance-milestone{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:1px solid #edf2f4}\n.pzm-mobile .pzm-attendance-milestone:last-child{border-bottom:0}\n.pzm-mobile .pzm-rule-day{min-width:0;font-size:14px;color:#526d77}\n.pzm-mobile .pzm-rule-reward{flex-shrink:0;font-size:14px;color:#126a76;text-align:right;font-variant-numeric:tabular-nums}\n.pzm-mobile .pzm-rule-original{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}\n.pzm-mobile #outer h2{height:auto!important;background:transparent!important;border:0!important;padding:0!important;color:#254f5d}\n.pzm-mobile .pzm-browser-advice{display:block;text-align:left!important;font-size:12px;line-height:2;color:#6a7b85}\n.pzm-mobile .pzm-browser-advice a{display:inline-flex;align-items:center;gap:4px;min-height:28px;font-size:12px;white-space:nowrap;vertical-align:middle}\n.pzm-mobile img.pzm-footer-icon{display:inline-block;width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;object-fit:contain;vertical-align:middle}\n.pzm-mobile img.pzm-footer-brand{width:90px!important;max-width:90px!important;height:auto!important;margin:8px 0}\n.pzm-mobile #footer{margin:18px 10px 24px;text-align:center;font-size:12px;line-height:1.6}\n.pzm-mobile #footer>div{margin:0!important;font-size:12px;line-height:1.6;text-align:center!important}\n.pzm-mobile .pzm-footer-diagnostics{display:none!important}\n\n/* Incomplete native HTML: preserve originals for restore, show only recovered\n   records. Missing fields stay explicit; no synthetic ratings or zero counts. */\n.pzm-mobile tr[data-pzm-recovery-original]{display:none!important}\n.pzm-mobile .pzm-source-missing-note{display:block;margin:5px 0 2px;font-size:12px;line-height:1.5;color:#866429}\n.pzm-mobile .pzm-partial-notice>button{margin:0 8px 4px 0;font-size:14px!important}\n.pzm-mobile .pzm-partial-notice>[hidden]{display:none!important}\n.pzm-mobile .pzm-recovery-pagination>.pzm-page-select{display:flex;align-items:center;justify-content:center;min-height:44px;padding:6px;font-size:12px;color:#45606d}\n/* FullCalendar owns fixed-height absolute scrollers. Expand its native month\n   grid in document flow instead of clipping or requiring an inner scroll. */\n.pzm-mobile #calendar .fc-view-harness{height:auto!important;min-height:0!important}\n.pzm-mobile #calendar .fc-view-harness-active>.fc-view{position:relative!important;inset:auto!important;width:100%!important;height:auto!important}\n.pzm-mobile #calendar .fc-scrollgrid,.pzm-mobile #calendar .fc-scrollgrid-sync-table{height:auto!important;min-height:0!important}\n.pzm-mobile #calendar .fc-scroller-harness,.pzm-mobile #calendar .fc-scroller{height:auto!important;max-height:none!important;overflow:visible!important}\n.pzm-mobile #calendar .fc-scroller-liquid-absolute{position:relative!important;inset:auto!important}\n.pzm-mobile #calendar .fc-daygrid-body{width:100%!important;min-height:0!important}\n.pzm-mobile #calendar .fc-daygrid-day-frame{min-height:56px}\n.pzm-mobile #calendar .fc-daygrid-day-number{min-height:28px!important;min-width:0!important;padding:3px 4px;font-size:13px;line-height:1.4}\n.pzm-mobile #calendar .fc-daygrid-day-events{min-height:20px!important;margin:0 2px 3px}\n.pzm-mobile #calendar .fc-daygrid-event{margin:1px 0;font-size:12px;line-height:1.4}\n.pzm-mobile #calendar .fc-event-title{font-size:12px;line-height:1.4}\n.pzm-mobile #calendar .fc-toolbar-title{font-size:18px!important}\n\n","0.2.3");}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

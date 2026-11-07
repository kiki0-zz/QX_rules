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
  const titleIndex = fields.findIndex(f => f.key === 'title');
  for (const row of Array.from(table.rows).slice(1)) {
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) continue;
    if (row.cells.length !== fields.length || !row.cells[titleIndex]?.querySelector('a[href*="details.php?"]')) return null;
  }
  return fields;
}

function adaptTorrents(ctx) {
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
      if (row.cells.length !== fields.length) return;
      ctx.cls(row, 'pzm-torrent');
      Array.from(row.cells).forEach((cell,i) => {
        ctx.attr(cell, 'data-pzm-field', fields[i].key);
        ctx.attr(cell, 'data-pzm-label', fields[i].label);
      });
      const category = row.querySelector('[data-pzm-field="category"] a');
      if (category) ctx.textBadge(category, category.querySelector('img')?.alt || '分类', 'pzm-category-label');
      const nested = row.querySelector('table.torrentname');
      if (nested) {
        ctx.cls(nested, 'pzm-name');
        const cells = Array.from(nested.rows[0]?.cells || []);
        cells.forEach(cell => {
          const isTitle = !!cell.querySelector('a[href*="details.php?"]');
          const isAction = !!cell.querySelector('a[href*="download.php"],a[id^="bookmark"]');
          const isCover = !!cell.querySelector('img.nexus-lazy-load');
          ctx.cls(cell, isTitle ? 'pzm-name-title' : isAction ? 'pzm-actions' : isCover ? 'pzm-cover' : 'pzm-rating');
        });
        nested.querySelectorAll('.pzm-name-title img').forEach(image=>{
          if(!/^(pro_|sticky)/.test(image.className)||image.hasAttribute('data-pzm-promoted'))return;
          ctx.attr(image,'data-pzm-promoted','');
          const label=document.createElement('span');label.className='pzm-promotion';
          label.textContent=image.title || ({'Free':'免费','2X Free':'2X 免费','Sticky':'置顶'})[image.alt] || image.alt;
          if(label.textContent){ctx.add(image.parentElement,label);image.after(label);}
        });
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
  return true;
}

function adaptContent(ctx, kind) {
  const outer = document.getElementById('outer');
  if (!outer) return false;
  if (kind === 'details' && !document.getElementById('kdescr')) return false;
  ctx.cls(outer, 'pzm-content');
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
    if (table.closest('#calendar,.fc,.pzm-torrents,.pzm-name,.pzm-post,.pzm-post-body') || table.classList.contains('pzm-kv')) return;
    const rows = Array.from(table.rows);
    if (!rows.length) return;
    const header = rows.find(r => r.cells.length >= 3 && Array.from(r.cells).every(c => c.classList.contains('colhead')));
    const isForum = kind.startsWith('forum') && !!table.querySelector('a[href*="action=viewforum"],a[href*="action=viewtopic"]');
    const isMail = kind === 'messages' && !!table.querySelector('input[name="messages[]"]');
    if (header && (isForum || isMail)) {
      ctx.cls(table,'pzm-records');
      ctx.cls(header,'pzm-record-header');
      const labels = Array.from(header.cells,c=>c.textContent.trim() || c.querySelector('img')?.alt || '选择');
      for (const row of rows) {
        if (row === header) continue;
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
  outer.querySelectorAll('p').forEach(p => {
    if (p.querySelector('a[href*="page="]')) ctx.cls(p,'pzm-pages');
  });
  if (kind === 'details') {
    outer.querySelectorAll('a[href*="download.php?"]').forEach(a=>ctx.cls(a,'pzm-download'));
  }
  return true;
}

function startMobile(css) {
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
  let ctx = null, observer = null, timer = null, active = false;
  function context() {
    const values = new WeakMap();
    return {
      undo:[], bound:new WeakSet(),
      cls(node,name) { if(node && !node.classList.contains(name)) {node.classList.add(name);this.undo.push(()=>node.classList.remove(name));} },
      attr(node,name,value) {
        if (!node || node.getAttribute(name) === value) return;
        let map=values.get(node);if(!map){map=new Map();values.set(node,map);}
        if(!map.has(name)){const old=node.getAttribute(name);map.set(name,old);this.undo.push(()=>old===null?node.removeAttribute(name):node.setAttribute(name,old));}
        node.setAttribute(name,value);
      },
      add(parent,node) {node.setAttribute('data-pzm-owned','');parent.appendChild(node);this.undo.push(()=>node.remove());return node;},
      listen(node,event,fn) {node.addEventListener(event,fn);this.undo.push(()=>node.removeEventListener(event,fn));},
      button(text,fn) {const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;},
      textBadge(parent,text,name) {
        let badge=Array.from(parent.children).find(e=>e.classList.contains(name));
        if(!badge){badge=document.createElement('span');badge.className=name;this.add(parent,badge);}
        if(badge.textContent!==text)badge.textContent=text;
      }
    };
  }
  function actions() {
    document.querySelectorAll('.pzm-actions a').forEach(a=>{
      const image=a.querySelector('img');
      const isBookmark=/^bookmark\d+$/.test(a.id);
      const label=isBookmark ? (image?.alt==='Bookmarked'?'已收藏':'收藏') : /download\.php/.test(a.getAttribute('href')||'')?'下载种子':null;
      if(label){ctx.textBadge(a,label,'pzm-action-label');ctx.attr(a,'aria-label',label);}
    });
  }
  function scan() {
    if(!ctx)return;
    if(kind==='torrents' && !adaptTorrents(ctx)) {deactivate();status.textContent='结构变化，已保留原版';return;}
    if(!login && !inframe) adaptContent(ctx,kind);
    actions();
  }
  function deactivate() {
    observer?.disconnect();observer=null;
    if(timer!==null){clearTimeout(timer);timer=null;}
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
        if(records.every(r=>r.target.closest?.('[data-pzm-owned]')))return;
        if(timer===null)timer=setTimeout(()=>{timer=null;try{scan();}catch(_){deactivate();status.textContent='适配已回退，请使用原版';}},100);
      });
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['alt','class']});
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
  const apply=()=>{
    deactivate();
    const enabled=prefs.mode==='mobile'&&!prefs.disabled.includes(kind);
    const ok=enabled&&activate();
    status.textContent=ok?'当前：移动版':enabled?'页面结构未识别，保留原版':'当前：原版';
    controls.classList.toggle('pzm-original',!active);
    globalButton.textContent=prefs.mode==='mobile'?'全站使用原版':'全站使用移动版';
    pageButton.textContent=prefs.disabled.includes(kind)?'为当前类页面启用适配':'仅当前类页面使用原版';
    pageButton.disabled=prefs.mode==='original';
    menu.hidden=!active||!document.getElementById('nav');account.hidden=!active||!document.getElementById('info_block');
    scaleControl();
  };
  const globalButton=button('全站使用原版',()=>{prefs.mode=prefs.mode==='mobile'?'original':'mobile';save();apply();});
  const pageButton=button('仅当前类页面使用原版',()=>{prefs.disabled=prefs.disabled.includes(kind)?prefs.disabled.filter(x=>x!==kind):prefs.disabled.concat(kind);save();apply();});
  const reset=button('重置本机显示偏好',()=>{prefs={mode:'mobile',disabled:[]};save();apply();});
  panel.append(status,globalButton,pageButton,reset,button('收起',()=>{panel.hidden=true;settings.setAttribute('aria-expanded','false');}));
  bar.append(menu,account,settings);controls.appendChild(panel);
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
  window.__ptzoneMobile={version:'0.1.0',kind,get active(){return active;},restore:()=>{prefs.mode='original';save();apply();}};
}

function boot(){startMobile("/* Every site rule is gated by a class applied only after template validation. */\n#pzm-controls,#pzm-quick{box-sizing:border-box;font:15px/1.5 -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif;color:#192c39;text-align:left}\n#pzm-controls button{appearance:none;font:inherit;color:inherit;border:1px solid #cbd8df;border-radius:10px;background:#fff;min-height:44px;padding:9px 14px;cursor:pointer}\n#pzm-controls button:disabled{opacity:.45}\n#pzm-controls [hidden]{display:none!important}\n#pzm-controls{margin:0 10px 10px;position:relative;z-index:20}\n#pzm-controls .pzm-bar{display:flex;gap:8px;align-items:center;justify-content:space-between}\n#pzm-controls .pzm-settings{padding:14px;background:#fff;border:1px solid #cbd8df;border-radius:12px;margin:8px 0;box-shadow:0 6px 24px #13293716}\n#pzm-controls .pzm-settings button{display:block;width:100%;margin:8px 0}\n#pzm-controls.pzm-original{position:fixed;right:12px;bottom:16px;margin:0;transform:scale(var(--pzm-control-scale,1));transform-origin:bottom right;max-width:290px;z-index:2147483000}\n#pzm-quick{display:none}\n.pzm-mobile{width:100%!important;min-width:0!important;background:#eff3f5!important;-webkit-text-size-adjust:100%;scroll-padding-top:12px;scroll-padding-bottom:90px}\n.pzm-mobile body{margin:0!important;padding:0 0 calc(84px + env(safe-area-inset-bottom))!important;min-width:0!important;width:100%!important;box-sizing:border-box;background:#eff3f5!important;color:#233541;font:15px/1.6 -apple-system,BlinkMacSystemFont,\"PingFang SC\",sans-serif!important;overflow-wrap:anywhere}\n.pzm-mobile *, .pzm-mobile *::before,.pzm-mobile *::after{box-sizing:border-box}\n.pzm-mobile body>table.head{width:100%!important;max-width:100%;height:auto!important;margin:0 0 10px;table-layout:fixed;background:#fff}\n.pzm-mobile body>table.head>tbody>tr>td{width:auto!important;white-space:normal!important;padding:8px}\n.pzm-mobile body>table.head img{max-width:100%;height:auto;object-fit:contain}\n.pzm-mobile body>table.mainouter{display:block!important;width:100%!important;min-width:0!important;background:transparent;border:0!important}\n.pzm-mobile body>table.mainouter>tbody,.pzm-mobile body>table.mainouter>tbody>tr,.pzm-mobile body>table.mainouter>tbody>tr>td{display:block!important;width:100%!important;min-width:0!important;border:0!important}\n.pzm-mobile #outer{padding:0 10px!important;background:transparent!important}\n.pzm-mobile #nav_block{padding:0 10px!important;background:transparent!important}\n.pzm-mobile #nav{display:none!important}\n.pzm-mobile.pzm-menu-open #nav{display:block!important;background:white;padding:10px;border-radius:12px;margin:0 0 10px}\n.pzm-mobile #nav>ul{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:0;padding:0;gap:6px}\n.pzm-mobile #nav>ul>li{float:none!important;display:block!important;min-width:0;border:0!important;margin:0!important}\n.pzm-mobile #nav>ul>li>a{display:flex;align-items:center;min-height:44px;padding:8px 12px!important;border-radius:8px;background:#f0f5f7;color:#173f4e;white-space:normal!important;font-size:15px!important;line-height:1.5!important}\n.pzm-mobile #nav-mobile{display:none!important}\n.pzm-mobile ul[id^=\"nexus-menu\"]{max-width:calc(100vw - 20px)!important;left:10px!important}\n.pzm-mobile #info_block{display:none!important}\n.pzm-mobile.pzm-account-open #info_block{display:block!important;margin:0 0 12px;padding:12px;border:1px solid #dbe3e7;border-radius:12px;background:#fff}\n.pzm-mobile #info_block table,.pzm-mobile #info_block tbody,.pzm-mobile #info_block tr,.pzm-mobile #info_block td{display:block;width:100%!important;white-space:normal!important;padding:0;border:0;font-size:14px;line-height:1.9;background:transparent}\n.pzm-mobile #info_block a{display:inline-flex;align-items:center;min-height:44px;padding:2px 5px}\n.pzm-mobile #pzm-quick{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:1000;background:#ffffffef;backdrop-filter:blur(12px);border-top:1px solid #d4dfe5;padding:6px max(8px,env(safe-area-inset-left)) calc(6px + env(safe-area-inset-bottom));justify-content:space-around;gap:4px}\n.pzm-mobile #pzm-quick a{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;min-height:44px;color:#526873;border-radius:9px;font-size:14px;text-decoration:none}\n.pzm-mobile #pzm-quick a[aria-current]{color:#086b72;background:#e6f3f2;font-weight:700}\n.pzm-mobile a{color:#086b81;overflow-wrap:anywhere}\n.pzm-mobile a:focus-visible,.pzm-mobile button:focus-visible,.pzm-mobile input:focus-visible,.pzm-mobile [tabindex]:focus-visible{outline:3px solid #177a9b;outline-offset:2px}\n.pzm-mobile h1{font-size:20px!important;line-height:1.5;text-align:left;margin:16px 0 12px}\n.pzm-mobile h2{font-size:18px!important;line-height:1.5;margin:16px 0 8px;text-align:left}\n.pzm-mobile h3{font-size:16px!important}\n.pzm-mobile td,.pzm-mobile th,.pzm-mobile .small,.pzm-mobile .medium,.pzm-mobile font{font-size:inherit}\n.pzm-mobile td{line-height:1.6}\n.pzm-mobile img:not(.medium-zoom-image--opened),.pzm-mobile video,.pzm-mobile canvas{max-width:100%;height:auto}\n.pzm-mobile svg{max-width:100%;vertical-align:middle}\n.pzm-mobile iframe{max-width:100%;border:0}\n.pzm-mobile #iframe-shout-box{width:100%;min-height:230px}\n.pzm-mobile td.pzm-hotrail{display:flex!important;flex-wrap:nowrap;gap:10px;overflow-x:auto;white-space:nowrap!important;padding:10px 0!important;max-width:100%;overscroll-behavior-x:contain}\n.pzm-mobile .pzm-hotrail>a{flex:0 0 80px;display:block}\n.pzm-mobile .pzm-hotrail>a>img{width:80px;height:112px;object-fit:cover;border-radius:7px}\n.pzm-mobile pre{max-width:100%;overflow:auto;white-space:pre;font-size:13px;line-height:1.5;-webkit-overflow-scrolling:touch}\n.pzm-mobile blockquote{margin:10px 0;padding:10px;border-left:3px solid #b6cbd3;max-width:100%;background:#f4f7f9}\n.pzm-mobile input,.pzm-mobile select,.pzm-mobile textarea,.pzm-mobile button{font-family:inherit;font-size:16px!important;max-width:100%;border-radius:8px}\n.pzm-mobile input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"hidden\"]),.pzm-mobile select,.pzm-mobile button{min-height:44px;padding:8px 10px}\n.pzm-mobile input[type=\"checkbox\"],.pzm-mobile input[type=\"radio\"]{width:22px;height:22px;vertical-align:middle;accent-color:#087c82}\n.pzm-mobile textarea{width:100%!important;min-height:160px;padding:10px;line-height:1.6}\n.pzm-mobile input[type=\"text\"],.pzm-mobile input[type=\"password\"],.pzm-mobile input[type=\"number\"],.pzm-mobile input[type=\"search\"]{width:100%!important;min-width:0}\n.pzm-mobile .btn,.pzm-mobile .btn2,.pzm-mobile button,.pzm-mobile input[type=\"submit\"]{cursor:pointer}\n.pzm-mobile .pzm-layout,.pzm-mobile .pzm-layout>tbody,.pzm-mobile .pzm-layout>tbody>tr,.pzm-mobile .pzm-layout>tbody>tr>td{display:block;width:100%!important;min-width:0!important;max-width:100%;border:0!important;background:transparent}\n.pzm-mobile .pzm-layout>tbody>tr>td.embedded{padding:0!important}\n.pzm-mobile .pzm-kv{display:block;width:100%!important;min-width:0!important;margin:10px 0;background:#fff;border-radius:12px;overflow:hidden}\n.pzm-mobile .pzm-kv>tbody{display:block}\n.pzm-mobile .pzm-kv>tbody>tr{display:block;border-bottom:1px solid #e5ebee;padding:10px 12px}\n.pzm-mobile .pzm-kv>tbody>tr>td{display:block;width:100%!important;max-width:100%;min-width:0;white-space:normal!important;text-align:left!important;border:0!important;padding:3px 0!important;background:transparent}\n.pzm-mobile .pzm-kv>tbody>tr>td.rowhead{font-size:14px!important;font-weight:700;color:#5a707c;margin-bottom:4px}\n.pzm-mobile .pzm-kv>tbody>tr>td.rowhead a{min-height:44px;display:inline-flex;align-items:center}\n.pzm-mobile .pzm-scroll{display:block;max-width:100%;width:100%!important;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;background:#fff;border-radius:10px;margin:10px 0}\n.pzm-mobile .pzm-scroll>tbody{display:table;min-width:600px;width:100%}\n.pzm-mobile .pzm-scroll::before{content:'表内可左右滑动';display:block;position:sticky;left:0;padding:6px 10px;font-size:12px;color:#617985;background:#edf3f5}\n.pzm-mobile .pzm-scroll>tbody>tr>td,.pzm-mobile .pzm-scroll>tbody>tr>th{padding:9px 10px}\n.pzm-mobile .pzm-content>table:not(.pzm-kv):not(.pzm-scroll):not(.pzm-records){max-width:100%;width:100%!important}\n.pzm-mobile .pzm-content .nowrap{white-space:normal!important}\n.pzm-mobile .pzm-pages{display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:2}\n.pzm-mobile .pzm-pages a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:6px 10px;border:1px solid #d7e2e8;border-radius:9px;background:#fff}\n.pzm-mobile #usercpmenu,.pzm-mobile #pmboxmenu{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:8px 0}\n.pzm-mobile #usercpmenu li,.pzm-mobile #pmboxmenu li{float:none!important}\n.pzm-mobile #usercpmenu a,.pzm-mobile #pmboxmenu a{display:flex;align-items:center;min-height:44px;padding:8px;background:white;border-radius:8px}\n.pzm-mobile .pzm-post{display:block;width:100%!important;margin-top:16px;border:0!important;background:#e7f0f4;border-radius:10px;padding:10px}\n.pzm-mobile .pzm-post>tbody,.pzm-mobile .pzm-post>tbody>tr,.pzm-mobile .pzm-post>tbody>tr>td{display:block;width:100%!important;white-space:normal!important;background:transparent;border:0!important;padding:2px!important}\n.pzm-mobile .pzm-post-body{display:block;width:100%!important;background:#fff;border-radius:10px;margin-bottom:14px}\n.pzm-mobile .pzm-post-body>tbody,.pzm-mobile .pzm-post-body>tbody>tr,.pzm-mobile .pzm-post-body>tbody>tr>td{display:block;width:100%!important;border:0!important;padding:8px!important;white-space:normal!important;background:transparent}\n.pzm-mobile .pzm-post-body>tbody>tr:first-child>td:first-child{font-size:13px;color:#617680;border-bottom:1px solid #e0e8ec!important}\n.pzm-mobile .pzm-post-body img[alt=\"avatar\"]{max-width:44px;height:auto;float:left;margin-right:12px}\n.pzm-mobile .toolbox{overflow:auto}\n.pzm-mobile .toolbox a,.pzm-mobile .btn-post-like,.pzm-mobile .btn-post-reward{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}\n.pzm-mobile .pzm-records{display:block;width:100%!important;border:0!important}\n.pzm-mobile .pzm-records>tbody{display:block}\n.pzm-mobile .pzm-record-header{display:flex;gap:8px;flex-wrap:wrap;background:#e8eff3;padding:8px;border-radius:10px;margin:10px 0}\n.pzm-mobile .pzm-record-header>td{display:block;border:0;padding:2px;white-space:normal!important;background:transparent}\n.pzm-mobile .pzm-record-header a{display:inline-flex;min-height:44px;align-items:center}\n.pzm-mobile .pzm-record{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#fff;border:1px solid #dce5e9;margin:10px 0;border-radius:12px;padding:10px;gap:8px}\n.pzm-mobile .pzm-record>td{display:block;width:auto!important;border:0;min-width:0;padding:0;background:transparent!important;text-align:left!important;white-space:normal!important}\n.pzm-mobile .pzm-record>td:first-child{grid-column:1/-1;font-size:16px}\n.pzm-mobile .pzm-record>td::before{content:attr(data-pzm-label);display:block;font-size:12px;color:#647b87}\n.pzm-mobile .pzm-record a{display:inline-flex;min-height:44px;align-items:center}\n.pzm-mobile .pzm-download{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;margin:4px 0;background:#e5f4f1;color:#075c65;border:1px solid #b6dad4;border-radius:9px;word-break:break-all}\n.pzm-mobile .layui-layer{max-width:calc(100vw - 20px)!important;left:10px!important}\n.pzm-mobile .layui-layer-content{max-width:100%;max-height:70vh;overflow:auto!important}\n.pzm-mobile .layui-layer-content input,.pzm-mobile .layui-layer-content textarea{max-width:100%;min-width:0!important}\n.pzm-mobile .xdsoft_datetimepicker{max-width:calc(100vw - 16px)!important;left:8px!important;right:8px!important;width:auto!important}\n.pzm-mobile #calendar{width:100%!important;max-width:100%;font-size:13px}\n.pzm-mobile #calendar .fc-toolbar{flex-wrap:wrap;gap:8px}\n.pzm-mobile #calendar table{width:100%!important}\n.pzm-mobile #calendar .fc-daygrid-day-number{min-height:44px;min-width:32px;display:flex;align-items:center;justify-content:center}\n.pzm-mobile #footer{font-size:12px;color:#6a7b85;margin:20px 12px;overflow-wrap:anywhere}\n.pzm-mobile body.inframe{padding:8px!important;background:white!important}\n.pzm-mobile body.inframe td{font-size:14px!important;white-space:normal}\n/* Light mode deliberately retains site promotion colors and BBCode colors. */\n\n.pzm-mobile .pzm-search{margin:12px 0;background:#fff;border-radius:12px;border:1px solid #dce5e9;padding:10px}\n.pzm-mobile .pzm-search table,.pzm-mobile .pzm-search tbody,.pzm-mobile .pzm-search tr,.pzm-mobile .pzm-search td{width:100%!important;max-width:100%;min-width:0;white-space:normal!important;background:transparent;border:0!important}\n.pzm-mobile .pzm-search table{display:block}\n.pzm-mobile .pzm-search tbody{display:block}\n.pzm-mobile .pzm-search tr{display:flex;flex-wrap:wrap;gap:6px}\n.pzm-mobile .pzm-search td{display:block;padding:4px!important;flex:1 1 100%}\n.pzm-mobile .pzm-search table.searchbox{display:flex;flex-direction:column}\n.pzm-mobile .pzm-search table.searchbox>tbody:last-child{order:-1}\n.pzm-mobile .pzm-search table.searchbox>tbody:first-child .colhead>a{display:none}\n.pzm-mobile .pzm-search #ksearchboxmain[style*=\"none\"]{display:none!important}\n.pzm-mobile .pzm-search #ksearchboxmain td.bottom{flex:1 1 135px;width:auto!important;min-height:44px;display:flex;align-items:center;gap:6px}\n.pzm-mobile .pzm-search #ksearchboxmain td.bottom img{max-width:46px}\n.pzm-mobile .pzm-filter-label{display:flex;align-items:center;min-height:44px;font-size:14px}\n.pzm-mobile .pzm-search input[type=\"submit\"],.pzm-mobile [data-pzm-advanced]{width:100%;background:#0b737b;color:#fff;border:0}\n.pzm-mobile [data-pzm-advanced]{background:#e9f3f5;color:#174b5a}\n.pzm-mobile .pzm-search:not(.pzm-suggestions-open) .pzm-suggestions{display:none!important}\n.pzm-mobile .pzm-search .pzm-suggestions-toggle{min-height:44px;width:100%;margin-top:6px;background:#f4f7f8;color:#49636e;border:0;font-size:14px!important}\n.pzm-mobile .pzm-torrents{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent}\n.pzm-mobile .pzm-torrents>tbody{display:block}\n.pzm-mobile .pzm-torrents>tbody>.pzm-sort{display:flex;flex-wrap:nowrap;overflow-x:auto;max-width:100%;gap:6px;margin:12px 0;padding:10px;background:#e5edf1;border-radius:12px;overscroll-behavior-x:contain}\n.pzm-mobile .pzm-sort>td{display:block;min-width:0;background:transparent;border:0;padding:0!important;font-size:13px!important}\n.pzm-mobile .pzm-sort a{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;min-width:44px;padding:6px 9px;border:1px solid #cadbe3;border-radius:8px;background:#fff}\n.pzm-mobile .pzm-sort a>img{display:none}\n.pzm-mobile .pzm-sort>td{flex-shrink:0;color:#46616f}\n.pzm-mobile .pzm-torrents>tbody>.pzm-torrent{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px;border:1px solid #d7e3e9;border-radius:14px;margin:12px 0;background:#fff!important;box-shadow:0 2px 5px #17354505;cursor:pointer}\n.pzm-mobile .pzm-torrent>td{display:block;width:auto!important;min-width:0;max-width:100%;border:0!important;padding:0!important;background:transparent!important;white-space:normal!important;text-align:left!important;font-size:14px!important;line-height:1.5}\n.pzm-mobile .pzm-torrent>td::before{content:attr(data-pzm-label);display:block;font-size:12px;color:#647b87;margin-bottom:2px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]{grid-column:1/-1}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"]{order:-4}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]{order:-3}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"],.pzm-mobile .pzm-torrent>[data-pzm-field=\"leechers\"]{order:-2;font-size:16px!important;font-weight:650}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"]::before,.pzm-mobile .pzm-torrent>[data-pzm-field=\"title\"]::before{display:none}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] a{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13px;color:#53717e}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"category\"] img{max-width:46px;max-height:40px}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"]{grid-column:span 2}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"] br,.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"] br{display:none}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"time\"] br::after,.pzm-mobile .pzm-torrent>[data-pzm-field=\"size\"] br::after{content:' '}\n.pzm-mobile .pzm-name,.pzm-mobile .pzm-name>tbody{display:block!important;width:100%!important}\n.pzm-mobile .pzm-name>tbody>tr{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;background:transparent!important}\n.pzm-mobile .pzm-name>tbody>tr>td{display:block;min-width:0;width:auto!important;max-width:100%;padding:0!important;background:transparent!important;border:0;text-align:left!important;height:auto!important;white-space:normal!important}\n.pzm-mobile .pzm-name .pzm-cover{grid-column:1;grid-row:1}\n.pzm-mobile .pzm-cover img.nexus-lazy-load{width:64px;max-width:64px!important;max-height:96px!important;object-fit:contain;border-radius:6px}\n.pzm-mobile .pzm-name .pzm-name-title{grid-column:2;grid-row:1/3;font-size:14px!important;line-height:1.7;overflow-wrap:anywhere}\n.pzm-mobile .pzm-name-title>a[href*=\"details.php?\"]{display:inline;font-size:16px;font-weight:700;line-height:1.6;white-space:normal!important;overflow-wrap:anywhere}\n.pzm-mobile .pzm-promotion{display:inline-block;font-size:12px;line-height:1.6;background:#e1f3e9;color:#11643a;padding:2px 6px;margin:2px 3px;border-radius:5px;font-weight:650}\n.pzm-mobile .pzm-name-title span[style*=\"font-size:12px\"]{display:inline-block;padding:2px 5px!important;border-radius:4px!important;margin:3px 3px 3px 0!important}\n.pzm-mobile .pzm-name .pzm-rating{grid-column:1;grid-row:2;font-size:13px!important;line-height:1.6}\n.pzm-mobile .pzm-name .pzm-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}\n.pzm-mobile .pzm-actions>br{display:none}\n.pzm-mobile .pzm-actions>a{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;min-width:90px;background:#edf5f7;border:1px solid #cfe2e8;border-radius:9px;padding:7px 12px;color:#0c5c70;font-size:14px;text-decoration:none}\n.pzm-mobile .pzm-actions>a[href*=\"download.php\"]{background:#0b737b;color:#fff;border-color:#0b737b}\n.pzm-mobile .pzm-torrent>[data-pzm-field=\"seeders\"] a{color:#157342}\n.pzm-mobile .pzm-torrent>td:not([data-pzm-field=\"title\"]):not([data-pzm-field=\"category\"]) a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}\n@media(min-width:700px){.pzm-mobile .pzm-torrent>td[data-pzm-field=\"time\"]{grid-column:auto}.pzm-mobile .pzm-torrent{grid-template-columns:repeat(5,minmax(0,1fr))}}\n");}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
/**
 * Net.Coffee 快捷检测（Kiki版）v0.1
 * Loon node/strategy generic action, separate from IPRisk_Kiki.
 * Opens the ORIGINAL website; does not scrape or impersonate its results.
 * This script probes the selected Loon node only to show its egress IPv4.
 * Browsers use their own Loon routing; selecting a node here does not switch it.
 */
'use strict';
(function () {
  var env = typeof $environment !== 'undefined' && $environment || {};
  var p = env.params || {};
  var node = typeof p.node === 'string' && p.node.trim() ? p.node.trim() : '';
  if (!node && p.nodeInfo && typeof p.nodeInfo === 'object') {
    node = String(p.nodeInfo.name || p.nodeInfo.tag || p.nodeInfo.node || '').trim();
  }
  var sites = [
    {name:'Claude AI 检测',url:'https://ip.net.coffee/claude/'},
    {name:'GPT 检测',url:'https://ip.net.coffee/gpt/'},
    {name:'IP 评分查询',url:'https://ip.net.coffee/ip/'}
  ];
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function validV4(value) {
    var bits=String(value||'').trim().split('.');
    return bits.length===4 && bits.every(function(x){
      return /^\d{1,3}$/.test(x) && Number(x)>=0 && Number(x)<=255;
    });
  }
  function finish(ip, source) {
    var html=[];
    html.push('<div style="font-family:-apple-system,Arial,sans-serif;font-size:16px;line-height:1.55;'+
      'color:#263449;padding:9px 8px 15px;">');
    html.push('<div style="font-size:20px;font-weight:750;">Net.Coffee 快捷检测 <span style="font-size:12px;color:#87909d;">Kiki版 v0.1</span></div>');
    html.push('<div style="font-size:14px;color:#657080;margin:4px 0 12px;">'+esc(node||'当前入口')+'</div>');
    if (ip) {
      html.push('<div style="font-size:13px;color:#687385;">所选节点出口 IPv4</div>');
      html.push('<div style="font-size:24px;font-weight:750;color:#182c47;margin:2px 0 9px;">'+esc(ip)+'</div>');
    } else {
      html.push('<div style="font-size:13px;color:#8c6371;margin:5px 0 10px;">'+
        (node?'未能获取该节点的出口 IPv4，仍可打开网页':'请长按具体节点使用，网页入口仍可打开')+
        '</div>');
    }
    html.push('<hr style="border:0;border-top:1px solid #dfe3ea;margin:8px 0 11px;">');
    sites.forEach(function(s) {
      html.push('<div style="font-size:17px;margin:11px 0;">'+
        '<a href="'+esc(s.url)+'" style="font-weight:650;color:#1769b4;text-decoration:none;">'+
        esc(s.name)+'　›</a></div>');
    });
    html.push('<div style="font-size:12px;color:#747f8d;line-height:1.5;margin-top:13px;">'+
      '网页检测的是浏览器实际出口，不会自动切换成上方节点。'+
      '比较两处 IP 一致后再看网站结果。</div>');
    html.push('</div>');
    // Notifications are documented to open URLs when tapped. Loon's generic
    // result panel may not activate links on every iOS build: notification fallback.
    try {
      if (typeof $notification !== 'undefined' && $notification && $notification.post) {
        $notification.post('Net.Coffee · Claude 检测',
          node||'Loon 节点快捷入口',
          '点击通知打开原站（浏览器当前出口）',
          {openUrl: sites[0].url});
      }
    } catch(e) {}
    $done({title:'Net.Coffee · Kiki版',htmlMessage:html.join(''),icon:'safari'});
  }
  if (!node) {finish('','');return;}
  var done=false;
  function probe(url, parse, next) {
    $httpClient.get({url:url,node:node,timeout:8},function(err,res,body){
      if (done) return;
      var ip='';
      if (!err) {
        try { ip=parse(body); } catch(e) {}
      }
      if (validV4(ip)) {done=true;finish(ip,url);}
      else next();
    });
  }
  probe('https://v4.ident.me/',function(s){return String(s||'').trim();},function(){
    probe('https://api4.ipify.org?format=json',function(s){return JSON.parse(s).ip;},function(){
      done=true;finish('','');
    });
  });
})();

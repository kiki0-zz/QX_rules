/**
 * 节点 IP 风险检测（Kiki版）v1.2.0
 * Loon Generic script; runs ONLY when launched from a node/strategy menu.
 * Uses independent official APIs. Scores from different companies are NOT equivalent.
 * Maintainer: https://github.com/kiki0-zz/QX_rules
 */
'use strict';

(function () {
  var params = (typeof $environment !== 'undefined' && $environment && $environment.params) || {};
  var node = typeof params.node === 'string' ? params.node.trim() : '';
  // Newer Loon builds may expose the selected node name in nodeInfo.
  if (!node && params.nodeInfo && typeof params.nodeInfo.name === 'string') node = params.nodeInfo.name.trim();
  var conf = (typeof $argument !== 'undefined' && $argument && typeof $argument === 'object') ? $argument : {};
  var done = false;

  function finish(title, content) {
    if (done) return;
    done = true;
    $done({ title: title, content: content });
  }
  function request(method, url, timeout, headers, body) {
    return new Promise(function (resolve, reject) {
      var options = { url: url, node: node, timeout: timeout,
        insecure: false,
        headers: headers || {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
        } };
      // Node targeting follows the official Loon $httpClient option: "node".
      // Do not silently fall back to DIRECT or the global proxy during discovery.
      if (body !== undefined) options.body = body;
      try {
        $httpClient[method](options, function (error, response, text) {
          if (error) return reject(new Error(String(error).slice(0, 150)));
          var status = Number(response && (response.status || response.statusCode));
          if (!Number.isFinite(status) || status < 200 || status >= 300)
            return reject(new Error('HTTP ' + (status || '?')));
          resolve(String(text === undefined || text === null ? '' : text));
        });
      } catch (e) { reject(e); }
    });
  }
  function getJSON(url, timeout, headers) {
    return request('get', url, timeout, headers).then(function (text) {
      try { return JSON.parse(String(text)); } catch (_) { throw new Error('非 JSON 响应'); }
    });
  }
  function txt(v, fallback) {
    return v === null || v === undefined || v === '' ? (fallback || '未知') : String(v);
  }
  function score(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }
  function flag(v) {
    if (v === true || v === 'yes') return '是';
    if (v === false || v === 'no') return '否';
    return '未知';
  }
  function getConfig(key) {
    return typeof conf[key] === 'string' ? conf[key].trim() : '';
  }
  function errorText(e) { return String(e && e.message || e).slice(0, 90); }
  function validIP(ip) {
    if (typeof ip !== 'string') return false;
    var a = ip.split('.');
    if (a.length === 4) return a.every(function (x) { return /^\d{1,3}$/.test(x) && Number(x) <= 255; });
    return ip.indexOf(':') !== -1 && /^[0-9a-fA-F:]{2,39}$/.test(ip);
  }
  // Distinguish IPv4 and IPv6. A dual-stack website may choose different
  // address families without implying proxy leakage or route splitting.
  function exitIP() {
    var primary = [
      { name: 'Cloudflare Trace', url: 'https://www.cloudflare.com/cdn-cgi/trace', kind: 'trace' },
      { name: 'ident.me', url: 'https://v4.ident.me/', kind: 'text' },
      { name: 'ipify IPv4', url: 'https://api4.ipify.org?format=json', kind: 'json' },
      { name: 'ipinfo.io', url: 'https://ipinfo.io/json', kind: 'json' }
    ];
    var backup = [
      { name: 'ipapi.is', url: 'https://api.ipapi.is/', kind: 'json' },
      { name: 'ip.sb', url: 'https://api.ip.sb/ip', kind: 'text' }
    ];
    var problems = [];
    function probe(p) {
      return request('get', p.url, 9000).then(function (raw) {
        var ip = '';
        if (p.kind === 'trace') {
          var m = raw.match(/(?:^|\n)ip=([^\r\n]+)/);
          ip = m ? m[1].trim() : '';
        } else if (p.kind === 'json') {
          var obj;
          try { obj = JSON.parse(raw); } catch(e) { throw new Error('非 JSON 响应'); }
          ip = String(obj && (obj.ip || obj.query) || '').trim();
        } else ip = String(raw || '').trim();
        if (!validIP(ip)) throw new Error('未返回有效 IP');
        return { name: p.name, ip: ip };
      }).catch(function(e) {
        problems.push(p.name + '：' + errorText(e));
        return null;
      });
    }
    function choose(records) {
      var good = records.filter(Boolean);
      if (!good.length) throw new Error('出口 IP 无法获取：\n' + problems.join('\n'));
      var v4 = good.filter(function(x){return x.ip.indexOf(':') < 0;});
      var v6 = good.filter(function(x){return x.ip.indexOf(':') >= 0;});
      var chosen = v4.length ? v4 : v6;
      var counts = {};
      chosen.forEach(function(x){counts[x.ip] = (counts[x.ip] || 0) + 1;});
      var ips = Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
      var ip = ips[0];
      var mismatch = ips.length>1 ? ('同类 IP 探测不一致：' + chosen.map(function(x){return x.name+'='+x.ip;}).join('，')) : '';
      return {
        ip: ip,
        source: chosen.filter(function(x){return x.ip===ip;}).map(function(x){return x.name;}).join('、'),
        ipv6: v4.length && v6.length ? v6[0].ip : '',
        warning: mismatch,
        probeCount: good.length,
        failed: problems
      };
    }
    return Promise.all(primary.map(probe)).then(function(xs){
      if(xs.some(Boolean)) return choose(xs);
      return Promise.all(backup.map(probe)).then(choose);
    });
  }

  function htmlEsc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function hText(v) { return htmlEsc(v === null || v === undefined || v === '' ? '—' : v); }
  function block(label, body) {
    return '<section style="background:#fff;border:1px solid #e8e8ed;border-radius:16px;padding:14px;margin-bottom:10px;">' +
      '<div style="font-size:13px;font-weight:700;color:#3f4652;margin-bottom:9px;">' + htmlEsc(label) + '</div>' + body + '</section>';
  }
  function item(label, value) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f2f2f4;font-size:12px;line-height:1.45;">' +
      '<span style="color:#747987;flex:0 0 88px;">' + htmlEsc(label) + '</span>' +
      '<span style="color:#252a35;font-weight:600;text-align:right;flex:1;overflow-wrap:anywhere;">' + hText(value) + '</span></div>';
  }
  function pill(label, status) {
    var col = status===true ? '#a33f29' : status===false ? '#19734e' : '#737887';
    var bg = status===true ? '#fff0ea' : status===false ? '#eaf8ef' : '#f1f2f5';
    return '<span style="font-size:11px;font-weight:600;color:'+col+';background:'+bg+';border-radius:7px;padding:5px 8px;display:inline-block;margin:0 5px 5px 0;">' + htmlEsc(label) + '</span>';
  }
  function riskCard(source, value, note) {
    var n=score(value);
    var c=n===null?'#777d89':n<=25?'#1c855c':n<=50?'#b47c1b':'#ba433c';
    var bg=n===null?'#f3f4f6':n<=25?'#ecf9f3':n<=50?'#fff7e7':'#fff0ee';
    return '<div style="border-radius:14px;background:'+bg+';padding:14px 12px;margin-bottom:8px;">' +
      '<div style="color:#626a77;font-size:11px;font-weight:600;">'+htmlEsc(source)+'</div>' +
      '<div style="font-size:30px;font-weight:800;line-height:1.2;color:'+c+';margin:4px 0 5px;">' +
      (n===null?'暂无评分':(n+'<span style="font-size:13px;font-weight:600;"> / 100</span>')) + '</div>' +
      '<div style="font-size:11px;color:#64707b;overflow-wrap:anywhere;">'+htmlEsc(note)+'</div></div>';
  }
  function details(title, body) {
    return '<details style="border:1px solid #e5e7ec;border-radius:14px;margin:9px 0;background:#fff;overflow:hidden;">' +
      '<summary style="font-size:12px;padding:13px 14px;font-weight:700;color:#424957;">'+htmlEsc(title)+'</summary>' +
      '<div style="padding:0 14px 13px;font-size:12px;color:#626a79;line-height:1.5;">'+body+'</div></details>';
  }
  function finishHtml(html) {
    if (done) return;
    done = true;
    $done({title:'\u200B',htmlMessage:html,icon:'shield.lefthalf.filled'});
  }

  function examine(discovery) {
    var ip=discovery.ip, outcomes={}, jobs=[];
    function add(name,p) {
      jobs.push(p.then(function(v){outcomes[name]={ok:true,data:v};})
        .catch(function(e){outcomes[name]={ok:false,error:errorText(e)};}));
    }
    add('proxycheck',getJSON('https://proxycheck.io/v3/'+encodeURIComponent(ip),11000));
    var apiKey=getConfig('ipapi_key');
    if(apiKey) add('ipapi',request('post','https://api.ipapi.is/',11000,
      {'Content-Type':'application/json',Accept:'application/json'},
      JSON.stringify({q:ip,key:apiKey})).then(function(x){return JSON.parse(x);}));
    else add('ipapi',getJSON('https://api.ipapi.is/?q='+encodeURIComponent(ip),11000));
    add('ipwho',getJSON('https://ipwho.is/'+encodeURIComponent(ip),11000));
    // IPPure scores the ACTUAL requesting egress. Validate the returned IP.
    add('ippure',getJSON('https://my.ippure.com/v1/info',11000));
    var su=getConfig('scamalytics_user'),sk=getConfig('scamalytics_key');
    if(su && sk){
      var sr=getConfig('scamalytics_region').toUpperCase()==='US'?'api11':'api12';
      add('scamalytics',getJSON('https://'+sr+'.scamalytics.com/v3/'+encodeURIComponent(su)+
        '?key='+encodeURIComponent(sk)+'&ip='+encodeURIComponent(ip),11000));
    }
    var ik=getConfig('ipqs_key');
    if(ik) add('ipqs',getJSON('https://ipqualityscore.com/api/json/ip?ip='+encodeURIComponent(ip)+
      '&strictness=0&allow_public_access_points=true&lighter_penalties=true&mobile=true',
      11000,{'IPQS-KEY':ik,Accept:'application/json'}));

    Promise.all(jobs).then(function(){
      var p=outcomes.proxycheck;
      var rec=p && p.ok && p.data && p.data[ip] || null;
      var status=p && p.ok && p.data && p.data.status;
      var validP=!!(rec && rec.detections && (status==='ok'||status==='warning'));
      var det=validP?rec.detections:{};
      var pcRisk=validP?score(det.risk):null;
      var loc=validP?rec.location||{}:{};
      var net=validP?rec.network||{}:{};
      var geo=outcomes.ipapi;
      var g=geo && geo.ok && geo.data && !geo.data.error ? geo.data : null;
      var who=outcomes.ipwho;
      var w=who && who.ok && who.data && who.data.success!==false ? who.data : null;
      var pr=outcomes.ippure;
      var pure=pr && pr.ok && pr.data && validIP(pr.data.ip) ? pr.data : null;
      var pureScore=null, pureNote='数据源不可用';
      if(pure && pure.ip===ip){
        pureScore=score(pure.fraudScore);
        pureNote=pureScore===null?'暂无风险分':'本机构风险分';
      } else if(pure){
        pureNote='检测出口不一致';
      } else if(pr){
        pureNote='API 不可用';
      }
      var pcNote=validP?'本机构风险分':(p&&p.ok?'评分未返回':'API 不可用');
      var type=txt(net.type,txt(pure && pure.ip===ip && (pure.isResidential===true?'Residential':null),
        txt(g && g.is_datacenter===true?'Datacenter':null,'未知')));
      var country=txt(loc.country_name,txt(g && g.location && g.location.country,txt(w&&w.country)));
      var city=txt(loc.city_name,txt(g&&g.location&&g.location.city,txt(w&&w.city)));
      var asn=txt(net.asn,txt(g&&g.asn&&g.asn.asn,txt(w&&w.connection&&w.connection.asn)));
      var company=txt(net.provider,txt(g&&g.company&&g.company.name,txt(w&&w.connection&&w.connection.org)));
      var s=outcomes.scamalytics;
      var sa=s&&s.ok&&s.data&&s.data.scamalytics||{};
      var scamScore=s&&s.ok?score(sa.scamalytics_score):null;
      var q=outcomes.ipqs;
      var ipqsScore=q&&q.ok?score(q.data&&q.data.fraud_score):null;
      var badges=validP?
         pill('代理：'+flag(det.proxy),det.proxy)+pill('VPN：'+flag(det.vpn),det.vpn)+
         pill('机房：'+flag(det.hosting),det.hosting)+pill('Tor：'+flag(det.tor),det.tor):
         pill('proxycheck 类型未返回',null);
      // risk score 0 is valid. Lack of a detection does NOT prove residential quality.
      var cleanNote=pcRisk===0?'0 分只是该机构当前未识别明显风险，不代表住宅 IP 或所有网站都认为纯净。':
        '评分越低表示该机构评估的风险越低；不同机构分数不能混算。';

      var debug=[];
      discovery.failed.forEach(function(x){debug.push('出口探测 · '+x);});
      if(!p.ok)debug.push('proxycheck.io · '+p.error);
      if(!geo.ok)debug.push('ipapi.is · '+geo.error);
      if(!who.ok)debug.push('ipwho.is · '+who.error);
      if(!pr.ok)debug.push('IPPure · '+pr.error);
      if(pure&&pure.ip!==ip)debug.push('IPPure 返回 '+pure.ip+'，与检测目标 '+ip+' 不同，已排除评分');
      if(discovery.warning)debug.push(discovery.warning);
      var debugHtml=debug.length?debug.map(function(x){return '<div style="padding:4px 0;">'+htmlEsc(x)+'</div>';}).join(''):
        '<div>没有发现请求报错。</div>';
      var html='<div style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;font-size:13px;line-height:1.4;color:#232b36;text-align:left;overflow-wrap:anywhere;padding:12px 4px 68px;">'+
        '<div style="font-size:20px;font-weight:800;margin:3px 4px 5px;">节点风险检测 <span style="font-size:10px;font-weight:600;color:#8c93a1;">Kiki版 v1.2</span></div>'+
        '<div style="font-size:11px;color:#767d88;margin:0 4px 12px;">'+htmlEsc(node)+'</div>'+
        '<div style="background:#202c45;border-radius:17px;padding:15px 16px;margin-bottom:11px;color:#fff;">'+
          '<div style="font-size:10px;color:#c2cbdb;">当前出口 '+(ip.indexOf(':') >= 0 ? 'IPv6' : 'IPv4')+'</div>'+
          '<div style="font-size:24px;letter-spacing:.4px;font-weight:800;margin:3px 0 7px;">'+hText(ip)+'</div>'+
          '<div style="font-size:12px;color:#cbd4e2;">'+hText(country)+' · '+hText(city)+'&nbsp;&nbsp; | &nbsp;&nbsp;'+hText(type)+'</div>'+
          '<div style="font-size:10px;color:#9eabc0;margin-top:9px;">IP 来源：'+hText(discovery.source)+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:9px;">'+
          '<div style="flex:1;min-width:0;">'+riskCard('proxycheck.io · 风险',pcRisk,pcNote)+'</div>'+
          '<div style="flex:1;min-width:0;">'+riskCard('IPPure · 风险',pureScore,pureNote)+'</div>'+
        '</div>'+
        '<div style="color:#767d87;font-size:11px;margin:0 3px 13px;">'+htmlEsc(cleanNote)+'</div>'+
        block('风险识别 · proxycheck.io',badges+
          '<div style="color:#737987;font-size:11px;margin-top:4px;">仅代表该数据库识别状态。Business/机房/住宅类型不等于风险评分。</div>')+
        block('归属地与网络',item('IP 类型',type)+item('IPPure 住宅',pure&&pure.ip===ip?flag(pure.isResidential):'未确认')+item('国家/城市',country+' · '+city)+
          item('ASN',asn)+item('运营商',company))+
        details('更多数据源（Scamalytics / IPQS / ASN）',
          item('Scamalytics',!su||!sk?'未配置密钥':scamScore===null?'接口未提供分数 / 请求异常':scamScore+'/100')+
          item('IPQualityScore',!ik?'未配置密钥':ipqsScore===null?'接口未提供分数 / 请求异常':ipqsScore+'/100')+
          item('ipapi.is',g?'已返回基础资料':geo.error)+
          item('ipwho.is',w?'已返回基础资料':who.error))+
        details('出口 IP 与检测日志',
          item('IPv4',ip)+item('IPv6',discovery.ipv6||'未检测到')+
          item('出口来源',discovery.source)+
          '<div style="padding-top:7px;color:#8a9099;font-size:11px;">不同 IP 协议族出现两个地址是正常现象，不直接视为出口分流。</div>'+
          (discovery.warning?'<div style="color:#b45309;margin-top:6px;">'+htmlEsc(discovery.warning)+'</div>':'')+
          debugHtml)+
        '<div style="font-size:10px;color:#8b929b;padding:4px 7px;">检测结果仅供参考 · 第三方接口可能限流或误判 · 不提供综合纯净度分</div></div>';
      finishHtml(html);
    }).catch(function(e){finish('Kiki版 · 检测错误',errorText(e));});
  }

  if(!node){
    finish('Kiki版 · 节点 IP 风险','请在 Loon 节点列表长按具体节点运行检测。');
    return;
  }
  exitIP().then(examine).catch(function(e){
    finish('Kiki版 · 出口探测失败','节点：'+node+'\n'+String(e&&e.message||e).slice(0,850));
  });
})();

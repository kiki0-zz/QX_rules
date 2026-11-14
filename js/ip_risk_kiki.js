/**
 * 节点 IP 风险检测（Kiki版）v0.1
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


  // City-level labels in English. Tokyo's 23 special wards are sometimes
  // returned by databases as "Shibuya City", "Shinjuku City", etc.
  // They are wards, not the city-level label the user expects.
  function cityLevelEnglish(country, rawCity) {
    var city = String(rawCity || '').trim();
    var nation = String(country || '').trim().toLowerCase();
    if ((nation === 'japan' || nation === 'jp' || nation === '日本') && city) {
      var wardMatch = city.match(/^(.+?)\s+(?:City|Ward)$/i) ||
        city.match(/^(.+?)[-\s]ku$/i);
      if (wardMatch) {
        var ward = wardMatch[1].toLowerCase().replace(/[^a-z]/g,'');
        var tokyoWards = [
          'adachi','arakawa','bunkyo','chiyoda','chuo','edogawa',
          'itabashi','katsushika','kita','koto','meguro','minato',
          'nakano','nerima','ota','setagaya','shibuya','shinagawa',
          'shinjuku','suginami','sumida','taito','toshima'
        ];
        if (tokyoWards.indexOf(ward) !== -1) return 'Tokyo';
      }
    }
    return city;
  }

  function examine(discovery) {
    var ip=discovery.ip, outcomes={}, jobs=[];
    function add(name,p){
      jobs.push(p.then(function(v){outcomes[name]={ok:true,data:v};})
        .catch(function(e){outcomes[name]={ok:false,error:errorText(e)};}));
    }
    add('proxycheck',getJSON('https://proxycheck.io/v3/'+encodeURIComponent(ip),11000));
    var apiKey=getConfig('ipapi_key');
    if(apiKey){
      add('ipapi',request('post','https://api.ipapi.is/',11000,
        {'Content-Type':'application/json',Accept:'application/json'},
        JSON.stringify({q:ip,key:apiKey})).then(JSON.parse));
    } else add('ipapi',getJSON('https://api.ipapi.is/?q='+encodeURIComponent(ip),11000));
    add('ipwho',getJSON('https://ipwho.is/'+encodeURIComponent(ip),11000));
    // IPPure reports the IP of ITS request; it does not query arbitrary addresses.
    add('ippure',getJSON('https://my.ippure.com/v1/info',11000));
    var su=getConfig('scamalytics_user'),sk=getConfig('scamalytics_key');
    if(su && sk){
      var sr=getConfig('scamalytics_region').toUpperCase()==='US'?'api11':'api12';
      add('scamalytics',getJSON('https://'+sr+'.scamalytics.com/v3/'+encodeURIComponent(su)+
        '?key='+encodeURIComponent(sk)+'&ip='+encodeURIComponent(ip),11000));
    }
    var ik=getConfig('ipqs_key');
    if(ik){
      add('ipqs',getJSON('https://ipqualityscore.com/api/json/ip?ip='+encodeURIComponent(ip)+
        '&strictness=0&allow_public_access_points=true&lighter_penalties=true&mobile=true',
        11000,{'IPQS-KEY':ik,Accept:'application/json'}));
    }

    Promise.all(jobs).then(function(){
      var p=outcomes.proxycheck;
      var record=p && p.ok && p.data && p.data[ip] || {};
      var validP=!!(record.detections && (p.data.status==='ok' || p.data.status==='warning'));
      var det=validP?record.detections:{};
      var pcRisk=validP?score(det.risk):null;
      var loc=validP?record.location||{}:{};
      var net=validP?record.network||{}:{};
      var device=validP?record.device_estimate||{}:{};
      function estimatedDevices(v){
        if(v===null||v===undefined||v==='')return null;
        var n=Number(v);
        return Number.isFinite(n)&&n>=0&&Number.isInteger(n)?n:null;
      }
      var devicesIp=estimatedDevices(device.address);
      var devicesSubnet=estimatedDevices(device.subnet);
      var geo=outcomes.ipapi, g=geo && geo.ok && geo.data && !geo.data.error?geo.data:null;
      var who=outcomes.ipwho, w=who && who.ok && who.data && who.data.success!==false?who.data:null;
      var pr=outcomes.ippure;
      var pure=pr && pr.ok && pr.data && validIP(pr.data.ip) ? pr.data : null;
      var pureSameIP=!!(pure && pure.ip.toLowerCase()===ip.toLowerCase());
      // On dual-stack connections, IPPure may report IPv6 while the primary result
      // is IPv4. This can be presented ONLY when that IPv6 has been observed
      // independently by another probe through the SAME selected Loon node.
      var pureVerifiedV6=!!(pure && !pureSameIP && discovery.ipv6 &&
        pure.ip.toLowerCase()===discovery.ipv6.toLowerCase());
      var pureUsable=pureSameIP || pureVerifiedV6;
      var ippureCoefficient=pureUsable?score(pure.ippureCoefficient):null;
      var pureScore=ippureCoefficient!==null?ippureCoefficient:(pureUsable?score(pure.fraudScore):null);
      // This coefficient is estimated by the IPPure website; it is NOT
      // Cloudflare's official Bot Management or WAF score.
      var ippureCfEstimate=pureUsable?score(pure.cloudflareCoefficient):null;
      var isV6=ip.indexOf(':')>=0;
      var type=txt(net.type,txt(g && g.is_datacenter===true?'Datacenter':null,'未知'));
      var country=txt(loc.country_name,txt(g&&g.location&&g.location.country,txt(w&&w.country)));
      var rawCity=txt(loc.city_name,txt(g&&g.location&&g.location.city,txt(w&&w.city)));
      var city=cityLevelEnglish(country, rawCity);
      var asn=txt(net.asn,txt(g&&g.asn&&g.asn.asn,txt(w&&w.connection&&w.connection.asn)));
      var provider=txt(net.provider,txt(g&&g.company&&g.company.name,txt(w&&w.connection&&w.connection.org)));
      var s=outcomes.scamalytics, so=s&&s.ok&&s.data&&s.data.scamalytics||{};
      var scamScore=s&&s.ok?score(so.scamalytics_score):null;
      var q=outcomes.ipqs, ipqsScore=q&&q.ok?score(q.data&&q.data.fraud_score):null;
      var showDetails=conf && (conf.show_details===true || conf.show_details==='true');
      var scoreColor=pcRisk===null?'#697386':pcRisk<=25?'#17764a':pcRisk<=50?'#a76b0c':'#bf3e37';
      var scoreText=pcRisk===null?'无有效评分':pcRisk+' / 100';
      var riskLabel=pcRisk===null?'':pcRisk<=25?'较低':pcRisk<=50?'中等':'较高';
      var typemap={Hosting:'机房',Datacenter:'机房',Residential:'住宅',Business:'商业网络',Mobile:'移动网络'};
      var typeChinese=typemap[type]||type;
      if(typeChinese!==type)typeChinese+='（'+type+'）';
      var addressLine=country + (city!=='未知'?' · '+city:'');
      var card=[];
      function line(label,value){
        return '<div style="font-size:16px;line-height:1.55;margin:5px 0;">'+
          '<span style="color:#596273;">'+htmlEsc(label)+'：</span>'+
          '<b style="font-size:16px;color:#1e293b;">'+hText(value)+'</b></div>';
      }
      function labelStatus(label,val){
        return htmlEsc(label)+' '+(val===true?'是':val===false?'否':'未知');
      }
      function statusLine(label,val){
        return '<span style="font-size:13px;color:'+(val===true?'#b04a32':val===false?'#28734f':'#697386')+';">'+
          labelStatus(label,val)+'</span>';
      }

      card.push('<div style="font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;'+
        'font-size:16px;line-height:1.5;text-align:left;color:#1f2937;overflow-wrap:anywhere;padding:8px 8px 14px;">');
      card.push('<div style="font-size:20px;font-weight:800;margin:0 0 3px;">节点风险检测 <span style="font-size:12px;color:#7f8794;">Kiki版 v0.1</span></div>');
      card.push('<div style="font-size:15px;color:#626a78;margin:0 0 13px;">'+hText(node)+'</div>');
      card.push('<div style="font-size:14px;color:#657080;">当前出口 '+(isV6?'IPv6':'IPv4')+'</div>');
      card.push('<div style="font-size:23px;font-weight:800;color:#17263f;margin:2px 0 5px;overflow-wrap:anywhere;">'+hText(ip)+'</div>');
      card.push('<div style="font-size:16px;color:#444f60;margin-bottom:11px;">'+hText(addressLine)+'</div>');
      card.push('<hr style="border:0;border-top:1px solid #dfe3ea;margin:8px 0 10px;">');
      card.push('<div style="font-size:15px;font-weight:700;color:#47566c;">风险 · proxycheck.io</div>');
      card.push('<div style="font-size:31px;font-weight:800;color:'+scoreColor+';margin:2px 0 6px;">'+hText(scoreText)+
        (riskLabel?' <span style="font-size:15px;font-weight:600;color:'+scoreColor+';">'+riskLabel+'</span>':'')+'</div>');
      if(pcRisk!==null)card.push('<div style="height:5px;background:#e6e8ee;border-radius:4px;margin-bottom:9px;overflow:hidden;">'+
        '<div style="height:5px;background:'+scoreColor+';width:'+Math.max(pcRisk,1)+'%;"></div></div>');
      card.push('<div style="font-size:15px;font-weight:700;color:#47566c;margin-top:9px;">网络信息</div>');
      card.push(line('IP 类型',typeChinese));
      card.push(line('ASN',asn));
      card.push(line('运营商',provider));
      if(validP){
        // Loon's HTML popup stacks table cells vertically. Use ONE inline
        // text run in ONE block, not a table, flex/grid or separate rows.
        card.push('<div style="margin-top:9px;font-size:13px;line-height:1.5;white-space:nowrap;color:#455262;">'+
          '<span style="color:'+(det.hosting===true?'#b04a32':'#28734f')+';">机房 '+flag(det.hosting)+'</span>　'+
          '<span style="color:'+(det.proxy===true?'#b04a32':'#28734f')+';">代理 '+flag(det.proxy)+'</span>　'+
          '<span style="color:'+(det.vpn===true?'#b04a32':'#28734f')+';">VPN '+flag(det.vpn)+'</span>　'+
          '<span style="color:'+(det.tor===true?'#b04a32':'#28734f')+';">Tor '+flag(det.tor)+'</span>'+
          '</div>');
      } else {
        card.push('<div style="font-size:14px;color:#a56d0d;margin-top:8px;">风险识别数据暂不可用</div>');
      }
      card.push('<hr style="border:0;border-top:1px solid #dfe3ea;margin:11px 0 9px;">');
      card.push('<div style="font-size:15px;font-weight:700;color:#47566c;margin:0 0 5px;">共享情况 · 设备估算</div>');
      if(devicesIp!==null || devicesSubnet!==null){
        // A zero device estimate is not evidence of zero people sharing the IP.
        if(devicesIp!==null)card.push(line('同 IP 设备',devicesIp===0?'暂无可靠估算（返回 0）':devicesIp+' 台（估算）'));
        if(devicesSubnet!==null)card.push(line('网段设备',devicesSubnet===0?'暂无可靠估算（返回 0）':devicesSubnet+' 台（估算）'));
        card.push('<div style="font-size:12px;color:#7a8190;line-height:1.4;margin-top:3px;">'+
          'proxycheck.io 估计值；不等于 Ping0 共享人数或在线人数。</div>');
      }else{
        card.push('<div style="font-size:13px;color:#7a8190;">暂未获得设备数量估算。</div>');
      }
      // Keep IPPure independent. A verified IPv6 score must never be labeled
      // as the risk score for the IPv4 in the header.
      if(pureUsable && (pureScore!==null || ippureCfEstimate!==null)){
        card.push('<hr style="border:0;border-top:1px solid #dfe3ea;margin:11px 0 9px;">');
        card.push('<div style="font-size:15px;font-weight:700;color:#47566c;margin-bottom:3px;">IPPure · 独立指标</div>');
        if(pureVerifiedV6)card.push('<div style="font-size:12px;color:#687285;margin-bottom:3px;">该结果对应已核实的 IPv6，不代表上方 IPv4。</div>');
        if(pureScore!==null)card.push(line('IPPure 系数',pureScore+'%'));
        if(ippureCfEstimate!==null)card.push(line('CF 系数估算',ippureCfEstimate+'%（非 CF 官方）'));
      } else {
        // Show a single compact status rather than a large empty score panel.
        card.push('<div style="font-size:13px;color:#808795;margin-top:9px;">'+
          (pureVerifiedV6?'IPPure：已取得 IPv6，暂无有效评分':
            pure?'IPPure：暂未取得对应出口的有效评分':'IPPure：接口暂不可用')+'</div>');
      }
      if(scamScore!==null)card.push(line('Scamalytics',scamScore+' / 100（独立评分）'));
      if(ipqsScore!==null)card.push(line('IPQualityScore',ipqsScore+' / 100（独立评分）'));
      card.push('<div style="font-size:13px;line-height:1.5;color:#7a8190;margin-top:11px;">'+
        '各机构评分标准不同；设备估算不等于 Ping0 共享人数，也不保证平台解锁。</div>');
      if(showDetails){
        card.push('<hr style="border:0;border-top:1px solid #dfe3ea;margin:12px 0 10px;">');
        card.push('<div style="font-size:17px;font-weight:700;margin-bottom:7px;">检测详情</div>');
        card.push(line('出口来源',discovery.source));
        if(rawCity!==city)card.push(line('GeoIP 原始城市',rawCity+' → '+city));
        if(discovery.ipv6)card.push(line('附加 IPv6',discovery.ipv6));
        if(pure && pureVerifiedV6)card.push(line('IPPure IPv6','已通过其他出口探针核对：'+pure.ip));
        else if(pure && !pureSameIP)card.push(line('IPPure','返回 '+pure.ip+'，与已核实的节点出口不符，未采用评分'));
        else if(!pure)card.push(line('IPPure','未取得有效数据'));
        if(pureUsable && pure.ipSource)card.push(line('IPPure IP 来源',pure.ipSource));
        if(pureUsable && pure.ipProperties)card.push(line('IPPure IP 属性',typeof pure.ipProperties==='string'?pure.ipProperties:JSON.stringify(pure.ipProperties)));
        if(net.range)card.push(line('网络段',net.range));
        if(loc.region_name)card.push(line('数据库行政区',loc.region_name));
        if(loc.latitude!=null && loc.longitude!=null)card.push(line('GeoIP 坐标',loc.latitude+', '+loc.longitude));
        if(validP && det.confidence!=null)card.push(line('检测置信度',det.confidence+' / 100'));
        if(pureUsable && typeof pure.isBroadcast==='boolean')card.push(line('IPPure 广播标记',pure.isBroadcast?'是':'否'));
        card.push(line('Ping0 共享人数','无可用公开 API，未接入'));
        if(discovery.warning)card.push(line('IP 探针',discovery.warning));
        var errors=discovery.failed.slice();
        ['proxycheck','ipapi','ipwho','ippure','scamalytics','ipqs'].forEach(function(n){
          if(outcomes[n] && !outcomes[n].ok)errors.push(n+': '+outcomes[n].error);
        });
        if(errors.length){
          card.push('<div style="font-size:15px;font-weight:700;color:#a34a3c;margin-top:8px;">接口错误</div>');
          errors.forEach(function(e){card.push('<div style="font-size:13px;color:#626a78;margin:4px 0;">'+htmlEsc(e)+'</div>');});
        }
      }
      card.push('</div>');
      finishHtml(card.join(''));
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

/**
 * 节点 IP 风险检测（Kiki版）v1.0.0
 * Loon Generic script; runs ONLY when launched from a node/strategy menu.
 * Uses independent official APIs. Scores from different companies are NOT equivalent.
 * Maintainer: https://github.com/kiki0-zz/QX_rules
 */
'use strict';

(function () {
  var params = (typeof $environment !== 'undefined' && $environment && $environment.params) || {};
  var node = typeof params.node === 'string' ? params.node.trim() : '';
  var conf = (typeof $argument !== 'undefined' && $argument && typeof $argument === 'object') ? $argument : {};
  var done = false;

  function finish(title, content) {
    if (done) return;
    done = true;
    $done({ title: title, content: content });
  }
  function request(method, url, timeout, headers, body) {
    return new Promise(function (resolve, reject) {
      var options = { url: url, node: node, timeout: timeout, insecure: false,
        headers: headers || { Accept: 'application/json' } };
      if (body !== undefined) options.body = body;
      try {
        $httpClient[method](options, function (error, response, text) {
          if (error) return reject(new Error(String(error).slice(0, 140)));
          var status = Number(response && response.status);
          if (status < 200 || status >= 300) return reject(new Error('HTTP ' + (status || '?')));
          resolve(text);
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
  function exitIP() {
    var endpoints = [
      'https://api.ipify.org?format=json',
      'https://api4.ipify.org?format=json'
    ];
    function next(i) {
      if (i === endpoints.length) return Promise.reject(new Error('两个出口 IP 接口均无法通过指定节点访问'));
      return getJSON(endpoints[i], 9000).then(function (r) {
        var ip = r && r.ip;
        if (!validIP(ip)) throw new Error('出口 IP 格式异常');
        return ip;
      }).catch(function () { return next(i + 1); });
    }
    return next(0);
  }
  function examine(ip) {
    var jobs = [];
    var outcomes = {};
    function push(key, promise) {
      jobs.push(promise.then(function (v) { outcomes[key] = { ok: true, data: v }; })
        .catch(function (e) { outcomes[key] = { ok: false, error: errorText(e) }; }));
    }

    // Official v3 endpoint (2026). Risk field: detections.risk; keyless 100 queries/day/exit IP.
    push('proxycheck', getJSON('https://proxycheck.io/v3/' + encodeURIComponent(ip), 11000));

    // Anonymous ipapi.is: location/ownership only; API key unlocks detection flags.
    var ipapiKey = getConfig('ipapi_key');
    var ipapiURL = 'https://api.ipapi.is/?q=' + encodeURIComponent(ip);
    if (ipapiKey) {
      push('ipapi', request('post', 'https://api.ipapi.is/', 11000,
        { 'Content-Type': 'application/json', Accept: 'application/json' },
        JSON.stringify({ q: ip, key: ipapiKey })).then(JSON.parse));
    } else {
      push('ipapi', getJSON(ipapiURL, 11000));
    }

    // Optional official Scamalytics API (region must match signup region).
    var scamUser = getConfig('scamalytics_user');
    var scamKey = getConfig('scamalytics_key');
    var scamRegion = getConfig('scamalytics_region').toUpperCase() === 'US' ? 'api11' : 'api12';
    if (scamUser && scamKey) {
      push('scamalytics', getJSON('https://' + scamRegion + '.scamalytics.com/v3/' + encodeURIComponent(scamUser) +
        '?key=' + encodeURIComponent(scamKey) + '&ip=' + encodeURIComponent(ip), 11000));
    }

    // Optional official IPQS API, with key in HTTPS header rather than URL.
    var ipqsKey = getConfig('ipqs_key');
    if (ipqsKey) {
      push('ipqs', getJSON('https://ipqualityscore.com/api/json/ip?ip=' + encodeURIComponent(ip) +
        '&strictness=0&allow_public_access_points=true&lighter_penalties=true&mobile=true',
        11000, { 'IPQS-KEY': ipqsKey, Accept: 'application/json' }));
    }

    Promise.all(jobs).then(function () {
      var l = [];
      l.push('检测节点：' + node);
      l.push('出口 IP：' + ip);
      l.push('');
      l.push('【风险评分｜0 低风险 → 100 高风险】');
      var p = outcomes.proxycheck;
      if (!p.ok) l.push('proxycheck.io：失败（' + p.error + '）');
      else {
        var data = p.data || {};
        var detail = data[ip] || {};
        if (data.status !== 'ok' && data.status !== 'warning') {
          l.push('proxycheck.io：' + txt(data.message, txt(data.status, '接口失败')));
        } else if (!data[ip] || !detail.detections) {
          l.push('proxycheck.io：接口未返回此 IP 的风险字段');
        } else {
          var risk = score(detail.detections.risk);
          l.push('proxycheck.io：' + (risk === null ? '未提供' : risk + '/100') +
            (risk === null ? '' : '（' + (risk <= 33 ? '较低' : (risk <= 66 ? '偏高' : '高')) + '）'));
          l.push('识别：代理 ' + flag(detail.detections.proxy) +
            ' / VPN ' + flag(detail.detections.vpn) +
            ' / 机房 ' + flag(detail.detections.hosting) +
            ' / TOR ' + flag(detail.detections.tor));
        }
      }
      if (!scamUser || !scamKey) {
        l.push('Scamalytics：未配置 API（不冒充它的评分）');
      } else if (!outcomes.scamalytics.ok) {
        l.push('Scamalytics：失败（' + outcomes.scamalytics.error + '）');
      } else {
        var s = outcomes.scamalytics.data && outcomes.scamalytics.data.scamalytics || {};
        if (s.status === 'error') l.push('Scamalytics：' + txt(s.error, 'API 返回错误'));
        else {
          var ss = score(s.scamalytics_score);
          l.push('Scamalytics：' + (ss === null ? '未提供' : ss + '/100') + ' / ' + txt(s.scamalytics_risk));
        }
      }
      if (!ipqsKey) {
        l.push('IPQualityScore：未配置 API（不冒充它的评分）');
      } else if (!outcomes.ipqs.ok) {
        l.push('IPQualityScore：失败（' + outcomes.ipqs.error + '）');
      } else {
        var q = outcomes.ipqs.data || {};
        if (q.success === false) l.push('IPQualityScore：' + txt(q.message, 'API 返回错误'));
        else {
          var qs = score(q.fraud_score);
          l.push('IPQualityScore：' + (qs === null ? '未提供' : qs + '/100'));
          l.push('IPQS 识别：代理 ' + flag(q.proxy) + ' / VPN ' + flag(q.vpn) + ' / TOR ' + flag(q.tor));
        }
      }

      l.push('');
      l.push('【IP 类型 / 归属地】');
      if (p.ok && p.data && p.data[ip]) {
        var n = p.data[ip].network || {};
        var loc = p.data[ip].location || {};
        l.push('proxycheck：' + txt(n.type) + '｜' + txt(loc.country_name) + ' · ' + txt(loc.city_name));
        l.push('ASN：' + txt(n.asn) + '｜' + txt(n.provider));
      }
      var geo = outcomes.ipapi;
      if (!geo.ok) l.push('ipapi.is：查询失败（' + geo.error + '）');
      else {
        var g = geo.data || {};
        if (g.error || g.message && !g.ip) l.push('ipapi.is：' + txt(g.message, txt(g.error)));
        else {
          var country = g.country || g.location && g.location.country || g.location && g.location.country_name;
          var asn = typeof g.asn === 'string' ? g.asn : g.asn && (g.asn.asn || g.asn.number || g.asn.org);
          var company = typeof g.company === 'string' ? g.company : g.company && (g.company.name || g.company.org);
          l.push('ipapi.is：' + txt(country) + '｜' + txt(asn) + '｜' + txt(company));
          if (ipapiKey) {
            l.push('ipapi 类型：机房 ' + flag(g.is_datacenter) + ' / VPN ' + flag(g.is_vpn) +
              ' / 代理 ' + flag(g.is_proxy) + ' / 滥用 ' + flag(g.is_abuser));
          } else {
            l.push('ipapi.is：匿名额度仅返回基础信息，不含风险标签');
          }
        }
      }
      l.push('');
      l.push('提示：不同公司的评分标准不同，不能取平均值。');
      l.push('当前 IP 为目标节点实际出口，不是节点服务器地址。');
      l.push('如有异常，请核对脚本是否从“长按节点”触发。');
      finish('Kiki版 · 节点 IP 风险', l.join('\n'));
    }).catch(function (e) {
      finish('Kiki版 · 检测失败', '出口 IP：' + ip + '\n查询异常：' + errorText(e));
    });
  }
  if (!node) {
    finish('Kiki版 · 节点 IP 风险', '请进入 Loon 的节点列表，长按某个具体节点并运行“节点 IP 风险检测”。\n不要从普通定时脚本入口运行。');
    return;
  }
  exitIP().then(examine).catch(function (e) {
    finish('Kiki版 · 检测失败', '节点：' + node + '\n无法获得该节点的真实出口 IP：' + errorText(e) + '\n请确认节点本身可以访问 HTTPS。');
  });
})();

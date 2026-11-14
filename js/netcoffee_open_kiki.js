/**
 * Net.Coffee 网页快捷入口（Kiki版）v0.5
 * Invoked by Loon's Generic Script action with a String argument.
 * Native HTML result links are not clickable in Loon's popup.
 * Instead, use the documented notification "openUrl" action.
 */
'use strict';
(function(){
  var env=typeof $environment!=='undefined' && $environment || {};
  var params=env.params||{};
  var node=typeof params.node==='string'?params.node.trim():'';
  if(!node && params.nodeInfo)node=String(params.nodeInfo.name||params.nodeInfo.tag||'').trim();
  var mode=typeof $argument==='string'?$argument.trim():'ip';
  if(['ip','claude','gpt'].indexOf(mode)<0)mode='ip';
  var names={ip:'IP 详情',claude:'Claude 检测',gpt:'GPT 检测'};
  var urls={ip:'https://ip.net.coffee/ip/',claude:'https://ip.net.coffee/claude/',gpt:'https://ip.net.coffee/gpt/'};
  var done=false;
  function html(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function ipv4(s){
    var a=String(s||'').trim().split('.');
    return a.length===4 && a.every(function(n){return /^\d{1,3}$/.test(n)&&+n<=255;});
  }
  function open(ip){
    if(done)return;done=true;
    var name=names[mode],url=urls[mode];
    if(mode==='ip' && ipv4(ip))url+=encodeURIComponent(ip);
    var advice=mode==='ip'
      ? (ipv4(ip)?'所选节点 IP：'+ip:'未获取节点 IP，进入原站手动查询')
      : '原站检测的是浏览器当前出口，不会自动切换到长按的节点';
    var hasNotification=false;
    try{
      if(typeof $notification!=='undefined' && $notification&&$notification.post){
        $notification.post('Net.Coffee · '+name,node||'Kiki版','点击这条通知打开网页。'+advice,{openUrl:url});
        hasNotification=true;
      }
    }catch(e){}
    var content='<div style="font-family:-apple-system,Arial,sans-serif;font-size:16px;padding:10px;line-height:1.6;color:#253449;">'+
      '<div style="font-size:20px;font-weight:700;">Net.Coffee · '+html(name)+'</div>'+
      '<div style="font-size:14px;color:#657080;">'+html(node)+'</div>'+
      '<div style="margin:13px 0;font-weight:600;">'+html(advice)+'</div>'+
      '<div style="font-size:14px;color:#556070;">'+(hasNotification?'请点击 Loon 的系统通知打开网页；弹窗中的蓝色链接无法使用。':
       '无法发送系统通知：请检查 Loon 通知权限，或手动打开 '+html(url))+'</div></div>';
    $done({title:'Net.Coffee · Kiki版',htmlMessage:content,icon:'safari'});
  }
  if(mode!=='ip'){open('');return;}
  if(!node){open('');return;}
  var attempts=[
    {url:'https://v4.ident.me/',parse:function(s){return String(s||'').trim();}},
    {url:'https://api4.ipify.org?format=json',parse:function(s){return JSON.parse(s).ip;}}
  ];
  function probe(i){
    if(i>=attempts.length){open('');return;}
    var p=attempts[i];
    try{
      $httpClient.get({url:p.url,node:node,timeout:8},function(err,response,body){
        var status=Number(response&&(response.status||response.statusCode)||0),value='';
        if(!err&&status>=200&&status<300){try{value=p.parse(body);}catch(e){}}
        if(ipv4(value))open(value);else probe(i+1);
      });
    }catch(e){probe(i+1);}
  }
  probe(0);
})();

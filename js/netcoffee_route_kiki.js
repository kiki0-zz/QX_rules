/**
 * Net.Coffee policy-aware web launcher (Kiki版) v0.6
 * Explicit opt-in operation to select a node in a known select group,
 * then issue a tappable notification to open the website.
 * DOES CHANGE the selected group and leaves it changed until restored.
 * No claim of being able to pin Safari traffic without a policy change.
 */
'use strict';
(function () {
  var args = typeof $argument==='string' ? $argument.trim() : '';
  var mode = args === 'restore' ? 'restore' : args === 'claude' ? 'claude' : args === 'gpt' ? 'gpt' : '';
  var GROUP='主代理';
  var KEY='kiki_netcoffee_route_backup_v06';
  var env=(typeof $environment!=='undefined' && $environment)||{};
  var params=env.params||{};
  var node=typeof params.node==='string'?params.node.trim():'';
  if (!node && params.nodeInfo) node=String(params.nodeInfo.name||params.nodeInfo.tag||params.nodeInfo.node||'').trim();
  var titles={claude:'Claude',gpt:'GPT'};
  var urls={claude:'https://ip.net.coffee/claude/',gpt:'https://ip.net.coffee/gpt/'};
  var finished=false;

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function finish(heading,detail,url) {
    if(finished)return;finished=true;
    var sent=false;
    if(url)try{
      if(typeof $notification!=='undefined' && $notification && typeof $notification.post==='function'){
        $notification.post('Net.Coffee · '+heading,node||GROUP,'点击通知进入原站。'+detail,{openUrl:url});
        sent=true;
      }
    }catch(_){}
    var html='<div style="font-family:-apple-system,Arial,sans-serif;font-size:16px;line-height:1.6;padding:9px;color:#27354a;">'+
      '<div style="font-size:20px;font-weight:700;margin:0 0 8px;">Net.Coffee · '+esc(heading)+'</div>'+
      '<div style="font-size:15px;margin:7px 0;">'+esc(detail)+'</div>'+
      (url?'<div style="font-size:13px;color:#697386;">'+
        (sent?'点击 Loon 系统通知打开网页。':'未能发送跳转通知，请检查 Loon 的通知权限。')+
        '</div>':'')+'</div>';
    $done({title:'Net.Coffee · Kiki版',htmlMessage:html,icon:'safari'});
  }
  function selected(){
    try{
      if(typeof $config==='undefined' || !$config || typeof $config.getSelectedPolicy!=='function')return '';
      return String($config.getSelectedPolicy(GROUP)||'').trim();
    }catch(e){return '';}
  }
  function setSelection(value){
    try{
      if(typeof $config==='undefined' || !$config || typeof $config.setSelectPolicy!=='function')return false;
      return $config.setSelectPolicy(GROUP,value)===true;
    }catch(e){return false;}
  }
  function readBackup(){
    try{
      if(typeof $persistentStore==='undefined'||!$persistentStore||typeof $persistentStore.read!=='function')return null;
      var raw=$persistentStore.read(KEY);
      var obj=raw?JSON.parse(raw):null;
      return obj&&obj.group===GROUP&&typeof obj.original==='string'&&obj.original&&
        typeof obj.changedTo==='string'&&obj.changedTo?obj:null;
    }catch(e){return null;}
  }
  function storeBackup(obj){
    try{
      if(typeof $persistentStore==='undefined'||!$persistentStore||typeof $persistentStore.write!=='function')return false;
      return $persistentStore.write(JSON.stringify(obj),KEY)===true;
    }catch(e){return false;}
  }

  if(mode==='restore'){
    var saved=readBackup(),current=selected();
    if(!saved){finish('恢复主代理','没有可恢复的记录；未更改当前策略。');return;}
    if(current!==saved.changedTo){
      finish('恢复主代理','当前主代理已不是脚本切换的 '+saved.changedTo+'；为避免覆盖你后续的手动选择，未自动恢复。');return;
    }
    if(!setSelection(saved.original) || selected()!==saved.original){
      finish('恢复主代理','尝试恢复 '+saved.original+' 失败，请手动检查「'+GROUP+'」策略组。');return;
    }
    storeBackup({group:GROUP,original:saved.original,changedTo:saved.original});
    finish('已恢复主代理','「'+GROUP+'」已恢复为 '+saved.original+'。');
    return;
  }
  if(!mode){finish('参数错误','未识别的操作类型。');return;}
  if(!node){finish('节点缺失','请在 Loon 节点列表长按具体节点运行。');return;}
  var before=selected();
  if(!before){finish('无法切换','找不到名为「'+GROUP+'」的 select 策略组；没有更改任何配置。');return;}
  var previous=readBackup();
  var original=previous&&before===previous.changedTo?previous.original:before;
  if(before!==node){
    if(!setSelection(node) || selected()!==node){
      finish('切换失败','节点「'+node+'」无法在「'+GROUP+'」中选中。可能不在该策略组的可选成员里；原选择为 '+before+'。');return;
    }
  }
  if(!storeBackup({group:GROUP,original:original,changedTo:node})){
    if(before!==node)setSelection(before);
    finish('保护性取消','无法保存原策略组选择，已尝试回退；请核对「'+GROUP+'」。');return;
  }
  finish(titles[mode]+' 网页入口','已将「'+GROUP+'」从 '+before+' 切换为 '+node+
    '。打开网页时仍受其它专门分流规则影响，请核对网页出口。测试结束后长按节点选择「恢复主代理」。',
    urls[mode]);
})();

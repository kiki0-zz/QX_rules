import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// browser.js holds readable behavior; css is the canonical stylesheet. Both
// shipping scripts embed the same CSS. No runtime fetch or remote dependency.
const dir=process.argv[2]?path.resolve(process.argv[2]):fileURLToPath(new URL('../../loon/master/',import.meta.url));
const version='0.2.4';
const css=fs.readFileSync(path.join(dir,'ptzone-mobile.css'),'utf8');
let browser=fs.readFileSync(path.join(dir,'ptzone-mobile.browser.js'),'utf8');
const start=browser.indexOf('\nfunction boot(){startMobile('),end=browser.indexOf('\nif(document.readyState',start);
if(start<0||end<0)throw new Error('Browser build marker missing');
browser=browser.slice(0,start)+'\nfunction boot(){startMobile('+JSON.stringify(css)+','+JSON.stringify(version)+');}'+browser.slice(end);
let response=fs.readFileSync(path.join(dir,'ptzone-mobile.js'),'utf8');
const payloadStart=response.indexOf('        var payload='),payloadEnd=response.indexOf('\n        result=',payloadStart);
if(payloadStart<0||payloadEnd<0)throw new Error('Response build marker missing');
const payload='<script id="pzm-bootstrap">'+browser.replace(/<\/script/gi,'<\\/script')+'</script>';
response=response.slice(0,payloadStart)+'        var payload='+JSON.stringify(payload)+';'+response.slice(payloadEnd);
let plugin=fs.readFileSync(path.join(dir,'PTZone-Mobile.plugin'),'utf8');
plugin=plugin.replace(/^#!desc =.*$/m,'#!desc = v'+version+'；分页中断、评分和统计缺失时自动重取，支持完整月份日历').replace(/^#!date =.*$/m,'#!date = 2026-11-28').replace(/ptzone-mobile\.js\?v=[\d.]+/g,'ptzone-mobile.js?v='+version);
fs.writeFileSync(path.join(dir,'ptzone-mobile.browser.js'),browser);
fs.writeFileSync(path.join(dir,'ptzone-mobile.js'),response);
fs.writeFileSync(path.join(dir,'PTZone-Mobile.plugin'),plugin);
console.log('Built PTZone Mobile '+version);

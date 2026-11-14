# QX_rules

Quantumult X 与 Loon 的分流规则、去广告插件和重写脚本集合。

仓库内容按个人日常使用维护，覆盖 ChatGPT、Claude、Google、Telegram、YouTube、TikTok、Spotify、起点读书以及部分常用 App 的规则和插件。

> 规则和脚本会受到目标服务、客户端版本和网络环境变化影响。使用前请阅读对应文件内容，并遵守当地法律、目标服务条款和版权要求。

## 项目结构

```text
QX_rules/
├── Qx/master/       # Quantumult X 分流规则（.list）
├── loon/master/     # Loon 分流规则（.list）与插件（.plugin）
├── js/              # 响应体脚本（.js）
└── README.md
```

## Quantumult X 规则

目录：[Qx/master](Qx/master/)

| 文件 | 内容 |
| --- | --- |
| [Chatgpt.list](Qx/master/Chatgpt.list) | ChatGPT / OpenAI 相关域名、IP 和客户端请求 |
| [Claude.list](Qx/master/Claude.list) | Claude、Anthropic、Claude Code 相关域名 |
| [Google.list](Qx/master/Google.list) | Google 服务、静态资源、安全服务和相关网段 |
| [Speedtest.list](Qx/master/Speedtest.list) | Ookla Speedtest User-Agent 和关键词 |
| [Streaming.list](Qx/master/Streaming.list) | Twitch、Deezer、JOOX、Spotify、Netflix、TikTok、Pornhub 等流媒体 |
| [Telegram.list](Qx/master/Telegram.list) | Telegram 域名、IPv4 和 IPv6 网段 |
| [Youtube.list](Qx/master/Youtube.list) | YouTube、视频 CDN 和图片资源 |
| [qidian.list](Qx/master/qidian.list) | 起点读书及阅文相关域名、广告上报域名 |

示例远程规则地址：

```text
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/Qx/master/Chatgpt.list
```

将远程地址添加到 Quantumult X 的规则/分流资源中，再按本地策略组设置对应的代理策略。规则文件中的策略名称以文件内容为准；导入前建议先打开文件检查是否需要调整策略名。

## Loon 规则

目录：[loon/master](loon/master/)

### 分流规则（`.list`）

| 文件 | 内容 |
| --- | --- |
| [Chatgpt.list](loon/master/Chatgpt.list) | ChatGPT / OpenAI 相关域名和网段 |
| [Claude.list](loon/master/Claude.list) | Claude、Anthropic、Claude Code 相关域名 |
| [Google.list](loon/master/Google.list) | Google 服务和相关资源 |
| [Luokewangguo.list](loon/master/Luokewangguo.list) | 《洛克王国：世界》及腾讯服务、HTTPDNS |
| [Pornhub.list](loon/master/Pornhub.list) | Pornhub、CDN 和页面依赖域名 |
| [Qidian.list](loon/master/Qidian.list) | 起点读书放行规则和广告上报处理 |
| [Speedtest.list](loon/master/Speedtest.list) | Ookla Speedtest |
| [Telegram.list](loon/master/Telegram.list) | Telegram 域名、IPv4 和 IPv6 网段 |
| [Tiktok.list](loon/master/Tiktok.list) | TikTok、视频 CDN 和 ByteDance 海外域名 |
| [YouTube.list](loon/master/YouTube.list) | YouTube、视频 CDN 和图片资源 |

### 插件（`.plugin`）

| 文件 | 内容 | 额外要求 |
| --- | --- | --- |
| [AD_Hema.plugin](loon/master/AD_Hema.plugin) | 盒马广告和追踪拦截 | 仅规则段 |
| [AD_didi.plugin](loon/master/AD_didi.plugin) | 滴滴广告、HTTPDNS 和页面配置处理 | 需要 MitM |
| [AD_umetrip.plugin](loon/master/AD_umetrip.plugin) | 航旅纵横开屏广告处理 | 需要 MitM |
| [ADshayujizhang.plugin](loon/master/ADshayujizhang.plugin) | 鲨鱼记账开屏配置和广告处理 | 需要 MitM |
| [spotify.plugin](loon/master/spotify.plugin) | Spotify 播放兼容和广告请求处理 | 需要 MitM，注意与其他 Spotify 插件冲突 |
| [hongguo_ad_block.plugin](loon/master/hongguo_ad_block.plugin) | 红果短剧开屏 / 常见插播广告域名与素材拦截（[Raw 订阅](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/hongguo_ad_block.plugin)） | 免 MitM、无远程脚本；可能影响同广告 SDK 的其他 App，非保证全去除 |
| [IPRisk_Kiki.plugin](loon/master/IPRisk_Kiki.plugin) | 节点 IP 风险检测（Kiki版）：[Raw 订阅](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/IPRisk_Kiki.plugin)、[JS 源码](js/ip_risk_kiki.js) | v0.6 IP 风险/归属地/Net.Coffee 信任分 + 显式切换主代理打开 Claude/GPT + 一键恢复（选用时生效） |

示例远程插件地址：

```text
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/spotify.plugin
```

将 `.list` 添加为 Loon 规则资源，将 `.plugin` 添加为 Loon 插件。

### 节点 IP 风险检测（Kiki版）v0.6

- 主插件：[IPRisk_Kiki.plugin](loon/master/IPRisk_Kiki.plugin)（[Raw](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/IPRisk_Kiki.plugin)）。长按 Loon 节点执行「节点 IP 风险检测」，通过 `$httpClient` 的 `node` 参数把 IP 探针、Net.Coffee 尝试查询、其他风控查询绑定到长按选中的节点；**此普通检测绝不改变 Loon 的主代理策略**。脚本：[ip_risk_kiki.js](js/ip_risk_kiki.js)。
- 原 IP 详情、ASN、运营商、出口地区、机房/代理/VPN/Tor 标记、Net.Coffee（或明确标注 PureIP 转发来源）信任评分、proxycheck.io 辅助风险分和设备估算均保留。不恢复自算的 TikTok / Google / AI 星级。
- **重要的路由区别**：Loon Generic 脚本可以用 `$httpClient.get({url, node:'所选节点'})` 按节点发起单次请求；网页从 Safari 打开后会重新匹配 Loon 分流规则。仅打开 Claude/GPT 网站 **不会** 自动继承脚本选中的节点。
- **v0.6 显式路由操作（可选）**：同一插件的菜单中增加「Net.Coffee · 切换主代理→Claude」「Net.Coffee · 切换主代理→GPT」，脚本使用 Loon 官方 `$config.setSelectPolicy('主代理', 所选节点)` 尝试切换名为 **主代理** 的 select 策略组，然后通过通知提供原站网址。**只在你主动选这些菜单项时切换策略**；切换会持续生效，会影响其他使用该策略组的流量，不会因关闭网页自动恢复。
- **恢复操作**：「Net.Coffee · 恢复原主代理」尝试恢复打开网页前保存的选项。若主代理已被手工改成另一个值则拒绝覆盖，避免误操作。还原方法不需要修改主配置文件。实现见 [netcoffee_route_kiki.js](js/netcoffee_route_kiki.js)。
- 如果「主代理」不在配置里、所选节点不属于该策略组，切换会失败且不会打开检测网页。另外，如果 Net.Coffee 相关域名被其他更优先的 Loon 规则分流到独立策略组，即便成功切换「主代理」，网站仍可能经由其他策略；**一定要核对网页显示的真实出口 IP**。当前操作不是临时独立浏览器代理、不保障每条线路均可绑定。
- 「Net.Coffee · IP 详情」保留节点出口 IPv4 检测和快捷打开原站功能，但其专门 IP 详情 URL 的兼容性仍需在实际手机 Loon 环境确认；Claude/GPT 页面涉及 DNS、时区和设备指纹，无法只靠指定 IP 的网络查询模拟。
- API 查询依次尝试 Net.Coffee 深度查询、旧查询及 PureIP 同源分数转发；无法获取时显示「暂无评分」和诊断，不会把 proxycheck 的基础 0/33 当作 Net.Coffee 信任分。公共第三方接口未获稳定性保证。
- 其它说明：ipapi.is / ipwho.is 辅助归属地；IPPure 区分 IPv4 和 IPv6 出口，设备数估算不等于 Ping0 独立共享人数；可选 Scamalytics / IPQS Key 只填写在手机本地参数里。
- 参考：[Loon Script API / setSelectPolicy / $httpClient.node](https://nsloon.app/docs/Script/script_api/)、[Loon 策略组](https://nsloon.app/docs/Policy/policygroup/)、[Net.Coffee 原站](https://ip.net.coffee/claude/)。
- 旧的独立 [NetCoffee_Kiki.plugin](loon/master/NetCoffee_Kiki.plugin) 为早期版本快捷入口，可停用，无须与本插件一起安装。

**红果短剧维护说明：** 本插件基于 [Thelongdarkorg 的分档规则](https://github.com/Thelongdarkorg/loon-plugins/blob/main/hongguo_ad_block.plugin) 与 [HongGuo Lite](https://github.com/k6nfmm7dbr-commits/hongguo-lite) 整理，只启用较保守的广告专用域名匹配。若仍有开屏广告，先在 Loon 请求记录中核查是否命中 `REJECT`；不要盲目封锁 `zijieapi.com` / `snssdk.com` 主域。广告可能来自缓存、其他 SDK、HTTPDNS 或 IP 直连，不能保证完全移除。带有 `[Rewrite]`、`[Script]` 或 `[MitM]` 段的插件，需要按 Loon 的证书和 MitM 配置完成授权；不需要的插件不要同时启用，避免规则和重写互相覆盖。

## JavaScript 脚本

当前脚本：[js/ netease_vip.js](js/%20netease_vip.js)

该脚本使用 `$response.body` 和 `$done` 处理响应体中的部分会员字段。它属于实验性响应体脚本，必须在支持相应脚本变量和重写能力的客户端中使用；启用前请确认脚本来源可信，并自行承担账号、数据和服务条款风险。

远程地址：

```text
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/js/%20netease_vip.js
```

## 使用建议

1. 只导入自己需要的规则或插件，不要一次性全部启用。
2. 先确认本地策略组名称、规则顺序和最终匹配策略。
3. 使用 `[MitM]`、`[Rewrite]` 或 `[Script]` 时，确认已安装并信任客户端证书。
4. 如果 App 无法登录、白屏或播放异常，先关闭相关插件，检查是否与其他规则集或重写脚本冲突。
5. 规则更新由客户端的远程资源机制决定；服务端接口变化后，旧规则可能需要重新维护。

## 免责声明

- 本仓库仅用于个人学习、测试和网络规则研究。
- 部分规则和脚本可能来自公开网络或在公开内容基础上整理，版权归原作者及相关权利人所有。
- 请勿将本仓库内容用于绕过付费、侵犯版权、破坏服务或其他违法用途。
- 如果内容侵犯你的合法权益，请提交 Issue 说明具体文件和原因，我会及时核查处理。
- 使用本仓库造成的任何账号、设备、数据或服务问题，由使用者自行负责。

## 反馈与贡献

欢迎提交 Issue 或 Pull Request。新增或修改规则时，建议在文件头部注明：

```text
NAME
AUTHOR
UPDATED
```

同时尽量说明目标服务、变更原因、客户端类型和是否需要 MitM，方便后续维护与排查。

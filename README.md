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
| [IPRisk_Kiki.plugin](loon/master/IPRisk_Kiki.plugin) | 节点 IP 风险检测（Kiki版）：[Raw 订阅](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/IPRisk_Kiki.plugin)、[JS 源码](js/ip_risk_kiki.js) | v0.3 轻量场景星级 / 风险分 / ASN / IP 属性 / 设备估算；无平台连通性检测；技术详情按需开启；免 MitM |

示例远程插件地址：

```text
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/spotify.plugin
```

将 `.list` 添加为 Loon 规则资源，将 `.plugin` 添加为 Loon 插件。

### Net.Coffee 快捷检测（Kiki版）

- 新增独立 [NetCoffee_Kiki.plugin](loon/master/NetCoffee_Kiki.plugin)（[Raw 订阅](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/NetCoffee_Kiki.plugin)）、[对应 JS 脚本](js/netcoffee_kiki.js)，v0.1。
- 在 Loon 节点列表长按具体节点，点击「Net.Coffee 快捷检测 · Kiki版」，插件会尝试通过该节点取得出口 IPv4，并显示原站三个入口：Claude 检测（https://ip.net.coffee/claude/）、GPT 检测（https://ip.net.coffee/gpt/）、IP 评分查询（https://ip.net.coffee/ip/）。
- **路由边界：** Loon 脚本内的请求绑定所选节点；随后点击网页时，Safari/浏览器遵循当前 Loon 分流策略，**不会自动切到所选节点**。必须对比脚本显示的出口 IP 与网站显示的 IP，不能直接认为网站结果对应长按节点。插件不修改主策略组、全局模式和规则。
- Loon Generic HTML 弹窗里的超链接因客户端版本可能不能跳转，另有官方文档支持的系统通知备用：点击「Net.Coffee · Claude 检测」通知打开官网。无需 API Key，不拉取或复制 Net.Coffee 的评分算法，不修改 DNS/MitM 配置。

### 节点 IP 风险检测（Kiki版）

- 当前版本 **v0.3**：在 Loon 中长按任意节点，选择「节点 IP 风险检测 · Kiki版」。[插件 Raw](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/IPRisk_Kiki.plugin)；[源码](js/ip_risk_kiki.js)。不会更改主配置、分流或 DNS，不依赖 MitM。
- 报告提供：目标节点实际出口 IP（IPv4/IPv6 不混淆）、英文城市级别地区、proxycheck.io 原始风险分、IP 类型、ASN、运营商、机房 / 代理 / VPN / Tor 识别、单 IP 和网段设备估算以及可用时的 IPPure 独立评分。
- **场景适配参考星级（非平台官方、非 Ping0 原始星级、非可用性实测）**。显示 TikTok、Google、AI 模型三行对齐的 1–5 星（不显示分数、评价文字或长说明，Google 涵盖常见 YouTube 使用，AI 模型为通用判断），用已有的 IP 风险字段在手机本地计算，**不向这些平台发起额外连通性请求**。
- **星级算法透明**：proxycheck.io 风险分 `0–25 → 5 星`、`26–50 → 4 星`、`51–75 → 2 星`、`76–100 → 1 星`；检测到 Hosting 时 TikTok 运营减 2 星、AI 减 1 星（Google 日常不额外减）；检测到 Proxy 或 VPN 再减 1 星，Tor 再减 2 星；缺少网络类型数据时最多 3 星；最终限定 1–5 星。风险分缺失则「未评估」，不伪造星级。**这些权重是 Kiki 版的经验性规则，不是平台或数据商的实测阈值。**
- 星级是“IP 层风险偏好”而不是“能否用 TikTok/Google/ChatGPT”，不能预测平台注册、账号封禁、账号环境、地区支持、设备信息、带宽/速度或推荐流量。特别是 Google 日常服务与谷歌账号注册风控不是一回事。不要把 IP 风险评分当作平台官方结果。
- 参考依据：[proxycheck.io 风险评分和访问建议](https://proxycheck.io/api/)（公开风险分、机房/代理等识别）；[EasyGlobe 场景星级参考](https://easyglobegrowth.com/zh/tools/ping0-ip-check)（独立本地规则）；[IPOK 的 IP 层场景提示](https://ipok.io/t/ping0-alternative)。本插件借鉴理念，不复制它们的专有评分。
- **共享情况不是 Ping0“共享人数”**：读取 proxycheck.io 的 `device_estimate.address` 和 `device_estimate.subnet`，这只是设备数量估算，不是独立用户或实时在线人数；0 不表示无人共用。Ping0 的自有共享用户区间没有确认的公开 API，不会编造。
- **IPPure**：接口检测实际请求出口，可能与主报告的 IPv4 分属不同协议族。只有与通过节点独立探测到的出口一致时才显示评分；IPPure 的「CF 系数」属于该网站自己的估算，不是 Cloudflare 官方风控分。
- 东京特别区的英文 GeoIP 地名按城市级别显示为 `Tokyo`（例如 `Shibuya City → Tokyo`），其它城市不一律剥除 `City` 后缀。需要查看原始行政区 / 接口错误时，打开本机插件参数「显示技术详情与接口错误」，默认关闭。
- Scamalytics / IPQualityScore API Key 可选，仅保存在本地插件参数；请勿提交到公开 GitHub，也不要转发包含私密密钥的 Loon 配置。

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

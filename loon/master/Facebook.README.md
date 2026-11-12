# Facebook 分流（Loon / iOS）

最后核对：2026-11-12 · 维护者：kiki

## 使用地址

- **专属规则**：[Facebook.list](./Facebook.list)
- **Raw**：https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Facebook.list
- **作用范围**：Facebook 主 App / Facebook Messenger，覆盖登录、Graph API、图片、Reels、视频、短链、站内聊天等常见服务。
- **不包含**：Instagram、WhatsApp、Threads、Oculus；这几个产品请使用各自的分流（如果需要）。

## 配置

在 Loon → 配置 → 规则 → 远程规则中，使用 Raw 链接添加 Facebook.list，选择**同一个稳定代理节点/策略组**；不要继续启用 Moli-X 或其他重复的 Facebook.list。远程规则应置于会匹配这些域名的泛用 `DIRECT`、`REJECT` 或全局 Meta 规则之前。

> 示例（策略名称 `PROXY` 需按你的 Loon 配置实际替换）：
>
> ```ini
> [Remote Rule]
> https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Facebook.list,PROXY
> ```

**策略写在 Loon 远程规则订阅项中，而不是 .list 文件里。**

## 为什么不继续使用莫离版本

- Moli-X 该文件标注更新日期 2025-06-06，规模约 579 条，包括其他 Meta 产品、许多历史服务与拼写相似的域名。
- 直接将不同服务（Facebook、Instagram、WhatsApp、Oculus）和同一 ASN 下的所有 IP 放入一个规则，可能与已有专用分流组产生重叠。本版只针对 Facebook + Messenger。
- 此次使用 `DOMAIN-SUFFIX` 覆盖当前主站/API/CDN；使用精确域名匹配 Akamai 老域名；**不含** `DOMAIN-KEYWORD,facebook`、`IP-ASN,32934` 或大段 `IP-CIDR`。
- 规则少本身不必然更快；本次优化的是**策略可控、分流边界清楚和排障便利**，不声称已找到你的加载失败根因。

## 图片/视频加载不出时

1. 用 Loon 最近请求/连接检查 `scontent.*.fbcdn.net`、`video.*.fbcdn.net`、`graph.facebook.com`、`edge-mqtt.facebook.com` 是否命中 Facebook 策略；只要有一个走 `DIRECT` / `REJECT`，就检查规则优先级与其他广告/重写插件。
2. 测试**固定节点**而非自动负载均衡，确保 API/CDN/视频是同一稳定出口；尝试换一个节点地区。节点出口不稳定、DNS、封锁或 TLS 握手失败都可能导致转圈。
3. 对照 Wi-Fi 与移动数据，并关闭 Facebook 相关 MITM/去广告脚本测试；分流只能决定路由，无法处理 App 或服务器故障。
4. 如果仅 Messenger 音视频通话失败，可记录目标 IP、UDP 和日志；这份**域名型规则不保证覆盖 IP 直连或实时媒体流量**。不要为此盲目把整个 Meta ASN 交给 Facebook 策略。

## 来源（2026-11-12 核对）

- [莫离 Moli-X Facebook.list](https://github.com/Moli-X/Tool/blob/X/Loon/Rules/Facebook.list)（文件标注 2025-06-06）
- [Repcz Facebook.list](https://github.com/Repcz/Tool/blob/X/Loon/Rules/Facebook.list)（2026-08）
- [v2fly / domain-list-community: facebook](https://github.com/v2fly/domain-list-community/blob/master/data/facebook)（2026-09）
- [MetaCubeX/meta-rules-dat: facebook](https://github.com/MetaCubeX/meta-rules-dat/blob/meta/geo/geosite/facebook.yaml)（2026-11-12）
- [poohyeban/loon-rules](https://github.com/poohyeban/loon-rules)（独立 Facebook / Instagram / WhatsApp 分类思路）

> 为便于自主维护，上述资源仅作规则覆盖参考，不自动跟随外部仓库更新。每次修改本仓库的 Facebook.list，Loon 刷新远程规则即可；Raw 链接不变。

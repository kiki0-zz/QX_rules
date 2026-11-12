# Instagram 分流 · Kiki Stable (Loon)

更新日期：2026-11-12  
维护者：kiki

## 使用链接

- **规则文件：** [Instagram.list](./Instagram.list)
- **Raw：** https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Instagram.list
- **Facebook 分流：** [Facebook.list](./Facebook.list)
- 这是一份 **域名分流**，不是去广告插件，也不修改 Instagram 的 HTTPS 请求。

## 规则范围

本文件覆盖 Instagram 主站 / API（`instagram.com`）、图片和 Reels CDN（`cdninstagram.com`、`igcdn.com`）、分享（`ig.me`、`instagr.am`）、以及共享 Meta 媒体 CDN（`fbcdn.net`、`fbsbx.com`、`tfbnw.net`）。

**与 Facebook.list 存在刻意保留的共享域名：** `fbcdn.net`、`fbcdn.com`、`fbsbx.com`、`fbsbx.net`、`fbcdn-a.akamaihd.net`、`tfbnw.net`。iOS 上仅靠域名不能准确区分这些请求由 Facebook 还是 Instagram 发起。即使把 Instagram.list 放在 Facebook.list 前面，也不能确保只有 Instagram 流量命中共享 CDN。

**建议 Instagram.list 和 Facebook.list 选同一个稳定代理节点/策略组**，并尽量避免让两者因自动测速切换出口。如果想用不同国家的节点，至少要接受共享 CDN 可能走其中一个策略的限制，或另行设计专门的 `MetaMedia` 公共规则组。

## 如何配置 Loon

在「配置 → 规则 → 远程规则」中添加此 Raw 地址，并给它选择一个稳定节点或策略组；禁用原来重复的 Instagram 规则列表。

下面示例将 Spotify 之外的 Meta 规则统一走相同策略。将 `Social` 替换为实际策略组名称：

```ini
[Remote Rule]
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Instagram.list, policy = Social, tag = Instagram, enabled = true
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Facebook.list, policy = Social, tag = Facebook, enabled = true
```

确保它们在过宽的 `DIRECT`、`REJECT`、全局媒体/IP 规则之前匹配。此文件只有匹配条件，**没有内置的 PROXY / 节点名**。

## 为什么不用老版本

莫离 Moli-X 的 Instagram.list 提供 `instagram.com`、`cdninstagram.com`、`instagr.am` 及关键词匹配；Repcz 的类似版本也是 4 条。新版补充 `igcdn.com`、`igsonar.com`、`ig.me` 和共享 Meta CDN。避免添加大量与实际 App 服务无关的 Instagram 拼写变体、营销域名和旧固定 IP。

规则多不等于性能好。此方案优化的是**域名覆盖、策略一致性和后续排查**，并不等于已经在你手机上实测解决 INS 的刷新慢问题。

## 发生刷新慢 / 图片或 Reels 加载失败时

1. 打开 Loon 的最近请求或连接记录，查看 `i.instagram.com`、`graph.instagram.com`、`scontent-*.cdninstagram.com`、`*.fbcdn.net`，是否由你预期的代理策略处理。如果出现 `DIRECT` 或 `REJECT`，检查规则排序、DNS、广告拦截和其他插件。
2. 同一条 Reels 用两条不同的**固定节点**对照测试，确认不是自动策略切换导致；最好与 Facebook 使用相同节点。
3. 对照 Wi-Fi / 蜂窝网络；如仅 CDN 资源失败，关注连接的 DNS 解析、超时、握手和目标域名。
4. 如果登录或私信失败，检查共享的 `facebook.com`、`facebook.net`、`meta.com` 是否由 Facebook.list 或你的 Meta 公共策略覆盖。
5. 如果仍失败，临时关闭 Instagram/Facebook 的去广告、重写或 MITM 插件对照；分流本身不能修复账号限制、App 缺陷、服务器故障或网络出口质量。
6. 若 App 直接使用 IP 而无可匹配域名，本清单不能保证覆盖，**不要直接全局代理整个 Meta ASN** 来掩盖缺口。

## 核对来源（2026-11-12）

- [莫离 Moli-X / Instagram.list](https://github.com/Moli-X/Tool/blob/X/Loon/Rules/Instagram.list)
- [Repcz / Instagram.list](https://github.com/Repcz/Tool/blob/X/Loon/Rules/Instagram.list)
- [v2fly / Instagram 域名数据](https://github.com/v2fly/domain-list-community/blob/master/data/instagram)
- [MetaCubeX / Instagram geosite](https://github.com/MetaCubeX/meta-rules-dat/blob/meta/geo/geosite/instagram.yaml)
- [poohyeban / Instagram.list](https://github.com/poohyeban/loon-rules/blob/main/rules/Instagram/Instagram.list)

此文件由你的仓库独立维护，不会自动同步上游。今后在同一路径提交更新，Raw 订阅地址仍保持不变。

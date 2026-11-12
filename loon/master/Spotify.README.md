# Spotify 分流与去广告（Loon / iOS）

更新：2026-11-12  
维护者：kiki

## 文件

- 分流规则：[Spotify.list](./Spotify.list) / [Raw](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Spotify.list)
- 去广告插件：[spotify.plugin](./spotify.plugin) / [Raw](https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/spotify.plugin)

两者分别负责 **流量选择** 和 **请求/响应改写**，不要混为一谈。

## 添加分流订阅

Loon → 配置 → 规则（远程规则）→ 添加 Spotify.list 的 Raw 地址；为订阅选择一个**固定、稳定的代理策略**。不要同时启用其他来源的 Spotify 分流订阅。检查其优先级是否高于通用直连、广告拦截规则。

若手动维护配置，可在 `[Remote Rule]` 中加一行（将策略名改为你的实际策略）：

```ini
[Remote Rule]
https://raw.githubusercontent.com/kiki0-zz/QX_rules/main/loon/master/Spotify.list,PROXY
```

本文件 **仅包含域名匹配规则**，策略在 Loon 订阅配置中指定，所以 Raw 文件无需写 `,PROXY`。

## 设计原则

1. `spotify.com`：主 API、登录、配置、播放等。
2. `scdn.co`、`pscdn.co`、`spotifycdn.com/.net`：音频、图片及视频相关 CDN；音频与主 API 尽量同策略。
3. `*-spotify-com.akamaized.net`、Fastly：覆盖更多历史/备用音频端点；以关键词 Spotify 兜底。
4. 不采用旧表中的固定 `IP-CIDR`，避免固定云服务 IP 变化或匹配其他业务；不采用 `PROCESS-NAME`（Loon iOS 不支持进程规则）与全局 `REJECT`。
5. 相比 Moli-X/blackmatrix7 2025-06 的规则，本版做了精简及风险规避；这是可维护性优化，不意味着已证实旧列表是卡歌的根因。

## 卡歌时的排查顺序

1. **分流验证**：在 Loon 最近请求/连接记录查看 `spclient.*.spotify.com`、`audio4-fa.scdn.co`、`audio4-ak-spotify-com.akamaized.net` 等是否命中同一个 Spotify 策略。如果命中其他 DIRECT/REJECT 规则，调整规则顺序。
2. **节点验证**：把 Spotify 策略固定到一个能稳定播放的节点；同一首歌分别用两条不同节点测试，避免自动策略组每次请求切换出口。
3. **插件隔离**：如仍无法播放，暂时禁用 **所有 Spotify 去广告插件**（包括本仓库 spotify.plugin），保持分流规则不变测试。若恢复，问题在插件/HTTPS 解密层而非分流表。
4. **CDN 与 DNS**：在连接记录中关注音频域名的连接失败、超时及 DNS 异常，必要时变更节点或 DNS。
5. **网络对照**：同节点在 Wi-Fi 和移动网络分别测试；不要在未经排查的情况下直接全局拦截 UDP/443。
6. **版本信息**：记录 Spotify App 版本、Loon 版本、代理节点地区、失败时间及相关请求域名，便于后续迭代。

> 注意：分流只能决定请求走哪条线路，无法修复 Spotify 服务器错误、App 端版本变化、去广告脚本异常或不稳定的出口。某些地区或账号本身会有内容限制。

## 参考来源

- Moli-X: https://github.com/Moli-X/Tool/blob/X/Loon/Rules/Spotify.list
- blackmatrix7: https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Loon/Spotify/Spotify.list
- Repcz: https://github.com/Repcz/Tool/blob/X/Loon/Rules/Spotify.list
- LM-Firefly: https://github.com/LM-Firefly/Rules/blob/master/Global-Services/Spotify.list
- Loon 规则订阅文档: https://nsloon.app/docs/Rule/sub_rule/
- Loon 进程规则（仅 macOS）: https://nsloon.app/docs/category/%E8%A7%84%E5%88%99/
- Spotify 音频 CDN 连接问题案例: https://community.spotify.com/forum/en/discussion/5243566/playback-stopping-when-streaming-from-akamaized

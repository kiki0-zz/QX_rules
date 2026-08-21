// Name: Netease Music VIP Clean (UI Level)
// Author: kiki
// Updated: 2026-08-21
// Description: 实验性响应体字段处理脚本。

let body = $response.body;

try {
  let obj = JSON.parse(body);

  if (obj.data) {
    obj.data.associator = {};
    obj.data.redVip = false;
    obj.data.musicPackage = {};
    obj.data.redplus = false;
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });

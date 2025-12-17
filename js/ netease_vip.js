// Netease Music VIP Clean (UI Level)
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
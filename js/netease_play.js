// Netease Music Play Clean
let body = $response.body;

try {
  let obj = JSON.parse(body);

  if (obj.data) {
    if (obj.data.needVip !== undefined) {
      obj.data.needVip = false;
    }
    if (obj.data.noCopyright !== undefined) {
      obj.data.noCopyright = false;
    }
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
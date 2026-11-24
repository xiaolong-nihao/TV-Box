var rule = {
    title: '芒果TV',
    host: 'https://www.mgtv.com',
    homeUrl: '',
    searchUrl: '',
    searchable: 0,
    multi: 1,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.mgtv.com/'
    },
    timeout: 8000,
    // channelId：3电影 2电视剧 1综艺 50动漫 10少儿 51纪录片
    class_name: '电影&电视剧&综艺&儿童&动漫&纪录片',
    class_url: '3&2&1&10&50&51',
    limit: 80,

    一级: `js:
let d = [];
let cid = MY_CATE;
let pg = MY_PAGE;
let url = 'https://pianku.api.mgtv.com/rider/list/pcweb/v3?platform=pcweb'
  + '&channelId=' + cid
  + '&pn=' + pg
  + '&pc=80'
  + '&hudong=1&_support=10000000&kind=a1&area=a1';
let r;
try { r = request(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.mgtv.com/' } }); }
catch (e) { r = ''; }
if (r) {
  try {
    let j = JSON.parse(r);
    let docs = (j && j.data && j.data.hitDocs) || [];
    for (let i = 0; i < docs.length; i++) {
      let x = docs[i];
      let id = x.clipId ? String(x.clipId) : '';
      let tt = x.title ? String(x.title) : '';
      if (!id || !tt) continue;

      let kind = '';
      if (x.kind && x.kind.length) kind = x.kind.join('/');
      let state = x.updateInfo ? String(x.updateInfo) : '';
      if (!state && x.rightCorner && x.rightCorner.text) state = String(x.rightCorner.text);

      d.push({
        vod_id: id,
        vod_name: tt,
        vod_pic: x.img ? String(x.img) : '',
        vod_remarks: state || kind,
        vod_year: x.year ? String(x.year) : '',
        vod_content: x.story ? String(x.story) : '',
        type_name: kind,
        vod_actor: x.subtitle ? String(x.subtitle) : ''
      });
    }
  } catch (e) {}
}
setResult(d);
`,

    二级: `js:
let cid = input.split('$').pop();
VOD = {
  vod_id: cid,
  vod_name: '',
  vod_pic: '',
  vod_remarks: '',
  vod_year: '',
  vod_area: '',
  vod_content: '',
  vod_play_from: 'mgtv',
  vod_play_url: ''
};
// 从列表缓存里找这一条的完整信息（芒果没有公开的详情接口）
let found = null;
try {
  for (let c = 1; c <= 6; c++) {
    let chMap = { 1: '3', 2: '2', 3: '1', 4: '50', 5: '10', 6: '51' };
    let ch = chMap[c];
    if (!ch) continue;
    for (let p = 1; p <= 2; p++) {
      let u = 'https://pianku.api.mgtv.com/rider/list/pcweb/v3?platform=pcweb'
        + '&channelId=' + ch + '&pn=' + p + '&pc=80'
        + '&hudong=1&_support=10000000&kind=a1&area=a1';
      let r = request(u, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.mgtv.com/' } });
      let j = JSON.parse(r);
      let docs = (j && j.data && j.data.hitDocs) || [];
      for (let k = 0; k < docs.length; k++) {
        if (String(docs[k].clipId) === cid) { found = docs[k]; break; }
      }
      if (found) break;
    }
    if (found) break;
  }
} catch (e) {}

let pid = '1';
if (found) {
  VOD.vod_name = found.title || '';
  VOD.vod_pic = found.img || '';
  VOD.vod_content = found.story || '';
  VOD.vod_year = found.year ? String(found.year) : '';
  VOD.vod_actor = found.subtitle || '';
  if (found.kind && found.kind.length) VOD.type_name = found.kind.join('/');
  VOD.vod_remarks = found.updateInfo || '';
  if (found.playPartId) pid = String(found.playPartId);
}
if (!VOD.vod_name) VOD.vod_name = '未知片名';
VOD.vod_play_url = '正片$https://www.mgtv.com/b/' + cid + '/' + pid + '.html';
`,

    搜索: ''
};

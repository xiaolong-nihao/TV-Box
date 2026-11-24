var rule = {
    title: '优酷',
    host: 'https://www.youku.com',
    homeUrl: '',
    searchUrl: 'https://search.youku.com/api/search?keyword=**&pg=fypage',
    searchable: 2,
    multi: 1,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.youku.com/'
    },
    timeout: 8000,
    class_name: '电影&电视剧&综艺&动漫&少儿&纪录片',
    class_url: '电影&电视剧&综艺&动漫&少儿&纪录片',
    limit: 30,

    // 一级：category/data，params 里带 type（中文）
    一级: `js:
let d = [];
let tp = MY_CATE;
let pg = MY_PAGE;
let params = encodeURIComponent(JSON.stringify({ type: tp }));
let url = 'https://www.youku.com/category/data?optionRefresh=1&pageNo=' + pg + '&params=' + params;
let r;
try { r = request(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.youku.com/' } }); }
catch (e) { r = ''; }
if (r) {
  try {
    let j = JSON.parse(r);
    let ld = (j && j.data && j.data.filterData && j.data.filterData.listData) || [];
    for (let i = 0; i < ld.length; i++) {
      let x = ld[i];
      let tt = x.title ? String(x.title).trim() : '';
      if (!tt) continue;

      let link = x.videoLink ? String(x.videoLink) : '';
      if (link.indexOf('//') === 0) link = 'https:' + link;

      // 从链接抠 id
      let id = '';
      let m = link.match(/id_([0-9a-zA-Z]+)\.html/);
      if (m) id = m[1];
      else {
        m = link.match(/[?&]s=([0-9a-zA-Z]+)/);
        if (m) id = m[1];
      }
      if (!id) id = tt;

      d.push({
        vod_id: id,
        vod_name: tt,
        vod_pic: x.img ? String(x.img) : '',
        vod_remarks: x.rightTagText ? String(x.rightTagText) : tp,
        vod_content: x.subTitle ? String(x.subTitle) : '',
        type_name: tp
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
  vod_play_from: 'youku',
  vod_play_url: ''
};
// 优酷没有公开详情接口，从各分类列表里反查这一条
let found = null;
try {
  let cats = ['电影', '电视剧', '综艺', '动漫', '少儿', '纪录片'];
  for (let c = 0; c < cats.length; c++) {
    for (let p = 1; p <= 2; p++) {
      let params = encodeURIComponent(JSON.stringify({ type: cats[c] }));
      let u = 'https://www.youku.com/category/data?optionRefresh=1&pageNo=' + p + '&params=' + params;
      let r = request(u, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.youku.com/' } });
      let j = JSON.parse(r);
      let ld = (j && j.data && j.data.filterData && j.data.filterData.listData) || [];
      for (let k = 0; k < ld.length; k++) {
        let link = ld[k].videoLink ? String(ld[k].videoLink) : '';
        let m = link.match(/id_([0-9a-zA-Z]+)\.html/);
        let id = m ? m[1] : '';
        if (id === cid) { found = ld[k]; found.__link = link; break; }
      }
      if (found) break;
    }
    if (found) break;
  }
} catch (e) {}

if (found) {
  VOD.vod_name = found.title || '';
  VOD.vod_pic = found.img || '';
  VOD.vod_content = found.subTitle || '';
  VOD.vod_remarks = found.rightTagText || '';
}
if (!VOD.vod_name) VOD.vod_name = '未知片名';

let link = (found && found.__link) ? found.__link
  : ('https://v.youku.com/v_nextstage/id_' + cid + '.html');
VOD.vod_play_url = '正片$' + link;
`,

    // 搜索：pageComponentList → componentMap → H5ShowCard
    搜索: `js:
let d = [];
let pg = MY_PAGE;
let url = 'https://search.youku.com/api/search?keyword=' + encodeURIComponent(KEY) + '&pg=' + pg;
let r;
try { r = request(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.youku.com/' } }); }
catch (e) { r = ''; }
if (r) {
  try {
    let j = JSON.parse(r);
    let comp = (j && j.pageComponentList) || [];
    for (let i = 0; i < comp.length; i++) {
      let m = comp[i];
      if (!m || !m.componentMap) continue;
      let keys = Object.keys(m.componentMap);
      for (let a = 0; a < keys.length; a++) {
        let c = m.componentMap[keys[a]];
        if (!c || c.componentId !== 'H5ShowCard') continue;
        let arr = c.data || [];
        for (let b = 0; b < arr.length; b++) {
          let x = arr[b];
          let id = x.showId ? String(x.showId) : '';
          let name = (x.titleDTO && x.titleDTO.displayName) ? String(x.titleDTO.displayName).trim() : '';
          if (!id || !name) continue;

          // feature: "2026 · 电影 · 中国"
          let feat = [];
          if (x.feature) {
            let segs = String(x.feature).split('·');
            for (let s = 0; s < segs.length; s++) {
              let t = segs[s].trim();
              if (t) feat.push(t);
            }
          }

          let pic = '';
          if (x.posterDTO && x.posterDTO.vThumbUrl) pic = String(x.posterDTO.vThumbUrl);
          else if (x.sourceImg) pic = String(x.sourceImg);

          d.push({
            vod_id: id,
            vod_name: name,
            vod_pic: pic,
            vod_remarks: (x.posterDTO && x.posterDTO.iconCorner && x.posterDTO.iconCorner.tagText)
              ? String(x.posterDTO.iconCorner.tagText) : (feat[1] || ''),
            vod_year: feat[0] || '',
            vod_area: feat[2] || '',
            type_name: feat[1] || ''
          });
        }
      }
    }
  } catch (e) {}
}
setResult(d);
`
};

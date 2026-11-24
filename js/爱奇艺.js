var rule = {
    title: '爱奇艺',
    host: 'https://www.iqiyi.com',
    homeUrl: '',
    searchUrl: 'https://search.video.iqiyi.com/o?if=html5&key=**&pageNum=fypage&pos=1&pageSize=24&site=iqiyi',
    searchable: 2,
    multi: 1,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.iqiyi.com/'
    },
    timeout: 8000,
    // channel_id：1电影 2电视剧 3纪录片 4动漫 6综艺 15少儿
    class_name: '电影&电视剧&综艺&儿童&动漫&短剧&纪录片',
    class_url: '1&2&6&15&4&35&3',
    limit: 24,

    // 一级：recommend/list，返回 data.list
    一级: `js:
let d = [];
let cid = MY_CATE;
let pg = MY_PAGE;
let url = 'https://pcw-api.iqiyi.com/search/recommend/list?channel_id=' + cid
  + '&data_type=1&page_id=' + pg + '&ret_num=24';
let r;
try { r = request(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.iqiyi.com/' } }); }
catch (e) { r = ''; }
if (r) {
  try {
    let j = JSON.parse(r);
    let ls = (j && j.data && j.data.list) || [];
    for (let i = 0; i < ls.length; i++) {
      let x = ls[i];
      let id = x.albumId || x.tvId || x.qipu_id || '';
      let tt = x.name || x.title || '';
      if (!id || !tt) continue;

      // 集数/更新状态
      let state = '';
      if (x.focus) state = String(x.focus);
      else if (x.latestOrder && x.latestOrder > 0) state = '更新至' + x.latestOrder + '集';
      else if (x.videoCount && x.videoCount > 1) state = '共' + x.videoCount + '集';

      // 年份
      let yr = '';
      if (x.period) yr = String(x.period).substr(0, 4);
      else if (x.releaseDate) yr = String(x.releaseDate).substr(0, 4);

      // 类型
      let genre = '';
      if (x.three_category_v2) genre = String(x.three_category_v2);
      else if (x.channel) genre = String(x.channel).split(',')[0];

      // 图片加尺寸后缀，列表更清晰
      let pic = x.imageUrl ? String(x.imageUrl) : '';
      if (pic && pic.indexOf('.jpg') > 0) pic = pic.replace('.jpg', '_390_520.jpg');

      d.push({
        vod_id: String(id),
        vod_name: String(tt),
        vod_pic: pic,
        vod_remarks: state || genre,
        vod_year: yr,
        type_name: genre
      });
    }
  } catch (e) {}
}
setResult(d);
`,

    // 二级：videoinfowithuser 拿详情 + avlistinfo 拿剧集
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
  vod_actor: '',
  type_name: '',
  vod_play_from: 'qiyi',
  vod_play_url: ''
};

// 1. 详情
let chId = 1;
try {
  let u = 'https://pcw-api.iqiyi.com/video/video/videoinfowithuser/' + cid + '?agent_type=1&subkey=' + cid + '&subscribe=1';
  let r = request(u, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.iqiyi.com/' } });
  let j = JSON.parse(r).data || {};
  VOD.vod_name = j.name || '';
  VOD.vod_pic = j.imageUrl || '';
  VOD.vod_content = j.description || '';
  chId = j.channelId || 1;
  if (j.categories && j.categories.length) {
    VOD.type_name = j.categories.map(function (it) { return it.name; }).join(',');
  }
  if (j.areas) VOD.vod_area = j.areas;
  if (j.period) VOD.vod_remarks = String(j.period);
  if (j.people && j.people.main_charactor) {
    VOD.vod_actor = j.people.main_charactor.map(function (it) { return it.name; }).join(',');
  }
} catch (e) {}

if (!VOD.vod_name) VOD.vod_name = '未知片名';

// 2. 剧集：电影/少儿是单集，其他走 avlistinfo
let plist = [];
try {
  if (chId === 1 || chId === 15) {
    // 电影只有一个正片
    plist.push({ t: '正片', u: 'https://www.iqiyi.com/v_' + cid + '.html' });
  } else {
    let page = 1;
    let total = 1;
    while (page <= 5) {
      let u = 'https://pcw-api.iqiyi.com/albums/album/avlistinfo?aid=' + cid
        + '&size=200&page=' + page;
      let r = request(u, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.iqiyi.com/' } });
      let data = JSON.parse(r).data || {};
      if (page === 1) total = data.total || 1;
      let eps = data.epsodelist || [];
      if (!eps.length) break;
      for (let i = 0; i < eps.length; i++) {
        let e = eps[i];
        plist.push({
          t: e.shortTitle || ('第' + e.order + '集'),
          u: e.playUrl || ''
        });
      }
      if (plist.length >= total) break;
      page++;
    }
  }
} catch (e) {}

if (!plist.length) {
  plist.push({ t: '正片', u: 'https://www.iqiyi.com/v_' + cid + '.html' });
}
VOD.vod_play_url = plist.map(function (x) { return x.t + '$' + x.u; }).join('#');
`,

    // 搜索：docinfos → albumDocInfo
    搜索: `js:
let d = [];
let pg = MY_PAGE;
let url = 'https://search.video.iqiyi.com/o?if=html5&key=' + encodeURIComponent(KEY)
  + '&pageNum=' + pg + '&pos=1&pageSize=24&site=iqiyi';
let r;
try { r = request(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://www.iqiyi.com/' } }); }
catch (e) { r = ''; }
if (r) {
  try {
    let j = JSON.parse(r);
    let ds = (j && j.data && j.data.docinfos) || [];
    for (let i = 0; i < ds.length; i++) {
      let a = ds[i].albumDocInfo || {};
      let id = a.albumId || '';
      let tt = a.albumTitle || '';
      if (!id || !tt) continue;
      let pic = a.albumVImage || a.albumImg || '';
      d.push({
        vod_id: String(id),
        vod_name: String(tt),
        vod_pic: pic,
        vod_remarks: a.tvFocus ? String(a.tvFocus) : (a.channel || ''),
        type_name: a.channel || ''
      });
    }
  } catch (e) {}
}
setResult(d);
`
};

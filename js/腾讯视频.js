var rule = {
    title: '腾讯视频',
    host: 'https://v.qq.com',
    homeUrl: '',
    searchUrl: '',
    searchable: 0,
    multi: 1,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://v.qq.com/'
    },
    timeout: 8000,
    // channel_id 从 v.qq.com/channel 页面抓的
    class_name: '电影&电视剧&综艺&动漫&少儿&纪录片',
    class_url: '100173&100113&100109&100119&100150&100105',
    limit: 30,

    // 一级：POST pbaccess，拿 channel_list_poster 里的 cards
    一级: `js:
let d = [];
let cid = MY_CATE;
let pg = MY_PAGE - 1;
let body = JSON.stringify({
  page_params: {
    page_id: 'channel_list_second_page',
    page_type: 'operation',
    channel_id: String(cid),
    filter_params: '',
    page: String(pg)
  },
  page_bypass_params: {
    params: {
      page_id: 'channel_list_second_page',
      page_type: 'operation',
      channel_id: String(cid),
      filter_params: '',
      page: String(pg),
      caller_id: '3000010',
      platform_id: '2',
      data_mode: 'default',
      user_mode: 'default'
    },
    scene: 'operation',
    abtest_bypass_id: '0d75c1a261513634'
  }
});
let url = 'https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010';
let opt = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Referer': 'https://v.qq.com/',
    'Origin': 'https://v.qq.com',
    'User-Agent': PC_UA
  },
  body: body
};
let resp;
try { resp = request(url, opt); } catch (e) { resp = ''; }
if (resp) {
  try {
    let j = JSON.parse(resp);
    let cards = [];
    let cl = j && j.data && j.data.CardList;
    if (cl && cl.length) {
      for (let i = 0; i < cl.length; i++) {
        if (cl[i].type === 'channel_list_poster') {
          if (cl[i].children_list && cl[i].children_list.list && cl[i].children_list.list.cards) {
            cards = cl[i].children_list.list.cards;
          }
          break;
        }
      }
    }
    for (let i = 0; i < cards.length; i++) {
      let p = cards[i].params || {};
      if (!p.cid) continue;
      let remarks = '';
      if (p.timelong) remarks = p.timelong;
      else if (p.second_title) remarks = p.second_title;
      else if (p.main_genre) remarks = p.main_genre;
      let pic = p.new_pic_vt || p.new_pic_hz || '';
      d.push({
        vod_id: String(p.cid),
        vod_name: String(p.title || ''),
        vod_pic: pic,
        vod_remarks: remarks,
        vod_year: String(p.publish_date || '').substr(0, 4),
        vod_area: String(p.area_name || ''),
        type_name: String(p.main_genre || '')
      });
    }
  } catch (e) {}
}
setResult(d);
`,

    // 二级：给播放页链接，交给客户端解析接口
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
  vod_play_from: 'qq',
  vod_play_url: ''
};
// 问腾讯要片名/海报
try {
  let u = 'https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid;
  let r = request(u, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://v.qq.com/' } });
  let j = JSON.parse(r);
  if (j && j.c) {
    VOD.vod_name = j.c.title || '';
    VOD.vod_pic = j.c.poster || j.c.pic || '';
    VOD.vod_content = j.c.description || '';
    VOD.vod_year = j.c.year || '';
    if (j.typ && j.typ.length) {
      VOD.vod_area = j.typ[0] || '';
      VOD.type_name = j.typ[0] || '';
    }
  }
} catch (e) {}
if (!VOD.vod_name) VOD.vod_name = '未知片名';
VOD.vod_play_url = '正片$https://v.qq.com/x/cover/' + cid + '.html';
`,

    // 腾讯搜索接口需要 POST 且参数多，drpy 里不好拼，先关掉
    搜索: ''
};

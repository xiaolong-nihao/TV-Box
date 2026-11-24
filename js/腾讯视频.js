// 腾讯视频 - pbaccess channel 接口（2026-11 新版）
var rule = {
    title: '腾讯视频',
    host: 'https://v.qq.com',
    homeUrl: '',
    searchUrl: '',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    multi: 1,
    // 筛选值经 filter_url 拼到 url 后由一级脚本从 MY_FL 读取，做本地过滤
    filter_url: 'sort={{fl.sort or}}&type={{fl.type or}}&year={{fl.year or}}',
    filter: {
        '100173': qqFilter(), '100113': qqFilter(), '100109': qqFilter(),
        '100150': qqFilter(), '100119': qqFilter(), '100105': qqFilter()
    },
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Referer': 'https://v.qq.com/',
        'Origin': 'https://v.qq.com'
    },
    timeout: 12000,
    class_name: '电影&电视剧&综艺&儿童&动漫&纪录片',
    class_url: '100173&100113&100109&100150&100119&100105',
    limit: 30,
    play_parse: false,

    一级: $js.toString(() => {
        let d = [];
        let cid = String(MY_CATE);
        let pg = MY_PAGE;

        // 分页上下文：第 2 页起从缓存取 page_context（腾讯新版靠它翻页，不靠 page 数字）
        let pageContext = '';
        let cacheKey = 'qq_ctx_' + cid;
        if (pg > 1) {
            try {
                let cached = storage0.getItem(cacheKey);
                if (cached) {
                    let o = JSON.parse(cached);
                    if (o.page === pg - 1) pageContext = o.ctx;
                }
            } catch (e) {}
        } else {
            try { storage0.setItem(cacheKey, ''); } catch (e) {}
        }

        let apiUrl = 'https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010&vversion_platform=2';
        let requestBody = {
            page_params: {
                page_type: 'channel',
                page_id: cid,
                scene: 'channel',
                new_mark_label_enabled: '1',
                vl_to_mvl: '1',
                free_watch_trans_info: '{"ad_frequency_control_time_list":{}}',
                ad_exp_ids: '100000',
                skip_privacy_types: '0',
                support_click_scan: '1'
            },
            page_bypass_params: {
                params: {
                    platform_id: '2',
                    caller_id: '3000010',
                    data_mode: 'default',
                    user_mode: 'default',
                    page_type: 'channel',
                    page_id: cid,
                    scene: 'channel',
                    new_mark_label_enabled: '1'
                },
                scene: 'channel',
                app_version: ''
            },
            page_context: pageContext
        };

        let html = '';
        try {
            // 写法与已验证规则一致：body 是 JSON 字符串 + method:POST + Content-Type
            html = request(apiUrl, {
                body: JSON.stringify(requestBody),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    'Origin': 'https://v.qq.com',
                    'Referer': 'https://v.qq.com/channel/movie'
                },
                method: 'POST'
            });
        } catch (e) {
            log('腾讯请求失败: ' + e.message);
        }

        if (html) {
            try {
                let j = JSON.parse(html);
                let data = j.data || {};

                // 保存下一页上下文
                if (data.has_next_page && data.page_context) {
                    try {
                        storage0.setItem(cacheKey, JSON.stringify({page: pg, ctx: data.page_context}));
                    } catch (e) {}
                }

                let seen = {};
                let cl = data.CardList || [];
                for (let i = 0; i < cl.length; i++) {
                    let card = cl[i];
                    let t = card.type || '';
                    if (t === 'channel_list_filter' || t === 'pc_hot_filter') continue;
                    let ch = card.children_list || {};
                    let cards = [];
                    if (ch.list && ch.list.cards) cards = ch.list.cards;
                    else if (ch.card_list && ch.card_list.cards) cards = ch.card_list.cards;
                    for (let k = 0; k < cards.length; k++) {
                        let p = cards[k].params || {};
                        let vid = p.cid || '';
                        // mz_title / title_pc 是正式片名，title 常是营销短句（"梁家辉陷20亿绑架"）
                        let nm = p.mz_title || p.title_pc || p.title || '';
                        if (!vid || !nm || seen[vid]) continue;
                        seen[vid] = 1;
                        let pic = p.pic_276x386 || p.image_url_vertical || p.pic_1280x720 ||
                                  p.pic_1080x607 || p.image_url || p.cid_pic_color_hz || '';
                        let st = p.material_video_subtitle || p.second_title ||
                                 p.main_genre || p.video_subtitle || '';
                        let genre = String(p.main_genre || '');
                        // 年份字段在不同卡片类型里名字不同，都要收
                        let yr = '';
                        if (p.year) yr = String(p.year).substr(0, 4);
                        else if (p.publish_date) yr = String(p.publish_date).substr(0, 4);
                        else if (p.publish_dateX) yr = String(p.publish_dateX).substr(0, 4);
                        else if (p.release_time) yr = String(new Date(Number(p.release_time)).getFullYear());
                        // 评分：item_score / prerank_score，供"好评"排序用
                        let score = 0;
                        if (p.item_score) score = Number(p.item_score) || 0;
                        else if (p.prerank_score) score = Number(p.prerank_score) || 0;
                        // drpy2 一级列表字段：title/img/desc/url + tname/year（供筛选）
                        d.push({
                            title: String(nm),
                            img: String(pic),
                            desc: String(st),
                            url: String(vid),
                            tname: genre,
                            year: yr,
                            score: score
                        });
                    }
                }
            } catch (e) {
                log('腾讯解析失败: ' + e.message);
            }
        }
        // ---- 本地筛选（腾讯新接口不吃筛选参数，取回后按 MY_FL 过滤）----
        // 注意：App 首屏 MY_FL 可能带"全部/all"这类默认值，必须视为不过滤，
        // 否则会把所有片筛掉 → 列表空白
        let fl = MY_FL || {};
        let fSort = String(fl.sort || '');
        let fType = String(fl.type || '');
        let fYear = String(fl.year || '');
        if (fType === '全部' || fType === 'all') fType = '';
        if (fYear === '全部' || fYear === 'all' || fYear === '全部年份') fYear = '';
        let out = d;
        if (fType) {
            let tmp = out.filter(function(x){ return x.tname && x.tname.indexOf(fType) >= 0; });
            if (tmp.length) out = tmp;   // 筛不出就保留原列表，避免空白
        }
        if (fYear) {
            let tmp = out.filter(function(x){ return x.year && x.year === fYear; });
            if (tmp.length) out = tmp;
        }
        if (fSort === 'new' || fSort === '最新') {
            out = out.slice().sort(function(a,b){ return String(b.year||'').localeCompare(String(a.year||'')); });
        } else if (fSort === 'score' || fSort === '好评') {
            // 排除无类型的营销卡（"朱一龙：一人演尽千面"这类宣发短片），只留正片
            let real = out.filter(function(x){ return x.tname && x.tname.length > 0; });
            if (real.length) out = real;
            out = out.slice().sort(function(a,b){ return (Number(b.score)||0) - (Number(a.score)||0); });
        }
        setResult(out);
    }),

    二级: $js.toString(() => {
        // input 可能是纯 cid，也可能是 "标题$cid"，取最后一段并剥掉 url 前缀
        let cid = String(input).split('$').pop().trim();
        let m = cid.match(/(?:cid=|\/cover\/)([a-zA-Z0-9]+)/);
        if (m) cid = m[1];
        VOD = {vod_id: cid, vod_name: '', vod_pic: '', vod_remarks: '', vod_year: '', vod_area: '',
               vod_content: '', vod_actor: '', vod_play_from: 'qq', vod_play_url: ''};
        try {
            let u = 'https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid;
            let r = request(u, {headers: {'User-Agent': MOBILE_UA, 'Referer': 'https://v.qq.com/'}});
            let j = JSON.parse(r);
            if (j && j.c) {
                VOD.vod_name = j.c.title || '';
                VOD.vod_pic = j.c.poster || j.c.pic || '';
                VOD.vod_content = j.c.description || '';
                VOD.vod_year = j.c.year || '';
                if (j.typ && j.typ.length) {
                    VOD.vod_area = typeof j.typ[0] === 'string' ? j.typ[0] : '';
                    VOD.type_name = j.typ.map(function(x){ return typeof x === 'string' ? x : (x.join ? x.join('/') : ''); }).join(',');
                }
                // nam 是嵌套数组 [["朱一龙","檀健次",...]]，要展开
                if (j.nam && j.nam.length) {
                    let actors = [];
                    j.nam.forEach(function(g){ if (Array.isArray(g)) actors = actors.concat(g); else actors.push(g); });
                    VOD.vod_actor = actors.join(',');
                }
                if (j.rec) VOD.vod_remarks = j.rec;
                // 有 clips_ids/video_ids 就按集列出，电影只有一条正片
                if (j.c.video_ids && j.c.video_ids.length) {
                    let vids = j.c.video_ids;
                    let pl = [];
                    for (let i = 0; i < vids.length; i++) {
                        pl.push('第' + (i + 1) + '集$https://v.qq.com/x/cover/' + cid + '/' + vids[i] + '.html');
                    }
                    VOD.vod_play_url = pl.join('#');
                }
            }
        } catch (e) {
            log('腾讯详情失败: ' + e.message);
        }
        if (!VOD.vod_name) VOD.vod_name = '未知片名';
        if (!VOD.vod_play_url) VOD.vod_play_url = '正片$https://v.qq.com/x/cover/' + cid + '.html';
    }),

    搜索: $js.toString(() => {
        let d = [];
        let kw = KEY;
        let pg = MY_PAGE - 1;
        let bodyObj = {
            version: '25042201', clientType: 1, filterValue: '',
            uuid: 'B1E50847-D25F-4C4B-BBA0-36F0093487F6', retry: 0,
            query: kw, pagenum: pg, isPrefetch: true, pagesize: 30,
            queryFrom: 0, isneedQc: true,
            extraInfo: {isNewMarkLabel: '1', multi_terminal_pc: '1', themeType: '1'}
        };
        let html = '';
        try {
            html = request('https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2', {
                body: JSON.stringify(bodyObj),
                headers: {
                    'User-Agent': PC_UA,
                    'Content-Type': 'application/json',
                    'Origin': 'https://v.qq.com',
                    'Referer': 'https://v.qq.com/'
                },
                method: 'POST'
            });
        } catch (e) {
            log('腾讯搜索失败: ' + e.message);
        }
        if (html) {
            try {
                let j = JSON.parse(html);
                let items = (j.data && j.data.normalList && j.data.normalList.itemList) || [];
                let seen = {};
                for (let i = 0; i < items.length; i++) {
                    let doc = items[i].doc || {};
                    let vi = items[i].videoInfo || {};
                    let id = doc.id || '';
                    let tt = vi.title || '';
                    if (!id || !tt || seen[id]) continue;
                    // 过滤明显的解读/剪辑类（标题含这些词且是短视频 id），保留正片
                    let plain = String(tt).replace(/<[^>]+>/g, '');
                    if (/解析|解说|为什么|怎么回事|盘点|真相|万字|几分钟看完/.test(plain) && id.charAt(0) !== 'm') continue;
                    seen[id] = 1;
                    let pic = vi.imgUrl || '';
                    let yr = vi.year ? String(vi.year) : '';
                    let desc = yr || (vi.typeName ? String(vi.typeName) : '');
                    if (plain.length > 40) desc = plain.substr(0, 40) + '...';
                    d.push({
                        title: plain,
                        img: String(pic),
                        desc: desc,
                        url: String(id)
                    });
                }
            } catch (e) {
                log('腾讯搜索解析失败: ' + e.message);
            }
        }
        setResult(d);
    })
};

// 筛选配置：排序 / 类型 / 年份（和你截图"以前"的那套一致）
function qqFilter() {
    var years = [{n:'全部', v:''}];
    for (var y = 2027; y >= 2010; y--) years.push({n:String(y), v:String(y)});
    return [
        {key:'sort', name:'', value:[
            {n:'最热', v:''}, {n:'最新', v:'new'}, {n:'好评', v:'score'}
        ]},
        {key:'type', name:'', value:[
            {n:'全部', v:''}, {n:'犯罪', v:'犯罪'}, {n:'励志', v:'励志'},
            {n:'喜剧', v:'喜剧'}, {n:'热血', v:'热血'}, {n:'悬疑', v:'悬疑'},
            {n:'爱情', v:'爱情'}, {n:'科幻', v:'科幻'}, {n:'恐怖', v:'恐怖'},
            {n:'动画', v:'动画'}, {n:'战争', v:'战争'}, {n:'家庭', v:'家庭'},
            {n:'剧情', v:'剧情'}, {n:'奇幻', v:'奇幻'}, {n:'武侠', v:'武侠'},
            {n:'历史', v:'历史'}, {n:'动作', v:'动作'}
        ]},
        {key:'year', name:'', value: years}
    ];
}

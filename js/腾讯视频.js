// 腾讯视频 - pbaccess channel 接口（2026-11 新版）
var rule = {
    title: '腾讯视频',
    host: 'https://v.qq.com',
    homeUrl: '',
    searchUrl: '',
    searchable: 0,
    quickSearch: 0,
    filterable: 0,
    multi: 1,
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
                        d.push({
                            vod_id: String(vid),
                            vod_name: String(nm),
                            vod_pic: String(pic),
                            vod_remarks: String(st),
                            vod_year: String(p.publish_date || '').substr(0, 4),
                            vod_area: String(p.area_name || p.gen_area_name || ''),
                            type_name: String(p.main_genre || '')
                        });
                    }
                }
            } catch (e) {
                log('腾讯解析失败: ' + e.message);
            }
        }
        setResult(d);
    }),

    二级: $js.toString(() => {
        let cid = input.split('$').pop();
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
                    VOD.vod_area = j.typ[0] || '';
                    VOD.type_name = j.typ.join(',');
                }
                if (j.nam && j.nam.length) VOD.vod_actor = j.nam.join(',');
            }
            if (j && j.rec) VOD.vod_remarks = j.rec;
        } catch (e) {
            log('腾讯详情失败: ' + e.message);
        }
        if (!VOD.vod_name) VOD.vod_name = '未知片名';
        VOD.vod_play_url = '正片$https://v.qq.com/x/cover/' + cid + '.html';
    }),

    搜索: ''
};

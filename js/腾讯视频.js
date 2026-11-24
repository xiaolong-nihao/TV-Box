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
        'Referer': 'https://v.qq.com/',
        'Origin': 'https://v.qq.com'
    },
    timeout: 10000,
    class_name: '电影&电视剧&综艺&儿童&动漫&纪录片',
    class_url: '100173&100113&100109&100150&100119&100105',
    limit: 30,
    play_parse: false,
    一级: $js.toString(() => {
        let d = [];
        let cid = MY_CATE;
        let pg = MY_PAGE - 1;
        let params = {
            page_id: 'channel_list_second_page',
            page_type: 'operation',
            channel_id: String(cid),
            filter_params: '',
            page: String(pg)
        };
        let bodyObj = {
            page_params: params,
            page_bypass_params: {
                params: {
                    page_id: params.page_id,
                    page_type: params.page_type,
                    channel_id: params.channel_id,
                    filter_params: '',
                    page: params.page,
                    caller_id: '3000010',
                    platform_id: '2',
                    data_mode: 'default',
                    user_mode: 'default'
                },
                scene: 'operation',
                abtest_bypass_id: '0d75c1a261513634'
            }
        };
        let url = 'https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010';
        let resp = '';
        try {
            resp = request(url, {
                method: 'POST',
                body: JSON.stringify(bodyObj),
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://v.qq.com/',
                    'Origin': 'https://v.qq.com',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
                }
            });
        } catch (e) {
            log('腾讯请求失败: ' + e.message);
            resp = '';
        }
        if (resp) {
            try {
                let j = JSON.parse(resp);
                let cards = [];
                let cl = (j && j.data && j.data.CardList) || [];
                for (let i = 0; i < cl.length; i++) {
                    if (cl[i].type === 'channel_list_poster') {
                        let ch = cl[i].children_list;
                        if (ch && ch.list && ch.list.cards) cards = ch.list.cards;
                        break;
                    }
                }
                for (let i = 0; i < cards.length; i++) {
                    let p = cards[i].params || {};
                    if (!p.cid) continue;
                    let st = '';
                    if (p.timelong) st = String(p.timelong);
                    else if (p.second_title) st = String(p.second_title);
                    else if (p.main_genre) st = String(p.main_genre);
                    let pic = p.new_pic_vt || p.new_pic_hz || '';
                    d.push({
                        vod_id: String(p.cid),
                        vod_name: String(p.title || ''),
                        vod_pic: String(pic),
                        vod_remarks: st,
                        vod_year: String(p.publish_date || '').substr(0, 4),
                        vod_area: String(p.area_name || ''),
                        type_name: String(p.main_genre || '')
                    });
                }
            } catch (e) {
                log('腾讯解析失败: ' + e.message);
            }
        }
        setResult(d);
    }),
    二级: $js.toString(() => {
        let cid = input.split('$').pop();
        VOD = {vod_id: cid, vod_name: '', vod_pic: '', vod_remarks: '', vod_year: '', vod_area: '', vod_content: '', vod_play_from: 'qq', vod_play_url: ''};
        try {
            let u = 'https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid;
            let r = request(u, {headers: {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://v.qq.com/'}});
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
            if (j && j.rec) VOD.vod_remarks = j.rec;
        } catch (e) {
            log('腾讯详情失败: ' + e.message);
        }
        if (!VOD.vod_name) VOD.vod_name = '未知片名';
        VOD.vod_play_url = '正片$https://v.qq.com/x/cover/' + cid + '.html';
    }),
    搜索: ''
};

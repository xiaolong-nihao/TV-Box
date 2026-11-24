var rule = {
    title: '腾讯视频',
    host: 'https://v.qq.com',
    homeUrl: '/x/bu/pagesheet/list?_all=1&append=1&channel=cartoon&listpage=1&offset=0&pagesize=21&iarea=-1&sort=18',
    detailUrl: 'https://node.video.qq.com/x/api/float_vinfo2?cid=fyid',
    searchUrl: '**',
    searchable: 1,
    filterable: 1,
    multi: 1,
    url: '/x/bu/pagesheet/list?_all=1&append=1&channel=fyclass&listpage=1&offset=((fypage-1)*21)&pagesize=21&iarea=-1',
    filter_url: 'sort={{fl.sort or 75}}&iyear={{fl.iyear}}&year={{fl.year}}&itype={{fl.type}}&ifeature={{fl.feature}}&iarea={{fl.area}}&itrailer={{fl.itrailer}}&gender={{fl.sex}}',
    headers: {
        'User-Agent': 'PC_UA'
    },
    timeout: 5000,
    cate_exclude: '会员|游戏|全部',
    class_name: '电影&电视剧&综艺&动漫&少儿&纪录片',
    class_url: 'movie&tv&variety&cartoon&child&doco',
    limit: 20,
    play_parse: true,
    lazy: $js.toString(() => {
        let d = [];
        let url1 = JSON.parse(request("" + input)).url;
        input = {url: url1, parse: 0, header: rule.headers};
        setResult(d);
    }),
    推荐: '.list_item;img&&alt;img&&src;a&&Text;a&&data-float',
    一级: '.list_item;img&&alt;img&&src;a&&Text;a&&data-float',
    二级: $js.toString(() => {
        VOD = {};
        let d = [];
        let html = fetch(input, fetch_params);
        let sourceId = /get_playsource/.test(input) ? input.match(/id=(\d*?)&/)[1] : input.split("cid=")[1];
        let cid = sourceId;
        try {
            let json = JSON.parse(html);
            VOD = {
                vod_url: input,
                vod_name: json.c.title,
                type_name: json.typ.join(","),
                vod_actor: json.nam.join(","),
                vod_year: json.c.year,
                vod_content: json.c.description,
                vod_remarks: json.rec,
                vod_pic: urljoin2(input, json.c.pic)
            }
        } catch (e) {}
        let video_lists = [];
        try {
            let json = JSON.parse(html);
            video_lists = json.c.video_ids || [];
        } catch (e) {}
        if (video_lists.length === 1) {
            d.push({title: "正片", url: "https://v.qq.com/x/cover/" + cid + "/" + video_lists[0] + ".html"});
        } else if (video_lists.length > 1) {
            for (let i = 0; i < video_lists.length; i++) {
                d.push({title: "第" + (i + 1) + "集", url: "https://v.qq.com/x/cover/" + cid + "/" + video_lists[i] + ".html"});
            }
        }
        if (!d.length) d.push({title: "正片", url: "https://v.qq.com/x/cover/" + cid + ".html"});
        VOD.vod_play_from = "qq";
        VOD.vod_play_url = d.map(it => it.title + "$" + it.url).join("#");
        setResult(d);
    }),
    搜索: $js.toString(() => {
        let d = [], keyword = input.split("/")[3];
        let seenIds = new Set();
        function vodSearch(kw, page) {
            return request('https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2', {
                body: JSON.stringify({version: "25042201", clientType: 1, filterValue: "", uuid: "B1E50847-D25F-4C4B-BBA0-36F0093487F6", retry: 0, query: kw, pagenum: page, isPrefetch: true, pagesize: 30, queryFrom: 0, isneedQc: true, extraInfo: {isNewMarkLabel: "1", multi_terminal_pc: "1", themeType: "1"}}),
                headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.139 Safari/537.36', 'Content-Type': 'application/json', 'Origin': 'https://v.qq.com', 'Referer': 'https://v.qq.com/'},
                method: 'POST'
            });
        }
        try {
            let json = JSON.parse(vodSearch(keyword, 0));
            let items = (json.data && json.data.normalList && json.data.normalList.itemList) || [];
            items.forEach(it => {
                if (it.doc && it.doc.id && it.videoInfo) {
                    if (!seenIds.has(it.doc.id)) {
                        seenIds.add(it.doc.id);
                        d.push({title: it.videoInfo.title, img: it.videoInfo.imgUrl || "", url: it.doc.id, desc: it.videoInfo.secondLine || ""});
                    }
                }
            });
        } catch (e) { log("搜索出错: " + e.message); }
        setResult(d);
    })
};

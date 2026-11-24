var rule = {
    title: '芒果TV',
    host: 'https://pianku.api.mgtv.com',
    homeUrl: '',
    searchUrl: 'https://mobileso.bz.mgtv.com/msite/search/v2?q=**&pn=fypage&pc=10',
    detailUrl: 'https://pcweb.api.mgtv.com/episode/list?page=1&size=50&video_id=fyid',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    multi: 1,
    url: '/rider/list/pcweb/v3?platform=pcweb&channelId=fyclass&pn=fypage&pc=80&hudong=1&_support=10000000&kind=a1&area=a1',
    filter_url: 'year={{fl.year or "all"}}&sort={{fl.sort or "all"}}&chargeInfo={{fl.chargeInfo or "all"}}',
    headers: {
        'User-Agent': 'PC_UA'
    },
    timeout: 5000,
    class_name: '电影&电视剧&综艺&儿童&动漫&纪录片',
    class_url: '3&2&1&10&50&51',
    filter: {
        "3": getCommonFilter(),
        "2": getCommonFilter(),
        "1": getCommonFilter(),
        "10": getCommonFilter(),
        "50": getCommonFilter(),
        "51": getCommonFilter()
    },
    limit: 20,
    play_parse: true,
    lazy: $js.toString(() => {
        input = {parse: 0, url: input.split("?")[0]};
    }),
    一级: 'json:data.hitDocs;title;img;updateInfo||rightCorner.text;playPartId',
    二级: $js.toString(() => {
        fetch_params.headers.Referer = "https://www.mgtv.com";
        fetch_params.headers["User-Agent"] = MOBILE_UA;
        let videoId = input.split('video_id=')[1].split('&')[0];
        let infoUrl = "https://pcweb.api.mgtv.com/video/info?allowedRC=1&vid=" + videoId + "&type=b&_support=10000000";
        let infoData = JSON.parse(request(infoUrl));
        if (infoData && infoData.data && infoData.data.info) {
            let detail = infoData.data.info.detail || {};
            VOD = {
                vod_name: infoData.data.info.title || "",
                type_name: detail.kind || "",
                vod_year: detail.releaseTime || "",
                vod_area: detail.area || "",
                vod_actor: detail.leader || "",
                vod_director: detail.director || "",
                vod_content: detail.story || "",
                vod_remarks: detail.updateInfo || ""
            };
            if (detail.img) VOD.vod_pic = detail.img;
        }
        let d = [];
        let html = request(input);
        let json = JSON.parse(html);
        if (json.data.total === 1 && json.data.list.length === 1) {
            let data = json.data.list[0];
            d.push({title: data.t4, desc: data.t2, pic_url: data.img, url: "https://www.mgtv.com" + data.url});
        } else if (json.data.list.length > 1) {
            let pages = Math.min(json.data.total_page || 1, 10);
            for (let i = 1; i <= pages; i++) {
                let pg = i;
                if (i > 1) json = JSON.parse(fetch(input.replace("page=1", "page=" + pg), {}));
                json.data.list.forEach(function(data) {
                    if (data.isIntact == "1") {
                        d.push({title: data.t4, desc: data.t2, pic_url: data.img, url: "https://www.mgtv.com" + data.url});
                    }
                });
            }
        }
        VOD.vod_play_from = "欢迎观影";
        VOD.vod_play_url = d.map(function(it){return it.title + "$" + it.url;}).join("#");
        setResult(d);
    }),
    搜索: $js.toString(() => {
        fetch_params.headers.Referer = "https://www.mgtv.com";
        fetch_params.headers["User-Agent"] = MOBILE_UA;
        let d = [];
        let html = request(input);
        let json = JSON.parse(html);
        json.data.contents.forEach(function(data) {
            if (data.type && data.type == 'media') {
                let item = data.data[0];
                if (item.source === "imgo") {
                    let fyclass = '';
                    try { fyclass = item.rpt.match(/idx=(.*?)&/)[1] + '$'; } catch (e) {}
                    d.push({
                        title: item.title.replace(/<B>|<\/B>/g, ''),
                        img: item.img || '',
                        content: '',
                        desc: item.desc.join(','),
                        url: fyclass + item.url.match(/.*\/(.*?)\.html/)[1]
                    });
                }
            }
        });
        setResult(d);
    })
};

function getCommonFilter() {
    return [{
        "key": "chargeInfo",
        "name": "付费类型",
        "value": [
            {"n": "全部", "v": "all"}, {"n": "免费", "v": "b1"}, {"n": "vip", "v": "b2"},
            {"n": "VIP用券", "v": "b3"}, {"n": "付费点播", "v": "b4"}
        ]
    }, {
        "key": "sort",
        "name": "排序",
        "value": [
            {"n": "最新", "v": "c1"}, {"n": "最热", "v": "c2"}, {"n": "高分", "v": "c4"}
        ]
    }, {
        "key": "year",
        "name": "年代",
        "value": [
            {"n": "全部", "v": "all"}, {"n": "2026", "v": "2026"}, {"n": "2025", "v": "2025"},
            {"n": "2024", "v": "2024"}, {"n": "2023", "v": "2023"}, {"n": "2022", "v": "2022"},
            {"n": "2021", "v": "2021"}, {"n": "2020", "v": "2020"}, {"n": "2019", "v": "2019"},
            {"n": "2018", "v": "2018"}, {"n": "2017", "v": "2017"}, {"n": "2016", "v": "2016"},
            {"n": "2015", "v": "2015"}, {"n": "2014", "v": "2014"}, {"n": "2013", "v": "2013"},
            {"n": "2012", "v": "2012"}, {"n": "2011", "v": "2011"}, {"n": "2010", "v": "2010"}
        ]
    }];
}

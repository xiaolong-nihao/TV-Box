# -*- coding: utf-8 -*-
# by @嗷呜
import json
import re
import base64
from urllib.parse import urljoin
import sys
import threading
import uuid
import requests
sys.path.append('..')
from base.spider import Spider
import time
from Crypto.Hash import MD5, SHA1

class Spider(Spider):
    '''
    配置示例：
    {
        "key": "xxxx",
        "name": "xxxx",
        "type": 3,
        "api": ".所在路径/金牌.py",
        "searchable": 1,
        "quickSearch": 1,
        "filterable": 1,
        "changeable": 1,
        "ext": {
            "site": "https://www.jiabaide.cn,域名2,域名3"
        }
    },
    '''
    def init(self, extend=""):
        if extend:
            hosts=json.loads(extend)['site']
        self.host = self.host_late(hosts)
        pass

    def getName(self):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    def homeContent(self, filter):
        cdata = self.fetch(f"{self.host}/api/mw-movie/anonymous/get/filer/type", headers=self.getheaders()).json()
        fdata = self.fetch(f"{self.host}/api/mw-movie/anonymous/v1/get/filer/list", headers=self.getheaders()).json()
        result = {}
        classes = []
        filters={}
        for k in cdata['data']:
            __tn = str(k.get('typeName') or '')
            if any(b in __tn for b in self._BAD_TYPE):
                continue          # 伦理/福利这类分类直接不出现在导航栏
            classes.append({
                'type_name': k['typeName'],
                'type_id': str(k['typeId']),
            })
        sort_values = [{"n": "最近更新", "v": "2"},{"n": "人气高低", "v": "3"}, {"n": "评分高低", "v": "4"}]
        for tid, d in fdata['data'].items():
            current_sort_values = sort_values.copy()
            if tid == '1':
                del current_sort_values[0]
            filters[tid] = [
                {"key": "type", "name": "类型",
                 "value": [{"n": i["itemText"], "v": i["itemValue"]} for i in d["typeList"]]},

                *([] if not d["plotList"] else [{"key": "v_class", "name": "剧情",
                                                 "value": [{"n": i["itemText"], "v": i["itemText"]}
                                                           for i in d["plotList"]]}]),

                {"key": "area", "name": "地区",
                 "value": [{"n": i["itemText"], "v": i["itemText"]} for i in d["districtList"]]},

                {"key": "year", "name": "年份",
                 "value": [{"n": i["itemText"], "v": i["itemText"]} for i in d["yearList"]]},

                {"key": "lang", "name": "语言",
                 "value": [{"n": i["itemText"], "v": i["itemText"]} for i in d["languageList"]]},

                {"key": "sort", "name": "排序", "value": current_sort_values}
            ]
        result['class'] = classes
        result['filters'] = filters
        return result

    def homeVideoContent(self):
        data1 = self.fetch(f"{self.host}/api/mw-movie/anonymous/v1/home/all/list", headers=self.getheaders()).json()
        data2=self.fetch(f"{self.host}/api/mw-movie/anonymous/home/hotSearch",headers=self.getheaders()).json()
        data=[]
        for i in data1['data'].values():
            data.extend(i['list'])
        data.extend(data2['data'])
        vods=self.getvod(data)
        return {'list':vods}

    def categoryContent(self, tid, pg, filter, extend):

        params = {
          "area": extend.get('area', ''),
          "filterStatus": "1",
          "lang": extend.get('lang', ''),
          "pageNum": pg,
          "pageSize": "30",
          "sort": extend.get('sort', '1'),
          "sortBy": "1",
          "type": extend.get('type', ''),
          "type1": tid,
          "v_class": extend.get('v_class', ''),
          "year": extend.get('year', '')
        }
        data = self.fetch(f"{self.host}/api/mw-movie/anonymous/video/list?{self.js(params)}", headers=self.getheaders(params)).json()
        result = {}
        result['list'] = self.getvod(data['data']['list'])
        result['page'] = pg
        result['pagecount'] = 9999
        result['limit'] = 90
        result['total'] = 999999
        return result

    def detailContent(self, ids):
        data=self.fetch(f"{self.host}/api/mw-movie/anonymous/video/detail?id={ids[0]}",headers=self.getheaders({'id':ids[0]})).json()
        vod=self.getvod([data['data']])[0]
        vod['vod_play_from']='文才'
        vod['vod_play_url'] = '#'.join(
            f"{i['name'] if len(vod['episodelist']) > 1 else vod['vod_name']}${ids[0]}@@{i['nid']}" for i in
            vod['episodelist'])
        vod.pop('episodelist', None)
        return {'list':[vod]}

    def searchContent(self, key, quick, pg="1"):
        params = {
          "keyword": key,
          "pageNum": pg,
          "pageSize": "8",
          "sourceCode": "1"
        }
        data=self.fetch(f"{self.host}/api/mw-movie/anonymous/video/searchByWord?{self.js(params)}",headers=self.getheaders(params)).json()
        vods=self.getvod(data['data']['result']['list'])
        return {'list':vods,'page':pg}


    # ================= 流内广告过滤（保守策略）=================
    # 1. 只处理 m3u8；mp4 等直链原样放行，不进代理
    # 2. 只删「明确是广告」的切片：文件名含 ad/gg/promo，或时长 < 1 秒
    # 3. 相对路径重写成绝对路径（否则播放器会拼错基准地址）
    # 4. 保留所有 #EXT-X-* 标签（KEY/MAP/DISCONTINUITY 都不能丢）
    # 5. 任何异常都返回原始 m3u8，保证能播

    # 文件名开头是 ad/ads/adv/gg/promo/sp/tuiguang/guanggao 的切片，判定为广告。
    # 用 [^/]* 而不是 [0-9_-]*：实际广告文件名多是 gg_promo01.ts / ad_001.ts 这种，
    # 含字母下划线，太严的正则匹配不到。
    AD_PAT = re.compile(r'(?:^|/)(?:ad|ads|adv|gg|promo|sp|tuiguang|guanggao)[^/]*\.(?:ts|m4s)', re.I)

    def _is_ad_seg(self, dur, uri):
        if uri and self.AD_PAT.search(uri):
            return True
        if dur and dur < 1.0:
            return True
        return False

    def _filter_m3u8(self, text, base_url):
        try:
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            if not lines or not any(ln.startswith('#EXTINF') for ln in lines):
                return text
            out = []
            i, n = 0, len(lines)
            while i < n:
                ln = lines[i]
                if ln.startswith('#EXTINF:'):
                    try:
                        dur = float(ln.split(':', 1)[1].split(',', 1)[0])
                    except Exception:
                        dur = 0.0
                    j = i + 1
                    while j < n and lines[j].startswith('#'):
                        j += 1
                    uri = lines[j] if j < n else ''
                    # 相对路径 -> 绝对
                    if uri and not uri.startswith('http'):
                        uri_abs = urljoin(base_url, uri)
                    else:
                        uri_abs = uri
                    if self._is_ad_seg(dur, uri_abs):
                        i = j + 1
                        continue
                    out.append(ln)
                    for k in range(i + 1, j):
                        out.append(lines[k])
                    if j < n:
                        out.append(uri_abs)
                    i = j + 1
                    continue
                out.append(ln)
                i += 1
            return '\n'.join(out) + '\n'
        except Exception:
            return text

    def _mk_proxy(self, url):
        try:
            return 'proxy://do=adfree&u=' + base64.urlsafe_b64encode(url.encode('utf-8')).decode('ascii')
        except Exception:
            return url

    def _proxy_handle(self, param):
        """localProxy 里的去广告分支"""
        try:
            d = param if isinstance(param, dict) else {}
            if isinstance(param, str):
                for kv in param.split('&'):
                    if '=' in kv:
                        k, v = kv.split('=', 1)
                        d[k] = v
            if d.get('do') != 'adfree':
                return None
            raw = d.get('u', '')
            if not raw:
                return [404, 'text/plain', 'no url', {}]
            url = base64.urlsafe_b64decode(raw.encode('ascii')).decode('utf-8')
            hdrs = self._headers() if hasattr(self, '_headers') else {}
            r = self.fetch(url, headers=hdrs)
            txt = r.text if hasattr(r, 'text') else str(r)
            if '#EXTM3U' not in txt:
                return [200, 'application/vnd.apple.mpegurl', txt, {}]
            return [200, 'application/vnd.apple.mpegurl', self._filter_m3u8(txt, url), {}]
        except Exception:
            return [502, 'text/plain', 'proxy error', {}]

    def playerContent(self, flag, id, vipFlags):
        self.header = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
            'sec-ch-ua-platform': '"Windows"',
            'DNT': '1',
            'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            'sec-ch-ua-mobile': '?0',
            'Origin': self.host,
            'Referer': f'{self.host}/'
        }
        ids=id.split('@@')
        pdata = self.fetch(f"{self.host}/api/mw-movie/anonymous/v2/video/episode/url?clientType=1&id={ids[0]}&nid={ids[1]}",headers=self.getheaders({'clientType':'1','id': ids[0], 'nid': ids[1]})).json()
        vlist=[]
        for i in pdata['data']['list']:
            u = str(i['url'])
            if '.m3u8' in u.lower():
                u = self._mk_proxy(u)
            vlist.extend([i['resolutionName'], u])
        return {'parse':0,'url':vlist,'header':self.header}

    def localProxy(self, param):
        # 去广告代理入口
        r = self._proxy_handle(param)
        if r is not None:
            return r
        return [404, 'text/plain', 'not found', {}]

    def host_late(self, url_list):
        if isinstance(url_list, str):
            urls = [u.strip() for u in url_list.split(',')]
        else:
            urls = url_list
        if len(urls) <= 1:
            return urls[0] if urls else ''

        results = {}
        threads = []

        def test_host(url):
            try:
                start_time = time.time()
                response = requests.head(url, timeout=1.0, allow_redirects=False)
                delay = (time.time() - start_time) * 1000
                results[url] = delay
            except Exception as e:
                results[url] = float('inf')
        for url in urls:
            t = threading.Thread(target=test_host, args=(url,))
            threads.append(t)
            t.start()
        for t in threads:
            t.join()
        return min(results.items(), key=lambda x: x[1])[0]

    def md5(self, sign_key):
        md5_hash = MD5.new()
        md5_hash.update(sign_key.encode('utf-8'))
        md5_result = md5_hash.hexdigest()
        return md5_result

    def js(self, param):
        return '&'.join(f"{k}={v}" for k, v in param.items())

    def getheaders(self, param=None):
        if param is None:param = {}
        t=str(int(time.time()*1000))
        param['key']='cb808529bae6b6be45ecfab29a4889bc'
        param['t']=t
        sha1_hash = SHA1.new()
        sha1_hash.update(self.md5(self.js(param)).encode('utf-8'))
        sign = sha1_hash.hexdigest()
        deviceid = str(uuid.uuid4())
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'sign': sign,
            't': t,
            'deviceid':deviceid
        }
        return headers

    def convert_field_name(self, field):
        field = field.lower()
        if field.startswith('vod') and len(field) > 3:
            field = field.replace('vod', 'vod_')
        if field.startswith('type') and len(field) > 4:
            field = field.replace('type', 'type_')
        return field

    # 敏感词过滤：文才源站是聚合站，混有成人内容。
    # 分类名 / 类型名 / 片名任一命中就丢弃，首页、分类、搜索、详情全都走这个函数。
    _BAD_TYPE = ('伦理', '福利', '三级', '里番', '情色', '成人', '自慰', '乱伦',
                 '女优', '无码', '网红主播', '偷拍', '激情', '性感')
    _BAD_NAME = ('嫂子', '大胸', '性爱', '做爱', '嫖', '强奸', '迷奸', '春药',
                 '淫', '荡妇', '肉欲', '情欲', '艳照', '脱衣')

    def _is_bad(self, item):
        tn = str(item.get('typeName') or item.get('type_name') or '')
        nm = str(item.get('vodName') or item.get('name') or item.get('vod_name') or '')
        for b in self._BAD_TYPE:
            if b in tn:
                return True
        for b in self._BAD_NAME:
            if b in nm:
                return True
        return False

    def getvod(self, array):
        return [{self.convert_field_name(k): v for k, v in item.items()}
                for item in array if not self._is_bad(item)]


# -*- coding: utf-8 -*-
# 聚合直连：把标准 MacCMS 采集站包成 py 站，过滤伦理/福利分类和内容
# 用法（订阅里的 ext 只需给 api，其余可选）：
#   {
#     "key": "ffzy", "name": "☀非凡🔥直连", "type": 3,
#     "api": "http://caiji.1217188.xyz:82/tvbox/py/聚合直连.py",
#     "ext": {"api": "https://api.ffzyapi.com/api.php/provide/vod/"}
#   }
# 可选：ext.bad_type / ext.bad_name 覆盖默认词表，传数组即可

import json
import sys
import time

sys.path.append('..')
from base.spider import Spider


class Spider(Spider):

    # 分类名命中即整类不显示（导航栏里不会出现「伦理片」这种入口）
    BAD_TYPE = ['伦理', '福利', '三级', '里番', '情色', '成人', '自慰', '乱伦',
                '女优', '无码', '网红主播', '偷拍', '自拍', '激情', '性感',
                '写真', '裸', '巨乳', '制服诱惑']

    # 片名命中就这一部不显示（分类干净但混进来的个例）
    BAD_NAME = ['嫂子', '大胸', '性爱', '做爱', '嫖', '强奸', '迷奸', '春药',
                '淫', '荡妇', '肉欲', '情欲', '艳照', '脱衣', '裸', '巨乳',
                '人妻', '少妇', '痴女', '露出']

    UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/126.0.6478.61 Safari/537.36')

    def init(self, extend=""):
        ext = {}
        if extend:
            try:
                ext = json.loads(extend)
            except Exception:
                ext = {}
        self.api = str(ext.get('api') or '').rstrip('/')
        # 允许单站覆盖词表
        if isinstance(ext.get('bad_type'), list):
            self.bad_type = [str(x) for x in ext['bad_type']]
        else:
            self.bad_type = self.BAD_TYPE
        if isinstance(ext.get('bad_name'), list):
            self.bad_name = [str(x) for x in ext['bad_name']]
        else:
            self.bad_name = self.BAD_NAME

    def getName(self):
        return '聚合直连'

    def isVideoFormat(self, url):
        return False

    def manualVideoCheck(self, url):
        return False

    def destroy(self):
        pass

    # ---------- 内部工具 ----------

    def _headers(self):
        return {'User-Agent': self.UA, 'Accept': 'application/json, text/plain, */*'}

    def _hit(self, text, words):
        for w in words:
            if w and w in text:
                return True
        return False

    def _clean(self, arr):
        """统一出口：分类名或片名命中敏感词就丢弃"""
        out = []
        for x in (arr or []):
            if not isinstance(x, dict):
                continue
            tn = str(x.get('type_name') or '')
            nm = str(x.get('vod_name') or '')
            if self._hit(tn, self.bad_type):
                continue
            if self._hit(nm, self.bad_name):
                continue
            out.append(x)
        return out

    def _get(self, path):
        url = self.api + path
        try:
            r = self.fetch(url, headers=self._headers())
            return r.json()
        except Exception:
            # 源站偶尔 5xx / 超时，重试一次，仍失败就返回空结构，客户端显示空列表而不是报错
            try:
                time.sleep(0.3)
                return self.fetch(url, headers=self._headers()).json()
            except Exception:
                return {}

    # ---------- 标准接口 ----------

    def homeContent(self, filter):
        d = self._get('/?ac=list')
        classes = []
        for c in (d.get('class') or []):
            tn = str(c.get('type_name') or '')
            if self._hit(tn, self.bad_type):
                continue
            tid = c.get('type_id')
            if tid is None:
                continue
            classes.append({'type_name': tn, 'type_id': str(tid)})
        return {'class': classes}

    def homeVideoContent(self):
        # 首页推荐：拿第一页最新，源站不支持就返回空，不影响分类浏览
        d = self._get('/?ac=detail&pg=1')
        return {'list': self._clean(d.get('list'))}

    def categoryContent(self, tid, pg, filter, extend):
        pg = str(pg or 1)
        d = self._get('/?ac=detail&t=%s&pg=%s' % (tid, pg))
        lst = self._clean(d.get('list'))
        try:
            total = int(d.get('total') or 0)
        except Exception:
            total = 0
        pagecount = int((total + 19) / 20) if total else 9999
        return {'list': lst, 'page': int(pg), 'pagecount': pagecount,
                'limit': 20, 'total': total}

    def detailContent(self, ids):
        vid = str(ids[0]) if ids else ''
        d = self._get('/?ac=detail&ids=%s' % vid)
        lst = self._clean(d.get('list'))
        return {'list': lst}

    def searchContent(self, key, quick, pg="1"):
        from urllib.parse import quote
        d = self._get('/?ac=detail&wd=%s&pg=%s' % (quote(str(key)), str(pg or 1)))
        return {'list': self._clean(d.get('list')), 'page': int(pg or 1)}

    def localProxy(self, param):
        # base.spider.Spider 要求实现，否则 TypeError 导致整个模块加载失败
        return None

    def playerContent(self, flag, id, vipFlags):
        # MacCMS 的 id 本身就是 m3u8 直链（vod_play_url 里的地址）
        return {'parse': 0, 'url': id, 'header': self._headers()}

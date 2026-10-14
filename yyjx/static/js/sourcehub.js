/**************************************************
 * 音源后端中心 SourceHub
 *
 * 给 MKOnlinePlayer 提供「切换接口后端」能力：
 *   - 搜索后端：内置 / Meting(api.php) / 自定义 HTTP 接口
 *   - 取链接后端：内置 / Meting / LX 音源脚本 / 自定义 HTTP 接口
 *   - 自己加接口：粘贴 URL，或导入 .js 文件（洛雪音乐助手自定义音源格式）
 *   - 配置存 localStorage
 *
 * 本文件只做「宿主 + 调度 + 界面」，不含任何取流/解密逻辑。
 * 音源脚本取回什么内容由脚本本身决定。
 *************************************************/
(function () {
  'use strict';

  var LS_KEY = 'yyjx_sourcehub_v1';
  var LX_VERSION = '1.2.0';

  // MKOnlinePlayer 的 source 名 → LX 音源脚本里的 source 代号（多给几个别名依次尝试）
  var LX_ALIAS = {
    netease: ['wy', 'netease', '163'],
    qq:      ['tx', 'qq', 'tencent'],
    kuwo:    ['kw', 'kuwo'],
    kugou:   ['kg', 'kugou']
  };

  var QUALITY = ['128k', '320k', 'flac', 'flac24bit'];

  /* ==========================================================
     状态
     ========================================================== */
  var state = {
    backends: [],
    searchId: 'builtin',
    urlId: 'builtin'
  };

  function uid() {
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        backends: state.backends,
        searchId: state.searchId,
        urlId: state.urlId
      }));
    } catch (e) {
      console.warn('[SourceHub] 保存配置失败（可能是音源脚本太大超出 localStorage）', e);
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.backends)) state.backends = d.backends;
      if (d && d.searchId) state.searchId = d.searchId;
      if (d && d.urlId) state.urlId = d.urlId;
    } catch (e) {
      console.warn('[SourceHub] 读取配置失败', e);
    }
  }

  /* ==========================================================
     内置后端
     ========================================================== */
  var BUILTIN = [
    { id: 'builtin', name: '内置接口（酷我 / QQ / 网易云）', kind: 'builtin', builtin: true },
    { id: 'meting',  name: 'Meting（api.php）',              kind: 'meting',  builtin: true }
  ];

  function allBackends() {
    return BUILTIN.concat(state.backends);
  }

  function findBackend(id) {
    var list = allBackends();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ==========================================================
     LX 音源宿主：提供 globalThis.lx 的最小实现
     协议面来自 21 个音源脚本的实际用法：
       lx.EVENT_NAMES / lx.on / lx.send / lx.request / lx.version / lx.env
     ========================================================== */
  function makeLxShim(session) {
    return {
      version: LX_VERSION,
      env: 'web',
      EVENT_NAMES: {
        inited: 'inited',
        updateAlert: 'updateAlert',
        request: 'request',
        showConfigView: 'showConfigView',
        configViewReady: 'configViewReady'
      },
      on: function (event, handler) {
        session.handlers[event] = handler;
      },
      send: function (event, data) {
        if (event === 'inited') session.inited = data || null;
      },
      request: function (url, options, cb) {
        hostRequest(url, options || {}).then(function (r) {
          cb(null, r, r.body);
        }, function (err) {
          cb(err || new Error('请求失败'));
        });
      }
    };
  }

  /**
   * 宿主代发 HTTP 请求。
   * 直接 fetch 会受 CORS 限制，所以优先走同源代理 backend.php?types=fetchsrc
   */
  function hostRequest(url, options) {
    var direct = fetch(url, {
      method: (options && options.method) || 'GET',
      headers: (options && options.headers) || {},
      body: (options && options.body) || undefined
    }).then(function (res) {
      return res.text().then(function (t) {
        var body = t;
        try { body = JSON.parse(t); } catch (e) { /* 保留文本 */ }
        return {
          statusCode: res.status,
          headers: (function () {
            var h = {};
            res.headers.forEach(function (v, k) { h[k.toLowerCase()] = v; });
            return h;
          })(),
          body: body
        };
      });
    });

    // 跨域失败时退回同源代理
    return direct.catch(function () {
      return fetch('backend.php?types=fetchsrc&url=' + encodeURIComponent(url), {
        method: 'GET'
      }).then(function (res) {
        // 后端没部署时会拿到 HTML 而不是 JSON，这里先判类型再解析，避免页面报红
        var ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('json') === -1) {
          throw new Error('代理不可用（backend.php 未就绪），该音源需要服务端代理拉取');
        }
        return res.json();
      }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || '代理请求失败');
        var body = j.body;
        try { body = JSON.parse(j.body); } catch (e) { /* 保留文本 */ }
        return { statusCode: j.status, headers: j.headers || {}, body: body };
      });
    });
  }

  /**
   * 加载一个 LX 音源脚本，返回 { handlers, inited, sources, lx }
   */
  function loadLxScript(code) {
    var session = { handlers: {}, inited: null, lx: null };
    session.lx = makeLxShim(session);

    var prev = globalThis.lx;
    globalThis.lx = session.lx;
    try {
      // 间接 eval：在全局作用域执行，与洛雪一致（脚本内 const/let 不会互相覆盖）
      (0, eval)(code);
    } finally {
      if (prev === undefined) {
        try { delete globalThis.lx; } catch (e) { globalThis.lx = undefined; }
      } else {
        globalThis.lx = prev;
      }
    }

    if (typeof session.handlers.request !== 'function') {
      throw new Error('脚本没有注册 request 处理器，可能不是洛雪自定义音源');
    }
    return session;
  }

  /**
   * 调用 LX 音源取播放地址
   */
  function callLx(session, action, source, info) {
    var fn = session.handlers[action] || session.handlers.request;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('音源不支持 ' + action));
    }
    var prev = globalThis.lx;
    globalThis.lx = session.lx;
    try {
      return Promise.resolve(fn({ action: action, source: source, info: info }));
    } catch (e) {
      return Promise.reject(e);
    } finally {
      globalThis.lx = prev;
    }
  }

  /* ==========================================================
     自定义 HTTP 后端
     模板变量：{kw} 关键字 {page} 页码 {count} 条数 {id} 歌曲ID {source} 来源
     ========================================================== */
  function fillTpl(tpl, vars) {
    var out = String(tpl || '');
    for (var k in vars) {
      out = out.split('{' + k + '}').join(encodeURIComponent(vars[k] == null ? '' : vars[k]));
    }
    return out;
  }

  function httpSearch(b, kw, source, page, count) {
    var u = fillTpl(b.searchUrl, { kw: kw, source: source, page: page, count: count });
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      // 允许几种常见形状：数组 / {list:[...]} / {data:[...]} / {songs:[...]}
      var arr = null;
      if (Array.isArray(j)) arr = j;
      else if (j && Array.isArray(j.list)) arr = j.list;
      else if (j && Array.isArray(j.data)) arr = j.data;
      else if (j && Array.isArray(j.songs)) arr = j.songs;
      else if (j && Array.isArray(j.data && j.data.list)) arr = j.data.list;
      if (!arr) return [];
      return arr.map(function (x) {
        return {
          id: String(x.id != null ? x.id : (x.songmid || x.url_id || x.mid || '')),
          name: x.name || x.songname || x.songName || '',
          artist: [].concat(x.artist || x.singer || x.author || []),
          album: x.album || x.albumname || '',
          source: source,
          url_id: String(x.url_id != null ? x.url_id : (x.id != null ? x.id : '')),
          pic_id: x.pic_id || x.pic || x.cover || null,
          lyric_id: String(x.lyric_id != null ? x.lyric_id : (x.id != null ? x.id : ''))
        };
      }).filter(function (x) { return x.id !== '' && x.name !== ''; });
    });
  }

  function httpUrl(b, id, source) {
    var u = fillTpl(b.urlUrl, { id: id, source: source });
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (typeof j === 'string') return j;
      return (j && (j.url || (j.data && j.data.url))) || '';
    });
  }

  /* ==========================================================
     对外：搜索
     ========================================================== */
  function search(kw, source, page, count) {
    var b = findBackend(state.searchId) || BUILTIN[0];
    page = page || 1;
    count = count || 20;

    if (b.kind === 'builtin') {
      return jsonp('backend.php?types=search&name=' + encodeURIComponent(kw) +
                   '&source=' + encodeURIComponent(source) +
                   '&pages=' + page + '&count=' + count);
    }
    if (b.kind === 'meting') {
      return jsonp('api.php?types=search&name=' + encodeURIComponent(kw) +
                   '&source=' + encodeURIComponent(source) +
                   '&pages=' + page + '&count=' + count);
    }
    return httpSearch(b, kw, source, page, count);
  }

  /**
   * JSONP 请求（MKOnlinePlayer 的后端返回 jsonp）
   */
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var name = '__sh_cb_' + Math.random().toString(36).slice(2);
      var s = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('请求超时')); }, 15000);
      function cleanup() {
        clearTimeout(timer);
        delete window[name];
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[name] = function (data) { cleanup(); resolve(data); };
      s.onerror = function () { cleanup(); reject(new Error('请求失败')); };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + name;
      document.body.appendChild(s);
    });
  }

  /* ==========================================================
     对外：取播放地址（按后端链依次尝试）
     ========================================================== */
  function resolveUrl(music, quality) {
    var b = findBackend(state.urlId) || BUILTIN[0];
    quality = quality || '128k';

    if (b.kind === 'lx') {
      return resolveViaLx(b, music, quality).catch(function (e) {
        console.warn('[SourceHub] LX 音源取链接失败，回退内置后端：', e && e.message);
        return builtinUrl(music);
      });
    }
    if (b.kind === 'meting') {
      return jsonp('api.php?types=url&id=' + encodeURIComponent(music.id) +
                   '&source=' + encodeURIComponent(music.source))
        .then(function (j) { return (j && j.url) || ''; })
        .catch(function () { return builtinUrl(music); });
    }
    if (b.kind === 'http') {
      return httpUrl(b, music.id, music.source).catch(function () { return builtinUrl(music); });
    }
    return builtinUrl(music);
  }

  function builtinUrl(music) {
    return jsonp('backend.php?types=url&id=' + encodeURIComponent(music.id) +
                 '&source=' + encodeURIComponent(music.source))
      .then(function (j) { return (j && j.url) || ''; });
  }

  function resolveViaLx(b, music, quality) {
    var s = b.session;
    if (!s) return Promise.reject(new Error('音源未加载'));
    var aliases = LX_ALIAS[music.source] || [music.source];
    var info = {
      musicInfo: {
        id: music.id,
        songmid: music.id,
        songId: music.id,
        musicId: music.id,
        hash: music.id,
        rid: music.id,
        name: music.name,
        singer: music.artist,
        artist: music.artist,
        albumName: music.album,
        album: music.album
      },
      type: quality,
      name: music.name,
      id: music.id
    };

    var i = 0;
    function tryNext() {
      if (i >= aliases.length) return Promise.reject(new Error('音源不支持该来源：' + music.source));
      var src = aliases[i++];
      return callLx(s, 'musicUrl', src, info).then(function (u) {
        if (typeof u === 'string' && /^https?:\/\//.test(u)) return u;
        throw new Error('音源返回的不是链接');
      }).catch(function (e) {
        if (i < aliases.length) return tryNext();
        throw e;
      });
    }
    return tryNext();
  }

  /* ==========================================================
     对外：封面 / 歌词
     ========================================================== */
  function resolvePic(music) {
    var b = findBackend(state.urlId) || BUILTIN[0];
    var base = b.kind === 'meting' ? 'api.php' : 'backend.php';
    return jsonp(base + '?types=pic&id=' + encodeURIComponent(music.pic_id || '') +
                 '&source=' + encodeURIComponent(music.source))
      .then(function (j) { return (j && j.url) || ''; })
      .catch(function () { return ''; });
  }

  function resolveLyric(music) {
    var b = findBackend(state.urlId) || BUILTIN[0];
    var base = b.kind === 'meting' ? 'api.php' : 'backend.php';
    return jsonp(base + '?types=lyric&id=' + encodeURIComponent(music.lyric_id || music.id) +
                 '&source=' + encodeURIComponent(music.source))
      .then(function (j) { return (j && j.lyric) || ''; })
      .catch(function () { return ''; });
  }

  /* ==========================================================
     后端管理
     ========================================================== */
  function addLxBackend(name, code) {
    var session = loadLxScript(code);
    var b = {
      id: uid(),
      name: name || 'LX 音源',
      kind: 'lx',
      code: code,
      sources: Object.keys((session.inited && session.inited.sources) || {}),
      session: session
    };
    state.backends.push(b);
    save();
    return b;
  }

  function addHttpBackend(name, searchUrl, urlUrl) {
    var b = {
      id: uid(),
      name: name || '自定义接口',
      kind: 'http',
      searchUrl: searchUrl || '',
      urlUrl: urlUrl || ''
    };
    state.backends.push(b);
    save();
    return b;
  }

  function removeBackend(id) {
    state.backends = state.backends.filter(function (b) { return b.id !== id; });
    if (state.searchId === id) state.searchId = 'builtin';
    if (state.urlId === id) state.urlId = 'builtin';
    save();
  }

  /**
   * 页面刷新后重新加载所有 LX 音源脚本
   */
  function hydrate() {
    state.backends.forEach(function (b) {
      if (b.kind !== 'lx') return;
      try {
        b.session = loadLxScript(b.code);
        b.sources = Object.keys((b.session.inited && b.session.inited.sources) || {});
      } catch (e) {
        console.warn('[SourceHub] 音源加载失败：' + b.name, e);
        b.error = e.message || String(e);
      }
    });
  }

  /**
   * 测试一个后端是否真的能用
   */
  function testBackend(id) {
    var b = findBackend(id);
    if (!b) return Promise.reject(new Error('后端不存在'));
    var t0 = Date.now();

    if (b.kind === 'lx') {
      if (!b.session) return Promise.reject(new Error('音源未加载'));
      return callLx(b.session, 'musicUrl', 'wy', {
        musicInfo: { id: '186016', songmid: '186016', songId: '186016', name: '晴天', singer: '周杰伦' },
        type: '128k'
      }).then(function (u) {
        return { ok: /^https?:\/\//.test(String(u || '')), ms: Date.now() - t0, detail: String(u).slice(0, 120) };
      });
    }

    var probe = (b.kind === 'meting')
      ? 'api.php?types=search&name=test&source=netease&pages=1&count=5'
      : (b.kind === 'builtin')
        ? 'backend.php?types=search&name=' + encodeURIComponent('周杰伦') + '&source=kuwo&pages=1&count=3'
        : fillTpl(b.searchUrl, { kw: '周杰伦', source: 'kuwo', page: 1, count: 3 });

    if (b.kind === 'http') {
      return fetch(probe).then(function (r) { return r.json(); }).then(function (j) {
        var n = Array.isArray(j) ? j.length : (j && (j.list || j.data || j.songs) || []).length;
        return { ok: n > 0, ms: Date.now() - t0, detail: '返回 ' + n + ' 条' };
      });
    }
    return jsonp(probe).then(function (j) {
      var n = Array.isArray(j) ? j.length : 0;
      return { ok: n > 0, ms: Date.now() - t0, detail: '返回 ' + n + ' 条' };
    });
  }

  /* ==========================================================
     界面
     ========================================================== */
  var CSS = [
    '#sh-btn{position:fixed;right:16px;bottom:16px;z-index:9990;',
    '  display:inline-flex;align-items:center;gap:.45em;padding:.62em 1.05em;',
    '  border-radius:999px;border:1px solid rgba(255,255,255,.18);cursor:pointer;',
    '  background:rgba(18,20,28,.88);color:#e9edf5;font:inherit;font-size:13px;',
    '  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
    '  box-shadow:0 14px 36px -16px rgba(0,0,0,.7);transition:transform .25s cubic-bezier(.22,1,.36,1)}',
    '#sh-btn:hover{transform:translateY(-2px);border-color:rgba(34,211,238,.6)}',
    '#sh-mask{position:fixed;inset:0;z-index:9991;background:rgba(4,6,12,.62);display:none}',
    '#sh-mask.open{display:block}',
    '#sh-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9992;',
    '  width:min(720px,calc(100vw - 32px));max-height:86vh;overflow:auto;display:none;',
    '  border-radius:18px;border:1px solid rgba(255,255,255,.12);',
    '  background:#0e111a;color:#e9edf5;font:14px/1.75 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;',
    '  box-shadow:0 30px 90px -30px rgba(0,0,0,.9);padding:22px 22px 18px}',
    '#sh-modal.open{display:block}',
    '#sh-modal h3{margin:0 0 4px;font-size:17px;font-weight:650}',
    '#sh-modal .sub{margin:0 0 16px;font-size:12.5px;color:rgba(233,237,245,.55)}',
    '#sh-modal .row{margin:0 0 14px}',
    '#sh-modal label{display:block;font-size:12px;letter-spacing:.05em;color:rgba(233,237,245,.5);margin-bottom:5px}',
    '#sh-modal select,#sh-modal input,#sh-modal textarea{',
    '  width:100%;padding:9px 11px;border-radius:9px;box-sizing:border-box;',
    '  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#e9edf5;font:inherit}',
    '#sh-modal textarea{min-height:78px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}',
    '#sh-modal .btn{display:inline-flex;align-items:center;gap:.4em;padding:.55em 1.05em;',
    '  border-radius:999px;cursor:pointer;font:inherit;font-size:13px;',
    '  border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#e9edf5}',
    '#sh-modal .btn:hover{border-color:rgba(34,211,238,.6);background:rgba(34,211,238,.14)}',
    '#sh-modal .btn--primary{background:linear-gradient(135deg,#22d3ee,#3b82f6);border-color:transparent;color:#04121a;font-weight:650}',
    '#sh-modal .btn--sm{padding:.32em .8em;font-size:12px}',
    '#sh-modal .btn--danger:hover{border-color:#fb7185;background:rgba(251,113,133,.16)}',
    '#sh-modal .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}',
    '#sh-modal .tab{padding:.42em 1em;border-radius:999px;cursor:pointer;font-size:12.5px;',
    '  border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(233,237,245,.6)}',
    '#sh-modal .tab.active{background:rgba(34,211,238,.18);border-color:#22d3ee;color:#fff}',
    '#sh-modal .list{list-style:none;margin:0 0 8px;padding:0}',
    '#sh-modal .list li{display:flex;align-items:center;gap:9px;padding:8px 2px;',
    '  border-bottom:1px solid rgba(255,255,255,.07)}',
    '#sh-modal .list li:last-child{border-bottom:0}',
    '#sh-modal .dot{width:7px;height:7px;border-radius:50%;background:#34d399;flex:0 0 auto}',
    '#sh-modal .dot.err{background:#fb7185}',
    '#sh-modal .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#sh-modal .kd{font-size:11px;color:rgba(233,237,245,.45);padding:.1em .55em;',
    '  border:1px solid rgba(255,255,255,.12);border-radius:999px}',
    '#sh-modal .msg{min-height:20px;font-size:12px;color:#34d399;margin-top:6px}',
    '#sh-modal .msg.err{color:#fb7185}',
    '#sh-modal .hint{font-size:11.5px;color:rgba(233,237,245,.42);margin-top:6px;line-height:1.7}',
    '#sh-modal .x{position:absolute;right:16px;top:14px;width:28px;height:28px;border-radius:50%;',
    '  border:1px solid rgba(255,255,255,.14);background:transparent;color:#e9edf5;cursor:pointer}',
    '@media(max-width:640px){#sh-modal{padding:18px 15px 15px}#sh-btn{right:12px;bottom:12px}}'
  ].join('\n');

  var TAB = 'search';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildUI() {
    if (document.getElementById('sh-btn')) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var btn = document.createElement('button');
    btn.id = 'sh-btn';
    btn.type = 'button';
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>接口后端';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    var mask = document.createElement('div');
    mask.id = 'sh-mask';
    mask.addEventListener('click', closeModal);
    document.body.appendChild(mask);

    var modal = document.createElement('div');
    modal.id = 'sh-modal';
    document.body.appendChild(modal);
    renderModal();
  }

  function openModal() {
    document.getElementById('sh-mask').classList.add('open');
    document.getElementById('sh-modal').classList.add('open');
    renderModal();
  }

  function closeModal() {
    document.getElementById('sh-mask').classList.remove('open');
    document.getElementById('sh-modal').classList.remove('open');
  }

  function renderModal() {
    var m = document.getElementById('sh-modal');
    if (!m) return;
    var opts = allBackends().map(function (b) {
      return '<option value="' + esc(b.id) + '"' +
        (b.id === (TAB === 'search' ? state.searchId : state.urlId) ? ' selected' : '') + '>' +
        esc(b.name) + '</option>';
    }).join('');

    var rows = allBackends().map(function (b) {
      var kind = b.kind === 'lx' ? ('LX·' + ((b.sources || []).join('/') || '音源'))
        : b.kind === 'http' ? 'HTTP' : (b.kind === 'meting' ? 'Meting' : '内置');
      return '<li>' +
        '<span class="dot' + (b.error ? ' err' : '') + '"></span>' +
        '<span class="nm">' + esc(b.name) + '</span>' +
        '<span class="kd">' + esc(kind) + '</span>' +
        '<button class="btn btn--sm" data-test="' + esc(b.id) + '">测试</button>' +
        (b.builtin ? '' : '<button class="btn btn--sm btn--danger" data-del="' + esc(b.id) + '">删除</button>') +
        '</li>';
    }).join('');

    m.innerHTML =
      '<button class="x" id="sh-close" aria-label="关闭">✕</button>' +
      '<h3>接口后端</h3>' +
      '<p class="sub">切换搜索 / 取链接走哪套接口；也可以自己加接口（粘贴链接或导入 .js 文件）。</p>' +

      '<div class="tabs">' +
        '<button class="tab' + (TAB === 'search' ? ' active' : '') + '" data-tab="search">搜索后端</button>' +
        '<button class="tab' + (TAB === 'url' ? ' active' : '') + '" data-tab="url">取链接后端</button>' +
        '<button class="tab' + (TAB === 'add' ? ' active' : '') + '" data-tab="add">添加接口</button>' +
      '</div>' +

      (TAB === 'add' ? renderAdd() :
        '<div class="row">' +
          '<label>当前' + (TAB === 'search' ? '搜索' : '取链接') + '后端</label>' +
          '<select id="sh-select">' + opts + '</select>' +
          '<div class="msg" id="sh-msg"></div>' +
        '</div>' +
        '<div class="row"><label>已添加的接口</label><ul class="list">' + rows + '</ul></div>' +
        '<p class="hint">取链接后端选「LX 音源」时，只负责换播放地址；搜索仍走上面的搜索后端。<br>' +
        '各平台对 VIP / 数字专辑曲目不给播放地址，属于平台限制，接口取不到就是取不到。</p>'
      ) +

      (TAB === 'add' ? '' : '<div class="row" style="margin-top:14px"><button class="btn" id="sh-export">导出配置</button> ' +
        '<button class="btn" id="sh-import">导入配置</button></div>');

    bindModal();
  }

  function renderAdd() {
    return '' +
      '<div class="row"><label>名称</label><input id="add-name" placeholder="例如：我的酷我接口"></div>' +
      '<div class="row"><label>类型</label>' +
        '<select id="add-kind">' +
          '<option value="lx">LX 音源脚本（导入 .js 文件，或粘贴脚本内容）</option>' +
          '<option value="http">HTTP 接口（填链接模板）</option>' +
        '</select></div>' +

      '<div id="add-lx">' +
        '<div class="row"><label>导入 .js 文件</label><input type="file" id="add-file" accept=".js,.txt,.json" multiple></div>' +
        '<div class="row"><label>或粘贴脚本内容 / 脚本链接</label>' +
          '<textarea id="add-code" placeholder="把洛雪音源 .js 的内容贴到这里，或者填一个 .js 的 http 链接"></textarea></div>' +
        '<div class="row"><label>或填脚本链接</label>' +
          '<input id="add-url" placeholder="https://example.com/source.js"></div>' +
        '<p class="hint">支持洛雪音乐助手自定义音源格式（globalThis.lx）。<br>' +
          '文件导入只在本机读取，不上传；链接导入会走你自己的服务器代理拉取。</p>' +
      '</div>' +

      '<div id="add-http" style="display:none">' +
        '<div class="row"><label>搜索地址模板</label>' +
          '<input id="add-search" placeholder="https://api.example.com/search?keyword={kw}&page={page}&size={count}"></div>' +
        '<div class="row"><label>取链接地址模板</label>' +
          '<input id="add-urltpl" placeholder="https://api.example.com/url?id={id}&source={source}"></div>' +
        '<p class="hint">模板变量：{kw} 关键字 {page} 页码 {count} 条数 {id} 歌曲ID {source} 来源。<br>' +
          '返回需是 JSON：数组或 {"list":[...]} / {"data":[...]}；取链接返回 {"url":"..."}。</p>' +
      '</div>' +

      '<div class="row"><button class="btn btn--primary" id="add-save">保存并启用</button></div>' +
      '<div class="msg" id="add-msg"></div>';
  }

  function bindModal() {
    var m = document.getElementById('sh-modal');

    var close = m.querySelector('#sh-close');
    if (close) close.addEventListener('click', closeModal);

    Array.prototype.forEach.call(m.querySelectorAll('[data-tab]'), function (t) {
      t.addEventListener('click', function () { TAB = t.dataset.tab; renderModal(); });
    });

    var sel = m.querySelector('#sh-select');
    if (sel) sel.addEventListener('change', function () {
      if (TAB === 'search') state.searchId = sel.value; else state.urlId = sel.value;
      save();
      var msg = m.querySelector('#sh-msg');
      if (msg) { msg.textContent = '已切换'; msg.className = 'msg'; }
    });

    Array.prototype.forEach.call(m.querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () {
        removeBackend(b.dataset.del);
        renderModal();
      });
    });

    Array.prototype.forEach.call(m.querySelectorAll('[data-test]'), function (b) {
      b.addEventListener('click', function () {
        var msg = m.querySelector('#sh-msg');
        if (msg) { msg.textContent = '测试中…'; msg.className = 'msg'; }
        testBackend(b.dataset.test).then(function (r) {
          if (!msg) return;
          msg.textContent = (r.ok ? '正常' : '无结果') + ' · ' + r.ms + 'ms · ' + r.detail;
          msg.className = 'msg' + (r.ok ? '' : ' err');
        }, function (e) {
          if (!msg) return;
          msg.textContent = '失败：' + ((e && e.message) || e);
          msg.className = 'msg err';
        });
      });
    });

    var exp = m.querySelector('#sh-export');
    if (exp) exp.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ backends: state.backends, searchId: state.searchId, urlId: state.urlId }, null, 2)],
        { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sourcehub-config.json';
      a.click();
    });

    var imp = m.querySelector('#sh-import');
    if (imp) imp.addEventListener('click', function () {
      var f = document.createElement('input');
      f.type = 'file';
      f.accept = '.json';
      f.onchange = function () {
        var file = f.files[0];
        if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result);
            if (Array.isArray(d.backends)) {
              d.backends.forEach(function (b) {
                if (!b.id) b.id = uid();
                if (b.kind === 'lx' && b.code) { try { b.session = loadLxScript(b.code); } catch (e) { b.error = e.message; } }
                state.backends.push(b);
              });
            }
            if (d.searchId) state.searchId = d.searchId;
            if (d.urlId) state.urlId = d.urlId;
            save();
            renderModal();
          } catch (e) {
            alert('配置文件解析失败');
          }
        };
        r.readAsText(file);
      };
      f.click();
    });

    // ---- 添加接口 ----
    var kind = m.querySelector('#add-kind');
    if (kind) kind.addEventListener('change', function () {
      m.querySelector('#add-lx').style.display = kind.value === 'lx' ? '' : 'none';
      m.querySelector('#add-http').style.display = kind.value === 'http' ? '' : 'none';
    });

    var file = m.querySelector('#add-file');
    if (file) file.addEventListener('change', function () {
      var names = [];
      Array.prototype.forEach.call(file.files, function (x) { names.push(x.name); });
      var ta = m.querySelector('#add-code');
      if (ta) ta.placeholder = '已选择 ' + file.files.length + ' 个文件：' + names.join('、') + '（点「保存并启用」）';
    });

    var saveBtn = m.querySelector('#add-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var msg = m.querySelector('#add-msg');
      var name = (m.querySelector('#add-name').value || '').trim();
      var msgOk = function (t) { if (msg) { msg.textContent = t; msg.className = 'msg'; } };
      var msgErr = function (t) { if (msg) { msg.textContent = t; msg.className = 'msg err'; } };

      if (kind.value === 'http') {
        var s = m.querySelector('#add-search').value.trim();
        var u = m.querySelector('#add-urltpl').value.trim();
        if (!s && !u) { msgErr('至少填一个地址模板'); return; }
        addHttpBackend(name || '自定义接口', s, u);
        msgOk('已添加');
        return;
      }

      // LX：文件优先，其次粘贴内容，最后 URL
      var files = file.files;
      if (files && files.length) {
        var pending = files.length, added = [];
        Array.prototype.forEach.call(files, function (f) {
          var r = new FileReader();
          r.onload = function () {
            try {
              addLxBackend(name || f.name.replace(/\.[^.]+$/, ''), r.result);
              added.push(f.name);
            } catch (e) {
              msgErr(f.name + ' 加载失败：' + ((e && e.message) || e));
            }
            if (--pending === 0) msgOk('已添加 ' + added.length + ' 个音源');
          };
          r.readAsText(f);
        });
        return;
      }

      var code = (m.querySelector('#add-code').value || '').trim();
      var url = (m.querySelector('#add-url').value || '').trim();
      if (code) {
        try {
          addLxBackend(name || 'LX 音源', code);
          msgOk('已添加');
        } catch (e) {
          msgErr('加载失败：' + ((e && e.message) || e));
        }
        return;
      }
      if (url) {
        msgOk('拉取脚本中…');
        fetch('backend.php?types=fetchsrc&url=' + encodeURIComponent(url))
          .then(function (r) {
            var ct = (r.headers.get('content-type') || '').toLowerCase();
            if (ct.indexOf('json') === -1) {
              throw new Error('代理不可用（backend.php 未就绪）');
            }
            return r.json();
          })
          .then(function (j) {
            if (!j || !j.ok) throw new Error((j && j.error) || '拉取失败');
            addLxBackend(name || 'LX 音源', j.body);
            msgOk('已添加');
          })
          .catch(function (e) { msgErr('拉取失败：' + ((e && e.message) || e)); });
        return;
      }
      msgErr('请选择文件、粘贴脚本内容，或填脚本链接');
    });
  }

  /* ==========================================================
     对 MKOnlinePlayer 的挂钩
     ========================================================== */
  function hookPlayer() {
    if (typeof window.ajaxUrl !== 'function') return false;

    window.__sh_ajaxUrl = window.ajaxUrl;
    window.ajaxUrl = function (music, callback) {
      // 已有链接直接走原逻辑
      if (music.url !== null && music.url !== 'err' && music.url !== '') {
        return window.__sh_ajaxUrl(music, callback);
      }
      if (music.id === null) {
        return window.__sh_ajaxUrl(music, callback);
      }
      resolveUrl(music).then(function (u) {
        music.url = u || 'err';
        if (window.updateMinfo) window.updateMinfo(music);
        callback(music);
      }, function () {
        return window.__sh_ajaxUrl(music, callback);
      });
      return true;
    };

    if (typeof window.ajaxPic === 'function') {
      window.__sh_ajaxPic = window.ajaxPic;
      window.ajaxPic = function (music, callback) {
        if (music.pic !== null && music.pic !== 'err' && music.pic !== '') {
          return window.__sh_ajaxPic(music, callback);
        }
        if (!music.pic_id) return window.__sh_ajaxPic(music, callback);
        resolvePic(music).then(function (u) {
          music.pic = u || 'err';
          if (window.updateMinfo) window.updateMinfo(music);
          callback(music);
        }, function () {
          return window.__sh_ajaxPic(music, callback);
        });
        return true;
      };
    }

    return true;
  }

  /* ==========================================================
     启动
     ========================================================== */
  function init() {
    load();
    hydrate();

    var hooked = hookPlayer();
    if (!hooked) {
      // player.js 可能后加载，轮询一小段时间
      var tries = 0;
      var t = setInterval(function () {
        if (hookPlayer() || ++tries > 40) clearInterval(t);
      }, 200);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildUI);
    } else {
      buildUI();
    }

    console.log('[SourceHub] 已就绪 · 搜索后端=' + state.searchId + ' · 取链接后端=' + state.urlId);
  }

  window.SourceHub = {
    search: search,
    resolveUrl: resolveUrl,
    resolvePic: resolvePic,
    resolveLyric: resolveLyric,
    testBackend: testBackend,
    addLxBackend: addLxBackend,
    addHttpBackend: addHttpBackend,
    removeBackend: removeBackend,
    list: allBackends,
    getState: function () {
      return { searchId: state.searchId, urlId: state.urlId, backends: allBackends() };
    },
    open: openModal
  };

  init();
})();

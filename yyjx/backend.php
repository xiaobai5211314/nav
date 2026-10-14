<?php
/**
 * 内置音乐后端（供「接口后端」面板切换使用）
 *
 * 用途：MKOnlinePlayer 的 search / url / pic / lyric 四个动作。
 * 来源：各平台对外公开接口，2026-09-29 实测可用（酷我 / QQ / 网易云）。
 *
 * 输出：JSONP（MKOnlinePlayer 前端用 dataType:jsonp 调用）
 *   search  -> [ {id,name,artist[],album,source,url_id,pic_id,lyric_id} ]
 *   url     -> { url }
 *   pic     -> { url }
 *   lyric   -> { lyric }
 *
 * 说明：这里的 url 是平台提供的播放地址，用于在线试听。
 *       平台对 VIP / 数字专辑曲目不给地址时返回空串，不做绕过。
 */

header('Content-Type: application/javascript; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');

$CALLBACK = isset($_GET['callback']) ? $_GET['callback'] : 'callback';
// 只放行合法的 JSONP 回调名，防止脚本注入
if (!preg_match('/^[A-Za-z_$][A-Za-z0-9_$.]*$/', $CALLBACK)) {
    $CALLBACK = 'callback';
}

function out($data)
{
    global $CALLBACK;
    echo $CALLBACK . '(' . json_encode($data, JSON_UNESCAPED_UNICODE) . ');';
    exit();
}

/* ---------------------------------------------------------
 * HTTP
 * --------------------------------------------------------- */
function http_get($url, $headers = [], $timeout = 12)
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_ENCODING       => '',
    ]);
    if ($headers) {
        $h = [];
        foreach ($headers as $k => $v) {
            $h[] = $k . ': ' . $v;
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
    }
    $b = curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$c, $b === false ? '' : $b];
}

/* ---------------------------------------------------------
 * 酷我返回的是「单引号 + None/True/False」的伪 JSON
 * 用状态机转成合法 JSON。刻意不用 eval：上游返回是不可信输入。
 * --------------------------------------------------------- */
function fakejson_decode($text)
{
    $text = trim((string) $text);
    if ($text === '') {
        return null;
    }
    $j = json_decode($text, true);
    if ($j !== null) {
        return $j;
    }
    $out = '';
    $n   = strlen($text);
    $ins = false;
    $q   = '';
    $i   = 0;
    while ($i < $n) {
        $c = $text[$i];
        if (!$ins) {
            if ($c === "'" || $c === '"') {
                $out .= '"';
                $ins  = true;
                $q    = $c;
                $i++;
                continue;
            }
            if (ctype_alpha($c)) {
                $j2 = $i;
                while ($j2 < $n && ctype_alpha($text[$j2])) {
                    $j2++;
                }
                $w = substr($text, $i, $j2 - $i);
                // 不能用嵌套三元：PHP 8 起 `a ? b : c ? d : e` 是 Fatal error
                switch ($w) {
                    case 'None':
                    case 'null':
                        $out .= 'null';
                        break;
                    case 'True':
                        $out .= 'true';
                        break;
                    case 'False':
                        $out .= 'false';
                        break;
                    default:
                        $out .= $w;   // 未知标识符原样保留，json_decode 会失败并返回 null
                }
                $i = $j2;
                continue;
            }
            $out .= $c;
            $i++;
            continue;
        }
        if ($c === chr(92)) {              // 转义
            $out .= $c . ($i + 1 < $n ? $text[$i + 1] : '');
            $i   += 2;
            continue;
        }
        if ($c === $q) {
            $out .= '"';
            $ins  = false;
            $q    = '';
            $i++;
            continue;
        }
        if ($c === '"' && $q === "'") {
            $out .= chr(92) . '"';
            $i++;
            continue;
        }
        if ($c === "\n" || $c === "\r" || $c === "\t") {
            $out .= ($c === "\n") ? '\n' : (($c === "\r") ? '\r' : '\t');
            $i++;
            continue;
        }
        $out .= $c;
        $i++;
    }
    $j = json_decode($out, true);
    return $j !== null ? $j : null;
}

function clean_name($s)
{
    $s = html_entity_decode((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $s));
}

/* ---------------------------------------------------------
 * 来源归一：MKOnlinePlayer 的 source 名 → 内部代号
 * --------------------------------------------------------- */
function norm_source($s)
{
    $s = strtolower(trim((string) $s));
    $map = [
        'kuwo' => 'kuwo', 'kw' => 'kuwo', 'kugou' => 'kugou', 'kg' => 'kugou',
        'qq' => 'qq', 'tx' => 'qq', 'tencent' => 'qq',
        'netease' => 'netease', 'wy' => 'netease', '163' => 'netease',
    ];
    return isset($map[$s]) ? $map[$s] : 'kuwo';
}

/* ---------------------------------------------------------
 * 搜索
 * --------------------------------------------------------- */
function search_kuwo($kw, $page, $count)
{
    $url = 'https://search.kuwo.cn/r.s?all=' . rawurlencode($kw)
         . '&ft=music&pn=' . max(0, $page - 1) . '&rn=' . $count
         . '&rformat=json&encoding=utf8&moession=1';
    list($c, $b) = http_get($url);
    if ($c !== 200) {
        return [];
    }
    $d = fakejson_decode($b);
    $list = (is_array($d) && isset($d['abslist']) && is_array($d['abslist'])) ? $d['abslist'] : [];
    $out = [];
    foreach ($list as $row) {
        $rid = isset($row['MUSICRID']) ? $row['MUSICRID'] : '';
        if ($rid === '') {
            continue;
        }
        $singer = isset($row['ARTIST']) ? clean_name($row['ARTIST']) : '';
        $out[] = [
            'id'       => $rid,
            'name'     => clean_name(isset($row['SONGNAME']) ? $row['SONGNAME'] : ''),
            'artist'   => array_values(array_filter([$singer])),
            'album'    => clean_name(isset($row['ALBUM']) ? $row['ALBUM'] : ''),
            'source'   => 'kuwo',
            'url_id'   => $rid,
            'pic_id'   => null,
            'lyric_id' => $rid,
        ];
    }
    return $out;
}

function search_qq($kw, $page, $count)
{
    $url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=' . rawurlencode($kw)
         . '&format=json&p=' . $page . '&n=' . $count;
    list($c, $b) = http_get($url);
    if ($c !== 200) {
        return [];
    }
    $j = json_decode($b, true);
    $list = isset($j['data']['song']['list']) && is_array($j['data']['song']['list']) ? $j['data']['song']['list'] : [];
    $out = [];
    foreach ($list as $row) {
        $mid = isset($row['songmid']) ? $row['songmid'] : '';
        if ($mid === '') {
            continue;
        }
        $sg = [];
        foreach ((array) (isset($row['singer']) ? $row['singer'] : []) as $s) {
            if (isset($s['name'])) {
                $sg[] = $s['name'];
            }
        }
        $albummid = isset($row['albummid']) ? $row['albummid'] : '';
        $out[] = [
            'id'       => $mid,
            'name'     => isset($row['songname']) ? $row['songname'] : '',
            'artist'   => $sg,
            'album'    => isset($row['albumname']) ? $row['albumname'] : '',
            'source'   => 'qq',
            'url_id'   => $mid,
            'pic_id'   => $albummid !== ''
                ? 'https://y.qq.com/music/photo_new/T002R300x300M000' . $albummid . '.jpg'
                : null,
            'lyric_id' => $mid,
        ];
    }
    return $out;
}

function search_netease($kw, $page, $count)
{
    $url = 'https://music.163.com/api/cloudsearch/pc?s=' . rawurlencode($kw)
         . '&type=1&limit=' . $count . '&offset=' . (($page - 1) * $count);
    list($c, $b) = http_get($url, ['Referer' => 'https://music.163.com/']);
    if ($c !== 200) {
        return [];
    }
    $j = json_decode($b, true);
    $list = isset($j['result']['songs']) && is_array($j['result']['songs']) ? $j['result']['songs'] : [];
    $out = [];
    foreach ($list as $row) {
        $ar = [];
        foreach ((array) (isset($row['ar']) ? $row['ar'] : []) as $a) {
            if (isset($a['name'])) {
                $ar[] = $a['name'];
            }
        }
        $out[] = [
            'id'       => (string) (isset($row['id']) ? $row['id'] : ''),
            'name'     => isset($row['name']) ? $row['name'] : '',
            'artist'   => $ar,
            'album'    => isset($row['al']['name']) ? $row['al']['name'] : '',
            'source'   => 'netease',
            'url_id'   => (string) (isset($row['id']) ? $row['id'] : ''),
            'pic_id'   => isset($row['al']['picUrl']) ? $row['al']['picUrl'] : null,
            'lyric_id' => (string) (isset($row['id']) ? $row['id'] : ''),
        ];
    }
    return $out;
}

/* ---------------------------------------------------------
 * 取播放地址 / 封面 / 歌词
 * --------------------------------------------------------- */
function url_kuwo($rid)
{
    if (!preg_match('/^MUSIC_\d+$/', $rid)) {
        return '';
    }
    $u = 'https://antiserver.kuwo.cn/anti.s?format=mp3&rid=' . rawurlencode($rid)
       . '&response=url&type=convert_url3';
    list($c, $b) = http_get($u);
    if ($c !== 200) {
        return '';
    }
    $j = json_decode($b, true);
    return (is_array($j) && !empty($j['url']) && is_string($j['url'])) ? $j['url'] : '';
}

function url_qq($mid)
{
    if (!preg_match('/^[A-Za-z0-9]+$/', $mid)) {
        return '';
    }
    $payload = [
        'req' => [
            'module' => 'vkey.GetVkeyServer',
            'method' => 'CgiGetVkey',
            'param'  => [
                'guid' => '10000', 'songmid' => [$mid], 'songtype' => [0],
                'uin' => '0', 'loginflag' => 1, 'platform' => '20',
            ],
        ],
    ];
    $u = 'https://u.y.qq.com/cgi-bin/musicu.fcg?data='
       . rawurlencode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    list($c, $b) = http_get($u);
    if ($c !== 200) {
        return '';
    }
    $j    = json_decode($b, true);
    $sip  = isset($j['req']['data']['sip']) && is_array($j['req']['data']['sip']) ? $j['req']['data']['sip'] : [];
    $info = isset($j['req']['data']['midurlinfo'][0]) ? $j['req']['data']['midurlinfo'][0] : null;
    if (!$info || empty($info['purl']) || empty($sip)) {
        return '';   // purl 为空 = VIP/无版权，属平台限制
    }
    return $sip[0] . $info['purl'];
}

function url_netease($id)
{
    if (!preg_match('/^\d+$/', $id)) {
        return '';
    }
    $u = 'https://music.163.com/api/song/enhance/player/url?ids=%5B%22' . $id . '%22%5D&br=320000';
    list($c, $b) = http_get($u, ['Referer' => 'https://music.163.com/', 'Cookie' => 'os=pc']);
    if ($c !== 200) {
        return '';
    }
    $j = json_decode($b, true);
    $x = isset($j['data'][0]['url']) ? $j['data'][0]['url'] : null;
    return (is_string($x) && $x !== '') ? $x : '';
}

function lyric_kuwo($rid)
{
    $num = str_replace('MUSIC_', '', (string) $rid);
    if (!preg_match('/^\d+$/', $num)) {
        return '';
    }
    $u = 'https://kuwo.cn/openapi/v1/www/lyric/getlyric?musicId=' . $num;
    list($c, $b) = http_get($u, ['Referer' => 'https://www.kuwo.cn/']);
    if ($c !== 200) {
        return '';
    }
    $j = json_decode($b, true);
    if (!isset($j['data']['lrclist']) || !is_array($j['data']['lrclist'])) {
        return '';
    }
    $lrc = '';
    foreach ($j['data']['lrclist'] as $line) {
        $t   = isset($line['time']) ? (float) $line['time'] : 0;
        $txt = isset($line['lineLyric']) ? $line['lineLyric'] : '';
        $mm  = (int) floor($t / 60);
        $ss  = $t - $mm * 60;
        $lrc .= sprintf('[%02d:%05.2f]%s' . "\n", $mm, $ss, $txt);
    }
    return $lrc;
}

function lyric_netease($id)
{
    if (!preg_match('/^\d+$/', $id)) {
        return '';
    }
    $u = 'https://music.163.com/api/song/lyric?id=' . $id . '&lv=1&kv=1&tv=-1';
    list($c, $b) = http_get($u, ['Referer' => 'https://music.163.com/']);
    if ($c !== 200) {
        return '';
    }
    $j = json_decode($b, true);
    return isset($j['lrc']['lyric']) ? $j['lrc']['lyric'] : '';
}

/* ---------------------------------------------------------
 * 按链接导入音源：服务端代拉（浏览器直接拉会受 CORS 限制）
 *
 * 这是一个「出网代理」，所以必须做 SSRF 防护：
 *   只放行 http/https、拒绝内网/回环/链路本地地址、限制体积与超时。
 * --------------------------------------------------------- */
function is_public_host($host)
{
    $ips = @gethostbynamel($host);
    if (!$ips) {
        return false;
    }
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
            return false;
        }
        // 拒绝私有 / 保留 / 回环 / 链路本地
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return false;
        }
    }
    return true;
}

function fetch_remote_source($url)
{
    header('Content-Type: application/json; charset=utf-8');

    if (!preg_match('#^https?://#i', $url)) {
        echo json_encode(['ok' => false, 'error' => '只支持 http / https 链接']);
        exit();
    }
    $parts = parse_url($url);
    $host  = isset($parts['host']) ? $parts['host'] : '';
    if ($host === '' || !is_public_host($host)) {
        echo json_encode(['ok' => false, 'error' => '目标地址不可达或不是公网地址']);
        exit();
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; SourceHub/1.0)',
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_RANGE          => '0-1048575',   // 最多 1MB
    ]);
    $b = curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($b === false) {
        echo json_encode(['ok' => false, 'error' => '拉取失败：' . $err]);
        exit();
    }
    if ($c >= 400) {
        echo json_encode(['ok' => false, 'error' => '目标返回 HTTP ' . $c]);
        exit();
    }
    if (strlen($b) > 1048576) {
        echo json_encode(['ok' => false, 'error' => '脚本超过 1MB，拒绝导入']);
        exit();
    }

    echo json_encode([
        'ok'     => true,
        'status' => $c,
        'size'   => strlen($b),
        'body'   => $b,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/* ---------------------------------------------------------
 * 路由
 * --------------------------------------------------------- */
$type   = isset($_GET['types']) ? $_GET['types'] : '';
$source = norm_source(isset($_GET['source']) ? $_GET['source'] : 'kuwo');
$id     = isset($_GET['id']) ? trim($_GET['id']) : '';

// 这个动作返回 JSON，不用 JSONP 包裹
if ($type === 'fetchsrc') {
    fetch_remote_source(isset($_GET['url']) ? $_GET['url'] : '');
}

switch ($type) {
    case 'search':
        $kw    = isset($_GET['name']) ? trim($_GET['name']) : '';
        $page  = max(1, (int) (isset($_GET['pages']) ? $_GET['pages'] : 1));
        $count = min(50, max(5, (int) (isset($_GET['count']) ? $_GET['count'] : 20)));
        if ($kw === '') {
            out([]);
        }
        switch ($source) {
            case 'qq':
                out(search_qq($kw, $page, $count));
            case 'netease':
                out(search_netease($kw, $page, $count));
            default:
                out(search_kuwo($kw, $page, $count));
        }

    case 'url':
        $u = '';
        switch ($source) {
            case 'qq':
                $u = url_qq($id);
                break;
            case 'netease':
                $u = url_netease($id);
                break;
            default:
                $u = url_kuwo($id);
        }
        out(['url' => $u]);

    case 'pic':
        // pic_id 里直接存了封面地址，这里原样回传，省一次请求
        out(['url' => $id]);

    case 'lyric':
        $l = '';
        switch ($source) {
            case 'netease':
                $l = lyric_netease($id);
                break;
            default:
                $l = lyric_kuwo($id);
        }
        out(['lyric' => $l]);

    default:
        // userlist / playlist 是 Meting 专有的，这里返回空结构避免前端报错
        out([]);
}

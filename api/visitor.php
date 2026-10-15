<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');

// 1. 获取访客真实 IP (穿透 CDN / 代理头)
$ip = '';
$headers = [
    'HTTP_CF_CONNECTING_IP',
    'HTTP_X_REAL_IP',
    'HTTP_CLIENT_IP',
    'HTTP_X_FORWARDED_FOR',
    'REMOTE_ADDR'
];

foreach ($headers as $h) {
    if (!empty($_SERVER[$h])) {
        $ipList = explode(',', $_SERVER[$h]);
        foreach ($ipList as $candidate) {
            $candidate = trim($candidate);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                $ip = $candidate;
                break 2;
            }
        }
    }
}

if (!$ip) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

$location = '华夏大地';

// 2. 本地离线高性能 IP2Region 引擎 (毫秒级零延迟、不依赖任何外部接口)
$xdbPaths = [
    __DIR__ . '/ip2region/ip2region.xdb',
    '/www/wwwroot/a.21212121.xyz/api/ip2region/ip2region.xdb',
    '/www/wwwroot/tuchuang.21212121.xyz/app/ip2region/ip2region.xdb'
];

$xdbFile = null;
foreach ($xdbPaths as $p) {
    if (file_exists($p)) {
        $xdbFile = $p;
        break;
    }
}

if ($xdbFile && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    try {
        if (!class_exists('Ip2Region')) {
            $wrapper = __DIR__ . '/ip2region/Ip2Region.php';
            if (file_exists($wrapper)) {
                require_once $wrapper;
            } elseif (file_exists('/www/wwwroot/tuchuang.21212121.xyz/app/ip2region/Ip2Region.php')) {
                require_once '/www/wwwroot/tuchuang.21212121.xyz/app/ip2region/Ip2Region.php';
            }
        }
        if (class_exists('Ip2Region')) {
            $ip2 = new \Ip2Region();
            $res = $ip2->memorySearch($ip);
            if (!empty($res['region'])) {
                $rawParts = explode('|', $res['region']);
                $clean = [];
                foreach ($rawParts as $part) {
                    if ($part !== '0' && $part !== '') {
                        $clean[] = $part;
                    }
                }
                if (!empty($clean)) {
                    if ($clean[0] === '中国') {
                        array_shift($clean);
                        // 去重直辖市 (如 上海 上海市)
                        if (count($clean) >= 2 && strpos($clean[1], $clean[0]) !== false) {
                            array_shift($clean);
                        }
                    }
                    $location = implode(' ', $clean);
                }
            }
        }
    } catch (\Throwable $e) {}
}

// 3. IPv6 识别处理
if ($location === '华夏大地' && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
    $lowerIp = strtolower($ip);
    if (strpos($lowerIp, '240e:') === 0) {
        $location = '中国电信 IPv6';
    } elseif (strpos($lowerIp, '2408:') === 0) {
        $location = '中国联通 IPv6';
    } elseif (strpos($lowerIp, '2409:') === 0) {
        $location = '中国移动 IPv6';
    } elseif (strpos($lowerIp, '2001:da8:') === 0) {
        $location = '中国教育网 CERNET IPv6';
    } else {
        // 轻量在线查询 IPv6
        try {
            $ctx = stream_context_create([
                'http' => ['timeout' => 1.2, 'header' => "User-Agent: Mozilla/5.0\r\n"]
            ]);
            $raw = @file_get_contents("https://ipwho.is/" . urlencode($ip) . "?lang=zh-CN", false, $ctx);
            if ($raw) {
                $d = json_decode($raw, true);
                if (!empty($d['success'])) {
                    $parts = array_filter([$d['country'] ?? '', $d['region'] ?? '', $d['city'] ?? '']);
                    if (!empty($parts)) {
                        $location = implode(' ', $parts);
                    }
                }
            }
        } catch (\Throwable $e) {}
    }
}

// 4. 服务端高可用公网 IP 归属地兜底查询 (避免落入未知)
if ($location === '华夏大地' && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    try {
        $ctx = stream_context_create([
            'http' => ['timeout' => 1.5, 'header' => "User-Agent: Mozilla/5.0\r\n"]
        ]);
        $rawPc = @file_get_contents("https://whois.pconline.com.cn/ipJson.jsp?json=true&ip=" . urlencode($ip), false, $ctx);
        if ($rawPc) {
            $rawPc = iconv('GBK', 'UTF-8//IGNORE', $rawPc) ?: $rawPc;
            $dPc = json_decode($rawPc, true);
            if (!empty($dPc['addr'])) {
                $location = trim($dPc['addr']);
            } elseif (!empty($dPc['pro']) || !empty($dPc['city'])) {
                $location = trim(($dPc['pro'] ?? '') . ' ' . ($dPc['city'] ?? ''));
            }
        }
    } catch (\Throwable $e) {}
}

// 5. 内网环境标识
if (!$location || $location === '0' || strpos($location, '内网IP') !== false) {
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        $location = '局域网';
    } else {
        $location = '中国';
    }
}

echo json_encode([
    'code' => 200,
    'ip' => $ip,
    'location' => $location,
    'time' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);

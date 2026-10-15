<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');

// 获取客户端访客真实 IP
$ip = '';
$headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
foreach ($headers as $h) {
    if (!empty($_SERVER[$h])) {
        $ipList = explode(',', $_SERVER[$h]);
        $candidate = trim($ipList[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
            break;
        }
    }
}
if (!$ip) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

$location = '华夏大地';

// 1. 优先通过百度 OpenData 权威接口解析（国内毫秒级响应，支持精确到市县及运营商）
try {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 2.0,
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n"
        ]
    ]);
    $raw = @file_get_contents("https://opendata.baidu.com/api.php?query=" . urlencode($ip) . "&co=&resource_id=6006&oe=utf8", false, $ctx);
    if ($raw) {
        $data = json_decode($raw, true);
        if (!empty($data['data'][0]['location'])) {
            $location = trim($data['data'][0]['location']);
        }
    }
} catch (\Throwable $e) {}

// 2. 备用国外 IP / 失败降级查询 (ip-api.com)
if ($location === '华夏大地') {
    try {
        $raw = @file_get_contents("http://ip-api.com/json/" . urlencode($ip) . "?lang=zh-CN", false, $ctx);
        if ($raw) {
            $data = json_decode($raw, true);
            if (!empty($data['status']) && $data['status'] === 'success') {
                $parts = array_filter([$data['country'] ?? '', $data['regionName'] ?? '', $data['city'] ?? '']);
                if (!empty($parts)) {
                    $location = implode(' ', $parts);
                }
            }
        }
    } catch (\Throwable $e) {}
}

echo json_encode([
    'code' => 200,
    'ip' => $ip,
    'location' => $location ?: '中国',
    'time' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);

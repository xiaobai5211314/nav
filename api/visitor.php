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

// 查询地理位置 (轻量免费公共接口，带超时保护)
try {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 1.5,
            'header' => "User-Agent: Mozilla/5.0\r\n"
        ]
    ]);
    // 太平洋电脑网免费 IP 归属接口 (国内极速)
    $raw = @file_get_contents("http://whois.pconline.com.cn/ipJson.jsp?ip={$ip}&json=true", false, $ctx);
    if ($raw) {
        $utf8Json = iconv('GBK', 'UTF-8//IGNORE', $raw);
        $data = json_decode($utf8Json, true);
        if (!empty($data['addr'])) {
            $location = trim($data['addr']);
        } elseif (!empty($data['pro'])) {
            $location = trim($data['pro'] . ' ' . ($data['city'] ?? ''));
        }
    }
} catch (\Throwable $e) {}

echo json_encode([
    'code' => 200,
    'ip' => $ip,
    'location' => $location ?: '中国',
    'time' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);

 <?php
    // 存储数据的文件
    $filename = 'data.dat';        
     
    // 指定页面编码
    header('Content-type: text/html; charset=utf-8');
     
    if(!file_exists($filename)) {
        die($filename . ' 数据文件不存在');
    }
     
    // 读取整个数据文件
    $data = file_get_contents($filename);
     
    // 按换行符分割成数组
    $data = explode(PHP_EOL, $data);
     
    // 随机获取一行索引
    $result = $data[array_rand($data)];
     
    // 去除多余的换行符（保险起见）
    $result = str_replace(array("\r","\n","\r\n"), '', $result);
    if (isset($_GET['format']) && $_GET['format'] === 'json') {
        header('Content-type: application/json; charset=utf-8');
        echo json_encode(['code' => 200, 'data' => $result], JSON_UNESCAPED_UNICODE);
    } else {
        echo 'document.write("'.htmlspecialchars($result, ENT_QUOTES, 'UTF-8').'");';
    }
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0">
    <meta name="renderer" content="webkit">
    <meta name="author" content="mengkun">
    <meta name="generator" content="KodCloud">
    <meta http-equiv="Cache-Control" content="no-siteapp">
    
    <!-- 强制移动设备以app模式打开页面(即在移动设备下全屏，仅支持部分浏览器) -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-touch-fullscreen" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="full-screen" content="yes"><!--UC强制全屏-->
    <meta name="browsermode" content="application"><!--UC应用模式-->
    <meta name="x5-fullscreen" content="true"><!--QQ强制全屏-->
    <meta name="x5-page-mode" content="app"><!--QQ应用模式-->
    
    <title>小白在线音乐播放器</title>
    <meta name="description" content="小白在线音乐播放器，基于网易云音乐API的现代化在线音乐随身听。"/>
    <meta name="keywords" content="小白在线音乐,在线音乐播放器,MKOnlinePlayer,网易云音乐,全景空间"/>
    
    <!-- 不支持IE8及以下版本浏览器 -->
    <!--[if lte IE 8]>
        <script>window.location.href="plugns/killie/"</script>
    <![endif]--> 
  
    <!-- favicon图标 -->
    <link rel="shortcut icon" href="favicon.ico">
    
    <!-- jQuery文件 -->
    <script src="js/jquery.min.js"></script>
    
    <!-- 样式文件 -->
    <link rel="stylesheet" type="text/css" href="static/css/leeleo.css">
    <link rel="stylesheet" type="text/css" href="static/css/jquery.mcustomscrollbar.min.css">
    <link rel="stylesheet" href="static/css/layer.css" id="layuicss-skinlayercss">
    <style>
    .back-home-float {
        position: fixed;
        top: 10px;
        right: 15px;
        z-index: 999999;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: rgba(18, 24, 38, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        color: #fff;
        text-decoration: none;
        font-size: 11px;
    }
    .back-blog-float {
        position: fixed;
        top: 15px;
        left: 80px;
        z-index: 999999;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        background: rgba(18, 24, 38, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        color: #93c5fd;
        text-decoration: none;
        font-size: 11px;
    }
    </style>
</head>
<body>
<a href="../" class="back-home-float" title="返回全景工作台">⌂ 主站</a>
<a href="https://21212121.xyz" target="_blank" rel="noopener" class="back-blog-float" title="访问岁月静好主博客">✎ 博客</a>
<!-- 中间主体区域 -->
<div class="center">
    <div class="container">
        <!--头部导航 -->
        <nav class="leo-mnav-head"> 
            <font class="leo-font" style="margin:8px 15px 0px 15px;" >Music</font>
            <a class="leo-small-r" href="https://21212121.xyz" target="_blank" rel="noopener" title="岁月静好博客" style="color:#94a3b8;font-size:12px;margin-right:15px;text-decoration:none;">
                <span class="iconfont">博客</span>
            </a>
        </nav>
        <div class="btn-bar"> 
            <!-- tab按钮区 -->
            <div class="btn-box" id="btn-area">
                <span class="btn" data-action="player" hidden>播放器</span>
                <span class="btn" data-action="playing" title="正在播放列表">正在播放</span>
                <span class="btn" data-action="sheet" title="音乐播放列表">播放列表</span>
                <span class="btn" data-action="search" title="点击搜索音乐">歌曲搜索</span>
            </div>
        </div>  <!--class="btn-bar"-->
        
        <div class="data-area">
            <!--歌曲歌单-->
            <div id="sheet" class="data-box" hidden></div>
            
            <!--音乐播放列表-->
            <div id="main-list" class="music-list data-box"></div>
        </div>  <!--class="data-area"-->
        
        <!-- 右侧封面及歌词展示 -->
        <div class="player" id="player">
            <!--歌曲封面-->
            <div class="cover">
                <img src="images/player_cover.png" class="music-cover" id="music-cover">
            </div>
            <!--滚动歌词-->
            <div class="lyric">
                <ul id="lyric"></ul>
            </div>
            <div id="music-info" title="点击查看歌曲信息"></div>
        </div>
    </div>  <!--class="container"-->
</div>  <!--class="center"-->

<!-- 播放器底部区域 -->
<div class="footer">
    <div class="container">
        <div class="con-btn">
            <a href="javascript:;" class="player-btn btn-prev" title="上一首"></a>
            <a href="javascript:;" class="player-btn btn-play" title="暂停/继续"></a>
            <a href="javascript:;" class="player-btn btn-next" title="下一首"></a>
			<a href="javascript:;" class="player-btn btn-order" title="循环控制"></a>
        </div>  <!--class="con-btn"-->
        
        <div class="vol">
            <div class="quiet">
                <a href="javascript:;" class="player-btn btn-quiet" title="静音"></a>
            </div>
            <div class="volume">
                <div class="volume-box">  
                    <div id="volume-progress" class="mkpgb-area"></div>
                </div>
            </div>
        </div>  <!--class="footer"-->
        
        <div class="progress">
            <div class="progress-box">  
                <div id="music-progress" class="mkpgb-area"></div>
            </div>
        </div>  <!--class="progress"-->
    </div>  <!--class="container"-->
</div>  <!--class="footer"-->

<!-- layer弹窗插件 -->
<script src="plugns/layer/layer.js"></script>

<!-- 播放器数据加载模块 -->
<script src="static/js/ajax.js"></script>

<!-- 音源后端中心：切换 / 添加接口（链接或导入 .js 文件） -->
<script src="static/js/sourcehub.js"></script>

<!-- 播放器歌词解析模块 -->
<script src="static/js/lyric.js"></script>

<!-- 音乐列表配置 -->
<script src="static/js/musicList.js"></script>

<!-- 封装函数及ui交互模块 -->
<script src="static/js/functions.js"></script>

<!-- 播放器主体功能模块 -->
<script src="static/js/player.js"></script>

<!-- 滚动条美化插件 -->
<script src="static/js/jquery.mCustomScrollbar.concat.min.js"></script>

<!-- 背景模糊化插件 -->
<script src="static/js/background-blur.min.js"></script>

</body>
</html>
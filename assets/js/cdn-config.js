/**
 * 又拍云 CDN 资产加速与自适应调度引擎 (Upyun CDN Engine)
 * 绑定域名: https://guzhicdn.21212121.xyz
 * 机制：优先从又拍云高性能边缘节点获取大型静态资产；
 * 若检测到离线/加载失败，自动平滑 fallback 到本地相对路径，保证 100% 可用性。
 */
window.AppCDN = {
    // 又拍云存储加速域名与独立隔离分类目录
    host: 'https://tc1.21212121.xyz',
    basePath: 'asite',
    
    // 判定是否启用 CDN
    enabled: !window.location.search.includes('nocdn=1') && window.location.protocol.startsWith('http'),

    // 智能资源寻址
    resolve: function(path) {
        if (!this.enabled || !path) return path;
        // 如果是外部完整链接直接返回
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        var cleanPath = path.replace(/^\.?\/?/, '');
        var prefix = this.basePath ? (this.basePath.replace(/^\/|\/$/g, '') + '/') : '';
        return this.host + '/' + prefix + cleanPath;
    },

    // 动态加载 JS 脚本并支持本地 Fallback
    loadScript: function(cdnPath, localPath, callback) {
        var s = document.createElement('script');
        s.src = this.resolve(cdnPath);
        s.onload = function() {
            if (callback) callback(true);
        };
        s.onerror = function() {
            console.warn('[AppCDN] 加载 CDN 失败，正在降级使用本地源:', cdnPath);
            var fallbackScript = document.createElement('script');
            fallbackScript.src = localPath || cdnPath;
            if (callback) fallbackScript.onload = function() { callback(false); };
            document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(s);
    }
};

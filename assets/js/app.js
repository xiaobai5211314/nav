/**
 * 小白个人全景空间 · 核心应用中枢 (Claude Code UI 架构)
 * 纯粹、敏捷、无死锁：支持分类筛选、舔狗日记、落樱粒子、背景乐随身听、模态弹窗与复制
 */
(function() {
    'use strict';

    // 1. 全局配置与状态
    var State = {
        sakuraActive: true,
        bgmPlaying: false,
        loveStartTime: new Date(2019, 4, 20, 20, 20, 0), // 2019-05-20 20:20:00 (月份 0 索引)
        quotes: window.TG_QUOTES || [],
        currentQuote: ''
    };

    // 2. DOM 元素缓存
    var DOM = {
        clockTime: document.getElementById('clock-time'),
        clockDate: document.getElementById('clock-date'),
        loveDaysDisplay: document.getElementById('love-days-display'),
        btnSakura: document.getElementById('btn-sakura'),
        btnBgm: document.getElementById('btn-bgm'),
        bgmAudio: document.getElementById('bgm-audio'),
        quoteText: document.getElementById('quote-text'),
        quoteDate: document.getElementById('quote-date'),
        btnRefreshQuote: document.getElementById('btn-refresh-quote'),
        btnCopyQuote: document.getElementById('btn-copy-quote'),
        sakuraCanvas: document.getElementById('sakura-canvas'),
        toast: document.getElementById('toast-msg'),
        filterTabs: document.querySelectorAll('.filter-tab'),
        cards: document.querySelectorAll('.claude-card')
    };

    // 3. 分类过滤引擎
    function initCategoryFilter() {
        DOM.filterTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var filter = tab.getAttribute('data-filter');

                // 切换激活按钮态
                DOM.filterTabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');

                // 筛选卡片显示
                DOM.cards.forEach(function(card) {
                    var categories = (card.getAttribute('data-category') || '').split(' ');
                    if (filter === 'all' || categories.indexOf(filter) !== -1) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // 4. 实时时钟与相恋计时
    function updateClockAndLoveTime() {
        var now = new Date();

        if (DOM.clockTime) {
            var h = String(now.getHours()).padStart(2, '0');
            var m = String(now.getMinutes()).padStart(2, '0');
            var s = String(now.getSeconds()).padStart(2, '0');
            DOM.clockTime.textContent = h + ':' + m + ':' + s;
        }

        if (DOM.clockDate) {
            var year = now.getFullYear();
            var month = String(now.getMonth() + 1).padStart(2, '0');
            var date = String(now.getDate()).padStart(2, '0');
            DOM.clockDate.textContent = year + '年' + month + '月' + date + '日';
        }

        if (DOM.loveDaysDisplay) {
            var diffMs = now.getTime() - State.loveStartTime.getTime();
            var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            DOM.loveDaysDisplay.textContent = diffDays + ' 天';
        }
    }

    // 5. 今日日记心绪 (舔狗日记) 引擎
    function getRandomQuote() {
        if (!State.quotes || State.quotes.length === 0) {
            return "一个人习惯了，也就不知道寂寞是什么了。愿你历经千帆，归来仍是少年。";
        }
        var idx = Math.floor(Math.random() * State.quotes.length);
        return State.quotes[idx];
    }

    function renderQuote() {
        State.currentQuote = getRandomQuote();
        if (DOM.quoteText) {
            DOM.quoteText.textContent = State.currentQuote;
        }
        if (DOM.quoteDate) {
            var now = new Date();
            var y = now.getFullYear();
            var m = String(now.getMonth() + 1).padStart(2, '0');
            var d = String(now.getDate()).padStart(2, '0');
            DOM.quoteDate.textContent = y + '年' + m + '月' + d + '日';
        }
    }

    function initQuotesEngine() {
        renderQuote();

        if (DOM.btnRefreshQuote) {
            DOM.btnRefreshQuote.addEventListener('click', function() {
                renderQuote();
                window.showToast('🎲 已更新一篇心绪日记');
            });
        }

        if (DOM.btnCopyQuote) {
            DOM.btnCopyQuote.addEventListener('click', function() {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(State.currentQuote).then(function() {
                        window.showToast('📋 已复制日记到剪贴板 ✨');
                    }).catch(function() {
                        fallbackCopy(State.currentQuote);
                    });
                } else {
                    fallbackCopy(State.currentQuote);
                }
            });
        }
    }

    function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            window.showToast('📋 已成功复制 ✨');
        } catch (e) {
            window.showToast('复制失败，请手动选择复制');
        }
        document.body.removeChild(textarea);
    }

    // 6. 背景音频控制器
    function initMusicController() {
        if (!DOM.btnBgm || !DOM.bgmAudio) return;

        DOM.btnBgm.addEventListener('click', function() {
            if (State.bgmPlaying) {
                DOM.bgmAudio.pause();
                State.bgmPlaying = false;
                DOM.btnBgm.classList.remove('active');
                window.showToast('已暂停背景音乐');
            } else {
                DOM.bgmAudio.play().then(function() {
                    State.bgmPlaying = true;
                    DOM.btnBgm.classList.add('active');
                    window.showToast('🎵 正在播放浪漫背景音 (520.mp3)');
                }).catch(function() {
                    window.showToast('请与页面交互后点击播放');
                });
            }
        });
    }

    // 7. 樱花粒子动画
    function initSakuraParticles() {
        var canvas = DOM.sakuraCanvas;
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var petals = [];
        var count = 30;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        function Petal() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height - canvas.height;
            this.size = Math.random() * 8 + 6;
            this.speedX = Math.random() * 1.2 - 0.6;
            this.speedY = Math.random() * 1.0 + 0.7;
            this.rotation = Math.random() * 360;
            this.rotSpeed = Math.random() * 1 - 0.5;
            this.opacity = Math.random() * 0.4 + 0.3;
        }

        for (var i = 0; i < count; i++) {
            petals.push(new Petal());
        }

        function drawPetal(p) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = 'rgba(244, 63, 94, ' + p.opacity + ')';
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function animate() {
            if (!State.sakuraActive) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            petals.forEach(function(p) {
                p.x += p.speedX;
                p.y += p.speedY;
                p.rotation += p.rotSpeed;
                if (p.y > canvas.height) {
                    p.y = -10;
                    p.x = Math.random() * canvas.width;
                }
                drawPetal(p);
            });
            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);

        if (DOM.btnSakura) {
            DOM.btnSakura.addEventListener('click', function() {
                State.sakuraActive = !State.sakuraActive;
                if (State.sakuraActive) {
                    canvas.style.opacity = '0.55';
                    DOM.btnSakura.classList.add('active');
                    window.showToast('🌸 已开启落樱浪漫特效');
                    requestAnimationFrame(animate);
                } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.style.opacity = '0';
                    DOM.btnSakura.classList.remove('active');
                    window.showToast('已关闭落樱特效');
                }
            });
        }
    }

    // 8. 模态弹窗与 Toast
    window.openModal = function(id) {
        var m = document.getElementById(id);
        if (m) m.classList.add('active');
    };

    window.closeModal = function(id) {
        var m = document.getElementById(id);
        if (m) {
            m.classList.remove('active');
            var vids = m.querySelectorAll('video');
            vids.forEach(function(v) { v.pause(); });
        }
    };

    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                window.closeModal(overlay.id);
            }
        });
    });

    window.showToast = function(msg) {
        if (!DOM.toast) return;
        DOM.toast.textContent = msg;
        DOM.toast.classList.add('show');
        setTimeout(function() {
            DOM.toast.classList.remove('show');
        }, 2200);
    };

    // 9. 启动初始化
    function init() {
        initCategoryFilter();
        setInterval(updateClockAndLoveTime, 1000);
        updateClockAndLoveTime();
        initQuotesEngine();
        initMusicController();
        initSakuraParticles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

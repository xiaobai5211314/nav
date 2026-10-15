/**
 * 小白个人全景空间 · 核心应用中枢 (Claude Design UI 架构)
 * 纯粹、敏捷、无死锁：支持亮暗主题切换、分类筛选、日记心绪、落樱粒子、背景乐随身听、模态弹窗与剪贴板
 */
(function() {
    'use strict';

    // 1. 全局配置与状态
    var State = {
        theme: localStorage.getItem('claude-theme') || 'dark', // 默认暗色或遵循历史设定
        sakuraActive: true,
        bgmPlaying: false,
        loveStartTime: new Date(2019, 4, 20, 20, 20, 0), // 2019-05-20 20:20:00 (5月为索引4)
        quotes: window.TG_QUOTES || [],
        currentQuote: ''
    };

    // 2. DOM 元素缓存
    var DOM = {
        html: document.documentElement,
        btnTheme: document.getElementById('btn-theme'),
        clockTime: document.getElementById('clock-time'),
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
        filterTabs: document.querySelectorAll('.filter-tab-btn'),
        cards: document.querySelectorAll('.claude-card')
    };

    // 3. 亮色 / 暗色主题引擎
    function applyTheme(theme) {
        State.theme = theme;
        if (theme === 'dark') {
            DOM.html.setAttribute('data-theme', 'dark');
        } else {
            DOM.html.removeAttribute('data-theme');
        }
        localStorage.setItem('claude-theme', theme);
    }

    function initThemeEngine() {
        applyTheme(State.theme);

        if (DOM.btnTheme) {
            DOM.btnTheme.addEventListener('click', function() {
                var nextTheme = State.theme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
                window.showToast(nextTheme === 'dark' ? '已切换至 Claude 深炭暖黑' : '已切换至 Claude 羊皮纸暖白');
            });
        }
    }

    // 4. 分类过滤引擎
    function initCategoryFilter() {
        if (!DOM.filterTabs || DOM.filterTabs.length === 0) return;

        DOM.filterTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var filter = tab.getAttribute('data-filter');

                DOM.filterTabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');

                DOM.cards.forEach(function(card) {
                    var categories = (card.getAttribute('data-category') || '').split(' ');
                    if (filter === 'all' || categories.indexOf(filter) !== -1) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // 5. 实时时钟与相恋计时
    function updateClockAndLoveTime() {
        var now = new Date();

        if (DOM.clockTime) {
            var h = String(now.getHours()).padStart(2, '0');
            var m = String(now.getMinutes()).padStart(2, '0');
            var s = String(now.getSeconds()).padStart(2, '0');
            DOM.clockTime.textContent = h + ':' + m + ':' + s;
        }

        if (DOM.loveDaysDisplay) {
            var diffMs = now.getTime() - State.loveStartTime.getTime();
            var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            DOM.loveDaysDisplay.textContent = '相守 ' + diffDays + ' 天';
        }
    }

    // 6. 今日心绪拾遗引擎
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
                window.showToast('已更新一篇心绪日记');
            });
        }

        if (DOM.btnCopyQuote) {
            DOM.btnCopyQuote.addEventListener('click', function() {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(State.currentQuote).then(function() {
                        window.showToast('已复制日记到剪贴板');
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
            window.showToast('已复制到剪贴板');
        } catch (e) {
            window.showToast('复制失败，请手动选择复制');
        }
        document.body.removeChild(textarea);
    }

    // 7. 背景音频控制器
    function initMusicController() {
        if (!DOM.btnBgm || !DOM.bgmAudio) return;

        DOM.btnBgm.addEventListener('click', function() {
            if (State.bgmPlaying) {
                DOM.bgmAudio.pause();
                State.bgmPlaying = false;
                DOM.btnBgm.classList.remove('active');
                DOM.btnBgm.setAttribute('title', '播放背景音乐');
                window.showToast('背景音乐已暂停');
            } else {
                DOM.bgmAudio.play().then(function() {
                    State.bgmPlaying = true;
                    DOM.btnBgm.classList.add('active');
                    DOM.btnBgm.setAttribute('title', '暂停背景音乐');
                    window.showToast('正在播放《520》');
                }).catch(function() {
                    window.showToast('播放失败，可能需要先与页面交互');
                });
            }
        });
    }

    // 8. 自然落樱微动效引擎
    function initSakuraCanvas() {
        if (!DOM.sakuraCanvas) return;
        var canvas = DOM.sakuraCanvas;
        var ctx = canvas.getContext('2d');
        var width = canvas.width = window.innerWidth;
        var height = canvas.height = window.innerHeight;

        window.addEventListener('resize', function() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        var petals = [];
        var totalPetals = Math.min(32, Math.floor(width / 35));

        function Petal() {
            this.x = Math.random() * width;
            this.y = Math.random() * height - height;
            this.r = 3 + Math.random() * 4;
            this.vx = 0.5 + Math.random() * 0.8;
            this.vy = 0.8 + Math.random() * 1.2;
            this.rot = Math.random() * 360;
            this.vrot = (Math.random() - 0.5) * 1.5;
            this.alpha = 0.25 + Math.random() * 0.35;
        }

        Petal.prototype.update = function() {
            this.x += this.vx;
            this.y += this.vy;
            this.rot += this.vrot;

            if (this.y > height + 20) {
                this.y = -20;
                this.x = Math.random() * width;
            }
            if (this.x > width + 20) {
                this.x = -20;
            }
        };

        Petal.prototype.draw = function() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate((this.rot * Math.PI) / 180);
            ctx.fillStyle = State.theme === 'dark' 
                ? 'rgba(235, 175, 185, ' + this.alpha + ')' 
                : 'rgba(215, 140, 155, ' + (this.alpha * 0.8) + ')';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(this.r, -this.r, this.r * 2, this.r, 0, this.r * 2);
            ctx.bezierCurveTo(-this.r * 2, this.r, -this.r, -this.r, 0, 0);
            ctx.fill();
            ctx.restore();
        };

        for (var i = 0; i < totalPetals; i++) {
            petals.push(new Petal());
        }

        var animId = null;
        function loop() {
            if (!State.sakuraActive) {
                ctx.clearRect(0, 0, width, height);
                return;
            }
            ctx.clearRect(0, 0, width, height);
            for (var j = 0; j < petals.length; j++) {
                petals[j].update();
                petals[j].draw();
            }
            animId = requestAnimationFrame(loop);
        }
        loop();

        if (DOM.btnSakura) {
            DOM.btnSakura.addEventListener('click', function() {
                State.sakuraActive = !State.sakuraActive;
                if (State.sakuraActive) {
                    DOM.btnSakura.classList.add('active');
                    canvas.style.display = 'block';
                    loop();
                    window.showToast('已开启落樱特效');
                } else {
                    DOM.btnSakura.classList.remove('active');
                    canvas.style.display = 'none';
                    if (animId) cancelAnimationFrame(animId);
                    window.showToast('已关闭落樱特效');
                }
            });
        }
    }

    // 9. 全局通用 Toast 轻提示
    var toastTimer = null;
    window.showToast = function(msg) {
        if (!DOM.toast) return;
        DOM.toast.textContent = msg;
        DOM.toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function() {
            DOM.toast.classList.remove('show');
        }, 2200);
    };

    // 10. 模态窗口启闭控制器
    window.openModal = function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.classList.remove('open');
            document.body.style.overflow = '';
        }
    };

    // 点击遮罩层关闭模态窗口
    document.addEventListener('click', function(e) {
        if (e.target.classList && e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('open');
            document.body.style.overflow = '';
        }
    });

    // ESC 键关闭模态窗口
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(function(m) {
                m.classList.remove('open');
            });
            document.body.style.overflow = '';
        }
    });

    // 11. 初始化入口
    function init() {
        initThemeEngine();
        initCategoryFilter();
        initQuotesEngine();
        initMusicController();
        initSakuraCanvas();

        updateClockAndLoveTime();
        setInterval(updateClockAndLoveTime, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/**
 * 小白个人全景空间 · 核心应用中枢 (Claude Design 羊皮纸暖白专版)
 * 纯粹、敏捷、无死锁：锁死官方羊皮纸暖白质感、实时搜索、双模星空/落樱画布、BGM胶囊控制器、维度诗篇与友链一键复制
 */
(function() {
    'use strict';

    // 1. 全局配置与状态 (锁死 Claude 羊皮纸暖白)
    var State = {
        ambientMode: 'sakura', // 'sakura' | 'constellation' | 'pure'
        bgmPlaying: false,
        loveStartTime: new Date(2019, 4, 20, 20, 20, 0), // 2019-05-20 20:20:00 (5月为索引4)
        quotes: window.TG_QUOTES || [],
        currentQuote: '',
        currentFilter: 'all',
        searchQuery: '',
        mousePos: { x: -1000, y: -1000 }
    };

    // 强行清除旧版暗色缓存，确保 100% 呈现羊皮纸暖白
    document.documentElement.removeAttribute('data-theme');
    try {
        localStorage.removeItem('claude-theme');
    } catch(e) {}

    // 2. DOM 元素缓存
    var DOM = {
        clockTime: document.getElementById('clock-time'),
        loveDaysDisplay: document.getElementById('love-days-display'),
        btnAmbient: document.getElementById('btn-ambient'),
        audioCapsule: document.getElementById('audio-capsule'),
        btnBgm: document.getElementById('btn-bgm'),
        bgmAudio: document.getElementById('bgm-audio'),
        quoteText: document.getElementById('quote-text'),
        quoteDate: document.getElementById('quote-date'),
        btnRefreshQuote: document.getElementById('btn-refresh-quote'),
        btnCopyQuote: document.getElementById('btn-copy-quote'),
        ambientCanvas: document.getElementById('sakura-canvas') || document.getElementById('ambient-canvas'),
        toast: document.getElementById('toast-msg'),
        filterTabs: document.querySelectorAll('.filter-tab-btn'),
        cards: document.querySelectorAll('.claude-card'),
        searchInput: document.getElementById('search-input'),
        searchCount: document.getElementById('search-count'),
        btnClearSearch: document.getElementById('btn-clear-search'),
        emptyState: document.getElementById('empty-search-state')
    };

    // 3. 全局通用 Toast 轻提示
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

    // 4. 一键复制文本工具
    window.copyField = function(text, label) {
        function done() {
            window.showToast('已复制' + (label ? '【' + label + '】' : '') + '到剪贴板');
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(done).catch(function() {
                fallbackCopy(text, label);
            });
        } else {
            fallbackCopy(text, label);
        }
    };

    function fallbackCopy(text, label) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            window.showToast('已复制' + (label ? '【' + label + '】' : '') + '到剪贴板');
        } catch (e) {
            prompt('请手动选择复制：', text);
        }
        document.body.removeChild(textarea);
    }

    // 5. 统一搜索与分类过滤核心调度器
    function applyFilterAndSearch() {
        var q = (State.searchQuery || '').trim().toLowerCase();
        var filter = State.currentFilter;
        var visibleCount = 0;

        DOM.cards.forEach(function(card) {
            var categories = (card.getAttribute('data-category') || '').split(' ');
            var matchesCategory = (filter === 'all' || categories.indexOf(filter) !== -1);

            if (!matchesCategory) {
                card.style.display = 'none';
                return;
            }

            if (!q) {
                card.style.display = '';
                visibleCount++;
                return;
            }

            var textContent = (card.textContent || '').toLowerCase();
            var domain = (card.querySelector('.card-domain') ? card.querySelector('.card-domain').textContent : '').toLowerCase();
            var title = (card.querySelector('.card-title') ? card.querySelector('.card-title').textContent : '').toLowerCase();

            if (textContent.indexOf(q) !== -1 || domain.indexOf(q) !== -1 || title.indexOf(q) !== -1) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // 更新搜索状态指示
        if (DOM.searchCount) {
            DOM.searchCount.textContent = '找到 ' + visibleCount + ' 项';
        }

        if (DOM.emptyState) {
            if (visibleCount === 0) {
                DOM.emptyState.classList.add('show');
            } else {
                DOM.emptyState.classList.remove('show');
            }
        }
    }

    // 初始化分类筛选器
    function initCategoryFilter() {
        if (!DOM.filterTabs || DOM.filterTabs.length === 0) return;

        DOM.filterTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var filter = tab.getAttribute('data-filter');

                if (filter === 'exchange') {
                    // 平滑滚动至友链中心
                    var exchangeSection = document.getElementById('exchange');
                    if (exchangeSection) {
                        exchangeSection.scrollIntoView({ behavior: 'smooth' });
                        window.showToast('已直达站群友链与申请中心');
                    }
                    return;
                }

                State.currentFilter = filter;
                DOM.filterTabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');

                applyFilterAndSearch();
            });
        });
    }

    // 初始化即时搜索框
    function initSearchEngine() {
        if (!DOM.searchInput) return;

        DOM.searchInput.addEventListener('input', function(e) {
            State.searchQuery = e.target.value;
            if (DOM.btnClearSearch) {
                if (State.searchQuery) {
                    DOM.btnClearSearch.classList.add('show');
                } else {
                    DOM.btnClearSearch.classList.remove('show');
                }
            }
            applyFilterAndSearch();
        });

        if (DOM.btnClearSearch) {
            DOM.btnClearSearch.addEventListener('click', function() {
                DOM.searchInput.value = '';
                State.searchQuery = '';
                DOM.btnClearSearch.classList.remove('show');
                DOM.searchInput.focus();
                applyFilterAndSearch();
            });
        }

        // 键盘快捷键: 按 / 或 Ctrl+K 聚焦搜索框
        document.addEventListener('keydown', function(e) {
            if (e.key === '/' && document.activeElement !== DOM.searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                DOM.searchInput.focus();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                DOM.searchInput.focus();
            }
        });
    }

    // 6. 实时时钟与相恋计时
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

    // 7. 今日心绪拾遗引擎
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
                window.copyField(State.currentQuote, '心绪随笔');
            });
        }
    }

    // 8. 随身音乐胶囊控制器 (520.mp3)
    function initMusicController() {
        var capsule = DOM.audioCapsule || DOM.btnBgm;
        if (!capsule || !DOM.bgmAudio) return;

        capsule.addEventListener('click', function() {
            if (State.bgmPlaying) {
                DOM.bgmAudio.pause();
                State.bgmPlaying = false;
                if (DOM.audioCapsule) DOM.audioCapsule.classList.remove('playing');
                if (DOM.btnBgm) DOM.btnBgm.classList.remove('active');
                window.showToast('背景音乐已暂停');
            } else {
                DOM.bgmAudio.play().then(function() {
                    State.bgmPlaying = true;
                    if (DOM.audioCapsule) DOM.audioCapsule.classList.add('playing');
                    if (DOM.btnBgm) DOM.btnBgm.classList.add('active');
                    window.showToast('正在播放《520 · 岁月静好》');
                }).catch(function() {
                    window.showToast('点击播放失败，可能需先轻点页面');
                });
            }
        });
    }

    // 9. 双模氛围微动效引擎 (落樱 / 极客星空粒子 / 纯净)
    function initAmbientCanvas() {
        if (!DOM.ambientCanvas) return;
        var canvas = DOM.ambientCanvas;
        var ctx = canvas.getContext('2d');
        var width = canvas.width = window.innerWidth;
        var height = canvas.height = window.innerHeight;

        window.addEventListener('resize', function() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        window.addEventListener('mousemove', function(e) {
            State.mousePos.x = e.clientX;
            State.mousePos.y = e.clientY;
        });

        window.addEventListener('mouseleave', function() {
            State.mousePos.x = -1000;
            State.mousePos.y = -1000;
        });

        // 落樱粒子定义
        var petals = [];
        var totalPetals = Math.min(26, Math.floor(width / 45));

        function Petal() {
            this.x = Math.random() * width;
            this.y = Math.random() * height - height;
            this.r = 3 + Math.random() * 4;
            this.vx = 0.4 + Math.random() * 0.7;
            this.vy = 0.7 + Math.random() * 1.1;
            this.rot = Math.random() * 360;
            this.vrot = (Math.random() - 0.5) * 1.2;
            this.alpha = 0.2 + Math.random() * 0.3;
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
            ctx.fillStyle = 'rgba(215, 135, 150, ' + this.alpha + ')';
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

        // 极客星空粒子定义 (来自 dh/ 的灵魂融合，适配 Claude 暖陶土金辉色)
        var stars = [];
        var totalStars = Math.min(42, Math.floor(width / 30));

        function Star() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.r = 1.2 + Math.random() * 1.8;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.alpha = 0.25 + Math.random() * 0.45;
        }

        Star.prototype.update = function() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        };

        Star.prototype.draw = function() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(201, 100, 66, ' + this.alpha + ')';
            ctx.fill();
        };

        for (var s = 0; s < totalStars; s++) {
            stars.push(new Star());
        }

        var animId = null;

        function loop() {
            ctx.clearRect(0, 0, width, height);

            if (State.ambientMode === 'sakura') {
                for (var j = 0; j < petals.length; j++) {
                    petals[j].update();
                    petals[j].draw();
                }
            } else if (State.ambientMode === 'constellation') {
                // 绘制极客星空星座连线
                for (var m = 0; m < stars.length; m++) {
                    stars[m].update();
                    stars[m].draw();

                    // 星星之间连线
                    for (var n = m + 1; n < stars.length; n++) {
                        var dx = stars[m].x - stars[n].x;
                        var dy = stars[m].y - stars[n].y;
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 110) {
                            ctx.beginPath();
                            ctx.moveTo(stars[m].x, stars[m].y);
                            ctx.lineTo(stars[n].x, stars[n].y);
                            ctx.strokeStyle = 'rgba(201, 100, 66, ' + ((1 - dist / 110) * 0.18) + ')';
                            ctx.lineWidth = 0.8;
                            ctx.stroke();
                        }
                    }

                    // 与鼠标交互连线
                    if (State.mousePos.x > 0) {
                        var mdx = stars[m].x - State.mousePos.x;
                        var mdy = stars[m].y - State.mousePos.y;
                        var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                        if (mdist < 130) {
                            ctx.beginPath();
                            ctx.moveTo(stars[m].x, stars[m].y);
                            ctx.lineTo(State.mousePos.x, State.mousePos.y);
                            ctx.strokeStyle = 'rgba(201, 100, 66, ' + ((1 - mdist / 130) * 0.35) + ')';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
            } else if (State.ambientMode === 'pure') {
                // 纯净模式，不绘制任何粒子，保持 canvas 洁净
                return;
            }

            animId = requestAnimationFrame(loop);
        }

        loop();

        // 氛围模式切换控制
        if (DOM.btnAmbient) {
            DOM.btnAmbient.addEventListener('click', function() {
                if (State.ambientMode === 'sakura') {
                    State.ambientMode = 'constellation';
                    DOM.btnAmbient.innerHTML = '<span>✨ 极客星空</span>';
                    window.showToast('已切换为极客星空粒子模式（融合自作品导航）');
                    if (animId) cancelAnimationFrame(animId);
                    loop();
                } else if (State.ambientMode === 'constellation') {
                    State.ambientMode = 'pure';
                    DOM.btnAmbient.innerHTML = '<span>🍃 极简静音</span>';
                    ctx.clearRect(0, 0, width, height);
                    if (animId) cancelAnimationFrame(animId);
                    window.showToast('已切换为极简纯净模式');
                } else {
                    State.ambientMode = 'sakura';
                    DOM.btnAmbient.innerHTML = '<span>🌸 柔和落樱</span>';
                    window.showToast('已切换为柔和落樱氛围模式');
                    if (animId) cancelAnimationFrame(animId);
                    loop();
                }
            });
        }
    }

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
        initCategoryFilter();
        initSearchEngine();
        initQuotesEngine();
        initMusicController();
        initAmbientCanvas();

        updateClockAndLoveTime();
        setInterval(updateClockAndLoveTime, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

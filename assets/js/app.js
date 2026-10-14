/**
 * 小白个人全景空间 · 核心应用中枢 (App Core Engine)
 * 具备：SPA无刷新路由、又拍云CDN调度、爱心树纪年、打字机告白、樱花粒子、音乐随身听
 */
(function() {
    'use strict';

    // 1. 全局配置与状态
    var State = {
        currentView: 'home',
        sakuraActive: true,
        bgmPlaying: false,
        loveStartTime: new Date(2019, 4, 20, 20, 20, 0), // 2019-05-20 20:20:00 (月份0索引)
        quotes: window.TG_QUOTES || [],
        currentQuote: ''
    };

    // 2. DOM 元素缓存
    var DOM = {
        clockTime: document.getElementById('clock-time'),
        clockDate: document.getElementById('clock-date'),
        btnSakura: document.getElementById('btn-sakura'),
        btnBgm: document.getElementById('btn-bgm'),
        bgmAudio: document.getElementById('bgm-audio'),
        quoteText: document.getElementById('quote-text'),
        quoteDate: document.getElementById('quote-date'),
        quoteWeather: document.getElementById('quote-weather'),
        btnRefreshQuote: document.getElementById('btn-refresh-quote'),
        btnCopyQuote: document.getElementById('btn-copy-quote'),
        loveDaysEl: document.getElementById('love-days-display'),
        loveDetailEl: document.getElementById('love-detail-display'),
        confessionTypewriter: document.getElementById('confession-typewriter'),
        sakuraCanvas: document.getElementById('sakura-canvas'),
        toast: document.getElementById('toast-msg'),
        vinylDisc: document.getElementById('vinyl-disc'),
        playMainBtn: document.getElementById('play-main-btn'),
        viewPanels: document.querySelectorAll('.view-panel'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    // 3. SPA 路由中枢
    function switchView(viewName) {
        if (!viewName) viewName = 'home';
        State.currentView = viewName;

        // 更新 Tab 按钮激活态
        DOM.tabBtns.forEach(function(btn) {
            if (btn.getAttribute('data-view') === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 切换视图面板
        DOM.viewPanels.forEach(function(panel) {
            if (panel.id === 'view-' + viewName) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        // 视窗激活联动
        if (viewName === 'romance') {
            startConfessionTyping();
            initLoveTreeCanvas();
        } else if (viewName === 'visual') {
            initVisual3D();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 路由监听
    function initRouter() {
        DOM.tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                var targetView = btn.getAttribute('data-view');
                if (targetView) {
                    window.location.hash = targetView;
                }
            });
        });

        window.addEventListener('hashchange', function() {
            var hash = window.location.hash.replace('#', '') || 'home';
            switchView(hash);
        });

        // 首次加载按 Hash 定位
        var initialHash = window.location.hash.replace('#', '') || 'home';
        switchView(initialHash);
    }

    // 4. 时钟与恋爱计时器
    function updateClockAndLoveTime() {
        var now = new Date();

        // 头部实时时钟
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
            var days = ['日', '一', '二', '三', '四', '五', '六'];
            var dayStr = '星期' + days[now.getDay()];
            DOM.clockDate.textContent = year + '年' + month + '月' + date + '日 ' + dayStr;
            if (DOM.quoteDate) DOM.quoteDate.textContent = year + '年' + month + '月' + date + '日';
        }

        // 恋爱计时（起算点：2019-05-20 20:20:00）
        if (DOM.loveDaysEl && DOM.loveDetailEl) {
            var diffMs = now.getTime() - State.loveStartTime.getTime();
            if (diffMs > 0) {
                var totalSeconds = Math.floor(diffMs / 1000);
                var days = Math.floor(totalSeconds / (3600 * 24));
                var hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
                var minutes = Math.floor((totalSeconds % 3600) / 60);
                var seconds = totalSeconds % 60;

                DOM.loveDaysEl.textContent = days + ' 天 ' + hours + ' 小时';
                DOM.loveDetailEl.textContent = minutes + ' 分 ' + seconds + ' 秒';
            }
        }
    }

    // 5. 每日一言 / 舔狗日记引擎
    function initQuotesEngine() {
        if (!State.quotes || State.quotes.length === 0) {
            fetch('assets/data/data.json')
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    State.quotes = data;
                    renderRandomQuote();
                })
                .catch(function() {
                    if (DOM.quoteText) DOM.quoteText.textContent = '今天也是爱你的一天，想你。';
                });
        } else {
            renderRandomQuote();
        }

        // 天气随机
        if (DOM.quoteWeather) {
            var weathers = ['晴好 ☀️', '微风 🍃', '温暖 🌤️', '多云 ⛅', '微雨 🌧️'];
            DOM.quoteWeather.textContent = weathers[Math.floor(Math.random() * weathers.length)];
        }

        if (DOM.btnRefreshQuote) {
            DOM.btnRefreshQuote.addEventListener('click', renderRandomQuote);
        }

        if (DOM.btnCopyQuote) {
            DOM.btnCopyQuote.addEventListener('click', function() {
                if (!State.currentQuote) return;
                navigator.clipboard.writeText(State.currentQuote).then(function() {
                    showToast('✨ 已复制日记到剪贴板！');
                }).catch(function() {
                    var ta = document.createElement('textarea');
                    ta.value = State.currentQuote;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast('✨ 已复制日记到剪贴板！');
                });
            });
        }
    }

    function renderRandomQuote() {
        if (!State.quotes || State.quotes.length === 0) return;
        var idx = Math.floor(Math.random() * State.quotes.length);
        State.currentQuote = State.quotes[idx];
        if (DOM.quoteText) {
            DOM.quoteText.style.opacity = '0';
            setTimeout(function() {
                DOM.quoteText.textContent = State.currentQuote;
                DOM.quoteText.style.transition = 'opacity 0.25s ease';
                DOM.quoteText.style.opacity = '1';
            }, 120);
        }
    }

    // 6. 随身听音乐与唱片交互
    function initMusicController() {
        if (!DOM.bgmAudio) return;

        function togglePlay() {
            if (DOM.bgmAudio.paused) {
                DOM.bgmAudio.play().then(function() {
                    State.bgmPlaying = true;
                    if (DOM.btnBgm) DOM.btnBgm.classList.add('active');
                    if (DOM.vinylDisc) DOM.vinylDisc.classList.add('playing');
                    if (DOM.playMainBtn) DOM.playMainBtn.innerHTML = '❚❚';
                    showToast('🎵 正在播放《520》浪漫旋律');
                }).catch(function(err) {
                    showToast('请点击屏幕激活音频播放');
                });
            } else {
                DOM.bgmAudio.pause();
                State.bgmPlaying = false;
                if (DOM.btnBgm) DOM.btnBgm.classList.remove('active');
                if (DOM.vinylDisc) DOM.vinylDisc.classList.remove('playing');
                if (DOM.playMainBtn) DOM.playMainBtn.innerHTML = '▶';
                showToast('⏸️ 已暂停背景音乐');
            }
        }

        if (DOM.btnBgm) DOM.btnBgm.addEventListener('click', togglePlay);
        if (DOM.playMainBtn) DOM.playMainBtn.addEventListener('click', togglePlay);
    }

    // 7. 浪漫告白打字机与 Yes/No 互动
    var confessionText = "遇见你是我所有美好故事的开始。\n请别放开我的手，也别缺席我的将来，因为一辈子和你在一起才叫将来。❤️";
    var confessionTyped = false;

    function startConfessionTyping() {
        if (confessionTyped || !DOM.confessionTypewriter) return;
        confessionTyped = true;
        DOM.confessionTypewriter.textContent = '';
        var i = 0;
        var timer = setInterval(function() {
            if (i < confessionText.length) {
                DOM.confessionTypewriter.textContent += confessionText.charAt(i);
                i++;
            } else {
                clearInterval(timer);
            }
        }, 50);
    }

    // 8. 告白互动按钮
    window.handleConfessionYes = function() {
        showToast('太好了！愿得一人心，白首不相离 💕');
        var modal = document.getElementById('confession-modal');
        if (modal) modal.classList.add('active');
    };

    var noRejections = [
        '房子写你名！',
        '工资全交！',
        '家务我全包！',
        '听话不惹你生气！',
        '再考虑一下嘛，求求了 🥺',
        '告诉我Yes好不好！'
    ];
    var noIndex = 0;

    window.handleConfessionNo = function(btn) {
        var phrase = noRejections[noIndex % noRejections.length];
        noIndex++;
        showToast(phrase);
        if (btn) {
            btn.textContent = phrase;
            btn.style.transform = 'scale(' + Math.max(0.7, 1 - noIndex * 0.05) + ')';
        }
    };

    // 9. 爱心树 Canvas 绘制核心
    function initLoveTreeCanvas() {
        var canvas = document.getElementById('love-tree-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.clientWidth || 550;
        canvas.height = canvas.parentElement.clientHeight || 500;

        // 简雅手绘大树开花
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 树干
        var startX = canvas.width / 2;
        var startY = canvas.height - 20;
        
        function drawBranch(x, y, len, angle, depth) {
            if (depth === 0) {
                // 绽放爱心花瓣
                ctx.fillStyle = 'rgba(244, 63, 94, ' + (Math.random() * 0.5 + 0.5) + ')';
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 5 + 3, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            var x2 = x + Math.cos(angle * Math.PI / 180) * len;
            var y2 = y + Math.sin(angle * Math.PI / 180) * len;

            ctx.lineWidth = depth * 1.5;
            ctx.strokeStyle = '#5a3d28';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            drawBranch(x2, y2, len * 0.75, angle - 22, depth - 1);
            drawBranch(x2, y2, len * 0.75, angle + 22, depth - 1);
        }

        drawBranch(startX, startY, 70, -90, 8);
    }

    // 10. 3D 视觉展厅初始化
    function initVisual3D() {
        var container = document.getElementById('visual-container-slot');
        if (!container || container.getAttribute('data-loaded')) return;
        container.setAttribute('data-loaded', 'true');

        // 优雅无缝加载 3D 页面体验
        var iframe = document.createElement('iframe');
        iframe.src = 'a/index.html';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        container.appendChild(iframe);
    }

    // 11. 樱花飘落粒子系统
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

        Petal.prototype.update = function() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotSpeed;
            if (this.y > canvas.height) {
                this.y = -10;
                this.x = Math.random() * canvas.width;
            }
        };

        Petal.prototype.draw = function() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.fillStyle = 'rgba(255, 183, 197, ' + this.opacity + ')';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(this.size / 2, -this.size / 2, this.size, 0, 0, this.size);
            ctx.bezierCurveTo(-this.size, 0, -this.size / 2, -this.size / 2, 0, 0);
            ctx.fill();
            ctx.restore();
        };

        for (var i = 0; i < count; i++) {
            petals.push(new Petal());
        }

        function loop() {
            if (State.sakuraActive) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (var i = 0; i < petals.length; i++) {
                    petals[i].update();
                    petals[i].draw();
                }
            }
            requestAnimationFrame(loop);
        }
        loop();

        if (DOM.btnSakura) {
            DOM.btnSakura.addEventListener('click', function() {
                State.sakuraActive = !State.sakuraActive;
                if (State.sakuraActive) {
                    canvas.style.opacity = '0.6';
                    DOM.btnSakura.classList.add('active');
                    showToast('🌸 已开启落樱浪漫特效');
                } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.style.opacity = '0';
                    DOM.btnSakura.classList.remove('active');
                    showToast('已关闭落樱特效');
                }
            });
        }
    }

    // 12. 弹窗与 Toast
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
                closeModal(overlay.id);
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

    // 13. 初始化启动
    function init() {
        initRouter();
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

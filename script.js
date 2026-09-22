/* ============================================================
   Qurat Ul Ain — Interactive Birthday Experience
   Countdown + Cake Builder + Wish + Mystery Gift + Celebration
   ============================================================ */

(function () {
  'use strict';

  /* ---------------- Helpers ---------------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) document.body.classList.add('reduced');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------------- State ---------------- */
  var TARGET = new Date(2026, 8, 25, 0, 0, 0); // 25 Sep 2026, local time

  var state = {
    scene: 'opening',
    base: 'vanilla',
    frost: 'vanilla-cream',
    toppings: [],
    candles: 0,
    builderStep: 0,
    candleLit: false,
    wishMade: false,
    giftOpened: false,
    finalVisited: false,
    birthday: false
  };

  var timers = [];
  function later(fn, ms) {
    var t = setTimeout(function () {
      timers = timers.filter(function (x) { return x !== t; });
      fn();
    }, ms);
    timers.push(t);
    return t;
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* ---------------- Sound FX (Web Audio) ---------------- */
  var SFX = {
    ac: null,
    init: function () {
      if (!this.ac) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) this.ac = new C();
      }
      if (this.ac && this.ac.state === 'suspended') { this.ac.resume(); }
    },
    tone: function (freq, dur, type, vol, when, slideTo) {
      if (!this.ac) return;
      var t0 = this.ac.currentTime + (when || 0);
      var osc = this.ac.createOscillator();
      var gain = this.ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    noise: function (dur, vol, when) {
      if (!this.ac) return;
      var t0 = this.ac.currentTime + (when || 0);
      var len = Math.floor(this.ac.sampleRate * dur);
      var buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var src = this.ac.createBufferSource();
      src.buffer = buf;
      var gain = this.ac.createGain();
      gain.gain.setValueAtTime(vol || 0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var filter = this.ac.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1400;
      src.connect(filter).connect(gain).connect(this.ac.destination);
      src.start(t0);
    },
    click: function () { this.tone(540, 0.09, 'triangle', 0.05); },
    select: function () {
      this.tone(660, 0.1, 'sine', 0.05);
      this.tone(990, 0.16, 'sine', 0.04, 0.07);
    },
    flip: function () { this.tone(420, 0.12, 'triangle', 0.04, 0, 640); },
    candle: function (i) { this.tone(520, 0.5, 'sine', 0.05, 0, 700); },
    whoosh: function () { this.noise(0.18, 0.05); },
    gift: function () {
      this.tone(523, 0.3, 'sine', 0.05);
      this.tone(659, 0.3, 'sine', 0.05, 0.12);
      this.tone(784, 0.4, 'sine', 0.05, 0.24);
      this.tone(1046, 0.6, 'sine', 0.045, 0.36);
    },
    celebrate: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        SFX.tone(f, 0.4, 'sine', 0.05, i * 0.09);
      });
    }
  };

  /* ---------------- Music controller ---------------- */
  var Music = {
    audio: null,
    started: false,
    on: false,
    available: true,
    volumeTarget: 0.25,
    init: function () {
      var a = new Audio('assets/music.mp3');
      a.loop = true;
      a.volume = 0;
      a.preload = 'auto';
      this.audio = a;
      if (a.addEventListener) {
        a.addEventListener('error', function () { Music.disable(); });
        a.addEventListener('abort', function () { Music.disable(); });
      }
    },
    disable: function () {
      this.available = false;
      var btn = $('#music-btn');
      if (btn) btn.classList.add('hidden');
      this.audio = null;
    },
    fadeTo: function (target, dur) {
      var a = this.audio;
      if (!a) return;
      var from = a.volume;
      var t0 = performance.now();
      var step = function (now) {
        var k = Math.min(1, (now - t0) / (dur || 2000));
        a.volume = from + (target - from) * (k * (2 - k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    unlock: function () {
      if (!this.available || this.started || !this.audio) return;
      SFX.init();
      this.started = true;
      this.on = true;
      var p = this.audio.play();
      if (p && p.catch) p.catch(function () { Music.disable(); });
      this.fadeTo(this.volumeTarget, 2000);
      var btn = $('#music-btn');
      if (btn) { btn.textContent = '🔊'; btn.setAttribute('aria-pressed', 'true'); }
    },
    toggle: function () {
      if (!this.available) return;
      SFX.init();
      if (this.on) {
        this.on = false;
        this.fadeTo(0, 1200);
        var btn1 = $('#music-btn');
        if (btn1) { btn1.textContent = '🔇'; btn1.setAttribute('aria-pressed', 'false'); }
      } else {
        this.on = true;
        if (!this.started) {
          this.unlock();
        } else {
          if (this.audio) {
            var p = this.audio.play();
            if (p && p.catch) p.catch(function () {});
          }
          this.fadeTo(this.volumeTarget, 1200);
        }
        var btn2 = $('#music-btn');
        if (btn2) { btn2.textContent = '🔊'; btn2.setAttribute('aria-pressed', 'true'); }
      }
    }
  };

  /* ---------------- Scenes ---------------- */
  var sceneEls = {
    opening: $('#scene-opening'),
    countdown: $('#scene-countdown'),
    cake: $('#scene-cake'),
    wish: $('#scene-wish'),
    gift: $('#scene-gift'),
    final: $('#scene-final')
  };

  function showScene(id) {
    state.scene = id;
    Object.keys(sceneEls).forEach(function (key) {
      var el = sceneEls[key];
      var active = key === id;
      el.classList.toggle('active', active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
    ambientForScene(id);
    reTriggerSceneEffects(id);
  }

  /* Re-trigger entrance animations when a scene is shown */
  var REVEAL_SELECTORS = {
    opening: '.opening-hey, .opening-line, .btn-start',
    countdown: '.scene-title, .date-line, .cd-slogan, .cd-byline, .today-line, .bd-headline',
    cake: '.scene-title, .subtitle, .cake-praise',
    wish: '.ghost-line, .wish-title, .soft-line, .wish-sent',
    gift: '.ghost-line, .soft-line, .gift-wrap, .reveal-line, .gift-hope, .bd-headline, .action-btn',
    final: '.final-title, .final-name, .final-date, .final-cake, .final-stage > .btn'
  };

  function reTriggerSceneEffects(id) {
    var scene = sceneEls[id];
    var sel = REVEAL_SELECTORS[id];
    if (!scene || !sel) return;
    var list = scene.querySelectorAll(sel);
    Array.prototype.forEach.call(list, function (el, i) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      el.style.animationDelay = '';
    });
  }

  /* ---------------- Background decorations ---------------- */
  function buildStars() {
    var host = $('#stars');
    var count = reduceMotion ? 18 : 42;
    for (var i = 0; i < count; i++) {
      var s = document.createElement('span');
      s.className = 'star';
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      var size = (Math.random() * 1.8 + 0.6).toFixed(2) + 'px';
      s.style.width = size;
      s.style.height = size;
      s.style.setProperty('--dur', (Math.random() * 4 + 2).toFixed(2) + 's');
      s.style.setProperty('--delay', (Math.random() * 4).toFixed(2) + 's');
      if (Math.random() < 0.25) s.style.background = '#ffe28a';
      if (Math.random() < 0.2) s.style.background = '#a8e7ff';
      host.appendChild(s);
    }
  }

  var BALLOON_COLORS = ['#ff8ed0', '#b5a0ff', '#7fd8ff', '#ffd26e', '#9dffc8', '#ff9d9d'];
  function buildBalloons() {
    var host = $('#balloons');
    if (reduceMotion) return;
    var count = 6;
    for (var i = 0; i < count; i++) {
      var b = document.createElement('span');
      b.className = 'balloon';
      b.style.left = (Math.random() * 88) + '%';
      b.style.top = (20 + Math.random() * 60) + '%';
      b.style.background = 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), ' + BALLOON_COLORS[i % BALLOON_COLORS.length] + ' 65%)';
      b.style.opacity = (0.28 + Math.random() * 0.24).toFixed(2);
      b.style.setProperty('--dur', (14 + Math.random() * 10).toFixed(1) + 's');
      b.style.setProperty('--delay', (Math.random() * -12).toFixed(1) + 's');
      host.appendChild(b);
    }
  }

  /* ---------------- Particle canvas ---------------- */
  var canvas = $('#fx');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var particles = [];
  var MAX_PARTICLES = reduceMotion ? 24 : 48;

  function shutdownAmbient() {
    ambientClear.calls.forEach(clearInterval);
    ambientClear.calls = [];
  }
  var ambientClear = { calls: [] };

  function resizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  function burstStars(x, y, count) {
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      var sp = Math.random() * 3 + 1.2;
      spawn({
        type: 'star',
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: Math.random() * 6 + 3,
        life: Math.random() * 0.5 + 0.5, max: 1,
        color: ['#fff3c4', '#ffd9f2', '#c9d9ff', '#ffffff'][i % 4]
      });
    }
  }

  function burstConfetti(x, y, count) {
    var colors = ['#ff8ed0', '#b5a0ff', '#7fd8ff', '#ffd26e', '#ff6f91', '#7bffc1'];
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = Math.random() * 7 + 2;
      spawn({
        type: 'confetti',
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        vy0: Math.sin(a) * sp,
        size: Math.random() * 4 + 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        flipping: true,
        life: Math.random() * 1.4 + 0.8, max: 1,
        color: colors[i % colors.length]
      });
    }
  }

  function burstHearts(x, y, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = Math.random() * 4 + 1;
      spawn({
        type: 'heart',
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
        size: Math.random() * 7 + 4,
        life: Math.random() * 1 + 0.7, max: 1,
        color: ['#ff8ed0', '#ffb3dc', '#ffd26e'][i % 3]
      });
    }
  }

  function burstDot(x, y, count, colors) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = Math.random() * 4 + 0.6;
      spawn({
        type: 'dot',
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vy0: Math.sin(a) * sp,
        size: Math.random() * 2.4 + 0.8,
        life: Math.random() * 1.2 + 0.6, max: 1,
        color: colors ? colors[i % colors.length] : '#ffffff'
      });
    }
  }

  function firework(x, y) {
    var colors = ['#ffe28a', '#ff8ed0', '#b5a0ff', '#7fd8ff', '#ff6f91'];
    for (var i = 0; i < 26; i++) {
      var a = (i / 26) * Math.PI * 2 + Math.random() * 0.5;
      var sp = Math.random() * 3.4 + 1.2;
      spawn({
        type: i % 3 === 0 ? 'star' : 'dot',
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vy0: Math.sin(a) * sp,
        size: (i % 3 === 0 ? Math.random() * 5 + 2 : Math.random() * 2 + 0.8),
        life: Math.random() * 0.9 + 0.5, max: 1,
        color: colors[i % colors.length]
      });
    }
  }

  function drawStar(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.closePath();
    ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= 0.016;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.flipping) {
        p.vx += (p.vx > 0 ? -0.02 : 0.02) * 6;
        p.vy += 0.12;
        p.vx = p.vx > 6 ? 4 : p.vx < -6 ? -4 : p.vx;
      }
      p.x += (p.vx || 0);
      p.y += (p.vy || 0);
      if (p.rot !== undefined) p.rot += p.vr || 0;
      var k = Math.max(0, Math.min(1, p.life / p.max));
      ctx.save();
      ctx.globalAlpha = k;
      if (p.rot) ctx.translate(p.x, p.y), ctx.rotate(p.rot);
      else ctx.translate(p.x, p.y);
      if (p.type === 'confetti') {
        ctx.fillStyle = p.color;
        var w = p.size * 1.6, h = p.size * 2.6;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-w / 2, -h / 2, w * 0.5, h * 0.5);
        ctx.restore();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        drawStar(ctx, p.size * k + 0.5);
        ctx.restore();
      } else if (p.type === 'heart') {
        ctx.fillStyle = p.color;
        var s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.4);
        ctx.bezierCurveTo(s * 0.6, -s * 0.2, s * 0.4, -s, 0, -s * 0.5);
        ctx.bezierCurveTo(-s * 0.4, -s, -s * 0.6, -s * 0.2, 0, s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------- Ambient per-scene effects ---------------- */
  function ambientForScene(sceneId) {
    while (ambientClear.calls.length) {
      clearInterval(ambientClear.calls.pop());
    }
    if (reduceMotion) return;
    var spawnSpark = function () {
      burstDot(Math.random() * W, H + 6, 1, ['#fff3c4', '#ffd9f2', '#c9d9ff']);
    };
    if (sceneId === 'countdown') {
      ambientClear.calls.push(setInterval(spawnSpark, 600));
    } else if (sceneId === 'wish') {
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, H + 4, 1, ['#ffd9a0', '#ffb0d0']);
      }, 500));
    } else if (sceneId === 'final') {
      ambientClear.calls.push(setInterval(function () {
        burstConfetti(Math.random() * W, -10, 14);
        if (Math.random() < 0.5) burstHearts(Math.random() * W, -20, 3);
      }, 700));
      ambientClear.calls.push(setInterval(function () {
        firework(Math.random() * W * 0.8 + W * 0.1, Math.random() * H * 0.4);
      }, 1700));
    }
  }

  function confettiCannon() {
    for (var i = 0; i < 6; i++) {
      later(function () {
        burstConfetti(Math.random() * W * 0.7 + W * 0.15, -10, 12);
      }, i * 180);
    }
  }

  /* ---------------- Countdown ---------------- */
  var cdWrap = $('#cd-wrap');
  var cdDays = $('#cd-days');
  var cdHours = $('#cd-hours');
  var cdMins = $('#cd-mins');
  var cdSecs = $('#cd-secs');
  var cdByline = $('#cd-byline');
  var bdReveal = $('#bd-reveal');
  var last = { d: -1, h: -1, m: -1, s: -1 };

  function isBirthday() {
    return Date.now() >= TARGET.getTime();
  }

  function updateCountdown() {
    state.birthday = isBirthday();
    if (state.birthday) {
      cdWrap.hidden = true;
      bdReveal.hidden = false;
      return;
    }
    var now = Date.now();
    var diff = Math.max(0, TARGET.getTime() - now);
    var secs = Math.floor(diff / 1000);
    var d = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    if (d !== last.d) { cdDays.textContent = pad(d); bump(cdDays); last.d = d; }
    if (h !== last.h) { cdHours.textContent = pad(h); bump(cdHours); last.h = h; }
    if (m !== last.m) { cdMins.textContent = pad(m); bump(cdMins); last.m = m; }
    if (s !== last.s) { cdSecs.textContent = pad(s); last.s = s; }
    if (d >= 1 && state.bylineDay !== d) {
      state.bylineDay = d;
      cdByline.textContent = 'Only ' + d + (d === 1 ? ' day left...' : ' days left...');
    } else if (d === 0 && cdByline.textContent.indexOf('Only') !== -1) {
      cdByline.textContent = 'Get ready... 🎉';
    }
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------------- Cake rendering ---------------- */
  var TOP_EMOJI = {
    strawberry: '🍓',
    chocolate: '🍫',
    cherry: '🍒',
    blueberry: '🫐',
    sprinkles: '🍬',
    star: '✨'
  };

  function candleMetrics(n) {
    // width / gap for candle rows so any count fits the top tier
    if (n <= 3) return { cw: 13, gap: 9 };
    if (n === 5) return { cw: 11, gap: 7 };
    if (n === 7) return { cw: 9, gap: 5 };
    return { cw: 8, gap: 4 };
  }

  function cakeHTML(opts) {
    var showCandles = !!(opts.candles && opts.candles > 0);
    var candles = '';
    if (showCandles) {
      var m = candleMetrics(opts.candles);
      candles = '<div class="candles" style="--cw:' + m.cw + 'px;--gap:' + m.gap + 'px">';
      for (var i = 0; i < opts.candles; i++) {
        candles += '<div class="candle' + (opts.lit ? ' lit' : '') + '">' +
          '<span class="flame"></span><span class="halo"></span></div>';
      }
      candles += '</div>';
    }
    var toppings = '';
    if (opts.toppings && opts.toppings.length) {
      toppings = '<div class="toppings">';
      var n = opts.toppings.length;
      for (var j = 0; j < n; j++) {
        var x = 50, y = 50;
        if (n > 1) {
          var f = n === 1 ? 0 : j / (n - 1);
          var ang = Math.PI * f;
          y = 56 - Math.sin(ang) * 7;
          x = 50 + Math.cos(Math.PI * (1 - f)) * 16;
        }
        toppings += '<span class="topping" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;--i:' + j + '">' +
          TOP_EMOJI[opts.toppings[j]] + '</span>';
      }
      toppings += '</div>';
    }
    return '<div class="cake' + (opts.extraClass ? ' ' + opts.extraClass : '') + '"' +
      ' data-flavor="' + opts.base + '" data-frost="' + opts.frost + '" role="img"' +
      ' aria-label="A ' + opts.base.replace('-', ' ') + ' cake' + (showCandles ? ' with ' + opts.candles + ' candles' : '') + '">' +
      candles + toppings +
      '<div class="tier tier-top"><span class="frost"></span></div>' +
      '<div class="tier tier-mid"><span class="frost"></span></div>' +
      '<div class="tier tier-bottom"><span class="frost"></span></div>' +
      '<span class="plate"></span></div>';
  }

  function renderCake(host, extraClass) {
    if (!host) return;
    host.innerHTML = cakeHTML({
      base: state.base,
      frost: state.frost,
      toppings: state.toppings,
      candles: state.candles,
      lit: state.candleLit,
      extraClass: extraClass
    });
  }

  function popCake(host) {
    var cake = host.querySelector('.cake');
    if (!cake) return;
    cake.classList.remove('pop');
    void cake.offsetWidth;
    cake.classList.add('pop');
  }

  /* ---------------- Cake builder ---------------- */
  var builderPreview = $('#cake-preview');
  var nextBtn = $('#next-btn');
  var lightCandlesBtn = $('#light-candles-btn');
  var praise = $('#cake-praise');

  function showStep(n) {
    state.builderStep = n;
    for (var i = 0; i < 4; i++) {
      var stepEl = $('#step-' + i);
      stepEl.hidden = i !== n;
    }
    nextBtn.hidden = n >= 3;
    lightCandlesBtn.hidden = !(n === 3 && state.candles > 0);
    if (n > 0 && n < 3) { nextBtn.textContent = 'NEXT →'; }
  }

  function eachOptsIn(groupEl, fn) {
    var list = groupEl.querySelectorAll('.opt');
    Array.prototype.forEach.call(list, fn);
  }

  function selectInGroup(group, value, btn) {
    var groupEl = btn.closest('.opts');
    if (group === 'top') {
      var idx = state.toppings.indexOf(value);
      var wasSelected = idx !== -1;
      btn.classList.toggle('selected', !wasSelected);
      btn.setAttribute('aria-pressed', String(!wasSelected));
      if (wasSelected) state.toppings.splice(idx, 1);
      else state.toppings.push(value);
      if (state.toppings.length > 6) state.toppings.shift();
      renderCake(builderPreview);
      popCake(builderPreview);
      SFX.select();
      return;
    }
    eachOptsIn(groupEl, function (o) { o.classList.remove('selected'); });
    btn.classList.add('selected');
    if (group === 'base') state.base = value;
    if (group === 'frost') state.frost = value;
    if (group === 'candle') state.candles = parseInt(value, 10);
    if (state.builderStep === 3 && group === 'candle') {
      praise.hidden = false;
      lightCandlesBtn.hidden = false;
      confettiCannon();
    }
    renderCake(builderPreview);
    popCake(builderPreview);
    SFX.select();
  }

  /* ---------------- Candle lighting ---------------- */
  var wishStage = $('#wish-stage');
  var wishPre = $('#wish-pre');
  var wishMiddle = $('#wish-middle');
  var wishDone = $('#wish-done');
  var lightBtn = $('#light-btn');
  var wishBtn = $('#wish-btn');

  function lightCandles(host, cb) {
    var candles = host.querySelectorAll('.candle');
    var i = 0;
    function next() {
      if (i >= candles.length) { cb && cb(); return; }
      var c = candles[i];
      c.classList.add('lit');
      SFX.candle(i);
      var centerR = c.getBoundingClientRect();
      var cx = centerR.left + centerR.width / 2;
      var cy = centerR.top;
      burstStars(cx, cy, 4);
      i++;
      later(next, 650);
    }
    next();
  }

  /* ---------------- Wish sequence ---------------- */
  function startWishLighting() {
    var host = $('#wish-cake');
    lightBtn.disabled = true;
    wishStage.classList.add('warm');
    lightCandles(host, function () {
      state.candleLit = true;
      wishPre.hidden = true;
      wishMiddle.hidden = false;
      SFX.click();
      later(function () { wishStage.classList.add('blazing'); }, 900);
    });
  }

  function makeWish() {
    if (state.wishMade) return;
    state.wishMade = true;
    wishBtn.disabled = true;
    SFX.celebrate();
    burstStars(W / 2, H * 0.4, 24);
    burstConfetti(W / 2, H * 0.4, 30);
    burstHearts(W / 2, H * 0.4, 10);
    wishStage.classList.add('blazing');
    wishMiddle.hidden = true;
    wishDone.hidden = false;
    later(function () { showScene('gift'); initGiftScene(); }, 2400);
  }

  /* ---------------- Gift scene ---------------- */
  var gift = $('#gift');
  var openGiftBtn = $('#open-gift-btn');
  var giftReveal = $('#gift-reveal');

  function initGiftScene() {
    if (state.giftOpened) return;
    gift.classList.remove('open', 'shake');
    openGiftBtn.hidden = false;
    giftReveal.hidden = true;
  }

  function openGift() {
    if (state.giftOpened) return;
    state.giftOpened = true;
    openGiftBtn.disabled = true;
    SFX.whoosh();
    gift.classList.add('shake');
    later(function () {
      gift.classList.remove('shake');
      gift.classList.add('open');
      SFX.gift();
      var r = gift.getBoundingClientRect();
      burstStars(r.left + r.width / 2, r.top + r.height / 2, 30);
      burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 40);
      burstHearts(r.left + r.width / 2, r.top + r.height / 2, 14);
    }, 550);
    later(function () {
      openGiftBtn.hidden = true;
      giftReveal.hidden = false;
      SFX.celebrate();
      confettiCannon();
    }, 1500);
  }

  /* ---------------- Final scene ---------------- */
  var finalStage = $('#final-stage');
  var finalCakeWrap = $('#final-cake-wrap');

  function initFinalScene() {
    state.candleLit = true;
    state.finalVisited = true;
    renderCake(finalCakeWrap, 'celebrate');
    later(function () {
      var cakeEl = finalCakeWrap.querySelector('.cake');
      if (cakeEl) cakeEl.classList.add('sparkling');
    }, 900);
    SFX.celebrate();
    confettiCannon();
    burstStars(W / 2, H * 0.6, 26);
    burstHearts(W / 2, H * 0.6, 10);
  }

  function bounceFinalCake() {
    var cakeEl = finalCakeWrap.querySelector('.cake');
    if (!cakeEl) return;
    cakeEl.classList.remove('bounce');
    void cakeEl.offsetWidth;
    cakeEl.classList.add('bounce');
  }

  function toggleCandleFlame(ev) {
    var target = ev.target;
    var candle = target.closest ? target.closest('.cake .candle') : null;
    if (!candle) return false;
    var lit = !candle.classList.contains('lit');
    candle.classList.toggle('lit', lit);
    SFX.candle(0);
    var r = candle.getBoundingClientRect();
    burstStars(r.left + r.width / 2, r.top, 4);
    return true;
  }

  /* ---------------- Replay ---------------- */
  function replay() {
    // stop any scene timers
    clearTimers();
    shutdownAmbient();
    state.base = 'vanilla';
    state.frost = 'vanilla-cream';
    state.toppings = [];
    state.candles = 0;
    state.builderStep = 0;
    state.candleLit = false;
    state.wishMade = false;
    state.giftOpened = false;
    state.finalVisited = false;

    // reset builder UI
    showStep(0);
    nextBtn.hidden = true;
    praise.hidden = true;
    lightCandlesBtn.hidden = true;
    $$('.opt').forEach(function (o) { o.classList.remove('selected'); });
    $$('.opt[data-group="top"]').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });

    // reset wish UI
    wishStage.classList.remove('warm', 'blazing');
    wishPre.hidden = false;
    wishMiddle.hidden = true;
    wishDone.hidden = true;
    lightBtn.disabled = false;
    wishBtn.disabled = false;

    // reset gift UI
    if (gift) gift.classList.remove('open', 'shake');
    openGiftBtn.disabled = false;
    openGiftBtn.hidden = false;
    giftReveal.hidden = true;

    // reset particles
    particles = [];

    // render default cake
    renderCake(builderPreview);
    renderCake($('#wish-cake'));

    // reset scene + countdown visuals
    cdWrap.hidden = false;
    bdReveal.hidden = true;
    last = { d: -1, h: -1, m: -1, s: -1 };
    state.bylineDay = undefined;
    updateCountdown();

    // return to the beginning
    showScene('opening');
    SFX.click();
  }

  /* ---------------- Button ripple ---------------- */
  function ripple(btn, ev) {
    var r = btn.getBoundingClientRect();
    var d = Math.max(btn.offsetWidth, btn.offsetHeight);
    var span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = (d * 2) + 'px';
    var x = (ev.clientX !== undefined ? ev.clientX - r.left : d / 2) - d;
    var y = (ev.clientY !== undefined ? ev.clientY - r.top : d / 2) - d;
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    btn.appendChild(span);
    setTimeout(function () { span.remove(); }, 700);
  }

  function wireClick(btn, fn) {
    if (!btn) return;
    btn.addEventListener('click', function (ev) {
      if (btn.disabled) return;
      SFX.init();
      ripple(btn, ev);
      fn(ev);
    });
  }

  function wireTap(btn, fn) {
    if (!btn) return;
    btn.addEventListener('click', function (ev) {
      if (btn.disabled) return;
      SFX.init();
      fn(ev);
    });
  }

  /* ---------------- Init events ---------------- */
  function init() {
    Music.init();
    buildStars();
    buildBalloons();

    // delegation for option buttons
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.opt') : null;
      if (!btn) return;
      var group = btn.getAttribute('data-group');
      var value = btn.getAttribute('data-value');
      if (!group || !value) return;
      selectInGroup(group, value, btn);
    });

    // opening
    wireClick($('#open-btn'), function () {
      showScene('countdown');
      updateCountdown();
      Music.unlock();
    });

    // countdown -> cake
    wireClick($('#make-cake-btn'), function () {
      showScene('cake');
      initBuilder();
      Music.unlock();
    });

    // builder navigation
    wireClick(nextBtn, function () {
      if (state.builderStep < 3) showStep(state.builderStep + 1);
    });

    // builder -> wish (candle lighting)
    wireClick(lightCandlesBtn, function () {
      showScene('wish');
      renderCake($('#wish-cake'), 'celebrate');
      tipNearWish();
    });

    // wish: light candles
    wireClick(lightBtn, startWishLighting);

    // wish: make wish
    wireClick(wishBtn, makeWish);

    // gift
    wireClick(openGiftBtn, openGift);
    wireClick(gift, openGift);

    // gift -> final
    wireClick($('#to-final-btn'), function () {
      showScene('final');
      initFinalScene();
    });

    // final interactions
    finalStage.addEventListener('click', function (ev) {
      if (toggleCandleFlame(ev)) return;
      var btn = ev.target.closest ? ev.target.closest('#replay-btn') : null;
      if (btn) return;
      var cakeEl = ev.target.closest ? ev.target.closest('.cake') : null;
      if (cakeEl) { bounceFinalCake(); SFX.select(); return; }
      // sparkle on background
      burstDot(ev.clientX, ev.clientY, 5, ['#fff3c4', '#ffd9f2', '#c9d9ff']);
    });

    // final -> replay
    wireClick($('#replay-btn'), replay);

    // music toggle
    wireTap($('#music-btn'), function () { Music.toggle(); });

    // visibility: resume countdown loop via interval already set below
    setInterval(updateCountdown, 1000);
    updateCountdown();

    // kick off opening scene visuals
    showScene('opening');
  }

  function initBuilder() {
    showStep(Math.min(state.builderStep, 3));
    renderCake(builderPreview);
    var selBase = $$('.opt[data-group="base"]').filter(function (o) { return o.getAttribute('data-value') === state.base; });
    var selFrost = $$('.opt[data-group="frost"]').filter(function (o) { return o.getAttribute('data-value') === state.frost; });
    selBase.forEach(function (o) { o.classList.add('selected'); });
    selFrost.forEach(function (o) { o.classList.add('selected'); });
    nextBtn.hidden = state.builderStep >= 3;
  }

  function tipNearWish() {
    // small warm touch when arriving with the cake
    var cakeEl = $('#wish-cake .cake');
    if (cakeEl) {
      cakeEl.classList.remove('celebrate');
      void cakeEl.offsetWidth;
      cakeEl.classList.add('celebrate');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
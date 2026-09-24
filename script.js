/* ============================================================
   Qurat Ul Ain — Interactive Birthday Experience
   14 connected scenes: countdown, cake studio, decoration,
   candle ceremony, wish, mystery gifts, reveal, celebration,
   memory card, final surprise, finale. Optional music.
   Pure vanilla JS. No backend. No tracking.
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
  // 25 Sep 2026 00:00:00 PKT (UTC+05:00) = 2026-09-24 19:00:00 UTC
  var TARGET = Date.UTC(2026, 8, 24, 19, 0, 0);
  var TARGET_LABEL = '25 September 2026 · 00:00 PKT';

  var DEFAULTS = {
    base: 'vanilla',
    frost: 'vanilla-cream',
    message: 'Happy Birthday!',
    toppings: [],
    decorations: [],
    candles: 0,
    gift: null
  };

  var state = {
    scene: 'opening',
    base: DEFAULTS.base,
    frost: DEFAULTS.frost,
    message: DEFAULTS.message,
    toppings: [],
    decorations: [],
    candles: 0,
    builderStep: 0,
    allLit: false,
    wishMade: false,
    wishText: '',
    gift: null,
    revealDone: false,
    surpriseShown: false
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
    whoosh: function () { this.noise(0.18, 0.05); },
    door: function () {
      this.tone(300, 0.6, 'sine', 0.05, 0, 90);
      this.noise(0.5, 0.04, 0.05);
    },
    select: function () {
      this.tone(660, 0.1, 'sine', 0.05);
      this.tone(990, 0.16, 'sine', 0.04, 0.07);
    },
    candle: function (i) { this.tone(520, 0.5, 'sine', 0.05, 0, 700); },
    chime: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        SFX.tone(f, 0.4, 'sine', 0.05, i * 0.09);
      });
    },
    gift: function () {
      this.tone(523, 0.3, 'sine', 0.05);
      this.tone(659, 0.3, 'sine', 0.05, 0.12);
      this.tone(784, 0.4, 'sine', 0.05, 0.24);
      this.tone(1046, 0.6, 'sine', 0.045, 0.36);
    },
    celebrate: function () { this.chime(); }
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
        a.volume = Math.max(0, Math.min(1, from + (target - from) * (k * (2 - k))));
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

  var MUSIC_LEVELS = {
    countdown: 0.12,
    wish: 0.12,
    reveal: 0.3,
    celebration: 0.28,
    final: 0.16
  };

  /* ---------------- Scenes ---------------- */
  var SCENES = ['opening', 'intro', 'countdown', 'door', 'cake', 'decor', 'candles', 'wish', 'gifts', 'reveal', 'celebration', 'memory', 'surprise', 'final'];
  var sceneEls = {};
  SCENES.forEach(function (k) { sceneEls[k] = $('#scene-' + k); });

  function sweep() {
    if (reduceMotion) return;
    var s = $('#sweep');
    if (!s) return;
    s.classList.remove('run');
    void s.offsetWidth;
    s.classList.add('run');
  }

  function showScene(id) {
    if (!countdownCanEnter(id)) {
      SFX.tone(170, 0.16, 'sine', 0.035);
      return;
    }
    if (id === 'countdown') initCountdownScene();
    state.scene = id;
    SCENES.forEach(function (key) {
      var el = sceneEls[key];
      var active = key === id;
      el.classList.toggle('active', active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
    ambientForScene(id);
    reTriggerSceneEffects(id);
    sweep();
    if (!reduceMotion) {
      burstDot(W / 2, H * 0.45, 9, ['#fff3c4', '#ffd9f2', '#c9d9ff', '#ffe28a']);
      spawn({
        type: 'star',
        x: W * 0.25, y: H * 0.75,
        vx: 0.6, vy: -1.3,
        size: 4, life: 1.7, max: 1.7,
        color: ['#ffe28a', '#ffd9f2', '#c9d9ff'][Math.floor(Math.random() * 3)]
      });
    }
    Music.fadeTo(MUSIC_LEVELS[id] || 0.25, 1400);
  }

  /* Re-trigger entrance animations when a scene is shown */
  var REVEAL_SELECTORS = {
    opening: '.opening-line, .btn-start',
    intro: '.intro-line, #scene-intro .btn',
    countdown: '.scene-title, .cd-eyebrow, #cd-slogan, #cd-begins, .cd-byline, .cd-lock, .cd-kicker, .cd-arrived, .cd-open',
    door: '.ghost-line, #door-open-btn, .door-stage',
    cake: '.scene-title, .subtitle, .step',
    decor: '.scene-title, .subtitle, .decor-section, .decor-actions',
    candles: '.candle-text, .candle-cake-wrap',
    wish: '#wish-seqs p, .wish-input-wrap, #hold-area, .wish-sent, #wish-sent-block',
    gifts: '.scene-title, .subtitle, .gift-box, .gift-note',
    reveal: '.reveal-box-wrap, .gift-reveal *',
    celebration: '.final-title, .final-name, .final-date, .final-cake, .celebration-inner > .btn',
    memory: '.scene-title, .subtitle, .memory-card, .mem-actions',
    surprise: '.ghost-line, .soft-line, #scene-surprise .btn',
    final: '.final-title, .final-name, .final-date, .final-cake, .final-actions'
  };

  function reTriggerSceneEffects(id) {
    var scene = sceneEls[id];
    if (id === 'opening') {
      var veil = $('#opening-veil');
      if (veil) { veil.classList.remove('on'); void veil.offsetWidth; veil.classList.add('on'); }
    }
    var sel = REVEAL_SELECTORS[id];
    if (!scene || !sel) return;
    if (id === 'intro') {
      var lines = scene.querySelectorAll('.intro-line');
      Array.prototype.forEach.call(lines, function (el, i) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        el.style.animationDelay = '';
      });
    }
    var list = scene.querySelectorAll(sel);
    Array.prototype.forEach.call(list, function (el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      el.style.animationDelay = '';
    });
  }

  /* ---------------- Background decorations ---------------- */
  function buildStars(host) {
    if (!host) return;
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

  var PETAL_COLORS = ['#ffb3d9', '#ff9ad5', '#ffc7e3', '#f7c9e8', '#ffd6ea'];
  function buildPetals() {
    var host = $('#petals');
    if (!host || reduceMotion) return;
    var count = 9;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'petal';
      p.style.left = (Math.random() * 100) + '%';
      p.style.top = (Math.random() * 100) + '%';
      p.style.setProperty('--dur', (9 + Math.random() * 8).toFixed(1) + 's');
      p.style.setProperty('--delay', (Math.random() * -10).toFixed(1) + 's');
      p.style.setProperty('--drift', (Math.random() * 44 - 22).toFixed(0) + 'px');
      p.style.background = PETAL_COLORS[i % PETAL_COLORS.length];
      host.appendChild(p);
    }
  }

  function buildFloaters() {
    var host = $('#gate-floats');
    if (!host) return;
    var count = reduceMotion ? 6 : 16;
    for (var i = 0; i < count; i++) {
      var f = document.createElement('span');
      f.className = 'fpart';
      f.style.left = (Math.random() * 100) + '%';
      f.style.top = (Math.random() * 100) + '%';
      f.style.setProperty('--dur', (7 + Math.random() * 9).toFixed(1) + 's');
      f.style.setProperty('--delay', (Math.random() * -8).toFixed(1) + 's');
      f.style.setProperty('--dx', (Math.random() * 30 - 15).toFixed(0) + 'px');
      var s = (Math.random() * 3 + 1).toFixed(1) + 'px';
      f.style.width = s;
      f.style.height = s;
      if (Math.random() < 0.3) f.style.background = '#ffe28a';
      else if (Math.random() < 0.5) f.style.background = '#ffc7e3';
      else f.style.background = '#c9d9ff';
      host.appendChild(f);
    }
  }

  /* ---------------- Particle canvas ---------------- */
  var canvas = $('#fx');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var W = 0, H = 0, DPR = 1;
  var particles = [];
  var MAX_PARTICLES = reduceMotion ? 24 : 48;

  function shutdownAmbient() {
    ambientClear.calls.forEach(clearInterval);
    ambientClear.calls = [];
  }
  var ambientClear = { calls: [] };

  function resizeCanvas() {
    if (!ctx) return;
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
    if (particles.length >= MAX_PARTICLES * 2) particles.shift();
    p.inward = p.inward || false;
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

  function burstSparks(x, y, count) {
    for (var i = 0; i < count; i++) {
      var vx = (Math.random() - 0.5) * 1.4;
      var vy = -(Math.random() * 2.2 + 0.8);
      spawn({
        type: 'dot',
        x: x, y: y + 6,
        vx: vx, vy: vy,
        size: Math.random() * 2.2 + 0.8,
        life: Math.random() * 0.6 + 0.4, max: 1,
        color: ['#ffe28a', '#ffd26e', '#fff3c4'][i % 3]
      });
    }
  }

  function petalSpawn() {
    spawn({
      type: 'petal',
      x: Math.random() * W, y: -14,
      vx: (Math.random() - 0.5) * 0.6,
      vy: Math.random() * 1.2 + 0.6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.08,
      size: Math.random() * 5 + 4,
      life: 5, max: 5,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]
    });
  }

  function spawnShootingStar() {
    spawn({
      type: 'shoot',
      x: W * 0.2 + Math.random() * W * 0.6,
      y: Math.random() * H * 0.5,
      vx: -(Math.random() * 4 + 2.5),
      vy: Math.random() * 1.4 + 1,
      size: Math.random() * 1.6 + 1,
      life: 0.9, max: 0.9,
      color: '#fff3c4'
    });
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

  function drawStar(ctx2, r) {
    ctx2.beginPath();
    ctx2.moveTo(0, -r);
    ctx2.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx2.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx2.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx2.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx2.closePath();
    ctx2.fill();
  }

  function loop() {
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= 0.016;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        if (p.inward) {
          var dx = (p.tx !== undefined ? p.tx : W / 2) - p.x;
          var dy = (p.ty !== undefined ? p.ty : H * 0.42) - p.y;
          p.vx = dx * 0.06;
          p.vy = dy * 0.06;
        } else if (p.flipping) {
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
        if (p.rot) { ctx.translate(p.x, p.y); ctx.rotate(p.rot); }
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
        } else if (p.type === 'petal') {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = k * 0.75;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'shoot') {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k * 0.75;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-p.vx * 0.5, -p.vy * 0.5);
          ctx.stroke();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = k;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
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
    var sparkColors = ['#fff3c4', '#ffd9f2', '#c9d9ff'];
    if (sceneId === 'countdown') {
      ambientClear.calls.push(setInterval(function () { petalSpawn(); }, 900));
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, H + 6, 1, sparkColors);
      }, 640));
      ambientClear.calls.push(setInterval(function () { spawnShootingStar(); }, 2600));
    } else if (sceneId === 'intro') {
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, H + 6, 1, sparkColors);
      }, 600));
    } else if (sceneId === 'door') {
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, H * 0.3 + Math.random() * H * 0.4, 1, ['#ffe9b0', '#ffd9f2', '#ffffff']);
      }, 500));
    } else if (sceneId === 'candles' || sceneId === 'wish') {
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, H + 4, 1, ['#ffd9a0', '#ffb0d0']);
      }, 500));
    } else if (sceneId === 'gifts') {
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, Math.random() * H, 1, ['#ffd26e', '#ff8ed0', '#7fd8ff']);
      }, 450));
    } else if (sceneId === 'celebration' || sceneId === 'final') {
      ambientClear.calls.push(setInterval(function () {
        burstConfetti(Math.random() * W, -10, 12);
        if (Math.random() < 0.5) burstHearts(Math.random() * W, -20, 3);
        if (Math.random() < 0.6) petalSpawn();
      }, 700));
      ambientClear.calls.push(setInterval(function () {
        firework(Math.random() * W * 0.8 + W * 0.1, Math.random() * H * 0.4);
      }, 1700));
    } else if (sceneId === 'memory') {
      ambientClear.calls.push(setInterval(function () { petalSpawn(); }, 650));
      ambientClear.calls.push(setInterval(function () {
        burstDot(Math.random() * W, -8, 1, ['#ffb3d9', '#fff3c4', '#c9d9ff']);
      }, 500));
    } else if (sceneId === 'surprise') {
      ambientClear.calls.push(setInterval(function () {
        burstStars(Math.random() * W, -8, 6);
      }, 550));
    }
  }

  function confettiCannon() {
    for (var i = 0; i < 6; i++) {
      later(function () {
        burstConfetti(Math.random() * W * 0.7 + W * 0.15, -10, 12);
      }, i * 180);
    }
  }

  /* ---------------- Countdown — real hard lock ---------------- */
  var cdWrap = $('#cd-wrap');
  var cdDays = $('#cd-days');
  var cdHours = $('#cd-hours');
  var cdMins = $('#cd-mins');
  var cdSecs = $('#cd-secs');
  var cdStage = $('#countdown-stage');
  var bdReveal = $('#bd-reveal');
  var makeCakeBtn = $('#make-cake-btn');
  var last = { d: -1, h: -1, m: -1, s: -1, bylineDay: -1 };

  var countdownState = 'locked'; // 'locked' | 'unlocking' | 'unlocked'
  var cdInitiated = false;

  function getRemainingUntilBirthday() {
    return Math.max(0, TARGET - Date.now());
  }

  // Central navigation guard: everything after the countdown scene stays
  // locked until the countdown has genuinely reached zero.
  function countdownCanEnter(id) {
    if (countdownState === 'unlocked') return true;
    if (id === 'countdown') return true;
    return SCENES.indexOf(id) <= SCENES.indexOf('countdown');
  }

  function setLockUI(unlocked) {
    if (makeCakeBtn) makeCakeBtn.disabled = !unlocked;
  }

  function updateCountdown() {
    if (countdownState === 'unlocked') return;
    var diff = getRemainingUntilBirthday();
    var secs = Math.floor(diff / 1000);
    var d = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    if (d !== last.d) { cdDays.textContent = pad(d); bump(cdDays); last.d = d; }
    if (h !== last.h) { cdHours.textContent = pad(h); bump(cdHours); last.h = h; }
    if (m !== last.m) { cdMins.textContent = pad(m); bump(cdMins); last.m = m; }
    if (s !== last.s) { cdSecs.textContent = pad(s); last.s = s; }
  }

  function checkCountdownUnlock() {
    if (countdownState !== 'locked') return;
    if (getRemainingUntilBirthday() <= 0) startCountdownUnlock();
  }

  function startCountdownUnlock() {
    if (countdownState !== 'locked') return;
    countdownState = 'unlocking';
    SFX.chime();
    if (cdStage) cdStage.classList.add('cd-unlocking');
    if (reduceMotion) {
      finishCountdownUnlock();
      return;
    }
    var hx = W / 2, hy = H * 0.42;
    for (var i = 0; i < 16; i++) {
      spawn({
        type: 'star',
        x: Math.random() * W,
        y: Math.random() * H * 0.85,
        vx: 0, vy: 0,
        inward: true, tx: hx, ty: hy,
        size: Math.random() * 5 + 3,
        life: 1.5 + Math.random() * 0.4, max: 2,
        color: ['#ffe28a', '#ffd9f2', '#c9d9ff', '#fff3c4'][i % 4]
      });
    }
    later(function () {
      burstStars(hx, hy, 20);
      burstDot(hx, hy, 24, ['#ffe28a', '#ffffff', '#ffd26e', '#ffd9f2']);
    }, 820);
    later(finishCountdownUnlock, 2400);
  }

  function finishCountdownUnlock() {
    if (countdownState === 'unlocked') return;
    countdownState = 'unlocked';
    if (cdStage) cdStage.classList.remove('cd-unlocking');
    if (cdWrap) cdWrap.hidden = true;
    if (bdReveal) bdReveal.hidden = false;
    setLockUI(true);
    SFX.chime();
    var hx = W / 2, hy = H * 0.45;
    burstStars(hx, hy, 26);
    burstConfetti(hx, hy, 18);
    burstDot(hx, hy, 26, ['#ffe28a', '#ffd9f2', '#c9d9ff', '#fff3c4']);
    firework(W * 0.28, H * 0.3);
    firework(W * 0.72, H * 0.26);
    var b = makeCakeBtn;
    if (b) b.focus();
  }

  function initCountdownScene() {
    if (!cdInitiated) {
      cdInitiated = true;
    }
    if (countdownState === 'unlocked') {
      if (cdWrap) cdWrap.hidden = true;
      if (bdReveal) bdReveal.hidden = false;
      setLockUI(true);
      return;
    }
    setLockUI(false);
    updateCountdown();
  }

  function tick() {
    updateCountdown();
    checkCountdownUnlock();
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------------- Cake data ---------------- */
  var TOP_EMOJI = {
    strawberry: '🍓', cherry: '🍒', blueberry: '🫐', choco: '🍫',
    sprinkles: '🍬', stars: '✨', hearts: '💗', marshmallow: '🤍',
    cookies: '🍪', candies: '🍭'
  };
  var DECO_EMOJI = {
    stars: '✨', flowers: '🌸', hearts: '💖', confetti: '🎊', rainbow: '🌈'
  };
  var BASE_LABELS = {
    vanilla: 'Vanilla', chocolate: 'Chocolate', strawberry: 'Strawberry',
    blueberry: 'Blueberry', 'red-velvet': 'Red Velvet', lemon: 'Lemon'
  };
  var FROST_LABELS = {
    'vanilla-cream': 'Vanilla Cream', chocolate: 'Chocolate', strawberry: 'Strawberry',
    berry: 'Berry', lemon: 'Lemon', rainbow: 'Rainbow'
  };
  var TOP_LABELS = {
    strawberry: 'Strawberries', cherry: 'Cherries', blueberry: 'Blueberries', choco: 'Chocolate',
    sprinkles: 'Sprinkles', stars: 'Sugar Stars', hearts: 'Hearts', marshmallow: 'Marshmallows',
    cookies: 'Cookies', candies: 'Candies'
  };
  var DECO_LABELS = {
    stars: 'Stars', flowers: 'Flowers', hearts: 'Hearts', confetti: 'Confetti',
    pearls: 'Pearls', rainbow: 'Rainbow'
  };

  function candleMetrics(n) {
    if (n <= 3) return { cw: 13, gap: 9 };
    if (n === 5) return { cw: 11, gap: 7 };
    if (n === 7) return { cw: 9, gap: 5 };
    return { cw: 8, gap: 4 };
  }

  function ringPoints(cx, cy, baseR, count) {
    var pts = [];
    for (var i = 0; i < count; i++) {
      var t = (count === 1 ? 0.5 : i / (count - 1)) * Math.PI;
      var r = baseR + (i % 2 === 1 ? 5 : 0);
      pts.push({
        x: cx + Math.cos(Math.PI - t) * r,
        y: cy - Math.sin(t) * r
      });
    }
    return pts;
  }

  function cakeHTML(opts) {
    var showCandles = !!(opts.candles && opts.candles > 0);
    var candles = '';
    if (showCandles) {
      var m = candleMetrics(opts.candles);
      candles = '<div class="candles" style="--cw:' + m.cw + 'px;--gap:' + m.gap + 'px">';
      for (var i = 0; i < opts.candles; i++) {
        candles += '<div class="candle' + (opts.lit ? ' lit' : '') + '"><span class="flame"></span><span class="halo"></span></div>';
      }
      candles += '</div>';
    }

    var toppings = '';
    if (opts.toppings && opts.toppings.length) {
      toppings = '<div class="toppings">';
      var tp = ringPoints(50, 56, 15, opts.toppings.length);
      for (var j = 0; j < opts.toppings.length; j++) {
        toppings += '<span class="topping" style="left:' + tp[j].x.toFixed(1) + '%;top:' + tp[j].y.toFixed(1) + '%;--i:' + j + '">' +
          TOP_EMOJI[opts.toppings[j]] + '</span>';
      }
      toppings += '</div>';
    }

    var decos = '';
    if (opts.decorations && opts.decorations.length) {
      var dpts = [
        { x: 50, y: 44 }, { x: 22, y: 62 }, { x: 78, y: 62 },
        { x: 50, y: 72 }, { x: 12, y: 80 }, { x: 88, y: 80 },
        { x: 34, y: 86 }, { x: 66, y: 86 }
      ];
      decos = '<div class="decos">';
      for (var k = 0; k < opts.decorations.length; k++) {
        var dv = opts.decorations[k];
        var pt = dpts[k % dpts.length];
        var isPearl = dv === 'pearls';
        decos += '<span class="deco' + (isPearl ? ' pearl' : '') + '" style="left:' + pt.x + '%;top:' + pt.y + '%;--i:' + k + '">' +
          (isPearl ? '' : DECO_EMOJI[dv]) + '</span>';
      }
      decos += '</div>';
    }

    return '<div class="cake' + (opts.extraClass ? ' ' + opts.extraClass : '') + '"' +
      ' data-flavor="' + opts.base + '" data-frost="' + opts.frost + '" role="img"' +
      ' aria-label="A ' + (BASE_LABELS[opts.base] || opts.base) + ' birthday cake' +
      (showCandles ? ' with ' + opts.candles + ' candles' : '') + '">' +
      candles + toppings + decos +
      '<div class="tier tier-top"><span class="frost"></span></div>' +
      '<div class="tier tier-mid"><span class="frost"></span></div>' +
      '<div class="tier tier-bottom"><span class="frost"></span></div>' +
      '<span class="plate"></span></div>';
  }

  function bannerHTML() {
    var msg = state.message;
    if (!msg) return '';
    return '<span class="cake-banner">' + msg + '</span>';
  }

  function renderCake(host, extraClass) {
    if (!host) return;
    host.innerHTML = cakeHTML({
      base: state.base,
      frost: state.frost,
      toppings: state.toppings,
      decorations: state.decorations,
      candles: state.candles,
      lit: state.allLit,
      extraClass: extraClass
    }) + bannerHTML();
  }

  function popCake(host) {
    var cake = host.querySelector('.cake');
    if (!cake) return;
    cake.classList.remove('pop');
    void cake.offsetWidth;
    cake.classList.add('pop');
  }

  function stageCake(host) {
    if (!host || reduceMotion) return;
    var cake = host.querySelector('.cake');
    if (!cake) return;
    host.classList.add('staged');
    animateCakeConstruction(host);
    later(function () { host.classList.remove('staged'); }, 3400);
  }

  function animateCakeConstruction(host) {
    var steps = [
      [80, 'plate', 4],
      [460, 'tier-bottom', 4],
      [840, 'tier-mid', 4],
      [1220, 'tier-top', 5],
      [1580, 'frost', 6],
      [2280, 'toppings', 5],
      [2680, 'decos', 5],
      [2980, 'candles', 8]
    ];
    var base = host.getBoundingClientRect();
    var cake = host.querySelector('.cake');
    var baseRect = cake ? cake.getBoundingClientRect() : base;
    steps.forEach(function (step) {
      later(function () {
        var el = host.querySelector('.' + step[1]);
        var r = el ? el.getBoundingClientRect() : baseRect;
        var cx = r ? (r.left + r.width / 2) : (baseRect.left + baseRect.width / 2);
        var cy = r ? (r.top + r.height / 2) : (baseRect.top + baseRect.height / 2);
        burstDot(cx, cy, step[2], ['#fff3c4', '#ffd9f2', '#ffb3d9', '#ffe28a']);
      }, step[0] + 260);
    });
  }

  /* ---------------- Cake builder (scene 5) ---------------- */
  var builderPreview = $('#cake-preview');
  var nextBtn = $('#next-btn');
  var candleBtn = $('#candles-btn');

  function showStep(n) {
    state.builderStep = n;
    for (var i = 0; i < 3; i++) {
      var stepEl = $('#step-' + i);
      if (stepEl) stepEl.hidden = i !== n;
    }
    nextBtn.hidden = n >= 3;
    if (n === 2) nextBtn.textContent = 'DECORATE ✨';
    else nextBtn.textContent = 'NEXT →';
  }

  function currentOptGroup(btn) {
    return btn.closest('.opts');
  }

  function setRadioSelected(groupEl, value) {
    var list = groupEl.querySelectorAll('.opt');
    Array.prototype.forEach.call(list, function (o) {
      o.classList.toggle('selected', o.getAttribute('data-value') === value);
    });
  }

  /* ---------------- Decoration scene (scene 6) ---------------- */
  var decorPreview = $('#decor-preview');
  var decorCount = $('#decor-count');

  function refreshDecorCount() {
    if (!decorCount) return;
    var parts = [];
    if (state.toppings.length) parts.push(state.toppings.length + ' toppings');
    if (state.decorations.length) parts.push(state.decorations.length + ' decorations');
    decorCount.textContent = parts.length ? 'On the cake: ' + parts.join(' + ') : 'Your cake is ready for decorations...';
  }

  function selectInGroup(group, value, btn) {
    if (builderPreview) builderPreview.classList.remove('staged');
    if (decorPreview) decorPreview.classList.remove('staged');
    var br = btn.getBoundingClientRect();
    burstDot(br.left + br.width / 2, br.top + br.height / 2, 6, ['#ffd26e', '#ff8ed0', '#7fd8ff', '#fff3c4']);
    if (group === 'top' || group === 'deco') {
      var arr = group === 'top' ? state.toppings : state.decorations;
      var idx = arr.indexOf(value);
      var was = idx !== -1;
      btn.classList.toggle('selected', !was);
      btn.setAttribute('aria-pressed', String(!was));
      if (was) arr.splice(idx, 1);
      else {
        if (arr.length >= (group === 'top' ? 8 : 6)) arr.shift();
        arr.push(value);
      }
      renderCake(builderPreview);
      renderCake(decorPreview);
      popCake(decorPreview);
      refreshDecorCount();
      SFX.select();
      return;
    }
    var groupEl = currentOptGroup(btn);
    setRadioSelected(groupEl, value);
    if (group === 'base') state.base = value;
    else if (group === 'frost') state.frost = value;
    else if (group === 'msg') state.message = value;
    else if (group === 'candle') {
      state.candles = parseInt(value, 10);
      candleBtn.disabled = false;
    }
    renderCake(builderPreview);
    renderCake(decorPreview);
    popCake(decorPreview);
    SFX.select();
  }

  function surpriseMe() {
    var bases = Object.keys(BASE_LABELS);
    var frosts = Object.keys(FROST_LABELS);
    var tops = Object.keys(TOP_EMOJI);
    var decos = Object.keys(DECO_EMOJI);
    var msgs = ['Happy Birthday!', 'Make a Wish!', 'Best Day Ever!', 'Birthday Queen!', 'Celebrate Today!'];
    state.base = bases[Math.floor(Math.random() * bases.length)];
    state.frost = frosts[Math.floor(Math.random() * frosts.length)];
    var nT = 2 + Math.floor(Math.random() * 4);
    var nD = 1 + Math.floor(Math.random() * 3);
    var pickedT = [], pickedD = [];
    for (var i = 0; i < nT; i++) pickedT.push(tops[Math.floor(Math.random() * tops.length)]);
    for (var j = 0; j < nD; j++) pickedD.push(decos[Math.floor(Math.random() * decos.length)]);
    state.toppings = pickedT;
    state.decorations = pickedD;
    state.candles = [1, 3, 5, 7, 9][Math.floor(Math.random() * 5)];
    syncSelectionUI();
    renderCake(builderPreview);
    renderCake(decorPreview);
    popCake(decorPreview);
    refreshDecorCount();
    candleBtn.disabled = false;
    SFX.celebrate();
    confettiCannon();
  }

  function resetDecor() {
    state.base = DEFAULTS.base;
    state.frost = DEFAULTS.frost;
    state.toppings = [];
    state.decorations = [];
    state.candles = 0;
    syncSelectionUI();
    renderCake(builderPreview);
    renderCake(decorPreview);
    popCake(decorPreview);
    refreshDecorCount();
    candleBtn.disabled = true;
    SFX.click();
  }

  function syncSelectionUI() {
    $$('.opt[data-group]').forEach(function (o) {
      var g = o.getAttribute('data-group');
      var v = o.getAttribute('data-value');
      if (g === 'top') {
        o.classList.toggle('selected', state.toppings.indexOf(v) !== -1);
        o.setAttribute('aria-pressed', String(state.toppings.indexOf(v) !== -1));
      } else if (g === 'deco') {
        o.classList.toggle('selected', state.decorations.indexOf(v) !== -1);
        o.setAttribute('aria-pressed', String(state.decorations.indexOf(v) !== -1));
      } else if (g === 'base') {
        o.classList.toggle('selected', v === state.base);
      } else if (g === 'frost') {
        o.classList.toggle('selected', v === state.frost);
      } else if (g === 'msg') {
        o.classList.toggle('selected', v === state.message);
      } else if (g === 'candle') {
        o.classList.toggle('selected', v === String(state.candles));
      }
      if (g === 'candle' && String(state.candles) === v) candleBtn.disabled = false;
    });
  }

  function initBuilder() {
    if (builderPreview) builderPreview.classList.remove('staged');
    showStep(Math.min(state.builderStep, 2));
    syncSelectionUI();
    renderCake(builderPreview);
    candleBtn.disabled = !(state.candles > 0);
    stageCake(builderPreview);
  }

  /* ---------------- Candle ceremony (scene 7) ---------------- */
  var candleStage = $('#candle-stage');
  var candlesCake = $('#candles-cake');
  var candlePre = $('#candle-pre');
  var candleDone = $('#candle-done');

  function initCandlesScene() {
    state.allLit = false;
    var m = candleMetrics(state.candles);
    candlesCake.innerHTML = cakeHTML({
      base: state.base, frost: state.frost, toppings: state.toppings,
      decorations: state.decorations, candles: state.candles, lit: false,
      extraClass: 'celebrate', metrics: m
    }) + bannerHTML();
    candlePre.hidden = false;
    candleDone.hidden = true;
    refreshSpotlight();
    later(function () { if (state.scene === 'candles') candleStage.classList.add('dim'); }, 500);
  }

  function refreshSpotlight() {
    var stage = $('#candle-stage');
    if (!stage || !candlesCake) return;
    var cs = candlesCake.querySelectorAll('.candle');
    var ls = candlesCake.querySelectorAll('.candle.lit').length;
    var tot = cs.length;
    stage.style.setProperty('--lit', tot ? (ls / tot).toFixed(2) : '0');
  }

  function lightOneCandle(btn) {
    var candle = btn;
    if (!candle || candle.classList.contains('lit')) return;
    candle.classList.add('lit');
    SFX.candle(0);
    var r = candle.getBoundingClientRect();
    burstSparks(r.left + r.width / 2, r.top, 10);
    burstStars(r.left + r.width / 2, r.top, 5);
    refreshSpotlight();
    checkAllLit();
  }

  function checkAllLit() {
    var candles = candlesCake.querySelectorAll('.candle');
    var lit = candlesCake.querySelectorAll('.candle.lit').length;
    if (lit >= candles.length && candles.length > 0) {
      state.allLit = true;
      refreshSpotlight();
      candlePre.hidden = true;
      candleDone.hidden = false;
      SFX.chime();
      burstStars(W / 2, H * 0.4, 22);
    }
  }

  /* ---------------- Make a wish (scene 8) ---------------- */
  var wishStage = $('#wish-stage');
  var holdBtn = $('#hold-btn');
  var holdFill = $('#hold-fill');
  var holdRing = $('#hold-ring');
  var holdArea = $('#hold-area');
  var wishInput = $('#wish-input');
  var wishSentBlock = $('#wish-sent-block');
  var HOLD_MS = 2000;
  var holdActive = false;
  var holdTimer = null;
  var holdStart = 0;
  var holdProgress = 0;
  var wishComplete = false;

  function setHoldRing(k) {
    if (holdRing) holdRing.style.setProperty('--p', (k * 360).toFixed(1) + 'deg');
  }

  function holdStop() {
    if (wishComplete) return;
    if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
    holdActive = false;
    holdStart = 0;
    holdProgress = 0;
    if (holdFill) holdFill.style.width = '0%';
    setHoldRing(0);
    if (holdBtn) holdBtn.classList.remove('holding');
    if (wishStage) wishStage.classList.remove('holding');
    if (holdBtn && !wishComplete) { holdBtn.disabled = false; }
  }

  function holdStartFn() {
    if (wishComplete || holdActive) return;
    SFX.init();
    holdActive = true;
    holdStart = performance.now();
    holdProgress = 0;
    holdBtn.classList.add('holding');
    if (wishStage) wishStage.classList.add('holding');
    var stepNow = function () {
      if (!holdActive) return;
      var k = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      holdProgress = k;
      if (holdFill) holdFill.style.width = (k * 100).toFixed(1) + '%';
      setHoldRing(k);
      if (k < 1) {
        if (Math.random() < 0.5) {
          var ang = Math.random() * Math.PI * 2;
          var rad = (W > 520 ? 120 : 74) + Math.random() * 40;
          spawn({
            type: 'star', inward: true,
            x: W / 2 + Math.cos(ang) * rad,
            y: H * 0.42 + Math.sin(ang) * rad * 0.45,
            tx: W / 2, ty: H * 0.42,
            vx: 0, vy: 0, size: 3.6, life: 1.3, max: 1.3,
            color: ['#fff3c4', '#ffd9f2', '#ffe28a'][Math.floor(Math.random() * 3)]
          });
        }
      } else {
        holdActive = false;
        holdTimer = null;
        finishWish();
      }
    };
    holdTimer = setInterval(stepNow, 50);
  }

  function finishWish() {
    if (wishComplete) return;
    wishComplete = true;
    state.wishMade = true;
    state.wishText = wishInput.value.trim();
    holdBtn.classList.remove('holding');
    holdBtn.disabled = true;
    if (holdFill) holdFill.style.width = '100%';
    setHoldRing(1);
    wishStage.classList.remove('holding', 'warm');
    wishStage.classList.add('done-flash');
    SFX.celebrate();
    burstStars(W / 2, H * 0.42, 18);
    burstConfetti(W / 2, H * 0.42, 22);
    burstHearts(W / 2, H * 0.42, 8);
    later(function () {
      wishStage.classList.remove('done-flash');
      wishStage.classList.add('blazing');
      burstStars(W / 2, H * 0.42, 26);
      burstDot(W / 2, H * 0.42, 20, ['#ffe28a', '#fff3c4', '#ffd9f2']);
    }, 520);
    later(function () {
      if (holdArea) holdArea.hidden = true;
      if (wishInput) wishInput.hidden = true;
      var lab = $('.wish-input-wrap');
      if (lab) lab.hidden = true;
      if (wishSentBlock) wishSentBlock.hidden = false;
    }, 900);
  }

  function initWishScene() {
    wishStage.classList.remove('blazing', 'done-flash', 'holding');
    wishStage.classList.add('warm');
    wishComplete = false;
    holdStop();
    if (holdArea) holdArea.hidden = false;
    var lab = $('.wish-input-wrap');
    if (lab) lab.hidden = false;
    if (wishInput) {
      wishInput.hidden = false;
      wishInput.value = '';
    }
    if (wishSentBlock) wishSentBlock.hidden = true;
  }

  /* ---------------- Mystery gifts (scene 9) ---------------- */
  var giftRow = $('#gift-row');
  var giftNote = $('#gift-picked-note');

  function initGiftScene() {
    if (!giftRow) return;
    $$('.gift-box', giftRow).forEach(function (b) {
      b.disabled = false;
      b.classList.remove('selected', 'dimmed');
    });
    giftNote.hidden = true;
  }

  function pickGift(box) {
    var value = box.getAttribute('data-value');
    state.gift = value;
    $$('.gift-box').forEach(function (b) {
      b.disabled = true;
      if (b !== box) b.classList.add('dimmed');
    });
    box.classList.add('selected');
    giftNote.hidden = false;
    SFX.select();
    var r = box.getBoundingClientRect();
    burstStars(r.left + r.width / 2, r.top + r.height / 2, 12);
    burstDot(r.left + r.width / 2, r.top + r.height / 2, 14, ['#ffd26e', '#ff8ed0', '#fff3c4']);
    later(function () { showScene('reveal'); initRevealScene(); }, 1800);
  }

  /* ---------------- Gift reveal (scene 10) ---------------- */
  var revealBox = $('#reveal-box');
  var revealEmoji = $('#reveal-emoji');
  var revealMsg = $('#reveal-msg');
  var revealVeil = $('#reveal-veil');

  function initRevealScene() {
    if (revealVeil) { revealVeil.classList.remove('on'); void revealVeil.offsetWidth; }
    if (state.revealDone) {
      revealMsg.hidden = false;
      return;
    }
    state.revealDone = true;
    revealMsg.hidden = true;
    if (revealEmoji) revealEmoji.textContent = state.gift || '🎁';
    revealBox.classList.remove('open');
    void revealBox.offsetWidth;
    later(function () {
      revealBox.classList.add('open');
      SFX.whoosh();
    }, 450);
    later(function () {
      SFX.gift();
      var r = revealBox.getBoundingClientRect();
      burstStars(r.left + r.width / 2, r.top + r.height / 2, 30);
      burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 40);
      burstHearts(r.left + r.width / 2, r.top + r.height / 2, 14);
    }, 850);
    later(function () {
      if (revealVeil) revealVeil.classList.add('on');
    }, 1250);
    later(function () {
      burstDot(W / 2, H * 0.42, 16, ['#ffe28a', '#ffd9a0', '#fff3c4']);
    }, 1600);
    later(function () {
      burstDot(W / 2, H * 0.42, 22, ['#ffe28a', '#ffffff', '#ffd26e']);
      burstStars(W / 2, H * 0.42, 20);
    }, 2100);
    later(function () {
      if (revealVeil) revealVeil.classList.remove('on');
      revealMsg.hidden = false;
      SFX.chime();
      confettiCannon();
      burstStars(W / 2, H * 0.42, 30);
      burstDot(W / 2, H * 0.42, 24, ['#ffd9f2', '#c9d9ff', '#ffe28a']);
    }, 2650);
  }

  /* ---------------- Celebration (scene 11) ---------------- */
  var celebrationCake = $('#celebration-cake');
  var celebrationStage = $('#celebration-stage');

  function initCelebration() {
    state.allLit = true;
    renderCake(celebrationCake, 'celebrate');
    later(function () {
      var c = celebrationCake.querySelector('.cake');
      if (c) c.classList.add('sparkling');
    }, 900);
    SFX.celebrate();
    confettiCannon();
    burstStars(W / 2, H * 0.5, 22);
    burstConfetti(W / 2, H * 0.5, 26);
  }

  /* ---------------- Memory card (scene 12) ---------------- */
  var memoryCake = $('#memory-cake');

  function prettyList(arr, labels) {
    return arr.length ? arr.map(function (v) { return labels[v] || v; }).join(', ') : '—';
  }

  function initMemory() {
    renderCake(memoryCake);
    var mf = $('#mem-flavor');
    if (mf) mf.textContent = BASE_LABELS[state.base] || state.base;
    var mfr = $('#mem-frost');
    if (mfr) mfr.textContent = FROST_LABELS[state.frost] || state.frost;
    var mt = $('#mem-toppings');
    if (mt) mt.textContent = prettyList(state.toppings, TOP_LABELS);
    var mc = $('#mem-candles');
    if (mc) mc.textContent = state.candles > 0 ? state.candles + (state.candles === 1 ? ' candle' : ' candles') : '—';
    var mm = $('#mem-message');
    if (mm) mm.textContent = state.message;
  }

  /* ---------------- One last surprise (scene 13) ---------------- */
  var surpriseReveal = $('#surprise-reveal');

  function startLastSurprise() {
    SFX.gift();
    surpriseReveal.classList.add('show');
    surpriseReveal.setAttribute('aria-hidden', 'false');
    burstStars(W / 2, H * 0.5, 30);
    burstConfetti(W / 2, H * 0.5, 40);
    burstHearts(W / 2, H * 0.5, 12);
    firework(W * 0.3, H * 0.3);
    firework(W * 0.7, H * 0.25);
    SFX.celebrate();
    later(function () {
      surpriseReveal.classList.remove('show');
      surpriseReveal.setAttribute('aria-hidden', 'true');
      showScene('final');
      initFinalScene();
    }, 3600);
  }

  /* ---------------- Final screen (scene 14) ---------------- */
  var finalCake = $('#final-cake');
  var finalStage = $('#final-stage');

  function initFinalScene() {
    state.allLit = true;
    renderCake(finalCake, 'celebrate');
    later(function () {
      var c = finalCake.querySelector('.cake');
      if (c) c.classList.add('sparkling');
    }, 900);
    SFX.celebrate();
    confettiCannon();
  }

  function bounceCake(host) {
    var cakeEl = host.querySelector('.cake');
    if (!cakeEl) return;
    cakeEl.classList.remove('bounce');
    void cakeEl.offsetWidth;
    cakeEl.classList.add('bounce');
  }

  function toggleCandleFlame(ev) {
    var t = ev.target;
    if (!t || !t.closest) return false;
    var c = t.closest('.cake .candle');
    if (!c) return false;
    var lit = !c.classList.contains('lit');
    c.classList.toggle('lit', lit);
    SFX.candle(0);
    var r = c.getBoundingClientRect();
    burstStars(r.left + r.width / 2, r.top, 4);
    return true;
  }

  /* ---------------- Replay / remake / wish again ---------------- */
  function resetCakeSelections() {
    state.base = DEFAULTS.base;
    state.frost = DEFAULTS.frost;
    state.message = DEFAULTS.message;
    state.toppings = [];
    state.decorations = [];
    state.candles = 0;
    state.allLit = false;
  }

  function replay() {
    clearTimers();
    shutdownAmbient();
    resetCakeSelections();
    state.builderStep = 0;
    state.wishMade = false;
    state.wishText = '';
    state.gift = null;
    state.revealDone = false;
    state.surpriseShown = false;

    // builder + decor UI
    showStep(0);
    nextBtn.hidden = true;
    syncSelectionUI();
    renderCake(builderPreview);
    renderCake(decorPreview);
    if (builderPreview) builderPreview.classList.remove('staged');
    if (decorPreview) decorPreview.classList.remove('staged');
    refreshDecorCount();
    candleBtn.disabled = true;

    // door
    var doorStage = $('#door-stage');
    if (doorStage) doorStage.classList.remove('opening', 'zoom');
    if (doorStage) doorStage.style.transform = '';
    var doorBtn = $('#door-open-btn');
    if (doorBtn) doorBtn.disabled = false;

    // candle ceremony
    candleStage.classList.remove('dim');
    candleStage.style.setProperty('--lit', '0');
    candlePre.hidden = false;
    candleDone.hidden = true;

    // wish UI
    wishStage.classList.remove('warm', 'blazing', 'done-flash', 'holding');
    if (holdArea) holdArea.hidden = false;
    var lab = $('.wish-input-wrap');
    if (lab) lab.hidden = false;
    if (wishInput) { wishInput.hidden = false; wishInput.value = ''; }
    if (wishSentBlock) wishSentBlock.hidden = true;
    wishComplete = false;
    holdStop();

    // gifts + reveal
    $$('.gift-box').forEach(function (b) { b.disabled = false; b.classList.remove('selected', 'dimmed'); });
    giftNote.hidden = true;
    if (revealVeil) { revealVeil.classList.remove('on'); }
    if (revealBox) {
      revealBox.classList.remove('open');
      if (revealEmoji) revealEmoji.textContent = '🎁';
    }
    if (revealMsg) revealMsg.hidden = true;

    // surprise overlay
    surpriseReveal.classList.remove('show');
    surpriseReveal.setAttribute('aria-hidden', 'true');

    // countdown visuals — re-lock unless the real target has already passed
    countdownState = 'locked';
    cdWrap.hidden = false;
    bdReveal.hidden = true;
    if (cdStage) cdStage.classList.remove('cd-unlocking');
    setLockUI(false);
    cdInitiated = false;
    last = { d: -1, h: -1, m: -1, s: -1, bylineDay: -1 };
    updateCountdown();
    checkCountdownUnlock();

    // particles
    particles = [];

    showScene('opening');
    SFX.click();
  }

  /* ---------------- Button ripple + wiring ---------------- */
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

  /* ---------------- Password gate (UI/content lock only) ---------------- */
  var gate = $('#gate');
  var gateInput = $('#gate-input');
  var gateToggle = $('#gate-toggle');
  var gateUnlock = $('#gate-unlock');
  var gateError = $('#gate-error');
  var gateCard = gate ? gate.querySelector('.gate-card') : null;
  var gateOpen = false;

  // Compare against the secret code, case-insensitively.
  function gateCodeMatches(raw) {
    return (raw || '').trim().toLowerCase() === '25-sep';
  }

  function gateShake() {
    if (!gateCard) return;
    gateCard.classList.remove('shake');
    void gateCard.offsetWidth;
    gateCard.classList.add('shake');
  }

  function tryUnlock() {
    if (gateOpen || !gateInput) return;
    SFX.init();
    if (gateCodeMatches(gateInput.value)) {
      unlockGate();
    } else {
      SFX.tone(200, 0.22, 'sine', 0.045);
      if (gateError) gateError.hidden = false;
      gateShake();
      gateInput.value = '';
      gateInput.focus();
    }
  }

  function unlockGate() {
    if (gateOpen) return;
    gateOpen = true;
    if (gateError) gateError.hidden = true;
    SFX.chime();
    document.body.classList.remove('locked');
    burstStars(W / 2, H * 0.45, 26);
    burstDot(W / 2, H * 0.45, 34, ['#ffe28a', '#fff3c4', '#ffd9f2', '#c9d9ff']);
    burstConfetti(W / 2, H * 0.45, 12);
    if (gate) {
      gate.classList.add('leaving');
      gate.setAttribute('aria-hidden', 'true');
      later(function () {
        if (gate) gate.hidden = true;
        if (gateInput) gateInput.value = '';
      }, 1150);
      later(function () {
        var openBtn = $('#open-btn');
        if (openBtn) openBtn.focus();
      }, 1200);
    }
  }

  function initGate() {
    buildStars($('#gate-stars'));
    buildFloaters();
    if (!gate || !gateInput || !gateUnlock) {
      document.body.classList.remove('locked');
      return;
    }
    if (!reduceMotion) {
      later(function () {
        var it = $('#gate-intro');
        if (it) it.classList.add('done');
      }, 2000);
    }
    gateUnlock.addEventListener('click', tryUnlock);
    gateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
    });
    gateInput.addEventListener('input', function () {
      if (gateError && !gateError.hidden) gateError.hidden = true;
    });
    if (gateToggle) {
      gateToggle.addEventListener('click', function () {
        if (!gateInput) return;
        var showing = gateInput.type === 'text';
        gateInput.type = showing ? 'password' : 'text';
        gateToggle.textContent = showing ? 'SHOW' : 'HIDE';
        gateToggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
        gateInput.focus();
      });
    }
    gateInput.focus();
  }

  /* ---------------- Init ---------------- */
  function init() {
    initGate();
    Music.init();
    buildStars($('#stars'));
    buildBalloons();
    buildPetals();

    // delegation for option buttons (builder + decoration)
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.opt') : null;
      if (!btn) return;
      var group = btn.getAttribute('data-group');
      var value = btn.getAttribute('data-value');
      if (!group || !value) return;
      selectInGroup(group, value, btn);
    });

    // S1 opening -> intro
    wireClick($('#open-btn'), function () {
      showScene('intro');
      Music.unlock();
    });

    // S2 intro -> countdown
    wireClick($('#intro-btn'), function () {
      showScene('countdown');
      updateCountdown();
    });

    // S3 countdown -> door
    wireClick($('#make-cake-btn'), function () {
      showScene('door');
      Music.unlock();
    });

    // S4 door open
    wireClick($('#door-open-btn'), function () {
      var stage = $('#door-stage');
      if (stage.classList.contains('opening')) return;
      stage.classList.add('opening');
      SFX.door();
      var r = stage.getBoundingClientRect();
      burstStars(r.left + r.width / 2, r.top + r.height / 2, 24);
      burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 30);
      $('#door-open-btn').disabled = true;
      later(function () {
        stage.classList.add('zoom');
        later(function () {
          showScene('cake');
          initBuilder();
          $('#door-open-btn').disabled = false;
        }, 600);
      }, 900);
    });

    // S5 builder next
    wireClick(nextBtn, function () {
      if (state.builderStep === 2) {
        showScene('decor');
        renderCake(decorPreview);
        stageCake(decorPreview);
        refreshDecorCount();
        candleBtn.disabled = !(state.candles > 0);
      } else if (state.builderStep < 2) {
        showStep(state.builderStep + 1);
      }
    });

    // S5 -> back to builder from decor
    wireClick($('#back-btn'), function () {
      showScene('cake');
      initBuilder();
    });

    // S6 decor: surprise / reset / candles
    wireClick($('#surprise-btn'), surpriseMe);
    wireClick($('#reset-btn'), resetDecor);
    wireClick(candleBtn, function () {
      showScene('candles');
      initCandlesScene();
    });

    // S7 candle ceremony: tap each candle
    candleStage.addEventListener('click', function (ev) {
      if (state.scene !== 'candles') return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (ev.target.closest('#make-wish-btn')) return;
      var c = t.closest('.cake .candle');
      if (!c) return;
      lightOneCandle(c);
    });

    // S7 -> S8
    wireClick($('#make-wish-btn'), function () {
      showScene('wish');
      initWishScene();
    });

    // S8 hold to wish
    if (holdBtn) {
      holdBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); holdStartFn(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
        holdBtn.addEventListener(evt, function () { holdStop(); });
      });
      holdBtn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); holdStartFn(); }
      });
      holdBtn.addEventListener('keyup', function () { holdStop(); });
    }

    // S8 -> gifts
    wireClick($('#show-gift-btn'), function () {
      showScene('gifts');
      initGiftScene();
    });

    // S9 gift boxes
    giftRow.addEventListener('click', function (ev) {
      if (state.scene !== 'gifts') return;
      var box = ev.target.closest ? ev.target.closest('.gift-box') : null;
      if (!box || box.disabled) return;
      pickGift(box);
    });

    // S10 -> celebration
    wireClick($('#celebrate-btn'), function () {
      showScene('celebration');
      initCelebration();
    });

    // S11 -> memory
    wireClick($('#memory-btn'), function () {
      showScene('memory');
      initMemory();
    });

    // S12 celebrate again / one more thing
    wireClick($('#again-btn'), function () {
      showScene('celebration');
      initCelebration();
    });
    wireClick($('#surprise-btn2'), function () {
      showScene('surprise');
    });

    // S13 last surprise
    wireClick($('#last-surprise-btn'), startLastSurprise);

    // S14 final: replay / remake / wish again
    wireClick($('#replay-btn'), replay);
    wireClick($('#remake-btn'), function () {
      resetCakeSelections();
      syncSelectionUI();
      showScene('cake');
      initBuilder();
    });
    wireClick($('#wish2-btn'), function () {
      showScene('wish');
      initWishScene();
    });

    // final stage playful interactions
    if (finalStage) {
      finalStage.addEventListener('click', function (ev) {
        if (toggleCandleFlame(ev)) return;
        var cakeEl = ev.target.closest ? ev.target.closest('.cake') : null;
        if (cakeEl) { bounceCake(finalCake); return; }
      });
    }
    if (celebrationStage) {
      celebrationStage.addEventListener('click', function (ev) {
        if (toggleCandleFlame(ev)) return;
        var cakeEl = ev.target.closest ? ev.target.closest('.cake') : null;
        if (cakeEl) { bounceCake(celebrationCake); return; }
      });
    }

    // music toggle
    var mBtn = $('#music-btn');
    if (mBtn) {
      mBtn.addEventListener('click', function () { Music.toggle(); });
    }

    setInterval(tick, 1000);
    tick();

    showScene('opening');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
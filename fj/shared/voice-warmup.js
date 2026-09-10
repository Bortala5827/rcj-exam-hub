// rcj-interaction-assets / voice/voice-particles 提取版（IIFE 全局挂载）
// 声纹驱动表情蹦跳 —— 面试开麦前热身用
//
// 用法：
//   RCJVoiceWarmup.mount({ stageId:'vwarm-stage', btnId:'vwarm-btn', subId:'vwarm-sub',
//                         faces:['','','','',''] });
// 返回 { start, stop, destroy }
(function () {
  'use strict';

  function mount(opts) {
    opts = opts || {};
    var stage = document.getElementById(opts.stageId);
    var btn = document.getElementById(opts.btnId);
    var sub = document.getElementById(opts.sub);
    var faces = opts.faces || ['', '', '', '', ''];
    var sensitivity = opts.sensitivity || 3.4;
    var defaultSub = sub ? sub.textContent : '';

    if (!stage) return { start: function () {}, stop: function () {}, destroy: function () {} };

    // 注入表情节点
    if (!stage.children.length && faces.length) {
      faces.forEach(function (e) {
        var s = document.createElement('span');
        s.className = 'vw-face';
        s.setAttribute('data-face', '');
        s.textContent = e;
        stage.appendChild(s);
      });
    }
    var faceEls = stage.querySelectorAll('[data-face]');
    if (!faceEls.length) return { start: function () {}, stop: function () {}, destroy: function () {} };

    var audioCtx, analyser, data, stream, raf, running = false;

    function rms() {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
      return Math.sqrt(sum / data.length);
    }

    function loop() {
      var norm = Math.min(1, rms() * sensitivity);
      var t = performance.now();
      faceEls.forEach(function (f, i) {
        var phase = i * 0.55;
        var wob = Math.sin(t / 220 + phase);
        var dy = -norm * (24 + i * 3) * (0.6 + 0.4 * Math.abs(wob));
        var sc = 1 + norm * 0.45;
        var rot = norm * 14 * wob + (i % 2 ? 1 : -1) * norm * 7;
        f.style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(2) + ') rotate(' + rot.toFixed(1) + 'deg)';
      });
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (sub) sub.textContent = '当前浏览器不支持麦克风，用手机打开体验更佳 ';
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s;
        var AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        var src = audioCtx.createMediaStreamSource(s);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        data = new Uint8Array(analyser.fftSize);
        src.connect(analyser);
        running = true;
        if (btn) { btn.textContent = ' 停止热身'; btn.classList.add('on'); }
        if (sub) sub.textContent = '对着麦克风随便说几句，看表情跟着声纹蹦 ';
        loop();
      }).catch(function () {
        if (sub) sub.textContent = '麦克风权限被拒了，点「开始」再授权一次 ';
      });
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      if (audioCtx) audioCtx.close().catch(function () {});
      stream = audioCtx = analyser = data = null;
      faceEls.forEach(function (f) { f.style.transform = ''; });
      if (btn) { btn.textContent = ' 开始声纹热身'; btn.classList.remove('on'); }
      if (sub) sub.textContent = defaultSub || '对着麦克风说几句 —— 表情跟着声纹蹦。';
    }

    if (btn) btn.addEventListener('click', function () { return running ? stop() : start(); });
    return { start: start, stop: stop, destroy: stop };
  }

  window.RCJVoiceWarmup = { mount: mount };
})();

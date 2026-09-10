/*
 * rcj-voice.js — 语音练习日志统一模块
 * ------------------------------------------------------------
 * 事实标准 = structured.html 的练习日志模板（题目 2 行成行 + 分类标签 + 回放 + 备注）。
 * 各站（深圳辅警 sz 等）统一复用本模块，不再各自手写录音日志渲染 / CSS，避免重复造轮子。
 * 纯本地：不依赖任何云资源，blob 回放走原生 audio 控件。
 *
 * 用法：
 *   <script src="rcj-voice.js"></script>
 *   RCJVoice.renderVoiceLogInto(listEl, items, {
 *     stationLabel: '辅警练习',
 *     onDelete: function(id){...},
 *     onDownload: function(blob, id){...},
 *     onUpdateNote: function(id, note){...}
 *   });
 *   RCJVoice.GUIDE.afterRecord('首屏「 我的练习录音」') -> 引导语
 */
(function () {
  'use strict';

  // ── 统一样式（随模块注入一次，页面无需再写 .voice-log-* CSS）──
  var CSS = [
    '.voice-log{margin:10px 0 4px}',
    '.voice-log-title{font-size:.82rem;font-weight:700;color:#374151;margin:0 0 6px;display:flex;align-items:center;gap:6px}',
    '.voice-log-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}',
    '.voice-log-empty{font-size:.78rem;color:#9ca3af;text-align:center;padding:12px 0}',
    '.voice-log-dl{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:.82rem;padding:2px 4px;border-radius:4px;transition:color .15s}',
    '.voice-log-dl:hover{color:#2563eb}',
    '.voice-log-foot{margin-top:10px;padding-top:10px;border-top:1px dashed #eef2ff}',
    '.voice-log-export{display:inline-block;margin-bottom:6px;padding:5px 12px;border:1px solid #e0e7ff;background:#eef2ff;color:#4338ca;border-radius:8px;font-size:.76rem;cursor:pointer;transition:background .15s}',
    '.voice-log-export:hover{background:#e0e7ff}',
    '.voice-log-note{margin:4px 0 0;font-size:.74rem;line-height:1.6;color:#94a3b8}',
    '.voice-log-item{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:#f9fafb;border:1px solid #f3f4f6;font-size:.78rem;transition:background .15s}',
    '.voice-log-item:hover{background:#f3f4f6}',
    '.voice-log-meta{display:flex;align-items:center;gap:8px;flex:1 1 100%;flex-wrap:wrap}',
    '.voice-log-time{color:#6b7280;white-space:nowrap;min-width:72px}',
    '.voice-log-dur{color:#4f46e5;font-weight:600;white-space:nowrap;min-width:36px}',
    '.voice-log-cat{font-size:.7rem;font-weight:600;color:#6d28d9;background:#f5f3ff;border:1px solid #ede9fe;border-radius:999px;padding:2px 8px;white-space:nowrap}',
    '.voice-log-audio{flex:1 1 100%;width:100%;height:32px;margin-top:2px}',
    '.voice-log-del{background:none;border:none;color:#d1d5db;cursor:pointer;font-size:.82rem;padding:2px 4px;border-radius:4px;transition:color .15s}',
    '.voice-log-del:hover{color:#ef4444}',
    '.voice-log-remark{flex:1 1 100%;min-width:100%;width:100%;margin-top:6px;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:6px 9px;font-size:.78rem;box-sizing:border-box;resize:vertical;min-height:30px;background:var(--surface,#fff);color:var(--text,#1e293b);font-family:inherit;line-height:1.5}',
    '.voice-log-remark:focus{outline:none;border-color:#93c5fd;box-shadow:0 0 0 2px rgba(59,130,246,.12)}',
    '.voice-log-q{flex:1 1 100%;width:100%;margin:2px 0 3px;font-size:.82rem;line-height:1.55;font-weight:500;color:#334155;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis}',
    '.voice-log-play{background:#4f46e5;color:#fff;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.7rem;flex:none;line-height:1}',
    '.voice-log-play:hover{background:#4338ca}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('rcj-voice-css')) return;
    var style = document.createElement('style');
    style.id = 'rcj-voice-css';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(ts) {
    var d = new Date(ts || Date.now());
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtDur(durMs) {
    var sec = Math.round((durMs || 0) / 1000);
    return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
  }
  // 兼容两套存储：sz 的 {ts,duration,question,blob,catLabel} 与 structured 的 {createdAt,durMs,q,audioBlob,catLabel}
  function normItem(it) {
    if (!it) return { id: '', q: '', catLabel: '', time: Date.now(), durMs: 0, blob: null, note: '' };
    var q = it.q || it.question || '';
    var time = it.createdAt || it.ts || Date.now();
    var durMs = (it.durMs != null) ? it.durMs
      : (it.duration != null) ? it.duration * 1000
      : (it.durationSec || 0) * 1000;
    var blob = it.audioBlob || it.blob || null;
    return { id: it.id, q: q, catLabel: it.catLabel || '', time: time, durMs: durMs, blob: blob, note: it.note || '' };
  }

  function renderVoiceLogInto(listEl, items, opts) {
    opts = opts || {};
    if (!listEl) return;
    injectCss();
    // 回收本列表已创建的 object URL（按列表隔离，多个列表同享 items 互不干扰）
    if (listEl.__rcjUrls) {
      listEl.__rcjUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    }
    listEl.__rcjUrls = [];
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    items = items || [];
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'voice-log-empty';
      empty.textContent = opts.emptyText || '暂无录音，点「 随机抽题」开口练一练吧';
      listEl.appendChild(empty);
      return;
    }
    items.forEach(function (raw) {
      var it = normItem(raw);
      var item = document.createElement('div');
      item.className = 'voice-log-item';

      var meta = document.createElement('div'); meta.className = 'voice-log-meta';
      var t = document.createElement('span'); t.className = 'voice-log-time'; t.textContent = fmtTime(it.time);
      var du = document.createElement('span'); du.className = 'voice-log-dur'; du.textContent = fmtDur(it.durMs);
      var cat = document.createElement('span'); cat.className = 'voice-log-cat';
      cat.textContent = it.catLabel || (opts.stationLabel || '练习');
      meta.appendChild(t); meta.appendChild(du); meta.appendChild(cat);

      // 题目：完整显示（最多 2 行），参照 structured 的 sess-q 风格
      var q = document.createElement('div'); q.className = 'voice-log-q';
      q.textContent = it.q || '练习录音';
      q.title = it.q || '';

      // 原生 audio 控件：跨浏览器（iOS/Safari/微信）最可靠的 blob 回放方式
      var audio = document.createElement('audio');
      audio.className = 'voice-log-audio';
      audio.controls = true; audio.preload = 'none';
      if (it.blob && it.blob.size) {
        try {
          var url = URL.createObjectURL(it.blob);
          listEl.__rcjUrls.push(url);
          audio.src = url;
        } catch (e) { audio.controls = false; }
      } else { audio.controls = false; }

      var dl = document.createElement('button'); dl.type = 'button'; dl.className = 'voice-log-dl';
      dl.textContent = ''; dl.title = '下载到本机（免费，存到你自己的设备）';
      dl.onclick = function () { if (opts.onDownload) opts.onDownload(it.blob, it.id); };

      var del = document.createElement('button'); del.type = 'button'; del.className = 'voice-log-del';
      del.textContent = ''; del.title = '删除这条录音';
      del.onclick = function () { if (opts.onDelete) opts.onDelete(it.id); };

      // 备注：blur 即存（卡壳点 / 改进方向）
      var note = document.createElement('textarea'); note.className = 'voice-log-remark';
      note.placeholder = '写点备注，比如卡壳的地方、改进方向…';
      note.value = it.note || '';
      note.addEventListener('blur', function () {
        if (opts.onUpdateNote) opts.onUpdateNote(it.id, note.value.replace(/\s+$/, ''));
      });

      item.appendChild(meta);
      item.appendChild(q);
      item.appendChild(audio);
      item.appendChild(dl);
      item.appendChild(del);
      item.appendChild(note);
      listEl.appendChild(item);
    });
  }

  // 录音结束引导语：各站统一文案，where 描述录音存到哪
  var GUIDE = {
    afterRecord: function (where) {
      return ' 已保存到' + (where || '本机练习日志') + '，随时回放全部练习';
    }
  };

  window.RCJVoice = {
    renderVoiceLogInto: renderVoiceLogInto,
    GUIDE: GUIDE,
    _injectCss: injectCss
  };
})();

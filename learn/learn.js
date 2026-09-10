/* LEARN 1.0 · 核心逻辑（牌堆模式）
 * - 牌堆：顶层卡可刷，后面叠 1~2 张从上缘探出，刷走后下一张顶上来
 * - 手势：纵向=浏览器原生滚动(像看小说，跟手丝滑) / 左滑=下一张 / 右滑=上一张；收藏只走  / 底部「收藏」按钮，不拦截下滑
 * - 卡片过长时浏览器原生滚动，跟手、惯性、丝滑，无需额外滑块
 * - 推荐：70% 兴趣 + 20% 邻近 + 10% 随机探索
 * - 行为存 localStorage（零云、零成本；后续可平滑迁 IndexedDB）
 * - 操作历史栈支持「回到上一题」，且跨刷新保留
 */
(function () {
  "use strict";
  var DATA = window.LEARN_CARDS || [];
  var byId = {};
  DATA.forEach(function (c) { byId[c.id] = c; });

  // 兴趣索引：节点标签 -> 卡片 id 列表（点节点深入用）
  var nodeIndex = {};
  DATA.forEach(function (c) {
    (c.tags || []).forEach(function (t) { (nodeIndex[t] = nodeIndex[t] || []).push(c.id); });
  });

  // 节点文字 -> 含该节点的卡片 id 列表（点节点深入用，覆盖所有卡片的 nodes）
  var nodeToCards = {};
  DATA.forEach(function (c) {
    (c.nodes || []).forEach(function (n) { (nodeToCards[n] = nodeToCards[n] || []).push(c.id); });
  });

  /* ---------- 顶层主题（知识地图 10 大主线）----------
   * 这 10 个词是卡片 tags 里的「骨架维度」，此前只作为死标签显示、没有任何映射。
   * 现在把它们做成真筛选：点主题  按 tag 过滤；点任意卡片 tag  跳该 tag 筛选。 */
  var THEMES = ["城市", "产业", "财政", "制度", "就业", "稳定", "职业", "投资", "考公", "风险"];
  var themeSet = {}; THEMES.forEach(function (t) { themeSet[t] = 1; });
  // 主题 -> 含该主题 tag 的卡片列表（用于计数与「我的」按主题分组）
  var themeCards = {};
  THEMES.forEach(function (t) { themeCards[t] = []; });
  DATA.forEach(function (c) {
    (c.tags || []).forEach(function (t) { if (themeSet[t]) themeCards[t].push(c.id); });
  });

  /* ---------- 行为存储 ---------- */
  var KEY = "rcj_learn_v1";
  var state = load();

  /* ---------- My take 引导弹窗(用户多次刷卡后,提示跳结构化即兴表达) ----------
   * - 触发:累计刷 8~14 张首次,之后每 6~11 张再触发一次,同 session 最多 3 次
   * - session = 本次页面加载,跨刷新重置(避免骚扰)
   * - 用户点了主按钮跳转  同 session 静默不再弹(已行动)
   * - 用户点"先存着"或   算一次弹过,继续计数
   * - 阈值随机化:首次 8~14 随机,之后增量 6~11 随机,避免每次都在第10/18/26张弹 */
  var sessionSwipeCount = 0;     // 本次页面加载累计刷卡数(act + goTo 都算)
  var sessionPromptShown = 0;    // 本次页面加载已弹窗次数
  var sessionNextPromptAt = 8 + Math.floor(Math.random() * 7);  // 首次 8~14 随机
  var sessionPromptSilent = false; // 用户已跳转行动过,本 session 静默
  var PROMPT_MAX = 3;            // 每 session 最多弹几次
  var promptToastEl = null;      // 当前 toast DOM 元素(有值≠正在显示,须另判断可见性)

  function countSwipe(curId) {
    if (sessionPromptSilent) return;
    if (promptToastEl && promptToastEl.classList.contains("show")) return;     // 已在显示,不重入(隐藏后 DOM 仍存在,不能仅判 null)
    if (sessionPromptShown >= PROMPT_MAX) return;
    sessionSwipeCount++;
    if (sessionSwipeCount >= sessionNextPromptAt) {
      showPromptToast(curId);
    }
  }

  function showPromptToast(cardId) {
    var card = byId[cardId];
    if (!card) card = queue[0];
    if (!card) return;
    sessionPromptShown++;
    // 下次阈值:当前计数 + 6~11 随机增量
    sessionNextPromptAt = sessionSwipeCount + 6 + Math.floor(Math.random() * 6);

    // 只创建一次容器,之后复用
    if (!promptToastEl) {
      promptToastEl = document.createElement("div");
      promptToastEl.id = "mytakeToast";
      promptToastEl.setAttribute("role", "dialog");
      promptToastEl.setAttribute("aria-label", "即兴表达引导");
      document.body.appendChild(promptToastEl);
      //  按钮(只绑一次)
      promptToastEl.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest(".mytake-close")) hidePromptToast();
        else if (t.closest(".mytake-secondary")) hidePromptToast();
        else if (t.closest(".mytake-primary")) {
          // 跳转结构化,带 hash 参数
          var cur = promptToastEl.getAttribute("data-card") || "";
          if (cur) {
            sessionPromptSilent = true;   // 已行动,本 session 静默
            hidePromptToast();
            location.href = "../structured/#learn?card=" + encodeURIComponent(cur);
          } else {
            hidePromptToast();
          }
        }
      });
    }
    // hook 截断到 24 字,避免一行太长
    var hookShort = card.hook && card.hook.length > 24
      ? card.hook.slice(0, 24) + "…"
      : (card.hook || "这张");
    var cardTags = (card.tags || []).slice(0, 2).map(function (t) {
      return '<span class="mytake-tag">' + esc(t) + '</span>';
    }).join("");
    promptToastEl.setAttribute("data-card", card.id);
    promptToastEl.innerHTML =
      '<div class="mytake-inner">' +
        '<button class="mytake-close" aria-label="关闭"></button>' +
        '<div class="mytake-kicker">刷得挺认真啊 · 换个形式试试</div>' +
        '<div class="mytake-tags">' + cardTags + '</div>' +
        '<div class="mytake-hook">' + esc(hookShort) + '</div>' +
        '<div class="mytake-sub">光看记不住，开口讲一遍才是你的。去结构化练习里录个音，存个 1.0 版本的理解。</div>' +
        '<div class="mytake-actions">' +
          '<button class="mytake-secondary">先存着，继续刷</button>' +
          '<button class="mytake-primary"> 就这张，讲讲看</button>' +
        '</div>' +
      '</div>';
    // 触发动画(下一帧再加 .show,确保 transition 生效)
    promptToastEl.classList.remove("show");
    requestAnimationFrame(function () {
      promptToastEl.classList.add("show");
    });
  }

  function hidePromptToast() {
    if (!promptToastEl) return;
    promptToastEl.classList.remove("show");
    // 动画结束后不清空 DOM,下次 showPromptToast 会重写 innerHTML
  }
  // 心形收藏图标（学小红书：未收藏=空心灰，已收藏=实心小红书红 #ff2442，对比强烈）
  // 标准 24x24 心形 path，颜色硬编码，不依赖 currentColor 继承
  function heartSvg(on) {
    if (on) {
      // 已收藏：实心小红书红
      return '<svg class="heart-ico fav-on" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M12 20.3l-1.45-1.32C5.4 14.24 2 11.16 2 7.5 2 4.92 4.02 3 6.5 3c1.74 0 3.41.81 4.5 2.09C12.09 3.81 13.76 3 15.5 3 17.98 3 20 4.92 20 7.5c0 3.66-3.4 6.74-8.55 11.49L12 20.3z" ' +
        'fill="#ff2442" stroke="#ff2442" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>' +
        '</svg>';
    }
    // 未收藏：空心灰
    return '<svg class="heart-ico fav-off" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 20.3l-1.45-1.32C5.4 14.24 2 11.16 2 7.5 2 4.92 4.02 3 6.5 3c1.74 0 3.41.81 4.5 2.09C12.09 3.81 13.76 3 15.5 3 17.98 3 20 4.92 20 7.5c0 3.66-3.4 6.74-8.55 11.49L12 20.3z" ' +
      'fill="none" stroke="#cbd5e1" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
  }

  // 统一设置收藏按钮（图标 + 可选文字）：on=已收藏(红心) / false=未收藏(描边)
  function setFavBtn(btn, on, withText) {
    if (!btn) return;
    var ico = btn.querySelector(".heart-ico, .act-ico, .ln-btn-ico");
    // 容器型按钮：内部有 .act-ico / .ln-btn-ico 占位
    var iconWrap = btn.querySelector(".act-ico") || btn.querySelector(".ln-btn-ico");
    if (iconWrap) iconWrap.innerHTML = heartSvg(on);
    else btn.innerHTML = heartSvg(on);   // 纯图标按钮（card-star / feed-card-star）
    btn.classList.toggle("on", !!on);
    if (withText) {
      var txt = btn.querySelector(".act-txt") || btn.querySelector(".ln-btn-txt");
      if (txt) txt.textContent = on ? "已收藏" : "收藏";
    }
    if (btn.getAttribute("aria-pressed") !== null) btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on ? "取消收藏" : "收藏";
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.interest) {
        // 旧版本可能存了未用的 path 字段,清理掉避免脏数据
        if ('path' in s) delete s.path;
        return s;
      }
    } catch (e) {}
    return { seen: {}, favs: {}, skip: {}, interest: {}, history: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function bumpInterest(tags, delta) {
    (tags || []).forEach(function (t) {
      state.interest[t] = (state.interest[t] || 0) + delta;
    });
  }

  /* ---------- 知识树布局（左右 DAG 分层 + 蛇形折行）----------
   * 移动端自动缩小节点尺寸 (阈值 400px),避免文字挤成蚂蚁 */
  var isNarrow = window.innerWidth < 400;
  var TREE_NW = isNarrow ? 74 : 88, TREE_NH = isNarrow ? 26 : 30;
  var TREE_COLW = isNarrow ? 90 : 104, TREE_ROWH = isNarrow ? 42 : 50;
  var TREE_PADX = isNarrow ? 6 : 8, TREE_PADY = isNarrow ? 10 : 14;
  var TREE_MAXC = isNarrow ? 3 : 4;   // 窄屏每行最多 3 列，蛇形折行
  function layout(nodes, edges) {
    var indeg = {}; nodes.forEach(function (n) { indeg[n] = 0; });
    edges.forEach(function (e) { if (indeg[e[1]] !== undefined) indeg[e[1]]++; });
    var depth = {}; nodes.forEach(function (n) { depth[n] = indeg[n] === 0 ? 0 : -1; });
    for (var pass = 0; pass <= nodes.length; pass++) {
      edges.forEach(function (e) {
        if (depth[e[0]] >= 0 && (depth[e[1]] < 0 || depth[e[1]] < depth[e[0]] + 1)) depth[e[1]] = depth[e[0]] + 1;
      });
    }
    nodes.forEach(function (n) { if (depth[n] < 0) depth[n] = 0; });
    var cols = {};
    nodes.forEach(function (n) { (cols[depth[n]] = cols[depth[n]] || []).push(n); });
    var dep = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });

    var NW = TREE_NW, NH = TREE_NH, COLW = TREE_COLW, ROWH = TREE_ROWH, PADX = TREE_PADX, PADY = TREE_PADY;
    var MAXC = TREE_MAXC;   // 每行最多 N 列，超出蛇形折行

    var maxNodes = 1;
    dep.forEach(function (d) { maxNodes = Math.max(maxNodes, cols[d].length); });
    var rowCount = Math.ceil(dep.length / MAXC);
    var rowH = maxNodes * ROWH + 12;   // 行高（含行间留白）

    var pos = {};
    dep.forEach(function (d, di) {
      var row = Math.floor(di / MAXC);
      var c = di % MAXC;
      var col = cols[d];
      // 蛇形：偶数行左右，奇数行右左
      var x = PADX + (row % 2 === 0 ? c : (MAXC - 1 - c)) * COLW;
      col.forEach(function (node, ri) {
        // 列内垂直居中，整体对称
        var y = PADY + row * rowH + (maxNodes - col.length) * ROWH / 2 + ri * ROWH;
        pos[node] = { x: x, y: y };
      });
    });

    var maxCols = Math.min(dep.length, MAXC);
    var W = PADX * 2 + (maxCols - 1) * COLW + NW;
    var H = PADY * 2 + (rowCount - 1) * rowH + maxNodes * ROWH;
    return { pos: pos, W: W, H: H, NW: NW, NH: NH };
  }

  // 布局结果按 card.id 缓存：同一张卡的节点/边不变，拓扑布局结果恒定，
  // 避免 renderStack 每次全量重写时重复计算（手机快刷时累积明显）
  var _layoutCache = {};
  function layoutCached(id, nodes, edges) {
    if (_layoutCache[id]) return _layoutCache[id];
    return (_layoutCache[id] = layout(nodes, edges));
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]; }); }

  // 来源徽章：母图定义的 官方 / 权威 / 报道 三档（对应 type: official/reference/media）
  function srcBadgeHTML(src) {
    if (!src) return "";
    var map = {
      official:  { sym: "", word: "官方", cls: "official" },
      reference: { sym: "", word: "权威", cls: "reference" },
      media:     { sym: "", word: "报道", cls: "media" }
    };
    var m = map[src.type] || { sym: "", word: "资料", cls: "" };
    return '<span class="badge ' + m.cls + '">' + m.sym + " " + m.word + '</span>';
  }

  function renderTree(card) {
    var L = layoutCached(card.id, card.nodes, card.edges);
    var arrow = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">' +
      '<path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
    var edgesSvg = "", nodesSvg = "";
    card.edges.forEach(function (e, i) {
      var a = L.pos[e[0]], b = L.pos[e[1]];
      if (!a || !b) return;
      var d = "";
      if (Math.abs(a.x - b.x) < 1) {
        // 同列跨行（蛇形折行处）：从 a 底部垂直连到 b 顶部
        var vx = a.x + L.NW / 2;
        var vy1 = a.y + L.NH;
        var vy2 = b.y;
        d = 'M' + vx + ',' + vy1 + ' C' + vx + ',' + ((vy1 + vy2) / 2) + ' ' + vx + ',' + ((vy1 + vy2) / 2) + ' ' + vx + ',' + vy2;
      } else if (b.x < a.x) {
        // b 在 a 左侧（蛇形反向行）：a 左边缘  b 右边缘
        var lx1 = a.x, ly1 = a.y + L.NH / 2, lx2 = b.x + L.NW, ly2 = b.y + L.NH / 2;
        var lmx = (lx1 + lx2) / 2;
        d = 'M' + lx1 + ',' + ly1 + ' C' + lmx + ',' + ly1 + ' ' + lmx + ',' + ly2 + ' ' + (lx2 + 4) + ',' + ly2;
      } else {
        var x1 = a.x + L.NW, y1 = a.y + L.NH / 2, x2 = b.x, y2 = b.y + L.NH / 2;
        var mx = (x1 + x2) / 2;
        d = 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + (x2 - 4) + ',' + y2;
      }
      edgesSvg += '<path class="edge" d="' + d + '" marker-end="url(#ar)"/>';
    });
    card.nodes.forEach(function (n, i) {
      var p = L.pos[n]; if (!p) return;
      var isRoot = card.edges.every(function (e) { return e[1] !== n; });
      var tx = p.x + L.NW / 2, ty = p.y + L.NH / 2;
      nodesSvg += '<g class="node-g" data-node="' + esc(n) + '">' +
        '<rect class="node-box' + (isRoot ? ' root' : '') + '" x="' + p.x + '" y="' + p.y + '" width="' + L.NW + '" height="' + L.NH + '" rx="9"/>' +
        '<text class="node-text" x="' + tx + '" y="' + ty + '" text-anchor="middle" dominant-baseline="central">' + esc(n) + '</text>' +
        '</g>';
    });
    return '<div class="tree-wrap" style="aspect-ratio:' + L.W + ' / ' + L.H + '"><svg viewBox="0 0 ' + L.W + ' ' + L.H + '" preserveAspectRatio="xMidYMid meet">' +
      arrow + edgesSvg + nodesSvg + '</svg></div>';
  }

  /* ---------- 推荐引擎：认知补全（沿知识路径走，而非猜你喜欢） ----------
   * 优化点（2026-08-20）：
   * 1. interest 加成按 tag 数归一化,避免 tag 多的卡被多加 4-5 次
   * 2. 孤立卡(被 related 引用次数 = 0)给基础加成,避免沉底
   * 3. 有 misconception 的卡小幅加成(它们多是有反差/反常识的拉力卡)
   * 优化点（2026-08-21）：
   * 4. related 从 6 降到 4：仍是最高权重但不垄断牌堆
   * 5. 新增「饥饿度」：距上次出现越久加分越多，沉底卡会自动浮起，避免 100 张里总有卡永远刷不到
   * 6. 新增「动作感知」：连续快刷(seen)时探索率升到 30% 帮用户换口味；刚收藏(fav)时 related 关联再加 4 分
   */
  var inRelCount = {};   // 被其他卡 related 引用的次数,用于识别孤立卡
  DATA.forEach(function (c) {
    (c.related || []).forEach(function (id) { inRelCount[id] = (inRelCount[id] || 0) + 1; });
  });
  var shownSeq = 0;          // 全局出现序列号，用于饥饿度
  var shownOrder = {};       // id -> 最近一次被选入牌堆的序号
  var lastAction = null;     // 最近一次动作：seen / fav / skip（供动作感知）

  function scoreCard(card, anchor, relBoost) {
    var s = 0;
    if (anchor) {
      // 显式关联（related）= 最高权重：这是人工设计的「下一块拼图」
      var rel = anchor.related || [];
      if (rel.indexOf(card.id) >= 0) s += 4 + (relBoost || 0);
      // tags 邻近：补充同维度的相邻视角
      var cur = {};
      (anchor.tags || []).forEach(function (t) { cur[t] = 1; });
      var prox = 0;
      (card.tags || []).forEach(function (t) { if (cur[t]) prox += 1; });
      s += prox * 1.2;
    }
    // 饥饿度：距上次出现越久越优先（从不出现的卡 = 满饥饿，+2.2）
    var age = (shownOrder[card.id] !== undefined) ? (shownSeq - shownOrder[card.id]) : shownSeq;
    s += Math.min(age / Math.max(1, shownSeq), 1) * 2.2;
    // 兴趣加成（历史行为,弱权重）— 按 tag 数归一化,避免 tag 多的卡吃红利
    var tagList = card.tags || [];
    var interestSum = 0;
    tagList.forEach(function (t) { interestSum += (state.interest[t] || 0); });
    if (tagList.length) s += (interestSum / tagList.length) * 0.3;
    // 主题级兴趣加权：10 大主线是知识骨架，读/藏过的主题应更靠前（让"城市/财政…"真正驱动推荐）
    var cardThemes = (card.tags || []).filter(function (t) { return themeSet[t]; });
    var themeInt = 0;
    cardThemes.forEach(function (t) { themeInt += (state.interest[t] || 0); });
    if (cardThemes.length) s += (themeInt / cardThemes.length) * 0.6;
    // 多样性惩罚：若这张卡的所有主题都已在最近窗口里刷过，稍降权重，避免一条 related 链刷到底
    if (cardThemes.length && recentThemeWindow.length) {
      var allSeen = cardThemes.every(function (t) { return recentThemeWindow.indexOf(t) >= 0; });
      if (allSeen) s -= 2.2;
    }
    // 孤立卡加成：无人 related 指向的卡,基础加一点,避免长期沉底
    if (!inRelCount[card.id]) s += 1.5;
    // 反差卡加成：有 misconception 字段 = 有"你以为...其实..."的反差,推前一点
    if (card.misconception) s += 0.8;
    // 实料卡加成：有 fact（硬数据）的卡更值得看，微幅前置
    if (card.fact) s += 0.6;
    return s;
  }

  /* ---------- 牌堆队列 ---------- */
  var queue = [];        // 当前堆叠的卡片，queue[0] 为顶层可交互
  var queuedIds = {};    // 队列内的卡片 id
  var history = state.history || [];   // [{id, type}] 最近在前，用于「回到上一题」
  var recentThemeWindow = [];   // 最近刷过卡片的主题 tag（用于多样性惩罚，避免卡死一条链）

  function pickForQueue() {
    // 优先：未看过 且 不在队列里的卡
    var pool = DATA.filter(function (c) { return !state.seen[c.id] && !queuedIds[c.id]; });
    if (pool.length === 0) {
      // 兜底：不在队列里的所有卡（含已看过），保证牌堆始终能补满 3 张
      pool = DATA.filter(function (c) { return !queuedIds[c.id]; });
      if (pool.length === 0) return null;
      // 若确实全部看完，重置 seen 开启新一轮（保留 favs/interest）
      var anyUnseen = DATA.some(function (c) { return !state.seen[c.id]; });
      if (!anyUnseen) { state.seen = {}; save(); }
    }
    // 锚点：顶层卡（当前正在看的），沿它的 related/tags 补下一块拼图
    var anchor = queue.length ? queue[0] : null;
    // 动作感知：连续快刷(seen/skip) = 想换口味  探索率升到 30%；刚收藏 = 喜欢这条路径  related 再加 4 分
    var exploreRate = (lastAction === "seen" || lastAction === "skip") ? 0.3 : 0.12;
    var relBoost = (lastAction === "fav") ? 4 : 0;
    if (Math.random() < exploreRate) return pool[Math.floor(Math.random() * pool.length)];
    var best = null, bestS = -1e9;
    pool.forEach(function (c) {
      var s = scoreCard(c, anchor, relBoost) + Math.random() * 1.2; // 轻微打散，避免死循环
      if (s > bestS) { bestS = s; best = c; }
    });
    // 记录所选卡的主题，供 scoreCard 做多样性惩罚（窗口最近 6 张）
    if (best) {
      var bt = (best.tags || []).filter(function (t) { return themeSet[t]; });
      recentThemeWindow = recentThemeWindow.concat(bt).slice(-6);
      shownSeq++; shownOrder[best.id] = shownSeq;   // 饥饿度：更新出现序列
    }
    return best || pool[0];
  }
  function fillQueue() {
    while (queue.length < 3) {
      var c = pickForQueue();
      if (!c) break;
      queue.push(c); queuedIds[c.id] = true;
    }
  }

  /* ---------- 渲染 ---------- */
  var deck = document.getElementById("deck");
  var countEl = document.getElementById("count");
  var favBtnEl = null;
  var prevBtn = null;
  var current = null;
  var myView = document.getElementById("myView");
  var swipeView = document.getElementById("swipeView");
  /* === 瀑布流视图 + 详情 modal（2026-08-20 新增）=== */
  var feedView = document.getElementById("feedView");
  var feedFilterEl = document.getElementById("feedFilter");
  var feedGrid = document.getElementById("feedGrid");
  var feedEnd = document.getElementById("feedEnd");
  var detailModal = document.getElementById("detailModal");
  var detailBody = document.getElementById("detailBody");
  var detailFavBtn = null;
  var currentFilter = "all";       // all / unseen / faved
  var currentTheme = null;        // null=全部主题；否则按该主题 tag 过滤
  var currentDetailId = null;     // modal 当前展示的卡片 id

  function relatedChips(card) {
    var ids = card.related || [];
    if (!ids.length) return "";
    var chips = ids.filter(function (id) { return byId[id]; })
      .map(function (id) { return '<span class="rel-chip" data-go="' + id + '">' + esc(byId[id].hook.replace(/？$/, "")) + '</span>'; })
      .join("");
    return chips ? '<div class="card-related"><span class="rlabel">相关</span>' + chips + '</div>' : "";
  }

  function renderCardHTML(card, extraClass) {
    var faved = !!state.favs[card.id];
    var srcBadge = srcBadgeHTML(card.source);
    return '<div class="card ' + (extraClass || "") + '" data-id="' + card.id + '">' +
        '<div class="card-top-tags">' + (card.tags || []).map(function (t) { return '<span class="tag tag-link" data-tag="' + esc(t) + '">' + esc(t) + '</span>'; }).join("") + '</div>' +
        '<div class="card-top-meta">' +
          '<span class="card-src">' + (card.source ? srcBadge + esc(card.source.label) : '') + '</span>' +
        '</div>' +
        '<h2 class="card-hook">' + esc(card.hook) + '</h2>' +
        (card.misconception ? '<p class="card-mis">' + esc(card.misconception) + '</p>' : '') +
        (card.fact ? '<div class="card-fact"><span class="cf-label">一个事实</span>' + esc(card.fact) + '</div>' : '') +
        renderTree(card) +
        (card.concept ? '<p class="card-concept">' + esc(card.concept) + '</p>' : '') +
        relatedChips(card) +
      '</div>';
  }

  function renderStack(anim) {
    current = queue[0] || null;
    // 持久化当前顶层卡：刷新/重开后尽量停留在这张，而不是随机跳到别处
    if (current) { state.lastCardId = current.id; save(); }
    var html = "";
    // 从后往前拼，使顶层最后（z 最高）
    for (var i = queue.length - 1; i >= 0; i--) {
      var cls = "depth-" + i + (i === 0 ? " top" : "");
      if (i === 0 && anim === "become") cls += " become-top";
      if (i === 0 && anim === "undo") cls += " undo-in";
      html += renderCardHTML(queue[i], cls);
    }
    deck.innerHTML = html;
    // 深度卡高度 = 顶层卡实际渲染高度：内容超出部分被自身 overflow:hidden 自裁，
    // 不再溢出 deck 与页面重叠，同时 #deck 不设 overflow，不影响 body 顶部下拉刷新
    syncDepthHeight();
    bindTop();
    updateCount();
    updateFoot();
    updatePrevBtn();
    // 牌堆切换题目时，若 AI 悬浮助手已打开且不在详情模式，自动刷新为当前题目的关联
    if (typeof aiAssistEl !== "undefined" && aiAssistEl && !aiAssistEl.classList.contains("hidden") && !currentDetailId) {
      if (typeof openAiAssist === "function" && current) { openAiAssist(current.id, false); }
    }
  }

  // 让 depth-1/-2 卡高度对齐顶层卡，防止它们内容比顶层卡长而露出到页面下方
  function syncDepthHeight() {
    var top = deck.querySelector(".card.top");
    if (!top) return;
    var h = top.getBoundingClientRect().height;
    deck.querySelectorAll(".card.depth-1, .card.depth-2").forEach(function (el) {
      el.style.height = h + "px";
    });
  }

  function updateCount() {
    var total = DATA.length, seen = Object.keys(state.seen).length, fav = Object.keys(state.favs).length;
    var pct = total > 0 ? Math.round((seen / total) * 100) : 0;
    var fill = document.getElementById("progressFill");
    var text = document.getElementById("progressText");
    if (fill) fill.style.width = pct + "%";
    if (text) text.textContent = "已看 " + seen + " / " + total + " · 收藏 " + fav + " · " + pct + "%";
  }

  function updateFoot() {
    if (!favBtnEl) favBtnEl = document.getElementById("actFav");
    if (favBtnEl && queue.length) setFavBtn(favBtnEl, !!state.favs[queue[0].id], false);
  }

  function updatePrevBtn() {
    if (!prevBtn) prevBtn = document.getElementById("actPrev");
    if (prevBtn) prevBtn.disabled = history.length === 0;
  }

  /* ---------- 动作 ---------- */
  function act(type, dir) {
    if (!queue.length) return;
    var card = queue[0];
    var id = card.id;
    // 记录历史，供「回到上一题」
    history.unshift({ id: id, type: type });
    if (history.length > 60) history.length = 60;

    if (type === "seen") { state.seen[id] = 1; bumpInterest(card.tags, 1); }
    else if (type === "fav") {
      if (state.favs[id]) { delete state.favs[id]; bumpInterest(card.tags, -3); }
      else { state.favs[id] = 1; state.seen[id] = 1; bumpInterest(card.tags, 3); }
    }
    else if (type === "skip") { state.seen[id] = 1; bumpInterest(card.tags, -1); }
    lastAction = type;   // 供推荐引擎做动作感知（快刷换口味 / 收藏强化关联）
    state.history = history; save();

    var topEl = deck.querySelector(".card.top");
    if (topEl && dir) topEl.classList.add("out-" + dir);
    queue.shift(); delete queuedIds[id];
    fillQueue();
    // 牌堆刷卡计数,用于触发 My take 引导弹窗
    // 下一张顶卡 id 传进去(这是 toast 里要显示"就这张,讲讲看"的那张)
    setTimeout(function () {
      renderStack(dir ? "become" : "instant");
      var next = queue[0];
      if (next) countSwipe(next.id);
    }, dir ? 280 : 0);
  }

  /* 回到上一题：撤销最近一次离开（看过/收藏/跳过/深入）
   * 注意：右滑是"回到上一张"，不是"撤销操作"。
   * 若最近一次离开是收藏(fav)，不回退收藏状态，只把卡片放回队首。 */
  function undo() {
    if (!history.length) return;
    var last = history.shift();
    var card = byId[last.id];
    if (!card) { updatePrevBtn(); return; }
    // 反向状态：fav 不撤销收藏（右滑只是回到上一张，收藏应保留）
    if (last.type === "seen") { delete state.seen[card.id]; bumpInterest(card.tags, -1); }
    else if (last.type === "skip") { delete state.seen[card.id]; bumpInterest(card.tags, 1); }
    // fav / goto 不撤销状态，只放回队首
    state.history = history; save();
    // 放回队首；队列已满则挤出最后一张（仍可被重新抽到）
    delete queuedIds[card.id];
    queue.unshift(card); queuedIds[card.id] = true;
    if (queue.length > 3) { var popped = queue.pop(); if (popped) delete queuedIds[popped.id]; }
    renderStack("undo");
  }

  function goTo(id) {
    if (!byId[id]) return;
    var prev = queue.length ? queue[0] : null;
    if (prev && prev.id === id) return;
    state.seen[id] = 1; save();
    if (prev) { history.unshift({ id: prev.id, type: "goto" }); state.history = history; save(); }
    // 若该卡已在牌堆后层，先移除旧位置
    var idx = -1;
    queue.forEach(function (c, i) { if (c.id === id) idx = i; });
    if (idx > 0) { queue.splice(idx, 1); }
    queue[0] = byId[id]; queuedIds[id] = true;
    renderStack("become");
    // 点节点/相关卡跳转也算一次刷卡
    if (prev && prev.id !== id) countSwipe(id);
  }

  /* ---------- 滑动手势（仅顶层卡） ---------- */
  function bindTop() {
    var el = deck.querySelector(".card.top");
    if (!el) return;
    var sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, isSwipe = false, horiz = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".rel-chip") || e.target.closest(".node-g") || e.target.closest(".tag-link")) return;
      sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
      dragging = true; isSwipe = false; horiz = false;
      // 不立即加 .drag，等 pointermove 确认横向后才介入；
      // 纵向留给浏览器原生滚动，零干扰，跟手丝滑
    });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      // 一旦确认是横向拖拽，就把方向锁定为横向，忽略后续纵向抖动，
      // 否则手机上手指轻微上下抖会让 |dy|>|dx|，右滑被误判成纵向而不触发
      if (!horiz && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) horiz = true;
      if (horiz) {
        isSwipe = true;
        if (!el.classList.contains("drag")) { el.classList.add("drag"); el.classList.remove("settle", "enter"); }
        el.style.transform = "translate(" + dx * 0.6 + "px,0) rotate(" + (dx * 0.02) + "deg)";
        el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 400));
      }
      // 纵向：完全不做任何事，浏览器原生滚动接管
    });
    function end() {
      if (!dragging) return; dragging = false;
      if (isSwipe) {
        el.classList.remove("drag"); el.classList.add("settle");
        el.style.transform = ""; el.style.opacity = "";
      }
      // 手势：纵向完全放手给浏览器原生滚动 / 左滑=下一张 / 右滑=上一张
      // 不再拦截任何下滑（含「到顶下滑=收藏」），避免与浏览器原生上下滑动冲突
      if (isSwipe && Math.abs(dx) > 45) {
        if (dx < 0) act("seen", "left");      // 左滑 = 下一张
        else undo();                          // 右滑 = 上一张
      }
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function (e) { if (dragging && !e.relatedTarget) end(); });

    // 点节点深入
    el.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        // 优先：卡片显式指定的节点跳转（nodeLinks 映射节点文字  卡片 id）
        var explicit = current && current.nodeLinks && current.nodeLinks[label];
        if (explicit && byId[explicit]) { goTo(explicit); return; }
        // 回退 1：含该节点的其他卡片（知识图谱相邻）
        var viaNodes = (nodeToCards[label] || []).filter(function (x) { return x !== current.id; });
        if (viaNodes.length) { goTo(viaNodes[0]); return; }
        // 回退 2：当前卡片的关联卡（related）
        var rel = (current.related || []).filter(function (x) { return x !== current.id; });
        if (rel.length) { goTo(rel[0]); return; }
        // 回退 3：按 tag 索引（兜底）
        var ids = nodeIndex[label] || [];
        var target = ids.filter(function (x) { return x !== current.id; })[0] || ids[0];
        if (target) goTo(target);
      });
    });
    // 点相关 chip
    el.querySelectorAll(".rel-chip").forEach(function (c) {
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        goTo(c.getAttribute("data-go"));
      });
    });
    // 点卡片 tag  按该 tag 筛选（主题映射：城市/产业/财政… 不再只是死标签）
    el.querySelectorAll(".tag-link").forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.stopPropagation();
        openTagFilter(t.getAttribute("data-tag"));
      });
    });
    // 点星星收藏/取消收藏
    el.querySelectorAll(".card-star").forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(current.id);
      });
    });
  }

  // 仅切换收藏状态（不移动卡片），刷新星星 + 底部收藏按钮
  function toggleFav(id) {
    var card = byId[id];
    if (!card) return;
    if (state.favs[id]) { delete state.favs[id]; bumpInterest(card.tags, -3); }
    else { state.favs[id] = 1; state.seen[id] = 1; bumpInterest(card.tags, 3); }
    save();
    var topEl = deck.querySelector(".card.top");
    if (topEl) {
      var star = topEl.querySelector(".card-star");
      var on = !!state.favs[id];
      if (star) setFavBtn(star, on);
    }
    updateFoot();
    updateCount();
  }

  /* ============ 瀑布流视图 + 详情 modal（2026-08-20）============
   * - 顶部 chips 筛选：全部 / 未看过 / 已收藏（带计数,实时反映进度）
   * - 双列 CSS columns 真瀑布流,卡片按 hook 字数自然变高
   * - 卡片状态反馈：未看过NEW 红点 / 看过轻微淡化 / 已收藏金色边框
   * - 点击卡片打开底部弹出详情 modal,复用 renderCardHTML 展示完整知识图谱
   * - modal 底部按钮：收藏/取消、在牌堆里刷（切到牌堆视图并 goTo 该卡）
   */
  function renderFeedFilter() {
    var unseenCount = DATA.filter(function (c) { return !state.seen[c.id]; }).length;
    var favedCount = Object.keys(state.favs).length;
    var statusChips = [
      { key: "all",    label: "全部",   count: DATA.length },
      { key: "unseen", label: "未看过", count: unseenCount },
      { key: "faved", label: "已收藏", count: favedCount }
    ];
    var statusHtml = statusChips.map(function (c) {
      return '<button class="feed-chip' + (c.key === currentFilter ? " on" : "") +
        '" data-filter="' + c.key + '">' + c.label +
        '<span class="cnt">' + c.count + '</span></button>';
    }).join("");
    // 顶层主题：点主题  按 tag 过滤；带计数（这些是知识地图的 10 大主线，此前是死标签）
    var themeChips = THEMES.map(function (t) {
      return '<button class="feed-chip theme' + (currentTheme === t ? " on" : "") +
        '" data-theme="' + esc(t) + '">' + esc(t) +
        '<span class="cnt">' + (themeCards[t] ? themeCards[t].length : 0) + '</span></button>';
    }).join("");
    // 激活了任何筛选（主题或非主题 tag）时，给一个明确的「清除」出口
    var clearChip = currentTheme
      ? '<button class="feed-chip clear" data-theme="">× 清除' + esc(currentTheme) + '</button>'
      : '';
    var themeHtml = '<button class="feed-chip theme' + (currentTheme === null ? " on" : "") +
      '" data-theme="">全部主题<span class="cnt">' + DATA.length + '</span></button>' +
      themeChips + clearChip;
    feedFilterEl.innerHTML = '<div class="ff-group ff-status">' + statusHtml + '</div>' +
      '<div class="ff-sep"></div>' +
      '<div class="ff-group ff-themes">' + themeHtml + '</div>';
    feedFilterEl.querySelectorAll(".feed-chip[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        currentFilter = b.getAttribute("data-filter");
        renderFeedFilter();
        renderFeed();
      });
    });
    feedFilterEl.querySelectorAll(".feed-chip[data-theme]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-theme");
        currentTheme = t ? t : null;
        renderFeedFilter();
        renderFeed();
      });
    });
  }

  /* 点卡片上的 tag  切到瀑布流并按该 tag 筛选（主题映射的入口）*/
  function openTagFilter(tag) {
    currentTheme = tag || null;
    closeDetail();   // 从详情 modal 进入时，先收起 modal 再切视图
    showFeed();
    syncNav();
  }

  /* 懒加载分批渲染：避免一次塞 30 张 DOM 引起的卡顿
   * - 首批 8 张,后续每滚到底附近补 6 张
   * - IntersectionObserver 监视哨兵元素,触发追加
   * - 切换筛选/视图时取消旧 observer,避免泄漏 */
  var feedList = [];          // 当前筛选+排序后的完整列表
  var feedRenderedCount = 0;  // 已渲染数量
  var feedSentinel = null;    // 哨兵元素(放在 feedGrid 外,避免被 columns 布局吞掉)
  var feedObserver = null;
  var FEED_BATCH = 12;
  var FEED_MORE = 8;

  /* ---------- 瀑布流卡片:4 种数据驱动卡型,概率+特征混合分配 ----------
   *  注:本批数据里 hook 几乎全是 13–20 字短问句,纯按 hook_len 会"一刀切"
   *  策略:ID hash  概率分配 + 数据特征兜底(有什么特性就偏什么卡型)
   *  目标比例:poster 20% / rich 25% / mis 30% / base 25%
   *  type-poster: 大字报  柔和彩色底 + hook 居中大字 + 标签下沉居中
   *  type-rich:   全标签长卡  tagCount≥3 的卡,高留白 + 圆润 22 圆角 + 显示上限 4 标签
   *  type-mis:    反差辟谣卡  有 misconception,灰框"你以为…"+ 主 hook 前加渐变"其实"
   *  type-base:   其余  标准白卡,约 35% 走 tight(更紧凑小号),制造高度差 */
  function pickCardType(c) {
    var hookLen = (c.hook || '').length;
    var tagCount = (c.tags || []).length;
    var sid = c.id || ('x' + hookLen);
    var h = 0; for (var i = 0; i < sid.length; i++) h = ((h * 41) + sid.charCodeAt(i)) >>> 0;
    var r = h % 100; // 0-99

    // 精确概率桶:poster 20% / rich 25% / mis 30% / base 25%
    // 数据特征不满足就降级到相邻的、不需要额外数据的类型
    if (r < 20) return 'poster';
    if (r < 45) return (tagCount >= 3) ? 'rich' : 'poster';
    if (r < 75) return c.misconception ? 'mis' : ((tagCount >= 3) ? 'rich' : 'base');
    return 'base';
  }
  // 字符串  柔和 HSL 背景色 (97~98% 亮度,65~75% 饱和度),用于大字报卡的彩色底
  function softBgStyle(seed) {
    var s = '' + (seed || 'x');
    var h = 0; for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    var hue = h % 360;
    return 'background:hsl(' + hue + ',70%,97.8%);';
  }

  function renderFeedCardHTML(c) {
    var seen = !!state.seen[c.id];
    var faved = !!state.favs[c.id];
    var isNew = !seen;
    var type = pickCardType(c);

    // 标签显示数量:rich 全量(上限 4),其他上限 2
    var tagLimit = (type === 'rich') ? 4 : 2;
    var tags = (c.tags || []).slice(0, tagLimit).map(function (t) {
      return '<span class="feed-card-tag tag-link" data-tag="' + esc(t) + '">' + esc(t) + '</span>';
    }).join("");

    var srcBadge = srcBadgeHTML(c.source);
    var srcLabel = c.source ? '<span class="src-label">' + esc(c.source.label) + '</span>' : "";

    // base 卡 ~30% 概率走紧凑版 tight(更小 padding + 小号字,制造高度落差)
    var tight = '';
    if (type === 'base') {
      var r = 0; var s2 = c.id || ('x' + Math.random());
      for (var k = 0; k < s2.length; k++) r = ((r * 17) + s2.charCodeAt(k)) >>> 0;
      if ((r % 10) < 3) tight = ' feed-type-base-tight';
    }

    var cls = ' feed-type-' + type + tight;
    var attrs = ' class="feed-card' + (seen ? " seen" : "") + (faved ? " faved" : "") + cls + '" data-id="' + c.id + '"';

    var newDot = (isNew ? '<span class="feed-new" title="未看过"></span>' : '');
    var starBtn = '<button type="button" class="feed-card-star' + (faved ? " on" : "") + '" data-fav="' + c.id +
      '" title="' + (faved ? "取消收藏" : "收藏") + '" aria-pressed="' + (faved ? "true" : "false") + '">' + heartSvg(faved) + '</button>';
    var srcLine = (c.source ? '<span class="feed-card-src">' + srcBadge + srcLabel + '</span>' : '<span></span>') + starBtn;

    if (type === 'poster') {
      // 大字报:柔和彩色底 + 标签下移居中 + hook 居中大字
      var style = ' style="' + softBgStyle((c.tags && c.tags[0]) || c.id) + '"';
      return '<div' + attrs + style + '>' +
        (newDot ? '<div class="feed-card-top"><span></span>' + newDot + '</div>' : '') +
        '<h3 class="feed-card-hook">' + esc(c.hook) + '</h3>' +
        (tags ? '<div class="feed-card-tags feed-tags-center">' + tags + '</div>' : '') +
        '<div class="feed-card-bot">' + srcLine + '</div>' +
      '</div>';
    }

    if (type === 'mis') {
      // 反差卡:上面灰框"你以为…" + 下面 hook "其实…"
      return '<div' + attrs + '>' +
        '<div class="feed-card-top">' +
          '<div class="feed-card-tags">' + tags + '</div>' +
          newDot +
        '</div>' +
        '<div class="feed-mis-block">' +
          '<span class="feed-mis-label">你以为</span>' +
          '<p class="feed-mis-text">' + esc(c.misconception) + '</p>' +
        '</div>' +
        '<h3 class="feed-card-hook feed-hook-mis">' + esc(c.hook) + '</h3>' +
        (c.fact ? '<div class="feed-fact">' + esc(c.fact) + '</div>' : '') +
        '<div class="feed-card-bot">' + srcLine + '</div>' +
      '</div>';
    }

    // rich / base 共用结构,只靠 class 改变外观
    return '<div' + attrs + '>' +
      '<div class="feed-card-top">' +
        '<div class="feed-card-tags">' + tags + '</div>' +
        newDot +
      '</div>' +
      '<h3 class="feed-card-hook">' + esc(c.hook) + '</h3>' +
      (c.fact ? '<div class="feed-fact">' + esc(c.fact) + '</div>' : '') +
      '<div class="feed-card-bot">' + srcLine + '</div>' +
    '</div>';
  }

  function bindFeedCardEvents(el) {
    el.addEventListener("click", function (e) {
      var tagEl = e.target.closest(".tag-link");
      if (tagEl) { e.stopPropagation(); openTagFilter(tagEl.getAttribute("data-tag")); return; }
      if (e.target.closest(".feed-card-star")) return;
      openDetail(el.getAttribute("data-id"));
    });
    var s = el.querySelector(".feed-card-star");
    if (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = s.getAttribute("data-fav");
        toggleFav(id);
        var now = !!state.favs[id];
        var card = s.closest(".feed-card");
        card.classList.toggle("faved", now);
        card.classList.toggle("seen", !!state.seen[id]);  // 收藏会顺手 mark seen
        s.classList.toggle("on", now);
        s.textContent = now ? "" : "";
        s.title = now ? "取消收藏" : "收藏";
        // 当前是"已收藏"筛选且取消了  立刻重渲整列(因为列表变了)
        if (currentFilter === "faved" && !now) renderFeed();
        // 当前是"未看过"筛选且新增了收藏(顺手 seen)  立刻重渲
        if (currentFilter === "unseen" && now) renderFeed();
        renderFeedFilter();  // 计数刷新
      });
    }
  }

  function appendFeedBatch() {
    if (feedRenderedCount >= feedList.length) {
      // 全部渲染完
      if (feedEnd) feedEnd.textContent = "共 " + feedList.length + " 张 · 刷到底了";
      if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }
      return;
    }
    var frag = document.createDocumentFragment();
    var end = Math.min(feedRenderedCount + (feedRenderedCount === 0 ? FEED_BATCH : FEED_MORE), feedList.length);
    for (var i = feedRenderedCount; i < end; i++) {
      var div = document.createElement("div");
      div.innerHTML = renderFeedCardHTML(feedList[i]);
      var cardEl = div.firstChild;
      bindFeedCardEvents(cardEl);
      frag.appendChild(cardEl);
    }
    feedRenderedCount = end;
    // 哨兵放在 feedGrid 之外(feedEnd 之前),避免被 columns 布局吞掉
    if (feedSentinel && feedSentinel.parentNode) feedSentinel.parentNode.removeChild(feedSentinel);
    feedGrid.appendChild(frag);
    if (feedRenderedCount < feedList.length) {
      if (!feedSentinel) {
        feedSentinel = document.createElement("div");
        feedSentinel.className = "feed-sentinel";
        feedSentinel.setAttribute("aria-hidden", "true");
      }
      // 哨兵插在 feedGrid 之后、feedEnd 之前(在 feedView 内,但不在 columns 容器里)
      if (feedEnd && feedEnd.parentNode === feedGrid.parentNode) {
        feedGrid.parentNode.insertBefore(feedSentinel, feedEnd);
      } else {
        feedGrid.parentNode.appendChild(feedSentinel);
      }
      if (feedObserver) feedObserver.observe(feedSentinel);
      if (feedEnd) feedEnd.textContent = "";   // 渲染中,不显示"刷到底"
    } else {
      if (feedEnd) feedEnd.textContent = "共 " + feedList.length + " 张 · 刷到底了";
    }
  }

  function renderFeed() {
    feedList = DATA.slice();
    if (currentFilter === "unseen") {
      feedList = feedList.filter(function (c) { return !state.seen[c.id]; });
    } else if (currentFilter === "faved") {
      feedList = feedList.filter(function (c) { return state.favs[c.id]; });
    }
    // 主题筛选：按 tag 过滤（点主题 chip / 点卡片 tag 都会设置 currentTheme）
    if (currentTheme) {
      feedList = feedList.filter(function (c) { return (c.tags || []).indexOf(currentTheme) >= 0; });
    }
    // 排序：未看过靠前 > 已收藏靠前 > 其他,让浏览时新内容先映入眼帘
    feedList.sort(function (a, b) {
      var aSeen = state.seen[a.id] ? 1 : 0;
      var bSeen = state.seen[b.id] ? 1 : 0;
      if (aSeen !== bSeen) return aSeen - bSeen;
      var aFav = state.favs[a.id] ? 1 : 0;
      var bFav = state.favs[b.id] ? 1 : 0;
      return bFav - aFav;
    });

    // 清理旧 observer
    if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }

    feedGrid.innerHTML = "";
    feedRenderedCount = 0;

    if (feedList.length === 0) {
      if (feedEnd) {
        var empty = currentFilter === "unseen" ? "都看过了,去牌堆刷一轮?" :
                    currentFilter === "faved" ? "还没收藏。刷到喜欢的卡点心形留下来。" :
                    currentTheme ? "「" + currentTheme + "」主题下暂时没有更多卡片。" : "暂无卡片。";
        feedEnd.innerHTML = '<div class="feed-empty">' + empty + '</div>';
      }
      return;
    }
    if (feedEnd) feedEnd.innerHTML = "";

    // 初始化 IntersectionObserver 懒加载
    // feed-stage 是页面原生滚动（无内部滚动容器），root 用视口(null)，
    // 哨兵进入视口下方 200px 即触发下一批渲染
    if ("IntersectionObserver" in window) {
      feedObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) appendFeedBatch();
        });
      }, { root: null, rootMargin: "200px 0px", threshold: 0 });
    }
    // 首批立即渲染,无 observer 时一次性全渲(降级)
    appendFeedBatch();
    if (!feedObserver && feedRenderedCount < feedList.length) appendFeedBatch();
  }

  function openDetail(id) {
    var card = byId[id];
    if (!card) return;
    currentDetailId = id;
    // 复用牌堆的 renderCardHTML,不带牌堆专用 class(top/depth/drag)
    detailBody.innerHTML = renderCardHTML(card, "");
    updateAiCustomTip();
    if (!detailFavBtn) detailFavBtn = document.getElementById("detailFav");
    var faved = !!state.favs[id];
    setFavBtn(detailFavBtn, faved, true);
    // 详情内的星/相关 chip/节点  联动(点 chip 跳详情,点节点跳详情,点星切收藏)
    detailBody.querySelectorAll(".card-star").forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(id);
        var now = !!state.favs[id];
        setFavBtn(s, now);
        setFavBtn(detailFavBtn, now, true);
      });
    });
    detailBody.querySelectorAll(".rel-chip").forEach(function (c) {
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        openDetail(c.getAttribute("data-go"));
      });
    });
    detailBody.querySelectorAll(".tag-link").forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.stopPropagation();
        openTagFilter(t.getAttribute("data-tag"));
      });
    });
    detailBody.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        var explicit = card.nodeLinks && card.nodeLinks[label];
        if (explicit && byId[explicit]) { openDetail(explicit); return; }
        // 回退 1：含该节点的其他卡片
        var viaNodes = (nodeToCards[label] || []).filter(function (x) { return x !== id; });
        if (viaNodes.length) { openDetail(viaNodes[0]); return; }
        // 回退 2：关联卡（related）
        var rel = (card.related || []).filter(function (x) { return x !== id; });
        if (rel.length) { openDetail(rel[0]); return; }
        // 回退 3：按 tag 索引
        var ids = nodeIndex[label] || [];
        var target = ids.filter(function (x) { return x !== id; })[0] || ids[0];
        if (target) openDetail(target);
      });
    });
    detailModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";  // 防止背景滚动
    detailModal.scrollTop = 0;   // 重置滚动位置
    // 切换题目时，若 AI 悬浮助手已打开，自动刷新为当前题目的关联（避免显示上一题的旧内容）
    if (typeof aiAssistEl !== "undefined" && aiAssistEl && !aiAssistEl.classList.contains("hidden")) {
      if (typeof openAiAssist === "function") { openAiAssist(id, false); }
    }
  }

  function closeDetail() {
    detailModal.classList.add("hidden");
    currentDetailId = null;
    document.body.style.overflow = "";
    // 回到瀑布流时,可能收藏状态变了,刷新一下
    if (!feedView.classList.contains("hidden")) {
      renderFeedFilter();
      renderFeed();
    }
  }

  /* ---------- 键盘兜底 ---------- */
  document.addEventListener("keydown", function (e) {
    // 详情 modal 打开时,ESC 关闭,优先级最高
    if (e.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeDetail();
      return;
    }
    if (!detailModal.classList.contains("hidden")) return;   // 详情打开时不响应牌堆快捷键
    if (myView.classList.contains("hidden") === false) return; // 在我的知识页不响应
    if (e.key === "ArrowLeft") { act("seen", "left"); }       // 左 = 下一张
    else if (e.key === "ArrowRight") { undo(); }               // 右 = 上一张
    else if (e.key === "z" || e.key === "Z") { undo(); }       // z = 上一张
  });

  /* ---------- 我的知识 ---------- */
  function renderMy() {
    var favIds = Object.keys(state.favs);
    var total = DATA.length;
    var seenCount = Object.keys(state.seen).length;
    var favCount = favIds.length;
    var unseenCount = total - seenCount;

    var html = '<button class="ln-btn back-btn" id="backBtn"> 返回刷</button>' +
      '<div class="my-head">我的知识</div>';

    // 进度统计：一眼看清刷到哪了
    html += '<div class="my-stats">' +
      '<div class="stat"><b>' + seenCount + '</b><span>已看</span></div>' +
      '<div class="stat"><b>' + unseenCount + '</b><span>未看</span></div>' +
      '<div class="stat"><b>' + favCount + '</b><span>收藏</span></div>' +
      '<div class="stat"><b>' + total + '</b><span>题库</span></div>' +
      '</div>';

    var ints = Object.keys(state.interest).filter(function (k) { return state.interest[k] > 0; })
      .sort(function (a, b) { return state.interest[b] - state.interest[a]; }).slice(0, 10);
    if (ints.length) {
      html += '<div class="interest-row">' + ints.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>';
    }

    // 收藏（可折叠，默认展开）
    if (!favIds.length) {
      html += '<details class="my-favs"><summary class="my-sec-title">收藏的卡片</summary>' +
        '<div class="my-empty">还没有收藏。<br>点卡片右上角的心形，或底部「收藏」就能存下来。</div></details>';
    } else {
      html += '<details class="my-favs" open><summary class="my-sec-title">收藏的卡片<span class="fc">' + favCount + '</span></summary>' +
        '<div class="my-list">' + favIds.map(function (id) {
        var c = byId[id]; if (!c) return "";
        return '<div class="my-item" data-go="' + id + '">' +
          '<div class="my-item-body"><div class="t">' + esc(c.hook) + '</div>' +
          '<div class="meta">' + (c.tags || []).map(esc).join(" · ") + '</div></div>' +
          '<button class="my-remove" data-rm="' + id + '" title="移除收藏" aria-label="移除收藏">×</button></div>';
      }).join("") + '</div></details>';
    }

    // 所有题目（默认折叠，点开按主题分组，自动折叠）
    var byTheme = {}; THEMES.forEach(function (t) { byTheme[t] = []; });
    var otherCards = [];
    DATA.forEach(function (c) {
      var ts = (c.tags || []).filter(function (t) { return themeSet[t]; });
      if (!ts.length) { otherCards.push(c); return; }
      byTheme[ts[0]].push(c);   // 多主题卡归到首个命中主题，避免重复
    });
    var allGroups = THEMES.map(function (t) {
      if (!byTheme[t].length) return "";
      var items = byTheme[t].map(function (c) {
        return '<div class="my-item" data-go="' + c.id + '"><div class="my-item-body">' +
          '<div class="t">' + esc(c.hook) + '</div>' +
          '<div class="meta">' + (c.tags || []).map(esc).join(" · ") + '</div></div></div>';
      }).join("");
      return '<details class="my-group"><summary>' + esc(t) +
        '<span class="gc">' + byTheme[t].length + '</span></summary>' +
        '<div class="my-list">' + items + '</div></details>';
    }).join("");
    if (otherCards.length) {
      var otherItems = otherCards.map(function (c) {
        return '<div class="my-item" data-go="' + c.id + '"><div class="my-item-body">' +
          '<div class="t">' + esc(c.hook) + '</div>' +
          '<div class="meta">' + (c.tags || []).map(esc).join(" · ") + '</div></div></div>';
      }).join("");
      allGroups += '<details class="my-group"><summary>其他<span class="gc">' + otherCards.length + '</span></summary>' +
        '<div class="my-list">' + otherItems + '</div></details>';
    }
    html += '<details class="my-all"><summary class="my-sec-title"> 所有题目（按主题）</summary>' +
      '<div class="my-all-inner">' + allGroups + '</div></details>';

    var st = myView.querySelector(".ln-stage");
    if (st) st.innerHTML = html; else myView.innerHTML = html;
    document.getElementById("backBtn").addEventListener("click", showSwipe);
    myView.querySelectorAll(".my-item").forEach(function (it) {
      it.addEventListener("click", function () { showSwipe(); goTo(it.getAttribute("data-go")); });
    });
    myView.querySelectorAll(".my-remove").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        removeFav(b.getAttribute("data-rm"));
      });
    });

  }

  function removeFav(id) {
    var c = byId[id];
    if (!c || !state.favs[id]) return;
    delete state.favs[id];
    bumpInterest(c.tags, -3);
    save();
    renderMy();
    updateCount();
  }

  function showSwipe() {
    swipeView.classList.remove("hidden");
    feedView.classList.add("hidden");
    myView.classList.add("hidden");
    document.getElementById("foot").classList.remove("hidden");
  }
  function showFeed() {
    renderFeedFilter();
    renderFeed();
    swipeView.classList.add("hidden");
    feedView.classList.remove("hidden");
    myView.classList.add("hidden");
    document.getElementById("foot").classList.add("hidden");
  }
  function showMy() {
    renderMy();
    swipeView.classList.add("hidden");
    feedView.classList.add("hidden");
    myView.classList.remove("hidden");
    document.getElementById("foot").classList.add("hidden");
  }

  document.getElementById("btnSwipe").addEventListener("click", function () { showSwipe(); syncNav(); });
  document.getElementById("btnFeed").addEventListener("click", function () { showFeed(); syncNav(); });
  document.getElementById("btnMy").addEventListener("click", function () { showMy(); syncNav(); });
  function syncNav() {
    var onSwipe = !swipeView.classList.contains("hidden");
    var onFeed = !feedView.classList.contains("hidden");
    document.getElementById("btnSwipe").classList.toggle("on", onSwipe);
    document.getElementById("btnFeed").classList.toggle("on", onFeed);
    document.getElementById("btnMy").classList.toggle("on", !onSwipe && !onFeed);
  }

  // 详情 modal 事件绑定
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", closeDetail);
  document.getElementById("detailFav").addEventListener("click", function () {
    if (!currentDetailId) return;
    var id = currentDetailId;
    toggleFav(id);
    var now = !!state.favs[id];
    setFavBtn(this, now, true);
    // 详情内顶部星同步
    var topStar = detailBody.querySelector(".card-star");
    if (topStar) setFavBtn(topStar, now);
  });
  document.getElementById("detailGoSwipe").addEventListener("click", function () {
    if (!currentDetailId) return;
    var id = currentDetailId;
    closeDetail();
    showSwipe(); syncNav();
    goTo(id);   // 切到牌堆视图,把这张卡放到顶层接着刷
  });

  // 底部按钮（上一张=右滑 / 收藏=下划 / 下一张=左滑）
  document.getElementById("actPrev").addEventListener("click", undo);
  document.getElementById("actSeen").addEventListener("click", function () { act("seen", "left"); });
  // 底部 ：学小红书，只切换收藏状态、不刷走当前卡
  document.getElementById("actFav").addEventListener("click", function () {
    if (!queue.length) return;
    toggleFav(queue[0].id);
    updateFoot();
    updateCount();
  });
  // 回到 Exam Hub（极小首页按钮）
  document.getElementById("homeMini").addEventListener("click", function () { location.href = "../index.html"; });

  /* ============ AI 关联（你懂的 · 围绕当前知识卡生成关联点）============
   * 移植自 structured.html「你懂的」AI 关联：换一批 / 复制 / 来源。
   * 当前卡片 = 详情 modal 中的 currentDetailId。面板在 openDetail 时注入 detailBody。 */
  var aiFetchLock = false;
  var aiRelateCache = {};        // cardId -> { rounds:[{role,items}], followups:[{id,text}], provider }
  (function loadAiCache() {
    try {
      var aiSaved = JSON.parse(localStorage.getItem("rcj_ai_relate_v1") || "{}");
      aiRelateCache = aiSaved.rel || {};
    } catch (e) { aiRelateCache = {}; }
  })();
  function aiGetApiPath() { return "/api/gemini"; }
  // 用户自选模型：localStorage 持久化；默认 dots（统一国内渠道）
  // 合法源：dots / agnes / sensenova（SenseNova）/ bai / custom（前端填自己的 key）
  function aiGetProvider() {
    try {
      var p = localStorage.getItem("learn_ai_provider");
      if (p === "dots" || p === "agnes" || p === "sensenova" || p === "bai" || p === "groq" || p === "custom") return p;
    } catch (e) {}
    return "dots";
  }
  function aiSetProvider(p) {
    try { localStorage.setItem("learn_ai_provider", p); } catch (e) {}
  }
  // 让「我的」面板的 AI 关联源 与 悬浮助手面板的 模型 单选组保持选中态一致
  function syncAiPickers() {
    var cur = aiGetProvider();
    document.querySelectorAll('input[name="aiProvider"]').forEach(function (inp) {
      inp.checked = (inp.value === cur);
    });
    document.querySelectorAll('.my-ai-src-opt').forEach(function (o) {
      var inp = o.querySelector('input');
      o.classList.toggle("on", !!inp && inp.value === cur);
    });
      // 自定义输入区域：选 custom 时显示，否则隐藏
    var customRow = document.getElementById("aiCustomRow");
    var customTip = document.getElementById("aiCustomTip");
    if (customRow) customRow.hidden = (cur !== "custom");
    if (customTip) {
      var c = aiGetCustom();
      customTip.hidden = (cur !== "custom") || (!!c.baseUrl && !!c.model && !!c.apiKey);
    }
  }
  // 自定义模型配置（仅 custom 源用）：OpenAI 兼容 chat/completions
  var AI_CUSTOM_KEY = "rcj_ai_custom_v1";
  function aiGetCustom() {
    try {
      var c = JSON.parse(localStorage.getItem(AI_CUSTOM_KEY) || "{}");
      return { baseUrl: c.baseUrl || "", model: c.model || "", apiKey: c.apiKey || "" };
    } catch (e) { return { baseUrl: "", model: "", apiKey: "" }; }
  }
  function aiSetCustom(c) {
    try { localStorage.setItem(AI_CUSTOM_KEY, JSON.stringify({
      baseUrl: c.baseUrl || "", model: c.model || "", apiKey: c.apiKey || ""
    })); } catch (e) {}
  }
  function aiCurrentCard() {
    // 悬浮助手优先跟随当前详情卡；未开详情时退回牌堆顶层卡
    if (currentDetailId) return byId[currentDetailId] || null;
    if (current) return current;
    return null;
  }
  /* ---------- 悬浮 AI 助手：开合 / 发送追问 ---------- */
  var aiAssistEl = document.getElementById("aiAssist");
  var aiFabEl = document.getElementById("aiFab");
  var aiAssistInput = document.getElementById("aiAssistInput");
  function aiOpenAssist() { if (aiAssistEl) aiAssistEl.classList.remove("hidden"); if (aiFabEl) aiFabEl.classList.add("on"); }
  function aiCloseAssist() { if (aiAssistEl) aiAssistEl.classList.add("hidden"); if (aiFabEl) aiFabEl.classList.remove("on"); }
  function openAiAssist(cardId, force) {
    if (cardId) currentDetailId = cardId;   // 悬浮助手以该卡为上下文（不进详情 modal）
    aiOpenAssist();
    // 已生成过且非强制  复用缓存；否则拉取
    var card = aiCurrentCard();
    if (card && aiRelateCache[card.id] && aiRelateCache[card.id].rounds && aiRelateCache[card.id].rounds.length && !force) {
      renderRelate(aiRelateCache[card.id], card.hook, false);
      return;
    }
    fetchAiRelate(force);
  }
  if (aiFabEl) aiFabEl.addEventListener("click", function () {
    var open = !aiAssistEl.classList.contains("hidden");
    if (open) { aiCloseAssist(); return; }
    // 打开：牌堆态跟随顶层卡，详情态跟随当前详情卡
    openAiAssist(currentDetailId || (current ? current.id : null), false);
  });
  var aiAssistClose = document.getElementById("aiAssistClose");
  if (aiAssistClose) aiAssistClose.addEventListener("click", aiCloseAssist);
  var aiAssistSend = document.getElementById("aiAssistSend");
  function aiSendQuestion() {
    if (!aiAssistInput) return;
    var q = aiAssistInput.value.trim();
    if (!q) return;
    var card = aiCurrentCard();
    if (!card) { return; }
    aiAssistInput.value = "";
    fetchAiFollow(q, card.id);
  }
  if (aiAssistSend) aiAssistSend.addEventListener("click", aiSendQuestion);
  if (aiAssistInput) aiAssistInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); aiSendQuestion(); }
  });
  // 换一批 / 复制（悬浮面板内的固定按钮，就近绑定）
  var aiAssistRegen = document.getElementById("aiRelateRegenerate");
  var aiAssistCopy = document.getElementById("aiRelateCopy");
  if (aiAssistRegen) aiAssistRegen.addEventListener("click", function () { var c = aiCurrentCard(); if (c) openAiAssist(c.id, true); });
  if (aiAssistCopy) aiAssistCopy.addEventListener("click", aiCopy);
  function fetchAiRelate(force) {
    if (aiFetchLock) return;
    var mainBtn = document.getElementById("detailAiRelate");
    var card = aiCurrentCard();
    if (!card) return;
    var cardId = card.id;
    var panel = document.getElementById("aiRelate");
    var listEl = document.getElementById("aiRelateList");
    var subEl = document.getElementById("aiRelateSub");
    var loadingEl = document.getElementById("aiRelateLoading");
    if (!panel || !listEl) return;
    // 命中缓存直接渲染整段对话（换一批时 force=true 跳过）
    if (!force && aiRelateCache[cardId] && aiRelateCache[cardId].rounds && aiRelateCache[cardId].rounds.length) {
      renderRelate(aiRelateCache[cardId], card.hook, false);
      return;
    }
    if (mainBtn) { mainBtn.disabled = true; mainBtn.classList.add("loading"); }
    var regen = document.getElementById("aiRelateRegenerate");
    var copyBtn = document.getElementById("aiRelateCopy");
    if (regen) regen.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
    // 进入 loading：面板可见、显示「正在生成…」、列表/来源清空
    panel.hidden = false;
    listEl.innerHTML = "";
    var srcElEarly = document.getElementById("aiRelateSources");
    if (srcElEarly) { srcElEarly.hidden = true; srcElEarly.innerHTML = ""; }
    if (loadingEl) loadingEl.hidden = false;
    if (subEl) subEl.textContent = "· " + (card.hook || "");
    aiFetchLock = true;
    var provider = aiGetProvider();
    var body = {
      mode: "relate",
      provider: provider,
      hook: card.hook || "",
      concept: card.concept || "",
      nodes: card.nodes || []
    };
    // custom 源：把用户自己的 key/base/model 透传给后端（不落库、不回显）
    if (provider === "custom") {
      var ac = aiGetCustom();
      // 本地先校验三项齐全，缺了直接给引导，不浪费请求、不丢「AI 关联失败」
      if (!ac.baseUrl || !ac.model || !ac.apiKey) {
        aiFetchLock = false;
        if (mainBtn) { mainBtn.disabled = false; mainBtn.classList.remove("loading"); }
        if (regen) regen.disabled = false;
        if (copyBtn) copyBtn.disabled = false;
        if (loadingEl) loadingEl.hidden = true;
        if (panel) panel.hidden = false;
        listEl.innerHTML = "";
        var guide = document.createElement("li");
        guide.className = "ai-relate-item ai-relate-err";
        guide.innerHTML = '还没填自定义模型：去首页「我的   自定义 AI 模型」填好接口地址 / 模型名 / API Key，' +
          '再点「测试连通性」验证通过，回来就能用。或直接选「小红书 dots / Agnes / 商汤 / b.ai」免费用。';
        listEl.appendChild(guide);
        if (subEl) subEl.textContent = "";
        return;
      }
      body.custom = { baseUrl: ac.baseUrl, model: ac.model, apiKey: ac.apiKey };
    }
    fetch(aiGetApiPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          throw new Error((res.data && res.data.error) || "未返回关联点");
        }
        var parsed = parseAiRelate(res.data);
        if (!parsed.relations.length && !parsed.raw && !parsed.followups.length) {
          throw new Error("未返回关联内容");
        }
        var cached = {
          rounds: [{ role: "ai", items: parsed.relations, raw: parsed.raw, followups: parsed.followups }],
          followups: parsed.followups,
          provider: res.data.provider || provider
        };
        aiRelateCache[cardId] = cached;
        try { localStorage.setItem("rcj_ai_relate_v1", JSON.stringify({ rel: aiRelateCache })); } catch (e) {}
        if (mainBtn) mainBtn.classList.add("on");   // 已生成过  胶囊高亮
        renderRelate(cached, card.hook, false);
        if (loadingEl) loadingEl.hidden = true;
      })
      .catch(function (err) {
        panel.hidden = false;
        if (loadingEl) loadingEl.hidden = true;
        listEl.innerHTML = "";
        var li = document.createElement("li");
        li.className = "ai-relate-item ai-relate-err";
        var msg = "AI 关联失败：" + (err.message || "网络异常");
        // custom 源失败时给引导：多半是三项填错/接口不通，去「我的」重填或先测试
        if (provider === "custom") {
          msg += "（自定义接口可能填错或已失效。去首页「我的   自定义 AI 模型」核对三项，点「测试连通性」验证通过再试；或直接切回 dots / Agnes / 商汤 / b.ai 免费用。）";
        }
        li.textContent = msg;
        listEl.appendChild(li);
        subEl.textContent = "";
        var srcEl = document.getElementById("aiRelateSources");
        if (srcEl) { srcEl.hidden = true; srcEl.innerHTML = ""; }
      })
      .finally(function () {
        if (mainBtn) { mainBtn.disabled = false; mainBtn.classList.remove("loading"); }
        if (regen) regen.disabled = false;
        if (copyBtn) copyBtn.disabled = false;
        aiFetchLock = false;
      });
  }

  // 用户点选引导提问  追问一轮（relate_follow）
  function fetchAiFollow(question, cardId) {
    if (aiFetchLock) return;
    var card = byId[cardId];
    if (!card) return;
    var panel = document.getElementById("aiRelate");
    var listEl = document.getElementById("aiRelateList");
    var loadingEl = document.getElementById("aiRelateLoading");
    if (!panel || !listEl) return;
    if (loadingEl) loadingEl.hidden = false;
    aiFetchLock = true;
    var provider = aiGetProvider();
    var body = {
      mode: "relate_follow",
      provider: provider,
      hook: card.hook || "",
      concept: card.concept || "",
      nodes: card.nodes || [],
      question: question
    };
    if (provider === "custom") {
      var ac = aiGetCustom();
      body.custom = { baseUrl: ac.baseUrl, model: ac.model, apiKey: ac.apiKey };
    }
    fetch(aiGetApiPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.data && res.data.error) || "追问失败");
        var parsed = parseAiRelate(res.data);
        var cached = aiRelateCache[cardId] || { rounds: [], followups: [], provider: provider };
        cached.rounds.push({ role: "user", text: question });
        cached.rounds.push({ role: "ai", items: parsed.relations, raw: parsed.raw, followups: parsed.followups });
        cached.followups = parsed.followups;
        cached.provider = res.data.provider || provider;
        aiRelateCache[cardId] = cached;
        try { localStorage.setItem("rcj_ai_relate_v1", JSON.stringify({ rel: aiRelateCache })); } catch (e) {}
        renderRelate(cached, card.hook, false);
        if (loadingEl) loadingEl.hidden = true;
      })
      .catch(function (err) {
        if (loadingEl) loadingEl.hidden = true;
        // 错误作为一轮提示追加，不打断已有对话
        var cached = aiRelateCache[cardId] || { rounds: [], followups: [], provider: provider };
        cached.rounds.push({ role: "user", text: question });
        cached.rounds.push({ role: "ai", items: [], raw: "", error: (err.message || "网络异常") });
        aiRelateCache[cardId] = cached;
        renderRelate(cached, card.hook, false);
      })
      .finally(function () { aiFetchLock = false; });
  }

  // 解析后端返回：兼容 {relations, raw, followups} 或纯文本
  function parseAiRelate(data) {
    var relations = (data.relations || []).filter(function (x) { return x && x.text; })
      .map(function (x) { return { type: x.type || "关联", text: x.text }; });
    var raw = data.raw || "";
    var followups = (data.followups || []).filter(function (x) { return x && (x.text || x.question); })
      .map(function (x, i) { return { id: String(x.id || ("q" + (i + 1))), text: x.text || x.question }; });
    return { relations: relations, raw: raw, followups: followups };
  }

  // 渲染整段对话（append=false 时清空重渲染；对话结构见 aiRelateCache）
  function renderRelate(cached, hook, append) {
    var panel = document.getElementById("aiRelate");
    var listEl = document.getElementById("aiRelateList");
    var subEl = document.getElementById("aiRelateSub");
    var srcEl = document.getElementById("aiRelateSources");
    var loadingEl = document.getElementById("aiRelateLoading");
    if (!panel || !listEl) return;
    panel.hidden = false;
    if (loadingEl) loadingEl.hidden = true;
    if (!append) {
      subEl.textContent = "· " + (hook || "");
      listEl.innerHTML = "";
    }
    var rounds = (cached && cached.rounds) || [];
    rounds.forEach(function (round) {
      if (round.role === "user") {
        var u = document.createElement("li");
        u.className = "ai-relate-item ai-relate-user";
        u.textContent = " " + (round.text || "");
        listEl.appendChild(u);
      } else if (round.error) {
        var e = document.createElement("li");
        e.className = "ai-relate-item ai-relate-err";
        e.textContent = "AI 关联失败：" + round.error;
        listEl.appendChild(e);
      } else {
        var items = round.items || [];
        var raw = round.raw || "";
        items.forEach(function (r) {
          var li = document.createElement("li");
          li.className = "ai-relate-item";
          var tag = document.createElement("span");
          tag.className = "ai-relate-type";
          tag.textContent = r.type || "角度";
          var txt = document.createElement("span");
          txt.className = "ai-relate-text";
          txt.textContent = r.text || "";
          li.appendChild(tag);
          li.appendChild(txt);
          listEl.appendChild(li);
        });
        if (raw) {
          var li2 = document.createElement("li");
          li2.className = "ai-relate-item ai-relate-raw";
          li2.textContent = raw;
          listEl.appendChild(li2);
        }
      }
    });
    // 引导提问气泡（可点击追问）
    renderFollowups(cached && cached.followups, cached && cached.provider);
    if (srcEl) {
      var sources = (cached && cached.sources) || [];
      if (sources && sources.length) {
        srcEl.hidden = false; srcEl.innerHTML = "";
        var label = document.createElement("span");
        label.className = "ai-src-label"; label.textContent = "来源";
        srcEl.appendChild(label);
        sources.forEach(function (s) {
          var a = document.createElement("a");
          a.className = "ai-src-link";
          a.href = s.uri; a.target = "_blank"; a.rel = "noopener";
          a.textContent = (s.title || s.uri);
          srcEl.appendChild(a);
        });
      } else { srcEl.hidden = true; srcEl.innerHTML = ""; }
    }
  }

  // 渲染引导提问为可点击气泡；点击  发起 relate_follow 追问
  function renderFollowups(followups, provider) {
    var wrap = document.getElementById("aiRelateFollow");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!followups || !followups.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    followups.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ai-follow-btn";
      b.textContent = f.text;
      b.setAttribute("data-q", f.text);
      b.addEventListener("click", function () {
        var card = aiCurrentCard();
        if (!card) return;
        fetchAiFollow(f.text, card.id);
      });
      wrap.appendChild(b);
    });
  }
  function aiCopy() {
    var card = aiCurrentCard();
    if (!card) return;
    var cached = aiRelateCache[card.id];
    if (!cached || !cached.rounds || !cached.rounds.length) { aiFlashCopy("先生成关联点"); return; }
    // 汇集所有轮次的关联点与纯文本讲解（缓存结构为 rounds 对话数组）
    var relations = [];
    var raws = [];
    cached.rounds.forEach(function (r) {
      if (r.items && r.items.length) relations = relations.concat(r.items);
      if (r.raw) raws.push(r.raw);
    });
    var text;
    if (relations.length) {
      text = relations.map(function (r) { return "【" + (r.type || "角度") + "】" + r.text; }).join("\n");
    } else if (raws.length) {
      text = raws.join("\n");
    } else {
      aiFlashCopy("先生成关联点");
      return;
    }
    var n = relations.length || (text.split("\n").length);
    var done = function () { aiFlashCopy("已复制 " + n + " 条"); };
    var fail = function () { aiFlashCopy("复制失败，手动选"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done, fail); });
    } else { fallbackCopy(text, done, fail); }
  }
  function fallbackCopy(text, done, fail) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      if (done) done();
    } catch (e) { if (fail) fail(); }
  }
  function aiFlashCopy(msg) {
    var btn = document.getElementById("aiRelateCopy");
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1400);
  }
  // 详情底部「 AI 关联」按钮（静态，绑定一次）
  var aiMainBtn = document.getElementById("detailAiRelate");
  if (aiMainBtn) aiMainBtn.addEventListener("click", function () { openAiAssist(currentDetailId, false); });
  // 模型选择器：变更即存 localStorage（下次默认），并清当前卡缓存以便切源重取
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.name === "aiProvider" && (t.value === "dots" || t.value === "agnes" || t.value === "sensenova" || t.value === "bai" || t.value === "groq" || t.value === "custom")) {
      aiSetProvider(t.value);
      if (currentDetailId) delete aiRelateCache[currentDetailId];
      updateAiCustomTip();
      syncAiPickers();
    }
  });
  // 自定义选项引导：选中 custom 但三项未填  显示提示；填好了  隐藏
  function updateAiCustomTip() {
    var tip = document.getElementById("aiCustomTip");
    if (!tip) return;
    if (aiGetProvider() === "custom") {
      var ac = aiGetCustom();
      tip.hidden = !!(ac.baseUrl && ac.model && ac.apiKey);
    } else {
      tip.hidden = true;
    }
  }

    // 自定义模型输入框：填充 / 保存 / 测试连通性 / 显示隐藏Key
  function initAiCustomInputs() {
    var baseEl = document.getElementById("aiBase");
    var modelEl = document.getElementById("aiModelName");
    var keyEl = document.getElementById("aiCustomKey");
    var keyToggle = document.getElementById("aiKeyToggle");
    var probeBtn = document.getElementById("aiProbeBtn");
    var probeRes = document.getElementById("aiProbeRes");
    if (!baseEl || !modelEl || !keyEl) return;
    var c = aiGetCustom();
    baseEl.value = c.baseUrl || "";
    modelEl.value = c.model || "";
    keyEl.value = c.apiKey || "";
    function saveCustom() {
      aiSetCustom({ baseUrl: baseEl.value.trim(), model: modelEl.value.trim(), apiKey: keyEl.value.trim() });
      updateAiCustomTip();
    }
    baseEl.addEventListener("input", saveCustom);
    modelEl.addEventListener("input", saveCustom);
    keyEl.addEventListener("input", saveCustom);
    if (keyToggle) {
      keyToggle.addEventListener("click", function () {
        keyEl.type = (keyEl.type === "password") ? "text" : "password";
      });
    }
    if (probeBtn) {
      probeBtn.addEventListener("click", async function () {
        if (!baseEl.value.trim() || !modelEl.value.trim() || !keyEl.value.trim()) {
          if (probeRes) { probeRes.className = "ai-probe-res fail"; probeRes.textContent = "接口地址 / 模型名 / API Key 三项齐全才能测试"; }
          return;
        }
        probeBtn.disabled = true;
        if (probeRes) { probeRes.className = "ai-probe-res testing"; probeRes.textContent = "测试中…"; }
        try {
          var res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "relate_probe", custom: { baseUrl: baseEl.value.trim(), model: modelEl.value.trim(), apiKey: keyEl.value.trim() } })
          });
          var data = await res.json();
          if (probeRes) {
            if (data.ok) {
              probeRes.className = "ai-probe-res ok";
              probeRes.textContent = "连通成功（模型：" + (data.model || modelEl.value.trim()) + "）";
            } else {
              probeRes.className = "ai-probe-res fail";
              probeRes.textContent = "连通失败：" + (data.error || ("HTTP " + res.status));
            }
          }
        } catch (err) {
          if (probeRes) { probeRes.className = "ai-probe-res fail"; probeRes.textContent = "请求异常：" + err.message; }
        } finally {
          probeBtn.disabled = false;
        }
      });
    }
  }

  /* ---------- 启动 ---------- */
  syncNav();
  syncAiPickers();
  initAiCustomInputs();
  // 刷新后尽量停留上次那张顶层卡，而不是随机跳到别处
  var lastId = state.lastCardId;
  if (lastId && byId[lastId] && !queuedIds[lastId]) {
    queue.push(byId[lastId]); queuedIds[lastId] = true;
    recentThemeWindow = recentThemeWindow.concat(
      (byId[lastId].tags || []).filter(function (t) { return themeSet[t]; })).slice(-6);
  }
  fillQueue();
  renderStack("instant");
})();

// 规范化判断题：把 options.letter 与 answer 由"正确"/"错误"映射为 A/B，避免 UI 显示成"正确。正确"
(function(){
  function normBool(data){
    if(!data || !data.length) return data;
    data.forEach(function(q){
      if((q.type==="judge"||q.type==="bool") && q.options && q.options.length){
        var map={}; var opts=q.options;
        opts.forEach(function(o,i){
          var orig=String(o.letter||"").trim();
          map[orig] = (i===0?"A":"B");
          o.letter = map[orig];
        });
        var ans=String(q.answer||"").trim();
        if(map[ans]) q.answer=map[ans];
      }
    });
    return data;
  }
  if(window.DATA_WRITTEN) window.DATA_WRITTEN = normBool(window.DATA_WRITTEN);
  if(window.DATA_INTERVIEW) window.DATA_INTERVIEW = normBool(window.DATA_INTERVIEW);
  if(window.DATA) window.DATA = normBool(window.DATA);
})();
// 答案显示：判断题 A/B 映射回"正确"/"错误"
function displayAnswer(q){
  var ans = q.answer == null ? "" : String(q.answer).trim();
  if((q.type==="judge"||q.type==="bool") && ans.length===1){
    if(ans==="A") return "正确";
    if(ans==="B") return "错误";
  }
  return ans;
}
// 把答案字母转成"字母.选项文字"的可读标签（如 "C. 治安处罚法"，多选 "A. 甲、B. 乙"）；无选项文字则仅字母；空则"未选择"
function answerLabel(q, letters){
  if(!letters || (Array.isArray(letters) && !letters.length)) return "未选择";
  var arr = Array.isArray(letters) ? letters : String(letters).split("");
  return arr.map(function(L){
    var t = "";
    (q.options||[]).forEach(function(o){ if(o.letter === L) t = o.text; });
    return L + (t ? ("." + t) : "");
  }).join("、");
}
// 生成判定横幅：始终同时显示"我的答案"与"正确答案"，消除纯颜色歧义与"我到底选了哪个"的困惑
function makeResultBanner(isCorrect, q, selLetters){
  var d = document.createElement("div");
  d.className = "ans-result " + (isCorrect ? "ans-correct" : "ans-wrong");
  var verdict = isCorrect ? " 回答正确" : " 回答错误";
  var myAns = answerLabel(q, selLetters);
  var corr = answerLabel(q, String(q.answer == null ? "" : q.answer).split(""));
  d.innerHTML = '<div class="ans-verdict">' + verdict + '</div>'
    + '<div class="ans-line">我的答案：<b>' + escapeHtml(myAns) + '</b></div>'
    + '<div class="ans-line">正确答案：<b>' + escapeHtml(corr) + '</b></div>';
  return d;
}
// ============ 可配置项（优先读 window.SITE_CONFIG，由 template-config.json 生成；没有则用内联默认值）============
var _DEFAULTS = {
  siteTitle: "辅警真题卡组",
  siteEmoji: "",
  subtitle: "真实考试真题 · 结构化面试 · 离线可用",
  logo: "",
  cover: "",
  themeColor: "#1e3a5f",
  contact: "",
  xianyuCode: "",
  promoTitle: "",
  promoText: "",
  rewardImage: "",
  rewardTitle: "请作者喝水",
  rewardDesc: "",
  footerText: "Powered by RCJ Exam Template",
  timerSeconds: 180,
  // 套题模考默认预设（可由 template-config.json 的 examPreset 覆盖，实现"一键标准卷"）
  examPreset: { label: "标准模考", single: 36, multi: 12, bool: 12, minutes: 60, typing: true, typingMinutes: 10 },
  // 打字题范文（套题模考附加项，不计入客观题分）
  typingText: "辅警是公安机关的重要辅助力量，承担着维护社会治安、服务人民群众的重要职责。每一位辅警都应当以高度的责任感和使命感，认真履行岗位职责，严格遵守工作纪律，做到忠诚、干净、担当，为建设平安中国贡献自己的力量。",
  enabledModules: { promo: false, xianyu: false, reward: false, progress: true, themeToggle: true, record: true },
  defaultPage: "written",
  // ===== 重新设计：真题优先 + 机考/非机考通用 =====
  brandName: "辅警真题卡组",
  cityName: "",            // 城市名，如 "深圳" / "惠州"
  examType: "paper",       // "computer" = 机考(套题模考为核心) | "paper" = 非机考
  examYear: "",            // 真题年份/区间，如 "2024-2026"
  realQuestions: true,     // 铁律：本站题目必须全部为真实考试真题，禁止拼凑/洗白
  realQuestionsNote: "本站题目全部为真实考试真题，无拼凑与洗白内容。",
  modules: { mockExam: true, targeted: true, random: true, written: true, interview: true }
};
// 站点配置覆盖默认值（站点没配的字段自动回退到_DEFAULTS，如 typingText / examPreset 等）
var CONFIG = Object.assign({}, _DEFAULTS, window.SITE_CONFIG || {});

// 数据来源：笔试 = window.DATA_WRITTEN，面试 = window.DATA_INTERVIEW；兜底 window.DATA（单文件模式）
var W_DATA = window.DATA_WRITTEN || [];
var I_DATA = window.DATA_INTERVIEW || [];
var G_DATA = window.DATA || [];

// 修复：数据源可能缺失 _idx 字段，导致卡片按钮 data-idx="undefined"、点击提交无反应
[W_DATA, I_DATA, G_DATA].forEach(function (arr) {
  if (!arr || !arr.length) return;
  arr.forEach(function (q, i) { if (q._idx == null) q._idx = i; });
});

var hasW = W_DATA.length > 0, hasI = I_DATA.length > 0;
var singleMode = null;
if (!hasW && !hasI && G_DATA.length) {
  var _s = G_DATA[0];
  singleMode = (_s && (_s.title !== undefined || _s.session !== undefined) && !_s.options) ? "interview" : "written";
}

function dataset() {
  if (MODE === "written") return hasW ? W_DATA : G_DATA;
  return hasI ? I_DATA : G_DATA;
}

// 默认模式：两库都在时，题量大的优先展示；否则展示存在的那个
var MODE = (hasW && hasI)
  ? (CONFIG.defaultPage === "interview" ? "interview" : "written")
  : (hasW ? "written" : (hasI ? "interview" : singleMode));

var TYPE_MAP = {
  "综合分析": { cls: "zhfx", label: "综合分析" },
  "应急应变": { cls: "yjyb", label: "应急应变" },
  "组织管理": { cls: "zzgl", label: "组织管理" },
  "自我认知与职位匹配": { cls: "zwrz", label: "自我认知" },
  "人际沟通": { cls: "rjgt", label: "人际沟通" },
  "现场模拟": { cls: "xcmn", label: "现场模拟" }
};
var WRITTEN_TYPE_LABEL = { single: "单选题", multiple: "多选题", multi: "多选题", judge: "判断题", bool: "判断题", blank: "填空题", qa: "简答题", essay: "简答题", case: "案例分析", subjective: "主观题" };
var TAG_MAP = {
  "高频": { cls: "gp", icon: "" },
  "深圳特色": { cls: "sz", icon: "" },
  "热点": { cls: "rd", icon: "" },
  "必刷": { cls: "bs", icon: "" },
  "常规": { cls: "cg", icon: "" }
};

// 标签统一成数组：面试 tags 是数组，笔试 tags 是空格分隔字符串
function normTags(q) {
  var t = q.tags;
  if (!t) return [];
  if (Array.isArray(t)) return t;
  return String(t).split(/\s+/).filter(Boolean);
}

// 掌握度存储：按 mode 隔离
var StorageCtrl = {
  key: function () { return "sso_status_" + MODE; },
  get: function () {
    try { return JSON.parse(localStorage.getItem(this.key())) || {}; } catch (e) { return {}; }
  },
  set: function (db) { try { localStorage.setItem(this.key(), JSON.stringify(db)); } catch (e) {} this.updateUI(); },
  updateUI: function () {
    var db = this.get();
    var data = dataset();
    var mc = 0;
    data.forEach(function (q) { if (db[q._idx] === "mastered") mc++; });
    var pct = data.length ? Math.round((mc / data.length) * 100) : 0;
    var pl = document.getElementById("progressLabel");
    var pp = document.getElementById("progressPercent");
    var pb = document.getElementById("progressBar");
    if (pl) pl.innerHTML = " 已掌握 <strong>" + mc + "</strong> / " + data.length + " 道题";
    if (pp) pp.textContent = pct + "%";
    if (pb) pb.style.width = pct + "%";
  }
};

// ============ 本轮战绩（本次访问内的刷题正确率，吸顶常驻）============
// 仅统计"判分提交"（客观题），主观题/查看答案不计分、不计入。
var roundStats = { answered: 0, correct: 0 };
function recordRound(isCorrect) {
  roundStats.answered++;
  if (isCorrect) roundStats.correct++;
  updateRoundStat();
}
function updateRoundStat() {
  var box = document.getElementById("roundStatBox");
  if (!box) return;
  var a = roundStats.answered, c = roundStats.correct;
  var pct = a ? Math.round((c / a) * 100) : 0;
  box.querySelector(".rs-val").textContent = "已答 " + a + " · 正确率 " + (a ? pct + "%" : "—");
  box.classList.toggle("all-correct", a > 0 && c === a);
}
function initRoundStat() {
  var ti = document.querySelector(".toolbar-inner");
  if (!ti || document.getElementById("roundStatBox")) return;
  var box = document.createElement("div");
  box.className = "round-stat";
  box.id = "roundStatBox";
  box.setAttribute("aria-live", "polite");
  box.innerHTML = '<span class="rs-label"> 本轮</span>'
    + '<span class="rs-val">已答 0 · 正确率 —</span>'
    + '<button type="button" class="round-stat-reset" id="roundStatReset" title="重置本轮战绩" aria-label="重置本轮战绩"></button>';
  ti.appendChild(box);
  box.querySelector("#roundStatReset").addEventListener("click", function () {
    roundStats = { answered: 0, correct: 0 }; updateRoundStat();
  });
}
// 键盘操作：聚焦选项后用数字 1-9 / 字母 a-d 选中，Enter 或 Space 提交本题
function initQuizKeyboard() {
  document.addEventListener("keydown", function (e) {
    var opt = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".study-opt") : null;
    if (!opt) return;
    var idx = parseInt(opt.dataset.idx, 10);
    var q = studyQuestionByIdx(idx);
    if (!q || normType(q.type) === "subjective") return;
    if (opt.classList.contains("locked")) {
      if (e.key === "Enter") { e.preventDefault(); revealStudyAnswer(idx); }
      return;
    }
    var card = opt.closest(".card");
    var k = (e.key || "").toLowerCase();
    var m = /^[1-9]$/.test(k) ? parseInt(k, 10) : (/^[a-z]$/.test(k) ? k.charCodeAt(0) - 96 : 0);
    if (m > 0) {
      var opts = card.querySelectorAll(".study-opt");
      var target = opts[m - 1];
      if (target) {
        e.preventDefault();
        var isMulti = (q.type === "multi" || q.type === "multiple");
        if (isMulti) { target.classList.toggle("selected"); }
        else {
          opts.forEach(function (o) { o.classList.remove("selected"); });
          target.classList.add("selected");
        }
        target.focus();
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      revealStudyAnswer(idx);
    }
  });
}

function escapeHtml(text) {
  var d = document.createElement("div"); d.textContent = text == null ? "" : text; return d.innerHTML;
}
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function highlight(text, keyword) {
  var escaped = escapeHtml(text);
  if (!keyword) return escaped;
  try { var re = new RegExp("(" + escapeRegex(keyword) + ")", "gi"); return escaped.replace(re, "<mark>$1</mark>"); }
  catch (e) { return escaped; }
}
function formatAnswer(text, keyword) {
  var html = escapeHtml(text == null ? "" : text);
  if (keyword) { try { var re = new RegExp("(" + escapeRegex(keyword) + ")", "gi"); html = html.replace(re, "<mark>$1</mark>"); } catch (e) {} }
  // 自动分段：在步骤关键词前加换行，并用样式高亮
  html = html.replace(/(第一步|第二步|第三步|第四步|第五步|首先|其次|再次|最后|先说|再说|最后说|第一，|第二，|第三，|第四，)/g, '<br><br><span class="ans-step">$1</span>');
  // 开头如果有分段标签，去掉前面的空行
  html = html.replace(/^<br><br>/, '');
  return html;
}

// 题库维度（按 mode）
function activeDimensions() {
  return MODE === "interview"
    ? [{ key: "year", label: "年份" }, { key: "type", label: "题型" }, { key: "tag", label: "标签" }]
    : [{ key: "batch", label: "批次" }, { key: "type", label: "题型" }];
}
function deriveValues(dim) {
  var set = {}, data = dataset();
  data.forEach(function (q) {
    if (dim === "tag") { normTags(q).forEach(function (t) { if (TAG_MAP[t]) set[t] = 1; }); }
    else if (dim === "year") { if (q.year) set[q.year] = 1; }
    else if (dim === "batch") { if (q.batch) set[q.batch] = 1; }
    else if (dim === "type") { if (q.type) set[q.type] = 1; }
  });
  return Object.keys(set);
}
function dimLabel(dim, val) {
  if (dim === "type") return MODE === "interview" ? (TYPE_MAP[val] ? TYPE_MAP[val].label : val) : (WRITTEN_TYPE_LABEL[val] || val);
  return val;
}

var filterState = {};
var filterMark = false;
var PAGE_SIZE = 40;
var flatItems = [], renderedCount = 0, currentGroup = null, groupCounts = {}, totalShown = 0, currentSearch = "";
var PAGE_SIZE_I = PAGE_SIZE;

function groupKey(q) { return MODE === "interview" ? (q.year || "未注明年份") : (q.batch || "未注明批次"); }

function searchText(q) {
  if (MODE === "interview") return (q.title + " " + (q.answer || "") + " " + (q.session || "") + " " + normTags(q).join(" "));
  var opts = (q.options || []).map(function (o) { return o.text; }).join(" ");
  return (q.stem + " " + opts + " " + (q.answer || "") + " " + (q.explanation || "") + " " + (q.batch || "") + " " + normTags(q).join(" "));
}

function buildFilterRows() {
  var wrap = document.getElementById("filterRows");
  wrap.innerHTML = "";
  activeDimensions().forEach(function (d) {
    var row = document.createElement("div");
    row.className = "filter-row";
    var lab = document.createElement("span");
    lab.className = "filter-label"; lab.textContent = d.label;
    row.appendChild(lab);
    var btnsWrap = document.createElement("div");
    btnsWrap.className = "filter-btns";
    var all = document.createElement("button");
    all.className = "btn active"; all.dataset.dim = d.key; all.dataset.value = "all"; all.textContent = "全部";
    btnsWrap.appendChild(all);
    deriveValues(d.key).forEach(function (v) {
      var b = document.createElement("button");
      b.className = "btn"; b.dataset.dim = d.key; b.dataset.value = v; b.textContent = dimLabel(d.key, v);
      btnsWrap.appendChild(b);
    });
    row.appendChild(btnsWrap);
    wrap.appendChild(row);
  });
}

function computeFiltered() {
  var search = document.getElementById("searchInput").value.trim().toLowerCase();
  currentSearch = search;
  var data = dataset();
  var statusDB = StorageCtrl.get();
  var dims = activeDimensions();
  return data.filter(function (q) {
    for (var i = 0; i < dims.length; i++) {
      var d = dims[i], val = filterState[d.key] || "all";
      if (val === "all") continue;
      var ok;
      if (d.key === "tag") ok = normTags(q).indexOf(val) !== -1;
      else ok = (q[d.key] === val);
      if (!ok) return false;
    }
    if (filterMark && statusDB[q._idx] === "mastered") return false;
    if (search && searchText(q).toLowerCase().indexOf(search) === -1) return false;
    return true;
  });
}

function tagBadgesHtml(q) {
  if (MODE === "written") return "";   // 笔试批次/题型已在卡片别处展示，隐藏标签避免冗余
  var h = "";
  normTags(q).forEach(function (t) {
    var ti = TAG_MAP[t];
    if (ti) h += '<span class="tag-badge tag-' + ti.cls + '">' + ti.icon + " " + escapeHtml(t) + "</span>";
    else h += '<span class="tag-badge tag-default">' + escapeHtml(t) + "</span>";
  });
  return h;
}
function answerSection(html) {
  return '<div class="answer-section"><div class="answer-title"> ' + (MODE === "interview" ? "参考答案" : "答案与解析") + '</div><div class="answer-content">' + html + "</div></div>";
}
function frameworkHtml(q) {
  if (!q || !q.framework) return "";
  var lines = String(q.framework).split("\n");
  var inner = lines.map(function (l) { return '<div class="fw-line">' + escapeHtml(l) + "</div>"; }).join("");
  return '<div class="framework-box"><div class="fw-title"> 结构化思路</div>' + inner + "</div>";
}
function abilityLogicHtml(q) {
  if (!q || MODE !== "interview") return "";
  if (!q.ability && !q.logic) return "";
  var h = '<div class="ability-logic-box">';
  if (q.ability) h += '<div class="al-item"><span class="al-label"> 考察能力</span><span class="al-text">' + escapeHtml(q.ability) + "</span></div>";
  if (q.logic) h += '<div class="al-item"><span class="al-label"> 出题逻辑</span><span class="al-text">' + escapeHtml(q.logic) + "</span></div>";
  h += "</div>";
  return h;
}

function cardHtml(q) {
  var badges, titleHtml, bodyInner;
  if (MODE === "interview") {
    var ti = TYPE_MAP[q.type] || { cls: "zhfx", label: q.type };
    badges = '<span class="badge badge-type-' + ti.cls + '"> ' + escapeHtml(ti.label) + "</span>"
      + (q.year ? '<span class="badge badge-year">' + escapeHtml(q.year) + "</span>" : "")
      + (q.session ? '<span class="badge badge-session">' + escapeHtml(q.session) + "</span>" : "")
      + tagBadgesHtml(q);
    titleHtml = highlight(q.title || "", currentSearch);
    bodyInner = answerSection(frameworkHtml(q) + abilityLogicHtml(q) + formatAnswer(q.answer || "（暂无参考答案）", currentSearch));
  } else {
    var wl = WRITTEN_TYPE_LABEL[q.type] || q.type;
    badges = (q.num != null ? '<span class="badge badge-year">#' + q.num + "</span>" : "")
      + (q.batch ? '<span class="badge badge-session">' + escapeHtml(q.batch) + "</span>" : "")
      + '<span class="badge badge-type-zhfx"> ' + escapeHtml(wl) + "</span>"
      + tagBadgesHtml(q);
    titleHtml = highlight(q.stem || "", currentSearch);
    var isSubjective = normType(q.type) === "subjective";
    if (isSubjective) {
      // 主观题（简答/案例）：无选项，点「查看答案」直接展开参考答案，不判分
      var subAns = '<div class="subjective-answer">' + formatAnswer(q.answer || "（暂无参考答案）", currentSearch) + "</div>";
      if (q.explanation) subAns += '<div class="subjective-tip"> 要点提示：' + formatAnswer(q.explanation, currentSearch) + "</div>";
      bodyInner = '<div class="study-check"><button type="button" class="study-check-btn" data-idx="' + q._idx + '" onclick="revealStudyAnswer(' + q._idx + ')"> 查看答案</button></div>'
        + '<div class="study-answer" id="ans' + q._idx + '" style="display:none">' + answerSection(subAns) + "</div>";
    } else {
      var optsHtml = "";
      if (q.options && q.options.length) {
        q.options.forEach(function (o) {
          optsHtml += '<div class="opt-row study-opt" tabindex="0" role="button" aria-label="选项 ' + escapeHtml(o.letter) + '" data-idx="' + q._idx + '" data-letter="' + escapeHtml(o.letter) + '"><span class="opt-letter">' + escapeHtml(o.letter) + ".</span><span>" + escapeHtml(o.text) + "</span></div>";
        });
      }
      var ansHtml = "<div>答案：<b>" + escapeHtml(displayAnswer(q)) + "</b></div>";
      if (q.explanation) ansHtml += '<div style="margin-top:10px">解析：' + formatAnswer(q.explanation, currentSearch) + "</div>";
      bodyInner = (optsHtml ? '<div style="margin:12px 0">' + optsHtml + "</div>" : "")
        + '<div class="study-check"><button type="button" class="study-check-btn" data-idx="' + q._idx + '" onclick="revealStudyAnswer(' + q._idx + ')"> 提交答案</button></div>'
        + '<div class="study-answer" id="ans' + q._idx + '" style="display:none">' + answerSection(ansHtml) + "</div>";
    }
  }
  var statusDB = StorageCtrl.get();
  var cur = statusDB[q._idx] || "not-mastered";
  var actNM = cur === "not-mastered" ? "active" : "";
  var actM = cur === "mastered" ? "active" : "";
  return '<div class="card" id="q' + q._idx + '"><div class="card-header"><div class="card-left"><div class="card-badges">' + badges + '</div><div class="card-title">' + titleHtml + '</div></div><span class="arrow"></span></div>'
    + '<div class="card-body"><div class="card-body-inner"><div class="hint-bar"><span>' + (MODE === "interview" ? " 先自我作答，再展开参考答案。" : (isSubjective ? " 先自行作答，点「查看答案」核对要点。" : " 选择答案后，点「提交答案」查看对错与解析。")) + '</span>'
    + '<div class="study-actions"><button class="study-btn not-mastered ' + actNM + '" onclick="changeTrack(event,' + q._idx + ",'not-mastered')\"> 仍需练习</button>"
    + '<button class="study-btn mastered ' + actM + '" onclick="changeTrack(event,' + q._idx + ",'mastered')\"> 已掌握</button></div></div>"
    + bodyInner + "</div></div></div>";
}


function render() {
  if (document.getElementById("examBtn")) {
    var _showExam = (MODE !== "interview") && CONFIG.modules && CONFIG.modules.mockExam;
    document.getElementById("examBtn").style.display = _showExam ? "" : "none";
  }
  var list = computeFiltered();
  flatItems = list; totalShown = list.length; renderedCount = 0; currentGroup = null; groupCounts = {};
  if (MODE === "interview") flatItems.sort(function (a, b) { return String(b.year || "").localeCompare(String(a.year || "")); });
  flatItems.forEach(function (q) { var g = groupKey(q); groupCounts[g] = (groupCounts[g] || 0) + 1; });
  var container = document.getElementById("questionsList");
  if (flatItems.length === 0) { container.innerHTML = '<div class="no-result"> 未找到匹配的题目，请调整筛选条件</div>'; hideLoadMore(); updateCount(); return; }
  container.innerHTML = "";
  appendBatch();
}

function appendBatch() {
  var container = document.getElementById("questionsList");
  var end = Math.min(renderedCount + PAGE_SIZE, flatItems.length);
  var html = "";
  for (var i = renderedCount; i < end; i++) {
    var q = flatItems[i], g = groupKey(q);
    if (g !== currentGroup) {
      if (currentGroup !== null) html += "</div>";
      currentGroup = g;
      html += '<div class="year-section"><h2 class="year-title">' + escapeHtml(g) + ' <span class="year-count">' + (groupCounts[g] || 0) + "道</span></h2>";
    }
    html += cardHtml(q);
  }
  container.insertAdjacentHTML("beforeend", html);
  renderedCount = end;
  if (renderedCount >= flatItems.length) {
    if (currentGroup !== null) { container.insertAdjacentHTML("beforeend", "</div>"); currentGroup = null; }
    hideLoadMore();
  } else showLoadMore();
  updateCount();
}
function loadAll() { while (renderedCount < flatItems.length) appendBatch(); }

function updateCount() {
  var el = document.getElementById("resultCount");
  if (!el) return;
  var tail = totalShown < dataset().length ? "（筛选后 " + totalShown + "）" : "";
  el.innerHTML = "显示 <strong>" + renderedCount + "</strong>/" + dataset().length + " 道" + tail;
}
function showLoadMore() { document.getElementById("loadMoreWrap").style.display = "block"; }
function hideLoadMore() { document.getElementById("loadMoreWrap").style.display = "none"; }

function changeTrack(e, idx, status) {
  e.stopPropagation();
  var db = StorageCtrl.get();
  db[idx] = status;
  StorageCtrl.set(db);
  var pNode = e.target.parentElement;
  pNode.querySelectorAll(".study-btn").forEach(function (b) { b.classList.remove("active"); });
  e.target.classList.add("active");
}

function updateStats() {
  var data = dataset();
  var dimKey = MODE === "interview" ? "year" : "batch";
  var dimSet = {}, typeSet = {};
  data.forEach(function (q) { if (q[dimKey]) dimSet[q[dimKey]] = 1; if (q.type) typeSet[MODE === "interview" ? q.type : normType(q.type)] = 1; });
  document.getElementById("statNum0").textContent = data.length;
  document.getElementById("statLabel0").textContent = "真题数";
  document.getElementById("statNum1").textContent = Object.keys(dimSet).length;
  document.getElementById("statLabel1").textContent = MODE === "interview" ? "覆盖年份" : "覆盖批次";
  document.getElementById("statNum2").textContent = Object.keys(typeSet).length;
  document.getElementById("statLabel2").textContent = "题型分类";
}

function buildModeTabs() {
  var box = document.getElementById("modeTabs");
  box.innerHTML = "";
  var tabs = [];
  if ((hasW || singleMode === "written") && !CONFIG.hideWritten) tabs.push({ m: "written", label: " 笔试真题" });
  if (hasI || singleMode === "interview") tabs.push({ m: "interview", label: " 面试真题" });
  if (tabs.length <= 1) { box.style.display = "none"; return; }
  box.style.display = "inline-flex";
  tabs.forEach(function (t) {
    var b = document.createElement("button");
    b.className = "mode-tab" + (t.m === MODE ? " active" : "");
    b.dataset.mode = t.m; b.textContent = t.label;
    b.addEventListener("click", function () { switchMode(t.m); });
    box.appendChild(b);
  });
}

function switchMode(m) {
  if (m === "written" && !hasW && singleMode !== "written") return;
  if (m === "interview" && !hasI && singleMode !== "interview") return;
  MODE = m;
  filterState = {};
  buildModeTabs();
  buildFilterRows();
  updateStats();
  StorageCtrl.updateUI();
  render();
  window.scrollTo({ top: 0 });
}

// 按板块刷：先作答、后核对（不直接给答案）
function studyQuestionByIdx(idx) {
  var data = dataset();
  for (var i = 0; i < data.length; i++) if (data[i]._idx === idx) return data[i];
  return null;
}
function revealStudyAnswer(idx) {
  console.log("[提交] revealStudyAnswer called, idx=", idx);
  try {
  var q = studyQuestionByIdx(idx); if (!q) return;
  var card = document.getElementById("q" + idx);
  if (normType(q.type) === "subjective") {
    var sAns = document.getElementById("ans" + idx);
    if (sAns) sAns.style.display = "block";
    var sBtn = card.querySelector(".study-check-btn");
    if (sBtn) sBtn.style.display = "none";
    return;
  }

  var selLetters = [];
  card.querySelectorAll(".study-opt.selected").forEach(function (o) { selLetters.push(o.dataset.letter); });
  var btn = card.querySelector(".study-check-btn");
  var ansEl = document.getElementById("ans" + idx);
  // 未选择则提示，不判分、不展开
  if (selLetters.length === 0) {
    if (btn) { var orig = btn.textContent; btn.textContent = " 请先选择答案"; setTimeout(function () { btn.textContent = orig; }, 1200); }
    return;
  }
  card.querySelectorAll(".study-opt").forEach(function (o) {
    var L = o.dataset.letter;
    var isCorr = q.answer != null && String(q.answer).indexOf(L) !== -1;
    var sel = o.classList.contains("selected");
    if (sel) o.classList.add(isCorr ? "ok" : "bad");
    else if (isCorr) o.classList.add("right");
    o.classList.add("locked");
  });
  ansEl.style.display = "block";
  // 文字判定横幅（先移除旧横幅，避免反复展开时重复）
  var oldB = ansEl.querySelector(".ans-result"); if (oldB) oldB.remove();
  var isCorrect;
  if (q.type === "multi" || q.type === "multiple") {
    var ansArr = normAnsArr(q.answer).slice().sort().join("");
    isCorrect = selLetters.slice().sort().join("") === ansArr && selLetters.length > 0;
  } else {
    isCorrect = selLetters.length === 1 && String(selLetters[0]).trim() === String(q.answer).trim();
  }
  ansEl.insertBefore(makeResultBanner(isCorrect, q, selLetters), ansEl.firstChild);
  recordRound(isCorrect);
  if (btn) btn.style.display = "none";
 } catch (err) {
    console.error("revealStudyAnswer error (idx=" + idx + "):", err);
    var _ansEl = document.getElementById("ans" + idx);
    if (_ansEl) { _ansEl.style.display = "block"; _ansEl.innerHTML = '<div class="ans-result ans-wrong"> 答案显示异常，请刷新页面重试（错误：' + escapeHtml(String(err && err.message || err)) + '）</div>' + _ansEl.innerHTML; }
 }
}
document.getElementById("questionsList").addEventListener("click", function (e) {
  var header = e.target.closest(".card-header");
  if (header) { header.parentElement.classList.toggle("open"); return; }
  var opt = e.target.closest(".study-opt");
  if (opt) {
    if (opt.classList.contains("locked")) return;
    var card = opt.closest(".card");
    var idx = parseInt(opt.dataset.idx, 10);
    var q = studyQuestionByIdx(idx);
    if (!q) return;
    console.log("[选项点击] idx=", idx, "type=", q.type, "letter=", opt.dataset.letter);
    if (q.type === "multi" || q.type === "multiple") {
      // 多选：先多选，点「提交答案」再判
      opt.classList.toggle("selected");
    } else {
      // 单选/判断：点选项选中（取消其他），点「提交答案」再判
      card.querySelectorAll(".study-opt").forEach(function (o) { o.classList.remove("selected"); });
      opt.classList.add("selected");
    }
    return;
  }
  var btn = e.target.closest(".study-check-btn");
  if (btn) { console.log("[事件委托-提交] btn idx=", btn.dataset.idx); revealStudyAnswer(parseInt(btn.dataset.idx, 10)); }
});
document.getElementById("filterRows").addEventListener("click", function (e) {
  var btn = e.target.closest(".btn");
  if (!btn) return;
  var dim = btn.dataset.dim, val = btn.dataset.value;
  filterState[dim] = val;
  this.querySelectorAll('.btn[data-dim="' + dim + '"]').forEach(function (b) { b.classList.remove("active"); });
  btn.classList.add("active");
  render();
});
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("loadMoreBtn").addEventListener("click", appendBatch);

// 顶部宣传 banner
(function () {
  var banner = document.getElementById("promoBanner");
  var KEY = "sso_promo_closed";
  try { if (localStorage.getItem(KEY) === "1") banner.style.display = "none"; } catch (e) {}
  document.getElementById("promoClose").addEventListener("click", function () {
    banner.style.display = "none";
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
  });
  var xb = document.getElementById("promoXianyu");
  if (xb) xb.addEventListener("click", function () {
    var t = CONFIG.xianyuCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        xb.textContent = " 已复制：" + t;
        setTimeout(function () { xb.textContent = " 复制作者ID：" + t; }, 2000);
      });
    } else { xb.textContent = "作者ID：" + t; }
  });
})();

// 全真考场倒计时
var testTimer = null, timerLimit = CONFIG.timerSeconds, timerRemaining = CONFIG.timerSeconds;
var userTimerSeconds = CONFIG.timerSeconds;            // 录音/演练时长（可调整为 3/4/5 分钟）
var RECORD_DURATION_KEY = "rcj_record_duration_min";
function startTimerCountdown() {
  clearInterval(testTimer);
  timerLimit = userTimerSeconds;
  timerRemaining = timerLimit;
  var fillEl = document.getElementById("timerBarFill");
  var textEl = document.getElementById("timerDigits");
  fillEl.classList.remove("warning"); fillEl.style.width = "100%";
  testTimer = setInterval(function () {
    timerRemaining--;
    var m = Math.floor(timerRemaining / 60), s = timerRemaining % 60;
    textEl.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    fillEl.style.width = (timerRemaining / timerLimit) * 100 + "%";
    if (timerRemaining <= 30) fillEl.classList.add("warning");
    if (timerRemaining <= 0) {
      clearInterval(testTimer);
      textEl.textContent = "00:00 · 已超时";
      fillEl.style.width = "0%";
      // 时间到不强制停止录音：用户仍可在规定时间后继续作答、录音，点「停止」才结束
      if (isRecording) {
        rcjToast(" 规定时间已到，仍可继续录音，结束后点「停止」或「下载录音(MP3)」");
      } else {
        rcjToast(" 时间到！如需练习可重置计时器");
      }
    }
  }, 1000);
}
function stopTimerCountdown() { clearInterval(testTimer); }

// 录音（仅面试模式）—— MP3 编码（Web Audio 抓 PCM + lamejs 转码）
var recordBtn = document.getElementById("recordCtrlBtn");
var downloadRecordBtn = document.getElementById("downloadRecordBtn");
var audioPlayer = document.getElementById("localAudioPlayer");
var lastAudioBlob = null, lastAudioUrl = null;
var isRecording = false;
var audioCtx = null, micStream = null, scriptNode = null, gainNode = null, mp3Encoder = null, mp3Chunks = [];
var transcriptBox = document.getElementById("transcriptBox");
var transcriptContent = document.getElementById("transcriptContent");
var transcriptNote = document.getElementById("transcriptNote");
// ── 紧凑录音条 DOM ──
var recBar = document.getElementById("recBar");       // 录音条容器（切换 .recording 状态）
var recTimer = document.getElementById("recTimer");     // 计时器
var recElapsed = 0, recTick = null;                   // 计时状态
// ── 声音日志（IndexedDB 持久化，跨会话保存全部练习录音）──
var VOICE_DB = "rcj_voice_log", VOICE_DB_VER = 1;
var currentStation = (location.pathname.split("/")[1] || "aux").toLowerCase();
var SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition || null;
var speechRecognizer = null, finalTranscript = "";

function floatTo16(input) {
  var out = new Int16Array(input.length);
  for (var k = 0; k < input.length; k++) {
    var s = Math.max(-1, Math.min(1, input[k]));
    out[k] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

function initSpeechRecognizer() {
  if (!SpeechRecognitionImpl) {
    if (transcriptNote) { transcriptNote.textContent = "当前浏览器不支持语音转文字（常见于 iOS Safari / 微信内置浏览器），仅保留录音回听功能"; transcriptNote.style.display = "block"; }
    return null;
  }
  var rec = new SpeechRecognitionImpl();
  rec.lang = "zh-CN"; rec.continuous = true; rec.interimResults = true;
  rec.onresult = function (e) {
    var interim = "";
    for (var x = e.resultIndex; x < e.results.length; x++) {
      var text = e.results[x][0].transcript;
      if (e.results[x].isFinal) finalTranscript += text; else interim += text;
    }
    if (transcriptContent) transcriptContent.innerHTML = escapeHtml(finalTranscript) + '<span class="transcript-interim">' + escapeHtml(interim) + "</span>";
  };
  var _recGiveUp = false;
  rec.onerror = function (e) {
    // 遇到权限/网络等硬错误时放弃自动重启，避免反复弹麦克风权限框（尤其 file:// 本地双击场景）
    if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "network" || e.error === "aborted") {
      _recGiveUp = true;
    }
    var msg = "";
    if (e.error === "network") msg = " 网络无法连接语音识别服务（国内网络常见，需科学上网），文字转写暂不可用，但录音回听不受影响";
    else if (e.error === "not-allowed" || e.error === "service-not-allowed") msg = " 麦克风/语音识别权限被拒绝，请检查浏览器权限设置";
    else if (e.error === "no-speech") msg = "";
    else msg = " 语音转文字暂时出错（" + e.error + "），不影响录音回听";
    if (msg && transcriptNote) { transcriptNote.textContent = msg; transcriptNote.style.display = "block"; }
  };
  // 仅在“仍在录音且未遇硬错误”时温和重启；遇错直接放弃，杜绝死循环反复弹权限
  rec.onend = function () { if (isRecording && !_recGiveUp) { try { rec.start(); } catch (e2) {} } };
  return rec;
}

function rcjToast(msg) {
  var t = document.getElementById("rcjToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "rcjToast";
    t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(17,24,39,.92);color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:99999;max-width:90vw;line-height:1.6;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.3);";
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(t._t); t._t = setTimeout(function () { t.style.display = "none"; }, 3600);
}

function rcjTogglePrep(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var collapsed = el.classList.toggle("collapsed");
  var btn = el.querySelector(".prep-toggle");
  if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}
window.__togglePrep = rcjTogglePrep;

function rcjCollapsePrepBlocks() {
  ["warmupZone", "breatheZone"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.add("collapsed");
      var b = el.querySelector(".prep-toggle");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  });
}

function initAudioRecorderSystem() {
  // 加载声音日志（首页 + 弹窗两处）
  renderVoiceLog();
  // 非面试模式不展示首页练习录音卡片（该模式不产生录音）
  if (MODE !== "interview") {
    var _plc = document.getElementById("practiceLogCard");
    if (_plc) _plc.style.display = "none";
  }
  // 练习录音卡片点击折叠
  var _plh = document.getElementById("practiceLogHead");
  if (_plh) _plh.addEventListener("click", togglePracticeLog);
  function rcjShowRecBlocked(reason) {
    var box = document.getElementById("recBlockedTip");
    if (!box) { alert(reason || "无法调用麦克风"); return; }
    var isFile = (location.protocol.indexOf("file:") === 0);
    var h = "<strong> " + (reason || "无法调用麦克风") + "</strong><br>";
    if (isFile) {
      h += "你是「双击本地文件」方式打开的，Chrome 出于安全策略会拦截本地 HTML 的麦克风权限。<br><br>";
      h += " <b>最省事</b>：用手机自带浏览器（如小米浏览器）打开本文件，可直接录音；<br>";
      h += " <b>电脑 Chrome</b>：在文件所在目录执行 <code>python -m http.server 8000</code>，再访问 <code>http://localhost:8000/你的文件名.html</code>（localhost 视为安全来源，可正常录音）。";
    } else {
      h += "请检查浏览器麦克风权限设置，或改用 HTTPS / localhost 打开本页面。";
    }
    box.innerHTML = h;
    box.style.display = "block";
  }
  recordBtn.onclick = function () {
    if (!window.lamejs || !window.lamejs.Mp3Encoder) {
      alert("MP3 编码器未就绪，请刷新页面后重试。");
      return;
    }
    if (!isRecording) {
      // 开始新录音：隐藏上次的"已保存"提示
      var _sh0 = document.getElementById("voiceLogSavedHint");
      if (_sh0) _sh0.style.display = "none";
      var _bt = document.getElementById("recBlockedTip");
      if (_bt) _bt.style.display = "none";
      var _hasGum = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!_hasGum) { rcjShowRecBlocked("当前浏览器或打开方式不支持直接调用麦克风。"); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      if (audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e0) {} }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var _bt2 = document.getElementById("recBlockedTip"); if (_bt2) _bt2.style.display = "none";
        micStream = stream;
        var sr = audioCtx.sampleRate;
        mp3Encoder = new window.lamejs.Mp3Encoder(1, sr, 128);
        mp3Chunks = [];
        var source = audioCtx.createMediaStreamSource(stream);
        scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = function (e) {
          if (!isRecording) return;
          var samples = e.inputBuffer.getChannelData(0);
          var buf = mp3Encoder.encodeBuffer(floatTo16(samples));
          if (buf.length > 0) mp3Chunks.push(new Int8Array(buf));
        };
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        source.connect(scriptNode);
        scriptNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        isRecording = true;
        rcjCollapsePrepBlocks();
        // ── 紧凑录音条状态：录音中 ──
        recordBtn.textContent = " 停止录音";
        recordBtn.className = "rec-btn recording";
        if (recBar) recBar.classList.add("recording");
        // 录音计时器
        recElapsed = 0;
        if (recTick) clearInterval(recTick);
        recTick = setInterval(function () {
          recElapsed++;
          var m = Math.floor(recElapsed / 60), s = recElapsed % 60;
          if (recTimer) recTimer.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        }, 1000);
        finalTranscript = ""; if (transcriptContent) transcriptContent.innerHTML = ""; if (transcriptBox) transcriptBox.classList.add("show");
        // 根据设置决定用浏览器内置转写还是云端 ASR
        var _asrPref = { engine: "webspeech" };
        try { var _tmp = JSON.parse(localStorage.getItem("rcj_web_asr_v1") || "{}"); if (_tmp.asrEngine) _asrPref.engine = _tmp.asrEngine; } catch (_e) {}
        if (_asrPref.engine === "cloud") {
          if (transcriptNote) { transcriptNote.style.display = "block"; transcriptNote.textContent = " 录音中…停止后将调用云端 API 转写（请确保已配置 Key）"; }
        } else if (location.protocol === "file:") {
          // 本地双击打开（file://）时 Chrome 不持久化麦克风授权，且语音识别需联网，
          // 为避免反复弹权限框、保证录音/MP3 正常，这里跳过实时语音转写（仅关本机文件模式的转写，不影响录音）
          if (transcriptNote) { transcriptNote.style.display = "block"; transcriptNote.textContent = " 本地文件双击打开时实时转写已停用（用 localhost/https 或手机浏览器打开可启用），录音与 MP3 保存不受影响。"; }
        } else {
          if (transcriptNote) transcriptNote.style.display = "none";
          if (transcriptBox) { speechRecognizer = initSpeechRecognizer(); if (speechRecognizer) { try { speechRecognizer.start(); } catch (e1) {} } }
        }
      }).catch(function (err) {
        rcjShowRecBlocked("麦克风调用失败（" + (err && err.name ? err.name : "权限或安全策略") + "）。");
      });
    } else {
      stopAndEncodeRecording();
    }
  };
  downloadRecordBtn.onclick = function () {
    if (!lastAudioBlob) { rcjToast("还没有可下载的录音，请先点「开始录音演练」，录完再下载"); return; }
    var now = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    var ts = now.getFullYear() + p(now.getMonth() + 1) + p(now.getDate()) + "_" + p(now.getHours()) + p(now.getMinutes()) + p(now.getSeconds());
    var url = lastAudioUrl || URL.createObjectURL(lastAudioBlob);
    var ua = navigator.userAgent || "";
    var isIos = /iP(ad|hone|od)/.test(ua);
    var isWechat = /micromessenger/i.test(ua);
    if (isWechat) {
      // 微信内置浏览器禁止 blob 文件下载，引导用系统浏览器打开
      rcjToast("微信内无法直接下载文件，请点右上角 ⋯ 「在浏览器打开」，再点下载录音");
      try { window.open(url, "_blank"); } catch (e) {}
      return;
    }
    if (isIos) {
      // iOS Safari 忽略 download 属性且不支持程序化下载，改在新标签页打开让用户保存
      try {
        window.open(url, "_blank");
        rcjToast("已在新标签页打开录音，请长按音频或点分享 「存储到文件」");
      } catch (e) { rcjToast("当前环境下载受限，请在系统浏览器中打开本页后重试"); }
      return;
    }
    // 桌面 / 安卓 Chrome 等：标准下载
    var a = document.createElement("a");
    a.href = url;
    a.download = "深圳辅警面试录音_" + ts + ".mp3";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); } catch (e3) {} }, 1000);
    rcjToast("已开始下载录音（MP3）…");
  };
}

function stopAndEncodeRecording() {
  isRecording = false;
  // 隐藏旧波形容器（元素已移除时安全跳过，避免空引用报错）
  var _lw = document.getElementById('liveWaveWrap'); if (_lw) _lw.style.display = 'none';
  var _pw = document.getElementById('playbackWaveWrap'); if (_pw) _pw.style.display = 'none';
  if (scriptNode) { try { scriptNode.disconnect(); } catch (e4) {} scriptNode = null; }
  if (gainNode) { try { gainNode.disconnect(); } catch (e5) {} gainNode = null; }
  if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
  if (audioCtx) { try { audioCtx.close(); } catch (e6) {} audioCtx = null; }
  if (mp3Encoder) {
    var tail = mp3Encoder.flush();
    if (tail.length > 0) mp3Chunks.push(new Int8Array(tail));
    mp3Encoder = null;
  }
  var blob = new Blob(mp3Chunks, { type: "audio/mpeg" });
  mp3Chunks = [];
  if (lastAudioUrl) { try { URL.revokeObjectURL(lastAudioUrl); } catch (e7) {} }
  lastAudioBlob = blob;
  lastAudioUrl = URL.createObjectURL(blob);
  audioPlayer.src = lastAudioUrl;
  audioPlayer.style.display = "block";
  downloadRecordBtn.style.display = "inline-block";
  // ── 紧凑录音条状态：录音结束 ──
  recordBtn.textContent = " 开始录音";
  if (recBar) recBar.classList.remove("recording");
  if (recTick) { clearInterval(recTick); recTick = null; }
  if (speechRecognizer) { try { speechRecognizer.onend = null; speechRecognizer.stop(); } catch (e8) {} }
  // 保存到「声音日志」（IndexedDB），便于回看全部练习（首页「我的练习录音」卡片为唯一存档）
  try { saveVoiceLog(blob, recElapsed); } catch (_save) {}
  // 弹窗内提示：本次录音已存档（统一引导语，同步首屏与设置两个入口）
  var _sh = document.getElementById("voiceLogSavedHint");
  if (_sh) {
    var _where = "首屏「 我的练习录音」和设置里的「 我的练习录音」";
    _sh.textContent = (window.RCJVoice && window.RCJVoice.GUIDE)
      ? window.RCJVoice.GUIDE.afterRecord(_where)
      : (" 已保存到" + _where + "，随时回放全部练习");
    _sh.style.display = "block";
  }
  // 若使用云端 ASR，把 MP3 发过去转写
  try { if (window.__rcjRunCloudAsr && lastAudioBlob) window.__rcjRunCloudAsr(lastAudioBlob); } catch (_asr) {}
  // 录音结束后显示 AI 引导提示（锦上添花，不阻断流程）
  try { showAiHint(); } catch (_hint) {}
}

function resetAudioRecorderUI() {
  isRecording = false;
  if (scriptNode) { try { scriptNode.disconnect(); } catch (e9) {} scriptNode = null; }
  if (gainNode) { try { gainNode.disconnect(); } catch (e10) {} gainNode = null; }
  if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
  if (audioCtx) { try { audioCtx.close(); } catch (e11) {} audioCtx = null; }
  if (speechRecognizer) { try { speechRecognizer.onend = null; speechRecognizer.stop(); } catch (e12) {} }
  // ── 紧凑录音条状态：完全重置 ──
  recordBtn.textContent = " 开始录音";
  if (recBar) recBar.classList.remove("recording");
  if (recTick) { clearInterval(recTick); recTick = null; }
  recElapsed = 0;
  if (recTimer) recTimer.textContent = "00:00";
  if (lastAudioUrl) { try { URL.revokeObjectURL(lastAudioUrl); } catch (e13) {} lastAudioUrl = null; }
  lastAudioBlob = null;
  audioPlayer.src = ""; audioPlayer.style.display = "none";
  downloadRecordBtn.style.display = "none";
  var _lw2 = document.getElementById('liveWaveWrap'); if (_lw2) _lw2.style.display = 'none';
  var _pw2 = document.getElementById('playbackWaveWrap'); if (_pw2) _pw2.style.display = 'none';
  if (transcriptBox) transcriptBox.classList.remove("show"); if (transcriptContent) transcriptContent.innerHTML = ""; finalTranscript = "";
}

// ───────────────────────── 声音日志（IndexedDB 持久化）─────────────────────────
// 历次练习录音跨会话保存，首页与弹窗均可回放 / 删除
function _openVoiceDB() {
  return new Promise(function (res, rej) {
    if (!window.indexedDB) { rej(new Error("no-idb")); return; }
    var r = indexedDB.open(VOICE_DB, VOICE_DB_VER);
    r.onupgradeneeded = function () {
      var db = r.result;
      if (!db.objectStoreNames.contains("rec")) db.createObjectStore("rec", { keyPath: "id" });
    };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function _vlAdd(rec) {
  return _openVoiceDB().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction("rec", "readwrite");
      tx.objectStore("rec").put(rec);
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function _vlList() {
  return _openVoiceDB().then(function (db) {
    return new Promise(function (res, rej) {
      var out = [];
      var tx = db.transaction("rec", "readonly");
      var cur = tx.objectStore("rec").openCursor();
      cur.onsuccess = function (e) {
        var c = e.target.result;
        if (c) { if (!c.value.station || c.value.station === currentStation) out.push(c.value); c.continue(); }
        else { out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); res(out); }
      };
      cur.onerror = function () { rej(cur.error); };
    });
  }).catch(function () { return []; });
}
function _vlDelete(id) {
  return _openVoiceDB().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction("rec", "readwrite");
      tx.objectStore("rec").delete(id);
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
// 更新录音备注（参照结构化练习日志的备注，blur 时保存）
function _vlUpdateNote(id, note) {
  return _openVoiceDB().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction("rec", "readwrite");
      var os = tx.objectStore("rec");
      var rq = os.get(id);
      rq.onsuccess = function () {
        var rec = rq.result;
        if (rec) { rec.note = note; os.put(rec); }
      };
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
// ── 免费本地备份：把录音下载到用户自己的设备（不依赖任何服务器）──
function _vlFileName(it) {
  var d = new Date(it.ts || Date.now());
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  var base = "辅警练习_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  var q = (it.question || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 14);
  return base + (q ? "_" + q : "");
}
function _vlDownload(blob, name) {
  if (!blob || !blob.size) return;
  // 录音一律由 lamejs 实时编码为 MP3（audio/mpeg），这里强制 .mp3 扩展名，
  // 避免任何环境把 blob 误存成 webm/ogg 等本地播放器打不开的格式。
  var url = URL.createObjectURL(blob);
  var ua = navigator.userAgent || "";
  var isIos = /iP(ad|hone|od)/.test(ua);
  var isWechat = /micromessenger/i.test(ua);
  if (isWechat) {
    // 微信内置浏览器禁止 blob 文件下载，引导用系统浏览器打开
    rcjToast("微信内无法直接下载文件，请点右上角 ⋯ 「在浏览器打开」，再点下载录音");
    try { window.open(url, "_blank"); } catch (e) {}
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 8000);
    return;
  }
  if (isIos) {
    // iOS Safari 忽略 download 属性且不支持程序化下载，改在新标签页打开让用户保存
    try {
      window.open(url, "_blank");
      rcjToast("已在新标签页打开录音，请长按音频或点分享 「存储到文件」");
    } catch (e) { rcjToast("当前环境下载受限，请在系统浏览器中打开本页后重试"); }
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 8000);
    return;
  }
  // 桌面 / 安卓 Chrome 等：标准下载，强制 .mp3 让本地播放器可直接打开
  var a = document.createElement("a");
  a.href = url; a.download = name + ".mp3";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
}
function _vlExportAll() {
  _vlList().then(function (items) {
    if (!items || !items.length) return;
    var capped = items.length > 30 ? items.slice(0, 30) : items;
    var i = 0;
    (function next() {
      if (i >= capped.length) return;
      var it = capped[i++];
      if (it && it.blob && it.blob.size) _vlDownload(it.blob, _vlFileName(it));
      setTimeout(next, 400);
    })();
  });
}
function saveVoiceLog(blob, durationSec) {
  if (!blob) return;
  var qText = "", catLabel = "";
  var q = currentRandomQ;
  if (q) {
    // 优先从题目对象取纯题面（面试 title / 笔试 stem），比抓 DOM innerText 更干净（不含选项/答案）
    qText = (q.title || q.stem || "").toString().trim();
    var parts = [];
    if (q.session) parts.push(q.session);
    if (q.batch && q.batch !== q.session) parts.push(q.batch);
    if (q.year) parts.push(String(q.year));
    var tl = (MODE === "interview")
      ? (TYPE_MAP[q.type] && TYPE_MAP[q.type].label)
      : (WRITTEN_TYPE_LABEL[q.type] || q.type);
    if (tl) parts.push(tl);
    catLabel = parts.filter(Boolean).join(" · ");
  }
  if (!qText) {
    // 兜底：从弹窗 DOM 取，截断避免混入选项/答案
    var qEl = document.getElementById("randomModalQuestion");
    qText = qEl ? (qEl.innerText || qEl.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120) : "";
  }
  var rec = {
    id: "v" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    ts: Date.now(),
    duration: durationSec || 0,
    station: currentStation,
    question: qText.slice(0, 200),
    catLabel: catLabel,
    note: "",
    blob: blob
  };
  _vlAdd(rec).then(function () { renderVoiceLog(); }).catch(function () {});
}
// 记录已创建的 blob object URL，重渲染前统一回收，避免内存泄漏
var _vlUrls = [];
function _vlRevokeUrls() {
  _vlUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
  _vlUrls = [];
}
function renderVoiceLog() {
  _vlRevokeUrls();
  _vlList().then(function (items) {
    // 设置面板里的「我的练习录音」复用同一渲染（统一模块，不重复造轮子）
    renderVoiceLogInto(document.getElementById("voiceLogSettingsList"), items);
    // 练习记录全屏弹窗
    renderVoiceLogInto(document.getElementById("voiceLogModalList"), items);
    var scnt = document.getElementById("practiceLogSettingsCount");
    if (scnt) scnt.textContent = items.length ? ("· " + items.length + " 条") : "";
    var ecnt = document.getElementById("voiceLogEntryCount");
    if (ecnt) ecnt.textContent = items.length ? items.length : "";
    var ex = document.getElementById("voiceLogExportAll");
    if (ex) { ex.style.display = items.length ? "" : "none"; ex.onclick = _vlExportAll; }
  }).catch(function () {
    renderVoiceLogInto(document.getElementById("voiceLogSettingsList"), []);
    renderVoiceLogInto(document.getElementById("voiceLogModalList"), []);
    var ex = document.getElementById("voiceLogExportAll");
    if (ex) ex.style.display = "none";
  });
}
function renderVoiceLogInto(listEl, items) {
  // 统一走 rcj-voice.js（structured 为事实标准），避免各站重复造轮子
  if (window.RCJVoice && window.RCJVoice.renderVoiceLogInto) {
    window.RCJVoice.renderVoiceLogInto(listEl, items, {
      stationLabel: currentStation === "fj" ? "辅警练习" : (currentStation || "练习"),
      onDelete: function (id) { _vlDelete(id).then(function () { renderVoiceLog(); }).catch(function () {}); },
      onDownload: function (blob, id) { _vlDownload(blob, _vlFileName({ id: id })); },
      onUpdateNote: function (id, note) { _vlUpdateNote(id, note).catch(function () {}); }
    });
    return;
  }
  // 兜底（rcj-voice.js 未加载时）
  if (!listEl) return;
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  if (!items || !items.length) {
    var empty = document.createElement("div");
    empty.className = "voice-log-empty";
    empty.textContent = "暂无录音，点「 随机抽题」开口练一练吧";
    listEl.appendChild(empty);
    return;
  }
  items.forEach(function (it) {
    var item = document.createElement("div");
    item.className = "voice-log-item";
    var d = new Date(it.ts || Date.now());
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var tStr = (d.getMonth() + 1) + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    var dur = it.duration || 0;
    var dStr = pad(Math.floor(dur / 60)) + ":" + pad(dur % 60);

    var t = document.createElement("span"); t.className = "voice-log-time"; t.textContent = tStr;
    var du = document.createElement("span"); du.className = "voice-log-dur"; du.textContent = dStr;
    var cat = document.createElement("span"); cat.className = "voice-log-cat";
    cat.textContent = (it.catLabel && it.catLabel.length) ? it.catLabel : (currentStation === "fj" ? "辅警练习" : (currentStation || "练习"));
    var meta = document.createElement("div"); meta.className = "voice-log-meta";
    meta.appendChild(t); meta.appendChild(du); meta.appendChild(cat);
    // 题目：完整显示（最多 2 行），参照结构化练习日志的 sess-q 风格，不再硬截断 16 字
    var q = document.createElement("div"); q.className = "voice-log-q";
    q.textContent = it.question ? it.question : "练习录音";
    q.title = it.question || "";
    // 原生 audio 控件：跨浏览器（尤其 iOS/Safari/微信）最可靠的 blob 回放方式
    var audio = document.createElement("audio");
    audio.className = "voice-log-audio";
    audio.controls = true;
    audio.preload = "none";
    if (it.blob && it.blob.size) {
      try {
        var url = URL.createObjectURL(it.blob);
        _vlUrls.push(url);
        audio.src = url;
      } catch (e) { audio.controls = false; }
    } else {
      audio.controls = false;
    }
    var del = document.createElement("button"); del.type = "button"; del.className = "voice-log-del"; del.textContent = ""; del.title = "删除这条录音";
    del.onclick = function () { _vlDelete(it.id).then(function () { renderVoiceLog(); }).catch(function () {}); };
    var dl = document.createElement("button"); dl.type = "button"; dl.className = "voice-log-dl"; dl.textContent = ""; dl.title = "下载到本机（免费，存到你自己的设备）";
    dl.onclick = function () { _vlDownload(it.blob, _vlFileName(it)); };
    item.appendChild(meta);
    item.appendChild(q);
    item.appendChild(audio);
    item.appendChild(dl); item.appendChild(del);
    // 备注：参照结构化练习日志，blur 即存（写卡壳点 / 改进方向）
    var note = document.createElement("textarea");
    note.className = "voice-log-remark";
    note.placeholder = "写点备注，比如卡壳的地方、改进方向…";
    note.value = it.note || "";
    note.addEventListener("blur", function () {
      _vlUpdateNote(it.id, note.value.replace(/\s+$/, "")).catch(function () {});
    });
    item.appendChild(note);
    listEl.appendChild(item);
  });
}
function togglePracticeLog() {
  var card = document.getElementById("practiceLogCard");
  if (card) card.classList.toggle("collapsed");
}


// 随机抽题
var randomModal = document.getElementById("randomModal");
var currentRandomQ = null;

function randomBadgesHtml(q) {
  var html = "";
  if (MODE === "interview") {
    var ti = TYPE_MAP[q.type] || { cls: "zhfx", label: q.type };
    html += '<span class="badge badge-type-' + ti.cls + '"> ' + escapeHtml(ti.label) + "</span>";
    if (q.year) html += '<span class="badge badge-year">' + escapeHtml(q.year) + "</span>";
    if (q.session) html += '<span class="badge badge-session">' + escapeHtml(q.session) + "</span>";
    html += tagBadgesHtml(q);
  } else {
    if (q.num != null) html += '<span class="badge badge-year">#' + q.num + "</span>";
    if (q.batch) html += '<span class="badge badge-session">' + escapeHtml(q.batch) + "</span>";
    var wl = WRITTEN_TYPE_LABEL[q.type] || q.type;
    html += '<span class="badge badge-type-zhfx"> ' + escapeHtml(wl) + "</span>";
    html += tagBadgesHtml(q);
  }
  return html;
}
function randomQuestionHtml(q) {
  if (MODE === "interview") {
    var h = escapeHtml(q.title || "");
    h += '<div class="random-modal-hint" style="margin-top:12px;margin-bottom:0;font-size:13px;padding:10px 12px;"> 先自己组织作答，点下方「显示答案」查看参考答案与结构化思路</div>';
    return h;
  }
  var h = escapeHtml(q.stem || "");
  if (q.options && q.options.length) {
    h += '<div style="margin-top:12px">';
    q.options.forEach(function (o) {
      h += '<div class="opt-row rand-opt" data-rand-letter="' + escapeHtml(o.letter) + '"><span class="opt-letter">' + escapeHtml(o.letter) + ".</span><span>" + escapeHtml(o.text) + "</span></div>";
    });
    h += "</div>";
  }
  if (MODE !== "interview") {
    h += '<div class="random-modal-hint" style="margin-top:12px;margin-bottom:0;font-size:13px;padding:10px 12px;"> 选择答案后，点击下方「提交答案」查看对错</div>';
  }
  return h;
}
function randomAnswerHtml(q) {
  if (MODE === "interview") return frameworkHtml(q) + abilityLogicHtml(q) + formatAnswer(q.answer || "（暂无参考答案）", "");
  var h = "<div>答案：<b>" + escapeHtml(displayAnswer(q)) + "</b></div>";
  if (q.explanation) h += '<div style="margin-top:10px">解析：' + formatAnswer(q.explanation, "") + "</div>";
  return h;
}
// 随机抽题范围：优先按当前选中的题型/年份/标签等筛选抽题；筛选为空时回退全库
function randomPool() {
  var pool = computeFiltered();
  return pool.length ? pool : dataset();
}
// 当前抽题范围的文字说明（供弹窗顶部显示）
function randomScopeLabel(count) {
  var parts = [];
  activeDimensions().forEach(function (d) {
    var val = filterState[d.key];
    if (val && val !== "all") parts.push(dimLabel(d.key, val));
  });
  if (currentSearch) parts.push("搜索“" + currentSearch + "”");
  var scope = parts.length ? parts.join(" · ") : "全部题目";
  return " 本次抽题范围：" + scope + "（共 " + count + " 题）";
}
function showRandomQuestion() {
  resetAudioRecorderUI();
  startTimerCountdown();
  var rb = document.getElementById("randomResultBanner"); if (rb) rb.remove();
  var data = randomPool();
  if (!data.length) return;
  var q;
  if (data.length === 1) { q = data[0]; }
  else {
    // 多题时避免连续抽到同一题
    do { q = data[Math.floor(Math.random() * data.length)]; } while (currentRandomQ && q === currentRandomQ);
  }
  currentRandomQ = q;
  var scopeEl = document.getElementById("randomModalScope");
  if (scopeEl) scopeEl.textContent = randomScopeLabel(data.length);
  var submitBtn = document.getElementById("randomModalSubmit");
  if (MODE === "interview") {
    // 面试：默认隐藏答案，点「显示答案」才展开
    if (submitBtn) { submitBtn.style.display = ""; submitBtn.textContent = " 显示答案"; }
    document.getElementById("randomModalAnswer").classList.remove("show");
  } else {
    if (submitBtn) { submitBtn.style.display = ""; submitBtn.textContent = " 提交答案"; }
    document.getElementById("randomModalAnswer").classList.remove("show");
  }
  document.getElementById("audioRecorderZone").style.display = (MODE === "interview" && _mRecord) ? "block" : "none";
  document.getElementById("randomModalBadges").innerHTML = randomBadgesHtml(q);
  document.getElementById("randomModalQuestion").innerHTML = randomQuestionHtml(q);
  document.getElementById("randomModalAnswerContent").innerHTML = randomAnswerHtml(q);
  randomModal.classList.add("show");
}
document.getElementById("randomBtn").addEventListener("click", showRandomQuestion);
function revealRandomAnswer() {
  var q = currentRandomQ;
  if (!q || q.answer == null) return;
  document.querySelectorAll("#randomModalQuestion .opt-row.rand-opt").forEach(function (o) {
    var letter = o.dataset.randLetter;
    var isCorrect = String(q.answer).indexOf(letter) !== -1 || String(q.answer).indexOf(o.children[1].textContent) !== -1;
    if (isCorrect) o.classList.add("right");
  });
  document.getElementById("randomModalAnswer").classList.add("show");
  stopTimerCountdown();
}
function revealInterviewAnswer() {
  var q = currentRandomQ;
  if (!q) return;
  document.getElementById("randomModalAnswer").classList.add("show");
  stopTimerCountdown();
  var btn = document.getElementById("randomModalSubmit");
  if (btn) btn.style.display = "none";
}
function gradeRandomSelection() {
  if (MODE === "interview") { revealInterviewAnswer(); return; }
  var q = currentRandomQ;
  if (!q || q.answer == null) return;
  var opts = document.querySelectorAll("#randomModalQuestion .opt-row.rand-opt");
  var selLetters = [];
  opts.forEach(function (o) {
    if (o.classList.contains("selected")) selLetters.push(o.dataset.randLetter);
  });
  if (selLetters.length === 0) {
    var btn = document.getElementById("randomModalSubmit");
    if (btn) { var orig = btn.textContent; btn.textContent = " 请先选择答案"; setTimeout(function () { btn.textContent = orig; }, 1200); }
    return;
  }
  opts.forEach(function (o) {
    o.classList.add("locked");
    var letter = o.dataset.randLetter;
    var isCorr = String(q.answer).indexOf(letter) !== -1 || String(q.answer).indexOf(o.children[1].textContent) !== -1;
    var sel = o.classList.contains("selected");
    if (sel) o.classList.add(isCorr ? "ok" : "bad");
    else if (isCorr) o.classList.add("right");
  });
  var ansArr = normAnsArr(q.answer).slice().sort().join("");
  var isCorrect = selLetters.slice().sort().join("") === ansArr;
  revealRandomAnswer();
  var ac = document.getElementById("randomModalAnswerContent");
  var rb = document.getElementById("randomResultBanner"); if (rb) rb.remove();
  var banner = makeResultBanner(isCorrect, q, selLetters); banner.id = "randomResultBanner";
  ac.insertBefore(banner, ac.firstChild);
  var submitBtn = document.getElementById("randomModalSubmit");
  if (submitBtn) submitBtn.style.display = "none";
}
document.getElementById("randomModalQuestion").addEventListener("click", function (e) {
  var opt = e.target.closest(".opt-row.rand-opt");
  if (!opt || opt.classList.contains("locked")) return;
  var q = currentRandomQ;
  if (!q) return;
  if (q.type === "multi" || q.type === "multiple") {
    opt.classList.toggle("selected");
  } else {
    // 单选/判断：选中该项（取消其他），点「提交答案」再判
    document.querySelectorAll("#randomModalQuestion .opt-row.rand-opt").forEach(function (o) { o.classList.remove("selected"); });
    opt.classList.add("selected");
  }
});
document.getElementById("randomModalSubmit").addEventListener("click", gradeRandomSelection);
document.getElementById("randomModalNext").addEventListener("click", showRandomQuestion);
function closeRandomModal() { randomModal.classList.remove("show"); stopTimerCountdown(); resetAudioRecorderUI(); }
document.getElementById("randomModalClose").addEventListener("click", closeRandomModal);
document.getElementById("randomModalDone").addEventListener("click", closeRandomModal);
document.getElementById("timerResetBtn").addEventListener("click", startTimerCountdown);
// 录音/演练时长可调整（3/4/5 分钟），默认 3 分钟，选择后即时重置并记忆偏好
(function bindTimerDuration() {
  var box = document.getElementById("timerDurationBtns");
  if (!box) return;
  function syncActive(min) {
    [].forEach.call(box.querySelectorAll(".dur-btn"), function (b) {
      b.classList.toggle("active", parseInt(b.getAttribute("data-min"), 10) === min);
    });
  }
  var saved = parseInt(localStorage.getItem(RECORD_DURATION_KEY), 10);
  if (saved === 3 || saved === 4 || saved === 5) {
    userTimerSeconds = saved * 60;
    syncActive(saved);
  }
  box.addEventListener("click", function (e) {
    var btn = e.target.closest(".dur-btn");
    if (!btn) return;
    var min = parseInt(btn.getAttribute("data-min"), 10);
    userTimerSeconds = min * 60;
    try { localStorage.setItem(RECORD_DURATION_KEY, min); } catch (e2) {}
    syncActive(min);
    startTimerCountdown();
  });
})();
randomModal.addEventListener("click", function (e) { if (e.target === randomModal) closeRandomModal(); });

// 闲鱼口令
var XIANYU_CODE = CONFIG.xianyuCode;
function copyToClipboard(text) {
  return new Promise(function (resolve) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { resolve(true); }).catch(function () { resolve(fallbackCopy(text)); });
    } else resolve(fallbackCopy(text));
  });
}
function fallbackCopy(text) {
  try {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.top = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    var ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch (e) { return false; }
}
// 「获取离线版 / RCJ 服务」按钮  跳转 shop.955827.xyz（替代原闲鱼入口，闲鱼弹层已移除）
var dlBtn = document.getElementById("downloadOfflineBtn");
if (dlBtn) dlBtn.addEventListener("click", function () { window.open("https://shop.955827.xyz/", "_blank", "noopener"); });

// 打赏弹层逻辑（reward 模块：显示赞赏码图片）
var rewardOverlay = document.getElementById("rewardToastOverlay");
document.getElementById("rewardBtn").addEventListener("click", function () { rewardOverlay.classList.add("show"); });
document.getElementById("rewardCloseBtn").addEventListener("click", function () { rewardOverlay.classList.remove("show"); });
rewardOverlay.addEventListener("click", function (e) { if (e.target === rewardOverlay) rewardOverlay.classList.remove("show"); });

// 回到顶部 / 主题
var backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", function () { if (window.scrollY > 400) backToTop.classList.add("show"); else backToTop.classList.remove("show"); });
backToTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
var themeToggle = document.getElementById("themeToggle");
var savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") { document.documentElement.setAttribute("data-theme", "dark"); themeToggle.textContent = ""; }
themeToggle.addEventListener("click", function () {
  var cur = document.documentElement.getAttribute("data-theme");
  if (cur === "dark") { document.documentElement.removeAttribute("data-theme"); themeToggle.textContent = ""; localStorage.setItem("theme", "light"); }
  else { document.documentElement.setAttribute("data-theme", "dark"); themeToggle.textContent = ""; localStorage.setItem("theme", "dark"); }
});

// 只看未掌握 / 快捷键
(function () {
  var markModeBtn = document.getElementById("markModeBtnTop");
  if (!markModeBtn) return;
  markModeBtn.addEventListener("click", function () {
    filterMark = !filterMark;
    markModeBtn.classList.toggle("active", filterMark);
    markModeBtn.textContent = filterMark ? " 显示全部" : " 只看未掌握";
    render();
  });
  function currentQuestions() {
    var search = document.getElementById("searchInput").value.trim().toLowerCase();
    var statusDB = StorageCtrl.get();
    return dataset().filter(function (q) {
      var ok = true;
      activeDimensions().forEach(function (d) {
        var val = filterState[d.key] || "all";
        if (val === "all") return;
        ok = ok && (d.key === "tag" ? normTags(q).indexOf(val) !== -1 : q[d.key] === val);
      });
      if (!ok) return false;
      if (filterMark && statusDB[q._idx] === "mastered") return false;
      if (search && searchText(q).toLowerCase().indexOf(search) === -1) return false;
      return true;
    });
  }
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if (k === "escape") { if (randomModal.classList.contains("show")) closeRandomModal(); return; }
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (k === "r" || k === "n") { e.preventDefault(); if (randomModal.classList.contains("show")) showRandomQuestion(); else document.getElementById("randomBtn").click(); }
  });
})();

// 撒花（答对/标记掌握时的正向反馈，纯视觉、无音效）
(function () {
  function playConfetti() {
    var emojis = ["", "", "", "", "", "", "", ""];
    for (var i = 0; i < 18; i++) {
      var s = document.createElement("div"); s.className = "fx-confetti";
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDuration = (1.4 + Math.random() * 1.2) + "s";
      s.style.fontSize = (14 + Math.random() * 14) + "px";
      document.body.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 2800); })(s);
    }
  }
  function celebrate() { playConfetti(); }
  var _ct = changeTrack;
  changeTrack = function (e, idx, status) { _ct(e, idx, status); if (status === "mastered") celebrate(); };
})();

// ====== 套题模考模式（抽题  作答  提交判分）======
var examActive = false, examGraded = false, examSelections = {};
var examView = document.getElementById("examView");
var examQuestions = document.getElementById("examQuestions");
var examResult = document.getElementById("examResult");
var examSubmitBtn = document.getElementById("examSubmitBtn");

// ===== 套题模考 · 出卷器 =====
var examPaperList = [], examPaperMeta = null, examLastCfg = null;
var examMinutesSet = 60, examTypingOn = false, examTypingMinutes = 10;
var examTimer = null, examTimerRemaining = 0, examTimerLimit = 0;
function normType(t){ t = String(t||"").toLowerCase(); if(t==="multiple"||t==="multi"||t==="多选题") return "multi"; if(t==="judge"||t==="bool"||t==="判断"||t==="判断题") return "bool"; if(t==="qa"||t==="essay"||t==="case"||t==="subjective"||t==="简答"||t==="简答题"||t==="案例"||t==="案例分析"||t==="主观题") return "subjective"; return "single"; }
function typeLabel(t){ return t==="multi"?"多选":(t==="bool"?"判断":(t==="subjective"?"主观":"单选")); }
function shuffleArr(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var x=a[i];a[i]=a[j];a[j]=x; } return a; }
function scopeKey(){ return (MODE==="interview") ? "year" : "batch"; }
function scopeLabel(v){
  if(v==="__random__") return " 随机抽一套";
  if(v==="__all__") return " 全库随机抽题";
  if(MODE==="interview") return (v?("年份 "+v):"未注明");
  return (v||"未注明")+" 批";
}
function typesText(tc){
  var parts=[];
  ["single","multi","bool"].forEach(function(t){ if(tc[t]) parts.push(typeLabel(t)+" "+tc[t]); });
  return parts.join(" · ");
}
// 按题型精确出题：单/多/判各取指定数量，题库不足时按上限抽并提示
function buildExamPaperByType(counts){
  var data = dataset();
  var byType = { single: [], multi: [], bool: [] };
  data.forEach(function(q){ var t = normType(q.type); if (byType[t]) byType[t].push(q); });
  var chosen = [], per = { single:0, multi:0, bool:0 }, shortage = [];
  ["single","multi","bool"].forEach(function(t){
    var want = counts[t] || 0;
    var pool = byType[t].slice(); shuffleArr(pool);
    var take = Math.min(want, pool.length);
    if (want > 0 && take < want) shortage.push(typeLabel(t) + "仅有 " + pool.length + " 题（少于设定 " + want + "）");
    per[t] = take;
    chosen = chosen.concat(pool.slice(0, take));
  });
  shuffleArr(chosen);
  return { list: chosen, meta: { per: per, shortage: shortage } };
}
// 按出现顺序取出卷批次列表
function getBatchesInOrder(){
  var seen = [], map = {};
  dataset().forEach(function(q){ var b = q.batch || "未注明"; if(!map[b]){ map[b] = true; seen.push(b); } });
  return seen;
}
function countByType(list){
  var per = { single:0, multi:0, bool:0 };
  list.forEach(function(q){ var t = normType(q.type); if (per[t] !== undefined) per[t]++; });
  return per;
}
// 根据出卷配置重新生成试卷（batch=整套真题 / random=按题型随机）
function rebuildPaper(cfg){
  if (cfg.plan === "batch") {
    var list = dataset().filter(function(q){ return normType(q.type) !== "subjective" && (q.batch || "未注明") === cfg.batch; });
    return { list: list, meta: { per: countByType(list), shortage: [] } };
  }
  return buildExamPaperByType(cfg.counts);
}
// 切换出卷方式：显示/隐藏批次选择 or 题型数量
function toggleExamPlan(){
  var plan = document.getElementById("examPlanMode").value;
  document.getElementById("examBatchRow").style.display = (plan === "batch") ? "" : "none";
  document.getElementById("examCountGrid").style.display = (plan === "random") ? "" : "none";
  refreshExamInfo();
}
function populateExamBatches(){
  var sel = document.getElementById("examBatch");
  var batches = getBatchesInOrder();
  sel.innerHTML = batches.map(function(b){
    var n = dataset().filter(function(q){ return (q.batch || "未注明") === b; }).length;
    return '<option value="' + escapeHtml(b) + '">' + escapeHtml(b) + ' 批 · ' + n + '题</option>';
  }).join("");
}
function openExamSetup(){
  examActive = true;
  populateExamSetup();
  populateExamBatches();
  toggleExamPlan();
  document.getElementById("examSetupOverlay").style.display = "flex";
}
function populateExamSetup(){
  applyExamPreset();
}
function applyExamPreset(){
  var p = CONFIG.examPreset || { label:"标准模考", single:36, multi:12, bool:12, minutes:60, typing:true, typingMinutes:10 };
  document.getElementById("cntSingle").value = p.single;
  document.getElementById("cntMulti").value = p.multi;
  document.getElementById("cntBool").value = p.bool;
  document.getElementById("typingOn").checked = !!p.typing;
  document.getElementById("examMinutesTyping").value = p.typingMinutes || 10;
  document.getElementById("examMinutes").value = (p.minutes || 60);
  document.getElementById("examPresetLabel").textContent = p.label || "标准模考";
  refreshExamInfo();
}
function refreshExamInfo(){
  var typing = document.getElementById("typingOn").checked;
  var tmin = parseInt(document.getElementById("examMinutesTyping").value,10)||0;
  var em = parseInt(document.getElementById("examMinutes").value,10)||0;
  var plan = document.getElementById("examPlanMode").value;
  var info = "";
  if (plan === "batch") {
    var b = document.getElementById("examBatch").value;
    var list = dataset().filter(function(q){ return (q.batch || "未注明") === b; });
    var per = countByType(list);
    info = '本卷为 <b>'+escapeHtml(b)+' 批</b> 整套真题，共 <b>'+list.length+'</b> 题（单选 '+per.single+' · 多选 '+per.multi+' · 判断 '+per.bool+'），'+(em>0?('限时 <b>'+em+'</b> 分钟'):'<b>无时间限制</b>');
  } else {
    var s = parseInt(document.getElementById("cntSingle").value,10)||0;
    var m = parseInt(document.getElementById("cntMulti").value,10)||0;
    var bo = parseInt(document.getElementById("cntBool").value,10)||0;
    var total = s+m+bo;
    info = '本卷共 <b>'+total+'</b> 道客观题（单选 '+s+' · 多选 '+m+' · 判断 '+bo+'），'+(em>0?('限时 <b>'+em+'</b> 分钟'):'<b>无时间限制</b>');
    var data = dataset();
    var avail = { single:0, multi:0, bool:0 };
    data.forEach(function(q){ var t=normType(q.type); if(avail[t]!==undefined) avail[t]++; });
    var warn = [];
    if (s > avail.single) warn.push('单选库仅 '+avail.single+' 题');
    if (m > avail.multi) warn.push('多选库仅 '+avail.multi+' 题');
    if (bo > avail.bool) warn.push('判断库仅 '+avail.bool+' 题');
    if (warn.length) info += '<br><span style="color:#dc2626"> '+warn.join('，')+'，将自动按上限抽取</span>';
  }
  if (typing) info += '；另加打字题 <b>'+tmin+'</b> 分钟（不计入客观题分）';
  document.getElementById("examSetupInfo").innerHTML = info;
}
function confirmExamSetup(){
  var plan = document.getElementById("examPlanMode").value;
  var typing = document.getElementById("typingOn").checked;
  var typingMinutes = parseInt(document.getElementById("examMinutesTyping").value,10)||10;
  var cfg;
  if (plan === "batch") {
    var b = document.getElementById("examBatch").value;
    if (!b) { alert("请选择要刷的批次"); return; }
    cfg = { plan: "batch", batch: b, typing: typing, typingMinutes: typingMinutes, examMinutes: parseInt(document.getElementById("examMinutes").value,10)||0 };
  } else {
    var counts = {
      single: parseInt(document.getElementById("cntSingle").value,10)||0,
      multi:  parseInt(document.getElementById("cntMulti").value,10)||0,
      bool:   parseInt(document.getElementById("cntBool").value,10)||0
    };
    if (counts.single + counts.multi + counts.bool < 1) { alert("请至少设置 1 道客观题"); return; }
    cfg = { plan: "random", counts: counts, typing: typing, typingMinutes: typingMinutes, examMinutes: parseInt(document.getElementById("examMinutes").value,10)||0 };
  }
  examLastCfg = cfg;
  document.getElementById("examSetupOverlay").style.display = "none";
  enterExamView();
  var paper = rebuildPaper(cfg);
  examPaperList = paper.list; examPaperMeta = paper.meta;
  examTypingOn = typing; examTypingMinutes = typingMinutes;
  startExam();
}
function enterExamView() {
  document.getElementById("questionsList").style.display = "none";
  document.getElementById("loadMoreWrap").style.display = "none";
  var tb = document.querySelector(".toolbar"); if (tb) tb.style.display = "none";
  if (!_mPromo) document.getElementById("promoBanner").style.display = "none";
  examView.style.display = "block";
  document.getElementById("examModeLabel").textContent = (MODE === "interview") ? "面试" : "笔试";
  examSubmitBtn.textContent = (MODE === "interview") ? " 显示参考答案" : " 提交试卷";
  window.scrollTo({ top: 0 });
}
function exitExamMode() {
  examActive = false;
  stopExamTimer();
  examView.style.display = "none";
  document.getElementById("questionsList").style.display = "";
  var tb = document.querySelector(".toolbar"); if (tb) tb.style.display = "";
  if (_mPromo) document.getElementById("promoBanner").style.display = "flex";
  render();
}
function startExamTimer(minutes){
  stopExamTimer();
  examTimerLimit = minutes * 60;
  examTimerRemaining = examTimerLimit;
  var bar = document.getElementById("examTimerBar");
  var fill = document.getElementById("examTimerFill");
  var digits = document.getElementById("examTimerDigits");
  if (!bar) return;
  bar.style.display = "flex";
  fill.style.width = "100%"; fill.classList.remove("warning");
  function fmt(s){ var m=Math.floor(s/60), x=s%60; return (m<10?"0"+m:m)+":"+(x<10?"0"+x:x); }
  digits.textContent = fmt(examTimerRemaining);
  examTimer = setInterval(function(){
    examTimerRemaining--;
    digits.textContent = fmt(examTimerRemaining);
    fill.style.width = (examTimerRemaining / examTimerLimit * 100) + "%";
    if (examTimerRemaining <= 60) fill.classList.add("warning");
    if (examTimerRemaining <= 0){ clearInterval(examTimer); digits.textContent = "00:00 时间到"; submitExam(); }
  }, 1000);
}
function stopExamTimer(){ if (examTimer) clearInterval(examTimer); examTimer = null; }
function startExam() {
  examGraded = false; examSelections = {};
  examResult.style.display = "none"; examResult.innerHTML = "";
  var mins = (examLastCfg && examLastCfg.examMinutes) ? examLastCfg.examMinutes : (CONFIG.examPreset ? (CONFIG.examPreset.minutes || 0) : 0);
  if (mins > 0) startExamTimer(mins);
  else { var tb = document.getElementById("examTimerBar"); if (tb) tb.style.display = "none"; }
  var list = examPaperList;
  var meta = examPaperMeta;
  document.getElementById("examTotal").textContent = list.length;
  document.getElementById("examSubInfo").innerHTML = typesText(meta.per) + (examTypingOn ? "　+ 打字题" : "");
  var arr = list.slice();
  examQuestions.innerHTML = "";
  if (!arr.length) { examQuestions.innerHTML = '<div class="no-result"> 该范围没有题目</div>'; return; }
  arr.forEach(function (q, i) { examQuestions.appendChild(buildExamCard(q, i + 1)); });
  if (examTypingOn && MODE === "written") {
    var passage = CONFIG.typingText || "";
    var tcard = document.createElement("div");
    tcard.className = "exam-q typing-q";
    tcard.innerHTML = '<div class="exam-q-head"><div class="exam-q-meta"><span class="exam-q-tag" style="background:linear-gradient(135deg,#d97706,#f59e0b)">打字题</span><span class="exam-q-num">限时 ' + examTypingMinutes + ' 分钟 · 不计入客观题分</span></div><div class="exam-q-stem"> 请照抄下方范文</div></div>'
      + '<div class="typing-passage" id="typingPassage">' + escapeHtml(passage) + '</div>'
      + '<textarea class="typing-area" id="typingArea" placeholder="在此处对照上方范文抄写……"></textarea>';
    examQuestions.insertBefore(tcard, examQuestions.firstChild);
  }
}
function buildExamCard(q, n) {
  var card = document.createElement("div");
  card.className = "exam-q"; card.id = "examQ" + q._idx; var questionText = (MODE === "interview") ? (q.title || "") : (q.stem || ""); card.setAttribute("data-question", questionText);
  var headerHtml, bodyHtml;
  if (MODE === "interview") {
    headerHtml = '<div class="exam-q-meta"><span class="exam-q-num">第 ' + n + ' 题</span></div><div class="exam-q-stem">' + escapeHtml(q.title || "") + '</div>';
    bodyHtml = '<div class="exam-explain" id="examExp' + q._idx + '"><b>参考答案：</b><br>' + formatAnswer(q.answer || "（暂无参考答案）", currentSearch) + '</div>';
  } else {
    var lab = (q.type === "multiple" || q.type === "multi") ? {t:"多选题", c:"tag-multi"} : ((q.type === "judge" || q.type === "bool") ? {t:"判断题", c:"tag-bool"} : {t:"单选题", c:"tag-single"});
    var stemHtml = highlight(q.stem || "", currentSearch);
    var multi = (q.type === "multiple" || q.type === "multi");
    var opts = (q.options || []).map(function (o) {
      return '<div class="exam-opt" data-idx="' + q._idx + '" data-letter="' + o.letter + '" data-multi="' + (multi ? 1 : 0) + '">'
        + '<span class="exam-opt-letter">' + o.letter + '.</span>'
        + '<span class="exam-opt-text">' + escapeHtml(o.text) + '</span>'
        + '<span class="exam-mark"></span></div>';
    }).join("");
    bodyHtml = '<div class="exam-opts">' + opts + '</div>'
      + '<div class="exam-explain" id="examExp' + q._idx + '"><div>答案：<b>' + escapeHtml(displayAnswer(q)) + '</b></div>'
      + (q.explanation ? '<div style="margin-top:6px">解析：' + formatAnswer(q.explanation, currentSearch) + '</div>' : '') + '</div>';
    headerHtml = '<div class="exam-q-meta"><span class="exam-q-tag ' + lab.c + '">' + lab.t + '</span><span class="exam-q-num">第 ' + n + ' 题</span></div><div class="exam-q-stem">' + stemHtml + '</div>';
  }
  card.innerHTML = '<div class="exam-q-head">' + headerHtml + '</div>' + bodyHtml;
  return card;
}
if (examQuestions) examQuestions.addEventListener("click", function (e) {
  var opt = e.target.closest(".exam-opt");
  if (!opt || examGraded) return;
  var idx = +opt.dataset.idx, letter = opt.dataset.letter, multi = opt.dataset.multi === "1";
  if (multi) {
    if (!examSelections[idx]) examSelections[idx] = [];
    var pos = examSelections[idx].indexOf(letter);
    if (pos === -1) examSelections[idx].push(letter); else examSelections[idx].splice(pos, 1);
    opt.parentElement.querySelectorAll(".exam-opt").forEach(function (c) {
      c.classList.toggle("selected", examSelections[idx].indexOf(c.dataset.letter) !== -1);
    });
  } else {
    examSelections[idx] = [letter];
    opt.parentElement.querySelectorAll(".exam-opt").forEach(function (c) {
      c.classList.toggle("selected", c.dataset.letter === letter);
    });
  }
});
function normAnsArr(ans) {
  return (Array.isArray(ans) ? ans : String(ans).split("")).map(function (x) { return String(x).trim(); }).filter(Boolean);
}
function submitExam() {
  if (examGraded && MODE === "written") return;
  examGraded = true;
  stopExamTimer();
  var list = examPaperList;
  if (MODE === "interview") {
    list.forEach(function (q) { var card = document.getElementById("examQ" + q._idx); if (card) card.classList.add("graded"); });
    examResult.innerHTML = '<div class="exam-result-detail">面试为开放作答，提交后已展示各题参考答案，请对照自评，并用上方「 随机抽题」里的  录音功能演练口述作答。</div>';
    examResult.style.display = "block";
    window.scrollTo({ top: 0 });
    return;
  }
  var correct = 0, total = list.length, wrong = 0;
  list.forEach(function (q) {
    var sel = examSelections[q._idx] || [];
    var isCorrect = false;
    if (q.type === "multiple" || q.type === "multi") {
      isCorrect = normAnsArr(q.answer).sort().join("") === sel.map(function (x) { return String(x).trim(); }).sort().join("") && sel.length > 0;
    } else if (q.type === "judge" || q.type === "bool") {
      var selText = ""; (q.options || []).forEach(function (o) { if (sel.indexOf(o.letter) !== -1) selText = o.text; });
      isCorrect = (selText === String(q.answer).trim());
    } else {
      isCorrect = (sel.length === 1 && String(sel[0]).trim() === String(q.answer).trim());
    }
    var card = document.getElementById("examQ" + q._idx);
    card.classList.add("graded");
    card.insertBefore(makeResultBanner(isCorrect, q, sel), card.firstChild);
    if (isCorrect) { correct++; card.classList.add("graded-correct"); }
    else { wrong++; card.classList.add("graded-wrong"); }
    var ansArr = normAnsArr(q.answer);
    (q.options || []).forEach(function (o) {
      var el = card.querySelector('.exam-opt[data-letter="' + o.letter + '"]'); if (!el) return;
      var isAns = ansArr.indexOf(String(o.letter).trim()) !== -1;
      if (isAns) el.classList.add("correct");
      if (sel.indexOf(o.letter) !== -1 && !isAns) el.classList.add("wrong");
      var mk = el.querySelector(".exam-mark");
      if (isAns) mk.textContent = ""; else if (sel.indexOf(o.letter) !== -1) mk.textContent = "";
    });
  });
  examGraded = true;
  if (MODE === "interview") {
    examResult.innerHTML = '<div class="exam-result-detail">面试为开放作答，提交后已展示各题参考答案，请对照自评，并用上方「 随机抽题」里的  录音功能演练口述作答。</div>';
  } else {
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var grade = pct >= 90 ? " 优秀" : pct >= 60 ? " 合格" : " 继续加油";
    var html = '<div class="exam-result-score">' + correct + ' / ' + total + '</div>'
      + '<div class="exam-result-detail">客观题正确率 <b>' + pct + '%</b>　' + grade + '　（答错 ' + wrong + ' 题，已用  标出）</div>';
    if (examTypingOn) html += gradeTyping();
    html += '<div class="exam-ai-analysis" id="examAiAnalysis">'
      + '<div class="exam-ai-head"> AI 智能分析本次作答</div>'
      + '<button type="button" class="exam-ai-btn" id="examAiAnalyzeBtn"> 开始 AI 分析</button>'
      + '<div class="exam-ai-result" id="examAiResult" style="display:none"></div>'
      + '</div>';
    examResult.innerHTML = html;
    window.__rcjExamAiAutoRan = false;
    if (window.__rcjExamAiAuto) window.__rcjExamAiAuto();
  }
  examResult.style.display = "block";
  window.scrollTo({ top: 0 });
}
function gradeTyping(){
  var passage = CONFIG.typingText || "";
  var area = document.getElementById("typingArea");
  if (!passage || !area) return "";
  var typed = area.value || "";
  var n = typed.length;
  var matched = 0, len = Math.min(n, passage.length);
  for (var i = 0; i < len; i++){ if (typed.charAt(i) === passage.charAt(i)) matched++; }
  var acc = passage.length ? Math.round(matched / passage.length * 100) : 0;
  var speed = examTypingMinutes ? Math.round(n / examTypingMinutes) : n;
  return '<div class="exam-result-detail" style="margin-top:8px"> 打字题：共录入 <b>' + n + '</b> 字 · 准确率 <b>' + acc + '%</b> · 速度约 <b>' + speed + '</b> 字/分钟（不计入客观题分）</div>';
}
function resetExam() {
  examGraded = false; examSelections = {}; examResult.style.display = "none"; examResult.innerHTML = ""; examQuestions.innerHTML = "";
  if (examLastCfg) {
    var paper = rebuildPaper(examLastCfg);
    examPaperList = paper.list; examPaperMeta = paper.meta;
    examTypingOn = examLastCfg.typing; examTypingMinutes = examLastCfg.typingMinutes;
  }
  startExam(); window.scrollTo({ top: 0 });
}
var _examBtn = document.getElementById("examBtn");
if (_examBtn) {
  _examBtn.addEventListener("click", openExamSetup);
  document.getElementById("examExitBtn").addEventListener("click", exitExamMode);
  document.getElementById("examSubmitBtn").addEventListener("click", submitExam);
  document.getElementById("examResetBtn").addEventListener("click", resetExam);
  document.getElementById("examSetupStart").addEventListener("click", confirmExamSetup);
  document.getElementById("examSetupPreset").addEventListener("click", applyExamPreset);
  document.getElementById("examSetupCancel").addEventListener("click", function(){ examActive=false; document.getElementById("examSetupOverlay").style.display="none"; });
  document.getElementById("typingOn").addEventListener("change", refreshExamInfo);
  document.getElementById("examPlanMode").addEventListener("change", toggleExamPlan);
  ["cntSingle","cntMulti","cntBool","examMinutes","examMinutesTyping"].forEach(function(id){
    var el = document.getElementById(id); if (el) el.addEventListener("input", refreshExamInfo);
  });
}

// 初始化界面
// 标题 / 副标题
document.title = CONFIG.siteTitle || document.title;
document.getElementById("siteTitle").textContent = CONFIG.siteTitle;
document.getElementById("siteEmoji").textContent = CONFIG.siteEmoji;
document.getElementById("siteSubtitle").textContent = CONFIG.subtitle + (CONFIG.examYear ? "（" + CONFIG.examYear + "）" : "");

// 适用地区标签行（仅面试专区等配置了 applicableRegions 的站点显示）
(function () {
  var regions = CONFIG.applicableRegions;
  if (!regions || !regions.length) return;
  var row = document.getElementById("regionsRow");
  if (!row) return;
  var withData = CONFIG.regionsWithData || [];
  var h = '<span class="region-chip"><span class="chip-icon"></span>适用地区</span>';
  for (var i = 0; i < regions.length; i++) {
    var has = withData.indexOf(regions[i]) !== -1;
    if (has) {
      h += '<span class="region-chip"><span class="chip-icon"></span>' + escapeHtml(regions[i]) + '</span>';
    } else {
      h += '<span class="region-chip muted">' + escapeHtml(regions[i]) + '</span>';
    }
  }
  row.innerHTML = h;
})();

// 主题色注入（themeColor 统一控制主色与圆角按钮）
if (CONFIG.themeColor) {
  document.documentElement.style.setProperty('--primary', CONFIG.themeColor);
  document.documentElement.style.setProperty('--primary-light', CONFIG.themeColor);
  document.documentElement.style.setProperty('--header-grad', 'linear-gradient(135deg, ' + CONFIG.themeColor + ' 0%, ' + CONFIG.themeColor + ' 100%)');
}

// 封面头像（可选）：超长 base64 会阻塞首屏，自动回退到轻量 SVG
function lightCover(){ return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%231e3a5f'/%3E%3Ctext x='50' y='64' font-size='44' text-anchor='middle' fill='%23fff'%3E%3C/text%3E%3C/svg%3E"; }
function safeCover(src){ return (src && src.length > 8192) ? lightCover() : src; }
if (CONFIG.cover) {
  var _hc = document.querySelector('.header-content');
  if (_hc) {
    var _cov = document.createElement('img');
    _cov.src = safeCover(CONFIG.cover); _cov.className = 'cover-avatar'; _cov.alt = 'cover';
    _cov.loading = 'lazy'; _cov.decoding = 'async';
    _hc.insertBefore(_cov, _hc.firstChild);
  }
}

// 模块开关（默认极简；按需开启）
// - promo   : 推广横幅（闲鱼 banner）。未显式配置时回退到 xianyu 值，兼容旧配置
// - xianyu  : 工具栏「获取完整版口令」按钮 + 闲鱼口令弹层
// - reward  : 工具栏「打赏作者」按钮 + 赞赏码弹层
var _em = CONFIG.enabledModules || {};
var _mPromo  = (_em.promo !== undefined) ? _em.promo : _em.xianyu;
var _mXianyu = _em.xianyu;
var _mReward = _em.reward;
var _mRecord = (_em.record !== undefined) ? _em.record : false;
function _hide(id) { var _el = document.getElementById(id); if (_el) _el.style.display = 'none'; }
if (!_mPromo)  { _hide('promoBanner'); }
if (!_mXianyu) { _hide('xianyuToastOverlay'); }
if (!_mReward) { _hide('rewardBtn'); _hide('rewardToastOverlay'); }
// 录音模块门控：笔试站（hz 等）不需要开口演练/语音日志
if (!_mRecord) {
  _hide('practiceLogCard');       // 首屏「我的练习录音」卡片
  _hide('recBar');               // 弹窗内录音条
  _hide('voiceLogSavedHint');    // 录音已保存提示
  // 随机按钮文案改为通用（去掉"开口练"）
  var _rb = document.getElementById('randomBtn');
  if (_rb) _rb.textContent = ' 随机抽题';
  // 弹窗标题改为通用（去掉"开口录音演练"）
  var _rmt = document.querySelector('#randomModal .random-modal-header h3');
  if (_rmt) _rmt.textContent = ' 随机抽题';
}

// 闲鱼文案（仅开启时才有意义）
document.getElementById("promoTitle").textContent = CONFIG.promoTitle;
document.getElementById("promoText").innerHTML = CONFIG.promoText;
var _px = document.getElementById("promoXianyu"); if (_px) _px.textContent = " 复制作者ID：" + CONFIG.xianyuCode;
var _xt = document.getElementById("xtCode"); if (_xt) _xt.textContent = CONFIG.xianyuCode;

// 打赏文案与赞赏码（仅 reward 开启时有意义）
if (CONFIG.rewardTitle) document.getElementById("rewardTitle").textContent = CONFIG.rewardTitle;
if (CONFIG.rewardDesc)  document.getElementById("rewardDesc").innerHTML = CONFIG.rewardDesc;
if (CONFIG.rewardImage) { var _qr = document.getElementById("rewardQr"); _qr.src = CONFIG.rewardImage; _qr.loading = 'lazy'; _qr.decoding = 'async'; }

// 倒计时显示
document.getElementById("timerDigits").textContent = (function () { var m = Math.floor(userTimerSeconds / 60), s = userTimerSeconds % 60; return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s); })();

// 页脚（logo + 文案 + 联系 + 版本）
// 去重策略：footerText 不再作为重复版权声明，只留轻量站点名；
// 题量/版本合并到一行小字里，避免与 brandbar 的 RCJ9527 slogan 重复。
var _footer = document.querySelector('.footer');
if (_footer) {
  _footer.innerHTML = '';
  if (CONFIG.logo) {
    var _lg = document.createElement('img'); _lg.src = CONFIG.logo; _lg.className = 'footer-logo'; _lg.alt = 'logo';
    _lg.loading = 'lazy'; _lg.decoding = 'async';
    _footer.appendChild(_lg);
  }
  var _fp = document.getElementById('footerText');
  if (!_fp) { _fp = document.createElement('p'); _fp.id = 'footerText'; _footer.appendChild(_fp); }
  else { if (_fp.parentNode !== _footer) _footer.appendChild(_fp.cloneNode(false)); }
  // 简化重复版权文案：去掉 "© " 和 " · 在线开源版" 这类与 brandbar 重复的表述
  var _ft = (CONFIG.footerText || '').replace(/^©\s*/, '').replace(/\s*·\s*在线开源版$/, '').replace(/\s*·\s*开源离线版$/, '');
  if (_ft) _ft = _ft + (CONFIG.contact ? ' · 联系：' + CONFIG.contact : '');
  _fp.innerHTML = _ft || '';
  _fp.style.display = _ft ? '' : 'none';
  var _fv = document.createElement('p'); _fv.className = 'footer-version'; _fv.id = 'footerVersion';
  _footer.appendChild(_fv);
}

// 版本信息（读取 VERSION.json；离线 file:// 下 fetch 受限时静默跳过）
(function () {
  try {
    fetch('VERSION.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v) return;
        var _fv = document.getElementById('footerVersion');
        if (!_fv) return;
        var _parts = [];
        if (v.updated) _parts.push('更新于 ' + v.updated);
        var _c = [];
        if (v.writtenCount != null) _c.push('笔试 ' + v.writtenCount);
        if (v.interviewCount != null) _c.push('面试 ' + v.interviewCount);
        if (_c.length) _parts.push(_c.join(' / '));
        _fv.textContent = _parts.join(' · ');
      }).catch(function () {});
  } catch (e) {}
})();

// 构建标记：用于排查浏览器缓存（看不到「回答正确/错误」横幅时，先核对此时间与部署时间是否一致）
(function () {
  var _bv = document.getElementById('buildVersion');
  if (_bv) _bv.textContent = 'build:2026-07-12T20-15 · 文字判定横幅v2';
})();

window.addEventListener("DOMContentLoaded", function () {
  if (!hasW && !hasI && !G_DATA.length) {
    document.getElementById("questionsList").innerHTML = '<div class="no-result"> 未找到题目数据。请确认同目录存在 station-data.js（由 build 生成）。</div>';
    return;
  }
  buildModeTabs();
  StorageCtrl.updateUI();
  if (_mRecord) initAudioRecorderSystem();

  // ── 呼吸放松动画 ──
  (function initBreathe() {
    var circle = document.getElementById('breatheCircle');
    var text = document.getElementById('breatheText');
    if (!circle || !text) return;
    var phases = [
      { label: '吸气…', dur: 4000 },
      { label: '屏住…', dur: 2000 },
      { label: '呼气…', dur: 5000 },
      { label: '放松 ', dur: 1000 }
    ];
    var running = false, timer = null, phaseIdx = 0;
    circle.addEventListener('click', function () {
      if (running) { stop(); return; }
      running = true; phaseIdx = 0;
      circle.classList.add('active');
      runPhase();
    });
    function runPhase() {
      if (!running || phaseIdx >= phases.length) { stop(); text.textContent = '再来一次？'; return; }
      var p = phases[phaseIdx];
      text.textContent = p.label;
      timer = setTimeout(function () { phaseIdx++; runPhase(); }, p.dur);
    }
    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      circle.classList.remove('active');
    }
  })();
  render();
  initRoundStat();
  initQuizKeyboard();
  // 面试对练舱入口（仅开启 podEnabled 的城市显示）
  try {
    var podBtn = document.getElementById("podEntryBtn");
    if (podBtn && CONFIG.podEnabled) {
      podBtn.hidden = false;
      podBtn.addEventListener("click", function () {
        window.open("https://facetalk.955827.xyz/?role=辅警&from=fj", "_blank");
      });
    }
  } catch (e) {}
  // 筛选维度与统计需遍历全部题目；题库大时(如惠州2136题)会阻塞首屏渲染，延迟到浏览器空闲执行
  var _idle = window.requestIdleCallback || function (cb) { setTimeout(cb, 120); };
  _idle(function () { buildFilterRows(); updateStats(); });
});

/* ===================== 语音 & AI 点评（自备 Key，仅本机） ===================== */
(function () {
  var ASR_KEY = "rcj_web_asr_v1";
  var OLD_AI_KEY = "rcj_ai_settings";

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normalizeBaseUrl(u) {
    u = (u || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u.replace(/\/+$/, "");
  }

  function fetchWithTimeout2(url, opts, ms) {
    ms = ms || 30000;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("请求超时（" + Math.round(ms / 1000) + "秒未响应）")); }, ms);
      var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var innerTimer = controller ? setTimeout(function () { try { controller.abort(); } catch (_e) {} }, ms) : null;
      fetch(url, controller ? Object.assign({}, opts, { signal: controller.signal }) : opts)
        .then(function (res) { clearTimeout(timer); if (innerTimer) clearTimeout(innerTimer); resolve(res); })
        .catch(function (err) { clearTimeout(timer); if (innerTimer) clearTimeout(innerTimer); reject(err); });
    });
  }

  function loadAsr() {
    var def = { asrEngine: "webspeech", asr: { baseUrl: "", key: "", model: "" }, llm: { enabled: false, baseUrl: "", key: "", model: "" } };
    try {
      var s = localStorage.getItem(ASR_KEY);
      if (s) {
        var p = JSON.parse(s);
        if (p.asr) p.asr = Object.assign(def.asr, p.asr);
        if (p.llm) p.llm = Object.assign(def.llm, p.llm);
        var merged = Object.assign(def, p);
        // sanitize: 矫正缺失/非法的 asrEngine，避免脏 localStorage 导致弹层显示异常
        if (!merged.asrEngine || typeof merged.asrEngine !== "string") merged.asrEngine = "webspeech";
        return merged;
      }
      // 迁移旧版 AI 点评设置
      var old = localStorage.getItem(OLD_AI_KEY);
      if (old) {
        var o = JSON.parse(old);
        def.llm = { enabled: !!o.enabled, baseUrl: o.baseUrl || "", key: o.apiKey || "", model: o.model || "" };
        def.asr.baseUrl = o.baseUrl || "";
        def.asr.key = o.apiKey || "";
        return def;
      }
    } catch (e) {}
    return def;
  }
  function saveAsr(s) { try { localStorage.setItem(ASR_KEY, JSON.stringify(s)); } catch (e) {} }

  var ov = document.getElementById("aiSettingsOverlay");
  var btn = document.getElementById("aiSettingsBtn");
  var saveBtn = document.getElementById("aiSettingsSave");
  var closeBtn = document.getElementById("aiSettingsClose");
  var testBtn = document.getElementById("aiTestBtn");
  var aiBtn = document.getElementById("aiReviewBtn");
  var myAnswer = document.getElementById("myAnswer");
  var resultBox = document.getElementById("aiReviewResult");
  var transcriptContent = document.getElementById("transcriptContent");
  var transcriptNote = document.getElementById("transcriptNote");

  function syncAsrPanel() {
    var eng = (document.querySelector('input[name="aiAsrEngine"]:checked') || { value: "webspeech" }).value;
    var p = document.getElementById("aiAsrCloudPanel");
    if (p) p.style.display = (eng === "cloud") ? "block" : "none";
  }

  function refreshAiUiByMode() {
    var vs = document.getElementById("aiVoiceSection");
    if (vs) vs.style.display = (MODE === "interview") ? "block" : "none";
    var title = document.querySelector(".ai-settings-title");
    if (title) title.textContent = " 设置";
    if (btn) btn.textContent = " 设置";
    // 折叠分组标题随模式变化：面试含语音转写，笔试仅 AI 分析
    var cfgHead = document.querySelector("#aiCfgGroup .ai-collapsible-head > span:first-child");
    if (cfgHead) cfgHead.textContent = (MODE === "interview") ? " 语音 & AI 点评设置（自备 Key）" : " AI 分析设置（自备 Key）";
  }
  // 设置弹窗分组折叠（默认自动折叠，画面更简洁）
  function setAiCollapse(id, open) {
    var g = document.getElementById(id);
    if (!g) return;
    g.setAttribute("data-open", open ? "true" : "false");
    var head = g.querySelector(".ai-collapsible-head");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
  }
  document.querySelectorAll(".ai-collapsible-head").forEach(function (h) {
    h.addEventListener("click", function () {
      var g = h.closest(".ai-collapsible");
      if (!g) return;
      setAiCollapse(g.id, g.getAttribute("data-open") !== "true");
    });
  });
  function openSettings() {
    var s = loadAsr();
    var eng = s.asrEngine || "webspeech";
    var r = document.querySelector('input[name="aiAsrEngine"][value="' + eng + '"]');
    // 兜底：若残留非法 engine 找不到对应 radio，矫正回 webspeech 并重新查找
    if (!r) { eng = "webspeech"; r = document.querySelector('input[name="aiAsrEngine"][value="webspeech"]'); s.asrEngine = "webspeech"; }
    if (r) r.checked = true;
    document.getElementById("aiAsrBaseUrl").value = s.asr.baseUrl || "";
    document.getElementById("aiAsrApiKey").value = s.asr.key || "";
    document.getElementById("aiAsrModel").value = s.asr.model || "";
    document.getElementById("aiEnabled").checked = !!s.llm.enabled;
    document.getElementById("aiBaseUrl").value = s.llm.baseUrl || "";
    document.getElementById("aiApiKey").value = s.llm.key || "";
    document.getElementById("aiModel").value = s.llm.model || "";
    document.getElementById("aiTestResult").textContent = "";
    syncAsrPanel();
    refreshAiUiByMode();
    // 打开时默认自动折叠分组，画面更简洁（用户可点击展开）
    setAiCollapse("aiCfgGroup", false);
    setAiCollapse("aiBankGroup", false);
    setAiCollapse("aiVoiceLogGroup", false);
    renderVoiceLog(); // 打开设置时刷新「我的练习录音」列表（首屏 + 设置共用同一渲染）
    ov.classList.add("show");
  }
  function closeSettings() { ov.classList.remove("show"); }

  if (btn) btn.addEventListener("click", openSettings);
  refreshAiUiByMode();
  if (closeBtn) closeBtn.addEventListener("click", closeSettings);
  if (ov) ov.addEventListener("click", function (e) { if (e.target === ov) closeSettings(); });
  document.querySelectorAll('input[name="aiAsrEngine"]').forEach(function (r) { r.addEventListener("change", syncAsrPanel); });

  if (saveBtn) saveBtn.addEventListener("click", function () {
    var s = {
      asrEngine: (document.querySelector('input[name="aiAsrEngine"]:checked') || { value: "webspeech" }).value,
      asr: {
        baseUrl: document.getElementById("aiAsrBaseUrl").value.trim(),
        key: document.getElementById("aiAsrApiKey").value.trim(),
        model: document.getElementById("aiAsrModel").value.trim()
      },
      llm: {
        enabled: document.getElementById("aiEnabled").checked,
        baseUrl: document.getElementById("aiBaseUrl").value.trim(),
        key: document.getElementById("aiApiKey").value.trim(),
        model: document.getElementById("aiModel").value.trim()
      }
    };
    if (s.asrEngine === "cloud") {
      if (!s.asr.baseUrl) { alert("已选择「云端 API」转写，必须填写 API Base URL（例如 https://api.siliconflow.cn/v1）"); return; }
      if (!s.asr.key) { alert("已选择「云端 API」转写，必须填写 API Key"); return; }
      if (!s.asr.model) { alert("已选择「云端 API」转写，必须填写模型名（例如 FunAudioLLM/SenseVoiceSmall）"); return; }
    }
    if (s.llm.enabled && !s.llm.baseUrl) { alert("已启用 AI 点评，但缺少 API Base URL"); return; }
    if (s.llm.enabled && !s.llm.key) { alert("已启用 AI 点评，但缺少 API Key"); return; }
    if (s.llm.enabled && !s.llm.model) { alert("已启用 AI 点评，但缺少模型名"); return; }
    saveAsr(s);
    closeSettings();
  });

  // 测试连接：两步探测 /models + /chat/completions
  if (testBtn) testBtn.addEventListener("click", function () {
    var rawUrl = document.getElementById("aiBaseUrl").value.trim();
    var key = (document.getElementById("aiApiKey").value || "").trim();
    var model = (document.getElementById("aiModel").value || "").trim();
    var resEl = document.getElementById("aiTestResult");
    if (!key) { resEl.style.color = "#dc2626"; resEl.textContent = " 请先填 API Key"; return; }
    if (!model) { resEl.style.color = "#dc2626"; resEl.textContent = " 请先填模型名"; return; }
    if (!rawUrl) { resEl.style.color = "#dc2626"; resEl.textContent = " 请先填 API Base URL（需 https:// 开头）"; return; }
    var baseUrl = normalizeBaseUrl(rawUrl);
    var modelsUrl = baseUrl + "/models";
    var chatUrl = baseUrl + "/chat/completions";
    resEl.style.color = "#6b7280"; resEl.textContent = " 第一步：探测 /models ...";
    testBtn.disabled = true;
    var settled = false;
    function finish(color, text) { if (settled) return; settled = true; resEl.style.color = color; resEl.textContent = text; testBtn.disabled = false; }
    function explain(err, step) {
      var msg = String(err.message || err || "");
      if (/timeout|超时|timed out/i.test(msg)) return " " + step + " 超时：请检查 URL、本机外网连接、代理/防火墙。";
      if (/Failed to fetch|NetworkError|Network request failed|Failed to load/i.test(msg)) return " " + step + " 网络失败：请检查 URL 是否以 https:// 开头、本机能否访问外网。";
      if (/CORS|cross-origin|blocked by CORS/i.test(msg)) return " " + step + " 跨域被拦截：线上环境一般正常，本地 file:// 打开可能受限。";
      return " " + step + " 失败：" + msg;
    }
    function checkHttp(res, url) {
      if (res.ok) return res;
      return res.text().then(function (body) {
        var text = (body || "").slice(0, 200);
        if (res.status === 401) throw new Error("HTTP 401：API Key 无效、已过期，或被限制访问该端点。");
        if (res.status === 403) throw new Error("HTTP 403：没有模型 " + model + " 的访问权限。");
        if (res.status === 404) throw new Error("HTTP 404：URL 路径不对（" + url + "）。");
        if (res.status === 429) throw new Error("HTTP 429：请求太频繁或余额不足。");
        throw new Error("HTTP " + res.status + " " + text);
      });
    }
    fetchWithTimeout2(modelsUrl, { method: "GET", mode: "cors", headers: { "Accept": "application/json", "Authorization": "Bearer " + key } }, 6000)
      .then(function (res) { return checkHttp(res, modelsUrl); })
      .then(function () {
        resEl.textContent = " 第二步：验证 Key+模型 /chat/completions ...";
        return fetchWithTimeout2(chatUrl, {
          method: "POST", mode: "cors",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
          body: JSON.stringify({ model: model, messages: [{ role: "user", content: "你好" }], max_tokens: 5, stream: false })
        }, 10000);
      })
      .then(function (res) { return checkHttp(res, chatUrl); })
      .then(function (res) { return res.json(); })
      .then(function (j) {
        var ans = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
        if (ans) finish("#059669", " 连接成功！模型回复：" + ans.slice(0, 30));
        else finish("#b45309", " 连接成功但返回为空（模型名可能不对）");
      })
      .catch(function (err) { finish("#dc2626", explain(err, err.stepName || "验证 /chat/completions")); });
  });

  function renderTranscript(text) {
    text = (text || "").trim();
    if (transcriptContent) transcriptContent.innerHTML = escapeHtml(text);
    if (myAnswer) myAnswer.value = text;
    if (transcriptNote) { transcriptNote.style.display = "none"; }
  }

  // 云端 ASR：把 MP3 blob 发到 /audio/transcriptions
  function runCloudAsr(blob) {
    var s = loadAsr();
    if (s.asrEngine !== "cloud" || !s.asr.key) return;
    if (transcriptNote) {
      transcriptNote.style.display = "block";
      transcriptNote.textContent = " 正在调用云端语音识别...";
    }
    var fd = new FormData();
    fd.append("file", blob, "audio.mp3");
    fd.append("model", s.asr.model || "whisper-1");
    var url = normalizeBaseUrl(s.asr.baseUrl) + "/audio/transcriptions";
    fetchWithTimeout2(url, { method: "POST", mode: "cors", headers: { "Authorization": "Bearer " + s.asr.key }, body: fd }, 30000)
      .then(function (res) {
        if (!res.ok) return res.text().then(function (tx) { throw new Error("HTTP " + res.status + " " + tx.slice(0, 200)); });
        return res.json();
      })
      .then(function (j) {
        var text = (j && j.text) ? j.text.trim() : "";
        renderTranscript(text);
      })
      .catch(function (err) {
        if (transcriptNote) {
          transcriptNote.style.display = "block";
          transcriptNote.textContent = " 云端识别失败：" + err.message + "（请填支持 /audio/transcriptions 的服务，推荐硅基流动 SenseVoice）";
        }
      });
  }
  window.__rcjRunCloudAsr = runCloudAsr;

  // ===== 录后 AI 引导提示（SoloSpeak 式：锦上添花，不阻断流程） =====
  function showAiHint() {
    var locked = document.getElementById("aiGuideLocked");
    var full = document.getElementById("aiReviewFull");
    if (!locked || !full) return;
    var s = loadAsr();
    var hasLlm = s.llm && s.llm.enabled && s.llm.key && s.llm.baseUrl && s.llm.model;
    if (hasLlm) {
      // 配置完整  显示完整 AI 点评 UI
      locked.style.display = "none";
      full.style.display = "";
      // 重新绑定事件（因为 DOM 可能被隐藏/显示切换过）
      bindAiReviewBtn();
    } else {
      // 未配置  显示温和提示卡片
      locked.style.display = "";
      full.style.display = "none";
      var ub = document.getElementById("aiUnlockBtn");
      if (ub) { ub.onclick = function () { openSettings(); }; }
    }
  }
  function bindAiReviewBtn() {
    var btn = document.getElementById("aiReviewBtn");
    if (!btn) return;
    // 移除旧监听（避免重复绑定）
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", function () {
      var s = loadAsr();
      if (!s.llm.enabled) { showAiErr("AI 点评未启用：请点「 语音 & AI 设置」勾选启用并填入 Key。"); return; }
      if (!s.llm.key || !s.llm.baseUrl || !s.llm.model) { showAiErr("AI 点评配置不完整：请补全 Base URL / Key / 模型名。"); return; }
      runAiReview(s);
    });
  }
  function showAiErr(msg) {
    var res = document.getElementById("aiReviewResult");
    if (res) { res.style.display = "block"; res.style.color = "#dc2626"; res.innerHTML = " " + msg; }
  }
  window.showAiHint = showAiHint;

  // AI 点评执行逻辑（从原 click handler 抽出）
  function runAiReview(s) {
    var stemEl = document.getElementById("randomModalQuestion");
    var stem = stemEl ? stemEl.innerText.trim() : "";
    var answer = (myAnswer && myAnswer.value.trim()) || "";
    if (!answer) {
      var tc = document.getElementById("transcriptContent");
      answer = tc ? tc.innerText.trim() : "";
    }
    if (!answer) { showAiErr("还没有可点评的内容：请先录音转写，或在「我的作答」里写下你的回答。"); return; }

    var resultBox = document.getElementById("aiReviewResult");
    resultBox.style.display = "block";
    resultBox.innerHTML = '<div class="ai-review-loading"> AI 点评中…（取决于你的网络与模型速度）</div>';
    var reviewBtn = document.getElementById("aiReviewBtn");
    if (reviewBtn) reviewBtn.disabled = true;

    var sys = "你是深圳市公安局辅警招聘结构化面试的资深考官，具备多年一线测评经验。考生会针对抽取的题目做口头作答（已通过语音转写文字，可能有口语化、重复、卡顿，请忽略语音瑕疵，聚焦内容质量）。\n\n请结合题目、题型与参考答案要点，给出专业、可操作的点评，严格按以下四段结构输出：\n\n【亮点】考生作答中哪怕极少的到位之处也要肯定，给信心。\n\n【不足与标准示范】逐条指出遗漏或偏差；每条不足后紧跟一段『考官标准作答』片段作对照（标注『参考示范：』），让考生知道正确说法长什么样。若考生作答极短（如只说了一句套话就停），请直接在开头给出该题一段完整的标准作答模板，再分析不足。\n\n【评分】按深圳辅警面试核心维度各打 0-10 分并给总分（满分自定需说明）：\n- 综合分析能力（能否抓核心矛盾、逻辑清晰）\n- 岗位匹配与职业认知（对辅警作为纪律部队辅助力量、协助执法、服务群众的职责理解）\n- 应急应变 / 计划组织协调（按题型适用维度给分，不适用注明『本题不考察』）\n- 语言表达（口述流畅度、条理性、用词）\n每个维度后补一句『达到 8 分需做到：…』。\n\n【改进建议】给 1-2 条可立即执行的动作（如开口先表态定调，用『我对此深表…』强行起头打破卡壳）。\n\n要求：紧扣『深圳辅警』身份，点评中适当点出辅警纪律部队属性、协助执法与服务群众定位，引导考生把作答与岗位结合；具体有针对性，避免空话；考生未覆盖的参考答案要点必须明确指出；语气像真考官——专业直接能戳痛点，但给示范不给打击。";
    var user = "【题目】\n" + stem + "\n\n【考生作答】\n" + answer;

    var url = normalizeBaseUrl(s.llm.baseUrl) + "/chat/completions";
    fetchWithTimeout2(url, {
      method: "POST", mode: "cors",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.llm.key },
      body: JSON.stringify({ model: s.llm.model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.6, max_tokens: 2000 })
    }, 30000)
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + "：" + t.slice(0, 200)); });
        return r.json();
      })
      .then(function (data) {
        var txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
        if (!txt) { resultBox.innerHTML = '<div class="ai-review-err"> 模型返回为空，可能是模型名在该平台未开通。请换一个模型。</div>'; return; }
        resultBox.innerHTML = '<div class="ai-review-head2"> AI 点评结果</div><div class="ai-review-body">' + escapeHtml(txt).replace(/\n/g, "<br>") + '</div>';
      })
      .catch(function (err) {
        resultBox.innerHTML = '<div class="ai-review-err"> AI 点评失败：' + escapeHtml(err.message) + '<br><br>排查： Key 是否正确； 账户是否有额度； 模型是否可访问； 浏览器能否访问该 API 域名（国内直连优先选硅基流动）。</div>';
      })
      .finally(function () { var rb = document.getElementById("aiReviewBtn"); if (rb) rb.disabled = false; });
  }

  // 换一题时清空上次的「我的作答」与点评结果，重置 AI 引导状态
  var _origShow = window.showRandomQuestion;
  if (typeof _origShow === "function") {
    window.showRandomQuestion = function () {
      if (myAnswer) myAnswer.value = "";
      var rb = document.getElementById("aiReviewResult");
      if (rb) { rb.style.display = "none"; rb.innerHTML = ""; }
      // 隐藏 AI 引导区域（等下次录音后再显示）
      var locked = document.getElementById("aiGuideLocked");
      var full = document.getElementById("aiReviewFull");
      if (locked) locked.style.display = "none";
      if (full) full.style.display = "none";
      return _origShow.apply(this, arguments);
    };
  }

  // ===== 笔试：提交套卷后 AI 智能分析 =====
  function isQCorrect(q, sel) {
    if (!sel || !sel.length) return false;
    if (q.type === "multiple" || q.type === "multi") {
      return normAnsArr(q.answer).sort().join("") === sel.map(function (x) { return String(x).trim(); }).sort().join("") && sel.length > 0;
    } else if (q.type === "judge" || q.type === "bool") {
      var selText = ""; (q.options || []).forEach(function (o) { if (sel.indexOf(o.letter) !== -1) selText = o.text; });
      return (selText === String(q.answer).trim());
    }
    return (sel.length === 1 && String(sel[0]).trim() === String(q.answer).trim());
  }
  function optText(q, letters) {
    var out = []; (q.options || []).forEach(function (o) { if (letters.indexOf(o.letter) !== -1) out.push(o.letter + ". " + o.text); });
    return out.join("；") || "（未作答）";
  }
  function buildExamAiPrompt() {
    var list = examPaperList || [];
    var TYPE_LABEL = { single: "单选题", multi: "多选题", bool: "判断题" };
    var byType = {}; var wrong = [];
    list.forEach(function (q) {
      var sel = examSelections[q._idx] || [];
      var t = normType(q.type);
      var lab = TYPE_LABEL[t] || q.type;
      if (!byType[lab]) byType[lab] = { total: 0, correct: 0 };
      byType[lab].total++;
      if (isQCorrect(q, sel)) { byType[lab].correct++; }
      else {
        var stem = (q.stem || "").replace(/\s+/g, " ").slice(0, 200);
        wrong.push("- [" + lab + "] " + stem + (stem.length >= 200 ? "…" : "")
          + "\n  你的答案：" + optText(q, sel)
          + "\n  正确答案：" + optText(q, normAnsArr(q.answer))
          + (q.explanation ? "\n  解析：" + String(q.explanation).replace(/\s+/g, " ").slice(0, 160) : ""));
      }
    });
    var typeLines = [];
    for (var k in byType) { var b = byType[k]; var p = b.total ? Math.round(b.correct / b.total * 100) : 0; typeLines.push(k + " " + b.correct + "/" + b.total + "（正确率 " + p + "%）"); }
    var totalN = list.length, correctN = list.length - wrong.length;
    var pctAll = totalN ? Math.round(correctN / totalN * 100) : 0;
    return "【本次模考概览】\n总分 " + correctN + "/" + totalN + "（客观题正确率 " + pctAll + "%）\n各题型：\n" + typeLines.join("\n") + "\n\n【错题清单】（共 " + wrong.length + " 题）\n" + (wrong.length ? wrong.join("\n\n") : "无");
  }
  window.__rcjExamAiAnalyze = function () {
    var s = loadAsr();
    var resEl = document.getElementById("examAiResult");
    if (!resEl) return;
    if (!(s.llm && s.llm.enabled)) { resEl.style.display = "block"; resEl.style.color = "#dc2626"; resEl.innerHTML = " AI 分析未启用：请点「 语音 & AI 设置」勾选启用并填入 Key。"; return; }
    if (!s.llm.key || !s.llm.baseUrl || !s.llm.model) { resEl.style.display = "block"; resEl.style.color = "#dc2626"; resEl.innerHTML = " AI 分析配置不完整：请补全 Base URL / Key / 模型名。"; return; }
    var btn = document.getElementById("examAiAnalyzeBtn");
    resEl.style.display = "block";
    resEl.innerHTML = '<div class="ai-review-loading"> AI 分析中…（取决于你的网络与模型速度）</div>';
    if (btn) btn.disabled = true;
    var sys = "你是辅警笔试备考的智能教练，具备多年辅警/公安招考题库教研经验。用户刚提交了一套模拟卷的客观题作答数据，请你基于数据给出专业、可操作的分析，严格按以下四段结构输出：\n\n【总体表现】用一句话总结本次模考水平，点出与合格线（通常 60%）的差距。\n\n【题型强弱】结合各题型正确率，指出最薄弱的题型与最强题型，说明可能原因（如多选题漏选/错选、判断题概念混淆）。\n\n【错因归类】把错题归为 2-4 类（如：法律条文记忆模糊、公安基础理论不清、审题粗心、时事政治盲区），每条给一句说明。\n\n【针对性提分建议】给 2-3 条可立即执行的动作（如：重点刷『法律基础知识』模块的多选题、建立错题本每周复盘、判断题先用排除法）。\n\n要求：紧扣辅警笔试常见模块（法律基础知识、公安基础理论与实务、时事政治、职业道德与纪律要求、公文处理/计算机基础等）；具体有针对性，避免空话；不得承诺包过或通过率；语气专业且鼓励。";
    var user = buildExamAiPrompt();
    var url = normalizeBaseUrl(s.llm.baseUrl) + "/chat/completions";
    fetchWithTimeout2(url, {
      method: "POST", mode: "cors",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.llm.key },
      body: JSON.stringify({ model: s.llm.model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.6, max_tokens: 2200 })
    }, 35000)
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + "：" + t.slice(0, 200)); });
        return r.json();
      })
      .then(function (data) {
        var txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
        if (!txt) { resEl.innerHTML = '<div class="ai-review-err"> 模型返回为空，可能是模型名在该平台未开通。请换一个模型。</div>'; return; }
        resEl.innerHTML = '<div class="ai-review-head2"> AI 智能分析</div><div class="ai-review-body">' + escapeHtml(txt).replace(/\n/g, "<br>") + '</div>';
      })
      .catch(function (err) {
        resEl.innerHTML = '<div class="ai-review-err"> AI 分析失败：' + escapeHtml(err.message) + '<br><br>排查： Key 是否正确； 账户是否有额度； 模型是否可访问； 浏览器能否访问该 API 域名（国内直连优先选硅基流动）。</div>';
      })
      .finally(function () { if (btn) btn.disabled = false; });
  };
  window.__rcjExamAiAuto = function () {
    if (window.__rcjExamAiAutoRan) return;
    var s = loadAsr();
    if (!(s.llm && s.llm.enabled && s.llm.key && s.llm.baseUrl && s.llm.model)) return;
    window.__rcjExamAiAutoRan = true;
    window.__rcjExamAiAnalyze();
  };
  // 点击「开始 AI 分析」按钮（事件委托，兼容结果区重渲染）
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "examAiAnalyzeBtn") { window.__rcjExamAiAutoRan = false; window.__rcjExamAiAnalyze(); }
  });
})();


---
name: "knowledge-card-swiper"
description: "知识卡片牌堆+瀑布流学习系统。实现Tinder式卡片滑动（左右上下手势）、双列瀑布流浏览、知识树SVG渲染、推荐引擎、本地存储状态管理。Invoke when building card-based learning UIs, swipeable knowledge decks, or 小红书-style feed layouts for exam prep / knowledge browsing."
---

# Knowledge Card Swiper · 知识卡片滑动学习系统

可复用的知识卡片交互系统模板。核心能力：**牌堆式滑动刷题** + **瀑布流浏览** + **知识树可视化**。

---

## 架构概览

```
learn/
├── index.html    # 三视图切换：牌堆 / 瀑布流 / 我的
├── learn.css     # 卡片样式、牌堆动画、瀑布流布局、4种卡型
├── learn.js      # 手势识别、推荐引擎、状态管理、渲染
└── cards.js      # 卡片数据（LEARN_CARDS 数组）
```

---

## 一、牌堆模式（核心交互）

### 手势定义

| 手势 | 行为 | 实现关键 |
|------|------|----------|
| 左滑 | 下一张（标记看过） | `act("seen", "left")` |
| 右滑 | 回到上一张 | `undo()` 从历史栈弹出 |
| 上滑/下滑 | 原生滚动卡片内容 | `touch-action: pan-y` |
| 到顶 + 下滑 | 收藏 | `scrollTop <= 1 && dy > 55` |

### 手势实现的三次迭代（关键教训）

**第一版（失败）**：JS 程序化滚动 `scrollBy({ behavior: 'smooth' })`，响应慢、不跟手。

**第二版（进步）**：改用 `touch-action: pan-y` 启用原生滚动，但 `pointerdown` 一上来就加 `.drag` 类（`will-change: transform`），浏览器不敢启动原生滚动。

**第三版（最终）**：延迟介入策略——`pointerdown` 只记录坐标，不加任何类。`pointermove` 里先判断方向，确认是横向（`dx > dy && dx > 8px`）才加 `.drag` 类和视觉反馈。纵向完全零干扰，浏览器原生滚动从一开始就丝滑接管。

```css
/* 关键 CSS */
#deck, #deck * { touch-action: none; }          /* 容器禁用浏览器手势 */
#deck .card.top { touch-action: pan-y; }         /* 顶层卡：原生纵向滚动 */
.card.top {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;             /* iOS 惯性滚动 */
}
```

```js
// 核心手势逻辑（延迟介入）
var isSwipe = false;
el.addEventListener("pointerdown", function (e) {
  sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
  dragging = true; isSwipe = false;
  // 不立即加 .drag，等确认横向后再介入
});

el.addEventListener("pointermove", function (e) {
  if (!dragging) return;
  dx = e.clientX - sx; dy = e.clientY - sy;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
    if (!isSwipe) {
      isSwipe = true;
      el.classList.add("drag");
    }
    el.style.transform = "translate(" + dx * 0.6 + "px,0) rotate(" + (dx * 0.02) + "deg)";
  }
  // 纵向：什么都不做，浏览器原生滚动
});

function end() {
  if (!dragging) return;
  if (isSwipe) { /* 清理 transform */ }
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 55) {
    if (dy > 0 && el.scrollTop <= 1) act("fav", "down");
  } else if (Math.abs(dx) > 55) {
    if (dx < 0) act("seen", "left");
    else undo();
  }
}
```

### 牌堆层级

```css
.card       { position: absolute; top: 0; left: 0; right: 0; }
.card.top   { position: relative; z-index: 5; }  /* 顶层撑开高度 */
.card.depth-1 { transform: translateY(-9px) scale(.975); opacity: .82; }
.card.depth-2 { transform: translateY(-18px) scale(.95); opacity: .6; }
```

顶层卡片 `position: relative` 撑开文档流，后层卡片 `position: absolute` 叠在后面。刷走一张后，depth-1 动画过渡为 top，depth-2 变为 depth-1，新卡补入 depth-2。

---

## 二、瀑布流模式（像小红书一样刷）

### 布局

```css
.feed-grid {
  column-count: 2;          /* 双列 CSS Columns 真瀑布流 */
  column-gap: 10px;
}
.feed-card {
  break-inside: avoid;       /* 卡片不被列分割 */
}
```

### 4 种卡型（数据驱动，概率 + 特征混合分配）

| 类型 | 占比 | 特征 | 视觉 |
|------|------|------|------|
| `poster` | 20% | 短 hook | 柔和彩色底 + 居中大字 |
| `rich` | 25% | tags ≥ 3 | 圆润大圆角 + 全标签 |
| `mis` | 30% | 有 misconception | "你以为…其实…"两段式 |
| `base` | 25% | 其余 | 标准白卡，~30% 走 tight 紧凑 |

卡型分配用 `id` hash 取模，保证同一张卡每次渲染卡型一致。

### 懒加载

```js
// IntersectionObserver 监视哨兵元素，触发分批追加
// 首批 12 张，后续每滚到底补 8 张
var feedObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) appendFeedBatch();
  });
}, { root: feedStage, rootMargin: "80px 0px", threshold: 0 });
```

### 筛选 chips

顶部三个 chip：全部 / 未看过 / 已收藏，带实时计数。切换筛选时取消旧 observer、重置渲染。

---

## 三、详情 Modal

瀑布流卡片点击  底部弹出详情面板，复用牌堆的 `renderCardHTML`，展示完整知识图谱 + 收藏按钮 + "在牌堆里刷" 跳转。

```css
#detailModal {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: flex-end;  /* 底部弹出 */
}
.detail-panel {
  max-height: 90vh; overflow-y: auto;
  border-radius: 18px 18px 0 0;          /* 顶部圆角 */
  animation: panelIn .28s;               /* 从下滑入 */
}
```

---

## 四、推荐引擎

```
70% 兴趣（related + tags邻近） + 20% 邻近 + 10% 随机探索
```

- `scoreCard(card, anchor)`：基于当前顶层卡（anchor）的 `related` 和 `tags` 打分
- 孤立卡（无人 related 指向）给基础加成，避免沉底
- 有 `misconception` 的卡小幅加成（反差卡更吸引人）
- 12% 随机探索，打破路径依赖

---

## 五、状态管理

```js
var state = {
  seen: {},        // 已看过的卡片 id
  favs: {},        // 已收藏的卡片 id
  skip: {},        // 跳过的卡片 id
  interest: {},    // 兴趣标签权重（tag  分值）
  history: []      // 操作历史栈（支持「回到上一题」）
};
// 存储：localStorage（零云成本），key = "rcj_learn_v1"
```

---

## 六、知识树 SVG

左右 DAG 分层布局，蛇形折行（每行最多 4 列，超出折到下一行反向排列）。

```js
function layout(nodes, edges) {
  // 1. 拓扑排序计算每层深度
  // 2. 分层分列，偶数行左右，奇数行右左（蛇形）
  // 3. 计算节点坐标，返回 SVG 的 viewBox 尺寸
}
```

---

## 七、复用指南

### 适配新题库（如辅警）

1. **数据层**：在 `cards.js` 中按 `LEARN_CARDS` 结构添加卡片数据
   ```js
   var LEARN_CARDS = [
     {
       id: "unique_id",
       hook: "吸引人的问题/标题？",
       tags: ["标签1", "标签2"],
       misconception: "你以为的…",        // 可选，有则触发 mis 卡型
       nodes: ["节点A", "节点B", "节点C"],  // 知识树节点
       edges: [["节点A","节点B"], ["节点B","节点C"]], // 有向边
       concept: "核心概念一句话总结",
       source: { type: "official", label: "来源" },
       related: ["other_card_id"],          // 关联卡片
       nodeLinks: { "节点A": "target_id" }  // 点击节点跳转
     }
   ];
   ```

2. **样式定制**：修改 `learn.css` 中的 CSS 变量
   ```css
   :root {
     --primary: #2563eb;       /* 主题色 */
     --bg: #f8fafc;           /* 背景 */
     --surface: #ffffff;       /* 卡片背景 */
   }
   ```

3. **手势调整**：修改 `learn.js` 中 `bindTop()` 的阈值（55px 为触发距离，8px 为横向判定）

4. **推荐调整**：修改 `scoreCard()` 中的权重参数

### 移动端适配要点

- `touch-action: pan-y` 是原生滚动的关键，不要用 JS 程序化滚动
- `-webkit-overflow-scrolling: touch` 保证 iOS Safari 惯性滚动
- `overscroll-behavior: contain` 防止整页下拉刷新
- 卡片 `max-height: calc(100vh - 220px)` 适配不同屏幕
- 底部栏用 `env(safe-area-inset-bottom)` 适配刘海屏

### 性能要点

- 瀑布流用 IntersectionObserver 懒加载，避免一次渲染全部 DOM
- CSS Columns 做真瀑布流（非 JS 计算位置），布局自然错落
- `break-inside: avoid` 防止卡片被列分割
- 牌堆只渲染 3 张卡，刷走一张才补一张
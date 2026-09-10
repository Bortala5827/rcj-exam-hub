/**
 * cards-generate.js — 通过 Cloudflare Worker 调用 Gemini 生成新知识卡片
 *
 * 用法：
 *   node scripts/cards-generate.js "地方政府的钱从哪来"
 *   node scripts/cards-generate.js --save "主题"     # 生成并保存到 data/generated/
 *   node scripts/cards-generate.js --file topics.txt  # 从文件批量生成
 *
 * 架构：
 *   本地脚本  Cloudflare Worker (exam.955827.xyz/api/gemini)  Google Gemini API
 *   Worker 使用系统提示词 + 联网搜索，生成 5 张卡片 + 3 个延伸话题
 */

const fs = require("fs");
const path = require("path");

// ── 参数解析 ──
const args = process.argv.slice(2);
const isSave = args.includes("--save");
const fileArg = args.find((a) => a.startsWith("--file="));
const topic = args.filter((a) => !a.startsWith("--")).join(" ").trim();

// ── Worker 地址 ──
const envPath = path.join(__dirname, "..", ".env");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^(\w+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
}
const WORKER_URL = env.GEMINI_WORKER || "https://exam.955827.xyz/api/gemini";

// ── 调用 Worker 生成卡片 ──
async function generate(topicName) {
  console.log(`\n 主题: "${topicName}"`);
  console.log(` 调用 Gemini（联网搜索中）...`);

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: topicName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Worker ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ── 格式化输出 ──
function printResult(data, topicName) {
  console.log("\n" + "=".repeat(60));
  console.log(` 主题: ${topicName}`);
  console.log("=".repeat(60));

  if (data.cards && data.cards.length) {
    console.log(`\n 知识牌堆 (${data.cards.length} 张)：`);
    data.cards.forEach((card, i) => {
      console.log(`\n  ┌─ 卡片 ${i + 1}: ${card.title}`);
      console.log(`  │${card.content.replace(/\n/g, "\n  │")}`);
    });
  }

  if (data.extended_topics && data.extended_topics.length) {
    console.log(`\n 延伸话题 (${data.extended_topics.length} 个)：`);
    data.extended_topics.forEach((t, i) => {
      console.log(`\n  ${i + 1}. [${t.tag}] ${t.title}`);
      console.log(`      ${t.summary}`);
      console.log(`      下次: ${t.next_prompt}`);
    });
  }

  console.log("\n" + "=".repeat(60));
}

// ── 保存结果 ──
function saveResult(data, topicName) {
  const dir = path.join(__dirname, "..", "data", "generated");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeName = topicName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = path.join(dir, `${ts}_${safeName}.json`);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\n 已保存: ${filePath}`);

  // 同时追加到延伸话题池
  if (data.extended_topics && data.extended_topics.length) {
    const poolPath = path.join(dir, "_topic_pool.json");
    let pool = [];
    if (fs.existsSync(poolPath)) {
      try { pool = JSON.parse(fs.readFileSync(poolPath, "utf-8")); } catch (e) {}
    }
    data.extended_topics.forEach((t) => {
      pool.push({ topic: t.next_prompt, tag: t.tag, title: t.title, summary: t.summary, generated_at: ts });
    });
    fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2), "utf-8");
    console.log(` 延伸话题已追加到话题池 (${pool.length} 个待探索)`);
  }
}

// ── 主流程 ──
async function main() {
  let topics = [];

  if (fileArg) {
    const filePath = path.resolve(fileArg);
    if (!fs.existsSync(filePath)) {
      console.error(` 文件不存在: ${filePath}`);
      process.exit(1);
    }
    topics = fs.readFileSync(filePath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    console.log(` 从文件读取 ${topics.length} 个主题`);
  } else if (topic) {
    topics = [topic];
  } else {
    console.log("用法:");
    console.log("  node scripts/cards-generate.js \"主题名称\"");
    console.log("  node scripts/cards-generate.js --save \"主题名称\"");
    console.log("  node scripts/cards-generate.js --file=topics.txt");
    process.exit(0);
  }

  let success = 0;
  let failed = [];

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    try {
      console.log(`\n[${i + 1}/${topics.length}]`);
      const data = await generate(t);
      printResult(data, t);
      if (isSave) saveResult(data, t);
      success++;

      if (i < topics.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(` "${t}" 失败: ${err.message}`);
      failed.push(t);
    }
  }

  console.log(`\n 完成: ${success} 成功, ${failed.length} 失败`);
  if (failed.length > 0) {
    console.log(`  失败主题: ${failed.join(", ")}`);
  }

  if (isSave && success > 0) {
    console.log(`\n 提示: 生成的结果已保存到 data/generated/`);
    console.log(`   延伸话题池在 data/generated/_topic_pool.json`);
    console.log(`   可以继续运行: node scripts/cards-generate.js --file=data/generated/_topic_pool.json`);
  }
}

main().catch((err) => {
  console.error(" 脚本异常:", err);
  process.exit(1);
});
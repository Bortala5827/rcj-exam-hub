/**
 * enrich-cards.js — 通过 Cloudflare Worker 反代调用 Gemini 批量扩充知识卡片
 *
 * 用法：
 *   node scripts/enrich-cards.js              # 全量处理所有卡片
 *   node scripts/enrich-cards.js --dry-run    # 预览，不写回
 *   node scripts/enrich-cards.js --ids kaogong,bianzhi  # 只处理指定卡片
 *   node scripts/enrich-cards.js --fact-only  # 只补 fact，不改 concept
 *
 * 架构：
 *   本地脚本  Cloudflare Worker (exam.955827.xyz/api/gemini)  Google Gemini API
 *   国内无需代理，CF 边缘节点在海外直连 Google 安全完成
 *
 * 前提：
 *   Cloudflare 后台 Settings  Variables 已设置 GEMINI_API_KEY（加密存储）
 *   functions/api/gemini.js 已部署
 *
 * 安全：
 *   - API key 存 CF 加密变量，不落代码仓库
 *   - 每张卡调用前等 1.5s，避免触发免费限额
 *   - 写出前备份 learn/cards.js  learn/cards.bak.js
 */

const fs = require("fs");
const path = require("path");

// ── 参数解析 ──
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const factOnly = args.includes("--fact-only");
const idsArg = args.find((a) => a.startsWith("--ids="));
const targetIds = idsArg ? idsArg.replace("--ids=", "").split(",").map((s) => s.trim()) : null;

// ── 读取 .env（可选，用于自定义 Worker 地址）──
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
console.log(` Worker: ${WORKER_URL}`);

// ── 读取 cards.js ──
const cardsPath = path.join(__dirname, "..", "learn", "cards.js");
let cardsSrc = fs.readFileSync(cardsPath, "utf-8");

// 提取 DATA 数组：匹配 var DATA = [...];
const dataMatch = cardsSrc.match(/var\s+DATA\s*=\s*(\[[\s\S]*?\n\]);/);
if (!dataMatch) {
  console.error(" 无法从 cards.js 中提取 DATA 数组");
  process.exit(1);
}

let cards;
try {
  cards = eval(dataMatch[1]);
} catch (e) {
  console.error(" DATA 解析失败:", e.message);
  process.exit(1);
}

const byId = {};
cards.forEach((c) => (byId[c.id] = c));

// ── 过滤要处理的卡片 ──
let todo = cards;
if (targetIds) {
  todo = cards.filter((c) => targetIds.includes(c.id));
  if (todo.length === 0) {
    console.error(" --ids 指定的卡片 ID 不存在");
    process.exit(1);
  }
}
console.log(` 待处理: ${todo.length} 张卡片 (共 ${cards.length} 张)`);
if (isDryRun) console.log("  预览模式，不实际写回文件");

// ── 通过 CF Worker 调用 Gemini ──
async function gemini(promptText) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Worker ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.text) return data.text;
  if (data.error) throw new Error(data.error);
  throw new Error("Worker 返回格式异常");
}

// ── 构建 prompt ──
function buildPrompt(card) {
  const existing = card.fact ? `已有数据：${card.fact}` : "暂无数据";
  const hasConcept = card.concept && card.concept.length > 60;

  return `你是一个知识百科助手，帮助丰富中国社会/经济/制度类知识卡片的内容。

当前卡片的主题是："${card.hook}"
核心概念：${card.concept || "无"}
已有事实数据：${existing}
标签：${(card.tags || []).join("、")}
知识树节点：${(card.nodes || []).join("  ")}

请用中文简洁回答（50字以内）：
${factOnly || hasConcept
    ? "仅补充一个具体的事实数据点（fact），包含数字或年份，格式如：2023年城镇非私营单位年均工资约12.1万"
    : "1) 补充一个具体的事实数据点（fact），包含数字或年份\n2) 扩展概念解释（concept），用一句话说透本质，让读者有「原来如此」的感觉\n\n输出格式：\nfact: ...\nconcept: ..."}`;
}

// ── JS 字面量序列化（保持 cards.js 原有格式：无引号 key、正常缩进）──
function toJSLiteral(val, indent) {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);
  if (val === null) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const items = val.map((v) => `${pad1}${toJSLiteral(v, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => `${pad1}${k}: ${toJSLiteral(v, indent + 1)}`);
    return `{\n${lines.join(",\n")}\n${pad}}`;
  }
  return String(val);
}

// ── 主流程 ──
async function main() {
  let updated = 0;
  let failed = [];

  for (let i = 0; i < todo.length; i++) {
    const card = todo[i];
    const label = `[${i + 1}/${todo.length}] ${card.id} 「${card.hook}」`;

    // 跳过已有充足 fact 的卡片（除非 factOnly 模式强制覆盖）
    if (factOnly && card.fact && card.fact.length > 20) {
      console.log(`  ${label} — 已有 fact，跳过`);
      continue;
    }

    try {
      console.log(` ${label}`);
      const prompt = buildPrompt(card);
      const result = await gemini(prompt);

      // 解析结果
      const factMatch = result.match(/fact:\s*(.+)/i);
      const conceptMatch = result.match(/concept:\s*(.+)/i);

      if (factMatch) {
        card.fact = factMatch[1].trim();
        console.log(`    fact: ${card.fact.slice(0, 60)}...`);
      }
      if (conceptMatch && !factOnly) {
        card.concept = conceptMatch[1].trim();
        console.log(`    concept: ${card.concept.slice(0, 60)}...`);
      }
      if (!factMatch && !conceptMatch) {
        console.log(`     API 返回格式无法解析，跳过: ${result.slice(0, 80)}`);
      }
      updated++;

      // 速率限制：免费层 15 RPM，保守 1.5s/张
      if (i < todo.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`    失败: ${err.message}`);
      failed.push(card.id);
    }
  }

  // ── 写回 ──
  if (!isDryRun && updated > 0) {
    const bakPath = cardsPath.replace(".js", ".bak.js");
    fs.writeFileSync(bakPath, cardsSrc, "utf-8");
    console.log(`\n 已备份: ${bakPath}`);

    const newData = toJSLiteral(cards, 0);
    const newSrc = cardsSrc.replace(dataMatch[1], newData);
    fs.writeFileSync(cardsPath, newSrc, "utf-8");
    console.log(` 已写入 learn/cards.js (${updated} 张卡片更新)`);
  }

  if (failed.length > 0) {
    console.log(`\n  失败卡片: ${failed.join(", ")}`);
  }

  console.log(`\n 完成: ${updated} 张更新, ${failed.length} 张失败`);
  if (isDryRun) console.log("  预览模式，未实际写回文件");
}

main().catch((err) => {
  console.error(" 脚本异常:", err);
  process.exit(1);
});
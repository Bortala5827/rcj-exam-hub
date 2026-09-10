/* 国内 AI 渠道统一反代（Cloudflare Pages Function）
 * 路由: POST /api/gemini（路由名保留，内容已全量改为国内渠道）
 *
 * 支持模式:
 *   POST { topic: "主题" }                  生成知识卡片（国内渠道，自动降级）
 *   POST { prompt: "指令" }                  通用调用（国内渠道，自动降级）
 *   POST { mode: "relate", ... }            AI 关联发散（可切换 dots/agnes/商汤/b.ai/custom）
 *   POST { mode: "relate_follow", ... }     关联追问
 *   POST { mode: "relate_probe", ... }      custom 源连通性探针
 *
 * 环境变量（CF 后台 Settings  Variables）:
 *   DOTS_API_KEY          小红书 dots3 key（鉴权头 api-key）
 *   AGNES_API_KEY         Agnes key（Bearer 鉴权）
 *   SENSENOVA_API_KEY     SenseNova key（Bearer 鉴权）
 *   BAI_API_KEY           b.ai key（Bearer 鉴权）
 *   以上均可用 *_MODEL / *_BASE 覆盖默认值
 *   AI_PROVIDER           relate 模式默认源：dots（默认）| agnes | sensenova | bai | custom
 *
 * 统一国内渠道：dots / agnes / SenseNova / b.ai / custom（已删 Gemini、Groq）
 */

// 统一国内渠道：dots / agnes / SenseNova / b.ai / custom（已删 Gemini、Groq）
// 可在 CF 后台 Settings  Variables 用 *_MODEL / *_BASE / *_API_KEY 覆盖。
const BAI_BASE = "https://api.b.ai/v1";
const DOTS_BASE = "https://note3-prev-api.askdiandian.com/v1";
const AGNES_BASE = "https://apihub.agnes-ai.com/v1";
const SENSENOVA_BASE = "https://token.sensenova.cn/v1";

const CARD_SYSTEM = `你是一个极具洞察力的政治、社会、商业、科技、历史专家与资深面试官。你的任务是根据用户提供的核心主题，将其拆解并扩展为一套可供"刷卡式学习"的"知识牌堆（Knowledge Cards）"以及相关的"延伸话题（Extended Topics）"。

# Output Format Constraints
你必须严格输出合法的 JSON 格式数据，不能包含任何 Markdown 标记（如 json 等），不能包含首尾空格、解释性文字。

# Rules for Content Generation
1. 知识牌堆（cards）：
   - 每次固定生成 5 张内容紧凑的知识卡。
   - 每张卡片的 title 必须控制在 12 个字以内，必须具有极强的吸引力。
   - 每张卡片的 content 必须精简且信息密度极高，采用 Markdown 的无序列表（- ）形式展示核心事实。文字要直白、易懂、短句为主，严禁废话。
2. 延伸话题（extended_topics）：
   - 固定生成 3 个延伸话题。
   - 必须提供明确的 tag 分类，如：[人物交集]、[商业内幕]、[底层逻辑]、[面试真题]。
   - summary 必须是一句引人入胜的导语，引导用户去点击并展开下一组牌堆。
   - next_prompt 是为下一次 API 调用准备的精确提示词。

# Required JSON Schema
{
  "cards": [
    {
      "id": 1,
      "title": "卡片1标题",
      "content": "- 核心观点或事实1\\n- 核心观点或事实2\\n- 核心观点或事实3"
    }
  ],
  "extended_topics": [
    {
      "title": "延伸话题标题",
      "tag": "人物交集",
      "summary": "一句能激发好奇心的简短导语。",
      "next_prompt": "下一次生成新牌堆的精确提示词"
    }
  ]
}`;

// 通用国内渠道调用（topic/prompt 模式用，自动降级 dotsagnessensenovabai）
async function callDomestic(messages, env, opts) {
  const channels = [
    { id: "dots", base: env.DOTS_BASE || DOTS_BASE, model: env.DOTS_MODEL || "dots3-note-prev", key: env.DOTS_API_KEY, auth: "api-key" },
    { id: "agnes", base: env.AGNES_BASE || AGNES_BASE, model: env.AGNES_MODEL || "agnes-2.5-flash", key: env.AGNES_API_KEY, auth: "bearer" },
    { id: "sensenova", base: env.SENSENOVA_BASE || SENSENOVA_BASE, model: env.SENSENOVA_MODEL || "sensenova-6.8-flash-lite", key: env.SENSENOVA_API_KEY, auth: "bearer" },
    { id: "bai", base: env.BAI_BASE || BAI_BASE, model: env.BAI_MODEL || "deepseek-v4-flash", key: env.BAI_API_KEY, auth: "bearer" },
    { id: "groq", base: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", key: env.GROQ_API_KEY, auth: "bearer" },
  ];
  let lastError = null;
  for (const ch of channels) {
    if (!ch.key) continue;
    try {
      const headers = { "Content-Type": "application/json" };
      if (ch.auth === "api-key") headers["api-key"] = ch.key;
      else headers["Authorization"] = `Bearer ${ch.key}`;
      const payload = { model: ch.model, messages, temperature: (opts && opts.temp) || 0.7, stream: false };
      const res = await fetch(`${ch.base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) { lastError = `${ch.id} HTTP ${res.status}`; continue; }
      const data = await res.json();
      const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
      if (!text) { lastError = `${ch.id} 返回空`; continue; }
      return { text, provider: ch.id };
    } catch (err) { lastError = `${ch.id}: ${err.message}`; continue; }
  }
  return { error: lastError || "所有国内渠道均不可用或未配置 API Key" };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
    const startedAt = Date.now();
  const trackAI = (provider, status, scene) => {
    try {
      if (context.waitUntil) {
        context.waitUntil(fetch("https://955827.xyz/api/ai-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: "learn", scene: scene || "", provider: provider || "", status, latency_ms: Date.now() - startedAt }),
        }).catch(() => {}));
      }
    } catch (e) {}
  };

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "请求体必须为 JSON" }, 400);
  }

  const { topic, prompt } = body;

  // ===== 连通性探针：仅 custom 源用，验证用户自己的接口能否通 =====
  if (body.mode === "relate_probe") {
    return await handleRelateProbe(body, env);
  }

  // ===== relate 模式：多源可切换 + 自动降级 =====
  if (body.mode === "relate" || body.mode === "relate_follow") {
    // 默认源：统一 dots（国内渠道，海外用户也走国内反代）
    const defaultProvider = (env.AI_PROVIDER || "dots").toLowerCase();

    // 请求级覆盖
    const override = (body.provider || (context.request && new URL(context.request.url).searchParams.get("provider")) || "").toLowerCase();
    let preferred = defaultProvider;
    if (override) {
      const norm = override === "deepseek" ? "sensenova" : override;
      if (["dots", "agnes", "sensenova", "bai", "groq", "custom"].includes(norm)) preferred = norm;
    }

    // custom 源不自动降级（用户自己的接口，失败直接报错）
    if (preferred === "custom") {
      return await handleRelateCustom(body, env);
    }

    // 自动降级顺序：dotsagnessensenovabai（统一国内渠道）
    const fallbackOrder = ["dots", "agnes", "sensenova", "bai", "groq"];
    const tryOrder = [preferred, ...fallbackOrder.filter(p => p !== preferred)];

    const handlers = { dots: handleRelateDots, agnes: handleRelateAgnes, sensenova: handleRelateSensenova, bai: handleRelateBai, groq: handleRelateGroq };
    let lastError = null;
    for (const p of tryOrder) {
      try {
        const result = await handlers[p](body, env);
        // 检查返回是否为错误响应（status >= 400）
        if (result && result.status && result.status >= 400) {
          lastError = `${p} HTTP ${result.status}`;
          continue;
        }
        // 成功：如果发生了降级，在响应里标注
        if (p !== preferred) {
          try {
            const data = await result.json();
            data.fallbackFrom = preferred;
            data.fallbackTo = p;
            trackAI(p, "ok", body.mode);
            return json(data, 200);
          } catch (e) {
            return result; // 非 JSON 响应直接返回
          }
        }
        return result;
      } catch (err) {
        lastError = `${p}: ${err.message}`;
        continue;
      }
    }
    trackAI(preferred, "fail", body.mode);
    return json({ error: `所有 AI 源均不可用（${lastError}），请稍后重试` }, 502);
  }

  // ===== 非 relate 模式：走国内渠道（topic 生成知识卡 / prompt 通用调用）=====
  if (topic) {
    const messages = [
      { role: "system", content: CARD_SYSTEM },
      { role: "user", content: topic },
    ];
    const r = await callDomestic(messages, env, { temp: 0.2 });
    if (r.error) { trackAI("domestic", "fail", "topic"); return json({ error: r.error }, 502); }
    trackAI(r.provider, "ok", "topic");
    return new Response(r.text, {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } else if (prompt) {
    const messages = [{ role: "user", content: prompt }];
    const r = await callDomestic(messages, env, { temp: 0.7 });
    if (r.error) { trackAI("domestic", "fail", "prompt"); return json({ error: r.error }, 502); }
    trackAI(r.provider, "ok", "prompt");
    return json({ text: r.text });
  } else {
    return json({ error: "请提供 topic 或 prompt 字段" }, 400);
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const hasKey = !!(env.DOTS_API_KEY || env.AGNES_API_KEY || env.SENSENOVA_API_KEY || env.BAI_API_KEY);
  return json({
    status: "ok",
    message: "国内 AI 渠道反代已就绪（dots/agnes/商汤/b.ai），请使用 POST 请求",
    key_configured: hasKey,
    modes: hasKey ? ["topic (生成卡片)", "prompt (通用调用)", "mode=relate (AI 关联)"] : ["未配置 API Key，请先在 CF 后台设置 DOTS/AGNES/SENSENOVA/BAI_API_KEY"],
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

// ===== relate 模式解析：优先 JSON 数组，失败则整段当作纯文本讲解 =====
// 期望结构：
//   { "relations": [{type, text}...], "followups": [{id, text}...] }
// followups 为引导式提问，前端渲染为可点击气泡，点了发起 relate_follow 追问。
function parseRelate(rawText) {
  if (!rawText) return { relations: [], raw: "", followups: [] };
  const trimmed = rawText.trim();
  let obj = null;
  try {
    obj = JSON.parse(trimmed);
  } catch (e) {
    // 退化：在文本中查找第一个 { 到最后一个 } 的对象片段（兼容模型包了 markdown）
    const s = trimmed.search(/\{/);
    const end = trimmed.lastIndexOf("}");
    if (s >= 0 && end > s) {
      try { obj = JSON.parse(trimmed.slice(s, end + 1)); } catch (e2) {}
    }
  }
  if (obj && typeof obj === "object") {
    let relations = [];
    let followups = [];
    // 兼容两种形态：整体对象带 relations/followups，或纯数组
    if (Array.isArray(obj)) {
      relations = obj;
    } else {
      if (Array.isArray(obj.relations)) relations = obj.relations;
      if (Array.isArray(obj.followups)) followups = obj.followups;
    }
    const relOut = relations
      .filter(function (x) { return x && (x.text || x.content); })
      .map(function (x) {
        return { type: x.type || "关联", text: String(x.text || x.content || "").trim() };
      })
      .slice(0, 8);
    const folOut = followups
      .filter(function (x) { return x && (x.text || x.question); })
      .map(function (x, i) {
        return { id: String(x.id || ("q" + (i + 1))), text: String(x.text || x.question || "").trim() };
      })
      .slice(0, 5);
    if (relOut.length || folOut.length) {
      return { relations: relOut, raw: "", followups: folOut };
    }
    // 对象里可能有 raw 纯文本讲解
    if (obj.raw) return { relations: [], raw: String(obj.raw).trim(), followups: [] };
  }
  // 纯文本形式（引导式提问 / 关联讲解）：整段返回，前端按段落渲染
  return { relations: [], raw: trimmed, followups: [] };
}

// ===== relate 提示词（所有源共用）：要求同时返回关联点 + 引导式提问 =====
function buildRelateMessages(hook, concept, nodes) {
  const relatePrompt = `你是一个"知识拓展助手"。用户正在刷一张知识卡，话题如下：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

请围绕这个话题，生成"拓展内容"——帮用户把当前话题连接到更多现象、案例、概念、角度和反常识，让理解既有深度又有广度、不枯燥。

必须严格只输出一个 JSON 对象（不要 markdown 标记、不要解释文字），结构如下：
{
  "relations": [
    { "type": "现象", "text": "..." },
    { "type": "案例", "text": "..." },
    { "type": "概念", "text": "..." },
    { "type": "角度", "text": "..." },
    { "type": "反常识", "text": "..." }
  ],
  "followups": [
    { "id": "q1", "text": "一个能让人当场思考/展开的问题" },
    { "id": "q2", "text": "另一个引导式提问" }
  ]
}

要求：
1. relations 3-5 条，type 从 [现象, 案例, 概念, 角度, 反常识] 中选，text 1-2 句、直白有信息量，必须和当前话题真有关联（延伸/对照/因果/现实映射）。不要空话、不要重复主问题。
2. followups 2-3 个引导式提问——这些是"钩子"，让用户点击后继续深入。提问要具体、能引发真实思考。
3. 语言要口语化、有趣，像朋友聊天一样拓展知识，不要像老师讲课。`;
  const systemMsg = "你是知识拓展助手，输出简洁、有信息量、有趣、能当谈资。中文回复。";
  return [
    { role: "system", content: systemMsg },
    { role: "user", content: relatePrompt },
  ];
}

// ===== relate_follow 提示词：针对用户点选的某个引导提问，深入展开 =====
function buildFollowMessages(hook, concept, nodes, question) {
  const followPrompt = `你是一个"知识拓展助手"。用户正在刷一张知识卡：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

用户刚刚点选了一个引导问题，希望你围绕它深入展开，帮他把这个点讲透、讲生动：
【用户选的问题】${question}

请生成针对这个问题的"深入拓展内容"——可以是一段讲解、几个支撑案例/角度、或进一步的小追问。必须严格只输出一个 JSON 对象（不要 markdown 标记、不要解释文字）：
{
  "relations": [
    { "type": "讲解", "text": "..." },
    { "type": "案例", "text": "..." },
    { "type": "角度", "text": "..." }
  ],
  "followups": [
    { "id": "q1", "text": "基于上面展开，可以再追问的一个问题" }
  ]
}

要求：
1. relations 2-4 条，直接回应那个问题，text 要具体、能当谈资，不要泛泛而谈。
2. followups 1-2 个，基于这次展开继续引导用户往下挖（可空数组表示到这里收住）。
3. 语言口语化、有趣，像朋友聊天一样拓展知识。
4. 若 relations 更适合用纯文本讲解，也可返回 { "raw": "一段讲解...", "followups": [...] }。`;
  const systemMsg = "你是知识拓展助手，输出简洁、有信息量、有趣、能当谈资。中文回复。";
  return [
    { role: "system", content: systemMsg },
    { role: "user", content: followPrompt },
  ];
}

// ===== relate 模式：b.ai 源（OpenAI 兼容 chat/completions，免费模型强制 stream=true）=====
async function handleRelateBai(body, env) {
  const API_KEY = env.BAI_API_KEY;
  if (!API_KEY) {
    return json({ error: "BAI_API_KEY 未配置（AI_PROVIDER=bai 时需要）" }, 500);
  }
  const BAI_MODEL = env.BAI_MODEL || "deepseek-v4-flash";
  const BASE = env.BAI_BASE || BAI_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = {
    model: BAI_MODEL,
    messages: messages,
    temperature: 0.7,
    stream: true,
  };
  try {
    const url = `${BASE}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `b.ai API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    // 流式读取 SSE，聚合 delta.content（丢弃 reasoning_content 思维链）
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && typeof delta.content === "string") content += delta.content;
        } catch (e3) {}
      }
    }
    const rawText = content.trim();
    if (!rawText) {
      return json({ error: "b.ai 返回空内容（免费模型可能限流，稍后重试或换 BAI_MODEL）" }, 502);
    }
    const parsed = parseRelate(rawText);
    // b.ai 免费模型不支持 grounding，来源恒为空
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "bai" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：agnes 源（OpenAI 兼容 chat/completions，默认 agnes-2.5-flash）=====
async function handleRelateAgnes(body, env) {
  const API_KEY = env.AGNES_API_KEY;
  if (!API_KEY) {
    return json({ error: "AGNES_API_KEY 未配置（AI_PROVIDER=agnes 时需要）" }, 500);
  }
  const MODEL = env.AGNES_MODEL || "agnes-2.5-flash";
  const BASE = env.AGNES_BASE || AGNES_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = { model: MODEL, messages, temperature: 0.7, stream: false };
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `agnes API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!rawText) return json({ error: "agnes 返回空内容" }, 502);
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "agnes" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：Groq源（OpenAI兼容 chat/completions，默认 openai/gpt-oss-120b，CF边缘节点代理国内访问）=====
async function handleRelateGroq(body, env) {
  const API_KEY = env.GROQ_API_KEY;
  if (!API_KEY) {
    return json({ error: "GROQ_API_KEY 未配置（AI_PROVIDER=groq 时需要）" }, 500);
  }
  const MODEL = env.GROQ_MODEL || "openai/gpt-oss-120b";
  const BASE = env.GROQ_BASE || "https://api.groq.com/openai/v1";
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = { model: MODEL, messages, temperature: 0.7, stream: false };
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `groq API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!rawText) return json({ error: "groq 返回空内容（可能限流或推理模型思维链占满token，稍后重试或换源）" }, 502);
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "groq" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：SenseNova源（OpenAI 兼容 chat/completions，默认 sensenova-6.8-flash-lite）=====
async function handleRelateSensenova(body, env) {
  const API_KEY = env.SENSENOVA_API_KEY;
  if (!API_KEY) {
    return json({ error: "SENSENOVA_API_KEY 未配置（AI_PROVIDER=sensenova 时需要）" }, 500);
  }
  const MODEL = env.SENSENOVA_MODEL || "sensenova-6.8-flash-lite";
  const BASE = env.SENSENOVA_BASE || SENSENOVA_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = { model: MODEL, messages, temperature: 0.7, stream: false };
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `SenseNova API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!rawText) return json({ error: "SenseNova 返回空内容" }, 502);
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "sensenova" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：dots3 源（小红书自研，OpenAI 兼容 chat/completions，鉴权头为 api-key 而非 Bearer）=====
async function handleRelateDots(body, env) {
  const API_KEY = env.DOTS_API_KEY;
  if (!API_KEY) {
    return json({ error: "DOTS_API_KEY 未配置（AI_PROVIDER=dots 时需要）" }, 500);
  }
  const DOTS_MODEL = env.DOTS_MODEL || "dots3-note-prev";
  const BASE = env.DOTS_BASE || DOTS_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = {
    model: DOTS_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  };
  try {
    const url = `${BASE}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `dots3 API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!rawText) {
      return json({ error: "dots3 返回空内容（可能限流，稍后重试或换源）" }, 502);
    }
    const parsed = parseRelate(rawText);
    // dots3 无 grounding，来源恒为空
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "dots" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：custom 源（用户在前端填自己的 OpenAI 兼容接口，透传 key/base/model）=====
// 安全边界：
//   - 仅允许 https 开头的 baseUrl，且必须是合法 URL，防 SSRF/内网探测；
//   - apiKey 仅用于本次请求，不落库、不回显；
//   - 走 OpenAI 兼容 /chat/completions，Bearer 鉴权；支持流式聚合。
async function handleRelateCustom(body, env) {
  const custom = body.custom || {};
  const BASE = (custom.baseUrl || "").trim();
  const MODEL = (custom.model || "").trim();
  const API_KEY = (custom.apiKey || "").trim();
  if (!BASE || !MODEL || !API_KEY) {
    return json({ error: "自定义模型需要接口地址、模型名、API Key 三项齐全" }, 400);
  }
  // SSRF 防护：仅 https，且解析后 host 不能是内网地址
  let parsedUrl;
  try {
    parsedUrl = new URL(BASE);
    if (parsedUrl.protocol !== "https:") {
      return json({ error: "接口地址仅支持 https" }, 400);
    }
    const host = parsedUrl.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") || host.startsWith("172.19.") || host.startsWith("172.2") || host.startsWith("172.3") || host.endsWith(".internal") || host.endsWith(".local")) {
      return json({ error: "接口地址不允许指向本地或内网" }, 400);
    }
  } catch (e) {
    return json({ error: "接口地址格式不正确" }, 400);
  }
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  // 拼接 chat/completions URL：若用户已填完整端点（含 /chat/completions）则不再拼，避免双倍拼接  404
  let url;
  const baseClean = BASE.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(baseClean)) {
    url = baseClean;
  } else {
    url = `${baseClean}/chat/completions`;
  }
  const payload = {
    model: MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `自定义接口 ${res.status} @ ${url}: ${errText.slice(0, 300)}` }, res.status);
    }
    // 兼容流式与非流式：流式按 SSE 聚合；非流式直接取 message.content
    const ct = res.headers.get("content-type") || "";
    let rawText = "";
    if (res.body && ct.indexOf("text/event-stream") >= 0) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
            if (delta && typeof delta.content === "string") rawText += delta.content;
          } catch (e3) {}
        }
      }
    } else {
      const data = await res.json();
      rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    }
    if (!rawText) {
      return json({ error: "自定义接口返回空内容（检查模型名/Key，或该接口不支持流式）" }, 502);
    }
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "custom" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== 连通性探针：自定义源专属，发送最小请求验证接口/模型/Key 是否能通 =====
// 不发真实关联（max_tokens 极小、stream:false），仅回显实际请求 URL + 模型 Echo，便于前端排错。
async function handleRelateProbe(body, env) {
  const custom = body.custom || {};
  const BASE = (custom.baseUrl || "").trim();
  const MODEL = (custom.model || "").trim();
  const API_KEY = (custom.apiKey || "").trim();
  if (!BASE || !MODEL || !API_KEY) {
    return json({ ok: false, error: "接口地址、模型名、API Key 三项齐全才能测试" }, 400);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(BASE);
    if (parsedUrl.protocol !== "https:") {
      return json({ ok: false, error: "接口地址仅支持 https", url: BASE }, 400);
    }
    const host = parsedUrl.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") || host.startsWith("172.19.") || host.startsWith("172.2") || host.startsWith("172.3") || host.endsWith(".internal") || host.endsWith(".local")) {
      return json({ ok: false, error: "接口地址不允许指向本地或内网", url: BASE }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: "接口地址格式不正确", url: BASE }, 400);
  }
  // 与 handleRelateCustom 保持一致的 URL 拼接规则
  let url;
  const baseClean = BASE.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(baseClean)) {
    url = baseClean;
  } else {
    url = `${baseClean}/chat/completions`;
  }
  try {
    const probePayload = {
      model: MODEL,
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
      max_tokens: 5,
      stream: false,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(probePayload),
    });
    const status = res.status;
    const text = await res.text();
    if (!res.ok) {
      return json({ ok: false, error: `HTTP ${status}: ${text.slice(0, 300)}`, url: url, model: MODEL }, status);
    }
    // 成功：尝试解析模型回显（部分接口返回 model 字段）
    let echoModel = MODEL;
    try {
      const d = JSON.parse(text);
      if (d.model) echoModel = d.model;
    } catch (e2) {}
    return json({ ok: true, url: url, model: echoModel, sample: text.slice(0, 120) });
  } catch (err) {
    return json({ ok: false, error: err.message, url: url, model: MODEL }, 500);
  }
}

// ===== relate 模式：openrouter 源已移除（OX 不可用，2026-08-22）=====
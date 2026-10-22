/* 陪练留言墙 / 约练 API（Cloudflare Pages Functions + D1）
 * GET  /api/wall?city=sz        -> 返回该城市留言墙列表（最新在前）
 * POST /api/wall                -> 发帖 / 响应约练
 *   body.action 缺省或 "post"   -> 追加一条（留言 msg 或 约练 meet）
 *   body.action = "respond"     -> 对某条约练帖响应「我想一起」（按匿名 uid 去重计数）
 * DELETE /api/wall              -> 删除（管理员口令）
 * 存储：D1 表 wall（绑定名 DB），key 维度改用 city 列。
 * 未绑定 D1 时返回 503 {ok:false,error:"DB_NOT_BOUND"}，前端展示降级提示。
 */
const MAX_ITEMS = 200;
const CITIES = ["sz", "hz", "gd", "ms", "cd", "wh"];
const RATE_LIMIT_SEC = 60;
const DAILY_IP_LIMIT = 20;
const SENSITIVE = ["赌博", "色情", "代考", "炸药", "炸弹", "毒品", "诈骗", "办证", "招嫖", "代刷", "枪"];

function dayLeftSec() {
  var end = new Date(new Date().toISOString().slice(0, 10) + "T23:59:59Z").getTime();
  return Math.max(Math.ceil((end - Date.now()) / 1000), 60);
}
function sanitize(s, max) {
  s = (s || "").toString().trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
function cityOf(raw) {
  var c = sanitize(raw, 10).toLowerCase();
  return CITIES.indexOf(c) >= 0 ? c : "sz";
}
function hasSensitive(s) {
  s = (s || "").toLowerCase();
  for (var i = 0; i < SENSITIVE.length; i++) {
    if (s.indexOf(SENSITIVE[i]) >= 0) return SENSITIVE[i];
  }
  return null;
}
function safeParse(s, def) {
  try { var o = JSON.parse(s); return Array.isArray(o) ? o : def; } catch (e) { return def; }
}
function getDB(env) {
  if (env && env.DB) return env.DB;
  if (env) {
    for (const k of Object.keys(env)) {
      const v = env[k];
      if (v && typeof v.prepare === "function" && typeof v.exec === "function") return v;
    }
  }
  return null;
}
function rowToItem(r) {
  return {
    id: r.id, name: r.name, type: r.type, text: r.text,
    meetAt: r.meet_at, meetAtISO: r.meet_at_iso, direction: r.direction, contact: r.contact,
    resp: r.resp || 0, respUsers: safeParse(r.resp_users, []), createdAt: r.created_at,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const city = cityOf(url.searchParams.get("city"));
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND", items: [] }, 503);
  try {
    const { results } = await db.prepare(
      "SELECT * FROM wall WHERE city=? ORDER BY created_at DESC LIMIT ?"
    ).bind(city, MAX_ITEMS).all();
    return json({ ok: true, city: city, items: (results || []).map(rowToItem) });
  } catch (e) {
    return json({ ok: false, error: "DB_ERR", items: [] }, 500);
  }
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, error: "BAD_JSON" }, 400); }
  if (body && body.action === "respond") return doRespond(context, body);
  return doPost(context, body);
}

async function doPost(context, body) {
  const city = cityOf(body.city);
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);

  const ip = context.request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const rl = await db.prepare("SELECT last_ts FROM wall_rl WHERE ip=?").bind(ip).all();
    if (rl.results.length) {
      const last = rl.results[0].last_ts;
      if (now - Number(last) < RATE_LIMIT_SEC * 1000) {
        const left = Math.ceil((RATE_LIMIT_SEC * 1000 - (now - Number(last))) / 1000);
        return json({ ok: false, error: "RATE_LIMIT", left: left }, 429);
      }
    }
    await db.prepare("INSERT OR REPLACE INTO wall_rl (ip, last_ts) VALUES (?,?)").bind(ip, now).run();
  } catch (e) {}

  try {
    const dr = await db.prepare("SELECT n FROM wall_day WHERE ip=? AND day=?").bind(ip, today).all();
    const dayCount = dr.results.length ? Number(dr.results[0].n) || 0 : 0;
    if (dayCount >= DAILY_IP_LIMIT) {
      return json({ ok: false, error: "DAILY_LIMIT", left: dayLeftSec() }, 429);
    }
  } catch (e) {}

  const name = sanitize(body.name, 20) || "匿名考生";
  const type = body.type === "meet" ? "meet" : "msg";
  const text = sanitize(body.text, 300);
  if (!text) return json({ ok: false, error: "EMPTY_TEXT" }, 400);

  const hit = hasSensitive(text) || hasSensitive(name);
  if (hit) return json({ ok: false, error: "BAD_WORD", word: hit }, 400);

  // 去重：最近 5 条内同昵称+同内容
  try {
    const { results } = await db.prepare(
      "SELECT name,text,created_at FROM wall WHERE city=? ORDER BY created_at DESC LIMIT 5"
    ).bind(city).all();
    for (var i = 0; i < results.length; i++) {
      if (results[i].name === name && results[i].text === text &&
          now - (Number(results[i].created_at) || 0) < 5 * 60 * 1000) {
        return json({ ok: false, error: "DUP" }, 400);
      }
    }
  } catch (e) {}

  const id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  const item = {
    id: id, name: name, type: type, text: text,
    meetAt: sanitize(body.meetAt, 30), meetAtISO: sanitize(body.meetAtISO, 30),
    direction: sanitize(body.direction, 20), contact: sanitize(body.contact, 40),
    resp: 0, respUsers: [], createdAt: now,
  };
  try {
    await db.prepare(
      "INSERT INTO wall (id,city,name,type,text,meet_at,meet_at_iso,direction,contact,resp,resp_users,created_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,0,'[]',?)"
    ).bind(id, city, name, type, text, item.meetAt, item.meetAtISO, item.direction, item.contact, now).run();
    await db.prepare(
      "INSERT INTO wall_day (ip,day,n) VALUES (?,?,1) ON CONFLICT(ip,day) DO UPDATE SET n = n + 1"
    ).bind(ip, today).run();
  } catch (e) {
    return json({ ok: false, error: "WRITE_FAIL" }, 500);
  }
  return json({ ok: true, item: item });
}

async function doRespond(context, body) {
  const city = cityOf(body.city);
  const id = sanitize(body.id, 40);
  const uid = sanitize(body.uid, 40) || "anon";
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);
  try {
    const { results } = await db.prepare("SELECT resp,resp_users FROM wall WHERE id=?").bind(id).all();
    if (!results.length) return json({ ok: false, error: "NOT_FOUND" }, 404);
    let arr = safeParse(results[0].resp_users, []);
    if (arr.indexOf(uid) >= 0) {
      return json({ ok: true, already: true, resp: results[0].resp || 0, item: rowToItem(results[0]) });
    }
    arr.push(uid);
    const newResp = (results[0].resp || 0) + 1;
    await db.prepare("UPDATE wall SET resp=?, resp_users=? WHERE id=?").bind(newResp, JSON.stringify(arr), id).run();
    const { results: after } = await db.prepare("SELECT * FROM wall WHERE id=?").bind(id).all();
    return json({ ok: true, resp: newResp, item: after.length ? rowToItem(after[0]) : { id: id, resp: newResp } });
  } catch (e) {
    return json({ ok: false, error: "WRITE_FAIL" }, 500);
  }
}

export async function onRequestDelete(context) {
  const url = new URL(context.request.url);
  const city = cityOf(url.searchParams.get("city"));
  const id = sanitize(url.searchParams.get("id"), 40);
  const admin = url.searchParams.get("admin") || "";
  // 管理员口令只从环境变量 WALL_ADMIN 读取；未配置或不匹配一律 403，不再内置公开回退值
  const secret = (context.env && context.env.WALL_ADMIN) || "";
  if (!secret || admin !== secret) return json({ ok: false, error: "BAD_ADMIN" }, 403);
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);
  try {
    const chk = await db.prepare("SELECT id FROM wall WHERE id=?").bind(id).all();
    if (!chk.results.length) return json({ ok: false, error: "NOT_FOUND" }, 404);
    await db.prepare("DELETE FROM wall WHERE id=?").bind(id).run();
    return json({ ok: true, removed: 1 });
  } catch (e) {
    return json({ ok: false, error: "WRITE_FAIL" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

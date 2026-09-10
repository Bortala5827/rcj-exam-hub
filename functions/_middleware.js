// Cloudflare Pages Functions 中间件：每日访问限额（防白嫖党无限刷免费站）
// 部署后由 Cloudflare 自动对每个请求执行。
//
// 计数方案（两档自动切换）：
//    真·按 IP 硬限制（D1）：在 Cloudflare 后台把 D1 数据库绑定到本函数(绑定名 DB)后，
//     自动按访客 IP 记当日浏览页数。优点：清 Cookie / 开无痕 / 换浏览器都绕不过，最硬。
//    回退·Cookie 软限制：未绑定 D1 时，用浏览器 Cookie 记当日页数（零配置，push 即生效）。
//     缺点：访客清 Cookie 可重置（足够拦住大部分白嫖党）。
//
// 作者本人永不被限（优先级从高到低）：
//   1) ALLOW_IPS：在 Cloudflare 后台 SettingsFunctions 环境变量设 ALLOW_IPS=你的IP(逗号分隔)，
//      该 IP 直接放行——【私密、最安全、推荐】。
//   2) VIP 密钥：访问一次 https://你的域名/sz/?vip=VIP_SECRET 即种下免限制 Cookie(rcj_vip=1)，全站永不被限。
//       此密钥写在公开仓库里属「软豁免」，懂行的人也能 ?vip= 自豁免；故优先用 ALLOW_IPS。
//
// 计数范围：仅统计「HTML 页面导航(GET)」，静态资源(js/css/png/json/...)不计数，省开销且不影响加载。

const LIMIT_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>今日免费体验已达上限</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:440px;background:#fff;padding:34px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:44px;line-height:1}
  .t{font-size:21px;font-weight:800;margin:14px 0 10px}
  .d{font-size:14px;color:#4a5568;line-height:1.8}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:20px;background:#1e3a5f;color:#fff;padding:11px 20px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji"></div>
  <h1 class="t">今日免费体验已达上限</h1>
  <p class="d">本开源题库为<b>引流体验版</b>，每位访客每日可免费浏览若干次。<br><br>
  需要<b>全量真题 + AI 智能点评（录音即出分）+ 离线无广告版</b>，请前往 <b>shop</b> 获取完整版。</p>
  <a class="b" href="https://shop.955827.xyz/" target="_blank" rel="noopener">前往 shop </a>
</div></body></html>`;

// ============ 定时下线（到点自动锁站）============
// 下线时间（毫秒时间戳）。
//    0 = 功能关闭（不挂横幅、不锁站）。
//    当前状态：已关闭——改用「3 天试用期」方案（见下方 TRIAL 逻辑），网站恢复开放。
//    想启用：改成目标时刻毫秒时间戳再 push，或 Cloudflare 后台设环境变量 OFFLINE_AT 覆盖。
const OFFLINE_AT_DEFAULT = 0;

// ============ 3 天试用期（防长期白嫖，不影响新访客体验）============
// 首次访问时种 rcj_trial Cookie 记录时间戳；满 TRIAL_DAYS 天后 HTML 导航一律返回「试用结束」页。
//    天数可在 Cloudflare 后台用环境变量 TRIAL_DAYS 覆盖（无需改代码）。
//    软限制：清 Cookie / 换浏览器可重置（与每日限额同级别，足够拦住大部分白嫖党）。
//    VIP / ALLOW_IPS 豁免；离线版 file:// 打开不经过 Cloudflare，天然免疫。
const TRIAL_DAYS_DEFAULT = 0; // 0 = 关闭试用期限制，页面不再显示「试用结束」与顶部试用条

// —— 试用期结束页（极简，只留引流）——
const TRIAL_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>免费试用已结束</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:400px;background:#fff;padding:36px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:42px;line-height:1;margin-bottom:12px}
  .t{font-size:21px;font-weight:800;margin:0 0 12px}
  .d{font-size:14px;color:#4a5568;line-height:1.9;margin:0}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:22px;background:#1e3a5f;color:#fff;padding:12px 22px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji"></div>
  <h1 class="t">免费试用已结束</h1>
  <p class="d">3 天在线试用期已满。<br>需继续使用请获取<b>离线完整版</b>（全量真题·AI 点评·永久使用）。<br>获取方式：前往 shop</p>
  <a class="b" href="https://shop.955827.xyz/" target="_blank" rel="noopener">前往 shop </a>
</div></body></html>`;

// —— 试用期内注入页面顶部的提示条（琥珀色，实时倒计时到分钟，促转化不刺眼）——
function trialBannerHtml(trialEnd) {
  return '<style>'
    + '#rcjTrialBar{position:fixed;top:0;left:0;right:0;z-index:2147483600;'
    + 'background:linear-gradient(90deg,#b45309,#d97706);color:#fff;'
    + 'font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;'
    + 'font-size:13px;line-height:1.5;padding:7px 12px;text-align:center;'
    + 'box-shadow:0 2px 10px rgba(0,0,0,.15)}'
    + '#rcjTrialBar b{font-weight:800}'
    + '#rcjTrialBar #rcjTrialCd{font-variant-numeric:tabular-nums;'
    + 'background:rgba(255,255,255,.18);padding:1px 7px;border-radius:6px;margin:0 2px}'
    + '#rcjTrialBar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}'
    + '@media(max-width:520px){#rcjTrialBar{font-size:12px;padding:6px 10px}}'
    + '</style>'
    + '<div id="rcjTrialBar"> 免费试用中 · 剩余 <b id="rcjTrialCd">--</b>'
    + ' · 长期使用请获取离线完整版（前往 '
    + '<a href="https://shop.955827.xyz/" target="_blank" rel="noopener">shop</a>）</div>'
    + '<script>(function(){var T=' + trialEnd + ';'
    + 'function tick(){var d=T-Date.now();'
    + 'if(d<=0){location.reload();return;}'
    + 'var day=Math.floor(d/86400000),h=Math.floor(d%86400000/3600000),m=Math.floor(d%3600000/60000);'
    + 'var s=(day>0?day+" 天 ":"")+h+" 小时 "+m+" 分";'
    + 'var el=document.getElementById("rcjTrialCd");if(el)el.textContent=s;}'
    + 'function boot(){var bar=document.getElementById("rcjTrialBar");if(!bar)return;'
    + 'tick();setInterval(tick,15000);'
    + 'try{document.body.style.paddingTop=((bar.offsetHeight||34))+"px";}catch(e){}}'
    + 'if(document.body){boot();}else{document.addEventListener("DOMContentLoaded",boot);}'
    + '})();</script>';
}

// 给放行的 HTML 响应：种/续 rcj_trial Cookie + 注入试用提示条
// 当试用期关闭（TRIAL_DAYS <= 0）时不种 cookie、不注入提示条，页面保持干净。
function withTrial(res, trialStart, trialEnd, trialDays) {
  if (trialDays <= 0) return res;
  res.headers.append(
    "Set-Cookie",
    `rcj_trial=${trialStart}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  );
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  return new HTMLRewriter()
    .on("body", { element(el) { el.append(trialBannerHtml(trialEnd), { html: true }); } })
    .transform(res);
}

// —— 到期后的「升级维护」页面（全内联，不依赖任何外部资源；极简，只留引流）——
const OFFLINE_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>网站升级维护中</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:400px;background:#fff;padding:36px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:42px;line-height:1;margin-bottom:12px}
  .t{font-size:21px;font-weight:800;margin:0 0 12px}
  .d{font-size:14px;color:#4a5568;line-height:1.9;margin:0}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:22px;background:#1e3a5f;color:#fff;padding:12px 22px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji"></div>
  <h1 class="t">网站升级维护中</h1>
  <p class="d">在线版暂停开放。<br><b>离线完整版不受影响</b>，可正常刷题，联网即可使用 AI 点评。<br>获取离线完整版：前往 shop</p>
  <a class="b" href="https://shop.955827.xyz/" target="_blank" rel="noopener">前往 shop </a>
</div></body></html>`;

// —— 到期前注入到每个在线页面顶部的「倒计时横幅」（红色，实时倒计时，促转化）——
function bannerHtml(offlineAt) {
  return '<style>'
    + '#rcjOfflineBar{position:fixed;top:0;left:0;right:0;z-index:2147483600;'
    + 'background:linear-gradient(90deg,#e11d48,#b91c1c);color:#fff;'
    + 'font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;'
    + 'font-size:13px;line-height:1.5;padding:8px 12px;text-align:center;'
    + 'box-shadow:0 2px 10px rgba(0,0,0,.18)}'
    + '#rcjOfflineBar b{font-weight:800}'
    + '#rcjOfflineBar #rcjOfflineCd{font-variant-numeric:tabular-nums;'
    + 'background:rgba(255,255,255,.18);padding:1px 7px;border-radius:6px;margin:0 2px}'
    + '#rcjOfflineBar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}'
    + '@media(max-width:520px){#rcjOfflineBar{font-size:12px;padding:7px 10px}}'
    + '</style>'
    + '<div id="rcjOfflineBar"> 本站即将进入升级维护、在线版暂停开放 · 剩余 '
    + '<b id="rcjOfflineCd">--:--:--</b> · 需长期使用请获取离线完整版（前往 '
    + '<a href="https://shop.955827.xyz/" target="_blank" rel="noopener">shop</a>）</div>'
    + '<script>(function(){var T=' + offlineAt + ';'
    + 'function p(n){return n<10?"0"+n:""+n;}'
    + 'function tick(){var d=T-Date.now();'
    + 'if(d<=0){location.reload();return;}'
    + 'var h=Math.floor(d/3600000),m=Math.floor(d%3600000/60000),s=Math.floor(d%60000/1000);'
    + 'var el=document.getElementById("rcjOfflineCd");if(el)el.textContent=p(h)+":"+p(m)+":"+p(s);}'
    + 'function boot(){var bar=document.getElementById("rcjOfflineBar");if(!bar)return;'
    + 'tick();setInterval(tick,1000);'
    + 'try{document.body.style.paddingTop=((bar.offsetHeight||40))+"px";}catch(e){}}'
    + 'if(document.body){boot();}else{document.addEventListener("DOMContentLoaded",boot);}'
    + '})();</script>';
}

// 用 HTMLRewriter 把横幅注入 HTML 响应（保留原响应头，含 Set-Cookie）
function injectBanner(res, offlineAt) {
  if (!offlineAt || offlineAt <= 0) return res; // 功能关闭时不注入横幅
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  return new HTMLRewriter()
    .on("body", { element(el) { el.append(bannerHtml(offlineAt), { html: true }); } })
    .transform(res);
}

// ============ 访客统计 & 爬虫过滤 ============
// 命中已知爬虫 / 空 UA  视为「非真人」，跳过试用 / 限额计数（仍正常返回页面，不影响收录）。
function isBot(req) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (!ua) return true; // 空 UA 几乎都是脚本 / 工具
  const bad = ["bot", "crawler", "spider", "slurp", "bingpreview", "facebookexternalhit",
    "python-requests", "curl", "wget", "go-http-client", "okhttp", "headless", "phantomjs",
    "puppeteer", "selenium", "axios", "java/", "libwww", "scrapy", "httpclient", "zgrab",
    "masscan", "nmap", "semrush", "ahrefs", "mj12bot", "dotbot", "petalbot", "applebot",
    "yandex", "baiduspider", "googlebot", "censys", "archive", "whatsapp", "telegrambot"];
  return bad.some((b) => ua.includes(b));
}

// 若 Cloudflare 后台设了 GA4_ID 环境变量，则向每个 HTML 页面注入 Google Analytics（GA4），
// 用于查看真实「独立访客数 / 活跃用户 / 新老用户」——Cloudflare Web Analytics 免费版无此指标。
//  ID 放环境变量（不进公开仓库），更安全；未设置则不注入（零副作用）。
function injectGa4(res, ga4Id) {
  if (!ga4Id) return res;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  const s = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + ga4Id + '"></script>'
    + '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
    + 'gtag("js",new Date());gtag("config","' + ga4Id + '");</script>';
  return new HTMLRewriter().on("head", { element(el) { el.append(s, { html: true }); } }).transform(res);
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

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";

  // 配置（硬编码默认值，确保部署即生效；若 Cloudflare 后台设了同名环境变量则优先覆盖）
  //  VIP_SECRET 写在公开仓库里，属「软豁免」；真正私有豁免请用 ALLOW_IPS。
  const VIP_SECRET = (env && env.VIP_SECRET) || "rcj9527-vip-KZ9qu6kWkSH1uujsbn_3_QL6";
  const DAILY_LIMIT = parseInt((env && env.DAILY_LIMIT) || "30", 10);
  const allowIps = (env && env.ALLOW_IPS)
    ? (env.ALLOW_IPS).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const limit = DAILY_LIMIT;
  const ga4Id = (env && env.GA4_ID) || ""; // 留空则不注入 GA4

  // —— 1) 作者豁免：VIP 密钥一次性种 Cookie ——
  if (VIP_SECRET && url.searchParams.get("vip") === VIP_SECRET) {
    const res = await next();
    res.headers.append(
      "Set-Cookie",
      "rcj_vip=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
    );
    return res;
  }
  if (cookie.includes("rcj_vip=1")) return next();

  // —— 0.5) API 直通：/api/ 路径（留言墙等）不做试用/限额/GA4 注入，直接交给对应函数 ——
  if (url.pathname.startsWith("/api/")) return next();

  // —— 2) 作者 IP 白名单（私密豁免，优先级最高）——
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (ip && allowIps.includes(ip)) return next();

  const isStatic = /\.(js|css|png|jpe?g|gif|svg|json|webp|mp3|mp4|woff2?|ttf|map|ico)$/i.test(
    url.pathname
  );

  // ——  定时下线：到点后，非作者的 HTML 页面导航一律返回「已停服」页；
  //    静态资源放行（停服页全内联、不依赖它们，放行也无妨）。作者(VIP/ALLOW_IPS)上面已放行，不受影响。——
  const OFFLINE_AT = parseInt((env && env.OFFLINE_AT) || String(OFFLINE_AT_DEFAULT), 10) || 0;
  if (OFFLINE_AT > 0 && Date.now() >= OFFLINE_AT) {
    if (!isStatic && request.method === "GET") {
      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return next();
  }

  // —— 3) 仅统计 HTML 页面导航，跳过静态资源与子请求 ——
  if (isStatic || request.method !== "GET") return next();

  // —— 3.5) 爬虫 / 空 UA：跳过试用与限额计数（仍正常返回页面）——
  if (isBot(request)) return next();

  // ——  3 天试用期检查：首次访问记时间戳，到期返回「试用结束」页 ——
  // TRIAL_DAYS <= 0 时关闭试用期限制（页面不再显示试用结束与顶部提示条）。
  const TRIAL_DAYS = parseInt((env && env.TRIAL_DAYS) || String(TRIAL_DAYS_DEFAULT), 10);
  let trialStart = 0, trialEnd = 0;
  if (TRIAL_DAYS > 0) {
    const tm = cookie.match(/rcj_trial=(\d+)/);
    if (tm) trialStart = parseInt(tm[1], 10) || 0;
    // 防作弊小加固：Cookie 里的时间戳若是未来时间（伪造），视为无效重记
    if (trialStart <= 0 || trialStart > Date.now()) trialStart = Date.now();
    trialEnd = trialStart + TRIAL_DAYS * 86400000;
    if (Date.now() >= trialEnd) {
      return new Response(TRIAL_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }

  // —— 4) 每日访问计数 ——
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const db = getDB(env); // 后台绑定 D1(绑定名 DB)后存在  按 IP 硬限制

  if (db) {
    // ===== 真·按 IP 硬限制（D1）=====
    const ipKey = ip || "unknown";
    let n = 0;
    try {
      const row = await db.prepare("SELECT n FROM visit_counts WHERE ip=? AND day=?").bind(ipKey, today).all();
      n = row.results.length ? (Number(row.results[0].n) || 0) : 0;
    } catch (e) {
      n = 0; // 读失败不挡用户（fail-open）
    }
    if (n >= limit) {
      return new Response(LIMIT_HTML, {
        status: 429,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "retry-after": "86400",
          "cache-control": "no-store",
        },
      });
    }
    const res = await next();
    try {
      await db.prepare(
        "INSERT INTO visit_counts (ip,day,n) VALUES (?,?,1) ON CONFLICT(ip,day) DO UPDATE SET n = n + 1"
      ).bind(ipKey, today).run();
    } catch (e) {
      /* 写失败不挡用户 */
    }
    return injectGa4(withTrial(injectBanner(res, OFFLINE_AT), trialStart, trialEnd, TRIAL_DAYS), ga4Id);
  }

  // ===== 回退：Cookie 软限制（未绑 DB 时）=====
  let visits = 0;
  try {
    const m = cookie.match(/rcj_visits=([^;]+)/);
    if (m) {
      const o = JSON.parse(decodeURIComponent(m[1]));
      if (o && o.d === today) visits = o.n || 0;
    }
  } catch (e) {
    visits = 0;
  }

  if (visits >= limit) {
    return new Response(LIMIT_HTML, {
      status: 429,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "retry-after": "86400",
        "cache-control": "no-store",
      },
    });
  }

  const res = await next();
  const nextVal = encodeURIComponent(JSON.stringify({ d: today, n: visits + 1 }));
  res.headers.append(
    "Set-Cookie",
    `rcj_visits=${nextVal}; Path=/; Max-Age=86400; SameSite=Lax; Secure`
  );
  return injectGa4(withTrial(injectBanner(res, OFFLINE_AT), trialStart, trialEnd), ga4Id);
}

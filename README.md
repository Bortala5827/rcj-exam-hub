# RCJ Exam Hub · Free Exam & Interview Prep (Multilingual)

> English · 日本語 · 中文 — a free civil-service and job-interview study center,
> built on Cloudflare Pages. Practice questions, voice recording & AI review,
> plus a multilingual PayPal deposit store.

**Live site:** https://exam.955827.xyz

RCJ Exam Hub turns publicly available exam material into efficient study tools.
It is a pure static site (no backend, no build step) hosted on Cloudflare Pages,
with the storefront and key flows available in **English, Japanese, and Chinese**.

## Core mechanics (核心原理)

- **数据本地化，练习不上云**：练习记录、自建题集、录音一律存浏览器 **IndexedDB**，刷新 / 离线都能继续；D1 只存匿名访问埋点，**不写任何练习数据**——隐私好、成本零、无需登录。
- **录音全本地**：开口练 / 面试录音用 MediaRecorder 录完直接本地回放、导出（不传服务器），"抽题 → 录音 → 回放 → 导出"闭环在单页内完成。
- **AI 反馈走全局网关**：AI 批改 / 点评统一调用主站 **`https://955827.xyz/api/ai-chat`**（`scene=exam`），本站**不持有任何模型密钥**；网关在边缘缓存与限流，改模型 / 换渠道只动主站一处。
- **纯静态 + 零构建**：无后端、无 build 步骤，Cloudflare Pages 直接发 `/`；三语（EN / 日本語 / 中文）由前端 i18n 字典驱动，单文件切换。
- **内容与变现分离**：免费真题 / 教程负责引流，成交统一走独立商城 shop.955827.xyz（定制题库 / Anki / 代建站），本站不再内嵌收款。

## What's inside

- **Past papers** — national, provincial, and public-institution civil-service exams,
  linked to open question banks (no self-hosted PDF library).
- **Structured interview practice** — general structured-interview question bank;
  draw by question type or by target profession; record locally, replay, export,
  and build your own question sets.
- **Firefighter drills (`/xf`)** — structured-interview bank for firefighters
  (national team + government-contracted), with recording drills and random draws.
- **Auxiliary-police drills (`/fj`)** — written + interview drills for multiple
  cities (Shenzhen, Huizhou, …) with recording, transcription, and AI feedback.
- **Tutorials** — how to build sites with domestic AI tools, Cloudflare Pages,
  GitHub basics, and free LLM APIs.

Commerce no longer lives in this repo: the standalone storefront
**shop.955827.xyz** (repo `rcj-shop`) sells custom question banks
(Anki + offline HTML practice pages) and done-for-you websites, with Xianyu
as the primary checkout and PayPal live as the secondary, all in
EN / 日本語 / 中文. Old `/shop` paths 301-redirect to the new storefront.

Monetization: free past papers drive traffic  the standalone storefront
(shop.955827.xyz) converts (custom question banks / Anki / done-for-you sites).

## Highlights

-  Trilingual UI (English / 日本語 / 中文), single-click switch
-  Local voice recording with replay, export, and optional AI review
-  Free to start — no account required for most practice
-  Commerce handled by the standalone storefront (shop.955827.xyz)

## Tech stack

- Cloudflare Pages (static) + Cloudflare Functions + D1 (SQLite)
- Vanilla JS `i18n` dictionary
- Storefront (PayPal / Xianyu) is a separate repo: `rcj-shop`  shop.955827.xyz

## Deploy

Connect Cloudflare Pages to `main`, build setting **None**, output `/`.
`git push` publishes.

---

Part of the [RCJ ecosystem](https://955827.xyz). Repo consolidated:
`xf-firefighter-exam` ( `/xf`) and `aux-police-exam` ( `/fj`) were merged in
August 2026 and deleted; `rcj-exam-bank` now covers the whole exam ecosystem.

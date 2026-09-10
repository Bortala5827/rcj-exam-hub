# RCJ Exam Hub · 架构关系地图

本文档说明 RCJ 招考生态的**仓库关系与部署边界**，不是产品介绍（产品介绍见 README.md）。
目标：让任何人一眼看懂「谁是什么、挂在哪、怎么上线」，避免误把独立产品合并进枢纽仓造成同步坑。

---

## 一、核心模型：枢纽 - 卫星（hub-and-spoke）

```
                        955827.xyz  (RCJ Lab 总入口，纯品牌着陆)
                              │
                  ┌───────────┴───────────┐
              RCJ Lab  (rcj-lab)      RCJ Exam Hub  (本仓库)
            Speak Series 入口        公职考试学习中枢
              /solospeak                  │
              /letout                     ├── /train   （体测·体能工具，子路径嵌入 ）
              /letout                     │
                                          └── 链接出去 （被 hub 指向，非合并）

  独立产品（自有后端 / 品牌 / 边界清晰） 走子域名，被各 hub 链接出去：
    exam.955827.xyz/fj  rcj-exam-bank/fj   辅警刷题站（笔试+面试，2026-08-17 由 aux-police-exam 并入 /fj 子路径）
    xf.955827.xyz      rcj-exam-bank/xf     消防刷题站（笔试+面试，已并入本仓库 /xf 子路径）
    facetalk.955827.xyz  facetalk          FaceTalk 面试搭子（P2P 匹配）
```

**设计铁律**：轻量工具进 hub 子路径；独立产品（有自己后端 / 独立品牌 / 产品边界清晰）走子域名。
Training（体测·体能）轻、无后端  作 `/train` 子路径；消防刷题站自 2026-08-16 起并入本仓库 `/xf` 子路径（内容同原 xf.955827.xyz，原仓库 xf-firefighter-exam 已删除）；辅警刷题站自 2026-08-17 起并入本仓库 `/fj` 子路径（内容同原 fj.955827.xyz，原仓库 aux-police-exam 已删除）；旧 fj.955827.xyz 已设 301 跳转至本路径，FaceTalk 是完整产品  独立子域，不并入。

---

## 二、仓库职责一览

| 仓库 | 线上地址 | 角色 | 部署方式 |
| :--- | :--- | :--- | :--- |
| `rcj-exam-bank` | `exam.955827.xyz` | **Exam Hub 枢纽**：真题导航·教学专区·付费橱窗 + `/train` 子模块 | Cloudflare Pages 连 `main`，构建设置 None，输出 `/` |
| `rcj-exam-bank/train` | `exam.955827.xyz/train` | RCJ Training（体测·体能自适应训练工具） | 作为本仓库子目录一同部署 |
| `rcj-exam-bank/fj` | `exam.955827.xyz/fj` | 辅警刷题站（笔试+面试，无留言墙/信号匹配——后者为 FaceTalk 专属），2026-08-17 由独立仓库 aux-police-exam 并入 | 作为本仓库子目录一同部署；原仓库 aux-police-exam 已删除（内容已并入） |
| `rcj-exam-bank/xf` | `exam.955827.xyz/xf` | 消防刷题站（笔试+面试），2026-08-16 由独立仓库 xf-firefighter-exam 并入 | 作为本仓库子目录一同部署；原仓库 xf-firefighter-exam 已删除（内容已并入） |
| `facetalk` | `facetalk.955827.xyz` | FaceTalk 面试搭子（P2P 匹配+AI 引导） | 独立 CF Pages 项目 + Functions/D1 |
| `rcj-hub` | `955827.xyz` | RCJ Lab 总入口 / Speak Series 挂载 | Cloudflare Pages，子路径 `/solospeak` `/letout` |

> 辅警题库于 2026-08-17 已并入本仓库 `/fj` 子路径（原 fj.955827.xyz / 独立仓库 aux-police-exam 已删除），Exam Hub 的「辅警」卡片与全站「辅警题库」链接已统一指向 `exam.955827.xyz/fj/`，旧 fj.955827.xyz 已设 301 跳转至该路径。消防题库已于 2026-08-16 并入 `/xf` 子路径（原 xf-firefighter-exam 仓库已删，内容已并入）；若日后需回退独立子域，需注意「子路径同步坑」（需 cp 副本 + 双推）且 xf.955827.xyz 自定义域需重新指回。

---

## 三、域名与 AdSense 约定

- **现有子域（`exam` / `fj` / `xf` / `facetalk`）一律不动**：它们 DNS 已搞定、邮件/二维码/旧链接处处指向，回改纯自找断链。
- **AdSense**：以根域 `955827.xyz` 为批准属性，根域获批后其下子路径与子域名均可挂广告。 现有子域无需为广告回改结构。
- **新项目默认走子路径**（`955827.xyz/<名>`，根域 Worker 代理、仓库独立、免 DNS）；独立性强的（如 FaceTalk）仍走子域名。

---

## 四、再发布流程（已验证）

### A. 修改 Exam Hub 本体（index.html / assets / guokao 等）
1. 在 `_repos/rcj-exam-bank/` 改文件
2. `git push origin main`  CF 自动部署（约 1–2 分钟）

### B. 修改 /train 子模块（RCJ Training）
源码真理在 `products/projects/RCJ-Train-MVP/`，仓库内 `/train` 是副本：
1. 在 `products/projects/RCJ-Train-MVP/` 改
2. `cp -r products/projects/RCJ-Train-MVP/. _repos/rcj-exam-bank/train/` 覆盖副本
3. 推送 `rcj-exam-bank`（`train/` 四个文件：index.html / style.css / app.js / README.md）
4. 硬刷 `exam.955827.xyz/train`（Ctrl+F5）看新版

> 注：`_repos/` 本地无 `.git`，推送走 GitHub API 造提交（脚本见 `tmp/push_train.py` 模式），非 `git clone` 直推。

---

## 五、约定速查

- 题库内容为公开招聘公开信息，无版权障碍；影视台词等素材按国内普遍玩法务实处理，不自我设限。
- 不重复造轮子 / 不为了生态而生态 / 简单优先。
- 改线上前先本地 `python -m http.server` 预览校验，再推。

# Pre-Plan：石門教會場地登記系統 大整修

> 目的：只做「排序 + 要 survey 什麼 + 每個方向要決定什麼」。不含任何實作細節。
> 每個 Phase 結束時各自產出一份正式 plan，再進下一個。

---

## 0. 現況盤點（2026-08 讀 code + gitbook 後）

**規模**：~5.9k LOC TS、2 張表（`User`、`Appointment`）、7 支 API、單一 Dashboard 頁。
→ 結論：**這不是「重構」等級，是「重寫比修便宜」等級**。真正有價值、不能丟的只有：DB 資料、業務規則、LINE channel、網域 `book.smsk.church`、gitbook。

**Stack**：React 18 + MUI 5 + DevExpress dx-react-scheduler 4.0.6（已停更、還靠 `patch-package` 打補丁）/ Express 4 + mysql2 raw SQL / MySQL 8.3 / nginx / docker compose / GitLab CI → ssh 到 DigitalOcean 單機 / 備份 = GitLab schedule 跑 mysqldump。

**業務規則（要保留的核心）**：
- 場地(room) × 類別(category) × 雙語營組別(flyyoung) 三種 resource，硬編在 `client/src/Data/const.ts`
- 重複行程用 rrule + exDate；同日內、start<end；`IS_DATE_OVERLAP_FLAG` 控制可否重疊
- 公開可讀（未登入看得到所有登記 + 登記人名字/頭像），登入後才能增刪改自己的
- 夏令營模式 toggle（v1.6.0）
- 手機優先（會友多用手機）

**債務（決定優先序的依據）**：
| # | 問題 | 嚴重度 |
|---|---|---|
| D1 | `env.sh` 內含 LINE channel secret 且已 commit 進 git | 🔴 立刻處理 |
| D2 | 每支 private API 都打 LINE `/verify` 一次（每 request 一個外部 round-trip）；`role` 欄位永遠寫 `"user"`，server 端無任何授權邏輯；refreshToken 把 `access_token` 當 `newIdToken` 回傳；token 放 localStorage | 🔴 權限系統要重設計 |
| D3 | DB：日期存 `varchar`、room/category 存中文名字非 id、`latin1`/`utf8mb3` 混用、`exDate varchar(4000)` | 🟠 資料模型要重設計 + migration |
| D4 | 場地/類別清單硬編前端 → 每次加房間都要 deploy（看 git log 2025-06 一天 8 個 patch 就是這個） | 🟠 需 admin 可維護 |
| D5 | Scheduler 套件死掉、依賴 patch-package、MUI 5 綁死 | 🟠 UI 重寫的主因 |
| D6 | 部署 = ssh + `rm -rf` + scp 整包 + compose up；DB 與 app 同一台；備份靠外部 pipeline | 🟡 infra 遷移時一併解 |
| D7 | 公開 API 洩漏所有使用者姓名/頭像/email 表結構 | 🟡 權限設計時一起考慮 |

---

## 1. Phase 順序（建議）

我把你列的六件事重新排序，理由寫在後面。**你原本想「UI 先」，我建議「決策先、後端次之、UI 第三、infra 最後」**，但 UI 的 survey 放最前面做，不會拖到你的體感進度。

```
Phase 0  止血 + 決策 survey        （1 週內，純調查與決定，不寫 code）
Phase 1  Design System             （設計產物：tokens / 元件規格 / 版型，還沒寫 app）
Phase 2  Backend v2 + DB + Auth    （小、獨立、可先上線相容舊前端）
Phase 3  Frontend v2               （新 design system + 新 scheduler + 新 API）
Phase 4  Infra → GCP + CI/CD       （app 穩了再搬；順便算 k8s vs VM 帳）
Phase 5  收尾：資料遷移演練、切換、gitbook 更新、舊環境下線
```

**為什麼這樣排：**
- **Phase 0 先於一切**：D1 是安全問題；而且 UI 套件、UI kit、後端 stack、DB、auth、hosting 六個決策彼此耦合（選 Cloud Run 就不用 k8s；選 Supabase 就沒有後端要寫；選 shadcn 就丟掉 MUI），必須一次攤開一起決定，否則做到一半推翻。
- **Design System 先於前端實作**（你的第一優先）：但 design system 裡最大的一塊是「日曆長什麼樣」，所以 **scheduler 套件要在 Phase 0 選好**，design system 才能圍著它做。
- **Backend 先於 Frontend**：後端只有 7 支 API，一兩天可重寫；新的 API contract + auth session 方式（cookie vs token）決定前端怎麼寫。先做後端 v2 並保持舊前端可用，前端重寫時就有穩定目標。
- **Infra 最後**：與 app 完全正交；先在現有 DO 上把新 app 跑穩，再搬 GCP，避免同時 debug 兩個變數。DO 多付一兩個月的錢遠比同時遷移的風險便宜。

---

## 2. 各 Phase 要 survey / 要決定的事

### Phase 0 — 止血 + 決策 survey
**止血（不用討論，直接做）**
- [ ] 轉 LINE channel secret；`env.sh` 改成 `.env.example`；`.DS_Store` 進 `.gitignore`
- [ ] 確認 backup repo 的 mysqldump 真的有跑、真的能還原（後面 migration 全靠它）
- [ ] 抓一份 prod dump 到本地當測試資料集

**Survey A：Scheduler / 日曆套件**（決定 UI 走向的第一件事）
- 候選：FullCalendar（React 版；resource view 是付費）、Schedule-X、react-big-calendar、DayPilot Lite、Mobiscroll（付費）、Bryntum（付費）、MUI X Scheduler（2025 新出，要確認成熟度與授權）
- 評分軸：rrule 重複支援、resource（多場地）視圖、drag/resize、**手機體驗**、可完全客製外觀（吃 design tokens）、授權費、維護活躍度、bundle size
- 產出：一張比較表 + 推薦 1 名、備選 1 名

**Survey B：UI kit / 樣式方案**（與 design system 綁定）
- 選項：留 MUI 升到 v7 / shadcn-ui + Tailwind v4 / Mantine / 純 Tailwind + headless（Radix/Base UI）
- 關鍵問題：Survey A 選出的日曆套件跟哪個 kit 最不打架？design system 要「有教會味、不像 AI 生成、modern」，哪個 kit 最容易客製到看不出底層？
- 產出：決定 kit；決定 design system 的載體（Figma？還是直接 code-first tokens + Storybook？你提到 claude design → 可用 claude-design MCP 產 mockup，這裡決定要不要用）

**Survey C：前端框架版本**
- React 19 + Vite（維持 SPA）vs 全端框架（TanStack Start / Next.js）
- 對這個 app：SPA + LINE OAuth redirect 最單純；要決定的是資料層（TanStack Query）與路由（TanStack Router / react-router 7）
- 產出：一句話決定 + 理由

**Survey D：後端 + DB**
- 後端：Hono / Fastify / Express 5 / NestJS，或直接 BaaS（Supabase / Firebase）讓後端消失
- ORM：Drizzle vs Prisma
- DB：留 MySQL → Cloud SQL；換 Postgres（Cloud SQL / Supabase / Neon）；或 SQLite（Turso / 單機 litestream）—— **這個 app 的流量與資料量，SQLite 完全夠，且會大幅簡化 infra 與備份**
- 產出：一組決定（framework + ORM + DB），並回答「這個決定對 Phase 4 hosting 的影響」

**Survey E：Auth + 權限模型**
- 現況分析：見 D2、D7
- 要決定：session 策略（server-side session + httpOnly cookie vs JWT）、LINE id_token 只在登入時驗一次、refresh 流程、登出
- 角色設計：至少 `member / staff / admin`；權限矩陣：誰能改別人的登記、誰能管場地與類別、是否要「審核」流程、是否要 room-level 管理者
- Library：better-auth / Auth.js / 自己寫（只有 LINE 一個 provider，自己寫 200 行可能最省）
- 產出：權限矩陣 + session 流程圖 + 選定 library

**Survey F：GCP hosting + 成本**
- 選項：(a) 單台 Compute Engine e2-small/micro + docker compose（等於現況搬家）(b) Cloud Run（scale-to-zero，最便宜、最省事）(c) GKE Autopilot (d) GKE Standard
- 「分流」要先釐清你要的是哪一種：**prod/staging 環境分流**？**blue-green / canary 發布**？還是**流量分區**？三種答案 infra 差很多 → 見 §4 問題 1
- 成本估算：以「每月請求數 < 10 萬、DB < 100MB、單一 region asia-east1」為前提，把 (a)~(d) 各算一份月費（含 LB、Cloud SQL、Artifact Registry、egress），並標出 GKE 管理費與最小節點池的固定成本
- CI/CD：留 GitLab CI（Workload Identity Federation 推 GCP）vs 搬 GitHub Actions；DB 備份改用 Cloud SQL 自動備份或 GCS
- 產出：成本比較表 + 推薦 + k8s manifests 的架構圖（即使最終不選 k8s，你要的方案還是會給）

**Phase 0 產出**：一份 `docs/decisions.md`（ADR 風格，每個決策一段：選什麼、為什麼、放棄了什麼）

### Phase 1 — Design System
- 定義：色彩（教會識別色 + 場地/類別語意色，現有 const.ts 裡的色票是起點）、字體（中文為主）、間距/圓角/陰影 tokens、暗色模式（現有功能，要保留）
- 元件清單：由現有 UI 反推（Navbar、場地多選 chips、日曆格、登記 block、詳情 tooltip/sheet、表單、FAB、snackbar、footer）+ 新增的 admin 頁面元件
- 版型：桌機 / 手機 兩套；手機是主戰場
- 產出：tokens 檔 + 元件規格 + 3~5 張關鍵畫面 mockup（可用 claude-design 產）+ 「AI 味檢查表」

### Phase 2 — Backend v2 + DB + Auth
- 新 schema（room/category 進 DB、日期用 datetime + tz、utf8mb4、外鍵）
- migration script：舊 dump → 新 schema（名字→id 對照表、日期字串解析）；要能反覆重跑
- 新 API contract（OpenAPI 或 tRPC/型別共享）；auth 依 Phase 0 決策
- 相容期：舊前端還在跑，所以 v2 先掛在 `/api/v2`，或做 adapter
- 產出：可獨立部署、有 migration、有最基本 test 的後端

### Phase 3 — Frontend v2
- 用 Phase 1 design system + Phase 0 選的 scheduler 重寫；接 `/api/v2`
- 保留現有 UX 亮點：多場地疊看、顏色主軸切換、FAB 新增、夏令營模式
- 新增：admin 管理場地/類別/角色的頁面（解 D4）
- 產出：可替換舊前端的 SPA；MSW mock 與 vitest 延續

### Phase 4 — Infra → GCP + CI/CD
- 依 Phase 0 Survey F 的決定實作；先 staging 再 prod；DNS 切換計畫；備份與還原演練
- 產出：IaC（Terraform 或至少 gcloud script）、pipeline、runbook

### Phase 5 — 切換與收尾
- 資料遷移彩排 → 正式遷移 → 舊 DO 下線 → gitbook 更新（架構圖、貢獻流程、版本紀錄）

---

## 3. 各項優先順序總表

| 優先 | 項目 | 為何這個位置 |
|---|---|---|
| P0 | 轉 secret、確認備份可還原 | 安全 + 之後所有 migration 的保險 |
| P0 | Survey A（scheduler） | 決定 UI 走向的最大變數 |
| P0 | Survey E（auth/權限） | 你自己說「設計得很糟」，且牽動 schema 與 API |
| P1 | Survey B/C/D（UI kit / FE / BE+DB） | 互相耦合，一次決定 |
| P1 | Survey F（GCP + 成本） | 早知道答案，但實作最後 |
| P2 | Design System | 你的第一優先，在決策落地後立刻開工 |
| P2 | Backend v2 | 小、快、給前端穩定目標 |
| P3 | Frontend v2 | 工作量最大的一塊 |
| P4 | Infra 遷移 | 正交、最後做風險最低 |
| P5 | 切換、文件 | — |

---

## 4. 需要你回答的問題（進 Phase 0 前）

> 2026-08-15 已 grill 完，答案沉澱在 `docs/decisions.md`。以下保留當紀錄。

1. **「分流」的定義**：prod/staging 環境隔離？blue-green/canary 發布？還是別的？
2. **成本上限**：這系統目前 DO 月費多少？你可接受的 GCP 月費區間？（決定 Cloud Run vs GKE 的關鍵）
3. **權限需求**：目前實際上誰該是 admin？需要「審核登記」流程嗎？場地管理者要不要能改別人的登記？
4. **BaaS 開放度**：能接受後端消失（Supabase/Firebase）嗎？還是你想保留「自己寫後端」的學習與掌控？
5. **UI kit 偏好**：對留 MUI 有感情嗎？還是完全開放（shadcn/Tailwind 路線會是很不同的手感）？
6. **時程**：有沒有下一個營會/大活動的 deadline，需要在那之前凍結或上線？
7. **GitLab 三個 repo 目前是 private**（我 clone 不了 gitbook 與 backup repo）；需要我看的話給 token 或設公開。

---

## 5. 這份 pre-plan 之後的下一步

1. 你回答 §4 → 我開 Phase 0：先做止血三件事，再跑 Survey A~F，每個 survey 產出一份短比較文件到 `docs/survey/`
2. Survey 完 → `docs/decisions.md` → 你拍板 → 才開始寫 Phase 1 的正式 plan

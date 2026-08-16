# Decisions（2026-08-15 grill 定案）

> 這份是 Phase 0 的產物：已拍板的決策。未拍板的列在最後「待 survey」。
> 每條：決定 / 理由 / 放棄了什麼。

## 策略
- **重寫**，非漸進重構。5.9k LOC / 2 表 / 7 API，重寫 < 重構；scheduler 套件已死、schema 要改。舊系統跑到切換日。
- **新 GitHub monorepo**（pnpm workspace）：`apps/web`、`apps/api`、`packages/shared`（zod schema/型別）、`packages/ui`（design tokens + shadcn 元件）、`infra/`（k8s manifests、Flux）。舊 GitLab repo 切換後封存唯讀。
- **CI/CD 搬 GitHub Actions + GHCR**。放棄留 GitLab（使用者選擇）。
- **無硬 deadline，年底前上線為 soft target**；切換日避開營會/聖誕季。

## 後端 / 資料
- **自寫薄後端**：Hono + Drizzle。放棄 BaaS（LINE 非原生 provider）、NestJS（過重）。
- **Postgres**。放棄 MySQL（反正 schema 重建）、SQLite（與 k8s 多副本相性差）。
- Postgres **跑在同一台 VM 的 k3s 內**（StatefulSet + local PV），備份 CronJob `pg_dump` → GCS bucket。放棄 Cloud SQL（>US$10/月不划算）、Neon（asia 無 region + 外部依賴）。
- **Hono RPC 型別共享**（不做 OpenAPI codegen）。
- 場地/類別 **進 DB，admin 可維護**（解「加房間要 deploy」）。
- 日期改 timestamptz、utf8、外鍵、room/category 用 id。
- **雙語營模式 v2 不做**（營會後再談「活動」泛化）。既有 flyyoung 資料 migrate 進備註或保留欄位，不丟。

## Auth / 權限
- **三層角色 member / staff / admin，無審核流程**。member 只能動自己的；staff 可改別人；admin 管場地/類別/角色。
- **用套件**（server-side session + httpOnly cookie，30 天滑動）：**better-auth vs Auth.js 待 Phase 0 POC**，重點驗 LINE provider 接法。放棄自寫。
- LINE id_token 只在登入時驗一次；前端不再持有 LINE token；不存 localStorage。
- **沿用同一個 LINE Login channel**（userId 連續，舊資料可對應）。
- 止血：使用者自行到 LINE console 重發 channel secret 並更新 GitLab CI variable；repo 端 `env.sh` → `.env.example`。

## 業務規則
- **衝突：預設硬擋（409 + 顯示衝突對象），staff/admin 可 override**；偵測在 server 端（含 rrule 展開），前端只預警。migration 容忍既有重疊。
- **公開可見度**：未登入可看行事曆（標題/場地/時間/類別）；姓名/頭像需登入；email 永不出 API。
- LINE 通知：**不做**。
- 保留：多場地疊看、顏色主軸切換、週/日/月視圖、rrule 重複 + 例外、FAB 新增、暗色模式、拖曳/拉長（must）。

## 前端 / 設計
- **React 19 + Vite SPA + TanStack Router + TanStack Query**。放棄 Next/TanStack Start（SPA 工具型 app 無 SSR 需求）。
- **Tailwind v4 + shadcn/ui**。放棄 MUI（Material 味難去）、Mantine。
- 日曆套件：**Phase 0 survey**。篩選：OSS/免費授權（含非商業免費）；must = 多場地疊看、週/日/月、rrule + 例外、點擊詳情、手機好用、**拖曳/拉長**。候選：FullCalendar（含 Premium 非商業授權需確認）、DayPilot Lite、MUI X Scheduler、Schedule-X、react-big-calendar。
- **Design system 兩層**：石門教會 base tokens（深藍綠 `#2E5F66` 呼應招牌色、奶油/暖白底、Huninn 字體）→ 登記系統主題（克制、工具感、高可讀，不接營會的島嶼黃/手繪）。場地色票從 const.ts 重調到同一彩度家族。參考：2026 雙語營 DS（Claude Design project `a99bc7dc…`）、教會外觀照（灰水泥 + 藍綠招牌 + 白十字架）、「只見耶穌」。
- **載體：Claude Design 探索 mockup → code-first `packages/ui`（CSS variables + shadcn + showcase 頁）**。不走 Figma。

## Infra
- **GCP 單台 VM（e2-medium 4GB，~US$25/月）+ k3s**。放棄 GKE（成本）、純 compose（想練 k8s）。
- **環境分流 = staging/prod 兩個 namespace**，子網域 `staging.book.smsk.church` / `book.smsk.church`。Traefik ingress + cert-manager Let's Encrypt。
- **GitOps Flux** 拉取部署。放棄 push-based ssh、Argo（重）。
- 成本比較表（GKE Autopilot / Standard / Cloud Run / VM）仍在 Phase 0 產出一次，當文件。

## 遷移 / 切換
- **全搬歷史資料 + 單次凍結切換**：舊站唯讀 → 最後 dump → migrate → DNS 切 → 舊 DO 保留一週可回滾。migration script 在 staging 彩排 ≥ 2 次。不做雙寫。

## 測試
- 後端：衝突偵測 / rrule 展開 / 權限中介層 單元測（vitest）；migration 用真 dump 跑一次。
- 前端：只測純邏輯。
- E2E：1 條 Playwright happy path（登入→建→改→刪）進 CI。

## Survey 結果（2026-08-15，詳見 docs/survey/）
- **日曆：FullCalendar v7**（`@fullcalendar/react` 7.x，MIT）；所有 must-have 在免費層，不依賴 Premium。備選 `@event-calendar`（無 React wrapper）。淘汰：Schedule-X（DnD 付費）、MUI X Scheduler（綁 MUI、stable 取消）、react-big-calendar（touch DnD 壞）、DayPilot Lite（無 touch）。風險：v7 新，教學多為 v6。**重複行程「此筆/此後/全部」一律 app 層負責** → domain model：`booking_series`(RRULE) + `booking_exception`(EXDATE/override)。→ `01-calendar-libs.md`
- **Auth：better-auth 1.6.x** + `generic-oauth` 的 `line()` preset；覆寫 `getUserInfo` 用 HS256 驗 id_token；callback `/api/auth/oauth2/callback/line`；`user.id` = 舊 LINE sub；role 用 `additionalFields` + 自寫 middleware；`expiresIn 30d / updateAge 1d`。→ `02-auth-libs.md`
- **成本：e2-medium + k3s = US$35/月 on-demand，1 年 CUD US$24.6**；GKE 完整 US$90–114（差 3–4.6 倍）。紀律：不開 GCP LB、staging 用 namespace、disk 20GB、無 Ops Agent、無 Cloud SQL。→ `03-gcp-cost.md`

## POC 結果（2026-08-16）
- **FullCalendar v7 定案**：桌機 8 項 7 過（Tailwind-only theming、rrule+exdate、DnD 語意、bundle 150KB 含 React）；真機觸控待使用者手機驗。→ `04-poc-fullcalendar.md`
- **better-auth 定案**：程式面全通（preset + HS256 覆寫、schema gen、PKCE、CSRF、role middleware）；真帳號 V1–V6/V9/V10 待使用者本機用 secret 驗。→ `05-poc-better-auth.md`
- Phase 0 完成 → 進 Phase 1（Design System）。

## Phase 1 產出（2026-08-16）
- Design 探索頁（Claude Design）+ `packages/ui` tokens/theme 落地，`apps/web` POC 已改吃 tokens（亮/暗驗證）。詳 `docs/design-system.md`。待使用者審色/字體後修訂。

## Phase 2 產出（2026-08-16）— Backend v2
- `packages/shared`（zod 4 contract）、`apps/api`：`schema.ts`（room/category/booking_series/booking_exception + better-auth 4 表）、`recur.ts`（台北 +8 固定平移展開）、`conflicts.ts`（409 + force）、`bookings.ts`（this/following/all）、`app.ts`（Hono RPC `AppType`）、`legacy.ts` + `scripts/migrate-legacy.ts`（mysqldump → v2，可重跑）。詳 `docs/api.md`。
- 決定：**GET /api/bookings 回 server 展開後的 instance**（非 rrule 原文），前端 FullCalendar 不再自己展開；rrule 權威在 server。
- 決定：**時區用固定 +8 平移**（台灣無 DST），不用 rrule tzid；migration 用同一套展開，BYDAY 語意 = 舊 DevExpress 本地顯示。
- 決定：DB 二選一 by env：`DATABASE_URL` → node-postgres，否則 pglite（dev/test 用 `memory://`）。
- 測試：vitest 22 條（recur / conflicts+scopes / routes+roles / legacy parse+migrate）。真 dump 尚未跑（使用者待辦 #5）。

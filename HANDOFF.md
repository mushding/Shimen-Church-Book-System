# HANDOFF — 石門教會場地登記系統 v2 重寫

> 給下一個 fresh session。先讀 `CLAUDE.md` → `docs/decisions.md` → `docs/api.md` → 本檔。最後更新 2026-08-16（Phase 2 完成）。

## Goal
把 2023 手工寫的場地登記系統（React 18 + MUI + DevExpress scheduler / Express + MySQL / DO 單機）重寫成：
React 19 + Vite + Tailwind v4 + shadcn + FullCalendar v7 / Hono + Drizzle + Postgres + better-auth(LINE) / GCP 單 VM e2-medium + k3s + Flux / GitHub Actions。年底前上線（soft）。所有決策在 `docs/decisions.md`，**不要重問**。

## Current Progress
- **Phase 0 完成**：grill 拍板 → 3 份 survey（日曆/auth/GCP 成本）→ 2 個 POC 皆過（`docs/survey/01–05`）。
- **Phase 1 完成**：
  - Design System 正式建在 Claude Design：「石門教會 Shimen Church」id `c3a36bb4-32f6-45e6-b714-2a62a6a26a5b`（bundle 在 `packages/ui/design-system/`，用 `DesignSync` 工具推）。
  - Mockup project「石門教會 場地登記 — 設計系統」id `dc73d60d-9e41-42e0-9875-ba9f5f653f92`：01 tokens/手機三日、02 桌機週視圖、03 登記流程、04 admin、05 狀態/登入。
  - `packages/ui`：`tokens.css`（oklch，兩層：教會 base + 登記語意層 + room/cat 色票，`.dark`）+ `theme.css`（Tailwind v4 `@theme inline`）。
  - `apps/web` POC 已吃 tokens；`apps/api` POC（Hono + better-auth LINE preset + Drizzle + pglite）跑得起來。
  - 全部在 `docs/design-system.md` 有 id/URL/載入方式。
- **Phase 2 完成（backend v2，2026-08-16）**：`packages/shared` zod contract；`apps/api` schema/recur/conflicts/bookings(scopes)/app(Hono RPC)/legacy migration；22 vitest 全過；`pnpm --filter api test`。契約與語意見 `docs/api.md`。**未做**：真 LINE 登入驗收（等使用者 secret）、真 dump 跑 migration（等使用者 dump）。
- Repo：本地 git（`~/Desktop/Github/personal/shimen-church-book-system-v2`），**尚未建 GitHub remote**。舊 GitLab repo `shimen-church-book-system` 只 push 了 docs（pre-plan/decisions/survey 01–03）+ `.env.example`。

## What Worked
- FullCalendar v7：純 `*Class` props + Tailwind，零 `.fc-*` override；rrule/exdate 正確；DnD callback 給 `event.id + oldEvent.start + delta`。以套件內 `chunks/*.d.ts` 為準（網路教學多 v6）。
- better-auth 1.6.x：`generic-oauth` 的 `line()` preset + spread 覆寫 `getUserInfo` 用 HS256 `jwtVerify`；callback `/api/auth/oauth2/callback/line`；`user.id` = 舊 LINE sub 可零改 FK。
- Tailwind v4 dark：`@theme inline` 引用 `var(--x)`，`.dark` 才會生效；workspace 套件的 CSS 要在 app 端直接 `@import` 兩個檔（不會跟進巢狀 @import）。
- Claude Design：`.dc.html` 用 `sc-for` + class 定位（不要 `style="{{ }}"`），共用 `ds.css`；DS bundle 格式照 Modernist（`readme.md` + `styles.css` + `@dsCard` 首行註解）。
- Playwright headless 驗 render（Chrome extension 常沒回應）。
- rrule 2.8 無 `exports` map：Node ESM 只看到 CJS default → `recur.ts` 有 shim（`RRule = pkg.RRule ?? pkg.default.RRule`），其他檔從 `./recur` 拿 `RRule`。
- port 3000 偶爾被暫時佔用；smoke 可用 `PORT=3001`。
- zod 4：`.partial()` 不能接在 `.refine()` 後 → 先 base object 再各自 refine。

## What Didn't Work / 地雷
- `pnpm create vite --template react-swc-ts` 給 vanilla（模板名變）→ 手寫。
- `temporal-polyfill` 要 `^1.0.1`；better-auth 要 `drizzle-orm ^0.45.2`。
- better-auth `user.email` NOT NULL → 無 email scope 時合成 `${sub}@line.invalid`。
- MCP `write_files` 只能 inline data（大檔很貴）；`DesignSync.write_files` 可 `localPath`。
- Chrome extension MCP 逾時；GitLab 私有 repo（gitbook/backup）clone 不到。

## 使用者待辦（阻塞項，非我能做）
1. 手機真機測 FullCalendar 觸控拖曳（`pnpm dev:web` 已 `--host`；POC #6）。
2. `apps/api/.env` 填新 LINE secret + `BETTER_AUTH_SECRET`；LINE console 加 callback `http://localhost:5173/api/auth/oauth2/callback/line`；跑真登入驗 V1–V6/V9/V10（`docs/survey/02` §7）；確認 `account.accountId == 舊 User.userId`。
3. 決定要不要我 `gh repo create`（private）建 GitHub remote。
4. 看 DS / mockups 一輪，拍板色相/字體；要改就說，我改 `tokens.css` 重推。
5. 拿一份 prod MySQL dump 到本地（migration 用）；GitLab backup repo 目前私有。

## Next Steps（Phase 3：Frontend v2）
Phase 2 backend 已落地（`docs/api.md`）。接下來：
1. `apps/web` 從 POC 改成正式：TanStack Router + Query、shadcn（吃 `@smsk/ui` tokens，照 mockups 01–05）、`hc<AppType>()` 接 `/api/bookings?from&to`（server 已展開 instance，FullCalendar 不用 rrule plugin 了；`event.id = "{seriesId}:{occurrenceStart}"`）。
2. 登記表單（FAB）+ 重複規則 UI（產 RRULE body）+ 「此筆/此後/全部」選單 → PATCH/DELETE scope；409 顯示衝突對象，staff/admin 可 force。
3. 多場地疊看 / 顏色主軸切換 / 週日月 / 暗色 / 未登入唯讀（`user=null`）。
4. admin 頁：rooms/categories/users role。
5. 1 條 Playwright happy path（登入→建→改→刪；登入可用測試 session 注入，見 `test/app.test.ts` 的 mock 手法或加 dev-only login route）。
6. Phase 2 尾巴（等使用者）：真 LINE 登入 V1–V6/V9/V10；真 dump 跑 `pnpm --filter api migrate:legacy dump.sql` 看警告；決定本機 PG（`DATABASE_URL`）或續用 pglite。
之後 Phase 4 infra（k3s/Flux/GCP，成本紀律見 `docs/survey/03` §10）、Phase 5 遷移切換。

## 指令備忘
```sh
pnpm install
pnpm dev:api        # :3000（pglite，資料在 apps/api/.pglite）
pnpm dev:web        # :5173（/api 反代）
cd apps/api && npx drizzle-kit generate   # schema → drizzle/*.sql（改 src/schema.ts 後）
pnpm --filter api test                     # vitest（pglite memory://）
pnpm --filter api migrate:legacy dump.sql  # 舊 MySQL dump → v2
```

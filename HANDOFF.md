# HANDOFF — 石門教會場地登記系統 v2 重寫

> 給下一個 fresh session。先讀 `CLAUDE.md` → `docs/decisions.md` → `docs/api.md` → 本檔。最後更新 2026-08-16（Phase 3 完成）。

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
- **Phase 2 完成（backend v2，2026-08-16）**：`packages/shared` zod contract；`apps/api` schema/recur/conflicts/bookings(scopes)/app(Hono RPC)/legacy migration；22 vitest 全過；`pnpm --filter api test`。契約與語意見 `docs/api.md`。migration script 已測但**不會用到**（舊資料遺失，全新起步）。
- **Phase 3 完成（frontend v2，2026-08-16）**：`apps/web` 正式版（Router/Query/RPC/FullCalendar/表單/scope/衝突/admin/暗色/手機三日）；Playwright happy path `pnpm e2e` 綠；api 25 vitest 綠。真 LINE 登入 V1/V2 已驗（accountId = 舊 userId）。
- **Phase 4 完成（infra 檔案，2026-08-16）**：`Dockerfile`（單 image）、`.github/workflows/{ci,image}.yml`、`infra/`（Flux/kustomize/cert-manager/Postgres/backup/GCP script）+ `infra/README.md` runbook。**已上雲（2026-08-16）**：GCP project `smsk-app`、VM `smsk-k3s`（asia-east1-b，IP `104.199.232.239`）、k3s v1.36、Flux bootstrap 完成（`infra/clusters/smsk/flux-system` 在 repo）、cert-manager/issuer Ready、兩個 ns secrets 已建、**staging app Running 且經 IP+Host 驗過**；**prod 已上線 `v1.0.0`（https://book.smsk.church，Cloudflare 橘雲 Full (strict)）；staging https://staging.book.smsk.church（灰雲 DNS only，因 Universal SSL 不蓋二層子網域）。舊 DO 站已被 DNS 切掉。**kubeconfig `~/.kube/smsk.yaml`（走 `gcloud compute ssh -- -L 6443:127.0.0.1:6443` 隧道）。
- Repo：`~/Desktop/Github/personal/shimen-church-book-system-v2` → GitHub **`mushding/Shimen-Church-Book-System`**（public；remote `git@github.com-personal:`，個人 key 已註冊）。舊 GitLab repo `shimen-church-book-system` 只 push 了 docs（pre-plan/decisions/survey 01–03）+ `.env.example`。

## What Worked
- FullCalendar v7：純 `*Class` props + Tailwind，零 `.fc-*` override；rrule/exdate 正確；DnD callback 給 `event.id + oldEvent.start + delta`。以套件內 `chunks/*.d.ts` 為準（網路教學多 v6）。
- better-auth 1.6.x：`generic-oauth` 的 `line()` preset + spread 覆寫 `getUserInfo` 用 HS256 `jwtVerify`；callback `/api/auth/oauth2/callback/line`；**真登入已驗（2026-08-16）**：`account.accountId` = 舊 `User.userId`（V1/V2 ✓），`user.id` 是 better-auth 隨機值——關聯靠 account 表；migration 對已登入者沿用既有 `user.id`。
- Tailwind v4 dark：`@theme inline` 引用 `var(--x)`，`.dark` 才會生效；workspace 套件的 CSS 要在 app 端直接 `@import` 兩個檔（不會跟進巢狀 @import）。
- Claude Design：`.dc.html` 用 `sc-for` + class 定位（不要 `style="{{ }}"`），共用 `ds.css`；DS bundle 格式照 Modernist（`readme.md` + `styles.css` + `@dsCard` 首行註解）。
- Playwright headless 驗 render（Chrome extension 常沒回應）。
- rrule 2.8 無 `exports` map：Node ESM 只看到 CJS default → `recur.ts` 有 shim（`RRule = pkg.RRule ?? pkg.default.RRule`），其他檔從 `./recur` 拿 `RRule`。
- port 3000 偶爾被暫時佔用；smoke 可用 `PORT=3001`。
- zod 4：`.partial()` 不能接在 `.refine()` 後 → 先 base object 再各自 refine。
- Tailwind v4 掃不到動態組出的 class（`\`bg-room-${i}\``）→ `ui.tsx` 的 `ROOM_BG/CAT_BG` 必須是字面字串。
- Hono RPC：middleware 用 `createMiddleware<Env>()`，用 `(c:any,next)=>` 會讓後面 route 的型別從 `AppType` 消失。
- FullCalendar v7：`slotHeaderFormat`（非 slotLabelFormat）、views 沒有 `buttonText`；事件沒有 `.fc-event` class（Playwright 用文字選）。
- better-auth `signUpEmail` 對 email 有格式檢查：dev login 用 `dev-<hex>@dev.local`。
- `hc` client 對 `$get()` 沒參數的路由要傳 `undefined`/不傳皆可，但 `:id` 路徑用 `api.api.bookings[":id"].$patch({param,json})`。

## What Didn't Work / 地雷
- `pnpm create vite --template react-swc-ts` 給 vanilla（模板名變）→ 手寫。
- `temporal-polyfill` 要 `^1.0.1`；better-auth 要 `drizzle-orm ^0.45.2`。
- better-auth `user.email` NOT NULL → 無 email scope 時合成 `${sub}@line.invalid`。
- MCP `write_files` 只能 inline data（大檔很貴）；`DesignSync.write_files` 可 `localPath`。
- Chrome extension MCP 逾時；GitLab 私有 repo（gitbook/backup）clone 不到。

## 使用者待辦（阻塞項，非我能做）
1. 手機真機測 FullCalendar 觸控拖曳（`pnpm dev:web` 已 `--host`；POC #6）。
2. ~~.env / callback / V1 V2~~ 完成。剩 V3 cookie 旗標、V4 滑動續期、V5 logout、V6 role（`pnpm --filter api set-role U… admin` 後 `/api/me` 看 role）、V10 LINE in-app browser。
3. ~~GitHub remote~~ 已推 `mushding/Shimen-Church-Book-System`（目前 **public**；要 private 自己在 GitHub 設定改）。
4. 看 DS / mockups 一輪，拍板色相/字體；要改就說，我改 `tokens.css` 重推。
5. ~~prod dump / migration~~ **取消**：舊資料遺失，v2 全新 DB 起步（見 decisions「不遷移歷史資料」）。

## Next Steps（Phase 4：infra）+ 打磨
Phase 3 前端已落地。接下來：
1. **使用者先過一輪 UI**（`pnpm dev:api` + `pnpm dev:web`，或 `DEV_LOGIN=1 pnpm dev:api` 後 `curl -X POST localhost:5173/api/dev/login -d '{"name":"x","role":"admin"}'` 拿 cookie）：手機真機觸控拖曳、色相、密度。回饋 → 改 `apps/web/src/*` / `packages/ui/tokens.css`。
2. 上線收尾：使用者 LINE 登入 prod 一次 → `kubectl -n smsk exec deploy/app -- ./node_modules/.bin/tsx scripts/set-role.ts <LINE userId> admin` → 關舊 DO droplet（DNS 已切）→ 1–2 週後買 1 年 CUD。本機 dev LINE callback（localhost:5173）已從 LINE console 移除，本機用 `DEV_LOGIN=1`。
3. 發版：`git tag vX.Y.Z <自己的 commit> && git push origin vX.Y.Z` → prod；push main → staging。**地雷**：`git pull` 後 HEAD 常是 bot 的 `deploy(staging) … [skip ci]` commit，tag 標在它上面 workflow 會被跳過 → 一定標在自己的 commit（`git log` 找）。tag 觸發也不能有 `paths-ignore`。
3. Phase 5：staging 驗 → LINE console 加 prod callback → DNS 切換 → 第一個 admin 用 `set-role` → 舊 DO 保留一週。（無資料遷移。）
4. 打磨（可後）：code-split（bundle 650KB）、eventContent 顯示多筆 conflict、admin 場地拖曳排序、i18n 時間格式一致。
5. Phase 2 尾巴（等使用者）：V3/V4/V5/V10；本機 PG（`DATABASE_URL`）或續用 pglite。

## 指令備忘
```sh
pnpm install
pnpm dev:api        # :3000（pglite，資料在 apps/api/.pglite）
pnpm dev:web        # :5173（/api 反代；API_URL=http://localhost:3001 可改目標）
cd apps/api && npx drizzle-kit generate   # schema → drizzle/*.sql（改 src/schema.ts 後）
pnpm --filter api test                     # vitest（pglite memory://）
pnpm --filter api migrate:legacy dump.sql  # 舊 MySQL dump → v2
pnpm e2e                                    # Playwright happy path（自起 api DEV_LOGIN=1 + web）
pnpm typecheck                              # 全 workspace tsc
```

# 05 - POC 結果：better-auth × LINE（2026-08-16）

Code：`apps/api/`（Hono + better-auth 1.6.29 + Drizzle 0.45 + pglite）。`pnpm dev:api` + `pnpm dev:web`（Vite proxy `/api` → 3000）。

## 已驗（不需真 LINE secret）
| # | 項目 | 結果 |
|---|---|---|
| — | `line()` preset 存在於 `better-auth/plugins/generic-oauth`；用 spread 覆寫 `getUserInfo` 改 HS256 `jwtVerify` | ✅ tsc 過 |
| — | `@better-auth/cli generate` 產 Drizzle schema（user/session/account/verification + `role` enum 欄）| ✅ `src/schema.auth.ts` |
| — | sign-in 產生 LINE authorize URL：`scope=openid+profile`、PKCE S256、`redirect_uri=http://localhost:5173/api/auth/oauth2/callback/line` | ✅ |
| V7 | CSRF：帶 session cookie + `Origin: https://evil.example` POST sign-out → `403 INVALID_ORIGIN` | ✅ |
| V8 | 公開讀：未登入 `/api/appointments` 200；`/api/me` 401；`/api/admin/ping` 需 admin | ✅ |
| — | 前端「LINE 登入」按鈕 → 302 到 access.line.me | ✅（Playwright）|

## 待你本機驗（需 secret）
1. `apps/api/.env`：`LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`（新的）、`BETTER_AUTH_SECRET`（`openssl rand -base64 32`）。**不要 commit**。
2. LINE Developers console → LINE Login channel → Callback URL 加一行：`http://localhost:5173/api/auth/oauth2/callback/line`
3. `pnpm dev:api` / `pnpm dev:web` → 開 http://localhost:5173 → LINE 登入
4. 驗收 V1–V6、V9、V10（清單見 `02-auth-libs.md` §7）。查 DB：pglite 資料在 `apps/api/.pglite/`；最快是在 `src/index.ts` 暫加 `app.get("/api/debug/accounts", ...)` 印 `account` 表，看 `accountId` 是否 = 你的舊 `User.userId`。

## 踩雷
- `user.email` 在 better-auth schema 是 NOT NULL UNIQUE；不要 email scope 就得合成佔位值（`${sub}@line.invalid`）。
- better-auth 1.6.x peer 要 `drizzle-orm ^0.45.2`。
- CLI generate 需 `db.ts` 能被 import → 先放空 `schema.auth.ts` 再 generate。
- CSRF 檢查只在**有 session cookie** 的 POST 上生效；未登入的 sign-in POST 任何 origin 都可（設計如此）。

## 結論
程式面全通；剩真帳號流程屬操作驗證。**better-auth 定案**。

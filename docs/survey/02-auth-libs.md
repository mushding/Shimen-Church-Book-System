# Survey 02：Auth 套件選型（LINE Login + Hono + Drizzle + Postgres）

> Phase 0 產物。對應 `docs/decisions.md` →「Auth / 權限」段的待辦：**better-auth vs Auth.js 待 Phase 0 POC**。
> 調查日期：**2026-08-15**。所有版本號與行為皆於當日實地驗證（npm registry / 套件 dist 原始碼 / 官方文件），下方標註 `[已驗證]` 者為直接讀套件原始碼確認，非引用二手文章。

---

## 0. 結論（先講）

**選 better-auth。** 三個決定性理由：

1. **LINE 有官方 preset**：`better-auth/plugins/generic-oauth` 內建 `line()` helper（v1.6.29 已隨套件出貨，`package/dist/plugins/generic-oauth/providers/line.mjs`）[已驗證]。不必自己拼 authorization/token/userinfo URL。
2. **需求清單幾乎全部是內建選項**：DB session + httpOnly cookie + 30 天滑動（`expiresIn` / `updateAge`）、CSRF（Origin 檢查 + `trustedOrigins` + SameSite=Lax）、logout、role 欄位、Drizzle adapter — 都是設定，不是自己寫。
3. **Migration 對得上**：better-auth 的 `account` 表用 `(providerId, accountId)` 存 provider 端 user id，我們把 `accountId` 填舊 `User.userId`（LINE sub）即可 1:1 對上，官方 migration guide 就是這個 pattern。

Auth.js 雖然 **LINE 是 first-class built-in provider**（`@auth/core/providers/line`，`type: "oidc"`），但在 Hono 上要靠 `@hono/auth-js`（最後發版 2026-02-14，且 peer 依賴 `react`），role 要自己補 callback，整體 Next.js 味重。自寫（arctic）在這個專案規模下是最貴的選項。

---

## 1. 需求對照表

| # | 需求（來自 decisions.md） | better-auth | Auth.js + @hono/auth-js | 自寫（arctic + Hono） |
|---|---|---|---|---|
| R1 | LINE Login 為唯一 IdP | `line()` preset（genericOAuth）[已驗證] | built-in `line` provider（`type: "oidc"`）[已驗證] | `arctic` 有 `Line` class [已驗證] |
| R2 | server-side session 存 DB | 預設行為 | `session.strategy: "database"` | 自寫 table + query |
| R3 | httpOnly + Secure cookie | 預設（`__Secure-better-auth.session_token`）[已驗證] | 預設（`__Secure-authjs.session-token`） | 自寫 |
| R4 | 30 天滑動有效期 | `expiresIn` + `updateAge`（預設 7d / 1d）[已驗證] | `maxAge` + `updateAge` | 自寫 |
| R5 | role（member/staff/admin），admin 可改 | `user.additionalFields.role` 或 admin plugin `/admin/set-role` | 自己加欄位 + `session` callback | 自寫 |
| R6 | 保留 LINE `sub` 當穩定識別，舊資料可對應 | `account.accountId` | `account.providerAccountId` | 你決定 |
| R7 | logout | `POST /api/auth/sign-out` | `POST /api/auth/signout` | 自寫 |
| R8 | CSRF | Origin 檢查 + `trustedOrigins` + Fetch Metadata + SameSite=Lax | double-submit `authjs.csrf-token` + SameSite | 自寫 |
| R9 | Hono 掛載 | 官方 integration 文件 | `@hono/auth-js` | 原生 |
| R10 | Drizzle + Postgres | `drizzleAdapter(db, { provider: "pg" })` + `npx auth generate` | `@auth/drizzle-adapter` | 你自己的 schema |
| R11 | 未登入可讀行事曆 | handler 只掛 `/api/auth/*`，其餘路由自訂 | 同左（`verifyAuth()` 只掛需要的路由） | 同左 |
| **工作量估計** | | **0.5–1 天** | **1–2 天** | **3–5 天 + 長期維護** |

---

## 2. better-auth

- 版本：**`better-auth@1.6.29`**（latest，發布於 2026-08-14）。dist-tags：`rc = 1.7.0-rc.6`、`beta = 1.7.0-beta.10`。[已驗證：`npm view better-auth dist-tags`]
- CLI：套件已改名為 **`auth`**（`npx auth@latest generate`），版本與 better-auth 同步為 `1.6.29`。舊的 `@better-auth/cli` 停在 `1.4.21`，**不要再用**。[已驗證]
- 文件：<https://better-auth.com/docs>

### 2.1 LINE：有官方 preset，但不在「social providers」清單裡

這點很容易誤判：better-auth 的 `socialProviders`（core）**沒有** LINE；LINE 是放在 **genericOAuth plugin 的 provider helper** 裡。文件頁在 <https://better-auth.com/docs/plugins/generic-oauth>。

實地讀原始碼（`package/dist/plugins/generic-oauth/providers/line.mjs`）確認 preset 內容：

```js
const authorizationUrl = "https://access.line.me/oauth2/v2.1/authorize";
const tokenUrl         = "https://api.line.me/oauth2/v2.1/token";
const userInfoUrl      = "https://api.line.me/oauth2/v2.1/userinfo";
const defaultScopes    = ["openid", "profile", "email"];

const getUserInfo = async (tokens) => {
  let profile = null;
  if (tokens.idToken) try { profile = decodeJwt(tokens.idToken); } catch {}
  if (!profile) { /* fallback: GET userInfoUrl with Bearer accessToken */ }
  return { id: profile.sub, name: profile.name, email: profile.email,
           image: profile.picture, emailVerified: false };
};
```

可調參數（`LineOptions`）：`providerId`（預設 `"line"`）、`clientId`、`clientSecret`、`scopes`、`redirectURI`、`pkce`、`disableSignUp`、`disableImplicitSignUp`、`overrideUserInfo`。

**`id: profile.sub` → 這就是 R6 的答案**：LINE 的 `sub` 會被寫進 `account.accountId`。

### 2.2 ⚠️ id_token 驗證的真相（重要，POC 必查）

**`line()` preset 用的是 `decodeJwt`（jose），不是 `jwtVerify`。也就是說：不驗簽章、不驗 `aud` / `iss` / `exp` / `nonce`。** [已驗證：讀原始碼]

這**不是漏洞**，但你要知道為什麼：

- id_token 是在 **authorization code flow 的 back-channel**（server → `https://api.line.me/oauth2/v2.1/token`，TLS + client_secret 認證）直接取得的，不是從瀏覽器 front-channel 傳來的。OIDC Core §3.1.3.7 明確允許此情況下**以 TLS 通道驗證取代簽章驗證**。
- 因此對我們的 web login flow（`response_type=code`，non-LIFF），現況是可接受的。

但仍建議在 POC 加一道保險（成本很低）：

- **方案 A（最省事）**：`getUserInfo` 覆寫，改打 **`POST https://api.line.me/oauth2/v2.1/verify`**（body: `id_token`, `client_id`），由 LINE 端驗證並回傳 payload。
- **方案 B**：用 `jose.jwtVerify` 自行驗。注意 **LINE web login 的 id_token 是 HS256、以 channel secret 當 key**；ES256 只用於 native app / LINE SDK / LIFF，此時才需要 JWKS `https://api.line.me/oauth2/v2.1/certs`（依 `kid` 取 key）。所以我們的情境是 HS256 + channel secret，**不需要 JWKS**。[已驗證：<https://developers.line.biz/en/docs/line-login/verify-id-token/>]

> 團隊 lead 的原始問題「genericOAuth 是否用 JWKS 驗 LINE id_token」→ **答案是：不驗，而且 web login 情境本來也不該用 JWKS（那是 ES256 路徑）。**

另外 preset 硬寫 `emailVerified: false`。若之後有依賴 email 驗證狀態的邏輯要自己處理（我們的 decisions 是「email 永不出 API」，所以無所謂）。

### 2.3 Endpoint / redirect_uri

genericOAuth 註冊的路由（[已驗證：dist 內字串 `"/sign-in/oauth2"`、`"/oauth2/callback/:providerId"`]）：

| 用途 | 路徑 |
|---|---|
| 發起登入 | `POST {basePath}/sign-in/oauth2`，body `{ providerId: "line", callbackURL: "/" }` |
| LINE 導回 | `GET {basePath}/oauth2/callback/line` |
| 取 session | `GET {basePath}/get-session` |
| 登出 | `POST {basePath}/sign-out` |

`basePath` 預設 `/api/auth`。**要在 LINE Developers Console 註冊的 Callback URL 就是**：

```
https://book.smsk.church/api/auth/oauth2/callback/line
```

（注意：**不是** `/callback/line`，genericOAuth 的路徑多一層 `oauth2/`。這是最容易踩的一顆雷 — LINE 要求 redirect_uri 完全字串相符。）

本機開發要另外註冊 `http://localhost:3000/api/auth/oauth2/callback/line`（LINE Console 可註冊多個 callback URL，逗號/換行分隔）。

### 2.4 Session：30 天滑動

```ts
session: {
  expiresIn: 60 * 60 * 24 * 30,  // 30 天
  updateAge: 60 * 60 * 24,       // 每被使用一次且距上次更新 >1 天，就把到期日往後推
}
```

- 預設值：`expiresIn = 7d`、`updateAge = 86400`（`1440 * 60`，見 `dist/context/create-context.mjs:146`）[已驗證]
- 關閉滑動：`disableSessionRefresh: true`
- session cookie 的 `maxAge` 直接吃 `session.expiresIn`（`dist/cookies/index.mjs`）[已驗證]
- 可選 `session.cookieCache`（把 session 快取進 cookie，減少每 request 一次 DB query）。**建議 POC 先不開**，等量測到 DB 壓力再說 — 開了之後 role 變更不會即時生效（最多延遲 `cookieCache.maxAge`）。這對「admin 改別人 role」的體感有影響。

### 2.5 Cookie（原始碼確認的預設值）

`dist/cookies/index.mjs` 的 `createCookieGetter()`：

| 屬性 | 預設 |
|---|---|
| 名稱 | `better-auth.session_token`；`baseURL` 為 https（或 production）時自動加 `__Secure-` prefix |
| `httpOnly` | `true` |
| `sameSite` | `"lax"` |
| `secure` | 跟著 `__Secure-` prefix 一起開 |
| `path` | `"/"` |
| `domain` | 只有開 `advanced.crossSubDomainCookies` 才設 |

可用 `advanced.cookiePrefix`、`advanced.cookies.session_token.{name,attributes}`、`advanced.defaultCookieAttributes` 覆寫。

### 2.6 SPA + `/api` 同網域 → 這是最舒服的情況

我們的部署是 **`book.smsk.church` 單一網域，`/api` 由 ingress 反代到 Hono**。因此：

- **同 origin**，`SameSite=Lax` 完全夠用，**不需要** `SameSite=None`、不需要 `partitioned`、不需要 CORS middleware、不需要 `crossSubDomainCookies`。
- `path: "/"` 讓 SPA 任何路由都帶得到 cookie。
- 前端 `fetch` 記得 `credentials: "include"`（同源其實 `same-origin` 就夠，但寫 `include` 比較不會在改網域時炸掉）。
- **LINE 的 redirect 一定落在 API 網域**，而 API 網域 = 前端網域，所以登入完直接 302 回 SPA 路由即可，沒有跨網域傳 session 的問題。

> 反例（**不要走**）：若日後把 API 拆到 `api.smsk.church`，就必須開 `crossSubDomainCookies.domain = ".smsk.church"` + `trustedOrigins` + CORS `credentials: true`。目前架構沒這需求。

### 2.7 CSRF

better-auth 的 CSRF 防護（<https://better-auth.com/docs/reference/security>）：

- 對狀態變更請求驗 **Origin header** against `trustedOrigins`
- session cookie `SameSite=Lax`
- 表單類路由額外用 **Fetch Metadata** headers
- GET 視為唯讀（OAuth callback 例外，改用 state + nonce 驗證）
- `disableCSRFCheck` / `disableOriginCheck` 存在但**絕對不要開**（後者連帶關掉全部 CSRF 保護）

→ 我們**不需要自己做 CSRF token**。設好 `trustedOrigins: ["https://book.smsk.church"]` 即可。

### 2.8 Role：兩條路，建議走輕的那條

**路線 A（建議）— `user.additionalFields`：**

```ts
user: {
  additionalFields: {
    role: { type: ["member", "staff", "admin"], required: false,
            defaultValue: "member", input: false },  // input:false = 使用者不能自己設
  },
},
```

授權邏輯寫在自己的 Hono middleware（`requireRole("staff")`），admin 改 role 就是自己一支 `PATCH /api/admin/users/:id/role`。**優點**：三層角色語意由我們掌握、schema 乾淨、不引入不需要的 ban/impersonate 欄位。

**路線 B — admin plugin：**

<https://better-auth.com/docs/plugins/admin>。給你 `POST /admin/set-role`、`defaultRole`、`adminRoles: [...]`、list/ban/impersonate users。代價：會在 `user` 表加 `banned` / `banReason` / `banExpires`，`session` 表加 `impersonatedBy`；而且自訂角色（`staff`）需要另外定義 access control。

> **建議 A。** decisions.md 明確寫「無審核流程」，ban / impersonate 都用不到；三層角色的授權規則（member 只能動自己的、staff 可改別人、admin 管場地/類別/角色）寫成 20 行 middleware 比配置 access control 直觀。

### 2.9 Drizzle + Postgres + Migration

```ts
database: drizzleAdapter(db, { provider: "pg" })
```

流程：`npx auth@latest generate` 產出 Drizzle schema → 併進我們的 `packages/db` schema → `drizzle-kit generate` + `migrate`。選項：`usePlural`（表名複數）、`schema`（指定自己的 schema object）。文件：<https://better-auth.com/docs/adapters/drizzle>

**核心表**：`user`、`session`、`account`、`verification`。`account` 欄位：`id`、`userId`、`providerId`、`accountId`、`password`、`createdAt`、`updatedAt`（+ token 欄位）。

**舊資料遷移（R6）** — 舊 `User.userId` 就是 LINE sub（例：`U459767a6e915e5fc8749df6de1926adf`），且舊 `Appointment.userId` FK 指向它。兩種做法：

- **做法 1（建議，零 remap）**：直接指定 `user.id = <舊 userId>`（better-auth 的 id 是 text，可外部指定），同時寫 `account { providerId: 'line', accountId: <舊 userId> }`。舊 `Appointment.userId` 原封不動就能 FK 到新 `user.id`。日後新註冊者拿到隨機 id，混用無妨。
- **做法 2**：`user.id` 讓 better-auth 產生，`account.accountId` 存 LINE sub，migration 時建一張 `old_userId → new user.id` 對照表把 appointment 重寫一遍。

官方的 migration script pattern（<https://better-auth.com/docs/guides/supabase-migration-guide>）示範的正是「user 表批次 insert + account 表以 `providerId` / `accountId` 對應 external identity」，可直接照抄結構。

**驗收條件**：以舊帳號登入 LINE 後，`getSession().user.id`（或其 `account.accountId`）等於舊 `User.userId`，且該使用者看得到自己以前的登記。

### 2.10 Hono 掛載

<https://better-auth.com/docs/integrations/hono>

```ts
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

同源就不用 `hono/cors`。文件另有 `advanced.defaultCookieAttributes`（`sameSite: "none"` 等）的跨網域寫法 — 我們用不到。

---

## 3. Auth.js / `@auth/core`

- 版本：**`@auth/core@0.41.3`**（2026-07-20）、`@auth/drizzle-adapter@1.11.3`（2026-07-20）、**`@hono/auth-js@1.1.1`（2026-02-14，半年沒動）**。[已驗證：npm]
- 文件：<https://authjs.dev>、Drizzle adapter <https://authjs.dev/reference/drizzle-adapter>

### 3.1 LINE 是 built-in provider（這是它唯一贏的地方）

`@auth/core/providers/line`，原始碼 [已驗證]：

```ts
export default function LINE<P extends LineProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: "line",
    name: "LINE",
    type: "oidc",
    issuer: "https://access.line.me",
    client: { id_token_signed_response_alg: "HS256" },
    style: { bg: "#00C300", text: "#fff" },
    options,
    checks: ["state"],
  }
}
```

重點：

- `type: "oidc"` → 走 `oauth4webapi` 的完整 OIDC 流程（discovery + **真的驗 id_token**），`id_token_signed_response_alg: "HS256"` 已預先處理 LINE 的簽章演算法怪癖。**這點比 better-auth 的 `decodeJwt` 嚴謹。**
- `checks: ["state"]` — 預設**沒開 PKCE**（LINE 支援 PKCE，可自行加 `checks: ["state", "pkce"]`）。
- Callback URL 是 `https://example.com/api/auth/callback/line`（比 better-auth 少一層 `oauth2/`）。
- `LineProfile` 型別已含 `sub` / `amr` / `name` / `picture`。
- 文件明講：**取 email 必須先在 LINE Console 申請 Email address permission**。

### 3.2 在 Hono 用它

`@hono/auth-js`（<https://github.com/honojs/middleware/tree/main/packages/auth-js>）：

```ts
app.use("*", initAuthConfig(c => ({ secret: c.env.AUTH_SECRET, providers: [LINE({...})] })))
app.use("/api/auth/*", authHandler())
app.use("/api/*", verifyAuth())   // 只掛需要登入的路由
```

env：`AUTH_SECRET`、`AUTH_URL=https://book.smsk.church/api/auth`。另提供 `getAuthUser(c)`、React 端 `SessionProvider` / `useSession()`。

**顧慮：**

1. **維護節奏**：`@hono/auth-js` 最後發版 2026-02-14，落後 `@auth/core` 兩個 minor。它是社群 middleware，不是 Auth.js 官方。
2. **peer dependency 含 `react`**（`react: "^18 || ^19"`）— 一個後端套件要求 react peer，在 `apps/api` 裡很怪（雖然 monorepo 下不會真的爆）。
3. **role 全部自己來**：加 `role` 欄位到 users table → `session` callback 把 role 塞進 session → 自己寫 admin 改 role 的 endpoint。沒有現成 `/admin/set-role`。
4. **database session 可用但要顯式設定** `session: { strategy: "database", maxAge: 30*24*3600, updateAge: 24*3600 }`，配 `@auth/drizzle-adapter`。社群回報 Drizzle adapter 在自訂 session 欄位上與 Prisma 有落差（<https://github.com/nextauthjs/next-auth/discussions/12848>）。
5. 文件生態嚴重偏 Next.js App Router，非 Next 的 Hono 情境要自己對照。

### 3.3 什麼情況才選 Auth.js

如果團隊裡有人已經很熟 Auth.js v5，或你對「id_token 必須完整驗簽」有硬性要求且不想自己覆寫 `getUserInfo` — 那 Auth.js 合理。否則 better-auth 在本專案的每一個維度都更順。

---

## 4. 自寫（Lucia 風格：arctic + Hono）

- **Lucia 已 deprecated**（`lucia@3.2.2`，npm 標記 `deprecated: "This package has been deprecated. Please see https://lucia-auth.com/lucia-v3/migrate."`）[已驗證]。它現在是一份「教你自己寫 session」的教學（<https://lucia-auth.com>），不是套件。
- **`arctic@3.7.0`**（2026-07-29）有 `Line` class [已驗證：`package/dist/providers/line.js`]：

```ts
class Line {
  constructor(clientId, clientSecret, redirectURI) {}
  createAuthorizationURL(state, codeVerifier, scopes)  // 自動加 S256 PKCE
  validateAuthorizationCode(code, codeVerifier)
  refreshAccessToken(refreshToken)
}
```

arctic **只負責 OAuth2 的 URL 組裝與 code 交換**。你要自己寫：state/PKCE 的暫存與比對、id_token 驗證、session table + 產生/輪替/撤銷 token（且必須 hash 後存 DB）、cookie 設定與 `__Secure-` prefix、滑動續期、CSRF Origin 檢查、logout、role middleware、以及所有這些的測試。

**估 3–5 天 + 永久維護成本**，換來的只有「少一個依賴」。decisions.md 已經寫「放棄自寫」，這裡的調查只是確認那個決定是對的 — **是對的**。

---

## 5. LINE 專屬地雷清單（不分套件，都要注意）

| # | 地雷 | 說明 / 對策 |
|---|---|---|
| L1 | **`redirect_uri` 必須完全字串相符** | LINE Console 的 Callback URL 要一字不差。better-auth 是 `/api/auth/oauth2/callback/line`、Auth.js 是 `/api/auth/callback/line`。**換套件就要改 Console 設定。** localhost 與 production 各註冊一條。 |
| L2 | **email scope 要事先申請** | LINE Console → 該 Login channel → 底部 **OpenID Connect → Email address permission → Apply**，通過前 `scope=email` 拿不到 email。decisions.md 說「email 永不出 API」→ **建議 POC 直接砍掉 email scope**，只要 `openid profile`，少一個審核依賴。 |
| L3 | **userId 綁 provider，不綁 channel** | 同一個 LINE Developers **provider** 底下的所有 channel（Login / Messaging API）共用同一組 userId；**不同 provider 就是不同 userId，且無法對應同一人**。decisions.md 已定「沿用同一個 LINE Login channel」→ 安全。**但務必確認新舊環境用的是同一個 provider 下的 channel**，否則全部舊資料對不上。userId 格式 `U[0-9a-f]{32}`，一旦發出就不變（除非使用者刪 LINE 帳號）。 |
| L4 | **id_token 簽章演算法分兩種** | web login = **HS256（key = channel secret）**；native app / LINE SDK / LIFF = **ES256（key 取自 JWKS `https://api.line.me/oauth2/v2.1/certs`，依 `kid`）**。我們只做 web，走 HS256。 |
| L5 | **`POST /oauth2/v2.1/verify`** | 參數只需 `id_token` + `client_id`，回傳解碼後的 payload。舊系統「每支 private API 都打一次 verify」是效能與可用性的坑（D2）；新架構**只在登入時打一次**（或乾脆本地驗 HS256）。 |
| L6 | `bot_prompt` | `normal` / `aggressive`，在登入畫面加「加入官方帳號好友」選項。decisions.md 說 LINE 通知不做 → **不要加這個參數**。 |
| L7 | `amr` | id_token 內的認證方式陣列（有條件才出現）。Auth.js 的 `LineProfile` 型別有列，我們用不到。 |
| L8 | `disable_auto_login` / `prompt` | LINE app 內建瀏覽器（LIFF/in-app browser）會自動登入。若要強制重新選帳號用 `prompt=login`；要停用自動登入用 `disable_auto_login=true`。**手機優先的教會使用者大多從 LINE 內開連結**，POC 一定要在 LINE in-app browser 實測一次。 |
| L9 | channel 分國家 | LINE 依國家分 channel（JP/TH/TW…）。better-auth 的 `line()` 支援多次呼叫配不同 `providerId`。我們**只有台灣一個 channel**，用預設 `providerId: "line"` 即可。 |
| L10 | channel secret 已外洩 | `env.sh` 已 commit 進 git（D1）。**POC 前先在 LINE Console 重發 channel secret**，新舊系統同時更新。重發 secret 不影響 userId。 |

---

## 6. 推薦

> **better-auth 1.6.29 + `genericOAuth` 的 `line()` preset + `drizzleAdapter(pg)` + `user.additionalFields.role`（不用 admin plugin）。**
> 唯一要動手補的是 **id_token 的驗證強化**（覆寫 `getUserInfo` 改打 LINE `/verify`，或本地 `jwtVerify` HS256），成本約 20 行。

**不選 Auth.js 的理由**：Hono 那層（`@hono/auth-js`）是社群包、半年未更新、還帶 react peer dep；role 與 admin 操作要全手寫；文件全是 Next.js。
**不選自寫的理由**：3–5 天 + 永久維護，換不到任何本專案需要的東西。

**版本策略**：釘 `1.6.x`（`~1.6.29`）。`1.7.0` 還在 rc（`1.7.0-rc.6`），**POC 不要碰**；1.7 有 CLI 與 Node 版本要求變動（需 Node ≥ 22.12）。

---

## 7. POC Checklist（半天 spike）

環境：`apps/api`（Hono + Drizzle + Postgres）、`apps/web`（Vite SPA），本機 `http://localhost:3000` 單 port（Vite proxy `/api` → Hono），這樣本機也是同源，跟 production 行為一致。

### 前置（30 分）

- [ ] LINE Console **重發 channel secret**（L10），記下 Channel ID / Secret
- [ ] 確認該 channel 與舊系統在**同一個 provider**（L3）— 用舊 DB 一筆真實 `userId` 事後驗證
- [ ] LINE Console 註冊兩條 Callback URL：
      `http://localhost:3000/api/auth/oauth2/callback/line`
      `https://book.smsk.church/api/auth/oauth2/callback/line`
- [ ] `.env`：`LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `BETTER_AUTH_SECRET`（`openssl rand -base64 32`）/ `BETTER_AUTH_URL=http://localhost:3000`

### 安裝與 schema（30 分）

- [ ] `pnpm add better-auth@~1.6.29 drizzle-orm pg` / `pnpm add -D auth@1.6.29 drizzle-kit`
- [ ] `npx auth@latest generate` → 產出 Drizzle schema，併入 `packages/db`
- [ ] `drizzle-kit generate && drizzle-kit migrate`，確認產出 `user` / `session` / `account` / `verification` 四張表，且 `user.role` 欄位存在

### 驗證項（每項都要真的看到證據）

- [ ] **V1 登入成功**：走完 LINE 授權 → 導回 → DB `user` 與 `account` 各多一列
- [ ] **V2 sub 落點**：`SELECT "providerId","accountId" FROM account` → `accountId` 等於你的 LINE userId（`U…` 32 hex）**且等於舊 `User.userId`**（R6 的關鍵驗收）
- [ ] **V3 cookie**：DevTools 看到 `better-auth.session_token`，`HttpOnly` ✓、`SameSite=Lax` ✓、`Path=/` ✓（本機 http 不會有 `__Secure-`；production 要再確認一次有）
- [ ] **V4 滑動續期**：把 `updateAge` 暫時調成 `10` 秒，登入 → 等 15 秒 → 打 `/api/auth/get-session` → `SELECT "expiresAt" FROM session` 確認往後推了
- [ ] **V5 logout**：`POST /api/auth/sign-out` → session 列消失 + cookie 被清
- [ ] **V6 role**：手動 `UPDATE "user" SET role='admin'` → `get-session` 回傳的 user 物件含 `role: "admin"`（確認 `additionalFields` 有進 session payload）
- [ ] **V7 CSRF**：用 `curl -H "Origin: https://evil.example"` 打 `sign-out`，應被拒
- [ ] **V8 公開讀**：未帶 cookie 打 `/api/appointments` 仍 200（確認 auth handler 只吃 `/api/auth/*`，沒有全域攔截）
- [ ] **V9 id_token 強化**：覆寫 `getUserInfo`，用 `jose.jwtVerify(idToken, secret, { algorithms:['HS256'], issuer:'https://access.line.me', audience: CHANNEL_ID })` 驗過，確認能通
- [ ] **V10 LINE in-app browser**：把 localhost 用 ngrok/cloudflared 開出去，**在手機 LINE 裡點連結**跑完整流程（L8）

### 最小程式碼草稿

`apps/api/src/auth.ts`：

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, line } from "better-auth/plugins/generic-oauth";
import { jwtVerify } from "jose";
import { db } from "./db";

const CHANNEL_ID = process.env.LINE_CHANNEL_ID!;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,          // http://localhost:3000
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",                          // → callback: /api/auth/oauth2/callback/line
  trustedOrigins: [process.env.BETTER_AUTH_URL!],

  database: drizzleAdapter(db, { provider: "pg" }),

  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 天
    updateAge: 60 * 60 * 24,        // 滑動：每天最多推一次
    // cookieCache: 先不開，避免 role 變更延遲生效
  },

  user: {
    additionalFields: {
      role: {
        type: ["member", "staff", "admin"],
        required: false,
        defaultValue: "member",
        input: false,               // 使用者不可自行設定
      },
    },
  },

  plugins: [
    genericOAuth({
      config: [
        line({
          clientId: CHANNEL_ID,
          clientSecret: CHANNEL_SECRET,
          scopes: ["openid", "profile"],   // 砍掉 email，免除 LINE 權限申請（L2）
          pkce: true,                       // LINE 支援 S256
          // 覆寫預設的 decodeJwt（不驗簽）→ 改成真的驗 HS256
          getUserInfo: async (tokens) => {
            if (!tokens.idToken) return null;
            const { payload } = await jwtVerify(
              tokens.idToken,
              new TextEncoder().encode(CHANNEL_SECRET),
              { algorithms: ["HS256"],
                issuer: "https://access.line.me",
                audience: CHANNEL_ID },
            );
            return {
              id: payload.sub as string,          // ← LINE userId，落進 account.accountId
              name: payload.name as string,
              image: payload.picture as string | undefined,
              email: undefined,
              emailVerified: false,
            };
          },
        }),
      ],
    }),
  ],
});
```

`apps/api/src/index.ts`：

```ts
import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono<{ Variables: { user: typeof auth.$Infer.Session.user | null } }>();

// 1) better-auth 全部路由（同源，不需要 cors）
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 2) 每個 request 解析一次 session，塞進 context（未登入 = null，不擋）
app.use("*", async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", s?.user ?? null);
  await next();
});

// 3) 授權 middleware（member/staff/admin 三層）
const RANK = { member: 0, staff: 1, admin: 2 } as const;
const requireRole = (min: keyof typeof RANK) => async (c: any, next: any) => {
  const u = c.get("user");
  if (!u) return c.json({ error: "unauthenticated" }, 401);
  if (RANK[u.role as keyof typeof RANK] < RANK[min]) return c.json({ error: "forbidden" }, 403);
  await next();
};

app.get("/api/appointments", listAppointments);                    // 公開可讀
app.post("/api/appointments", requireRole("member"), create);       // 登入才可建
app.patch("/api/rooms/:id", requireRole("admin"), updateRoom);      // admin 管場地

export default app;
```

前端（SPA）發起登入：

```ts
// 直接打 REST，不裝 better-auth client 也行
await fetch("/api/auth/sign-in/oauth2", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ providerId: "line", callbackURL: "/" }),
}).then(r => r.json()).then(({ url }) => { window.location.href = url; });
```

（或裝 `better-auth/react` 用 `authClient.signIn.oauth2({ providerId: "line", callbackURL: "/" })`。）

### 完成定義（DoD）

V1–V10 全綠，且能用**一筆真實舊使用者的 LINE 帳號**登入後，在 DB 裡看到 `account.accountId` == 舊 `User.userId`。達成即可把 decisions.md 的「better-auth vs Auth.js 待 POC」改成已定案，進 Phase 2。

---

## 8. 參考連結

**better-auth**
- 文件首頁 <https://better-auth.com/docs>
- Generic OAuth plugin（含 `line()`）<https://better-auth.com/docs/plugins/generic-oauth>
- Hono integration <https://better-auth.com/docs/integrations/hono>
- Drizzle adapter <https://better-auth.com/docs/adapters/drizzle>
- Session management <https://better-auth.com/docs/concepts/session-management>
- Cookies <https://better-auth.com/docs/concepts/cookies>
- Security（CSRF / trustedOrigins）<https://better-auth.com/docs/reference/security>
- Database / additionalFields <https://better-auth.com/docs/concepts/database>
- Admin plugin <https://better-auth.com/docs/plugins/admin>
- Migration guide（account 表對應 external identity 的 pattern）<https://better-auth.com/docs/guides/supabase-migration-guide>

**Auth.js**
- <https://authjs.dev>
- LINE provider 原始碼 <https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/line.ts>
- Drizzle adapter <https://authjs.dev/reference/drizzle-adapter>
- `@hono/auth-js` <https://github.com/honojs/middleware/tree/main/packages/auth-js>
- Drizzle + database session 討論串 <https://github.com/nextauthjs/next-auth/discussions/12848>

**自寫**
- Lucia（已改為教學）<https://lucia-auth.com>
- arctic <https://arcticjs.dev>

**LINE**
- Integrate LINE Login <https://developers.line.biz/en/docs/line-login/integrate-line-login/>
- Verify ID token（HS256/ES256、claims、`/verify`、JWKS）<https://developers.line.biz/en/docs/line-login/verify-id-token/>
- Getting user IDs（provider 範圍、`U[0-9a-f]{32}`、永不變）<https://developers.line.biz/en/docs/messaging-api/getting-user-ids/>
- Provider / channel 管理最佳實務 <https://developers.line.biz/en/docs/line-developers-console/best-practices-for-provider-and-channel-management/>

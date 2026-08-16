# API contract v2（Hono RPC，型別在 `packages/shared`）

型別來源：`apps/api/src/app.ts` 匯出 `AppType`（前端 `hc<AppType>()`），zod schema 在 `@smsk/shared`。

## 資料模型
- `room` / `category`：admin 維護；`colorToken` 對應 `@smsk/ui` 的 `bg-room-N` / `bg-cat-xxx`；所有場地皆做衝突偵測（曾有 allowOverlap，2026-08-16 移除）。
- `booking_series`：一筆登記 = 一個 series。`dtstart/dtend` 為第一次的起訖（timestamptz），`rrule` 為 RRULE body（無 DTSTART，UNTIL 為 UTC `Z`），`null` = 單次。`legacy_id` = 舊 `Appointment.pkId`。
- `booking_exception`：`(series_id, original_start)` 唯一；`cancelled` 或 `override_*`（時間/標題/備註/場地/類別）。
- 展開：server 端 `recur.ts`，**台北固定 +8 無 DST → 平移到 wall-clock 展開再平移回來**（BYDAY 依台北星期，不吃 rrule tzid）。

## 端點
| method | path | auth | 說明 |
|---|---|---|---|
| GET | `/api/me` | – | session user 或 `null` |
| GET | `/api/rooms`、`/api/categories` | – | 全部（含 inactive，前端自己濾） |
| GET | `/api/bookings?from&to` | – | 區間內**展開後的 instance**（`BookingInstance[]`）。未登入 `user=null`；`email` 永不出現。`id = "{seriesId}:{occurrenceStartISO}"` |
| POST | `/api/bookings` | member | `BookingInput` → 201 series；衝突 → **409 `{error:"conflict", conflicts:[...]}`**；`force` 只有 staff/admin 有效 |
| PATCH | `/api/bookings/:id` | owner 或 staff+ | `BookingPatch`：`scope` this/following/all + `occurrenceStart` + `patch`（partial）。this=寫 exception；following=舊 series 截 UNTIL + 新 series（COUNT 會換算剩餘）；all=改 series（起點位移時 exception 一起位移，rrule 改變則清 exception） |
| DELETE | `/api/bookings/:id?scope&occurrenceStart` | owner 或 staff+ | 同上語意；204 |
| POST/PATCH | `/api/admin/rooms(/:id)`、`/api/admin/categories(/:id)` | admin | |
| GET | `/api/admin/users`；PATCH `/api/admin/users/:id {role}` | admin | 不回 email |

## 前端 DnD 對應
- 拖曳 instance → PATCH `scope:"this"` + `occurrenceStart` + `patch:{start,end}`；「全部」→ `scope:"all"` 且 `patch.start = series.dtstart + delta`（前端算）。
- 409 時顯示 `conflicts`，staff/admin 可重送 `force:true`。

## 舊資料遷移
`pnpm --filter api migrate:legacy dump.sql`（`src/legacy.ts`）：解析 mysqldump → user（`email = {sub 小寫}@line.invalid`；若該 sub 已登入過 v2 則沿用既有 `user.id`）+ account（`providerId=line, accountId=sub`）→ series（`legacy_id` upsert，可重跑）→ exDate 轉 cancelled exception；未知 room/category 名自動建 inactive 列並警告；`flyyoungTeamName` 進 note。

## Dev / e2e 登入
`DEV_LOGIN=1` 時 `POST /api/dev/login {name, role}` 用 better-auth email/password（dev only）發真 session cookie；`e2e/booking.spec.ts` 與本機測試用。prod 不設此變數 → 404、emailAndPassword 關閉。

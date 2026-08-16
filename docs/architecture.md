# System Design — 石門教會場地登記 v2

> 對應 Phase 2–4 實作（2026-08-16）。決策理由在 `docs/decisions.md`，操作在 `infra/README.md`。

## 1. Runtime 拓撲（GCP 單 VM + k3s）

```mermaid
flowchart LR
  subgraph Client["使用者"]
    B[瀏覽器 / 手機<br/>React 19 SPA]
  end
  LINE[(LINE Login<br/>OAuth2 + id_token)]
  DNS[Cloudflare DNS<br/>book.smsk.church<br/>staging.book.smsk.church]

  subgraph GCP["GCP asia-east1 · e2-medium（US$25–35/月）"]
    subgraph VM["VM smsk-k3s · Debian 12 · k3s"]
      TR[Traefik Ingress<br/>:80 → 301 → :443<br/>Let's Encrypt via cert-manager]
      subgraph NSP["namespace smsk（prod）"]
        APP1[app Deployment<br/>Hono API + 靜態 SPA<br/>ghcr image :vX.Y.Z]
        PG1[(Postgres 17<br/>StatefulSet + local-path PVC 5Gi)]
        CJ1[CronJob pg-backup<br/>03:17 每日]
      end
      subgraph NSS["namespace smsk-staging"]
        APP2[app :sha-xxxxxxx]
        PG2[(Postgres 2Gi)]
        CJ2[CronJob pg-backup]
      end
      FLUX[Flux<br/>source/kustomize/helm controllers]
      CM[cert-manager]
    end
    GCS[(GCS bucket<br/>smsk-book-backups<br/>Standard · 30 天 lifecycle)]
  end

  B -- HTTPS --> DNS --> TR
  TR -- Host: book.… --> APP1
  TR -- Host: staging.… --> APP2
  APP1 --> PG1
  APP2 --> PG2
  B <-. 授權導向 .-> LINE
  APP1 -- 驗 id_token（HS256, channel secret）--> LINE
  CJ1 -- pg_dump | gzip → gsutil（VM SA scope）--> GCS
  CJ2 --> GCS
  FLUX -. 拉 git infra/ 每 5–10 分 .-> NSP & NSS & CM
```

**紀律**：無 GCP Load Balancer（Traefik 直綁 VM static IP）、無第二台 VM（staging 用 namespace）、20GB pd-standard、無 Ops Agent、無 Cloud SQL。

## 2. 應用內部（單一容器）

```mermaid
flowchart TB
  subgraph IMG["ghcr.io/mushding/shimen-church-book-system（node:22-alpine, tsx）"]
    direction TB
    S[serveStatic /assets/*, SPA fallback<br/>apps/web/dist] 
    H[Hono app.ts<br/>zod-validator · role middleware<br/>Hono RPC AppType]
    BA[better-auth<br/>generic-oauth line() + HS256 覆寫<br/>session cookie 30d 滑動]
    SVC[bookings.ts<br/>create / patch(this·following·all) / delete]
    REC[recur.ts<br/>RRULE 展開（台北 +8 固定平移）<br/>exception 套用]
    CF[conflicts.ts<br/>同場地區間重疊 → 409 + force]
    DR[Drizzle ORM<br/>DATABASE_URL → node-postgres<br/>否則 pglite（dev/test）]
  end
  H --> BA
  H --> SVC --> REC
  SVC --> CF --> REC
  SVC --> DR
  BA --> DR
  H --> S
```

前端（`apps/web`）：TanStack Router（`/`、`/admin`）+ Query → `hc<AppType>()` 型別直通 → FullCalendar v7 吃 **server 展開後的 instance**（`GET /api/bookings?from&to`），不自己算 rrule。

## 3. 資料模型

```mermaid
erDiagram
  user ||--o{ account : "LINE sub = account.accountId"
  user ||--o{ session : ""
  user ||--o{ booking_series : "登記人"
  room ||--o{ booking_series : ""
  category ||--o{ booking_series : ""
  booking_series ||--o{ booking_exception : "此筆改/取消"
  room {
    int id PK
    text name UK
    text color_token "room-N → bg-room-N"
    int sort
    bool active
  }
  category {
    int id PK
    text name UK
    text color_token "cat-xxx"
    int sort
    bool active
  }
  booking_series {
    int id PK
    text user_id FK
    int room_id FK
    int category_id FK
    text title
    text note
    timestamptz dtstart "第一次開始"
    timestamptz dtend "第一次結束（決定 duration）"
    text rrule "RRULE body，null=單次"
    int legacy_id UK "舊 pkId（備用）"
  }
  booking_exception {
    int id PK
    int series_id FK
    timestamptz original_start "UK(series_id, original_start)"
    bool cancelled
    timestamptz override_start
    timestamptz override_end
    text override_title
    text override_note
    int override_room_id
    int override_category_id
  }
  user {
    text id PK "better-auth 產生"
    text name
    text email "sub@line.invalid（永不出 API）"
    text image
    text role "member | staff | admin"
  }
```

一筆登記 = 一個 `booking_series`；「此筆」→ `booking_exception`；「此後」→ 舊 series 截 UNTIL + 新 series；「全部」→ 改 series。

## 4. 建立登記（含衝突）時序

```mermaid
sequenceDiagram
  actor U as 會友 / 幹事
  participant W as SPA (FullCalendar)
  participant A as Hono API
  participant C as conflicts.ts
  participant D as Postgres
  U->>W: FAB / 拖選時段 → 表單 → 儲存
  W->>A: POST /api/bookings {room, cat, start, end, rrule, force?}
  A->>A: session → role；zod 驗證
  A->>C: 展開候選 occurrences（≤2y）
  C->>D: 同場地 series + exceptions（含 override 移入）
  C->>C: 區間重疊比對
  alt 有衝突 且 !(force && role≥staff)
    A-->>W: 409 {conflicts:[{title,start,end}]}
    W-->>U: 表單顯示衝突對象；幹事可勾「強制建立」重送
  else
    A->>D: INSERT booking_series
    A-->>W: 201 series
    W->>A: GET /api/bookings?from&to（Query invalidate）
    A-->>W: 展開後 instances
  end
```

## 5. CI/CD → GitOps

```mermaid
flowchart LR
  DEV[git push main / tag vX.Y.Z] --> GH[GitHub Actions]
  GH --> CI[ci.yml<br/>typecheck · vitest 25 · vite build · Playwright e2e]
  GH --> IM[image.yml<br/>docker build → GHCR<br/>smoke: /healthz /api/rooms SPA]
  IM -- main --> BS[commit infra/apps/staging newTag=sha-xxxxxxx]
  IM -- tag v* --> BP[commit infra/apps/prod newTag=vX.Y.Z]
  BS & BP --> REPO[(repo main · infra/)]
  REPO -. Flux 拉取 .-> FL[Flux Kustomization<br/>controllers → apps-staging / apps-prod]
  FL --> K3S[k3s 滾動更新 Deployment]
  GHCR[(ghcr.io image)] --> K3S
```

回滾 = 把 overlay `newTag` 改回舊值 push。Secrets 不進 git（`kubectl create secret` 每 ns 一次；要 git 化再上 SOPS）。

## 6. 邊界與取捨
- **時區**：台灣無 DST → 用固定 +8 平移展開 RRULE，不用 rrule tzid（server/client 同一套）。
- **可見度**：未登入可看行事曆（標題/場地/時間/類別）；人名/頭像需登入；email 永不出 API。
- **權限**：member 動自己的；staff 動別人的 + force；admin 管場地/類別/角色。
- **不做**：LINE 通知、審核流程、雙語營模式、歷史資料遷移（舊資料已遺失）。
- **已知上限**：衝突偵測 O(n·m)（同場地兩年內 occurrences，數百級）；無限 rrule 只查 2 年；單 VM 單 Postgres 無 HA（備份每日）。

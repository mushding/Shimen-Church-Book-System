# 石門水庫教會場地登記系統 v2

教會場地（正堂、副堂、活動中心…）的線上登記系統：看行事曆、選時段、登記活動、衝突自動擋。給會友和長者用，所以介面走**大字、大按鈕、白話中文**。

- 正式站：<https://book.smsk.church>
- 測試站：<https://staging.book.smsk.church>

## 功能

- **行事曆**：週／月／清單三種檢視，未登入也能看（標題、場地、時間、類別）；姓名／頭像要登入才顯示。
- **登記**：一次只問一件事（活動名稱 → 場地 → 類別 → 時間），可設定每週／每月重複。
- **衝突偵測**：同場地時段重疊會擋下並顯示撞到誰；幹事／管理員可強制登記。
- **角色**：會友（只能改自己的）／幹事（可改別人的）／管理員（管場地、類別、角色）。
- **管理後台**：新增／排序／停用場地與類別，自選顏色；場地依區域分色（地下室藍、1 樓紅橘、2 樓黃、活動中心綠）。
- **設定**：大字模式、深色模式、顏色依場地或類別。
- 用 **LINE 登入**，不用另外記帳號密碼。

## 技術

pnpm monorepo：

| 目錄 | 內容 |
|---|---|
| `apps/web` | React + Vite + Tailwind v4 + FullCalendar 前端 |
| `apps/api` | Hono + Drizzle + better-auth（LINE）後端，同時 serve 靜態 SPA |
| `packages/ui` | 設計 tokens（顏色／字體／圓角，色票取自 [nipponcolors](https://nipponcolors.com/)） |
| `packages/shared` | zod schema 與型別（前後端共用） |
| `infra/` | k3s manifests、Flux GitOps、GCP 設定 |

資料庫 Postgres（本機開發預設用內嵌 pglite，免安裝）。部署在 GCP 單台 VM 的 k3s 上，GitHub Actions 建 image 推 GHCR，Flux 拉取更新。

## 本機開發

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # 填 LINE channel id/secret、BETTER_AUTH_SECRET
pnpm dev:api    # http://localhost:3000
pnpm dev:web    # http://localhost:5173（/api 反代到 3000）
```

其他指令：

```sh
pnpm typecheck   # 全 workspace tsc
pnpm test        # api vitest
pnpm e2e         # Playwright
pnpm --filter api set-role   # 指定使用者角色
```

## 部署

- push `main` → 自動部署到 **staging**（image tag `sha-xxxxxxx`）。
- push tag `vX.Y.Z` → 自動部署到 **prod**。
- 回滾：把 `infra/apps/{staging,prod}` 的 `newTag` 改回舊值 push。

## 文件

- `docs/decisions.md` — 已拍板的技術／產品決策
- `docs/architecture.md` — 系統設計（拓撲、資料模型、時序、CI/CD）
- `docs/design-system.md` — 設計系統與 tokens 使用規則
- `docs/api.md` — API
- `docs/pre-plan.md`、`docs/survey/` — 背景與 POC 結果

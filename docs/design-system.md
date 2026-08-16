# Design System v0.1（Phase 1，2026-08-16）

## 未來 session 實作 UI 前必讀（給 AI 的指引）
1. 視覺唯一真相：Claude Design **Design System「石門教會 Shimen Church」**
   - id：`c3a36bb4-32f6-45e6-b714-2a62a6a26a5b`
   - URL：https://claude.ai/design/p/c3a36bb4-32f6-45e6-b714-2a62a6a26a5b
   - 載入方式：`mcp__claude-design__get_claude_design_prompt(design_system_id="c3a36bb4-32f6-45e6-b714-2a62a6a26a5b")` → 會注入完整 guide；元件 markup 用 `mcp__claude-design__list_files/read_file` 讀 `components/*.html`。
   - 產新 mockup：`mcp__claude-design__create_project(name, design_system_id="c3a36bb4-…")`。
2. Code 真相：`packages/ui/src/tokens.css` + `theme.css`（Tailwind v4 utilities：`bg-primary text-fg bg-surface border-border bg-today bg-room-N border-cat-* font-display rounded-md`）。DS 的 `styles.css` 前半段 = tokens.css 複本；改色改 tokens.css 再重推 DS。
3. 畫面參考（探索 project，同 DS 風格）：「石門教會 場地登記 — 設計系統」
   - project id：`dc73d60d-9e41-42e0-9875-ba9f5f653f92`
   - 01 tokens/元件/手機三日：https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=%E7%9F%B3%E9%96%80%E6%95%99%E6%9C%83%E8%A8%AD%E8%A8%88%E7%B3%BB%E7%B5%B1.dc.html
   - 02 桌機週視圖亮/暗：https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=02+%E6%A1%8C%E6%A9%9F%E4%B8%BB%E7%95%AB%E9%9D%A2.dc.html
   - 03 新增/修改/衝突/重複/詳情/刪除：https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=03+%E6%96%B0%E5%A2%9E%E4%BF%AE%E6%94%B9%E7%99%BB%E8%A8%98.dc.html
   - 04 管理後台：https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=04+%E7%AE%A1%E7%90%86%E5%BE%8C%E5%8F%B0.dc.html
   - 05 登入/空/載入/錯誤/toast：https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=05+%E7%8B%80%E6%85%8B%E8%88%87%E7%99%BB%E5%85%A5.dc.html
   - 讀法：`mcp__claude-design__read_file(project_id="dc73d60d-…", path="03 新增修改登記.dc.html")`。
4. 參考來源：2026 雙語營 DS project `a99bc7dc-b807-440b-a88b-c25fc59cc847`（同教會 base，另一主題，勿直接套）。

## Claude Design **Design System**（正式）
- 名稱「石門教會 Shimen Church」，id `c3a36bb4-32f6-45e6-b714-2a62a6a26a5b`（type DESIGN_SYSTEM）。
- 來源 bundle：`packages/ui/design-system/`（readme.md 指南、styles.css = tokens + 元件層、foundations/、components/、templates/booking-mobile、theme.json、thumbnail.html）。
- 更新流程：改 `packages/ui/src/tokens.css` → 重生 `design-system/styles.css`（前半段是 tokens 複本）→ 用 `DesignSync`（或 `/design-sync`）推同一 projectId。
- 新 mockup 一律綁此 DS：`create_project(design_system_id=...)` 或 `get_claude_design_prompt(design_system_id=...)`。

## 真相在哪
- **探索/說明頁**：Claude Design 專案「石門教會 場地登記 — 設計系統」
  https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=%E7%9F%B3%E9%96%80%E6%95%99%E6%9C%83%E8%A8%AD%E8%A8%88%E7%B3%BB%E7%B5%B1.dc.html
  頁面（同一專案）：
  1. `石門教會設計系統.dc.html` — tokens、字體、基礎元件、手機三日視圖亮/暗、守則
  2. `02 桌機主畫面.dc.html` — 1280 週視圖亮/暗、場地 chips、popover、FAB
  3. `03 新增修改登記.dc.html` — 手機 sheet：新增表單、衝突 + 強制建立、重複規則、詳情、修改週期範圍（此筆/此後/全部）、刪除確認
  4. `04 管理後台.dc.html` — 場地列表（排序/啟用）、編輯場地（10 色 tokens 選色 + 預覽）、使用者與角色（member/staff/admin segmented）
  5. `05 狀態與登入.dc.html` — 登入頁、空狀態、載入骨架、錯誤、登入過期、toast 語彙
  共用 `ds.css`（與 tokens.css 同值）。
  **下一步（使用者操作）**：Claude Design UI → Create design system → from 此 project。之後我用 `list_design_systems` 取 id 綁定。
- **Code 真相**：`packages/ui/src/tokens.css`（CSS variables）+ `packages/ui/src/theme.css`（Tailwind v4 `@theme inline` 橋接）。
  Design 頁與 tokens.css 一比一；改色先改 tokens.css，再同步 Design 頁。

## 兩層結構
1. `--smsk-*`：石門教會 base（招牌藍綠 `oklch(0.42 0.06 205)`、奶油 `0.96 0.03 90`、紙 `0.99 0.015 95`、墨 `0.38 0.03 205`、線、警示紅、Huninn/Noto Sans TC）。營會等其他主題共用。
2. 語意層 `--bg/--surface/--fg/--muted/--primary/--primary-fg/--border/--danger/--today`：登記主題；`.dark` 只覆寫這層。
3. `--room-1..10`、`--cat-*`：場地/類別色票，亮暗不變。場地色 = 同 L/C 家族只變 hue。

## Tailwind 用法（apps/web）
```css
@import "tailwindcss";
@import "@smsk/ui/tokens.css";
@import "@smsk/ui/theme.css";
```
→ `bg-bg text-fg bg-surface border-border text-primary bg-primary text-primary-fg bg-today bg-room-5 border-cat-youth font-display rounded-md`…
暗色：在根元素加 `.dark`（`@custom-variant dark` 也已定義，可用 `dark:` 前綴做例外）。

## 設計假設（自主推導，可推翻）
- 全年工具型 → 不接營會黃/手繪；只繼承藍綠、奶油、Huninn。
- 標題 Huninn、內文/日曆 Noto Sans TC。
- 顏色主角是場地；藍綠只用於標題/主按鈕/選中/今天欄；紅只做刪除/衝突。
- 類別降為登記塊左側 4px 細條。
- 手機預設三日視圖；chips 橫捲；FAB 新增；詳情手機用 bottom sheet、桌機 popover。
- 圓角 8/12/16、膠囊按鈕、點擊目標 ≥ 44px；無漸層/玻璃/emoji。

## 踩雷
- Tailwind v4 不會跟進 workspace 套件 CSS 內的相對 `@import` → 兩個檔都在 app 端直接 import。
- 用 `@theme inline` 讓 utility 引用 `var(--bg)` 而非烘死值，`.dark` 才會生效。

## 待做（Phase 3 時）
- shadcn/ui 元件（Button/Chip/Sheet/Popover/Input/Segmented）依此 tokens 落到 `packages/ui`；showcase 頁。
- 使用者看過 Design 頁後的修訂（色相/字體/密度）。

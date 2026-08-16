# Design System v0.1（Phase 1，2026-08-16）

## 真相在哪
- **探索/說明頁**：Claude Design 專案「石門教會 場地登記 — 設計系統」
  https://claude.ai/design/p/dc73d60d-9e41-42e0-9875-ba9f5f653f92?file=%E7%9F%B3%E9%96%80%E6%95%99%E6%9C%83%E8%A8%AD%E8%A8%88%E7%B3%BB%E7%B5%B1.dc.html
  （tokens、字體、元件、手機主畫面亮/暗、守則）
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

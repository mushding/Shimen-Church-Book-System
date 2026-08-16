# 石門教會 Shimen Church design system

石門水庫教會的共同視覺基底：招牌藍綠、奶油紙底、Huninn 圓體標題、Noto Sans TC 內文。溫暖、克制、高可讀、手機優先。第一個消費者是「場地登記系統」（工具型），營會等活動網頁可在同一 base 上另開主題。

## How to use this

- 每頁連 `<link rel="stylesheet" href="styles.css">`（調整相對路徑），所有顏色/字體/圓角只用它的變數：`var(--primary)`、`var(--surface)`、`var(--room-5)`、`var(--r-md)`、`var(--smsk-font-display)`。不要硬寫 hex、字體名、px 圓角。
- 用下方列出的 class 組頁面，不另造平行 class；元件頁是純 HTML，view source 直接複製。
- 暗色：在根元素加 `.dark`；只有語意層（`--bg/--surface/--fg/--muted/--primary/--primary-fg/--border/--today`）改變，場地/類別色票不變。
- Code 真相在 `packages/ui/src/tokens.css`（本 `styles.css` 前半段即它的複本）+ Tailwind v4 橋接 `theme.css`（`bg-primary`、`bg-room-5`、`text-fg`…）。改色改 tokens.css，再同步這裡。

## Direction

- **顏色的主角是場地**。10 個場地色在 oklch 同一 L/C 家族（只變 hue），疊看不吵、白字可讀。UI 自身退後：藍綠只出現在標題、主按鈕、選中態、今天欄底色。
- 類別（教會/小組/青少契/社青/兒童/個人）降為登記塊左側 4px 細條或 10px 方點，不做底色。
- 紅只做刪除/衝突/錯誤，不做大面積底色。
- 手機優先：三日視圖為預設、chips 橫捲、FAB 新增、詳情用 bottom sheet；桌機週視圖 + popover。
- 圓角 8/12/16、按鈕膠囊、可點目標 ≥ 44px。無漸層、無玻璃擬態、無 emoji、無陰影堆疊。

## Color

Base：`--smsk-teal` oklch(0.42 0.06 205)、`--smsk-cream` (0.96 0.03 90)、`--smsk-paper` (0.99 0.015 95)、`--smsk-ink` (0.38 0.03 205)、`--smsk-line`、`--smsk-red` (0.52 0.15 25)、`--smsk-teal-soft`。
Semantic：`--bg --surface --fg --muted --primary --primary-fg --border --danger --today`。
場地：`--room-1…10`（地下室大/地下室小/協談室/兒童室/副堂/正堂/活動中心大/活動中心小/圖書室/禱告室）+ 對應 class `.room-N{background}`。
類別：`--cat-church/group/youth/young/kids/personal` + `.cat-*{background}`。

## Type

`--smsk-font-display` Huninn（標題、品牌、月份、sheet 標題）；`--smsk-font-body` Noto Sans TC（內文 15、chip/按鈕 13/700、日曆塊 12、格線 11）。

## Components

| Class | What | Shown in |
| --- | --- | --- |
| `.btn` + `.btn-primary / .btn-ghost / .btn-danger / .btn-danger-solid / .btn-sm`, `.btn-icon`, `.fab` | 動作；主色只給一個主要動作 | components/buttons.html |
| `.chip` + `.room-N` / `.chip-off` / `.chip-cat` + `.catdot` / `.chip-sm` | 場地多選 chips、類別 chips | components/chips.html |
| `.seg` + `.segi(.on)`, `.badge(.badge-role)`, `.tog(.on)` | 視圖切換、角色標籤、開關 | components/chips.html |
| `.field` + `.label` + `.input(.input-err)`, `.opt(.on)` + `.radio(.on)` / `.check(.on)` | 表單、選項卡 | components/forms.html |
| `.ev` + `.room-N` + `.ev-cat.cat-*` + `.ev-t/.ev-m` | 日曆登記塊（↻ 表週期） | components/calendar.html |
| `.card`, `.warn`, `.sheet` + `.grab`, `.dim` | 卡片/popover、衝突提示、bottom sheet、遮罩 | components/calendar.html, feedback.html |
| `.toast(-ok/-err/-info)` | 底部置中 3 秒；錯誤手動關 | components/feedback.html |
| `.topbar`, `.appbar`, `.chipsrow`, `.side` + `.navi(.on)` | 桌機/手機/管理導覽 | components/navigation.html |
| `.dow(.on)`, `.cell(.today)`, `.hour` | 日曆格線 | templates/booking-mobile/index.html |

互動態：`.btn:hover` 亮度 0.94、`:active` 0.88；`:focus-visible` 2px `--primary` outline；`::selection` 用 `--today`；disabled 45%。

## Do
- 讓場地色說話；UI 中性。
- 手機一頁完成登記；衝突在儲存前顯示並給下一步。
- 文案短、直說、不賣萌；錯誤一定給下一步。

## Don't
- 不用漸層/玻璃/emoji；不用紫色。
- 類別不搶主色；紅不做底色。
- 不在 390px 手機用七欄週視圖。

## Files
- `styles.css` — tokens + component layer（唯一 stylesheet）。
- `theme.json` — 參數紀錄。
- `thumbnail.html` — 封面。
- `foundations/color.html`、`type.html`、`layout.html`。
- `components/buttons.html`、`chips.html`、`forms.html`、`calendar.html`、`feedback.html`、`navigation.html`。
- `templates/booking-mobile/index.html` — 手機三日視圖起始頁。
- 探索用 mockups（桌機週視圖、登記流程、管理後台、狀態頁）在 Claude Design 專案「石門教會 場地登記 — 設計系統」。

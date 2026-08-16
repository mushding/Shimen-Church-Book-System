# 04 - POC 結果：FullCalendar v7 + Tailwind v4（2026-08-16）

Code：`apps/web/`（`pnpm dev:web`）。驗證用 Playwright headless（1280×900 + 390×844）。

| # | 項目 | 結果 | 證據 |
|---|---|---|---|
| 1 | Vite 7 + React 19 + subpath import（`@fullcalendar/react/timegrid` 等）| ✅ | `tsc` 0 error、`vite build` 無 warning（除 chunk size 提示）、StrictMode 無 console error |
| 2 | Tailwind theme 整合（只載 `skeleton.css`，只用 `*Class` props）| ✅ | 亮/暗兩模式截圖；**零行 `.fc-*` override CSS**、無 `!important` |
| 3 | 多房間疊看 + Tailwind token 著色 + checkbox 篩選 | ✅ | `eventClass` 依 `extendedProps.roomId` 給 `bg-room-N`；取消勾選後該房間事件數 = 0 |
| 4 | RRULE + EXDATE（字串與物件兩種寫法）| ✅ | 月視圖：主日崇拜 2 次（8/16、8/30；8/23 EXDATE 正確消失）、每月第一週六 1 次 |
| 5 | 拖曳/resize + 週期 occurrence 語意 | ✅ | `eventDrop` 給 `event.id`（= series id）、`event.start`（新）、`oldEvent.start`（原 occurrence 時間）、`delta` → 足以判斷「哪條 series 的哪一次」；`revert()` 可用 |
| 6 | **真機觸控** | ⏳ 待驗 | dev server 已 `--host`，手機同 Wi-Fi 開 `http://<LAN-IP>:5173`；`eventLongPressDelay=400` |
| 7 | 自訂渲染 + popover | ✅ | `eventContent` 回 React 元件；`eventClick` 用 `info.el` 定位自製 popover（POC 未裝 shadcn，正式用 Popover/Sheet）|
| 8 | zh-TW 單一 locale + bundle | ✅ | 整包 gz **150.5KB 含 React**（日曆 + rrule + temporal ≈ 105KB）< 150KB 目標 |

## 決策筆記（#5：週期事件寫回策略）
- 拖 occurrence 時 library 只給「series id + 原/新時間」，**不會**幫你分裂 series。
- App 層流程：`eventDrop` → 若 `isSeries` → 先 `revert()` → 彈「此筆 / 此後 / 全部」→
  - 此筆：`booking_exception` 新增（原 occurrence 時間 → override 新時間）
  - 此後：原 series `UNTIL=原時間-1s`，新建 series 從新時間起
  - 全部：改 series `dtstart` 位移 `delta`
- 這正是 survey 01 的結論：recurrence 是 domain model 一等公民。

## v7 踩雷紀錄
- `temporal-polyfill` peer 必須 `^1.0.1`（npm 預設裝到 0.3 會 unmet peer）。
- 按鈕 class callback 的 info 是 `ButtonInfo{ isSelected, isPrimary, isDisabled }`（不是 v6 的 `fc-button-active`）。
- 視圖切換按鈕 render 成 `role="tab"`，寫 e2e 用 `getByRole("tab")`。
- Context7 / 網路文件多為 v6，以套件內 `chunks/*.d.ts` 為準。

## 結論
桌機 8 項中 7 項通過、1 項待真機。**FullCalendar v7 定案**（真機若 #6 失敗再轉 @event-calendar）。

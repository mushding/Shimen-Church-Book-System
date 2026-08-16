# 01 — React Calendar / Scheduler Library 選型調查

> 調查日期：2026-08-15
> 目標專案：石門教會場地借用系統改版（React 19 + Vite SPA + Tailwind v4 + shadcn/ui + TypeScript）
> 所有版本號、license、維護狀態均於 2026-08-15 當日對 npm registry、GitHub API 與官方文件實際查證（部分結論來自實際解壓 npm tarball 檢查檔案內容），非依賴既有印象。

---

## 0. 結論先講（TL;DR）

**首選：FullCalendar v7（MIT 免費層，`@fullcalendar/react` 7.0.2）**

關鍵理由：本專案的全部 must-have 都落在 **MIT 免費層**，完全不需要碰 Premium，因此 FullCalendar Premium 的 "non-commercial Creative Commons" 授權爭議對我們 **不成立問題**。v7（2026-06-19 發布）剛好做完一次大改版，新的 theme system 是「每個 element 一個 `*Class` prop」，官方文件直接把 **Tailwind CSS 列為第一等公民**，這正好解掉本專案最痛的第 7 項（不想跟內建 theme 打架）。

**備選：@event-calendar v5.12.0（vkurko，MIT）** — 免費就有 resource timeline、DnD、resize、CSS 變數主題，但沒有官方 React wrapper、event 內容不能用 React component 渲染，需自行包一層。

**明確淘汰：**

| Library | 淘汰原因 |
|---|---|
| **Schedule-X v4** | v4 把 **drag-and-drop 與 resize 移到付費** `@sx-premium/*`（公開 npm 404），直接違反 must-have #6 |
| **MUI X Scheduler v9** | 三重致命傷：runtime **硬綁 `@mui/material` + emotion**、**沒有 custom event rendering**、**beta 且 stable 已被官方取消** |
| **DayPilot Lite** | Calendar 元件的 **Touch Devices 在 Lite 是 "No Support"**（付費功能），recurring events 也是 Pro-only |
| **react-big-calendar** | **touch 上的 drag-and-drop 自 2023 起壞掉且未修**（#2413），無 recurrence，型別靠已落後 11 個月的 DefinitelyTyped |
| **Syncfusion / Bryntum / Mobiscroll** | 商業授權，見 §3.4 |

---

## 1. 評分總表

評分規則：**0 = 不支援／需付費／有硬傷；1 = 部分支援或需自己補；2 = 原生良好支援**。滿分 18。

| # | 評分項目 | **FullCalendar v7** | **@event-calendar v5** | **Schedule-X v4** | **react-big-calendar** | **MUI X Scheduler v9** | **DayPilot Lite** |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| — | 版本 / 日期 | 7.0.2 (2026-07-24) | 5.12.0 (2026-07-31) | 4.6.1 (2026-07-08) | 1.20.0 (2026-06-01) | 9.0.0-**beta.9** (2026-08-06) | 5.10.0 (2026-07-15) |
| — | License | **MIT** | **MIT** | MIT 核心／**付費**外掛 | **MIT** | MIT 核心／**付費** Premium | Apache-2.0（僅 minified） |
| 1 | 多 resource 同格疊圖＋著色＋篩選 | **2** | **2** | **2** | **2** | **2** | 1 |
| 2 | Week / Day / Month（＋3-day） | **2** | **2** | 1 | 1 | **2** | **2** |
| 3 | RRULE + EXDATE 例外 | **2** | 1 | 1 | 1 | **0** | **0** |
| 4 | 自訂 React component 渲染 event ＋ click popover | **2** | **0** | **2** | **2** | **0** | 1 |
| 5 | 行動裝置 touch / RWD / 效能 | **2** | **2** | **2** | **0** | 1 | **0** |
| 6 | 拖曳移動 ＋ 拉伸改長度（**MUST**） | **2** | **2** | **0** | 1 | **2** | 1 |
| 7 | 完全視覺客製（Tailwind / CSS vars，不綁 UI kit） | **2** | **2** | **2** | 1 | **0** | **0** |
| 8 | TS 品質 / React 19 / bundle / 維護訊號 | 1 | 1 | 1 | 1 | 1 | **0** |
| 9 | zh-TW 在地化 ＋ 日期庫整合 | **2** | 1 | **2** | **2** | 1 | **2** |
| | **總分 / 18** | **17** | **13** | **13** | **11** | **9** | **7** |
| | **硬性篩選（must-have #6）** | ✅ 通過 | ✅ 通過 | ❌ **付費** | ⚠️ 桌機可、touch 壞 | ✅ 通過 | ⚠️ 桌機可、touch 付費 |

> 註：Schedule-X 與 MUI X 的分數是以「**免費層**」計算。若付費，Schedule-X #6 可得 2、MUI X #3 可得 1。

---

## 2. License 判定（硬性篩選）

### 2.1 FullCalendar — ✅ **通過，而且不需要 Premium**

FullCalendar 是**雙層結構**，兩層授權完全不同：

| 層 | 套件 | License |
|---|---|---|
| 標準層 | `@fullcalendar/react`、`@fullcalendar/core`、`@fullcalendar/rrule`、`fullcalendar` | **MIT** |
| Premium | `@fullcalendar/react-scheduler`（v7 起改名，內含 Timeline View、Vertical Resource View、Print Optimization） | `SEE LICENSE IN LICENSE.md`（tri-license） |

**實際驗證**：解壓 `@fullcalendar/react@7.0.2` tarball，`package.json` 的 `license` 欄位為 `"MIT"`，`LICENSE.md` 為標準 MIT，`copyright: 2026 Adam Shaw`。`@fullcalendar/rrule@7.0.2` 同樣是 MIT（peer dep `rrule ^2.6.0`，BSD-3-Clause）。

**Premium 的 tri-license 原文**（取自 `@fullcalendar/react-scheduler@7.0.2` 的 `LICENSE.md`）：

> FullCalendar Premium is tri-licensed, meaning you must choose one of three licenses to use. Here is a summary of those licenses:
> - Commercial License (a paid license, intended for commercial use) — https://fullcalendar.io/commercial-license
> - Creative Commons Non-Commercial No-Derivatives (intended for trial and non-commercial use) — https://creativecommons.org/licenses/by-nc-nd/4.0/
> - AGPLv3 License (intended for open-source projects) — https://www.gnu.org/licenses/agpl-3.0.en.html

**非營利條款原文**（https://fullcalendar.io/license）：

> "Registered non-profit organizations" are able to use FullCalendar Premium with a free, non-commercial license.
>
> "Governmental entities and universities are not covered by this non-commercial license."
>
> "This license does not permit source code modifications."

**教會是否適用的判定：**

- 條文用的是 **"Registered** non-profit organizations"（**已立案**）。台灣的教會若已登記為**宗教財團法人 / 社團法人**，文義上符合；若只是未立案的聚會點，**不符合**。
- CC BY-NC-ND 4.0 的 **ND（No-Derivatives）** 對應到條文的「不允許修改原始碼」。這代表一旦踩到 Premium 的 bug，我們**不能自己 patch**（連 `patch-package` 都違約）。
- CC BY-NC-ND **不是 OSI 認可的開源授權**，且 "non-commercial" 在法律上是有名的模糊地帶。

**➜ 建議：不要讓架構依賴 Premium。** 本專案需要的功能（多房間疊圖、週/日/月、rrule、拖拉、resize、自訂渲染）**全部在 MIT 層**。Premium 只多了「每個房間一個直欄」（Vertical Resource View）與「水平時間軸」（Timeline）——這兩個是 nice-to-have，不是 must-have（需求明確寫了 "NOT necessarily separate columns per resource"）。若日後真的想要資源直欄，再走非營利申請，或改用 §3.2 的 @event-calendar（免費就有）。

### 2.2 Schedule-X — ❌ **不通過**

v4 遷移文件（https://schedule-x.dev/docs/calendar/major-version-migrations）明文：

> `@schedule-x/drag-and-drop` moved to `@sx-premium/drag-and-drop`
> `@schedule-x/resize` moved to `@sx-premium/resize`

DnD 文件頁（https://schedule-x.dev/docs/calendar/plugins/drag-and-drop）現在寫著 "This is a premium plugin which requires an active license to be used."，安裝需要 `.npmrc` 指向私有 registry。實測 `npm view @sx-premium/drag-and-drop` → **404**。

價格：€479/年 或 €999 買斷（2–3 人團隊，**每個 project 一份**）。**條款中沒有任何非營利／慈善／教育免費條款**（https://schedule-x.dev/terms-and-conditions）；唯一的「特殊授權」條款是針對競品函式庫，不是慈善機構。

> **註（不建議但存在的繞道）**：舊版 `@schedule-x/drag-and-drop@3.7.3` 與 `@schedule-x/resize@3.7.3` 仍是 MIT 且留在公開 npm 上。實測 v4.6.1 core 仍保有全部 DnD/resize 呼叫點，`ResizePlugin` 介面在 v3→v4 **完全未變**（可直接 drop-in），DnD 只差三個方法改名（`createTimeGridDragHandler` → `startTimeGridDrag` 等），寫 ~10 行 shim 即可。法律上沒問題（MIT），但這等同於用作者自己遺留的 artifact 繞過他的 paywall，且 v3 已於 2026-01-14 終止維護、隨時可能被下一個 minor 打斷。**不建議把生產系統建在這上面。**

### 2.3 MUI X Scheduler — ⚠️ 免費層可用但功能不足

Community `@mui/x-scheduler` 是 **MIT**，但 **recurring events + exception dates 屬於 Premium** `@mui/x-scheduler-premium`（$599/年/開發者）。MUI 對非營利／慈善提供 **50% 折扣**（需提供證明文件），但**沒有免費方案**。加上 2026-04-08 起改為 application-based licensing。

### 2.4 其他商業產品（僅記錄授權，不深入評估）

| 產品 | 授權結論 |
|---|---|
| **Syncfusion React Scheduler** (`@syncfusion/ej2-react-schedule` 34.2.3) | Community License **可能適用**：非營利組織年度**總預算 < 100 萬美元**即可免費。但需註冊 license key、屬可隨時變更的商業授權、且自帶 Material/Fluent 主題與 Tailwind 相衝。**不推薦** |
| **Bryntum Calendar** | 純商業。有「未募資新創／< 10 人 / < 100 萬美元營收」優惠，**無非營利免費方案** |
| **Mobiscroll Event Calendar** | 純商業，$595/開發者起（永久授權 + 1 年更新）。90 天試用。**無非營利免費方案** |
| **Toast UI Calendar** (`@toast-ui/react-calendar` 2.1.3) | MIT，但 **最後發布是 2022-08-16，已實質停止維護**。直接淘汰 |

---

## 3. 各 Library 詳細筆記

### 3.1 ⭐ FullCalendar v7 — 總分 17/18

**版本事實**
- `@fullcalendar/react` **7.0.2**，2026-07-24 發布；v7.0.0 於 **2026-06-19** 發布（距今約 2 個月）
- MIT；peer deps：`react ^17 || ^18 || ^19`、`react-dom`、`temporal-polyfill ^1.0.1`
- GitHub 20.6k stars / 1.1k open issues / 56 open PRs（https://github.com/fullcalendar/fullcalendar）
- npm 週下載 ~1.67M（`@fullcalendar/react`）

**v7 是一次真正的大改版**（https://fullcalendar.io/docs/upgrading-from-v6）：
- **React connector 改為純 React 實作**（v6 以前底層是 Preact），支援 SSR 與 StrictMode
- 套件結構重整：daygrid/timegrid/interaction 不再是獨立 npm 套件，改為 **subpath entrypoint**（`@fullcalendar/react/daygrid`、`/timegrid`、`/interaction`、`/list`、`/multimonth`）。⚠️ 注意 `@fullcalendar/daygrid` 在 npm 上的 `latest` tag 仍是 6.1.21，這是**預期行為**，不是版本落後
- Theme 從 core 拉出成為 plugin，內建 5 套主題：`classic`、`monarch`、`forma`、`breezy`、`pulse`，含 dark mode
- HTML/CSS 全面重構為 flexbox（原本是巢狀 table），效能與 a11y 改善，並為未來 virtual rendering 鋪路
- **Temporal API**：`temporal-polyfill` 成為必要 peer dep，時區處理內建，**移除了 moment/luxon timezone plugin**
- 移除：Vue 2、Bootstrap 4/5 主題、`updateSize()`、`windowResize`

**逐項評分**

| # | 分 | 證據 |
|---|:--:|---|
| 1 | **2** | 免費層沒有 `resources` 資料模型，但需求要的是「同一格疊圖」——直接把所有房間的 booking 丟進同一個 `timeGrid`，用 event 的 `backgroundColor` / `borderColor` / `classNames` 依房間著色，篩選則在 app 層過濾 events 陣列即可。這反而更貼合 shadcn 的設計（我們自己畫 room legend + checkbox）。**代價：資源直欄（Vertical Resource View）與水平 Timeline 是 Premium** |
| 2 | **2** | `dayGridMonth` / `timeGridWeek` / `timeGridDay` / `multiMonth` / `list` 全在免費層。**3-day view 用 custom view 一行搞定**：`views={{ threeDay: { type: 'timeGrid', duration: { days: 3 } } }}` |
| 3 | **2** | `@fullcalendar/rrule@7.0.2`（MIT）。實際檢查其 `index.d.ts`，event refiner 提供 **`rrule`（物件或 iCalendar 字串）、`exrule`、`exdate`、`duration`** 四個欄位，內部用 `rrule.RRuleSet`。⚠️ **「編輯此筆／此後所有／全部」必須自己在 app 層實作**——library 只負責展開與渲染，不管拖曳單一 occurrence 後要怎麼寫回 DB。這是所有候選者的共同狀況（見 §4） |
| 4 | **2** | 從 tarball 型別檔實測共有 **20 個 `*Content` render hook**：`eventContent`、`dayCellTopContent`、`dayHeaderContent`、`moreLinkContent`、`popoverContent`、`noEventsContent`、`slotHeaderContent`、`nowIndicatorLineContent` 等，**全部可回傳 React JSX**。搭配 `eventClick(info)` 拿到 DOM element 當 anchor，掛 shadcn `Popover` / `Sheet` |
| 5 | **2** | tarball 內實測含 `pointerdown`(17)、`touchstart`(4)、`touchmove`(5)、`longPressDelay`、`eventLongPressDelay` — 觸控長按拖曳為原生支援。v7 的 flexbox 重構直接改善手機效能 |
| 6 | **2** | `@fullcalendar/react/interaction`，免費。`editable` / `eventStartEditable` / `eventDurationEditable` / `eventResizableFromStart`，callback `eventDrop` / `eventResize` |
| 7 | **2** | **這是 v7 的殺手鐧。** 實測型別檔中有 **60+ 個 `*Class` props**：`eventClass`、`eventInnerClass`、`eventTitleClass`、`eventTimeClass`、`dayCellClass`、`dayHeaderClass`、`dayLaneClass`、`buttonClass`、`headerToolbarClass`、`highlightClass`、`slotLabelClass`… 每個都接受 `string` 或 `(state) => string`。官方 CSS 客製文件（https://fullcalendar.io/docs/css-customization）**明列 Tailwind CSS 為三種支援的 styling 方式之一**，並示範用 `state.isToday` 做條件式 class。`skeleton.css` 僅 **2.2KB gz**（純結構，無外觀），主題 CSS 另外 3KB gz 且可完全不載入。**零 UI kit 依賴** |
| 8 | **1** | 型別**內建**（`types: "./index.d.ts"`，非 DefinitelyTyped），品質好。React 19 明確在 peer range。Bundle：全部 24 個 chunk 加總 132KB gz（含所有 view 與主題），實務上只載 timeGrid + dayGrid + interaction + 1 主題 **約 70–90KB gz**，另加 `temporal-polyfill` **~33KB gz**（tree-shakeable，可再降）與 `rrule` **13.6KB gz**。**扣分原因**：(a) v7 才 2 個月大，社群範例與 StackOverflow 答案幾乎都還是 v6 語法，theme API 是全新的；(b) 1.1k open issues 偏高；(c) 實質單一維護者（Adam Shaw），bus factor = 1 |
| 9 | **2** | tarball 內實測 **79 個 locale**，`locales/zh-tw.js` 存在且內容正確（`prevText: '上個'`、`todayText: '今天'`、`moreLinkText: '顯示更多'`、`noEventsText: '沒有任何活動'`…）。**不需要 dayjs / date-fns**——日期運算走 Temporal，格式化走 `Intl`。這對本專案是加分：少一個日期庫 |

**Sources**：[fullcalendar.io/docs/react](https://fullcalendar.io/docs/react) · [css-customization](https://fullcalendar.io/docs/css-customization) · [upgrading-from-v6](https://fullcalendar.io/docs/upgrading-from-v6) · [rrule-plugin](https://fullcalendar.io/docs/rrule-plugin) · [premium](https://fullcalendar.io/docs/premium) · [license](https://fullcalendar.io/license) · [GitHub](https://github.com/fullcalendar/fullcalendar)

---

### 3.2 @event-calendar v5（vkurko）— 總分 13/18 ★ 備選

**版本事實**：`@event-calendar/core` **5.12.0**，2026-07-31，**MIT**，2.3k stars（https://github.com/vkurko/calendar）。v5 已把所有子套件合併成單一 `@event-calendar/core`（v3 時代的 `@event-calendar/time-grid` 等已凍結在 3.12.0）。

**最大亮點**：**resource views 完全免費**。支援 Day Grid（day/week/month）、Time Grid（day/week）、List（day/week/month/year）、**Resource Time Grid**（day/week）、**Resource Timeline**（day/week/month/year）。這正是 FullCalendar 要付費的部分。DnD、resize、觸控長按（long-press）也全免費。CSS 變數主題 + `ec-dark` 深色模式。dist 僅 **42.5KB gz + 3.6KB CSS**。

**致命弱點（#4 = 0 分）**：
- **沒有官方 React wrapper**。README 只提供原生 JS 與 Svelte 5 元件，React 要自己包一層 `useEffect` + `createCalendar()`。
- **`eventContent` 型別是 `Content | ((info) => Content)`，其中 `Content` 是 HTML 字串 / DOM node**，不是 React element。另一組 `Snippet<[EventContentInfo]>` 是 **Svelte snippet**，React 用不到。要在 event 內渲染 React 元件只能走 `createPortal` 到 `eventDidMount` 給的 DOM 節點——可行但很髒。
- **Svelte 是 runtime 依賴**：實測 `dist/index.js` 開頭就 `import { ... } from "svelte"`、`"svelte/internal/client"`、`"svelte/reactivity"`。React app 會同時載入 Svelte runtime。
- **無 recurrence 支援**（#3 = 1，需自行用 `rrule` 展開）。
- i18n 只有 `locale?: string`（走 Intl），UI 文字需自己用 `buttonText` 等覆寫（#9 = 1）。

**適用時機**：如果日後需求變成「每個房間一個直欄／水平時間軸」且不想付 FullCalendar Premium，這是唯一免費且成熟的選項。

---

### 3.3 Schedule-X v4 — 總分 13/18（因 must-have #6 淘汰）

**版本事實**：`@schedule-x/calendar` **4.6.1**（2026-07-08）、`@schedule-x/react` 4.1.0，MIT，2,526 stars / 39 open issues，最後 push 2026-08-14（活躍）。npm 週下載 179k。

**優點**（若付費則很有競爭力）：
- **`@schedule-x/theme-shadcn` 官方 shadcn 主題**（https://schedule-x.dev/docs/calendar/theme），且暴露完整 CSS 變數（`--sx-color-primary`、`--sx-color-surface`、`--sx-color-outline`…），與我們的設計系統天生契合
- `customComponents` 提供 17+ 個 **React component slot**（`timeGridEvent`、`monthGridEvent`、`eventModal`、`headerContent*`…），`@schedule-x/event-modal` 免費
- `calendars` 概念（每個 room 一個 calendar，含 light/dark 完整色票），篩選用 `eventsService.set(filtered)` 自己做
- `@schedule-x/event-recurrence` **免費 MIT**，支援 `FREQ`/`INTERVAL`/`COUNT`/`UNTIL`/`BYDAY`/`BYMONTHDAY`/`WKST` 與 **EXDATE**。官方自承是 "a partial implementation"：`BYMONTHDAY` 只吃單值且僅限 `MONTHLY`；帶序數的 `BYDAY`（如 `2TU`，「每月第二個週二」）**無法用拖曳更新**
- 內建 700px 響應式斷點，`monthAgenda` / `weekAgenda` 為小螢幕視圖
- zh-TW 內建（共 ~37 locale）

**淘汰原因與其他扣分**：
- **DnD + resize 付費**（見 §2.2）→ #6 = 0，硬性淘汰
- **Preact 會跟 React 一起進 bundle**：peer deps 為 `preact ^10.19.2` + `@preact/signals ^2.0.2`，實測 `dist/core.js` 有對 `preact`、`preact/compat`、`preact/hooks`、`preact/jsx-runtime` 的 live external import。⚠️ 若專案用了 `react → preact/compat` 的 alias 技巧會直接爆掉
- `temporal-polyfill` **鎖死 `0.3.0`**（非 range），與其他相依可能衝突
- 總 bundle ≈ **105KB gz**（core 56 + Preact 4 + signals 2 + temporal-polyfill 40 + theme CSS）
- **bus factor = 1**：tomosterlund 755 commits，第二名人類貢獻者僅 6 commits。v4 的 paywall 化正是這種 single-maintainer open-core 模式的典型走向
- 沒有 3-day view（#2 = 1）

---

### 3.4 react-big-calendar — 總分 11/18

**版本事實**：**1.20.0**，2026-06-01，MIT。repo 已從 `jquense` 搬到 **`bigcalendar` 組織**（2026-05-29），8,736 stars / 114 open issues / 77 open PRs。週下載 1.21M。Bundle **54.6KB gz**。

**優點**：
- **React component 渲染是全場最好的**：`components.event` / `eventWrapper` / `dateCellWrapper` / `timeSlotWrapper` / `toolbar` 以及 per-view 的 `{day,week,month}.{header,event}`，全部是真正的 `React.ComponentType`。`onSelectEvent(event, syntheticEvent)` 直接給 DOM event，掛 popover 很輕鬆
- resource 兩種模式都免費：**省略 `resources` prop 即為單一共用格線**（原始碼 `lib/utils/Resources.js` 的 `groupEvents()` 會把所有 event 收在 `NONE` key 下），配 `eventPropGetter` 著色；傳 `resources` 則變資源直欄
- localizer 齊全（`moment` / `dayjs` / `date-fns` / `luxon` / `globalize`），UI 文字只有 16 個 key 要翻

**淘汰原因**：
- **#5 = 0：touch DnD 壞掉且未修**。[Issue #2413](https://github.com/bigcalendar/react-big-calendar/issues/2413)（2023-06-14 開啟，**未修就關閉**）：第一次觸控無反應；點了 event A 之後點 event B 會**移動 A**。實測 `lib/addons/dragAndDrop/EventContainerWrapper.js` **grep `touch` 零命中**——DnD addon 根本沒有 touch code path。[#2390](https://github.com/bigcalendar/react-big-calendar/issues/2390) 回報 resize 同樣問題
- **#3：完全無 recurrence**，相關 issue（[#51](https://github.com/bigcalendar/react-big-calendar/issues/51)、[#355](https://github.com/bigcalendar/react-big-calendar/issues/355)）皆以 out-of-scope 關閉
- **型別在外部且落後**：無 bundled types，需 `@types/react-big-calendar`，最新 1.16.3 是 **2025-09-12**（落後 runtime ~11 個月）
- React 19 有兩個修正 PR 至今未合（[#2805](https://github.com/bigcalendar/react-big-calendar/pull/2805)、[#2738](https://github.com/bigcalendar/react-big-calendar/pull/2738)），1.20.0 仍鎖 `uncontrollable@^7.2.1`
- **無 CSS 變數**（grep `--rbc` = 0），主題化只能改 SCSS `!default` 變數（需 Sass toolchain）或硬幹 `.rbc-*` specificity。README 自己警告 "changing and/or overriding styles can cause rendering issues"
- month view **完全忽略 resources**（`lib/Month.js` grep resource = 0）
- 維護節奏薄弱：1.19.4 (2025-06) → **11 個月空窗** → 1.19.6 (2026-05)。2025-08 以來僅 15 commits
- 硬相依同時裝 `moment` + `moment-timezone` + `luxon` + `globalize` + `dayjs` + `lodash` + `lodash-es`

---

### 3.5 MUI X Scheduler v9 — 總分 9/18

**版本事實**：`@mui/x-scheduler` **9.0.0-beta.9**（2026-08-06），MIT。首個 beta 為 2026-06-04。

**三個獨立的致命傷，任一都足以淘汰：**

1. **Stable 已被官方取消，且無新日期。** v9-alpha 部落格原訂「2026 年 7 月初 stable」。實際上 [PR #23050](https://github.com/mui/mui-x/pull/23050)（2026-07-03 merged）已把 docs 的 beta banner 拿掉準備發 stable，4 天後 [PR #23093](https://github.com/mui/mui-x/pull/23093)（2026-07-07）整個 revert，PR 說明白紙黑字：*"Reverts the Scheduler docs changes that prepared for the stable release, **since the stable release is no longer happening now**."* 文件側欄至今標示 `Preview`。

2. **Runtime 硬綁 `@mui/material`。** peer deps 要求 `@mui/material` + `@mui/system` + `@mui/icons-material`；tarball 中 **768 個檔案有 143 個 import `@mui/material`**，`EventCalendarRoot.mjs` 第 9 行就是 `import { styled } from '@mui/material/styles'`。**整包不出 CSS 檔**（`find -name "*.css"` 零結果），全部走 emotion/Pigment runtime styled。官方 quickstart 也明講要另外裝 `@mui/material @emotion/react @emotion/styled`。對 Tailwind v4 + shadcn 專案而言，這等於為了一個日曆掛上第二套設計系統，還要處理 CSS cascade layer 打架（`enableCssLayer` + 手動宣告 `@layer theme, base, mui, components, utilities;`），而且**最後長出來的還是 Material Design**。
   - 底層雖然用了 Base UI（`@base-ui/react ^1.6.0`）做行為原語，但那是實作細節，**外皮就是 Material UI**。
   - 曾經公開的 headless 層 `@mui/x-scheduler-headless` 停在 `9.0.0-alpha.4`（2026-05-08），**已被 npm deprecate**，訊息為 "Renamed to @mui/x-scheduler-internals"——名字就宣告它是私有的。**目前沒有任何受支援的 headless / unstyled 公開 API。**

3. **沒有 custom event rendering。** 整個 props surface 沒有 `slots`、`slotProps`、`renderEvent`、`components`，只有 `className` + `classes`（~290 個 class key）+ `sx`。這是已知缺口而非疏漏——[Issue #23329](https://github.com/mui/mui-x/issues/23329)「Let consumers open their own edit UI instead of the built-in event dialog」仍 open。

**它唯一真正做得比誰都好的**（值得拿來當我們自建 UI 的規格參考）：Community MIT 層原生支援「多 resource 疊在同一格線 + 每 resource 著色 + **內建可見性切換**」（`visibleResources` / `onVisibleResourcesChange` / `defaultVisibleResources`，側欄自帶 checkbox legend）。但色票是固定 11 色名（`amber|blue|green|grey|indigo|lime|orange|pink|purple|red|teal`），**不能給任意 hex**。

其他：recurrence 是 Premium 且只支援部分 RRULE；日期庫**寫死 date-fns**（無 `LocalizationProvider` adapter 機制）；`zhTW` locale 有；touch 支援才於 [PR #22624](https://github.com/mui/mui-x/pull/22624)（2026-08-05）合入，公開曝光僅 10 天；bundle 104KB gz **不含** MUI peers；TS 品質確實優秀（191 個 `.d.ts`）。

---

### 3.6 DayPilot Lite for React — 總分 7/18

**版本事實**：`@daypilot/daypilot-lite-react` **5.10.0**（2026-07-15），Apache-2.0，週下載 12k。

**淘汰原因**：
- **#5 = 0（決定性）**：官方 [feature matrix](https://javascript.daypilot.org/feature-matrix/) 白紙黑字 —— `Event Calendar Component/Touch Devices: **No Support** (Lite) / Full Support (Pro)`，Monthly Calendar 同樣。**觸控在 Calendar 元件上是付費功能**。只有水平 Scheduler 元件在 Lite 有觸控
- **#3 = 0**：recurring events 在 [官方文件](https://doc.daypilot.org/calendar/recurring-events/) 的支援表中，**所有 Lite 版本皆為 "No Support"**。而且即使買 Pro，用的也是專有的 `RecurrenceRule` 編碼字串（`EncodeExceptionDeleted` 等），**不是 RFC5545，沒有 EXDATE**
- **#7 = 0**：event 幾何與 `backColor`/`fontColor`/`borderColor` 全部寫成 **inline style**，specificity 直接壓過 Tailwind utility class。只能用它自己的 CSS theme 機制
- **#8 = 0**：**沒有公開 GitHub repo、沒有 issue tracker、沒有 star**。npm tarball 只有 `daypilot-react.min.js`（**minified-only，無原始碼**）——名義上 Apache-2.0 但實質上無法 fork、無法 patch、無法追蹤 bug。單一 bundle 101.8KB gz **不可 tree-shake**。另外 Lite 的 Calendar 元件連 **all-day events 都是 Pro-only**
- 加分項：`viewType="Days"` + `days={3}` **原生 3-day view**；**`zh-tw` locale 內建**（共 40 個）；型別隨套件出貨；Scheduler 水平時間軸免費；發布節奏穩定（月更）

---

## 4. 共通結論：Recurrence 一定是 app 層的工作

**六個候選者沒有一個能替我們處理「編輯此筆 / 此後所有 / 全部」。** 這在所有情況下都是應用層的責任：

- **FullCalendar**：`@fullcalendar/rrule` 只負責把 `rrule` + `exdate` 展開成 occurrence 並渲染。拖曳某一筆 occurrence 時，`eventDrop` 給你的是那一筆展開後的實例，**要怎麼寫回 DB（加一筆 EXDATE + 建一筆 override event？切成兩條 rrule？改整條 rrule？）完全是我們的邏輯**
- Schedule-X、react-big-calendar、@event-calendar、DayPilot Lite 也都一樣
- MUI X Premium 是唯一內建 exception dates 的，但要付費且它自己的 RRULE 也不完整

**➜ 因此建議把 recurrence 設計成 domain model 的一等公民**（`booking_series` 存 RRULE 字串 + `booking_exception` 存 EXDATE 與 override），而不是把它當成「選 library 時要看的功能」。這也代表：即使日後換 library，這塊資料模型不用重寫。

---

## 5. 推薦

### 首選：**FullCalendar v7（MIT 層）**

```
@fullcalendar/react@^7.0.2
@fullcalendar/rrule@^7.0.2
rrule@^2.8.1
temporal-polyfill@^1.0.1
```

理由，逐一對回 must-have：

1. **授權乾淨**：全部 must-have 落在 MIT 層 → §2.1 的 CC BY-NC-ND 爭議不成立。教會不需要申請任何授權、不需要註冊 license key、可以自由 fork/patch。這對一個由志工維護的教會系統是最重要的長期保險。
2. **must-have #6（拖曳 + resize）** 免費且觸控原生支援（`longPressDelay`）——這一項就直接淘汰了 Schedule-X（付費）、react-big-calendar（touch 壞）、DayPilot Lite（touch 付費）。
3. **must-have #7（Tailwind 完全客製）** 是 v7 相對 v6 最大的躍進：60+ 個 `*Class` prop 讓我們把 shadcn token 直接注進日曆每一個 element，`skeleton.css` 只有 2.2KB 且純結構。**沒有任何 UI kit 依賴**——這一項直接淘汰 MUI X。
4. **must-have #3（RRULE + EXDATE）** 是唯一有官方 plugin 的候選者（`rrule` / `exrule` / `exdate` / `duration` 四個 refiner）。
5. **must-have #4** 20 個 `*Content` hook 全部收 React JSX。
6. **#9** 79 個 locale 含 `zh-tw`，且因為走 Temporal + Intl，**不需要引入 dayjs 或 date-fns**。

**已知風險與緩解：**

| 風險 | 緩解 |
|---|---|
| v7 才 2 個月大，網路上教學幾乎都是 v6 語法，theme API 全新 | POC 全程只看官方 v7 文件；把 theme 設定集中在一個 `calendar-theme.ts` |
| 資源直欄 / 水平 Timeline 要付費 | 需求已明確排除；若日後真要，改用 @event-calendar 或走非營利申請 |
| bus factor = 1（Adam Shaw） | MIT 授權可 fork；且 v6 分支仍在（6.1.21, 2026-06-18），必要時可回退 |
| `temporal-polyfill` 是必要 peer dep（+33KB gz） | 用 tree-shakeable 的模組化 import 而非 global polyfill；瀏覽器原生 Temporal 普及後可移除 |

### 備選：**@event-calendar v5.12.0（MIT）**

若 POC 中發現 FullCalendar v7 的 theme API 在 shadcn 整合上不如預期，或需求變更為「每個房間一個直欄」，改用 @event-calendar：免費就有 Resource Time Grid 與 Resource Timeline，DnD/resize/長按觸控全免費，CSS 變數主題，只有 42.5KB gz。**代價**：要自己寫 React wrapper，且 event 內部無法用 React component 渲染（需 `createPortal` 到 `eventDidMount` 的 DOM 節點）。

### 保守第三選項：**react-big-calendar**

只有在「手機端確定只讀不拖曳」的前提下才成立。它的 React component 整合是全場最自然的，社群最大（1.21M 週下載），但 touch DnD 壞了三年、無 recurrence、無 CSS 變數、型別落後 11 個月。

---

## 6. POC 計畫（FullCalendar v7，1 天 spike）

目標：**用最少的程式碼，把六個最可能翻車的點各驗一次**。不做完整功能，只做「能不能」的判定。任何一項失敗就中止並轉向 @event-calendar。

**環境**：現有 Vite + React 19 + Tailwind v4 + shadcn 專案開一個 `/calendar-poc` route，餵 30–50 筆假 booking 資料（5 個房間、含 2 條週期性聚會）。

| # | 驗證項目 | 具體做法 | 通過標準（Definition of Done） |
|:--:|---|---|---|
| **1** | **安裝與 Vite/React 19 相容性** | 裝上四個套件，`import FullCalendar from '@fullcalendar/react'` + subpath `'/timegrid'`、`'/daygrid'`、`'/interaction'`。開 React StrictMode | dev server 與 `vite build` 皆無 warning；StrictMode 下不會 double-mount 出錯；確認 subpath entrypoint 在 Vite 的 ESM 解析下正常（**因為 v7 改了套件結構，這是最可能踩雷的第一關**） |
| **2** | **Tailwind theme 整合（最高風險）** | **不載入任何官方主題 CSS**，只載 `skeleton.css`。用 `eventClass`、`eventInnerClass`、`eventTitleClass`、`dayCellClass`、`dayHeaderClass`、`dayLaneClass`、`slotLabelClass`、`buttonClass`、`headerToolbarClass` 把 shadcn 的 `bg-card` / `text-muted-foreground` / `border-border` 打進去。測 dark mode | 日曆外觀與 shadcn 設計系統一致，**沒有寫任何一行 `.fc-*` override CSS**。若被迫寫 `!important` 或 hack specificity → **此項不通過** |
| **3** | **多房間疊圖 + 著色 + 篩選** | 所有房間 booking 進同一個 `timeGridWeek`。用 `eventClassNames` 依 `event.extendedProps.roomId` 給 Tailwind class（不是 inline color）。上方放 shadcn checkbox group 控制顯示哪些房間 | 切 checkbox 時日曆即時更新；每個房間顏色來自 Tailwind token 而非硬寫 hex；50 筆事件下切換無明顯延遲 |
| **4** | **RRULE + EXDATE 展開** | 建一筆「每週日 09:00 主日崇拜，含 1 個 EXDATE 例外」與一筆「每月第一個週六」。用物件與 iCalendar 字串**兩種寫法各試一次** | 兩種寫法都正確展開；EXDATE 該天確實不出現；切換週/月視圖時 occurrence 正確重算 |
| **5** | **拖曳 / resize + 週期事件的編輯語意** | 開 `editable`。實作 `eventDrop` / `eventResize`。**重點：拖動一筆「週期事件展開出來的 occurrence」，看 callback 給到什麼**（`event.id`? `event.start`? 怎麼區分是哪一次？） | 能從 callback 明確識別「被拖的是哪一條 series 的哪一個 occurrence」，足以支撐「此筆 / 此後 / 全部」三種寫回策略。**這一項的產出是一份決策筆記，不只是「能拖」** |
| **6** | **手機觸控實測（真機）** | 用實體手機（iOS Safari + Android Chrome）開 dev server。測：長按拖曳移動、拉伸邊緣改長度、點擊開 popover、週視圖橫向捲動 | 長按拖曳可用；`eventLongPressDelay` 調整後手感可接受；**不能出現 react-big-calendar #2413 那種「點 B 卻移動 A」的錯亂** |
| **7** | **自訂渲染 + shadcn Popover** | `eventContent` 回傳一個含房間 badge、時間、借用人的 React 元件。`eventClick` 拿 `info.el` 當 anchor 開 shadcn `Popover`（桌機）/ `Sheet`（手機） | React 元件正常渲染（含 hooks 與 context）；popover 定位正確且捲動時跟隨 |
| **8** | **zh-TW + bundle size** | `locale="zh-tw"`（從 `@fullcalendar/react/locales/zh-tw` 單獨 import，不要用 `locales-all`）。跑 `vite build` + `rollup-plugin-visualizer` | 所有 UI 文字為繁中；**只有 zh-tw 一個 locale 進 bundle**；日曆相關 chunk 總計 gz **< 150KB**（含 temporal-polyfill 與 rrule）。若超標，檢查 temporal-polyfill 是否誤用了 global 版本 |

**時間配置建議**：#1–#2 上午（3h，最高風險先做）；#3–#5 下午前段（3h）；#6–#8 下午後段（2h）。

**中止條件**：#2 或 #6 任一不通過，立即停止並改跑 @event-calendar 的等價 spike（預估同樣 1 天，但要多加 2h 寫 React wrapper）。

---

## 附錄：查證用指令與來源

```bash
# 版本與授權（本文所有版本號的來源）
npm view @fullcalendar/react version license time.modified peerDependencies
npm view @fullcalendar/rrule version license peerDependencies
npm view @event-calendar/core version license dependencies
npm view @schedule-x/calendar version license peerDependencies
npm view @mui/x-scheduler version license peerDependencies
npm view react-big-calendar version license peerDependencies
npm view @daypilot/daypilot-lite-react version license

# 驗證 Schedule-X premium 不在公開 npm
npm view @sx-premium/drag-and-drop   # → 404

# 驗證 FullCalendar v7 的 subpath 結構與 zh-tw locale（本文 §3.1 的 tarball 實測）
npm pack @fullcalendar/react@7.0.2 && tar xzf fullcalendar-react-7.0.2.tgz
ls package/                     # daygrid.js timegrid.js interaction.js themes/ locales/
cat package/locales/zh-tw.js
grep -rhoE "[a-zA-Z]+Class\??:" package/chunks/*.d.ts | sort -u | wc -l   # 60+
```

**主要來源清單**

- FullCalendar：[React 文件](https://fullcalendar.io/docs/react) · [CSS Customization](https://fullcalendar.io/docs/css-customization) · [v7 Changelog](https://fullcalendar.io/docs/upgrading-from-v6) · [RRule Plugin](https://fullcalendar.io/docs/rrule-plugin) · [Premium Plugins](https://fullcalendar.io/docs/premium) · [License](https://fullcalendar.io/license) · [Pricing](https://fullcalendar.io/pricing) · [GitHub](https://github.com/fullcalendar/fullcalendar) · [Premium LICENSE.md](https://github.com/fullcalendar/fullcalendar-workspace/blob/main/premium/LICENSE.md)
- @event-calendar：[GitHub](https://github.com/vkurko/calendar) · [文件](https://vkurko.github.io/calendar/)
- Schedule-X：[v4 遷移](https://schedule-x.dev/docs/calendar/major-version-migrations) · [Premium 定價](https://schedule-x.dev/premium) · [條款](https://schedule-x.dev/terms-and-conditions) · [Recurrence](https://schedule-x.dev/docs/calendar/plugins/recurrence) · [Theme](https://schedule-x.dev/docs/calendar/theme) · [React](https://schedule-x.dev/docs/frameworks/react) · [GitHub](https://github.com/schedule-x/schedule-x)
- react-big-calendar：[GitHub](https://github.com/bigcalendar/react-big-calendar) · [#2413 touch DnD](https://github.com/bigcalendar/react-big-calendar/issues/2413) · [#2390](https://github.com/bigcalendar/react-big-calendar/issues/2390) · [PR #2805](https://github.com/bigcalendar/react-big-calendar/pull/2805) · [@types](https://www.npmjs.com/package/@types/react-big-calendar)
- MUI X：[React Scheduler](https://mui.com/x/react-scheduler/) · [Quickstart](https://mui.com/x/react-scheduler/quickstart/) · [Resources](https://mui.com/x/react-scheduler/event-calendar/resources/) · [Recurring events](https://mui.com/x/react-scheduler/recurring-events/) · [PR #23093 取消 stable](https://github.com/mui/mui-x/pull/23093) · [PR #22624 touch](https://github.com/mui/mui-x/pull/22624) · [Issue #23329](https://github.com/mui/mui-x/issues/23329) · [2026 定價異動](https://mui.com/blog/2026-mui-x-price-changes/) · [Pricing](https://mui.com/pricing/)
- DayPilot：[Feature Matrix](https://javascript.daypilot.org/feature-matrix/) · [Recurring Events](https://doc.daypilot.org/calendar/recurring-events/) · [Open Source](https://javascript.daypilot.org/open-source/) · [Lite License](https://javascript.daypilot.org/daypilot-lite-license/)
- Syncfusion：[License Agreement (PDF)](https://www.syncfusion.com/content/downloads/syncfusion_license.pdf) · Bryntum：[Store](https://bryntum.com/store/calendar/) · Mobiscroll：[Capterra 定價](https://www.capterra.com/p/158238/Mobiscroll/)

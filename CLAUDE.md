# shimen-church-book-system v2

石門水庫教會場地登記系統重寫（pnpm monorepo：apps/web、apps/api、packages/ui）。

先讀：
- `docs/decisions.md` — 所有已拍板的技術/產品決策（不要重問）
- `docs/design-system.md` — **實作任何 UI 前必讀**：Claude Design DS「石門教會 Shimen Church」id `c3a36bb4-32f6-45e6-b714-2a62a6a26a5b` + tokens 在 `packages/ui`；mockups project id `dc73d60d-9e41-42e0-9875-ba9f5f653f92`
- `docs/pre-plan.md`、`docs/survey/` — 背景與 POC 結果

規則：顏色/字體/圓角只用 `@smsk/ui` tokens（Tailwind utilities），不硬寫 hex；場地色 `bg-room-N`；暗色用 `.dark`。

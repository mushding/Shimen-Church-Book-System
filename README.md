# shimen-church-book-system v2

石門水庫教會場地登記系統重寫。決策見 `docs/decisions.md`，survey/POC 見 `docs/survey/`。

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # 填 LINE channel id/secret
pnpm dev:api    # http://localhost:3000
pnpm dev:web    # http://localhost:5173（/api 反代到 3000）
```

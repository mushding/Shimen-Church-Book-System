import { expect, test, type Page } from "@playwright/test";

const devLogin = (page: Page, name: string, role: string) =>
  page.request.post("/api/dev/login", { data: { name, role }, headers: { origin: "http://localhost:5173" } });

test("happy path: login → create (weekly) → conflict/force → edit this → delete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "LINE 登入" })).toBeVisible();
  await expect(page.getByLabel("新增登記")).toHaveCount(0); // anonymous: no FAB

  await devLogin(page, "測試幹事", "staff");
  await page.reload();
  const dlg = page.getByRole("dialog");

  // create weekly ×3
  await page.getByLabel("新增登記").click();
  await dlg.getByPlaceholder("例：青少契劇會排練").fill("青少契劇會排練");
  await dlg.getByRole("button", { name: /^副堂/ }).click();
  await dlg.getByText("不重複 ›").click();
  await dlg.getByRole("button", { name: "每週" }).click();
  await dlg.getByText("次後結束").click();
  await dlg.getByRole("button", { name: "套用" }).click();
  await dlg.getByRole("button", { name: "儲存登記" }).click();
  await expect(page.getByText("已建立登記")).toBeVisible();
  await expect(page.getByText("青少契劇會排練 ↻")).toBeVisible();

  // same slot again → 409 → force (staff)
  await page.getByLabel("新增登記").click();
  await dlg.getByPlaceholder("例：青少契劇會排練").fill("衝突測試");
  await dlg.getByRole("button", { name: /^副堂/ }).click();
  await dlg.getByRole("button", { name: "儲存登記" }).click();
  await expect(dlg.getByText("已有登記")).toBeVisible();
  await dlg.getByText("強制建立").click();
  await dlg.getByRole("button", { name: "儲存登記" }).click();
  await expect(page.getByText("衝突測試", { exact: false }).first()).toBeVisible();

  // edit this occurrence only → retitle
  await page.getByText("青少契劇會排練 ↻").first().click();
  await dlg.getByRole("button", { name: "修改" }).click();
  await dlg.getByRole("button", { name: "確認" }).click(); // scope = this
  await dlg.getByPlaceholder("例：青少契劇會排練").fill("排練（改）");
  await dlg.getByRole("button", { name: "儲存修改" }).click();
  await expect(page.getByText("已更新")).toBeVisible();
  await expect(page.getByText("排練（改） ↻")).toBeVisible();

  // delete whole series
  await page.getByText("排練（改） ↻").first().click();
  await dlg.getByRole("button", { name: "刪除" }).click();
  await dlg.getByText("全部", { exact: true }).click();
  await dlg.getByRole("button", { name: "確認" }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "刪除" }).click(); // confirm card stacks over detail
  await expect(page.getByText("已刪除")).toBeVisible();
  await expect(page.getByText("排練（改）")).toHaveCount(0);

  // admin page gated
  await page.goto("/admin");
  await expect(page.getByText("需要 admin 權限")).toBeVisible();
  await devLogin(page, "管理員", "admin");
  await page.reload();
  await expect(page.getByRole("heading", { name: "管理後台" })).toBeVisible();
  await expect(page.getByText("使用者與角色")).toBeVisible();
});

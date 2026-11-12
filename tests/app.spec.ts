import { test as base, expect } from "@playwright/test";
import students from "../db/seed/students.json" with { type: "json" };
import teachers from "../db/seed/teachers.json" with { type: "json" };

const directoryFixture = { schemaVersion: 1, students, teachers };

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      await page.route("**/api/directory", (route) =>
        route.fulfill({ json: directoryFixture }),
      );
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400)
          errors.push(response.status() + " " + response.url());
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

test("loads records over the API before showing map counts and directories", async ({
  page,
}) => {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/directory", async (route) => {
    await ready;
    await route.fulfill({ json: directoryFixture });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("正在加载班级信息…");
  await expect(page.getByRole("group", { name: "全国省份地图" })).toHaveCount(
    0,
  );
  release();
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
  await page.getByRole("button", { name: "录取总览", exact: true }).click();
  await expect(page.locator(".student-row")).toHaveCount(49);
});

test("a failed API request shows a retry state instead of bundled records", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/directory", async (route) => {
    if (++requests === 1) await route.abort("failed");
    else await route.fulfill({ json: directoryFixture });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("暂时无法加载班级信息");
  await expect(page.getByRole("group", { name: "全国省份地图" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
  await page.getByRole("button", { name: "任课老师", exact: true }).click();
  await expect(page.locator(".teacher-card")).toHaveCount(6);
});

test("original map layout, teacher popup and keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "2023届35班蹭饭地图", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "合肥一中", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "合肥一中校徽" })).toBeVisible();
  await expect(page.getByRole("img", { name: "2023届35班班徽" })).toBeVisible();
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
  const teachersButton = page.getByRole("button", {
    name: "任课老师",
    exact: true,
  });
  await teachersButton.click();
  const dialog = page.getByRole("dialog", { name: "任课老师", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".teacher-card")).toHaveCount(6);
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "录取总览", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "录取总览", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".student-row")).toHaveCount(49);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(teachersButton).toBeFocused();
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
});

test("province maps load on demand and city selections open matching records", async ({
  page,
}) => {
  const provinceRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/anhui-"))
      provinceRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
  expect(provinceRequests).toHaveLength(0);
  const anhui = page.getByRole("button", { name: /^安徽，/ });
  await anhui.focus();
  await page.keyboard.press("Enter");
  const cities = page.getByRole("group", { name: "安徽城市地图" });
  await expect(cities).toBeVisible();
  await expect(cities.locator("path")).toHaveCount(16);
  expect(provinceRequests.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: /^合肥，/ }).focus();
  await page.keyboard.press("Space");
  const directory = page.getByRole("dialog", { name: "录取总览", exact: true });
  await expect(directory).toBeVisible();
  await expect(
    directory.getByRole("combobox", { name: "筛选省份" }),
  ).toHaveValue("安徽");
  const records = directory.locator(".student-row");
  expect(await records.count()).toBeGreaterThan(0);
  expect(
    (await records.locator("td:nth-child(3)").allTextContents()).every(
      (city) => city === "合肥",
    ),
  ).toBe(true);
  await directory.getByRole("button", { name: "关闭录取总览" }).click();
  await expect(cities).toBeVisible();
  await page.getByRole("button", { name: "返回全国" }).click();
  await expect(page.getByRole("img", { name: "合肥一中校徽" })).toBeVisible();
  const requestsAfterFirstVisit = provinceRequests.length;
  await page.getByRole("button", { name: /^安徽，/ }).click();
  await expect(cities).toBeVisible();
  expect(provinceRequests).toHaveLength(requestsAfterFirstVisit);
  await page.getByRole("button", { name: "返回全国" }).click();
  await page.getByRole("button", { name: /^台湾，/ }).click();
  await expect(page.getByRole("status")).toContainText("暂无城市地图");
  await page.getByRole("button", { name: "返回全国" }).click();
  await expect(page.getByRole("group", { name: "全国省份地图" })).toBeVisible();
});

test("closing can be canceled by switching or reopening without losing the dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "任课老师", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "任课老师", exact: true });
  await dialog
    .getByRole("button", { name: "关闭任课老师", exact: true })
    .click();
  await dialog.getByRole("button", { name: "录取总览", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "录取总览", exact: true });
  await dialog.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "搜索同学" }).fill("高金锋");
  await expect(dialog.locator(".student-row")).toHaveCount(1);
  const activeNavigation = dialog.getByRole("button", {
    name: "录取总览",
    exact: true,
  });
  await activeNavigation.click();
  await activeNavigation.click();
  await dialog.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox", { name: "搜索同学" })).toHaveValue(
    "高金锋",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "任课老师", exact: true }),
  ).toBeFocused();
});

test("reduced motion disables effects and changing it during exit still closes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "任课老师", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "任课老师", exact: true });
  expect(
    await dialog.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await dialog
    .getByRole("button", { name: "关闭任课老师", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "任课老师", exact: true }).click();
  await dialog
    .getByRole("button", { name: "关闭任课老师", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "任课老师", exact: true }),
  ).toBeFocused();
});

test("directory search, filters and empty states stay inside the original popup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "录取总览", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "录取总览", exact: true });
  const search = dialog.getByRole("searchbox", { name: "搜索同学" });
  await expect(dialog.locator(".student-row")).toHaveCount(49);
  await search.fill(" 高金锋 ");
  await expect(dialog.locator(".student-row")).toHaveCount(1);
  await expect(dialog.locator(".student-row")).toContainText("高金锋");
  await dialog.getByRole("button", { name: "清空搜索", exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(dialog.locator(".student-row")).toHaveCount(49);
  await search.fill("不存在xyz");
  await expect(
    dialog.getByRole("heading", { name: "还没有找到同学" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "查看全部同学", exact: true })
    .click();
  await expect(search).toBeFocused();
  await expect(dialog.locator(".student-row")).toHaveCount(49);
  await dialog.getByRole("combobox", { name: "筛选省份" }).selectOption("北京");
  expect(
    (
      await dialog.locator(".student-row td:nth-child(4)").allTextContents()
    ).every((province) => province === "北京"),
  ).toBe(true);
  await search.fill("安徽大学");
  await expect(
    dialog.getByRole("heading", { name: "还没有找到同学" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "清空搜索", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "筛选省份" })).toHaveValue(
    "北京",
  );
  expect(await dialog.locator(".student-row").count()).toBeGreaterThan(0);
  expect(
    (
      await dialog.locator(".student-row td:nth-child(4)").allTextContents()
    ).every((province) => province === "北京"),
  ).toBe(true);
  await dialog.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(dialog.locator(".student-row")).toHaveCount(49);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const panel = await dialog.locator(".legacy-panel").boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const scrollRegion = dialog.getByRole("region", {
    name: "同学录取信息，可横向滚动",
  });
  await scrollRegion.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    dialog.getByRole("columnheader", { name: "姓名", exact: true }),
  ).toBeInViewport();
  await dialog.getByRole("button", { name: "关闭录取总览" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "录取总览", exact: true }).click();
  await page.getByRole("dialog").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import students from "../db/seed/students.json" with { type: "json" };
import teachers from "../db/seed/teachers.json" with { type: "json" };

const pending = {
  id: "eab2b78c-3c71-4ac2-9ca7-8571fc055ad5",
  studentId: students[0].id,
  stage: "undergraduate",
  kind: "employment",
  year: 2027,
  organization: "测试工作单位",
  detail: "软件工程师",
  province: "浙江",
  city: "杭州",
  note: "仅审核可见的备注",
  submitterEmail: "student@example.test",
  submittedAt: "2026-11-12T12:00:00Z",
  status: "pending",
  rejectionReason: "",
};
const session = (email = "student@example.test") => ({
  session: {
    id: "session",
    token: "session-token",
    userId: "user",
    expiresAt: "2030-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  user: {
    id: "user",
    email,
    name: "同学",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
});
test("email verification leads to a private pending submission with visible status", async ({
  page,
}) => {
  let signedIn = false;
  const own: unknown[] = [];
  await page.route("**/api/directory", (route) =>
    route.fulfill({
      json: { schemaVersion: 1, students, teachers, destinations: [] },
    }),
  );
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedIn ? session() : null }),
  );
  await page.route("**/api/auth/email-otp/send-verification-otp", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.route("**/api/auth/sign-in/email-otp", (route) => {
    signedIn = true;
    return route.fulfill({ json: { ...session(), token: "token" } });
  });
  await page.route("**/api/auth/token", (route) =>
    route.fulfill({ json: { token: "token" } }),
  );
  await page.route("**/api/submissions", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { submissions: own } });
    const body = route.request().postDataJSON();
    expect(body.studentId).toBe(students[0].id);
    expect(body.kind).toBe("employment");
    own.push({
      ...body,
      status: "pending",
      submittedAt: pending.submittedAt,
      rejectionReason: "",
    });
    return route.fulfill({
      status: 202,
      json: { id: body.id, status: "pending" },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "更新去向", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "更新去向", exact: true });
  await dialog.getByLabel("邮箱", { exact: true }).fill("student@example.test");
  await dialog.getByRole("button", { name: "获取验证码", exact: true }).click();
  await dialog.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  await dialog.getByRole("button", { name: "验证并继续" }).click();
  await dialog.getByLabel("同学姓名").selectOption(students[0].id);
  await dialog.getByLabel("去向类型").selectOption("employment");
  await dialog.getByLabel("工作单位", { exact: true }).fill("测试工作单位");
  await dialog.getByLabel("岗位 / 部门").fill("软件工程师");
  await dialog.getByLabel("省份 / 地区").selectOption("浙江");
  await dialog.getByLabel("城市", { exact: true }).fill("杭州");
  await dialog.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("提交成功");
  await expect(dialog.getByLabel("我的提交")).toContainText("待审核");
  await expect(dialog.getByLabel("我的提交")).toContainText("测试工作单位");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("approval publishes history and latest map while preserving original admissions", async ({
  page,
}) => {
  let approved = false;
  const publicRecord = {
    id: pending.id,
    studentId: pending.studentId,
    stage: pending.stage,
    kind: pending.kind,
    year: pending.year,
    organization: pending.organization,
    detail: pending.detail,
    province: pending.province,
    city: pending.city,
    reviewedAt: "2026-11-12T13:00:00Z",
  };
  await page.route("**/api/directory", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        students,
        teachers,
        destinations: approved ? [publicRecord] : [],
      },
    }),
  );
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: session("reviewer@example.test") }),
  );
  await page.route("**/api/auth/token", (route) =>
    route.fulfill({ json: { token: "token" } }),
  );
  await page.route("**/api/review", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON().decision).toBe("approved");
      approved = true;
      return route.fulfill({ json: { id: pending.id, status: "approved" } });
    }
    return route.fulfill({
      json: {
        submissions: [
          { ...pending, status: approved ? "approved" : "pending" },
        ],
      },
    });
  });
  await page.goto("/#review");
  await expect(
    page.getByRole("heading", { name: "去向审核", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText(pending.submitterEmail);
  await page.getByRole("button", { name: "审核通过", exact: true }).click();
  await expect(
    page.getByText("已通过，公开去向已更新。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← 返回地图" }).click();
  await page.getByRole("button", { name: "最新去向", exact: true }).click();
  const expected =
    students.filter((s) => s.province === "浙江").length +
    (students[0].province === "浙江" ? 0 : 1);
  await expect(
    page.getByRole("button", { name: `浙江，${expected}位同学`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "录取总览", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "录取总览", exact: true });
  await expect(dialog.locator(".student-row")).toHaveCount(1);
  await expect(dialog.locator(".student-row")).toContainText(
    pending.organization,
  );
  await expect(dialog).not.toContainText(pending.note);
  await expect(dialog).not.toContainText(pending.submitterEmail);
  await dialog.getByRole("button", { name: "本科录取", exact: true }).click();
  await expect(dialog.locator(".student-row")).toHaveCount(49);
  await expect(dialog.locator(".student-row").first()).toContainText(
    students[0].school,
  );
});

test("review requires a reason for rejection and reports a non-admin account", async ({
  page,
}) => {
  let forbidden = false;
  let rejected = false;
  await page.route("**/api/directory", (route) =>
    route.fulfill({ json: { schemaVersion: 1, students, teachers } }),
  );
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: session("reviewer@example.test") }),
  );
  await page.route("**/api/auth/token", (route) =>
    route.fulfill({ json: { token: "token" } }),
  );
  await page.route("**/api/review", async (route) => {
    if (forbidden)
      return route.fulfill({ status: 403, json: { error: "ADMIN_REQUIRED" } });
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON().reason).toBe("请核对单位名称");
      rejected = true;
      return route.fulfill({ json: { id: pending.id, status: "rejected" } });
    }
    return route.fulfill({
      json: {
        submissions: [
          {
            ...pending,
            status: rejected ? "rejected" : "pending",
            rejectionReason: rejected ? "请核对单位名称" : "",
          },
        ],
      },
    });
  });
  await page.goto("/#review");
  await page.getByRole("button", { name: "退回修改", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("退回原因");
  await page.getByLabel("退回原因", { exact: true }).fill("请核对单位名称");
  await page.getByRole("button", { name: "退回修改", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("已退回");
  forbidden = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("没有审核权限");
  await expect(
    page.getByRole("button", { name: "审核通过", exact: true }),
  ).toHaveCount(0);
});

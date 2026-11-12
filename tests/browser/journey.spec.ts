import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function sample(page: Page) {
  await page.goto("/notice?sample=1");
  await expect(page.locator("#review-text")).toBeVisible();
}
async function explain(page: Page) {
  await sample(page);
  await page
    .getByRole("button", { name: "Tama ang text — ipaliwanag" })
    .click();
}
async function prepare(page: Page) {
  await explain(page);
  await page
    .getByRole("button", { name: "Magtanong tungkol sa dokumento" })
    .click();
  await page.getByRole("button", { name: "Laktawan muna" }).nth(0).click();
  await page.getByRole("button", { name: "Laktawan muna" }).nth(1).click();
  await page
    .getByRole("button", { name: "Maghanda para sa legal na tulong" })
    .click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("landing headline, actions and responsive layout", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Palinawin natin ang legal notice mo.",
  );
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/landing-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Subukan ang halimbawa", exact: true })
    .first()
    .click();
  await expect(page.locator("#review-text")).toBeVisible();
});
test("sample journey, source, chat and preparation", async ({
  page,
}, testInfo) => {
  await explain(page);
  await page
    .getByRole("button", {
      name: "Tingnan ang pinagmulang bahagi",
      exact: true,
    })
    .click();
  await expect(page.locator("mark")).toContainText("ika-20 ng Nobyembre 2026");
  await page.getByRole("button", { name: "Isara ang pinagmulan" }).click();
  await page.screenshot({
    path: `test-results/explanation-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Magtanong tungkol sa dokumento" })
    .click();
  await page.getByRole("button", { name: /Ano ang pakay ng liham/ }).click();
  await expect(page.getByRole("log")).toContainText(
    "Inaanyayahan kang makipag-usap",
  );
  await page
    .getByLabel("Ang tanong mo")
    .fill("Can you predict a case outcome?");
  await page.getByRole("button", { name: "Ipadala ang tanong" }).click();
  await expect(page.getByRole("log")).toContainText(
    "may nakahandang sagot lang",
  );
  await expect(
    page.getByRole("button", { name: "Maghanda para sa legal na tulong" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Laktawan muna" }).nth(0).click();
  await page.getByRole("button", { name: "Laktawan muna" }).nth(1).click();
  await page
    .getByRole("button", { name: "Maghanda para sa legal na tulong" })
    .click();
  await expect(page.getByText("Checklist sa paghahanda")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Hindi pa nakakonekta");
});
test("editing sample invalidates explanation and restores safely", async ({
  page,
}) => {
  await explain(page);
  await page
    .getByRole("button", { name: "Suriin ang teksto", exact: true })
    .click();
  await page.locator("#review-text").fill("Changed document");
  await expect(
    page.getByRole("button", { name: "Tama ang text — ipaliwanag" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "3. Paliwanag" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Ibalik ang orihinal na halimbawa" })
    .click();
  await expect(
    page.getByRole("button", { name: "Tama ang text — ipaliwanag" }),
  ).toBeEnabled();
});
test("real files do not receive sample analysis", async ({ page }) => {
  await sample(page);
  await page.getByRole("button", { name: /Gamitin ang dokumento ko/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Magsimula muli", exact: true })
    .click();
  await page.getByLabel("Pumili ng dokumento", { exact: true }).setInputFiles({
    name: "notice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nExample"),
  });
  await page.getByRole("button", { name: "Basahin ang dokumento" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Hindi na-upload ang file mo",
  );
  await expect(
    page.getByRole("button", { name: "3. Paliwanag" }),
  ).toBeDisabled();
});
test("language and large text preserve edits and checks", async ({ page }) => {
  await prepare(page);
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("textbox", { name: "Tanong 1", exact: true })
    .fill("My own unchanged question");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("textbox", { name: "Question 1", exact: true }),
  ).toHaveValue("My own unchanged question");
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.getByLabel("Text size").selectOption("2");
  await noOverflow(page);
  await page.getByLabel("Text size").selectOption("1");
});
test("help routes remain available and do not invent local providers", async ({
  page,
}) => {
  await page.goto("/help");
  await expect(
    page.getByRole("link", { name: /Opisyal na PAO directory/ }),
  ).toHaveAttribute("href", "https://pao.gov.ph/contact-us/");
  await noOverflow(page);
  await page.goto("/verify");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kilalanin ang nagpadala.",
  );
  await noOverflow(page);
});
test("keyboard and accessibility across landing and all five steps", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByText("Dumiretso sa nilalaman", { exact: true }),
  ).toBeFocused();
  for (const path of ["/", "/notice", "/help", "/verify"]) {
    await page.goto(path);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await sample(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Tama ang text — ipaliwanag" })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Magtanong tungkol sa dokumento" })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Laktawan muna" }).nth(0).click();
  await page.getByRole("button", { name: "Laktawan muna" }).nth(1).click();
  await page
    .getByRole("button", { name: "Maghanda para sa legal na tulong" })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("starting over clears the selected file on the upload screen", async ({
  page,
}) => {
  await page.goto("/notice");
  await page.getByLabel("Pumili ng dokumento", { exact: true }).setInputFiles({
    name: "clear-me.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByText("clear-me.pdf", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Magsimula ng bagong dokumento" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Magsimula muli", exact: true })
    .click();
  await expect(page.getByText("clear-me.pdf", { exact: true })).toHaveCount(0);
});

test("200 percent text remains usable through the journey and restart dialog", async ({
  page,
}) => {
  await sample(page);
  await page.getByLabel("Laki ng teksto").selectOption("2");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
    )
    .toBe("32px");
  await noOverflow(page);
  await page
    .getByRole("button", { name: "Tama ang text — ipaliwanag" })
    .click();
  await noOverflow(page);
  await page
    .getByRole("button", {
      name: "Tingnan ang pinagmulang bahagi",
      exact: true,
    })
    .click();
  await noOverflow(page);
  await page.getByRole("button", { name: "Isara ang pinagmulan" }).click();
  await page
    .getByRole("button", { name: "Magtanong tungkol sa dokumento" })
    .click();
  await noOverflow(page);
  const restart = page.getByRole("button", {
    name: "Magsimula ng bagong dokumento",
  });
  await restart.click();
  await expect(
    page.getByRole("dialog", { name: "Magsimula muli?" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.keyboard.press("Escape");
  await expect(restart).toBeFocused();
  await page.goto("/help");
  await noOverflow(page);
  await page.goto("/verify");
  await noOverflow(page);
});

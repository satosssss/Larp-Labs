import { test, expect, type Page } from "@playwright/test";
async function preparation(page: Page) {
  await page.goto("/notice?sample=1");
  await page.getByRole("button", { name: "Tama na — ipaliwanag" }).click();
  await page.getByRole("button", { name: "May tanong pa ako" }).click();
  await page.getByRole("button", { name: "Skip muna" }).nth(0).click();
  await page.getByRole("button", { name: "Skip muna" }).nth(1).click();
  await page.getByRole("button", { name: "Ituloy sa checklist" }).click();
}
test("mobile header gives legal disclosure a full row at all text sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/notice?sample=1");
  for (const scale of ["1", "1.5", "2"]) {
    await page.locator(".text-scale").selectOption(scale);
    const disclosure = await page
      .locator(".header .legal-disclosure")
      .boundingBox();
    const language = await page.locator(".language-button").boundingBox();
    const size = await page.locator(".text-scale").boundingBox();
    expect(disclosure!.width).toBeGreaterThan(300);
    expect(disclosure!.y).toBeGreaterThanOrEqual(
      Math.max(language!.y + language!.height, size!.y + size!.height),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("browser tab uses a reachable brand icon", async ({ page }) => {
  await page.goto("/");
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("href", /brand\/emblem.png/);
  expect(
    (await page.request.get((await icon.getAttribute("href"))!)).ok(),
  ).toBe(true);
});
test("PDF downloads from the current edited preparation", async ({
  page,
}, testInfo) => {
  await preparation(page);
  await page
    .getByRole("textbox", { name: "Tanong 1", exact: true })
    .fill("Ano ang dapat ihanda ni Peña?");
  const download = page.waitForEvent("download", { timeout: 8000 });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const file = await download;
  await file.saveAs(testInfo.outputPath("summary.pdf"));
  expect(file.suggestedFilename()).toBe("legalinaw-summary.pdf");
  expect(await file.failure()).toBeNull();
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
});
test("share opens publicly and owner can revoke the link", async ({
  page,
  browser,
}) => {
  await preparation(page);
  await page.getByRole("button", { name: "Ibahagi", exact: true }).click();
  const url = page.locator("#share-url");
  await expect(url).toBeVisible();
  const link = await url.inputValue();
  const publicPage = await browser.newPage();
  try {
    await publicPage.goto(link);
    await expect(
      publicPage.getByRole("heading", {
        name: "Ibinahaging buod sa paghahanda",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Itigil ang pagbabahagi" }).click();
    await expect(url).toHaveCount(0);
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", {
        name: "Hindi na available ang buod na ito.",
      }),
    ).toBeVisible();
  } finally {
    await publicPage.close();
  }
});

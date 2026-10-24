import { test, expect } from "@playwright/test";
import JSZip from "jszip";
test("subjects, decks, cards, reviews, search, mobile navigation, and persistence", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /ready to learn/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My subjects", exact: true }).click();
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject name").fill("Computer Networking");
  await page.getByLabel("Description").fill("Networks and protocols");
  await page.getByRole("button", { name: "Save subject" }).click();
  await expect(
    page.getByRole("link", { name: "Computer Networking", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Flashcards/ }).click();
  await page.getByRole("button", { name: "Create deck", exact: true }).click();
  await page.getByLabel("Deck name").fill("Network fundamentals");
  await page.getByRole("button", { name: "Save deck" }).click();
  await page.getByRole("button", { name: "Network fundamentals" }).click();
  await page
    .getByRole("button", { name: "Add flashcard", exact: true })
    .click();
  await page.getByLabel("Front · question").fill("What does TCP provide?");
  await page.getByLabel("Back · answer").fill("Reliable ordered delivery");
  await page.getByRole("button", { name: "Save flashcard" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What does TCP provide?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review due cards" }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(
    page.getByRole("heading", { name: "Reliable ordered delivery" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^good/ }).click();
  await expect(page.getByText("You reviewed 1 cards.")).toBeVisible();
  await page.getByRole("button", { name: "Back to your decks" }).click();
  await expect(page.getByText(/1 reviews/)).toBeVisible();
  await page.getByLabel("Search everything").fill("TCP");
  await expect(
    page.locator(".search-results").getByText("What does TCP provide?"),
  ).toBeVisible();
  await page.getByLabel("Clear search").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Open navigation").click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /ready to learn/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/recall-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "/tmp/recall-dashboard.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("PowerPoint extraction, editable quiz generation, scoring and persistence", async ({
  page,
}) => {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>A database organizes information into structured tables for efficient retrieval.</a:t></a:r></a:p></p:sld>',
  );
  await page.goto("/quizzes");
  await page.locator("input[type=file]").setInputFiles({
    name: "Database lesson.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await expect(
    page.getByRole("heading", { name: "Ready to make a better quiz?" }),
  ).toBeVisible();
  let requested = false;
  await page.route("**/api/generate-quiz", async (route) => {
    requested = true;
    const body = route.request().postDataJSON();
    expect(body.sections[0].source).toBe("Slide 1");
    expect(body.sections[0].text).toContain("A database organizes");
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({
      json: {
        questions: [
          {
            type: "multiple_choice",
            prompt:
              "Why do databases organize information into structured tables?",
            options: [
              "For efficient retrieval",
              "To delete every record",
              "To prevent all updates",
              "To remove relationships",
            ],
            accepted: ["For efficient retrieval"],
            explanation: "Structured tables enable efficient retrieval.",
            source: "Slide 1",
            evidence:
              "A database organizes information into structured tables for efficient retrieval.",
          },
        ],
      },
    });
  });
  await expect(page.getByLabel("Private generation passcode")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Generate with Gemini" }),
  ).toBeDisabled();
  expect(requested).toBe(false);
  await page.getByLabel("Send this document’s extracted text").check();
  await page.getByRole("button", { name: "Generate with Gemini" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your quiz draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Question", exact: true }),
  ).toHaveValue(
    "Why do databases organize information into structured tables?",
  );
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue(
    "For efficient retrieval",
  );
  await expect(page.getByText("Slide 1 · Supporting quotation")).toBeVisible();
  await page.getByRole("button", { name: "Save reviewed quiz" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your quiz draft" }),
  ).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await page.getByLabel("For efficient retrieval", { exact: false }).check();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.getByRole("heading", { name: "100%" })).toBeVisible();
  await page.getByLabel("Close dialog").click();
  await expect(page.getByText("1 questions · 1 attempts")).toBeVisible();
});
test("production app caches for offline navigation and includes install manifest", async ({
  page,
  context,
}) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Recall on your phone" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await page.evaluate(async () =>
    fetch(document.querySelector("link[rel=manifest]").href).then((r) =>
      r.json(),
    ),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /ready to learn/ }),
  ).toBeVisible();
});
test("PDF extraction makes grounded questions", async ({ page }) => {
  const text =
    "A database organizes information into structured tables for efficient retrieval.";
  const content = `BT /F1 12 Tf 40 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page.goto("/quizzes");
  await page.locator("input[type=file]").setInputFiles({
    name: "lesson.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });
  await expect(
    page.getByRole("heading", { name: "Ready to make a better quiz?" }),
  ).toBeVisible();
  expect(
    await page.getByLabel("Send this document’s extracted text").isChecked(),
  ).toBe(false);
  await page.route("**/api/generate-quiz", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.sections[0].text.trim()).toBe(text);
    expect(body.sections[0].source).toBe("Page 1");
    await route.fulfill({
      status: 503,
      json: {
        error:
          "AI generation is not configured. Add GEMINI_API_KEY in Vercel, then redeploy.",
      },
    });
  });
  await expect(page.getByLabel("Private generation passcode")).toHaveCount(0);
  await page.getByLabel("Send this document’s extracted text").check();
  await page.getByRole("button", { name: "Generate with Gemini" }).click();
  await expect(page.getByRole("alert")).toContainText("Add GEMINI_API_KEY");
  await expect(
    page.getByRole("heading", { name: "Review your quiz draft" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate with Gemini" }),
  ).toBeEnabled();
});

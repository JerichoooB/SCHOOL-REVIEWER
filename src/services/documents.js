import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractDocument(file) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a file smaller than 20 MB.");
  const ext = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();
  let sections = [];
  if (ext === "pdf") {
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
    });
    task.onPassword = () => {
      task.destroy();
    };
    let pdf;
    try {
      pdf = await task.promise;
    } catch {
      throw new Error(
        "Could not open this PDF. Use an unlocked, text-based PDF.",
      );
    }
    try {
      if (pdf.numPages > 200)
        throw new Error("Use a document with 200 pages or fewer.");
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i),
          content = await page.getTextContent();
        sections.push({
          source: `Page ${i}`,
          text: content.items
            .map((x) => x.str + (x.hasEOL ? "\n" : " "))
            .join(""),
        });
      }
    } finally {
      await task.destroy();
    }
  } else if (ext === "pptx") {
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort(
        (a, b) =>
          parseInt(a.match(/slide(\d+)/)[1]) -
          parseInt(b.match(/slide(\d+)/)[1]),
      );
    if (!slides.length)
      throw new Error(
        "No readable slides found. Please use a valid .pptx file.",
      );
    if (slides.length > 200)
      throw new Error("Use a presentation with 200 slides or fewer.");
    for (const path of slides) {
      const file = zip.file(path);
      if (file._data?.uncompressedSize > 5 * 1024 * 1024)
        throw new Error("Slide content is too large. Split the presentation.");
      const xml = new DOMParser().parseFromString(
        await file.async("string"),
        "application/xml",
      );
      if (xml.querySelector("parsererror"))
        throw new Error("This presentation contains invalid slide data.");
      const paragraphs = Array.from(xml.getElementsByTagNameNS("*", "p"));
      sections.push({
        source: `Slide ${path.match(/slide(\d+)/)[1]}`,
        text: paragraphs
          .map((p) =>
            Array.from(p.getElementsByTagNameNS("*", "t"))
              .map((t) => t.textContent)
              .join(""),
          )
          .join(". "),
      });
    }
  } else
    throw new Error(
      "Choose a PDF or .pptx file. Convert older .ppt presentations to .pptx first.",
    );
  if (sections.reduce((n, s) => n + s.text.length, 0) > 2000000)
    throw new Error("Extracted text is too large. Split the document.");
  if (
    sections
      .map((s) => s.text)
      .join("")
      .trim().length < 40
  )
    throw new Error(
      "Not enough readable text. Scanned PDFs and slide images need OCR first.",
    );
  return sections;
}

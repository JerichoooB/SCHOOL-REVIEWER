async function generateStudyItems(sections, count, kind) {
  if (!navigator.onLine)
    throw new Error(
      "Connect to the internet to generate with AI. Saved quizzes and flashcards still work offline.",
    );
  let response;
  try {
    response = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sections, count, kind }),
      signal: AbortSignal.timeout(140000),
    });
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError"
        ? "Gemini is taking longer than expected. No study items were saved. Please try again later."
        : "Could not reach AI generation. Check your connection and try again.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    if (response.status === 504)
      throw new Error(
        "The server reached its generation time limit. No study items were saved. Please try again later.",
      );
    throw new Error(
      "AI generation needs the Vercel server function. Use the deployed app or run vercel dev for local AI testing.",
    );
  }
  if (!response.ok)
    throw new Error(result.error || "Could not generate these study items.");
  const items = kind === "flashcards" ? result.cards : result.questions;
  if (!Array.isArray(items) || !items.length)
    throw new Error("No study items were returned. Try a different chapter.");
  return items.map((q) => ({ ...q, id: crypto.randomUUID() }));
}

export const generateAIQuiz = (sections, count) =>
  generateStudyItems(sections, count, "quiz");
export const generateAIFlashcards = (sections, count) =>
  generateStudyItems(sections, count, "flashcards");

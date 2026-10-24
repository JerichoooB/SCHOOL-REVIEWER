export async function generateAIQuiz(sections, count) {
  if (!navigator.onLine)
    throw new Error(
      "Connect to the internet to generate an AI quiz. Saved quizzes still work offline.",
    );
  let response;
  try {
    response = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sections, count }),
      signal: AbortSignal.timeout(140000),
    });
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError"
        ? "Gemini is taking longer than expected. No quiz was saved. Please try again later."
        : "Could not reach AI generation. Check your connection and try again.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    if (response.status === 504)
      throw new Error(
        "The server reached its generation time limit. No quiz was saved. Please try again later.",
      );
    throw new Error(
      "AI generation needs the Vercel server function. Use the deployed app or run vercel dev for local AI testing.",
    );
  }
  if (!response.ok)
    throw new Error(result.error || "Could not generate this quiz.");
  if (!Array.isArray(result.questions) || !result.questions.length)
    throw new Error("No questions were returned. Try a different chapter.");
  return result.questions.map((q) => ({ ...q, id: crypto.randomUUID() }));
}

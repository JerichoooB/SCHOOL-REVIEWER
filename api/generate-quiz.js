import {
  authenticated,
  validateInput,
  generateQuestions,
} from "../server/aiQuiz.js";
export function createHandler({
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Use POST to generate a quiz." });
    }
    if (
      !environment.GEMINI_API_KEY ||
      !environment.RECALL_QUIZ_ACCESS_CODE ||
      environment.RECALL_QUIZ_ACCESS_CODE.length < 16 ||
      environment.RECALL_QUIZ_ACCESS_CODE.length > 512
    )
      return res.status(503).json({
        error:
          "AI generation is not configured. Add GEMINI_API_KEY and a RECALL_QUIZ_ACCESS_CODE of at least 16 characters in Vercel, then redeploy.",
      });
    if (
      !authenticated(
        req.headers.authorization,
        environment.RECALL_QUIZ_ACCESS_CODE,
      )
    )
      return res.status(401).json({
        error:
          "Incorrect generation passcode. Enter the private passcode configured for this app.",
      });
    if (
      !req.headers["content-type"]?.toLowerCase().startsWith("application/json")
    )
      return res.status(415).json({ error: "Send document text as JSON." });
    // Bound billable input before contacting the provider. No document text or secrets are logged.
    if (Number(req.headers["content-length"]) > 250000)
      return res.status(413).json({
        error: "Document request is too large. Upload a shorter chapter.",
      });
    let input;
    try {
      let body = req.body;
      if (typeof body === "string") {
        if (Buffer.byteLength(body) > 250000)
          return res
            .status(413)
            .json({ error: "Document request is too large." });
        body = JSON.parse(body);
      }
      if (Buffer.byteLength(JSON.stringify(body) || "") > 250000)
        return res
          .status(413)
          .json({ error: "Document request is too large." });
      input = validateInput(body);
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof SyntaxError
            ? "Invalid JSON request."
            : error.message,
      });
    }
    try {
      const questions = await generateQuestions(input, {
        apiKey: environment.GEMINI_API_KEY,
        model: environment.RECALL_AI_MODEL || "gemini-2.5-flash-lite",
        fetchImpl,
      });
      return res.status(200).json({ questions });
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError")
        return res.status(504).json({
          error:
            "Generation timed out. Try a shorter chapter or fewer questions.",
        });
      return res.status(error.status || 502).json({
        error: error.status
          ? error.message
          : "Quiz generation failed. Please try again.",
      });
    }
  };
}
export default createHandler();

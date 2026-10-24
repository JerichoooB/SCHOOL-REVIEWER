export const normalize = (text) =>
  String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ");
export const grade = (answer, accepted) =>
  accepted.some((a) => normalize(a) === normalize(answer));
const stop = new Set(
  "which their there these those about would should could because between through during before after where when being other under above within using does have that this with from into they them your were been will then than also such some more most only each what".split(
    " ",
  ),
);
export function draftQuestions(sections, limit = 10) {
  const questions = [],
    seen = new Set();
  for (const section of sections) {
    const sentences = section.text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+|\n+/);
    for (let sentence of sentences) {
      sentence = sentence.trim();
      if (sentence.length < 45 || sentence.length > 400 || seen.has(sentence))
        continue;
      const words = sentence.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) || [];
      const candidates = words.filter((w) => !stop.has(w.toLowerCase()));
      if (!candidates.length) continue;
      const answer = [...candidates].sort((a, b) => b.length - a.length)[0];
      const at = sentence.indexOf(answer);
      questions.push({
        id: crypto.randomUUID(),
        prompt:
          sentence.slice(0, at) +
          "________" +
          sentence.slice(at + answer.length),
        accepted: [answer],
        explanation: sentence,
        source: section.source,
      });
      seen.add(sentence);
      if (questions.length >= limit) return questions;
    }
  }
  return questions;
}

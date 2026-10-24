export const normalize = (text) =>
  String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ");
export const grade = (answer, accepted) =>
  accepted.some((a) => normalize(a) === normalize(answer));

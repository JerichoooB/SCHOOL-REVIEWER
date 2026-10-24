// Simplified SM-2: Again resets learning; successful reviews use 1d, 6d,
// then previous interval × ease. Hard uses a smaller 1.2 multiplier.
export function schedule(card, rating, now = Date.now()) {
  if (!["again", "hard", "good", "easy"].includes(rating))
    throw new Error("Unknown rating");
  let ease = card.ease ?? 2.5,
    repetitions = card.repetitions ?? 0,
    interval = card.interval ?? 0;
  if (rating === "again") {
    repetitions = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    repetitions++;
    interval =
      rating === "hard"
        ? Math.max(1, Math.round(interval * 1.2))
        : repetitions === 1
          ? 1
          : repetitions === 2
            ? 6
            : Math.round(interval * ease);
    ease = Math.max(
      1.3,
      ease + (rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : 0),
    );
    if (rating === "easy") interval = Math.max(4, Math.round(interval * 1.3));
  }
  return {
    ...card,
    ease,
    repetitions,
    interval,
    due: now + (rating === "again" ? 60000 : interval * 86400000),
    history: [...(card.history ?? []), { at: now, rating }],
  };
}
export const isDue = (card, now = Date.now()) => card.due <= now;

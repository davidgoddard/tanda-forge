type AutoClearDelayParams = {
  lastInteractionAt: number;
  now: number;
  idleMs: number;
};

export const computeAutoClearRemainingMs = ({
  lastInteractionAt,
  now,
  idleMs,
}: AutoClearDelayParams) => {
  const elapsedMs = Math.max(0, now - lastInteractionAt);
  return Math.max(0, idleMs - elapsedMs);
};

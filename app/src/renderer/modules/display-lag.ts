export type DisplayLagScheduler<T> = {
  schedule: (value: T) => void;
  setDelaySeconds: (seconds: number) => void;
  clear: () => void;
};

export const clampDisplayLagSeconds = (value: number) =>
  Number.isFinite(value) ? Math.min(4, Math.max(0, value)) : 0;

export const createDisplayLagScheduler = <T>(
  send: (value: T) => void,
  initialDelaySeconds = 0,
): DisplayLagScheduler<T> => {
  let delaySeconds = clampDisplayLagSeconds(initialDelaySeconds);
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const clear = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  };

  return {
    schedule(value) {
      if (delaySeconds === 0) {
        send(value);
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        send(value);
      }, delaySeconds * 1000);
      timers.add(timer);
    },
    setDelaySeconds(seconds) {
      const next = clampDisplayLagSeconds(seconds);
      if (next === delaySeconds) {
        return;
      }
      clear();
      delaySeconds = next;
    },
    clear,
  };
};

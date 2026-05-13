export interface Clock {
  now(): Date;
  nowEpochMs(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowEpochMs: () => Date.now(),
};

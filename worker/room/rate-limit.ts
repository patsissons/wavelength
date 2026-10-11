/** Simple token bucket: `capacity` burst, refilling `perMs` tokens per ms. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly perMs: number,
    now = 0,
  ) {
    this.tokens = capacity;
    this.updatedAt = now;
  }

  /** Try to spend one token at time `now`. */
  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.updatedAt);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.perMs);
    this.updatedAt = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export const EFFECT_LIMITS = {
  player: { capacity: 3, perMs: 1 / 1500 },
  room: { capacity: 20, perMs: 10 / 1000 },
} as const;

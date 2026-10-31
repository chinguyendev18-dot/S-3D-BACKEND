/** Same as Supabase's default minimum (and the workshop's old accounts). */
export const MIN_PASSWORD = 6;

const MINUTE = 60_000;

/** [attempts, window] per person for each step that sends email or checks a secret. */
export const LIMITS = {
  changePassword: [5, 15 * MINUTE],
  login: [10, 15 * MINUTE],
  oauth: [30, 15 * MINUTE],
  register: [5, 15 * MINUTE],
  registerPerAddress: [20, 60 * MINUTE],
  sendCode: [5, 15 * MINUTE],
  verifyCode: [10, 15 * MINUTE],
} as const satisfies Record<string, readonly [number, number]>;

/** Ban long enough to mean "until unlocked": Supabase has no permanent ban. */
export const LOCKED_BAN = '876000h';

/** A finished call remembered in this browser so its report survives reloads. */
export interface RecentCall {
  callId: string;
  at: number;
  agent: string;
  failed: boolean;
}

export const MAX_RECENT_CALLS = 25;

export const isRecentCallList = (v: unknown): v is RecentCall[] =>
  Array.isArray(v) &&
  v.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof c.callId === "string" &&
      typeof c.at === "number" &&
      typeof c.agent === "string" &&
      typeof c.failed === "boolean",
  );

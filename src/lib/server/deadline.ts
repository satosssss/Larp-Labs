/**
 * Deterministic deadline/urgency math. The LLM extracts raw facts
 * (e.g. "reply within 5 days of receipt"); all date arithmetic happens here.
 * Dates are date-only ISO strings (YYYY-MM-DD) in Philippine time (UTC+8).
 */
export type Urgency = "overdue" | "critical" | "soon" | "upcoming" | "unknown";

export type DeadlineInput = {
  /** Anchor date (date of receipt or of the notice), YYYY-MM-DD. */
  startDate: string;
  days: number;
  /** "calendar" counts every day; "working" skips weekends and holidays. */
  dayType?: "calendar" | "working";
  /** Calendar mode only: move a weekend/holiday due date to the next working day. */
  rollForward?: boolean;
  /** Holiday dates, YYYY-MM-DD. */
  holidays?: string[];
};

export type DeadlineResult = {
  dueDate: string;
  daysRemaining: number;
  urgency: Urgency;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const PH_OFFSET = 8 * 3_600_000;

export function parseDate(iso: string): number | null {
  if (!ISO.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso)
    return null;
  return t;
}
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Today's date in the Philippines, as YYYY-MM-DD. */
export function todayPH(now: Date = new Date()): string {
  return fmt(now.getTime() + PH_OFFSET);
}

const isWeekend = (t: number) => [0, 6].includes(new Date(t).getUTCDay());

export function urgencyFor(daysRemaining: number): Urgency {
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 2) return "critical";
  if (daysRemaining <= 7) return "soon";
  return "upcoming";
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = parseDate(fromIso);
  const b = parseDate(toIso);
  return a === null || b === null ? null : Math.round((b - a) / DAY);
}

/** Urgency of a fixed event date (hearing, conference). Unknown stays unknown. */
export function eventUrgency(
  eventDate: string | null | undefined,
  now?: Date,
): { daysRemaining: number | null; urgency: Urgency } {
  if (!eventDate) return { daysRemaining: null, urgency: "unknown" };
  const d = daysBetween(todayPH(now), eventDate);
  if (d === null) return { daysRemaining: null, urgency: "unknown" };
  return { daysRemaining: d, urgency: urgencyFor(d) };
}

export function computeDeadline(
  input: DeadlineInput,
  now?: Date,
): DeadlineResult | null {
  const start = parseDate(input.startDate);
  if (start === null || !Number.isInteger(input.days)) return null;
  if (input.days < 0 || input.days > 3650) return null;
  const holidays = new Set(input.holidays ?? []);
  const off = (t: number) => isWeekend(t) || holidays.has(fmt(t));

  let due = start;
  if (input.dayType === "working") {
    let left = input.days;
    while (left > 0) {
      due += DAY;
      if (!off(due)) left--;
    }
  } else {
    due += input.days * DAY;
    if (input.rollForward) while (off(due)) due += DAY;
  }

  const today = parseDate(todayPH(now))!;
  const daysRemaining = Math.round((due - today) / DAY);
  return {
    dueDate: fmt(due),
    daysRemaining,
    urgency: urgencyFor(daysRemaining),
  };
}

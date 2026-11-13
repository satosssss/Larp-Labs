import {
  ApiFailure,
  ok,
  readJson,
  withHandler,
} from "@/lib/server/api";
import { RULES } from "@/lib/server/ratelimit";
import {
  computeDeadline,
  eventUrgency,
  parseDate,
  type DeadlineInput,
} from "@/lib/server/deadline";

export const runtime = "nodejs";

/**
 * POST { eventDate } -> { daysRemaining, urgency }
 * POST { startDate, days, dayType?, rollForward?, holidays? } -> { dueDate, daysRemaining, urgency }
 */
export const POST = withHandler("deadline", RULES.read, async (req) => {
  const b = await readJson<Record<string, unknown>>(req, 20_000);
  if ("eventDate" in b) {
    if (typeof b.eventDate !== "string" || parseDate(b.eventDate) === null)
      throw new ApiFailure("BAD_REQUEST", '"eventDate" must be YYYY-MM-DD.');
    return ok(eventUrgency(b.eventDate));
  }
  if (typeof b.startDate !== "string" || typeof b.days !== "number")
    throw new ApiFailure("BAD_REQUEST", '"startDate" and "days" are required.');
  const holidays = Array.isArray(b.holidays)
    ? b.holidays.filter((h): h is string => typeof h === "string").slice(0, 400)
    : undefined;
  const input: DeadlineInput = {
    startDate: b.startDate,
    days: b.days,
    dayType: b.dayType === "working" ? "working" : "calendar",
    rollForward: b.rollForward === true,
    holidays,
  };
  const result = computeDeadline(input);
  if (!result) throw new ApiFailure("BAD_REQUEST", "Invalid date or day count.");
  return ok(result);
});

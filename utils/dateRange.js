/**
 * Timezone-aware date range helpers.
 *
 * MongoDB stores every date in UTC. Computing "today"/"this-week"/"this-month"
 * boundaries with the server's local clock (UTC in production) makes the day
 * roll over at 00:00 UTC = 05:00 PKT, so transactions between local midnight
 * and 5 AM get attributed to the previous day. These helpers compute the
 * boundaries in the business timezone instead and return the correct UTC
 * instant to query against.
 *
 * The timezone is configurable via the BUSINESS_TIMEZONE env var and defaults
 * to Asia/Karachi (PKT, UTC+5, no daylight saving).
 */

const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Karachi';

/**
 * Offset (in ms) of `timeZone` relative to UTC at the given instant.
 * Positive for zones ahead of UTC (e.g. +5h for Asia/Karachi).
 */
function getTimezoneOffsetMs(timeZone, date) {
  const tzTime = new Date(date.toLocaleString('en-US', { timeZone }));
  const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return tzTime.getTime() - utcTime.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` into the matching UTC Date instant.
 */
function zonedWallTimeToUtc(year, month, day, timeZone) {
  // Treat the wall time as if it were UTC, then correct by the zone's offset.
  const utcGuess = Date.UTC(year, month, day, 0, 0, 0, 0);
  const offset = getTimezoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offset);
}

/**
 * A Date whose local calendar fields (getFullYear/getMonth/getDate/getDay)
 * read as the wall-clock time in `timeZone`. Only use it to read those fields.
 */
function nowInZone(now, timeZone) {
  return new Date(now.toLocaleString('en-US', { timeZone }));
}

/**
 * Returns the UTC start instant for a period, computed in the business timezone.
 *
 * @param {string} period - "today" | "this-week" | "this-month" | "all-time"
 * @param {Date}   [now]  - reference instant (defaults to current time)
 * @param {string} [timeZone] - IANA timezone (defaults to BUSINESS_TIMEZONE)
 * @returns {Date|null} UTC start Date, or null for "all-time" / unknown periods
 */
function getPeriodStart(period, now = new Date(), timeZone = BUSINESS_TIMEZONE) {
  const zoned = nowInZone(now, timeZone);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();

  switch (period) {
    case 'today':
      return zonedWallTimeToUtc(year, month, day, timeZone);

    case 'this-week': {
      // Week starts on Sunday (matches the existing dashboard behavior)
      const dayOfWeek = zoned.getDay();
      const weekStart = new Date(zoned);
      weekStart.setDate(zoned.getDate() - dayOfWeek);
      return zonedWallTimeToUtc(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate(),
        timeZone
      );
    }

    case 'this-month':
      return zonedWallTimeToUtc(year, month, 1, timeZone);

    case 'all-time':
    default:
      return null;
  }
}

module.exports = { getPeriodStart, BUSINESS_TIMEZONE };

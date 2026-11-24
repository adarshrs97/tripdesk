// Pure Duration & Time Parsing Functions - Integer Minutes Only

/**
 * Parses a legacy HH.MM string into integer minutes.
 * E.g., "12.15" -> 12 * 60 + 15 = 735 minutes
 * Throws an Error if minutes >= 60 (e.g. "1.75" is invalid).
 */
export function parseHHMM(val: string | number): number {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).trim();

  // If simple integer
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10) * 60;
  }

  // Handle "HH.MM" or "HH:MM"
  const match = str.match(/^(\d+)[.:](\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid duration format "${str}". Expected HH.MM or HH:MM.`);
  }

  const hours = parseInt(match[1], 10);
  const minutesPart = match[2];
  // If single digit like "1.3" -> 30 mins
  const minutes = minutesPart.length === 1 ? parseInt(minutesPart, 10) * 10 : parseInt(minutesPart, 10);

  if (minutes >= 60) {
    throw new Error(`Invalid minutes portion in "${str}": minutes must be < 60.`);
  }

  return hours * 60 + minutes;
}

/**
 * Formats integer minutes into standard "HH:MM".
 * E.g. 735 -> "12:15"
 */
export function formatMinutesToHM(minutes: number): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Robust time string parser handling messy inputs from the Excel sheets:
 * Examples handled:
 * - "9.am" -> 540 min (09:00)
 * - "10.pm night" -> 1320 min (22:00)
 * - "7Pm" -> 1140 min (19:00)
 * - "5.15am" -> 315 min (05:15)
 * - "9.15p m" -> 1275 min (21:15)
 * - "8.45" -> 525 min (08:45)
 * - Excel day fraction: 0.375 -> 540 min (09:00)
 * Returns integer minutes from midnight (0 to 1439).
 */
export function parseTimeString(input: string | number): number {
  if (input === null || input === undefined || input === '') {
    throw new Error('Empty time input');
  }

  // 1. Numeric Excel fraction of a 24-hour day (e.g. 0.375 = 9:00 AM, 0.208333 = 5:00 AM)
  if (typeof input === 'number') {
    if (input >= 0 && input < 1) {
      return Math.round(input * 1440) % 1440;
    }
    // If entered as 5 (for 5 AM)
    if (input >= 1 && input <= 24) {
      return (Math.floor(input) % 24) * 60;
    }
  }

  const raw = String(input).trim().toLowerCase();

  // If decimal string fraction (e.g. "0.375")
  const numVal = parseFloat(raw);
  if (!isNaN(numVal) && numVal > 0 && numVal < 1 && !raw.includes(':') && !raw.includes('am') && !raw.includes('pm')) {
    return Math.round(numVal * 1440) % 1440;
  }

  // Check AM/PM indicators
  const isPM = raw.includes('pm') || raw.includes('p m') || raw.includes('night');
  const isAM = raw.includes('am') || raw.includes('a m') || raw.includes('morning');

  // Strip non-digit and non-separator chars
  const clean = raw.replace(/[^\d.:]/g, ' ').trim();
  const parts = clean.split(/[.:\s]+/).filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`Unable to parse time string "${input}"`);
  }

  let hours = parseInt(parts[0], 10);
  let minutes = 0;

  if (parts.length >= 2) {
    const minPart = parts[1];
    minutes = minPart.length === 1 ? parseInt(minPart, 10) * 10 : parseInt(minPart, 10);
  }

  if (isNaN(hours) || isNaN(minutes) || minutes >= 60) {
    throw new Error(`Invalid time components in "${input}"`);
  }

  // Adjust for 12-hour clock
  if (isPM) {
    if (hours < 12) hours += 12;
  } else if (isAM) {
    if (hours === 12) hours = 0;
  }

  return ((hours % 24) * 60 + minutes) % 1440;
}

/**
 * Calculates day duration in integer minutes between start and close time.
 * Handles overnight shifts when endsNextDay is true or close < start.
 */
export function calculateTripDurationMinutes(
  startTime: string | number,
  closeTime: string | number,
  endsNextDay = false
): number {
  const startMin = parseTimeString(startTime);
  const closeMin = parseTimeString(closeTime);

  if (closeMin >= startMin && !endsNextDay) {
    return closeMin - startMin;
  }

  // Overnight trip
  return 1440 - startMin + closeMin;
}

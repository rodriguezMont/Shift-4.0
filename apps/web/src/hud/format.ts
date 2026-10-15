/** Formats minutes since midnight as a 24-hour clock, e.g. 582 → "09:42". */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const whole = Math.floor(minuteOfDay);
  const hours = String(Math.floor(whole / 60)).padStart(2, '0');
  const minutes = String(whole % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

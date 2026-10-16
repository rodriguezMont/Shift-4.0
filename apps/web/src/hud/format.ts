/** Formats minutes since midnight as a 24-hour clock, e.g. 582 → "09:42". */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const whole = Math.floor(minuteOfDay);
  const hours = String(Math.floor(whole / 60)).padStart(2, '0');
  const minutes = String(whole % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const MONEY_FORMAT = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;
const money = new Intl.NumberFormat('en-US', MONEY_FORMAT);
const signedMoney = new Intl.NumberFormat('en-US', { ...MONEY_FORMAT, signDisplay: 'exceptZero' });

/** Whole dollars, e.g. -120.4 → "-$120". `signed` also marks gains, e.g. "+$300". */
export function formatMoney(amount: number, { signed = false } = {}): string {
  // `|| 0` turns -0 into 0, so a rounded-away loss never shows as "-$0".
  const whole = Math.round(amount) || 0;
  return (signed ? signedMoney : money).format(whole);
}

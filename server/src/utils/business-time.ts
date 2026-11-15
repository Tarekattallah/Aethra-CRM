import 'dotenv/config';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.BUSINESS_TIMEZONE || 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
});
function dayKey(date: Date): string {
  const parts = formatter.formatToParts(date);
  return ['year','month','day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}

// Find the first instant of the local day, including daylight-saving transitions.
export function startOfBusinessDay(now = new Date()): Date {
  const key = dayKey(now);
  let low = now.getTime() - 36 * 3600000;
  let high = now.getTime();
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dayKey(new Date(middle)) < key) low = middle; else high = middle;
  }
  return new Date(high);
}

const guatemalaHourFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: 'America/Guatemala',
});

export function getDashboardGreeting(date: Date): 'Buenos días' | 'Buenas tardes' | 'Buenas noches' {
  const hourPart = guatemalaHourFormatter.formatToParts(date).find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 'Buenos días';
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

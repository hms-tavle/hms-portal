export const RECURRENCE_CODES = [
  'daily',
  'monthly',
  'quarterly',
  'twice_yearly',
  'annually',
  'every_2_years',
  'every_5_years',
  'every_5_7_years',
  'every_10_years',
  'per_project',
] as const

export type RecurrenceCode = (typeof RECURRENCE_CODES)[number]

export const RECURRENCE_LABELS: Record<RecurrenceCode, string> = {
  daily: 'Daglig',
  monthly: 'Månedlig',
  quarterly: 'Kvartalsvis',
  twice_yearly: 'Halvårlig',
  annually: 'Årlig',
  every_2_years: 'Hvert 2. år',
  every_5_years: 'Hvert 5. år',
  every_5_7_years: 'Hvert 5.–7. år',
  every_10_years: 'Hvert 10. år',
  per_project: 'Per prosjekt',
}

/** Interval in days for each recurrence. `per_project` has no interval. */
export const RECURRENCE_DAYS: Partial<Record<RecurrenceCode, number>> = {
  daily: 1,
  monthly: 30,
  quarterly: 91,
  twice_yearly: 182,
  annually: 365,
  every_2_years: 365 * 2,
  every_5_years: 365 * 5,
  every_5_7_years: 365 * 5,
  every_10_years: 365 * 10,
}

/** Expected completions per calendar year. Only meaningful when > 1. */
export const RECURRENCE_PER_YEAR: Record<RecurrenceCode, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  twice_yearly: 2,
  annually: 1,
  every_2_years: 1,
  every_5_years: 1,
  every_5_7_years: 1,
  every_10_years: 1,
  per_project: 0,
}

export function getRecurrenceLabel(code: string): string {
  return RECURRENCE_LABELS[code as RecurrenceCode] ?? code
}

export function getRecurrenceDays(code: string): number | undefined {
  return RECURRENCE_DAYS[code as RecurrenceCode]
}

export function getRecurrencePerYear(code: string): number {
  return RECURRENCE_PER_YEAR[code as RecurrenceCode] ?? 0
}

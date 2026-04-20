export const ROLE_CODES = ['LEDE', 'NEST', 'MEDL', 'VARA', 'KONT', 'EKST'] as const
export type RoleCode = (typeof ROLE_CODES)[number]

export const ROLE_LABELS: Record<RoleCode, string> = {
  LEDE: 'Styreleder',
  NEST: 'Nestleder',
  MEDL: 'Styremedlem',
  VARA: 'Varamedlem',
  KONT: 'Kontaktperson',
  EKST: 'Ekstern aktør',
}

/** Preferred display order for role lists */
export const ROLE_ORDER: RoleCode[] = ['LEDE', 'NEST', 'MEDL', 'VARA', 'KONT', 'EKST']

/** Returns the Norwegian label for a role code, falling back to the raw code. */
export function getRoleLabel(code: string): string {
  return ROLE_LABELS[code as RoleCode] ?? code
}

import type { BrregEnhet, BrregRollerResponse } from '@/types/brreg'

const BASE = 'https://data.brreg.no/enhetsregisteret/api'

export const ORG_FORM_CODES = ['BRL', 'ESEK', 'SA'] as const
export type OrgFormCode = (typeof ORG_FORM_CODES)[number]

export const ORG_FORM_LABELS: Record<OrgFormCode, string> = {
  BRL: 'Borettslag',
  ESEK: 'Eierseksjonssameie',
  SA: 'Samvirkeforetak',
}

export function getOrgFormLabel(kode: string): string {
  return ORG_FORM_LABELS[kode as OrgFormCode] ?? kode
}

export async function fetchEnhet(orgnr: string): Promise<BrregEnhet | null> {
  const res = await fetch(`${BASE}/enheter/${orgnr.replace(/\s/g, '')}`)
  if (!res.ok) return null
  return res.json()
}

export async function searchAssociations(query: string): Promise<BrregEnhet[]> {
  const isOrgNumber = /^\d{9}$/.test(query.replace(/\s/g, ''))

  if (isOrgNumber) {
    const enhet = await fetchEnhet(query)
    if (!enhet || !(ORG_FORM_CODES as readonly string[]).includes(enhet.organisasjonsform?.kode)) return []
    return [enhet]
  }

  const params = new URLSearchParams({ navn: query, size: '20' })

  const res = await fetch(`${BASE}/enheter?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  const all: BrregEnhet[] = data._embedded?.enheter ?? []

  // The API doesn't support filtering by org form — do it client-side
  const enheter = all.filter(e =>
    (ORG_FORM_CODES as readonly string[]).includes(e.organisasjonsform?.kode)
  )

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const normalizedQuery = normalize(query)
  const exactMatch = enheter.find(e => normalize(e.navn) === normalizedQuery)

  return exactMatch ? [exactMatch] : enheter
}

export async function fetchRoller(orgnr: string): Promise<BrregRollerResponse | null> {
  const res = await fetch(`${BASE}/enheter/${orgnr}/roller`)
  if (!res.ok) return null
  return res.json()
}

export function formatName(navn: { fornavn: string; mellomnavn?: string; etternavn: string }): string {
  return [navn.fornavn, navn.mellomnavn, navn.etternavn]
    .filter(Boolean)
    .map(n => n!.charAt(0).toUpperCase() + n!.slice(1).toLowerCase())
    .join(' ')
}

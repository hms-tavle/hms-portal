import type { BrregEnhet, BrregRollerResponse } from '@/types/brreg'

const BASE = 'https://data.brreg.no/enhetsregisteret/api'

export async function searchAssociations(query: string): Promise<BrregEnhet[]> {
  const isOrgNumber = /^\d{9}$/.test(query.replace(/\s/g, ''))

  if (isOrgNumber) {
    const orgnr = query.replace(/\s/g, '')
    const res = await fetch(`${BASE}/enheter/${orgnr}`)
    if (!res.ok) return []
    const enhet: BrregEnhet = await res.json()
    // Only return if it's a housing association
    if (!['BRL', 'SA'].includes(enhet.organisasjonsform?.kode)) return []
    return [enhet]
  }

  const params = new URLSearchParams({ navn: query, size: '20' })

  const res = await fetch(`${BASE}/enheter?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  const enheter: BrregEnhet[] = data._embedded?.enheter ?? []

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

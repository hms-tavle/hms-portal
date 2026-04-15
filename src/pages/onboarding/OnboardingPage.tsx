import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAssociations, fetchRoller, formatName, getOrgFormLabel } from '@/lib/brreg'
import type { BrregEnhet, BrregRolle } from '@/types/brreg'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getRoleLabel } from '@/constants/roles'

type Step = 'search' | 'members'

interface MemberWithEmail extends BrregRolle {
  email: string
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BrregEnhet[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BrregEnhet | null>(null)
  const [members, setMembers] = useState<MemberWithEmail[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    try {
      const hits = await searchAssociations(query.trim())
      if (hits.length === 0) setSearchError('Ingen resultater funnet. Prøv et annet søk.')
      setResults(hits)
    } catch {
      setSearchError('Kunne ikke kontakte Brønnøysundregisteret. Prøv igjen.')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(enhet: BrregEnhet) {
    setSelected(enhet)
    setLoadingMembers(true)
    try {
      const rollerResponse = await fetchRoller(enhet.organisasjonsnummer)
      const allRoles: MemberWithEmail[] = []
      if (rollerResponse) {
        for (const group of rollerResponse.rollegrupper) {
          for (const rolle of group.roller) {
            if (!rolle.fratraadt && rolle.person) {
              allRoles.push({ ...rolle, email: '' })
            }
          }
        }
      }
      setMembers(allRoles)
      setStep('members')
    } catch {
      setSearchError('Kunne ikke hente styremedlemmer. Prøv igjen.')
    } finally {
      setLoadingMembers(false)
    }
  }

  function updateEmail(index: number, email: string) {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, email } : m))
  }

  const styreleder = members.find(m => m.type.kode === 'LEDE')
  const styrelederEmail = styreleder?.email ?? ''
  const styrelederEmailMissing = !styrelederEmail
  const passwordMismatch = password !== confirmPassword
  const passwordTooShort = password.length > 0 && password.length < 8
  const canSubmit = !styrelederEmailMissing && password.length >= 8 && !passwordMismatch

  async function handleSubmit() {
    if (!canSubmit || !selected) return
    setSubmitting(true)
    setSubmitError(null)

    // Block only if org already has a paying subscription
    const { data: existing } = await supabase
      .from('associations')
      .select('status')
      .eq('orgnr', selected.organisasjonsnummer)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      setSubmitError('Denne organisasjonen har allerede et aktivt abonnement. Kontakt oss hvis du mener dette er feil.')
      setSubmitting(false)
      return
    }

    // Create auth account — immediately authenticated (email confirmation disabled)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: styrelederEmail,
      password,
    })

    if (authError || !authData.user) {
      const alreadyRegistered = authError?.message?.toLowerCase().includes('already registered')
      setSubmitError(
        alreadyRegistered
          ? 'Denne e-postadressen er allerede registrert. Prøv å logge inn i stedet.'
          : (authError?.message ?? 'Kunne ikke opprette konto. Prøv igjen.')
      )
      setSubmitting(false)
      return
    }

    // Generate ID client-side to avoid needing a SELECT after insert
    const associationId = crypto.randomUUID()

    const { error: assocError } = await supabase
      .from('associations')
      .insert({
        id: associationId,
        orgnr: selected.organisasjonsnummer,
        navn: selected.navn,
        org_form: selected.organisasjonsform.kode,
        poststed: selected.forretningsadresse?.poststed ?? null,
      })

    if (assocError) {
      setSubmitError('Kunne ikke registrere boligforeningen. Prøv igjen.')
      setSubmitting(false)
      return
    }

    // Insert all members (styreleder gets user_id set)
    const memberRows = members.map(m => ({
      association_id: associationId,
      user_id: m.type.kode === 'LEDE' ? authData.user!.id : null,
      role_code: m.type.kode,
      full_name: m.person ? formatName(m.person.navn) : 'Ukjent',
      email: m.email || null,
    }))

    const { error: membersError } = await supabase
      .from('association_members')
      .insert(memberRows)

    if (membersError) {
      setSubmitError('Kunne ikke lagre styremedlemmer. Prøv igjen.')
      setSubmitting(false)
      return
    }

    const styrelederName = styreleder?.person ? formatName(styreleder.person.navn) : 'Ukjent'
    await supabase
      .from('user_profiles')
      .insert({ id: authData.user!.id, full_name: styrelederName })

    navigate('/dashboard')
  }

  // ── Search ────────────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Finn din boligforening</h1>
            <p className="text-muted-foreground mt-1">
              Søk på navn eller organisasjonsnummer
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Eks: Solheim borettslag eller 912345678"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? 'Søker…' : 'Søk'}
            </Button>
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map(enhet => (
                <Card
                  key={enhet.organisasjonsnummer}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelect(enhet)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{enhet.navn}</CardTitle>
                      <Badge variant="secondary">
                        {getOrgFormLabel(enhet.organisasjonsform.kode)}
                      </Badge>
                    </div>
                    <CardDescription>
                      Org.nr: {enhet.organisasjonsnummer}
                      {enhet.forretningsadresse?.poststed && (
                        <> · {enhet.forretningsadresse.poststed}</>
                      )}
                    </CardDescription>
                  </CardHeader>
                  {loadingMembers && selected?.organisasjonsnummer === enhet.organisasjonsnummer && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Henter styremedlemmer…</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Har du allerede konto?{' '}
            <a href="#/login" className="underline underline-offset-4 hover:text-primary">
              Logg inn
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── Members + password ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4 py-8">
        <div>
          <button
            className="text-sm text-muted-foreground hover:text-foreground mb-2"
            onClick={() => setStep('search')}
          >
            ← Tilbake til søk
          </button>
          <h1 className="text-2xl font-semibold">{selected?.navn}</h1>
          <p className="text-muted-foreground mt-1">
            Org.nr: {selected?.organisasjonsnummer} ·{' '}
            {selected && getOrgFormLabel(selected.organisasjonsform.kode)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Styremedlemmer</CardTitle>
            <CardDescription>
              Legg til e-postadresse for styreleder (påkrevd) og eventuelt andre medlemmer.
              Øvrige medlemmer kan inviteres senere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ingen registrerte styremedlemmer funnet i Brønnøysundregisteret.
              </p>
            )}
            {members.map((member, index) => {
              const isStyreleder = member.type.kode === 'LEDE'
              const name = member.person ? formatName(member.person.navn) : 'Ukjent'
              const roleLabel = getRoleLabel(member.type.kode)
              return (
                <div key={index}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{name}</span>
                      <Badge variant={isStyreleder ? 'default' : 'secondary'} className="text-xs">
                        {roleLabel}
                      </Badge>
                      {isStyreleder && (
                        <span className="text-xs text-destructive">* påkrevd</span>
                      )}
                    </div>
                    <Input
                      type="email"
                      placeholder={isStyreleder ? 'E-post (påkrevd)' : 'E-post (valgfritt)'}
                      value={member.email}
                      onChange={e => updateEmail(index, e.target.value)}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Velg passord</CardTitle>
            <CardDescription>
              Dette er passordet for styreleders konto ({styrelederEmail || 'fyll inn e-post over'}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minst 8 tegn"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={styrelederEmailMissing}
              />
              {passwordTooShort && (
                <p className="text-sm text-destructive">Passordet må være minst 8 tegn.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Bekreft passord</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Gjenta passordet"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={styrelederEmailMissing}
              />
              {confirmPassword && passwordMismatch && (
                <p className="text-sm text-destructive">Passordene stemmer ikke overens.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Oppretter konto…' : 'Fullfør registrering'}
        </Button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MemberInfo {
  id: string
  full_name: string
  role_code: string
}

const ROLE_LABELS: Record<string, string> = {
  LEDE: 'Styreleder',
  MEDL: 'Styremedlem',
  VARA: 'Varamedlem',
  NEST: 'Nestleder',
  KONT: 'Kontaktperson',
}

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [member, setMember] = useState<MemberInfo | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loadingToken, setLoadingToken] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function lookup() {
      if (!token) {
        setTokenError('Ugyldig invitasjonslenke.')
        setLoadingToken(false)
        return
      }

      const { data, error } = await supabase
        .from('association_members')
        .select('id, full_name, role_code')
        .eq('invite_token', token)
        .gt('invite_expires_at', new Date().toISOString())
        .is('user_id', null)
        .single()

      if (error || !data) {
        setTokenError('Invitasjonslenken er ugyldig eller har utløpt.')
      } else {
        setMember(data as MemberInfo)
      }
      setLoadingToken(false)
    }
    lookup()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member || !token) return
    setSubmitting(true)
    setError(null)

    // Sign up the user
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Denne e-postadressen er allerede registrert. Logg inn i stedet.'
        : signUpError.message)
      setSubmitting(false)
      return
    }

    // Claim the invite — links user_id and clears the token
    const { error: claimError } = await supabase.rpc('claim_invite', { token })
    if (claimError) {
      setError('Kunne ikke koble kontoen til invitasjonen. Kontakt administrator.')
      setSubmitting(false)
      return
    }

    navigate('/dashboard')
  }

  if (loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Laster invitasjon…</p>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-destructive">{tokenError}</p>
          <Button variant="outline" onClick={() => navigate('/login')}>
            Gå til innlogging
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">HMS-portal</p>
          <h1 className="text-xl font-semibold">Opprett konto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Du er invitert som{' '}
            <span className="font-medium text-foreground">
              {ROLE_LABELS[member!.role_code] ?? member!.role_code}
            </span>{' '}
            — {member!.full_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passord</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Oppretter konto…' : 'Opprett konto'}
          </Button>
        </form>
      </div>
    </div>
  )
}

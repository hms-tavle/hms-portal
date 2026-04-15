import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRoleLabel } from '@/constants/roles'

interface MemberInfo {
  full_name: string
  role_code: string
  associationName: string
}

type AuthMode = 'login' | 'signup'

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { refreshWorkspaces } = useWorkspace()
  const token = searchParams.get('token')

  const [member, setMember] = useState<MemberInfo | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loadingToken, setLoadingToken] = useState(true)

  const [authMode, setAuthMode] = useState<AuthMode>('login')
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
        .select('full_name, role_code, associations(navn)')
        .eq('invite_token', token)
        .gt('invite_expires_at', new Date().toISOString())
        .is('user_id', null)
        .single()

      if (error || !data) {
        setTokenError('Invitasjonslenken er ugyldig eller har utløpt.')
      } else {
        setMember({
          full_name: data.full_name,
          role_code: data.role_code,
          associationName: (data as any).associations?.navn ?? '',
        })
      }
      setLoadingToken(false)
    }
    lookup()
  }, [token])

  async function claimAndNavigate(): Promise<boolean> {
    const { error: claimError } = await supabase.rpc('claim_invite', { token })
    if (claimError) {
      setError('Kunne ikke koble kontoen til invitasjonen. Kontakt administrator.')
      return false
    }
    await refreshWorkspaces()
    navigate('/dashboard')
    return true
  }

  // Already logged in — claim directly without re-authenticating
  async function handleClaimDirectly() {
    if (!member || !token) return
    setSubmitting(true)
    setError(null)
    await claimAndNavigate()
    setSubmitting(false)
  }

  // Not logged in — sign in or sign up, then claim
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member || !token) return
    setSubmitting(true)
    setError(null)

    if (authMode === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Feil e-post eller passord.')
        setSubmitting(false)
        return
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setSubmitting(false)
        return
      }
    }

    await claimAndNavigate()
    setSubmitting(false)
  }

  // ── Loading / error states ────────────────────────────────────────────────

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

  // ── Invite card ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">HMS-portal</p>
          <h1 className="text-xl font-semibold">{member!.associationName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Du er invitert som{' '}
            <span className="font-medium text-foreground">
              {getRoleLabel(member!.role_code)}
            </span>
            {' — '}{member!.full_name}
          </p>
        </div>

        {session ? (
          // User is already logged in — one click to join
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Du er allerede innlogget. Klikk for å bli med i {member!.associationName}.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleClaimDirectly} disabled={submitting}>
              {submitting ? 'Kobler til…' : `Bli med i ${member!.associationName}`}
            </Button>
          </div>
        ) : (
          // User needs to authenticate first
          <div className="space-y-4">
            <div className="flex gap-1 border-b">
              {(['login', 'signup'] as AuthMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setAuthMode(mode); setError(null) }}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    authMode === mode
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
                </button>
              ))}
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
                  minLength={authMode === 'signup' ? 8 : 1}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? '…'
                  : authMode === 'login'
                    ? 'Logg inn og bli med'
                    : 'Opprett konto og bli med'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

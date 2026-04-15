import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Layout from '@/components/Layout'
import { getRoleLabel, ROLE_ORDER } from '@/constants/roles'
import type { AssociationMember } from '@/types/app'
import { useAssociation } from '@/hooks/useAssociation'

function inviteUrl(token: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/invite?token=${token}`
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt) < new Date()
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { association, loading: assocLoading } = useAssociation()

  const [members, setMembers] = useState<AssociationMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loading = assocLoading || membersLoading

  useEffect(() => {
    if (assocLoading) return
    if (!association) { setMembersLoading(false); return }

    const assocId = association.id

    async function load() {
      const { data: membersData } = await supabase
        .from('association_members')
        .select('id, full_name, email, role_code, user_id, invite_token, invite_expires_at')
        .eq('association_id', assocId)

      const sorted = (membersData ?? []).sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a.role_code)
        const bi = ROLE_ORDER.indexOf(b.role_code)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })

      setMembers(sorted)
      setMembersLoading(false)
    }

    load()
  }, [assocLoading, association])

  async function generateInvite(memberId: string) {
    setGenerating(memberId)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('association_members')
      .update({ invite_token: token, invite_expires_at: expiresAt })
      .eq('id', memberId)

    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === memberId
          ? { ...m, invite_token: token, invite_expires_at: expiresAt }
          : m
      ))
    }
    setGenerating(null)
  }

  async function copyInvite(memberId: string, token: string) {
    await navigator.clipboard.writeText(inviteUrl(token))
    setCopied(memberId)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Layout associationName={association?.navn}>
      {loading && <p className="text-muted-foreground">Laster medlemmer…</p>}

      {!loading && !association && (
        <p className="text-muted-foreground">Ingen boligforening funnet for din konto.</p>
      )}

      {!loading && association && (
        <div className="divide-y border rounded-lg">
          {members.map(member => {
            const hasValidInvite = member.invite_token && !isExpired(member.invite_expires_at)

            return (
              <div key={member.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{member.full_name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getRoleLabel(member.role_code)}
                      </Badge>
                      {!member.user_id && (
                        <Badge variant="secondary" className="text-xs shrink-0">Ikke aktiv</Badge>
                      )}
                    </div>
                    {member.email && (
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    )}
                  </div>

                  {!member.user_id && (
                    <div className="flex items-center gap-2 shrink-0">
                      {hasValidInvite ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyInvite(member.id, member.invite_token!)}
                        >
                          {copied === member.id ? 'Kopiert!' : 'Kopier lenke'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generating === member.id}
                          onClick={() => generateInvite(member.id)}
                        >
                          {generating === member.id ? '…' : 'Inviter'}
                        </Button>
                      )}
                      {hasValidInvite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={generating === member.id}
                          onClick={() => generateInvite(member.id)}
                          title="Generer ny lenke"
                        >
                          Forny
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {hasValidInvite && (
                  <div className="mt-2 ml-0">
                    <p className="text-xs text-muted-foreground break-all font-mono bg-muted rounded px-2 py-1">
                      {inviteUrl(member.invite_token!)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Utløper {new Date(member.invite_expires_at!).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

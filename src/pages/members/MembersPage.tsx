import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Edit2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { getRoleLabel, ROLE_ORDER, ROLE_CODES, type RoleCode } from '@/constants/roles'
import { INVITE_EXPIRY_DAYS } from '@/constants/config'
import { emailField } from '@/lib/validation'
import type { AssociationMember } from '@/types/app'
import { useWorkspace } from '@/contexts/WorkspaceContext'

function inviteUrl(token: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/invite?token=${token}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const navigate = useNavigate()
  const { activeWorkspace, loading: assocLoading } = useWorkspace()
  const association = activeWorkspace?.kind === 'association' ? activeWorkspace.association : null

  // Redirect external actors to dashboard
  useEffect(() => {
    if (!assocLoading && activeWorkspace?.kind === 'association' && activeWorkspace.role_code === 'EKST') {
      navigate('/dashboard')
    }
  }, [assocLoading, activeWorkspace, navigate])

  const [members, setMembers] = useState<AssociationMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showingLink, setShowingLink] = useState<Set<string>>(new Set())
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ full_name: string; email: string; role_code: RoleCode }>({ full_name: '', email: '', role_code: 'MEDL' })
  const [editError, setEditError] = useState<string | null>(null)
  const [showAddExternalActor, setShowAddExternalActor] = useState(false)
  const [externalActorForm, setExternalActorForm] = useState({ full_name: '', email: '', company: '' })
  const [externalActorError, setExternalActorError] = useState<string | null>(null)
  const [addingExternalActor, setAddingExternalActor] = useState(false)

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
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('association_members')
      .update({ invite_token: token, invite_expires_at: expiresAt })
      .eq('id', memberId)

    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, invite_token: token, invite_expires_at: expiresAt } : m
      ))
      setShowingLink(prev => new Set([...prev, memberId]))
    }
    setGenerating(null)
  }

  async function copyInvite(memberId: string, token: string) {
    await navigator.clipboard.writeText(inviteUrl(token))
    setCopied(memberId)
    setTimeout(() => {
      setCopied(null)
      setShowingLink(prev => { const s = new Set(prev); s.delete(memberId); return s })
    }, 2000)
  }

  function dismissLink(memberId: string) {
    setShowingLink(prev => { const s = new Set(prev); s.delete(memberId); return s })
  }

  function startEdit(member: AssociationMember) {
    setEditingMemberId(member.id)
    setEditForm({ full_name: member.full_name, email: member.email ?? '', role_code: member.role_code as RoleCode })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingMemberId(null)
    setEditForm({ full_name: '', email: '', role_code: 'MEDL' })
    setEditError(null)
  }

  async function saveEdit(memberId: string) {
    setEditError(null)

    if (!editForm.full_name.trim()) {
      setEditError('Navn er påkrevd')
      return
    }

    if (editForm.email && !emailField.safeParse(editForm.email).success) {
      setEditError('Ugyldig e-postadresse')
      return
    }

    if (!ROLE_CODES.includes(editForm.role_code)) {
      setEditError('Ugyldig rolle')
      return
    }

    const { error } = await supabase
      .from('association_members')
      .update({
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim() || null,
        role_code: editForm.role_code,
      })
      .eq('id', memberId)

    if (error) {
      setEditError('Kunne ikke lagre endringer')
    } else {
      setMembers(prev => prev.map(m =>
        m.id === memberId
          ? { ...m, full_name: editForm.full_name.trim(), email: editForm.email.trim() || null, role_code: editForm.role_code }
          : m
      ))
      setEditingMemberId(null)
      setEditForm({ full_name: '', email: '', role_code: 'MEDL' })
    }
  }

  async function addExternalActor() {
    setExternalActorError(null)

    if (!externalActorForm.full_name.trim()) {
      setExternalActorError('Navn er påkrevd')
      return
    }

    if (!emailField.safeParse(externalActorForm.email).success) {
      setExternalActorError('Ugyldig e-postadresse')
      return
    }

    setAddingExternalActor(true)

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: insertedMember, error } = await supabase
      .from('association_members')
      .insert({
        association_id: association!.id,
        role_code: 'EKST',
        full_name: externalActorForm.full_name.trim(),
        email: externalActorForm.email.trim(),
        company: externalActorForm.company.trim() || null,
        invite_token: token,
        invite_expires_at: expiresAt,
      })
      .select()
      .single()

    setAddingExternalActor(false)

    if (error) {
      setExternalActorError('Kunne ikke legge til ekstern aktør')
      return
    }

    setMembers(prev => {
      const updated = [...prev, insertedMember]
      return updated.sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a.role_code)
        const bi = ROLE_ORDER.indexOf(b.role_code)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
    })

    setShowAddExternalActor(false)
    setExternalActorForm({ full_name: '', email: '', company: '' })
    setShowingLink(new Set([insertedMember.id]))
  }

  return (
    <Layout>
      {loading && <p className="text-muted-foreground">Laster medlemmer…</p>}

      {!loading && !association && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Medlemsliste er ikke tilgjengelig for personlig konto.</p>
        </div>
      )}

      {!loading && association && (
        <>
          <div className="mb-4 flex justify-end gap-2">
            <Button onClick={() => setShowAddExternalActor(!showAddExternalActor)} variant="outline">
              {showAddExternalActor ? 'Avbryt' : 'Legg til ekstern aktør'}
            </Button>
          </div>

          {showAddExternalActor && (
            <div className="mb-4 border rounded-lg p-4 space-y-3 bg-muted/30">
              <h3 className="text-sm font-medium">Legg til ekstern aktør</h3>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Navn *</label>
                <Input
                  value={externalActorForm.full_name}
                  onChange={e => setExternalActorForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="mt-1"
                  placeholder="Fullt navn"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">E-post *</label>
                <Input
                  value={externalActorForm.email}
                  onChange={e => setExternalActorForm(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                  placeholder="E-postadresse"
                  type="email"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Selskap / Firma</label>
                <Input
                  value={externalActorForm.company}
                  onChange={e => setExternalActorForm(prev => ({ ...prev, company: e.target.value }))}
                  className="mt-1"
                  placeholder="F.eks. Brannvern AS (valgfritt)"
                />
              </div>

              {externalActorError && (
                <p className="text-xs text-red-600">{externalActorError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={addExternalActor} disabled={addingExternalActor}>
                  {addingExternalActor ? 'Legger til…' : 'Legg til'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddExternalActor(false)}>
                  Avbryt
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y border rounded-lg">
            {members.map(member => {
              const isShowingLink = showingLink.has(member.id)
              const isEditing = editingMemberId === member.id

              return (
                <div key={member.id} className="px-4 py-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Navn</label>
                        <Input
                          value={editForm.full_name}
                          onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Fullt navn"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">E-post</label>
                        <Input
                          value={editForm.email}
                          onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="mt-1"
                          placeholder="E-postadresse (valgfritt)"
                          type="email"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Rolle</label>
                        <select
                          value={editForm.role_code}
                          onChange={e => setEditForm(prev => ({ ...prev, role_code: e.target.value as RoleCode }))}
                          className="mt-1 w-full px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          {ROLE_CODES.map(code => (
                            <option key={code} value={code}>{getRoleLabel(code)}</option>
                          ))}
                        </select>
                      </div>

                      {editError && (
                        <p className="text-xs text-red-600">{editError}</p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => saveEdit(member.id)}>
                          Lagre
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          {(member.company || member.email) && (
                            <p className="text-xs text-muted-foreground">
                              {member.company && <span>{member.company}</span>}
                              {member.company && member.email && <span> • </span>}
                              {member.email && <span>{member.email}</span>}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            className="p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(member)}
                            aria-label="Rediger medlem"
                          >
                            <Edit2 size={16} />
                          </button>

                          {!member.user_id && !member.email && (
                            <>
                              {isShowingLink ? (
                                <Button size="sm" variant="outline" onClick={() => copyInvite(member.id, member.invite_token!)}>
                                  {copied === member.id ? 'Kopiert!' : 'Kopier lenke'}
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled={generating === member.id} onClick={() => generateInvite(member.id)}>
                                  {generating === member.id ? '…' : 'Inviter'}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isShowingLink && !member.email && member.invite_token && (
                        <div className="mt-2 flex items-start gap-2">
                          <p className="flex-1 text-xs text-muted-foreground break-all font-mono bg-muted rounded px-2 py-1">
                            {inviteUrl(member.invite_token)}
                          </p>
                          <button
                            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => dismissLink(member.id)}
                            aria-label="Skjul lenke"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Layout>
  )
}

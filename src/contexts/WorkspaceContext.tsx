import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Association } from '@/types/app'

interface MembershipRow {
  associations: Association | null
}

// ── Workspace types ───────────────────────────────────────────────────────────

export type PersonalWorkspace = {
  kind: 'personal'
  id: string          // auth.uid()
  displayName: string // first name from user_profiles
}

export type AssociationWorkspace = {
  kind: 'association'
  id: string          // association.id
  displayName: string // association.navn
  association: Association
}

export type Workspace = PersonalWorkspace | AssociationWorkspace

// ── Context ───────────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (w: Workspace) => void
  refreshWorkspaces: () => Promise<void>
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadWorkspaces(userId: string, preserveSelection = true) {
    const result: Workspace[] = []

    // Personal workspace — present if the user has a user_profiles row
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      result.push({
        kind: 'personal',
        id: profile.id,
        displayName: profile.full_name.split(' ')[0],
      })
    }

    // Association workspaces — one per association_members row
    const { data: memberships } = await supabase
      .from('association_members')
      .select('associations(id, navn, orgnr, org_form, poststed, status)')
      .eq('user_id', userId)

    for (const m of (memberships ?? []) as MembershipRow[]) {
      const assoc = m.associations
      // Deduplicate: a user may have multiple member rows for the same association
      if (assoc && !result.some(w => w.id === assoc.id)) {
        result.push({
          kind: 'association',
          id: assoc.id,
          displayName: assoc.navn,
          association: assoc,
        })
      }
    }

    setWorkspaces(result)
    // Prefer an association workspace as default; fall back to personal.
    // Preserve the current selection if it still exists (e.g. after token refresh).
    const defaultWorkspace = result.find(w => w.kind === 'association') ?? result[0] ?? null
    setActiveWorkspaceState(prev => {
      if (preserveSelection && prev) {
        const fresh = result.find(w => w.id === prev.id)
        if (fresh) return fresh
      }
      return defaultWorkspace
    })
    setLoading(false)
  }

  useEffect(() => {
    if (!session) {
      setWorkspaces([])
      setActiveWorkspaceState(null)
      setLoading(false)
      return
    }
    loadWorkspaces(session.user.id)
  }, [session])

  async function refreshWorkspaces() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession) return
    await loadWorkspaces(currentSession.user.id, false)
  }

  function setActiveWorkspace(w: Workspace) {
    setActiveWorkspaceState(w)
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}

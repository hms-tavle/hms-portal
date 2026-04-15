import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Association } from '@/types/app'

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
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setWorkspaces([])
      setActiveWorkspace(null)
      setLoading(false)
      return
    }

    const userId = session.user.id

    async function load() {
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

      for (const m of memberships ?? []) {
        const assoc = (m as any).associations as Association | null
        if (assoc) {
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
      setActiveWorkspace(prev => {
        if (prev) {
          const fresh = result.find(w => w.id === prev.id)
          if (fresh) return fresh
        }
        return defaultWorkspace
      })
      setLoading(false)
    }

    load()
  }, [session])

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, loading }}>
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

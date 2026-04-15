import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Association } from '@/types/app'

interface UseAssociationResult {
  association: Association | null
  loading: boolean
}

export function useAssociation(): UseAssociationResult {
  const { session } = useAuth()
  const [association, setAssociation] = useState<Association | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return

    async function load() {
      const { data } = await supabase
        .from('association_members')
        .select('associations(id, navn, orgnr, org_form, poststed, status)')
        .eq('user_id', session!.user.id)
        .limit(1)
        .single()

      setAssociation((data as any)?.associations as Association ?? null)
      setLoading(false)
    }

    load()
  }, [session])

  return { association, loading }
}

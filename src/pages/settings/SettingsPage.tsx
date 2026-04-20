import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const CONDITIONAL_FEATURES = [
  ['heis', 'Heis', 'Periodisk sikkerhetssjekk og rutineservice'],
  ['lekeplass', 'Lekeplass', 'Rutine-, funksjons- og hovedkontroll av lekeplass'],
  ['radon', 'Utleieenheter (radon)', 'Obligatorisk radonmåling for utleieenheter'],
] as const

export default function SettingsPage() {
  const navigate = useNavigate()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const association = activeWorkspace?.kind === 'association' ? activeWorkspace.association : null

  const [disabledFeatures, setDisabledFeatures] = useState<string[]>([])

  useEffect(() => {
    if (!wsLoading && (!association || (activeWorkspace?.kind === 'association' && activeWorkspace.role_code === 'EKST'))) {
      navigate('/dashboard')
    }
  }, [wsLoading, activeWorkspace, navigate])

  useEffect(() => {
    if (association) setDisabledFeatures(association.disabled_features)
  }, [association?.id])

  async function toggleFeature(category: string) {
    const next = disabledFeatures.includes(category)
      ? disabledFeatures.filter(f => f !== category)
      : [...disabledFeatures, category]
    setDisabledFeatures(next)
    await supabase.from('associations').update({ disabled_features: next }).eq('id', association!.id)
  }

  if (wsLoading || !association) return null

  return (
    <Layout>
      <div className="space-y-6">
        <div className="border rounded-lg">
          <div className="px-4 py-3 border-b bg-muted/40">
            <p className="text-sm font-medium">Bygningsegenskaper</p>
            <p className="text-xs text-muted-foreground mt-0.5">Skjul oppgaver som ikke er relevante for bygget.</p>
          </div>
          <div className="divide-y">
            {CONDITIONAL_FEATURES.map(([category, label, description]) => (
              <label key={category} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20">
                <input
                  type="checkbox"
                  checked={!disabledFeatures.includes(category)}
                  onChange={() => toggleFeature(category)}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

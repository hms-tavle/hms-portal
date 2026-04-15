import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'

// ── Types ────────────────────────────────────────────────────────────────────

interface Association {
  id: string
  navn: string
  orgnr: string
  org_form: string
  poststed: string | null
  status: 'trial' | 'active' | 'expired'
}

interface TaskTemplate {
  id: string
  category: string
  category_label: string
  title: string
  description: string | null
  legal_basis: string | null
  recurrence: string
  requires_professional: boolean
  is_conditional: boolean
  sort_order: number
}

interface TaskCompletion {
  id: string
  task_template_id: string
  completed_at: string
}

type TaskStatus = 'overdue' | 'due_soon' | 'on_track' | 'never' | 'per_project'

// ── Helpers ──────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daglig',
  monthly: 'Månedlig',
  quarterly: 'Kvartalsvis',
  twice_yearly: 'Halvårlig',
  annually: 'Årlig',
  every_2_years: 'Hvert 2. år',
  every_5_years: 'Hvert 5. år',
  every_5_7_years: 'Hvert 5.–7. år',
  every_10_years: 'Hvert 10. år',
  per_project: 'Per prosjekt',
}

const RECURRENCE_DAYS: Record<string, number> = {
  daily: 1,
  monthly: 30,
  quarterly: 91,
  twice_yearly: 182,
  annually: 365,
  every_2_years: 365 * 2,
  every_5_years: 365 * 5,
  every_5_7_years: 365 * 5,
  every_10_years: 365 * 10,
}

function getDaysUntilDue(lastCompletedAt: string, recurrence: string): number | null {
  if (recurrence === 'per_project') return null
  const intervalDays = RECURRENCE_DAYS[recurrence]
  if (!intervalDays) return null
  const lastDate = new Date(lastCompletedAt)
  const nextDue = new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
  const today = new Date()
  return Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getTaskStatus(task: TaskTemplate, lastCompletion: TaskCompletion | null): TaskStatus {
  if (task.recurrence === 'per_project') return 'per_project'
  if (!lastCompletion) return 'never'
  const days = getDaysUntilDue(lastCompletion.completed_at, task.recurrence)
  if (days === null) return 'per_project'
  if (days < 0) return 'overdue'
  if (days <= 30) return 'due_soon'
  return 'on_track'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: TaskStatus }) {
  const classes: Record<TaskStatus, string> = {
    overdue: 'bg-destructive',
    due_soon: 'bg-yellow-500',
    on_track: 'bg-green-500',
    never: 'bg-muted-foreground',
    per_project: 'bg-muted-foreground',
  }
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1.5 ${classes[status]}`} />
}

function statusText(status: TaskStatus, days: number | null): string {
  if (status === 'per_project') return 'Utføres ved behov'
  if (status === 'never') return 'Ikke utført ennå'
  if (status === 'overdue') return `Forfalt for ${Math.abs(days!)} dager siden`
  if (status === 'due_soon') return days === 0 ? 'Forfaller i dag' : `Forfaller om ${days} dager`
  return `Forfaller om ${days} dager`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [association, setAssociation] = useState<Association | null>(null)
  const [tasks, setTasks] = useState<TaskTemplate[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Load association
      const { data: memberData } = await supabase
        .from('association_members')
        .select('associations(id, navn, orgnr, org_form, poststed, status)')
        .eq('user_id', session!.user.id)
        .limit(1)
        .single()

      const assoc = (memberData as any)?.associations as Association | null
      if (!assoc) { setLoading(false); return }
      setAssociation(assoc)

      // Load tasks and completions in parallel
      const [{ data: taskData }, { data: completionData }] = await Promise.all([
        supabase
          .from('task_templates')
          .select('*')
          .order('sort_order'),
        supabase
          .from('task_completions')
          .select('id, task_template_id, completed_at')
          .eq('association_id', assoc.id)
          .order('completed_at', { ascending: false }),
      ])

      setTasks(taskData ?? [])
      setCompletions(completionData ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  // Latest completion per task
  const latestCompletion = (taskId: string): TaskCompletion | null =>
    completions.find(c => c.task_template_id === taskId) ?? null

  async function markDone(task: TaskTemplate) {
    if (!association) return
    setCompleting(task.id)

    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        association_id: association.id,
        task_template_id: task.id,
        completed_by: session!.user.id,
      })
      .select('id, task_template_id, completed_at')
      .single()

    if (!error && data) {
      setCompletions(prev => [data as TaskCompletion, ...prev])
    }
    setCompleting(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Group tasks by category in sort_order
  const categories = tasks.reduce<{ label: string; tasks: TaskTemplate[] }[]>((acc, task) => {
    const existing = acc.find(c => c.label === task.category_label)
    if (existing) {
      existing.tasks.push(task)
    } else {
      acc.push({ label: task.category_label, tasks: [task] })
    }
    return acc
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">HMS-portal</p>
            <h1 className="text-base font-semibold leading-tight">
              {loading ? '…' : association?.navn ?? 'Ingen forening funnet'}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Logg ut
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {loading && <p className="text-muted-foreground">Laster oppgaver…</p>}

        {!loading && !association && (
          <p className="text-muted-foreground">Ingen boligforening funnet for din konto.</p>
        )}

        {!loading && association && categories.map(category => (
          <section key={category.label}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {category.label}
            </h2>
            <div className="divide-y border rounded-lg">
              {category.tasks.map(task => {
                const last = latestCompletion(task.id)
                const status = getTaskStatus(task, last)
                const days = last ? getDaysUntilDue(last.completed_at, task.recurrence) : null
                const isCompleting = completing === task.id

                return (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                    <StatusDot status={status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{task.title}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {RECURRENCE_LABELS[task.recurrence]}
                        </Badge>
                        {task.requires_professional && (
                          <Badge variant="secondary" className="text-xs shrink-0">Fagperson</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {statusText(status, days)}
                        {last && (
                          <> · Sist utført {formatDate(last.completed_at)}</>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={status === 'on_track' ? 'outline' : 'default'}
                      className="shrink-0"
                      disabled={isCompleting}
                      onClick={() => markDone(task)}
                    >
                      {isCompleting ? '…' : 'Utført'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

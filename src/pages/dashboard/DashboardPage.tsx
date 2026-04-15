import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
type GroupKey = number | 'overdue' | 'per_project'

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

function getNextDueDate(task: TaskTemplate, lastCompletion: TaskCompletion | null): Date | null {
  if (task.recurrence === 'per_project') return null
  const intervalDays = RECURRENCE_DAYS[task.recurrence]
  if (!intervalDays || !lastCompletion) return null
  const lastDate = new Date(lastCompletion.completed_at)
  return new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getTaskStatus(task: TaskTemplate, lastCompletion: TaskCompletion | null): TaskStatus {
  if (task.recurrence === 'per_project') return 'per_project'
  if (!lastCompletion) return 'never'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'never'
  const days = daysUntil(nextDue)
  if (days < 0) return 'overdue'
  if (days <= 30) return 'due_soon'
  return 'on_track'
}

function getGroupKey(task: TaskTemplate, lastCompletion: TaskCompletion | null): GroupKey {
  if (task.recurrence === 'per_project') return 'per_project'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'overdue'
  if (daysUntil(nextDue) < 0) return 'overdue'
  return nextDue.getFullYear()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDueDate(date: Date) {
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusText(task: TaskTemplate, lastCompletion: TaskCompletion | null): string {
  if (task.recurrence === 'per_project') return 'Utføres ved behov'
  if (!lastCompletion) return 'Ikke utført ennå'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'Ikke utført ennå'
  const days = daysUntil(nextDue)
  if (days < 0) return `Forfalt for ${Math.abs(days)} dager siden`
  if (days === 0) return 'Forfaller i dag'
  if (days <= 30) return `Forfaller om ${days} dager`
  return `Forfaller ${formatDueDate(nextDue)}`
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
      const { data: memberData } = await supabase
        .from('association_members')
        .select('associations(id, navn, orgnr, org_form, poststed, status)')
        .eq('user_id', session!.user.id)
        .limit(1)
        .single()

      const assoc = (memberData as any)?.associations as Association | null
      if (!assoc) { setLoading(false); return }
      setAssociation(assoc)

      const [{ data: taskData }, { data: completionData }] = await Promise.all([
        supabase.from('task_templates').select('*').order('sort_order'),
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

  // Group tasks by year of next due date
  const yearGroups = (() => {
    const map = new Map<GroupKey, TaskTemplate[]>()
    for (const task of tasks) {
      const key = getGroupKey(task, latestCompletion(task.id))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'overdue') return -1
      if (b === 'overdue') return 1
      if (a === 'per_project') return 1
      if (b === 'per_project') return -1
      return (a as number) - (b as number)
    })

    return keys.map(key => ({
      key,
      label: key === 'overdue' ? 'Forfalt' : key === 'per_project' ? 'Ved behov' : String(key),
      tasks: map.get(key)!,
    }))
  })()

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

        {!loading && association && (() => {
          const currentYear = String(new Date().getFullYear())
          const defaultTab = yearGroups.find(g => String(g.key) === currentYear)
            ? currentYear
            : String(yearGroups[0]?.key ?? currentYear)

          return (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {yearGroups.map(group => (
                  <TabsTrigger key={String(group.key)} value={String(group.key)}>
                    {group.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {yearGroups.map(group => (
                <TabsContent key={String(group.key)} value={String(group.key)} className="mt-4">
                  <div className="divide-y border rounded-lg">
                    {group.tasks.map(task => {
                      const last = latestCompletion(task.id)
                      const status = getTaskStatus(task, last)
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
                              {task.category_label}
                              {' · '}
                              {statusText(task, last)}
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
                </TabsContent>
              ))}
            </Tabs>
          )
        })()}
      </main>
    </div>
  )
}

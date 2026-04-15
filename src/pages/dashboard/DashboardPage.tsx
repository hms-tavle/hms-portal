import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { getRecurrenceLabel, getRecurrenceDays, getRecurrencePerYear } from '@/constants/recurrence'
import type { AssociationMember, TaskTemplate, TaskCompletion } from '@/types/app'
import Layout from '@/components/Layout'

// ── Types ────────────────────────────────────────────────────────────────────

interface MemberOption {
  id: string
  full_name: string
}

type TaskStatus = 'overdue' | 'due_soon' | 'on_track' | 'never' | 'per_project'
type GroupKey = number | 'overdue' | 'per_project'

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}


function getNextDueDate(task: TaskTemplate, lastCompletion: TaskCompletion | null): Date | null {
  if (task.recurrence === 'per_project') return null
  const intervalDays = getRecurrenceDays(task.recurrence)
  if (!intervalDays || !lastCompletion) return null
  const lastDate = new Date(lastCompletion.completed_at)
  return new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
}

function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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

function statusText(task: TaskTemplate, lastCompletion: TaskCompletion | null): string {
  if (task.recurrence === 'per_project') return 'Utføres ved behov'
  if (!lastCompletion) return 'Ikke utført ennå'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'Ikke utført ennå'
  const days = daysUntil(nextDue)
  if (days < 0) return `Forfalt for ${Math.abs(days)} dager siden`
  if (days === 0) return 'Forfaller i dag'
  if (days <= 30) return `Forfaller om ${days} dager`
  return `Forfaller ${nextDue.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: TaskStatus }) {
  const classes: Record<TaskStatus, string> = {
    overdue: 'bg-destructive',
    due_soon: 'bg-yellow-500',
    on_track: 'bg-green-500',
    never: 'bg-muted-foreground',
    per_project: 'bg-muted-foreground',
  }
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${classes[status]}`} />
}

// ── Compliance timeline ───────────────────────────────────────────────────────

type TimelineEntry =
  | { type: 'actual'; completion: TaskCompletion }
  | { type: 'missed'; estimatedDate: Date }

function buildComplianceTimeline(
  completions: TaskCompletion[],
  task: TaskTemplate
): TimelineEntry[] {
  const intervalDays = getRecurrenceDays(task.recurrence)
  if (!intervalDays || completions.length === 0) {
    return completions.map(c => ({ type: 'actual', completion: c }))
  }

  const intervalMs = intervalDays * 24 * 60 * 60 * 1000
  const sorted = [...completions].sort(
    (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  )
  const today = new Date()

  const entries: TimelineEntry[] = sorted.map(c => ({ type: 'actual', completion: c }))

  // Gaps between consecutive completions
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = new Date(sorted[i].completed_at)
    const to = new Date(sorted[i + 1].completed_at)
    const gapMs = to.getTime() - from.getTime()
    const missedCount = Math.floor(gapMs / intervalMs) - 1
    for (let j = 1; j <= missedCount; j++) {
      entries.push({ type: 'missed', estimatedDate: new Date(from.getTime() + j * intervalMs) })
    }
  }

  // Gap from last completion to today
  const last = new Date(sorted[sorted.length - 1].completed_at)
  const gapToNowMs = today.getTime() - last.getTime()
  const overdueCount = Math.floor(gapToNowMs / intervalMs)
  for (let j = 1; j <= overdueCount; j++) {
    entries.push({ type: 'missed', estimatedDate: new Date(last.getTime() + j * intervalMs) })
  }

  return entries.sort((a, b) => {
    const aDate = a.type === 'actual' ? new Date(a.completion.completed_at) : a.estimatedDate
    const bDate = b.type === 'actual' ? new Date(b.completion.completed_at) : b.estimatedDate
    return bDate.getTime() - aDate.getTime()
  })
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  allCompletions,
  memberNames,
  memberList,
  assignedMemberId,
  currentUserId,
  onMarkDone,
  onDeleteCompletion,
  onAssign,
}: {
  task: TaskTemplate
  allCompletions: TaskCompletion[]
  memberNames: Map<string, string>
  memberList: MemberOption[]
  assignedMemberId: string | null
  currentUserId: string
  onMarkDone: (task: TaskTemplate, date: string) => Promise<void>
  onDeleteCompletion: (id: string) => Promise<void>
  onAssign: (taskTemplateId: string, memberId: string | null) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const [dateInput, setDateInput] = useState(todayStr())
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const taskCompletions = allCompletions
    .filter(c => c.task_template_id === task.id)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

  const lastCompletion = taskCompletions[0] ?? null
  const status = getTaskStatus(task, lastCompletion)

  const currentYear = new Date().getFullYear()
  const yearCount = taskCompletions.filter(
    c => new Date(c.completed_at).getFullYear() === currentYear
  ).length
  const perYear = getRecurrencePerYear(task.recurrence)
  const showCount = perYear > 1

  const timeline = buildComplianceTimeline(taskCompletions, task)
  const missedCount = timeline.filter(e => e.type === 'missed').length

  async function handleSubmit() {
    setSubmitting(true)
    await onMarkDone(task, dateInput)
    setMarking(false)
    setSubmitting(false)
    setDateInput(todayStr())
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await onDeleteCompletion(id)
    setDeleting(null)
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{task.title}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {getRecurrenceLabel(task.recurrence)}
            </Badge>
            {task.requires_professional && (
              <Badge variant="secondary" className="text-xs shrink-0">Fagperson</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {task.category_label}
            {' · '}
            {statusText(task, lastCompletion)}
            {showCount && ` · ${yearCount}/${perYear} utført i ${currentYear}`}
            {missedCount > 0 && (
              <span className="text-destructive"> · ⚠ {missedCount} ikke dokumentert</span>
            )}
          </p>
          <div className="flex items-center gap-0.5 mt-0.5">
            <span className="text-xs text-muted-foreground">Ansvarlig:</span>
            <Select value={assignedMemberId ?? ''} onValueChange={(v: string | null) => onAssign(task.id, v || null)}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string | null) => v ? (memberList.find(m => m.id === v)?.full_name ?? v) : 'Ingen'}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="">Ingen</SelectItem>
                {memberList.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {marking ? (
            <>
              <input
                type="date"
                value={dateInput}
                max={todayStr()}
                onChange={e => setDateInput(e.target.value)}
                className="text-xs border rounded px-2 py-1 h-8 bg-background"
              />
              <Button size="sm" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '…' : 'Lagre'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setMarking(false); setDateInput(todayStr()) }}
              >
                Avbryt
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant={status === 'on_track' ? 'outline' : 'default'}
              onClick={() => setMarking(true)}
            >
              Utført
            </Button>
          )}
          <button
            className="text-muted-foreground hover:text-foreground p-1 ml-1"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Skjul historikk' : 'Vis historikk'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 ml-5 border-l pl-3 space-y-1.5">
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Ingen fullføringer registrert.</p>
          ) : (
            timeline.map((entry, i) => {
              if (entry.type === 'missed') {
                return (
                  <div key={`missed-${i}`} className="flex items-center gap-2">
                    <span className="text-xs text-destructive">
                      ~ {formatDate(entry.estimatedDate.toISOString())} · Ikke dokumentert
                    </span>
                  </div>
                )
              }
              const c = entry.completion
              return (
                <div key={c.id} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(c.completed_at)}
                    {c.completed_by && memberNames.get(c.completed_by) && (
                      <> · {memberNames.get(c.completed_by)}</>
                    )}
                  </span>
                  {c.completed_by === currentUserId && (
                    <button
                      className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                      disabled={deleting === c.id}
                      onClick={() => handleDelete(c.id)}
                      aria-label="Slett fullføring"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { session } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const association = activeWorkspace?.kind === 'association' ? activeWorkspace.association : null

  const [tasks, setTasks] = useState<TaskTemplate[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map())
  const [memberList, setMemberList] = useState<MemberOption[]>([])
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map())
  const [dataLoading, setDataLoading] = useState(true)

  const loading = wsLoading || dataLoading

  useEffect(() => {
    if (wsLoading) return
    if (!association) { setDataLoading(false); return }

    setDataLoading(true)
    const assocId = association.id

    async function load() {
      const [{ data: taskData }, { data: completionData }, { data: membersData }, { data: assignmentData }] = await Promise.all([
        supabase.from('task_templates').select('*').order('sort_order'),
        supabase
          .from('task_completions')
          .select('id, task_template_id, completed_at, completed_by')
          .eq('association_id', assocId)
          .order('completed_at', { ascending: false }),
        supabase
          .from('association_members')
          .select('id, user_id, full_name')
          .eq('association_id', assocId),
        supabase
          .from('task_assignments')
          .select('task_template_id, assigned_to')
          .eq('association_id', assocId),
      ])

      setTasks(taskData ?? [])
      setCompletions(completionData ?? [])

      const names = new Map<string, string>()
      const list: MemberOption[] = []
      for (const m of (membersData ?? []) as AssociationMember[]) {
        if (m.user_id) names.set(m.user_id, m.full_name)
        list.push({ id: m.id, full_name: m.full_name })
      }
      setMemberNames(names)
      setMemberList(list)

      const asgn = new Map<string, string>()
      for (const a of (assignmentData ?? []) as { task_template_id: string; assigned_to: string }[]) {
        asgn.set(a.task_template_id, a.assigned_to)
      }
      setAssignments(asgn)
      setDataLoading(false)
    }

    load()
  }, [wsLoading, activeWorkspace])

  async function markDone(task: TaskTemplate, dateStr: string) {
    if (!association) return
    // Use noon to avoid timezone edge cases shifting the date
    const completedAt = new Date(dateStr + 'T12:00:00').toISOString()

    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        association_id: association.id,
        task_template_id: task.id,
        completed_by: session!.user.id,
        completed_at: completedAt,
      })
      .select('id, task_template_id, completed_at, completed_by')
      .single()

    if (!error && data) {
      setCompletions(prev => [data as TaskCompletion, ...prev])
    }
  }

  async function deleteCompletion(id: string) {
    const { error } = await supabase
      .from('task_completions')
      .delete()
      .eq('id', id)

    if (!error) {
      setCompletions(prev => prev.filter(c => c.id !== id))
    }
  }

  async function assignTask(taskTemplateId: string, memberId: string | null) {
    if (!association) return
    if (!memberId) {
      await supabase
        .from('task_assignments')
        .delete()
        .eq('association_id', association.id)
        .eq('task_template_id', taskTemplateId)
      setAssignments(prev => { const next = new Map(prev); next.delete(taskTemplateId); return next })
    } else {
      const { error } = await supabase
        .from('task_assignments')
        .upsert(
          { association_id: association.id, task_template_id: taskTemplateId, assigned_to: memberId },
          { onConflict: 'association_id,task_template_id' }
        )
      if (!error) {
        setAssignments(prev => new Map(prev).set(taskTemplateId, memberId))
      }
    }
  }

  const latestCompletion = (taskId: string): TaskCompletion | null =>
    completions.find(c => c.task_template_id === taskId) ?? null

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
    <Layout>
      {loading && <p className="text-muted-foreground">Laster oppgaver…</p>}

      {!loading && !association && (
        <div className="text-center py-12 space-y-1">
          <p className="text-muted-foreground">Ingen oppgaver ennå.</p>
          <p className="text-sm text-muted-foreground">Egendefinerte oppgaver kommer snart.</p>
        </div>
      )}

      {!loading && association && (() => {
          const currentYear = String(new Date().getFullYear())
          const defaultTab = yearGroups.find(g => String(g.key) === currentYear)
            ? currentYear
            : String(yearGroups[0]?.key ?? currentYear)

          return (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                {yearGroups.map(group => (
                  <TabsTrigger key={String(group.key)} value={String(group.key)}>
                    {group.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {yearGroups.map(group => (
                <TabsContent key={String(group.key)} value={String(group.key)}>
                  <div className="divide-y border rounded-lg">
                    {group.tasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        allCompletions={completions}
                        memberNames={memberNames}
                        memberList={memberList}
                        assignedMemberId={assignments.get(task.id) ?? null}
                        currentUserId={session!.user.id}
                        onMarkDone={markDone}
                        onDeleteCompletion={deleteCompletion}
                        onAssign={assignTask}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )
      })()}
    </Layout>
  )
}

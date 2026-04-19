import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select'
import { ChevronDown, ChevronUp, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { getRecurrenceLabel, getRecurrenceDays, getRecurrencePerYear, RECURRENCE_CODES } from '@/constants/recurrence'
import type { RecurrenceCode } from '@/constants/recurrence'
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
  if (!intervalDays) return null
  if (!lastCompletion) return task.first_due_at ? new Date(task.first_due_at) : null
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
  if (!lastCompletion && !task.first_due_at) return 'never'
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
  if (!lastCompletion && !task.first_due_at) return 'Ikke utført ennå'
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

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = new Date(sorted[i].completed_at)
    const to = new Date(sorted[i + 1].completed_at)
    const gapMs = to.getTime() - from.getTime()
    const missedCount = Math.floor(gapMs / intervalMs) - 1
    for (let j = 1; j <= missedCount; j++) {
      entries.push({ type: 'missed', estimatedDate: new Date(from.getTime() + j * intervalMs) })
    }
  }

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

// ── Custom task modal ─────────────────────────────────────────────────────────

function defaultFirstDue(recurrence: RecurrenceCode): string {
  if (recurrence === 'per_project') return ''
  const days = getRecurrenceDays(recurrence) ?? 365
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function CustomTaskModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: TaskTemplate
  onSave: (data: { title: string; description: string; recurrence: RecurrenceCode; category_label: string; first_due_at: string | null }) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [recurrence, setRecurrence] = useState<RecurrenceCode>(initial?.recurrence ?? 'annually')
  const [categoryLabel, setCategoryLabel] = useState(initial?.category_label === 'Egendefinert' ? '' : (initial?.category_label ?? ''))
  const [firstDue, setFirstDue] = useState(
    initial?.first_due_at
      ? initial.first_due_at.split('T')[0]
      : defaultFirstDue(initial?.recurrence ?? 'annually')
  )
  const [submitting, setSubmitting] = useState(false)

  function handleRecurrenceChange(code: RecurrenceCode) {
    setRecurrence(code)
    setFirstDue(defaultFirstDue(code))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    await onSave({
      title: title.trim(),
      description: description.trim(),
      recurrence,
      category_label: categoryLabel.trim() || 'Egendefinert',
      first_due_at: recurrence !== 'per_project' && firstDue ? firstDue : null,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-4">
          {initial ? 'Rediger oppgave' : 'Ny egendefinert oppgave'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Tittel *</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm bg-background"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Navn på oppgave"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Gjentakelse *</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm bg-background"
              value={recurrence}
              onChange={e => handleRecurrenceChange(e.target.value as RecurrenceCode)}
            >
              {RECURRENCE_CODES.map(code => (
                <option key={code} value={code}>{getRecurrenceLabel(code)}</option>
              ))}
            </select>
          </div>
          {recurrence !== 'per_project' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Første frist</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                value={firstDue}
                onChange={e => setFirstDue(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Kategori</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm bg-background"
              value={categoryLabel}
              onChange={e => setCategoryLabel(e.target.value)}
              placeholder="Egendefinert"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Beskrivelse</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm bg-background resize-none"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Valgfri beskrivelse"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
            <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
              {submitting ? '…' : initial ? 'Lagre endringer' : 'Opprett oppgave'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  allCompletions,
  memberNames,
  memberList,
  assignedMemberId,
  currentUserId,
  showAssignment,
  onMarkDone,
  onDeleteCompletion,
  onAssign,
  onEdit,
  onDelete,
}: {
  task: TaskTemplate
  allCompletions: TaskCompletion[]
  memberNames: Map<string, string>
  memberList: MemberOption[]
  assignedMemberId: string | null
  currentUserId: string
  showAssignment: boolean
  onMarkDone: (task: TaskTemplate, date: string) => Promise<void>
  onDeleteCompletion: (id: string) => Promise<void>
  onAssign: (taskId: string, memberId: string | null) => Promise<void>
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const [dateInput, setDateInput] = useState(todayStr())
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const isCustom = task.created_by !== null
  const isCreator = isCustom && task.created_by === currentUserId

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
          {showAssignment && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Ansvarlig:</span>
              <Select
                value={assignedMemberId ?? ''}
                onValueChange={(v: string | null) => onAssign(task.id, v || null)}
              >
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
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCreator && !marking && (
            <>
              <button
                className="text-muted-foreground hover:text-foreground p-1"
                onClick={onEdit}
                aria-label="Rediger oppgave"
              >
                <Pencil size={12} />
              </button>
              <button
                className="text-muted-foreground hover:text-destructive p-1"
                onClick={onDelete}
                aria-label="Slett oppgave"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null)

  const loading = wsLoading || dataLoading

  useEffect(() => {
    if (wsLoading) return
    setDataLoading(true)

    async function load() {
      if (association) {
        const assocId = association.id
        const [{ data: taskData }, { data: completionData }, { data: membersData }, { data: assignmentData }] =
          await Promise.all([
            supabase
              .from('task_templates')
              .select('*')
              .or(`created_by.is.null,association_id.eq.${assocId}`)
              .order('sort_order'),
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

        // Seeded tasks first (sort_order), then custom tasks
        const seeded = (taskData ?? []).filter(t => t.created_by === null)
        const custom = (taskData ?? []).filter(t => t.created_by !== null)
        setTasks([...seeded, ...custom])
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
      } else {
        // Personal workspace: only this user's custom tasks
        const [{ data: taskData }, { data: completionData }] = await Promise.all([
          supabase
            .from('task_templates')
            .select('*')
            .eq('created_by', session!.user.id)
            .is('association_id', null)
            .order('created_at', { ascending: true }),
          supabase
            .from('task_completions')
            .select('id, task_template_id, completed_at, completed_by')
            .is('association_id', null)
            .order('completed_at', { ascending: false }),
        ])
        setTasks(taskData ?? [])
        setCompletions(completionData ?? [])
        setMemberNames(new Map())
        setMemberList([])
        setAssignments(new Map())
      }
      setDataLoading(false)
    }

    load()
  }, [wsLoading, activeWorkspace])

  async function markDone(task: TaskTemplate, dateStr: string) {
    const completedAt = new Date(dateStr + 'T12:00:00').toISOString()
    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        association_id: association?.id ?? null,
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
    const { error } = await supabase.from('task_completions').delete().eq('id', id)
    if (!error) setCompletions(prev => prev.filter(c => c.id !== id))
  }

  async function assignTask(taskId: string, memberId: string | null) {
    if (!association) return
    if (!memberId) {
      await supabase
        .from('task_assignments')
        .delete()
        .eq('association_id', association.id)
        .eq('task_template_id', taskId)
      setAssignments(prev => { const next = new Map(prev); next.delete(taskId); return next })
    } else {
      const { error } = await supabase
        .from('task_assignments')
        .upsert(
          { association_id: association.id, task_template_id: taskId, assigned_to: memberId },
          { onConflict: 'association_id,task_template_id' }
        )
      if (!error) setAssignments(prev => new Map(prev).set(taskId, memberId))
    }
  }

  async function saveCustomTask(data: {
    title: string
    description: string
    recurrence: RecurrenceCode
    category_label: string
    first_due_at: string | null
  }) {
    const firstDueAt = data.first_due_at ? new Date(data.first_due_at + 'T12:00:00').toISOString() : null
    if (editingTask) {
      const { data: updated, error } = await supabase
        .from('task_templates')
        .update({
          title: data.title,
          description: data.description || null,
          recurrence: data.recurrence,
          category_label: data.category_label,
          first_due_at: firstDueAt,
        })
        .eq('id', editingTask.id)
        .select('*')
        .single()
      if (!error && updated) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updated as TaskTemplate : t))
      }
    } else {
      const { data: created, error } = await supabase
        .from('task_templates')
        .insert({
          title: data.title,
          description: data.description || null,
          recurrence: data.recurrence,
          category_label: data.category_label,
          first_due_at: firstDueAt,
          association_id: association?.id ?? null,
          created_by: session!.user.id,
        })
        .select('*')
        .single()
      if (!error && created) {
        setTasks(prev => [...prev, created as TaskTemplate])
      }
    }
    setModalOpen(false)
    setEditingTask(null)
  }

  async function deleteCustomTask(id: string) {
    const { error } = await supabase.from('task_templates').delete().eq('id', id)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id))
      setCompletions(prev => prev.filter(c => c.task_template_id !== id))
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
      tasks: map.get(key)!.sort((a, b) => {
        const aDate = getNextDueDate(a, latestCompletion(a.id))
        const bDate = getNextDueDate(b, latestCompletion(b.id))
        if (!aDate && !bDate) return 0
        if (!aDate) return 1
        if (!bDate) return -1
        return aDate.getTime() - bDate.getTime()
      }),
    }))
  })()

  return (
    <Layout>
      {loading && <p className="text-muted-foreground">Laster oppgaver…</p>}

      {!loading && (
        <>
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingTask(null); setModalOpen(true) }}
            >
              <Plus size={14} className="mr-1" />
              Legg til oppgave
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12 space-y-1">
              <p className="text-muted-foreground">Ingen oppgaver ennå.</p>
              <p className="text-sm text-muted-foreground">
                Bruk knappen over for å legge til en egendefinert oppgave.
              </p>
            </div>
          ) : (
            (() => {
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
                            showAssignment={!!association}
                            onMarkDone={markDone}
                            onDeleteCompletion={deleteCompletion}
                            onAssign={assignTask}
                            onEdit={task.created_by === session!.user.id
                              ? () => { setEditingTask(task); setModalOpen(true) }
                              : undefined}
                            onDelete={task.created_by === session!.user.id
                              ? () => deleteCustomTask(task.id)
                              : undefined}
                          />
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )
            })()
          )}
        </>
      )}

      {modalOpen && (
        <CustomTaskModal
          initial={editingTask ?? undefined}
          onSave={saveCustomTask}
          onClose={() => { setModalOpen(false); setEditingTask(null) }}
        />
      )}
    </Layout>
  )
}

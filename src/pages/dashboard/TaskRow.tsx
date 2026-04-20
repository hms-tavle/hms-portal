import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select'
import { ChevronDown, ChevronUp, X, Pencil, Trash2 } from 'lucide-react'
import { getRecurrenceLabel, getRecurrencePerYear } from '@/constants/recurrence'
import type { TaskTemplate, TaskCompletion } from '@/types/app'
import {
  todayStr,
  getTaskStatus,
  statusText,
  formatDate,
  buildComplianceTimeline,
  type TaskStatus,
} from '@/lib/taskUtils'

export interface MemberOption {
  id: string
  full_name: string
  role_code?: string
}

function memberLabel(m: MemberOption): string {
  return m.role_code === 'EKST' ? `(Ekstern) ${m.full_name}` : m.full_name
}

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

export function TaskRow({
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
  onMarkDone: (task: TaskTemplate, date: string) => Promise<string | null>
  onDeleteCompletion: (id: string) => Promise<void>
  onAssign: (taskId: string, memberId: string | null) => Promise<void>
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const [dateInput, setDateInput] = useState(todayStr())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const isCreator = task.created_by !== null && task.created_by === currentUserId

  const taskCompletions = allCompletions
    .filter(c => c.task_template_id === task.id)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

  const lastCompletion = taskCompletions[0] ?? null
  const status = getTaskStatus(task, lastCompletion)

  const currentYear = new Date().getFullYear()
  const yearCount = taskCompletions.filter(c => new Date(c.completed_at).getFullYear() === currentYear).length
  const perYear = getRecurrencePerYear(task.recurrence)
  const showCount = perYear > 1

  const timeline = buildComplianceTimeline(taskCompletions, task)
  const missedCount = timeline.filter(e => e.type === 'missed').length

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    const err = await onMarkDone(task, dateInput)
    if (err) {
      setSubmitError(err)
      setSubmitting(false)
      return
    }
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
                    {(v: string | null) => {
                      const m = v ? memberList.find(m => m.id === v) : null
                      return m ? memberLabel(m) : 'Ingen'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">Ingen</SelectItem>
                  {memberList.map(m => (
                    <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
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
              <Button size="sm" variant="ghost" onClick={() => { setMarking(false); setDateInput(todayStr()); setSubmitError(null) }}>
                Avbryt
              </Button>
              {submitError && (
                <span className="text-xs text-destructive">{submitError}</span>
              )}
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

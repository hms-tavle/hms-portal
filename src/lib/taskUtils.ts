import { getRecurrenceDays } from '@/constants/recurrence'
import type { RecurrenceCode } from '@/constants/recurrence'
import type { TaskTemplate, TaskCompletion } from '@/types/app'

export type TaskStatus = 'overdue' | 'due_soon' | 'on_track' | 'never' | 'per_project'
export type GroupKey = number | 'overdue' | 'per_project'

export type TimelineEntry =
  | { type: 'actual'; completion: TaskCompletion }
  | { type: 'missed'; estimatedDate: Date }

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function getNextDueDate(task: TaskTemplate, lastCompletion: TaskCompletion | null): Date | null {
  if (task.recurrence === 'per_project') return null
  const intervalDays = getRecurrenceDays(task.recurrence)
  if (!intervalDays) return null
  if (!lastCompletion) return task.first_due_at ? new Date(task.first_due_at) : null
  const lastDate = new Date(lastCompletion.completed_at)
  return new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
}

export function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getTaskStatus(task: TaskTemplate, lastCompletion: TaskCompletion | null): TaskStatus {
  if (task.recurrence === 'per_project') return 'per_project'
  if (!lastCompletion && !task.first_due_at) return 'never'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'never'
  const days = daysUntil(nextDue)
  if (days < 0) return 'overdue'
  if (days <= 30) return 'due_soon'
  return 'on_track'
}

export function getGroupKey(task: TaskTemplate, lastCompletion: TaskCompletion | null): GroupKey {
  if (task.recurrence === 'per_project') return 'per_project'
  const nextDue = getNextDueDate(task, lastCompletion)
  if (!nextDue) return 'overdue'
  if (daysUntil(nextDue) < 0) return 'overdue'
  return nextDue.getFullYear()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function statusText(task: TaskTemplate, lastCompletion: TaskCompletion | null): string {
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

export function buildComplianceTimeline(completions: TaskCompletion[], task: TaskTemplate): TimelineEntry[] {
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
    const missedCount = Math.floor((to.getTime() - from.getTime()) / intervalMs) - 1
    for (let j = 1; j <= missedCount; j++) {
      entries.push({ type: 'missed', estimatedDate: new Date(from.getTime() + j * intervalMs) })
    }
  }

  const last = new Date(sorted[sorted.length - 1].completed_at)
  const overdueCount = Math.floor((today.getTime() - last.getTime()) / intervalMs)
  for (let j = 1; j <= overdueCount; j++) {
    entries.push({ type: 'missed', estimatedDate: new Date(last.getTime() + j * intervalMs) })
  }

  return entries.sort((a, b) => {
    const aDate = a.type === 'actual' ? new Date(a.completion.completed_at) : a.estimatedDate
    const bDate = b.type === 'actual' ? new Date(b.completion.completed_at) : b.estimatedDate
    return bDate.getTime() - aDate.getTime()
  })
}

export function defaultFirstDue(recurrence: RecurrenceCode): string {
  if (recurrence === 'per_project') return ''
  const days = getRecurrenceDays(recurrence) ?? 365
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

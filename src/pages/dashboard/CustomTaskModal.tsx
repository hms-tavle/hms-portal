import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getRecurrenceLabel, RECURRENCE_CODES } from '@/constants/recurrence'
import type { RecurrenceCode } from '@/constants/recurrence'
import type { TaskTemplate } from '@/types/app'
import { defaultFirstDue } from '@/lib/taskUtils'

export interface CustomTaskData {
  title: string
  description: string
  recurrence: RecurrenceCode
  category_label: string
  first_due_at: string | null
}

export function CustomTaskModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: TaskTemplate
  onSave: (data: CustomTaskData) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [recurrence, setRecurrence] = useState<RecurrenceCode>(initial?.recurrence ?? 'annually')
  const [categoryLabel, setCategoryLabel] = useState(
    initial?.category_label === 'Egendefinert' ? '' : (initial?.category_label ?? '')
  )
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

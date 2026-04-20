import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import type { AssociationMember, TaskTemplate, TaskCompletion } from '@/types/app'
import Layout from '@/components/Layout'
import { TaskRow, type MemberOption } from './TaskRow'
import { CustomTaskModal, type CustomTaskData } from './CustomTaskModal'
import { getNextDueDate, getGroupKey, type GroupKey } from '@/lib/taskUtils'

export default function DashboardPage() {
  const { session } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const association = activeWorkspace?.kind === 'association' ? activeWorkspace.association : null
  const isExternalActor = activeWorkspace?.kind === 'association' && activeWorkspace.role_code === 'EKST'

  const [tasks, setTasks] = useState<TaskTemplate[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map())
  const [memberList, setMemberList] = useState<MemberOption[]>([])
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map())
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
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
            supabase.from('task_templates').select('*').or(`created_by.is.null,association_id.eq.${assocId}`).order('sort_order'),
            supabase.from('task_completions').select('id, task_template_id, completed_at, completed_by').eq('association_id', assocId).order('completed_at', { ascending: false }),
            supabase.from('association_members').select('id, user_id, full_name').eq('association_id', assocId),
            supabase.from('task_assignments').select('task_template_id, assigned_to').eq('association_id', assocId),
          ])

        const seeded = (taskData ?? []).filter(t => t.created_by === null)
        const custom = (taskData ?? []).filter(t => t.created_by !== null)
        setTasks([...seeded, ...custom])
        setCompletions(completionData ?? [])

        const names = new Map<string, string>()
        const list: MemberOption[] = []
        let myMemberId: string | null = null
        for (const m of (membersData ?? []) as AssociationMember[]) {
          if (m.user_id) names.set(m.user_id, m.full_name)
          if (m.user_id === session!.user.id) myMemberId = m.id
          list.push({ id: m.id, full_name: m.full_name, role_code: m.role_code })
        }
        setMemberNames(names)
        setMemberList(list)
        setCurrentMemberId(myMemberId)

        const asgn = new Map<string, string>()
        for (const a of (assignmentData ?? []) as { task_template_id: string; assigned_to: string }[]) {
          asgn.set(a.task_template_id, a.assigned_to)
        }
        setAssignments(asgn)
      } else {
        const [{ data: taskData }, { data: completionData }] = await Promise.all([
          supabase.from('task_templates').select('*').eq('created_by', session!.user.id).is('association_id', null).order('created_at', { ascending: true }),
          supabase.from('task_completions').select('id, task_template_id, completed_at, completed_by').is('association_id', null).order('completed_at', { ascending: false }),
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

  async function markDone(task: TaskTemplate, dateStr: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        association_id: association?.id ?? null,
        task_template_id: task.id,
        completed_by: session!.user.id,
        completed_at: new Date(dateStr + 'T12:00:00').toISOString(),
      })
      .select('id, task_template_id, completed_at, completed_by')
      .single()
    if (error) return 'Kunne ikke lagre fullføring. Prøv igjen.'
    if (data) setCompletions(prev => [data as TaskCompletion, ...prev])
    return null
  }

  async function deleteCompletion(id: string) {
    const { error } = await supabase.from('task_completions').delete().eq('id', id)
    if (!error) setCompletions(prev => prev.filter(c => c.id !== id))
  }

  async function assignTask(taskId: string, memberId: string | null) {
    if (!association) return
    if (!memberId) {
      await supabase.from('task_assignments').delete().eq('association_id', association.id).eq('task_template_id', taskId)
      setAssignments(prev => { const next = new Map(prev); next.delete(taskId); return next })
    } else {
      const { error } = await supabase
        .from('task_assignments')
        .upsert({ association_id: association.id, task_template_id: taskId, assigned_to: memberId }, { onConflict: 'association_id,task_template_id' })
      if (!error) setAssignments(prev => new Map(prev).set(taskId, memberId))
    }
  }

  async function saveCustomTask(data: CustomTaskData) {
    const firstDueAt = data.first_due_at ? new Date(data.first_due_at + 'T12:00:00').toISOString() : null
    if (editingTask) {
      const { data: updated, error } = await supabase
        .from('task_templates')
        .update({ title: data.title, description: data.description || null, recurrence: data.recurrence, category_label: data.category_label, first_due_at: firstDueAt })
        .eq('id', editingTask.id)
        .select('*')
        .single()
      if (!error && updated) setTasks(prev => prev.map(t => t.id === editingTask.id ? updated as TaskTemplate : t))
    } else {
      const { data: created, error } = await supabase
        .from('task_templates')
        .insert({ title: data.title, description: data.description || null, recurrence: data.recurrence, category_label: data.category_label, first_due_at: firstDueAt, association_id: association?.id ?? null, created_by: session!.user.id })
        .select('*')
        .single()
      if (!error && created) setTasks(prev => [...prev, created as TaskTemplate])
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

  const latestByTask = useMemo(() => {
    const m = new Map<string, TaskCompletion>()
    for (const c of completions) {
      if (!m.has(c.task_template_id)) m.set(c.task_template_id, c)
    }
    return m
  }, [completions])

  const visibleTasks = useMemo(() => {
    let filtered = tasks
    if (association) {
      filtered = filtered.filter(task =>
        !task.is_conditional || !task.category || !association.disabled_features.includes(task.category)
      )
    }
    if (isExternalActor && currentMemberId) {
      filtered = filtered.filter(task => assignments.get(task.id) === currentMemberId)
    }
    return filtered
  }, [tasks, assignments, isExternalActor, currentMemberId, association])

  const yearGroups = useMemo(() => {
    const map = new Map<GroupKey, TaskTemplate[]>()
    for (const task of visibleTasks) {
      const key = getGroupKey(task, latestByTask.get(task.id) ?? null)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return Array.from(map.keys())
      .sort((a, b) => {
        if (a === 'overdue') return -1
        if (b === 'overdue') return 1
        if (a === 'per_project') return 1
        if (b === 'per_project') return -1
        return (a as number) - (b as number)
      })
      .map(key => ({
        key,
        label: key === 'overdue' ? 'Forfalt' : key === 'per_project' ? 'Ved behov' : String(key),
        tasks: map.get(key)!.sort((a, b) => {
          const aDate = getNextDueDate(a, latestByTask.get(a.id) ?? null)
          const bDate = getNextDueDate(b, latestByTask.get(b.id) ?? null)
          if (!aDate && !bDate) return 0
          if (!aDate) return 1
          if (!bDate) return -1
          return aDate.getTime() - bDate.getTime()
        }),
      }))
  }, [visibleTasks, latestByTask])

  const currentYear = String(new Date().getFullYear())
  const defaultTab = yearGroups.find(g => String(g.key) === currentYear)
    ? currentYear
    : String(yearGroups[0]?.key ?? currentYear)

  return (
    <Layout>
      {loading ? (
        <p className="text-muted-foreground">Laster oppgaver…</p>
      ) : (
        <>
          {!isExternalActor && (
            <div className="flex justify-end mb-4">
              <Button size="sm" variant="outline" onClick={() => { setEditingTask(null); setModalOpen(true) }}>
                <Plus size={14} className="mr-1" />
                Legg til oppgave
              </Button>
            </div>
          )}

          {visibleTasks.length === 0 ? (
            <div className="text-center py-12 space-y-1">
              <p className="text-muted-foreground">
                {isExternalActor ? 'Ingen oppgaver tildelt deg.' : 'Ingen oppgaver ennå.'}
              </p>
              {!isExternalActor && (
                <p className="text-sm text-muted-foreground">Bruk knappen over for å legge til en egendefinert oppgave.</p>
              )}
            </div>
          ) : (
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
                        showAssignment={!!association && !isExternalActor}
                        onMarkDone={markDone}
                        onDeleteCompletion={deleteCompletion}
                        onAssign={assignTask}
                        onEdit={!isExternalActor && task.created_by === session!.user.id ? () => { setEditingTask(task); setModalOpen(true) } : undefined}
                        onDelete={!isExternalActor && task.created_by === session!.user.id ? () => deleteCustomTask(task.id) : undefined}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}

      {!isExternalActor && modalOpen && (
        <CustomTaskModal
          initial={editingTask ?? undefined}
          onSave={saveCustomTask}
          onClose={() => { setModalOpen(false); setEditingTask(null) }}
        />
      )}
    </Layout>
  )
}

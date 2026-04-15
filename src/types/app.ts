import type { RecurrenceCode } from '@/constants/recurrence'

export type SubscriptionStatus = 'trial' | 'active' | 'expired'

export interface Association {
  id: string
  navn: string
  orgnr: string
  org_form: string
  poststed: string | null
  status: SubscriptionStatus
}

export interface AssociationMember {
  id: string
  association_id?: string
  user_id: string | null
  full_name: string
  email: string | null
  role_code: string
  invite_token: string | null
  invite_expires_at: string | null
}

export interface TaskTemplate {
  id: string
  category: string
  category_label: string
  title: string
  description: string | null
  legal_basis: string | null
  recurrence: RecurrenceCode
  requires_professional: boolean
  is_conditional: boolean
  sort_order: number
}

export interface TaskCompletion {
  id: string
  task_template_id: string
  completed_at: string
  completed_by: string | null
}

import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '@/constants/config'

export const emailField = z.string().email('Ugyldig e-postadresse')
export const passwordField = z.string().min(PASSWORD_MIN_LENGTH, `Passordet må være minst ${PASSWORD_MIN_LENGTH} tegn`)
export const passwordRequiredField = z.string().min(1, 'Passord er påkrevd')

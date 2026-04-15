import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const schema = z.object({
  full_name: z.string().min(2, 'Navn er påkrevd'),
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(8, 'Passordet må være minst 8 tegn'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passordene er ikke like',
  path: ['confirm_password'],
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    if (!data.user) {
      setServerError('Noe gikk galt. Prøv igjen.')
      return
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({ id: data.user.id, full_name: values.full_name })

    if (profileError) {
      setServerError('Kunne ikke opprette profil. Prøv igjen.')
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Registrer deg</CardTitle>
          <CardDescription>Opprett en personlig konto</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="full_name">Navn</Label>
              <Input id="full_name" type="text" autoComplete="name" {...register('full_name')} />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Passord</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm_password">Bekreft passord</Label>
              <Input id="confirm_password" type="password" autoComplete="new-password" {...register('confirm_password')} />
              {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password.message}</p>}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Oppretter konto…' : 'Opprett konto'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Har du allerede konto?{' '}
            <Link to="/login" className="underline underline-offset-4 hover:text-primary">
              Logg inn
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

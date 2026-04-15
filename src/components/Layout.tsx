import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

interface LayoutProps {
  associationName?: string
  children: React.ReactNode
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Oppgaver' },
  { to: '/members', label: 'Medlemmer' },
]

export default function Layout({ associationName, children }: LayoutProps) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">HMS-portal</p>
            <h1 className="text-base font-semibold leading-tight">
              {associationName ?? '…'}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Logg ut
          </Button>
        </div>
        <nav className="max-w-3xl mx-auto px-4 flex gap-1 border-t">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

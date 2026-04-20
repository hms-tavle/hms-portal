import { NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Oppgaver' },
  { to: '/members', label: 'Medlemmer' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { workspaces, activeWorkspace, setActiveWorkspace, loading } = useWorkspace()

  const showWorkspaceTabs = !loading && workspaces.length > 1

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">HMS-portal</p>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Logg ut
          </Button>
        </div>

        {/* Workspace switcher — only when user belongs to more than one workspace */}
        {showWorkspaceTabs && (
          <div className="max-w-3xl mx-auto px-4 flex gap-1 border-t">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeWorkspace?.id === ws.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {ws.displayName}
              </button>
            ))}
          </div>
        )}

        {/* Section nav */}
        <nav className="max-w-3xl mx-auto px-4 flex gap-1 border-t">
          {NAV_ITEMS.filter(item => {
            if (activeWorkspace?.kind === 'association' && activeWorkspace.role_code === 'EKST' && item.to === '/members') {
              return false
            }
            return true
          }).map(item => (
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

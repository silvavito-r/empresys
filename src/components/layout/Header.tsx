import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { signOut } from '@/hooks/useAuth'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User } from 'lucide-react'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = profile?.nome || user?.email || ''

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-border z-10 flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{displayName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1" />
          Sair
        </Button>
      </div>
    </header>
  )
}
